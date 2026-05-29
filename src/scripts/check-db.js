const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
    let connection;

    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: parseInt(process.env.DB_PORT, 10) || 3306
        });

        console.log('✅ Connected to MySQL');

        const dbName = process.env.DB_NAME || 'saas_pop_db';

        // Check if database exists
        const [databases] = await connection.query('SHOW DATABASES');
        console.log('\n📊 Available databases:');
        databases.forEach(db => {
            const name = Object.values(db)[0];
            console.log(`   ${name === dbName ? '✓' : ' '} ${name}`);
        });

        // Try to use the database
        try {
            await connection.query(`USE \`${dbName}\``);
            console.log(`\n✅ Using database '${dbName}'`);

            // Show existing tables
            const [tables] = await connection.query('SHOW TABLES');
            if (tables.length > 0) {
                console.log('\n📋 Existing tables:');
                tables.forEach(table => {
                    const tableName = Object.values(table)[0];
                    console.log(`   ✓ ${tableName}`);
                });
            } else {
                console.log('\n⚠️  No tables found in database');
            }
        } catch (err) {
            console.log(`\n⚠️  Database '${dbName}' does not exist or cannot be accessed`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkDatabase();
