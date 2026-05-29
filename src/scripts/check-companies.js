const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkCompaniesTable() {
    let connection;

    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: parseInt(process.env.DB_PORT, 10) || 3306,
            database: process.env.DB_NAME || 'saas_pop_db'
        });

        console.log('✅ Connected to database');

        // Check companies table structure
        const [columns] = await connection.query('DESCRIBE companies');
        console.log('\n📋 Companies table structure:');
        columns.forEach(col => {
            console.log(`   ${col.Field} - ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
        });

        // Check if there's data
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM companies');
        console.log(`\n📊 Total companies: ${rows[0].count}`);

        // Check table engine
        const [tableInfo] = await connection.query(`
      SELECT ENGINE, TABLE_ROWS, CREATE_TIME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `, [process.env.DB_NAME || 'saas_pop_db', 'companies']);

        if (tableInfo.length > 0) {
            console.log(`\n🔧 Table Engine: ${tableInfo[0].ENGINE}`);
            console.log(`📅 Created: ${tableInfo[0].CREATE_TIME}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkCompaniesTable();
