const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixSubscriptionsTable() {
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

        // Check current structure
        console.log('\n📋 Current subscriptions table structure:');
        const [columns] = await connection.query('DESCRIBE subscriptions');
        columns.forEach(col => {
            console.log(`   ${col.Field} - ${col.Type}`);
        });

        // Drop and recreate with correct structure
        console.log('\n🔧 Recreating subscriptions table...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query('DROP TABLE IF EXISTS subscriptions');
        await connection.query(`
      CREATE TABLE subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employer_id INT NOT NULL,
        plan_id INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=MyISAM
    `);
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✅ Subscriptions table recreated');

        // Verify
        const [newColumns] = await connection.query('DESCRIBE subscriptions');
        console.log('\n📋 New subscriptions table structure:');
        newColumns.forEach(col => {
            console.log(`   ✓ ${col.Field} - ${col.Type}`);
        });

        console.log('\n🎉 Subscriptions table fixed!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Connection closed');
        }
    }
}

fixSubscriptionsTable();
