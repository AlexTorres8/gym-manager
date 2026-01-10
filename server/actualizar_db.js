const pg = require('pg');
require('dotenv').config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}?sslmode=require`,
    ssl: { rejectUnauthorized: false }
});

async function addMedicalColumn() {
    try {
        console.log("⏳ Añadiendo columna de enfermedades...");
        await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS medical_conditions TEXT DEFAULT '';");
        console.log("✅ ¡Columna creada con éxito!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error:", err.message);
        process.exit(1);
    }
}

addMedicalColumn();