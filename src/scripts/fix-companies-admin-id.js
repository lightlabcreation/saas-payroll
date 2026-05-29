const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixCompaniesAdminId() {
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

        // Check if column exists
        const [columns] = await connection.query("SHOW COLUMNS FROM companies LIKE 'admin_id'");

        if (columns.length === 0) {
            console.log('🔧 Adding admin_id column to companies table...');
            await connection.query(`
        ALTER TABLE companies
        ADD COLUMN admin_id INT AFTER user_id
      `);
            console.log('✅ Column added successfully');

            // Add index for performance
            await connection.query('CREATE INDEX idx_companies_admin_id ON companies(admin_id)');
            console.log('✅ Index created');
        } else {
            console.log('ℹ️  Column admin_id already exists');
        }

        console.log('\n🎉 Companies table admin_id fixed!');

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

fixCompaniesAdminId();
