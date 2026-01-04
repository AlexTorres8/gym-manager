const express = require('express');
const pg = require('pg');
const cors = require('cors'); 
require('dotenv').config();

const app = express();

// --- 1. CONFIGURACIÓN DE LA BASE DE DATOS (FALTABA ESTO) ---
const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Importante: CORS permite que la web hable con el servidor
app.use(cors()); 
app.use(express.json());

// Endpoint de Búsqueda de Clientes
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        // DISTINCT ON para evitar duplicados en la búsqueda
        const query = `
            SELECT DISTINCT ON (c.id)
                c.id, c.first_name, c.last_name, c.email, c.phone, c.dni,
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
        console.error(err.message);
        res.status(500).send("Error del servidor");
    }
});


// Endpoint para crear un cliente (CORREGIDO: Había código duplicado)
app.post('/api/clients', async (req, res) => {
    try {
        console.log("--> Intentando guardar cliente:", req.body);
        
        const { first_name, last_name, email, phone, dni } = req.body; 
        
        if (!first_name || !last_name) {
            return res.status(400).json({ error: "Nombre y Apellido son obligatorios" });
        }

        // Solo hacemos UN insert (antes había dos)
        const result = await pool.query(
            'INSERT INTO clients (first_name, last_name, email, phone, dni) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [first_name, last_name, email, phone, dni]
        );

        console.log("Cliente guardado:", result.rows[0]);
        res.json(result.rows[0]);

    } catch (err) {
        console.error("ERROR SQL:", err.message); 
        res.status(500).send("Error al guardar el cliente");
    }
});

// Endpoint para obtener los planes disponibles
app.get('/api/plans', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM plans WHERE price > 0 ORDER BY price ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error al obtener planes");
    }
});

// Endpoint para crear una suscripción (RENOVAR)
app.post('/api/subscriptions', async (req, res) => {
    try {
        const { client_id, plan_id } = req.body;

        // A. Buscamos el plan
        const planResult = await pool.query('SELECT * FROM plans WHERE id = $1', [plan_id]);
        
        if (planResult.rows.length === 0) {
            return res.status(400).json({ error: "Plan no encontrado" });
        }
        const plan = planResult.rows[0];

        // B. Insertamos la suscripción
        const query = `
            INSERT INTO subscriptions (client_id, plan_id, start_date, end_date)
            VALUES (
                $1, 
                $2, 
                CURRENT_DATE, 
                CURRENT_DATE + ($3 || ' days')::INTERVAL
            )
            RETURNING *;
        `;

        const newSub = await pool.query(query, [client_id, plan.id, plan.duration_days]);
        res.json(newSub.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error al crear suscripción");
    }
});

// Registrar una visita (Check-in)
app.post('/api/checkin', async (req, res) => {
    try {
        const { client_id } = req.body;

        // 1. Verificamos suscripción
        const statusQuery = `
            SELECT MAX(end_date) as expiration 
            FROM subscriptions 
            WHERE client_id = $1
        `;
        const statusResult = await pool.query(statusQuery, [client_id]);
        const expiration = statusResult.rows[0].expiration;

        const isActive = expiration && new Date(expiration) >= new Date();

        if (!isActive) {
            return res.status(403).json({ error: "ACCESO DENEGADO: Cuota vencida" });
        }

        // 2. Guardamos visita
        await pool.query('INSERT INTO visits (client_id) VALUES ($1)', [client_id]);
        res.json({ success: true, message: "¡Adentro! Visita registrada." });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error al registrar visita");
    }
});

// Estadísticas
app.get('/api/stats', async (req, res) => {
    try {
        const dailyQuery = `
            SELECT to_char(visited_at, 'DD/MM') as name, COUNT(*)::int as visits 
            FROM visits 
            WHERE visited_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY 1 ORDER BY to_date(to_char(visited_at, 'DD/MM'), 'DD/MM');
        `;
        const monthlyQuery = `
            SELECT to_char(visited_at, 'FMMonth') as name, COUNT(*)::int as visits, MIN(visited_at) as order_date
            FROM visits 
            WHERE visited_at >= CURRENT_DATE - INTERVAL '1 year'
            GROUP BY 1 ORDER BY order_date;
        `;
        const totalsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM clients) as total_clients,
                (SELECT COUNT(DISTINCT client_id) FROM subscriptions WHERE end_date >= CURRENT_DATE) as active_clients
        `;

        const daily = await pool.query(dailyQuery);
        const monthly = await pool.query(monthlyQuery);
        const totals = await pool.query(totalsQuery);

        res.json({ daily: daily.rows, monthly: monthly.rows, totals: totals.rows[0] });

    } catch (err) {
        console.error(err);
        res.status(500).send("Error calculando estadísticas");
    }
});

// Visitas Recientes (Últimas 24 horas)
app.get('/api/visits', async (req, res) => {
    try {
        const query = `
            SELECT v.id, v.visited_at, c.first_name, c.last_name 
            FROM visits v
            JOIN clients c ON v.client_id = c.id
            WHERE v.visited_at > NOW() - INTERVAL '24 hours' 
            ORDER BY v.visited_at DESC
            LIMIT 20;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al leer visitas");
    }
});

// Actualizar cliente
app.put('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, email, phone, dni, expiration_date } = req.body;

        await pool.query(
            'UPDATE clients SET first_name = $1, last_name = $2, email = $3, phone = $4, dni = $5 WHERE id = $6',
            [first_name, last_name, email, phone, dni, id]
        );

        if (expiration_date) {
            const subQuery = `
                UPDATE subscriptions 
                SET end_date = $1 
                WHERE id = (
                    SELECT id FROM subscriptions WHERE client_id = $2 ORDER BY end_date DESC LIMIT 1
                )
            `;
            await pool.query(subQuery, [expiration_date, id]);
        }
        res.json({ message: "Datos actualizados" });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error al actualizar cliente");
    }
});

// Eliminar cliente
app.delete('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM visits WHERE client_id = $1', [id]);
        await pool.query('DELETE FROM subscriptions WHERE client_id = $1', [id]);
        const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) return res.status(404).json({ error: "No encontrado" });
        res.json({ message: "Cliente eliminado correctamente" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error al eliminar cliente");
    }
});

// Todos los socios
app.get('/api/clients-all', async (req, res) => {
    try {
        const query = `
            SELECT * FROM (
                SELECT DISTINCT ON (c.id)
                    c.id, c.first_name, c.last_name, c.email, c.phone, c.dni, -- AÑADIDO DNI
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
        console.error(err);
        res.status(500).send("Error al obtener lista de socios");
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor API corriendo en puerto ${PORT}`);
});