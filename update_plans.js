const mysql = require('./src/config/mysql');

async function run() {
  try {
    await mysql.query('TRUNCATE TABLE plans');
    
    const features = JSON.stringify(["employee", "jobPortal", "vendor"]);
    
    const insertQuery = `
      INSERT INTO plans (id, name, price, duration_months, description, features, max_employees, max_jobs, is_active, created_at, updated_at) 
      VALUES 
      (1, 'Free Trial', '0.00', 0, '7-Day Free Trial', ?, 50, 50, 1, NOW(), NOW()),
      (2, 'Monthly Plan', '10.00', 1, 'Standard Monthly Subscription', ?, null, null, 1, NOW(), NOW()),
      (3, 'Yearly Plan', '100.00', 12, 'Best Value Yearly Subscription', ?, null, null, 1, NOW(), NOW())
    `;
    
    await mysql.query(insertQuery, [features, features, features]);
    console.log('Plans updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
