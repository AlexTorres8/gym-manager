const express = require('express');
const pg = require('pg');
const cors = require('cors'); 
require('dotenv').config();

const app = express();

// --- 1. CONFIGURACIÓN DE BASE DE DATOS BLINDADA ---
// Usamos la variable DATABASE_URL si existe, si no, intentamos construirla
const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

app.use(cors()); 
app.use(express.json());

// --- 2. ENDPOINTS ---

// BUSCAR SOCIOS (Aquí es donde añadimos las gafas para leer la enfermedad)
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        const query = `
            SELECT DISTINCT ON (c.id)
                c.id, c.first_name, c.last_name, c.email, c.phone, c.dni, 
                c.medical_conditions,
                s.end_date as last_expiration_date,
                p.name as last_plan,
                CASE 
                    WHEN s.end_date >= CURRENT_DATE THEN 'ACTIVO'
                    WHEN s.end_date < CURRENT_DATE THEN 'INACTIVO'
                    ELSE 'NUNCA_INSCRITO'
                END as status
            FROM clients c
            LEFT JOIN subscriptions s ON c.id = s.client_id
            LEFT JOIN plans p ON s.plan_id = p.id
            WHERE c.first_name ILIKE $1 OR c.last_name ILIKE $1 OR c.dni ILIKE $1
            ORDER BY c.id, s.id DESC; 
        `;

        const result = await pool.query(query, [`%${q}%`]);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error Buscando:", err);
        res.status(500).send("Error del servidor");
    }
});

/// Endpoint para crear un cliente (CON FECHA Y PLAN INTELIGENTE)
app.post('/api/clients', async (req, res) => {
    try {
        console.log("📥 Recibido:", req.body);
        
        const { first_name, last_name, email, phone, dni, medical_conditions, expiration_date, plan_name } = req.body;
        
        // 1. Insertamos CLIENTE
        const resultClient = await pool.query(
            'INSERT INTO clients (first_name, last_name, email, phone, dni, medical_conditions) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [first_name, last_name, email, phone, dni, medical_conditions] 
        );
        const newClient = resultClient.rows[0];

        // 2. Si viene fecha, gestionamos la SUSCRIPCIÓN
        if (expiration_date) {
            let validPlanId = null;

            // --- LÓGICA MAESTRA DE PLANES ---
            
            // OPCIÓN A: Si el Excel trae nombre de plan (ej: "Trimestral"), lo buscamos
            if (plan_name) {
                const planByName = await pool.query('SELECT id FROM plans WHERE name ILIKE $1', [plan_name]);
                if (planByName.rows.length > 0) validPlanId = planByName.rows[0].id;
            }

            // OPCIÓN B: Si no viene en Excel o no existe, buscamos uno que contenga "Mensual" (el más común)
            if (!validPlanId) {
                const defaultPlan = await pool.query("SELECT id FROM plans WHERE name ILIKE '%Mensual%' LIMIT 1");
                if (defaultPlan.rows.length > 0) validPlanId = defaultPlan.rows[0].id;
            }

            // OPCIÓN C: Si todo falla, cogemos el primero que haya (el comodín)
            if (!validPlanId) {
                const anyPlan = await pool.query('SELECT id FROM plans LIMIT 1');
                if (anyPlan.rows.length > 0) validPlanId = anyPlan.rows[0].id;
            }

            // --- FIN LÓGICA ---

            if (validPlanId) {
                console.log(`✅ Asignando Plan ID: ${validPlanId} al cliente ${newClient.first_name}`);
                await pool.query(
                    'INSERT INTO subscriptions (client_id, plan_id, start_date, end_date, price_paid) VALUES ($1, $2, CURRENT_DATE, $3, 0)',
                    [newClient.id, validPlanId, expiration_date] 
                );
            } else {
                console.warn("⚠️ No se encontró ningún plan en la base de datos.");
            }
        }

        res.json(newClient);

    } catch (err) {
        console.error("❌ ERROR AL GUARDAR:", err.message);
        res.status(200).json({ message: "Cliente creado con avisos", error: err.message });
    }
});

// EDITAR SOCIO
app.put('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, email, phone, dni, expiration_date, medical_conditions } = req.body;

        console.log(`📝 Editando cliente ${id}. Enfermedad:`, medical_conditions);

        await pool.query(
            'UPDATE clients SET first_name = $1, last_name = $2, email = $3, phone = $4, dni = $5, medical_conditions = $6 WHERE id = $7',
            [first_name, last_name, email, phone, dni, medical_conditions, id]
        );

        // Si hay fecha, actualizamos suscripción
        if (expiration_date) {
            const subQuery = `
                UPDATE subscriptions SET end_date = $1 
                WHERE id = (SELECT id FROM subscriptions WHERE client_id = $2 ORDER BY end_date DESC LIMIT 1)
            `;
            await pool.query(subQuery, [expiration_date, id]);
        }
        res.json({ message: "Datos actualizados" });
    } catch (err) {
        console.error("❌ ERROR SQL AL EDITAR:", err);
        res.status(500).send("Error al actualizar cliente");
    }
});

