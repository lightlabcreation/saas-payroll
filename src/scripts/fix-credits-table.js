const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixCreditsTable() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: parseInt(process.env.DB_PORT, 10) || 3306,
            database: process.env.DB_NAME || 'saas_pop_db'
        });

        console.log('🔌 Checking credits table...');

        // Check if column exists
        const [columns] = await connection.query("SHOW COLUMNS FROM credits LIKE 'total_added'");

        if (columns.length === 0) {
            console.log('🔧 Adding total_added column to credits table...');
            await connection.query(`
        ALTER TABLE credits
        ADD COLUMN total_added DECIMAL(10, 2) DEFAULT 0.00 AFTER balance,
        ADD COLUMN total_used DECIMAL(10, 2) DEFAULT 0.00 AFTER total_added
      `);
            console.log('✅ Columns added successfully');
        } else {
            console.log('ℹ️  Column total_added already exists');
        }

    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('ℹ️  Column checks passed (handled duplication).');
        } else {
            console.error('❌ Error:', error.message);
        }
    } finally {
        if (connection) connection.end();
    }
}

fixCreditsTable();
