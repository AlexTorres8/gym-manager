const pool = require('./db');

const query = `
    CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        client_id INT NOT NULL REFERENCES clients(id),
        visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

const run = async () => {
    try {
        await pool.query(query);
        console.log("✅ Tabla 'visits' creada.");
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
};

run();