// OBTENER TODOS (LISTA COMPLETA)
app.get('/api/clients-all', async (req, res) => {
    try {
        const query = `
            SELECT * FROM (
                SELECT DISTINCT ON (c.id)
                    c.id, c.first_name, c.last_name, c.email, c.phone, c.dni, 
                    c.medical_conditions,
                    s.end_date as last_expiration_date,  
                    p.name as last_plan,
                    CASE 
                        WHEN s.end_date >= CURRENT_DATE THEN 'ACTIVO'
                        WHEN s.end_date < CURRENT_DATE THEN 'INACTIVO'
                        ELSE 'NUNCA_INSCRITO'
                    END as status
                FROM clients c
                LEFT JOIN subscriptions s ON c.id = s.client_id
                LEFT JOIN plans p ON s.plan_id = p.id
                ORDER BY c.id, s.id DESC
            ) AS final_result
            ORDER BY first_name ASC, last_name ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error listando:", err);
        res.status(500).send("Error al obtener lista de socios");
    }
});

// RESTO DE ENDPOINTS (Planes, Visitas, Stats...)
app.get('/api/plans', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM plans WHERE price > 0 ORDER BY price ASC');
        res.json(result.rows);
    } catch (err) { res.status(500).send("Error"); }
});

app.post('/api/subscriptions', async (req, res) => {
    try {
        const { client_id, plan_id } = req.body;
        const planResult = await pool.query('SELECT * FROM plans WHERE id = $1', [plan_id]);
        if (planResult.rows.length === 0) return res.status(400).json({ error: "Plan no encontrado" });
        const plan = planResult.rows[0];
        const query = `INSERT INTO subscriptions (client_id, plan_id, start_date, end_date) VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + ($3 || ' days')::INTERVAL) RETURNING *;`;
        const newSub = await pool.query(query, [client_id, plan.id, plan.duration_days]);
        res.json(newSub.rows[0]);
    } catch (err) { res.status(500).send("Error"); }
});

app.post('/api/checkin', async (req, res) => {
    try {
        const { client_id } = req.body;
        const statusQuery = `SELECT MAX(end_date) as expiration FROM subscriptions WHERE client_id = $1`;
        const statusResult = await pool.query(statusQuery, [client_id]);
        const expiration = statusResult.rows[0].expiration;
        const isActive = expiration && new Date(expiration) >= new Date();
        if (!isActive) return res.status(403).json({ error: "ACCESO DENEGADO: Cuota vencida" });
        await pool.query('INSERT INTO visits (client_id) VALUES ($1)', [client_id]);
        res.json({ success: true, message: "¡Adentro! Visita registrada." });
    } catch (err) { res.status(500).send("Error"); }
});

app.get('/api/stats', async (req, res) => {
    try {
        const daily = await pool.query(`SELECT to_char(visited_at, 'DD/MM') as name, COUNT(*)::int as visits FROM visits WHERE visited_at >= CURRENT_DATE - INTERVAL '30 days' GROUP BY 1 ORDER BY to_date(to_char(visited_at, 'DD/MM'), 'DD/MM');`);
        const monthly = await pool.query(`SELECT to_char(visited_at, 'FMMonth') as name, COUNT(*)::int as visits, MIN(visited_at) as order_date FROM visits WHERE visited_at >= CURRENT_DATE - INTERVAL '1 year' GROUP BY 1 ORDER BY order_date;`);
        const totals = await pool.query(`SELECT (SELECT COUNT(*) FROM clients) as total_clients, (SELECT COUNT(DISTINCT client_id) FROM subscriptions WHERE end_date >= CURRENT_DATE) as active_clients`);
        res.json({ daily: daily.rows, monthly: monthly.rows, totals: totals.rows[0] });
    } catch (err) { res.status(500).send("Error"); }
});

app.get('/api/visits', async (req, res) => {
    try {
        const result = await pool.query(`SELECT v.id, v.visited_at, c.first_name, c.last_name FROM visits v JOIN clients c ON v.client_id = c.id WHERE v.visited_at > NOW() - INTERVAL '24 hours' ORDER BY v.visited_at DESC LIMIT 20;`);
        res.json(result.rows);
    } catch (err) { res.status(500).send("Error"); }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM visits WHERE client_id = $1', [id]);
        await pool.query('DELETE FROM subscriptions WHERE client_id = $1', [id]);
        await pool.query('DELETE FROM clients WHERE id = $1', [id]);
        res.json({ message: "Eliminado" });
    } catch (err) { res.status(500).send("Error"); }
});

app.get('/', (req, res) => { res.send('✅ Servidor Activo'); });

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor API corriendo y escuchando en el puerto ${PORT}`);
});