const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixTransactionsTable() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: parseInt(process.env.DB_PORT, 10) || 3306,
            database: process.env.DB_NAME || 'saas_pop_db'
        });

        console.log('🔌 Fixing transactions table...');

        // Check if column exists
        const [columns] = await connection.query("SHOW COLUMNS FROM transactions LIKE 'user_id'");

        if (columns.length === 0) {
            console.log('🔧 Adding user_id column...');
            // Try to add it if table exists but column missing
            try {
                await connection.query(`ALTER TABLE transactions ADD COLUMN user_id INT AFTER id`);
                console.log('✅ Column added.');
            } catch (e) {
                console.log('⚠️ Could not alter, trying recreate...');
                await connection.query('DROP TABLE IF EXISTS transactions');
                await connection.query(`
              CREATE TABLE transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                employer_id INT,
                amount DECIMAL(10, 2) NOT NULL,
                type ENUM('credit', 'debit') NOT NULL,
                description TEXT,
                date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
              ) ENGINE=MyISAM
           `);
                console.log('✅ Recreated transactions table.');
            }
        } else {
            console.log('ℹ️  Column user_id already exists.');
        }

    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
            // Table doesn't exist, create it
            console.log('⚠️ Table transactions missing, creating...');
            await connection.query(`
              CREATE TABLE transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                employer_id INT,
                amount DECIMAL(10, 2) NOT NULL,
                type ENUM('credit', 'debit') NOT NULL,
                description TEXT,
                date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
              ) ENGINE=MyISAM
           `);
            console.log('✅ Created transactions table.');
        } else {
            console.error('❌ Error:', error.message);
        }
    } finally {
        if (connection) connection.end();
    }
}

fixTransactionsTable();
