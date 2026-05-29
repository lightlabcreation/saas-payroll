const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixCompaniesTable() {
    let connection;

    try {
        console.log('🔌 Connecting to database...');

        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: parseInt(process.env.DB_PORT, 10) || 3306,
            database: process.env.DB_NAME || 'saas_pop_db'
        });

        console.log('✅ Connected');

        // Disable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        // Drop the corrupted table
        console.log('🗑️  Dropping corrupted companies table...');
        await connection.query('DROP TABLE IF EXISTS companies');

        // Recreate companies table with MyISAM engine
        console.log('📝 Creating companies table...');
        await connection.query(`
      CREATE TABLE companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        company_name VARCHAR(200) NOT NULL,
        company_address TEXT,
        website VARCHAR(200),
        gst_number VARCHAR(50),
        pan_number VARCHAR(50),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=MyISAM
    `);

        console.log('✅ Companies table created');

        // Enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('\n🎉 Companies table fixed successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Connection closed');
        }
    }
}

fixCompaniesTable();
