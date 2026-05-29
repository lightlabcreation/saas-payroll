const db = require('./src/config/mysql');

async function migrate() {
  try {
    console.log("Migrating vendors table...");
    await db.query(`ALTER TABLE vendors 
      ADD COLUMN employer_id INT(11) NULL AFTER company_id,
      ADD COLUMN contact_person VARCHAR(255) NULL AFTER company_name,
      ADD COLUMN phone VARCHAR(50) NULL AFTER contact_person,
      ADD COLUMN email VARCHAR(255) NULL AFTER phone,
      ADD COLUMN service_type VARCHAR(255) NULL AFTER email,
      ADD COLUMN salary DECIMAL(10,2) NULL AFTER service_type,
      ADD COLUMN joining_date DATE NULL AFTER salary,
      ADD COLUMN address TEXT NULL AFTER joining_date,
      ADD COLUMN payment_status VARCHAR(50) NULL AFTER address,
      ADD COLUMN status VARCHAR(50) NULL AFTER payment_status;`);
  } catch (err) {
    console.log("Vendors alter error (maybe already altered):", err.message);
  }

  try {
    console.log("Migrating training_courses table...");
    await db.query(`ALTER TABLE training_courses 
      ADD COLUMN description TEXT NULL AFTER title,
      ADD COLUMN start_date DATETIME NULL AFTER trainer_name,
      ADD COLUMN end_date DATETIME NULL AFTER start_date,
      ADD COLUMN location VARCHAR(255) NULL AFTER end_date,
      ADD COLUMN max_participants INT NULL AFTER location,
      ADD COLUMN category VARCHAR(100) NULL AFTER max_participants;`);
  } catch (err) {
    console.log("Training courses alter error (maybe already altered):", err.message);
  }

  console.log("Migration script finished.");
  process.exit(0);
}

migrate();
