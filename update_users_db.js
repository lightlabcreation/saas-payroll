const mysql = require('./src/config/mysql');

async function run() {
  try {
    // Add pan_number to users if it doesn't exist
    try {
      await mysql.query('ALTER TABLE users ADD COLUMN pan_number VARCHAR(50) NULL');
      console.log('Added pan_number to users table.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('pan_number already exists in users table.');
      } else {
        throw e;
      }
    }
    
    // Add gst_number to users if it doesn't exist (optional, but good for parity)
    try {
      await mysql.query('ALTER TABLE users ADD COLUMN gst_number VARCHAR(50) NULL');
      console.log('Added gst_number to users table.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('gst_number already exists in users table.');
      } else {
        throw e;
      }
    }

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
