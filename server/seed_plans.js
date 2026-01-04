const pool = require('./db');

const insertPlansQuery = `
    INSERT INTO plans (name, price, duration_days, is_active) VALUES 
    ('Pase Diario', 10.00, 1, true),
    ('Mensual General', 45.00, 30, true),
    ('Trimestral Ahorro', 120.00, 90, true),
    ('Anual VIP', 450.00, 365, true);
`;

const seedDB = async () => {
    try {
        console.log("⏳ Insertando planes...");
        await pool.query(insertPlansQuery);
        console.log("✅ ¡Planes creados correctamente!");
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        pool.end();
    }
};

seedDB();