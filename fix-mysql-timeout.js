/**
 * MySQL Connection Timeout Fix
 * This script helps diagnose why MySQL is timing out
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
    console.log('\n🔍 Testing MySQL Connection...\n');

    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'saas_pop_db',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        connectTimeout: 10000, // 10 seconds
    };

    console.log('Configuration:');
    console.log('  Host:', config.host);
    console.log('  User:', config.user);
    console.log('  Database:', config.database);
    console.log('  Port:', config.port);
    console.log('  Password:', config.password ? '(set)' : '(empty)');
    console.log('\n');

    try {
        console.log('⏳ Connecting to MySQL...');
        const connection = await mysql.createConnection(config);
        console.log('✅ Connection successful!\n');

        // Test query
        const [result] = await connection.query('SELECT 1 + 1 AS solution');
        console.log('✅ Test query successful:', result[0].solution);

        // Check database
        const [databases] = await connection.query('SHOW DATABASES');
        const dbExists = databases.some(db => db.Database === config.database);

        if (!dbExists) {
            console.log(`\n❌ Database '${config.database}' does NOT exist!`);
            console.log('\n💡 Creating database...');
            await connection.query(`CREATE DATABASE ${config.database}`);
            console.log(`✅ Database '${config.database}' created!`);
        } else {
            console.log(`✅ Database '${config.database}' exists`);
        }

        await connection.query(`USE ${config.database}`);

        // Check tables
        const [tables] = await connection.query('SHOW TABLES');
        console.log(`\n📋 Found ${tables.length} tables in database:`);
        tables.forEach(table => {
            console.log(`  - ${Object.values(table)[0]}`);
        });

        // Check for companies table
        const companiesExists = tables.some(t => Object.values(t)[0] === 'companies');
        if (companiesExists) {
            const [columns] = await connection.query('DESCRIBE companies');
            console.log('\n🏢 Companies table structure:');
            columns.forEach(col => {
                console.log(`  ${col.Field} (${col.Type})`);
            });
        }

        // Check for employees table
        const employeesExists = tables.some(t => Object.values(t)[0] === 'employees');
        if (employeesExists) {
            const [columns] = await connection.query('DESCRIBE employees');
            console.log('\n👥 Employees table structure:');
            columns.forEach(col => {
                console.log(`  ${col.Field} (${col.Type})`);
            });

            // Check for employer_id column
            const hasEmployerId = columns.some(col => col.Field === 'employer_id');
            if (!hasEmployerId) {
                console.log('\n⚠️  WARNING: employees table missing employer_id column!');
                console.log('This is causing the error you see in logs.');
            }
        }

        await connection.end();
        console.log('\n✅ All checks completed!\n');

    } catch (error) {
        console.error('\n❌ Connection failed!');
        console.error('Error:', error.message);
        console.error('\n🔧 Possible solutions:');
        console.error('  1. Check if MySQL service is running');
        console.error('  2. Verify .env file has correct credentials');
        console.error('  3. Check if firewall is blocking port 3306');
        console.error('  4. Try restarting MySQL service\n');
        process.exit(1);
    }
}

testConnection();
