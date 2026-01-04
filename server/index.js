const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();

// Importante: CORS permite que React (puerto 5173) hable con Node (puerto 3001)
app.use(cors()); 
app.use(express.json());

// Endpoint de búsqueda
// Endpoint de Búsqueda de Clientes (CORREGIDO PARA EVITAR DUPLICADOS)
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        // USAMOS 'DISTINCT ON (c.id)'
        // Esto le dice a Postgres: "Si hay duplicados del mismo cliente, quédate solo con el primero que encuentres".
        // Y gracias al ORDER BY ... DESC, el primero siempre será el más reciente.
        const query = `
            SELECT DISTINCT ON (c.id)
                c.id, c.first_name, c.last_name, c.email, c.phone, c.dni, -- <--- AÑADIDO DNI
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
            WHERE c.first_name ILIKE $1 OR c.last_name ILIKE $1 OR c.dni ILIKE $1 -- <--- AÑADIDO BUSQUEDA POR DNI
            ORDER BY c.id, s.id DESC; 
        `;

        const result = await pool.query(query, [`%${q}%`]);
        res.json(result.rows);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error del servidor");
    }
});


// Endpoint para crear un cliente
app.post('/api/clients', async (req, res) => {
    try {
        // --- AÑADE ESTO ---
        console.log("--> Intentando guardar cliente:");
        console.log("Cuerpo recibido (body):", req.body);
        // ------------------

        const { first_name, last_name, email, phone, dni } = req.body; 
        const result = await pool.query(
            'INSERT INTO clients (first_name, last_name, email, phone, dni) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [first_name, last_name, email, phone, dni] // <--- Guardamos DNI
        );
        if (!first_name || !last_name) {
            console.log("Faltan nombre o apellido"); // Log para depurar
            return res.status(400).json({ error: "Nombre y Apellido son obligatorios" });
        }

        const query = `
            INSERT INTO clients (first_name, last_name, email, phone)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;

        const newClient = await pool.query(query, [first_name, last_name, email, phone]);
        
        console.log("Cliente guardado en BD:", newClient.rows[0]); // Log de éxito
        res.json(newClient.rows[0]);

    } catch (err) {
        // --- ESTO ES LO IMPORTANTE ---
        console.error("ERROR SQL DETALLADO:", err.message); 
        // -----------------------------
        res.status(500).send("Error al guardar el cliente");
    }
});

// 1. Endpoint para obtener los planes disponibles
app.get('/api/plans', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM plans WHERE is_active = true ORDER BY price ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error al obtener planes");
    }
});

// 2. Endpoint para crear una suscripción (RENUEVA AL CLIENTE)
app.post('/api/subscriptions', async (req, res) => {
    try {
        const { client_id, plan_id } = req.body;

        // A. Primero buscamos cuánto dura el plan elegido
        const planResult = await pool.query('SELECT * FROM plans WHERE id = $1', [plan_id]);
        
        if (planResult.rows.length === 0) {
            return res.status(400).json({ error: "Plan no encontrado" });
        }

        const plan = planResult.rows[0];

        // B. Insertamos la suscripción calculando la fecha de fin en SQL directamente
        const query = `
            INSERT INTO subscriptions (client_id, plan_id, start_date, end_date, price_paid)
            VALUES (
                $1, 
                $2, 
                CURRENT_DATE, 
                CURRENT_DATE + ($3 || ' days')::INTERVAL, 
                $4
            )
            RETURNING *;
        `;

        const newSub = await pool.query(query, [client_id, plan.id, plan.duration_days, plan.price]);
        
        res.json(newSub.rows[0]);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error al crear suscripción");
    }
});

// NUEVO: Registrar una visita (Check-in)
app.post('/api/checkin', async (req, res) => {
    try {
        const { client_id } = req.body;

        // 1. Verificamos si tiene suscripción activa HOY
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

        // 2. Si está activo, guardamos la visita
        await pool.query('INSERT INTO visits (client_id) VALUES ($1)', [client_id]);

        res.json({ success: true, message: "¡Adentro! Visita registrada." });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error al registrar visita");
    }
});

// NUEVO: Endpoint de Estadísticas Agrupadas
app.get('/api/stats', async (req, res) => {
    try {
        // 1. Visitas últimos 30 días
        const dailyQuery = `
            SELECT to_char(visited_at, 'DD/MM') as name, COUNT(*)::int as visits 
            FROM visits 
            WHERE visited_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY 1 ORDER BY to_date(to_char(visited_at, 'DD/MM'), 'DD/MM');
        `;

        // 2. Visitas por Mes (Último año)
        const monthlyQuery = `
            SELECT to_char(visited_at, 'FMMonth') as name, COUNT(*)::int as visits, MIN(visited_at) as order_date
            FROM visits 
            WHERE visited_at >= CURRENT_DATE - INTERVAL '1 year'
            GROUP BY 1 ORDER BY order_date;
        `;

        // 3. Totales (KPIs) 
        const totalsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM clients) as total_clients,
                (SELECT COUNT(DISTINCT client_id) FROM subscriptions WHERE end_date >= CURRENT_DATE) as active_clients
        `;

        const daily = await pool.query(dailyQuery);
        const monthly = await pool.query(monthlyQuery);
        const totals = await pool.query(totalsQuery);

        res.json({
            daily: daily.rows,
            monthly: monthly.rows,
            totals: totals.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Error calculando estadísticas");
    }
});

// Endpoint: Obtener las visitas RECIENTES (Últimas 24 horas)
app.get('/api/visits', async (req, res) => {
    try {
        const query = `
            SELECT v.id, v.visited_at, c.first_name, c.last_name 
            FROM visits v
            JOIN clients c ON v.client_id = c.id
            -- CAMBIO CLAVE: En vez de CURRENT_DATE, pedimos las últimas 24h
            -- Esto evita problemas de zona horaria
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

// ACTUALIZAR DATOS DEL CLIENTE Y SU FECHA DE VENCIMIENTO
app.put('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, email, phone, dni, expiration_date } = req.body; // <--- Recibimos DNI
        // 1. Actualizamos los datos personales
        await pool.query(
            'UPDATE clients SET first_name = $1, last_name = $2, email = $3, phone = $4, dni = $5 WHERE id = $6',
            [first_name, last_name, email, phone, dni, id]
        );

        // 2. Si nos mandan una fecha, actualizamos SU ÚLTIMA suscripción
        if (expiration_date) {
            // Buscamos el ID de la última suscripción de este cliente
            const subQuery = `
                UPDATE subscriptions 
                SET end_date = $1 
                WHERE id = (
                    SELECT id FROM subscriptions 
                    WHERE client_id = $2 
                    ORDER BY end_date DESC 
                    LIMIT 1
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

// NUEVO: Eliminar un cliente y todo su historial
app.delete('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Borrar Visitas
        await pool.query('DELETE FROM visits WHERE client_id = $1', [id]);
        
        // 2. Borrar Suscripciones
        await pool.query('DELETE FROM subscriptions WHERE client_id = $1', [id]);

        // 3. Finalmente, borrar al Cliente
        const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Cliente no encontrado" });
        }

        res.json({ message: "Cliente eliminado correctamente" });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error al eliminar cliente");
    }
});

// NUEVO: Obtener TODOS los socios ordenados alfabéticamente
app.get('/api/clients-all', async (req, res) => {
    try {
        // Usamos una subconsulta para primero calcular el estado único de cada uno
        // y LUEGO ordenarlos por nombre.
        const query = `
            SELECT * FROM (
                SELECT DISTINCT ON (c.id)
                    c.id, c.first_name, c.last_name, c.email, c.phone,
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