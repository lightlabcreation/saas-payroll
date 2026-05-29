const mysql = require('mysql2/promise');
require('dotenv').config({path: './.env'});
(async () => {
    const conn = await mysql.createConnection({host: 'localhost', user: 'root', password: '', database: 'saas_pop_db'});
    await conn.query("UPDATE users SET company_id = 1 WHERE role IN ('admin', 'employer', 'employee', 'vendor')");
    console.log('Fixed company_id for users');
    process.exit(0);
})();
