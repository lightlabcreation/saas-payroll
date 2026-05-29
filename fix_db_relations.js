const mysql = require('mysql2/promise');
require('dotenv').config({path: './.env'});

(async () => {
    const conn = await mysql.createConnection({host: 'localhost', user: 'root', password: '', database: 'saas_pop_db'});
    
    // 1. Get the employer user ID
    const [empUser] = await conn.query('SELECT id FROM users WHERE email = "employer@gmail.com"');
    if (!empUser.length) {
        console.error('Employer user not found');
        process.exit(1);
    }
    const empUserId = empUser[0].id;
    
    // 2. Insert into employers table
    await conn.query('INSERT IGNORE INTO employers (user_id, company_id, company_name, subscription_plan) VALUES (?, 1, "Test Employer Company", "Professional")', [empUserId]);
    
    // 3. Get the new employer ID
    const [empRows] = await conn.query('SELECT id FROM employers WHERE user_id = ?', [empUserId]);
    const employerId = empRows[0].id;
    
    // 4. Update the company_id in users table for admin and employee
    await conn.query("UPDATE users SET company_id = ? WHERE role IN ('admin', 'employee', 'vendor')", [employerId]);
    // also update employer's own user record
    await conn.query("UPDATE users SET company_id = ? WHERE id = ?", [employerId, empUserId]);
    
    console.log('Successfully fixed employers and linked users to company_id:', employerId);
    process.exit(0);
})();
