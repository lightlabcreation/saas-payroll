const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function fixDatabase() {
  let connection;

  try {
    console.log('🔌 Connecting to MySQL/MariaDB...');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      database: process.env.DB_NAME || 'saas_pop_db'
    });

    console.log('✅ Connected to database');

    // Check version
    const [versionResult] = await connection.query('SELECT VERSION() as version');
    console.log('Database Version:', versionResult[0].version);

    // Disable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('SET sql_mode = ""');
    await connection.query('SET innodb_strict_mode = 0');

    // Create users table
    console.log('\n📝 Creating users table...');
    await connection.query(`DROP TABLE IF EXISTS users`);
    await connection.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        phone VARCHAR(30),
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'jobseeker',
        company_id INT,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        last_login DATETIME,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_email (email)
      ) ROW_FORMAT=DYNAMIC
    `);
    console.log('✅ users table created');

    // Create employers table
    console.log('📝 Creating employers table...');
    await connection.query(`DROP TABLE IF EXISTS employers`);
    await connection.query(`
      CREATE TABLE employers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        company_name VARCHAR(200) NOT NULL,
        company_address TEXT,
        website VARCHAR(200),
        gst_number VARCHAR(50),
        pan_number VARCHAR(50),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ROW_FORMAT=DYNAMIC
    `);
    console.log('✅ employers table created');

    // Create admins table
    console.log('📝 Creating admins table...');
    await connection.query(`DROP TABLE IF EXISTS admins`);
    await connection.query(`
      CREATE TABLE admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        department VARCHAR(100),
        created_by INT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ROW_FORMAT=DYNAMIC
    `);
    console.log('✅ admins table created');

    // Create plans table
    console.log('📝 Creating plans table...');
    await connection.query(`DROP TABLE IF EXISTS plans`);
    await connection.query(`
      CREATE TABLE plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        duration_months INT NOT NULL DEFAULT 1,
        description TEXT,
        features TEXT,
        max_employees INT,
        max_jobs INT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ROW_FORMAT=DYNAMIC
    `);
    console.log('✅ plans table created');

    // Create company_requests table
    console.log('📝 Creating company_requests table...');
    await connection.query(`DROP TABLE IF EXISTS company_requests`);
    await connection.query(`
      CREATE TABLE company_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_name VARCHAR(200) NOT NULL,
        contact_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        phone VARCHAR(30),
        plan_id INT NOT NULL,
        payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        request_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        company_address TEXT,
        gst_number VARCHAR(50),
        pan_number VARCHAR(50),
        notes TEXT,
        processed_by INT,
        processed_at DATETIME,
        created_company_id INT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ROW_FORMAT=DYNAMIC
    `);
    console.log('✅ company_requests table created');

    // Create subscriptions table
    console.log('📝 Creating subscriptions table...');
    await connection.query(`DROP TABLE IF EXISTS subscriptions`);
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
      ) ROW_FORMAT=DYNAMIC
    `);
    console.log('✅ subscriptions table created');

    // Enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // Insert sample plans
    console.log('\n📊 Inserting sample plans...');
    await connection.query(`
      INSERT INTO plans (name, price, duration_months, description, features, max_employees, max_jobs, is_active) VALUES
      ('Basic', 999.00, 1, 'Perfect for small businesses', '["Basic payroll", "Up to 10 employees", "Email support"]', 10, 5, TRUE),
      ('Professional', 2999.00, 1, 'For growing companies', '["Advanced payroll", "Up to 50 employees", "Priority support", "Reports"]', 50, 20, TRUE),
      ('Enterprise', 9999.00, 1, 'For large organizations', '["Full payroll suite", "Unlimited employees", "24/7 support", "Custom reports", "API access"]', NULL, NULL, TRUE)
    `);
    console.log('✅ Plans inserted');

    // Create superadmin user
    console.log('\n👤 Creating superadmin user...');
    const password = 'Admin@123';
    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.query(`
      INSERT INTO users (name, email, phone, password, role, status) VALUES
      ('Super Admin', 'superadmin@gmail.com', '9999999999', ?, 'superadmin', 'active')
    `, [hashedPassword]);

    console.log('✅ Superadmin created');
    console.log('   📧 Email: superadmin@gmail.com');
    console.log('   🔑 Password: Admin@123');

    // Show all tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\n📊 All tables in database:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   ✓ ${tableName}`);
    });

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n🚀 You can now login with:');
    console.log('   📧 Email: superadmin@gmail.com');
    console.log('   🔑 Password: Admin@123');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.sql) console.error('SQL:', error.sql);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Connection closed');
    }
  }
}

fixDatabase();
