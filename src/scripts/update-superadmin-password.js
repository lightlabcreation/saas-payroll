const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function updateSuperadminPassword() {
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

        // Check if superadmin exists
        const [users] = await connection.query('SELECT * FROM users WHERE email = ?', ['superadmin@gmail.com']);

        if (users.length === 0) {
            console.log('⚠️  Superadmin not found, creating...');
            const password = 'Admin@123';
            const hashedPassword = await bcrypt.hash(password, 10);

            await connection.query(`
        INSERT INTO users (name, email, phone, password, role, status) VALUES
        ('Super Admin', 'superadmin@gmail.com', '9999999999', ?, 'superadmin', 'active')
      `, [hashedPassword]);

            console.log('✅ Superadmin created');
        } else {
            console.log('✅ Superadmin found, updating password...');
            const password = 'Admin@123';
            const hashedPassword = await bcrypt.hash(password, 10);

            await connection.query(
                'UPDATE users SET password = ? WHERE email = ?',
                [hashedPassword, 'superadmin@gmail.com']
            );

            console.log('✅ Password updated');
        }

        console.log('\n🎉 Superadmin credentials:');
        console.log('   📧 Email: superadmin@gmail.com');
        console.log('   🔑 Password: Admin@123');

        // Verify the password
        const [updatedUsers] = await connection.query('SELECT * FROM users WHERE email = ?', ['superadmin@gmail.com']);
        const isValid = await bcrypt.compare('Admin@123', updatedUsers[0].password);
        console.log('\n✅ Password verification:', isValid ? 'SUCCESS' : 'FAILED');

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

updateSuperadminPassword();
