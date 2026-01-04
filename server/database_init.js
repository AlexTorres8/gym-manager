const pool = require('./db');

const createTablesQuery = `
    -- 1. Tabla de Clientes
    CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(150),
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Tabla de Planes
    CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        duration_days INT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE
    );

    -- 3. Tabla de Suscripciones
    CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        client_id INT NOT NULL REFERENCES clients(id),
        plan_id INT NOT NULL REFERENCES plans(id),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        payment_status VARCHAR(20) DEFAULT 'paid',
        price_paid DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

const initDB = async () => {
    try {
        await pool.query(createTablesQuery);
        console.log("✅ Tablas creadas correctamente en la base de datos.");
    } catch (err) {
        console.error("❌ Error al crear tablas:", err);
    } finally {
        pool.end(); // Cerramos la conexión al terminar
    }
};

initDB();