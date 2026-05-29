/**
 * Diagnostic: Check vendor data in DB
 * Run: node src/scripts/check-vendor-data.js
 */
const db = require('../config/mysql');

async function checkVendorData() {
  try {
    console.log('\n--- VENDOR USERS ---');
    const [vendorUsers] = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.status
      FROM users u
      WHERE u.role = 'vendor'
    `);
    console.table(vendorUsers);

    console.log('\n--- VENDOR RECORDS ---');
    const [vendors] = await db.query(`
      SELECT v.*, u.email, u.name as u_name
      FROM vendors v
      JOIN users u ON v.user_id = u.id
    `);
    console.table(vendors.map(v => ({
      id: v.id, user_id: v.user_id, email: v.email, u_name: v.u_name,
      company_name: v.company_name, service_type: v.service_type,
      payment_status: v.payment_status, address: v.address,
      phone: v.phone, contact_person: v.contact_person,
      description: v.description, tax_id: v.tax_id
    })));

    if (vendors.length > 0) {
      const vendor = vendors[0];
      console.log(`\n--- TRANSACTIONS for vendor user_id=${vendor.user_id}, vendor.id=${vendor.id} ---`);
      const [txns] = await db.query(`
        SELECT id, user_id, vendor_id, employer_id, type, amount, status, description, created_at
        FROM transactions
        WHERE user_id = ? OR vendor_id = ?
        ORDER BY created_at DESC
      `, [vendor.user_id, vendor.id]);
      console.table(txns);

      console.log('\n--- ALL vendor_payment type transactions ---');
      const [allVendorTxns] = await db.query(`
        SELECT id, user_id, vendor_id, employer_id, type, amount, status, description, created_at
        FROM transactions
        WHERE type = 'vendor_payment'
        LIMIT 20
      `);
      console.table(allVendorTxns);
    }

    console.log('\n--- TRANSACTIONS TABLE COLUMNS ---');
    const [cols] = await db.query(`DESCRIBE transactions`);
    console.table(cols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Default: c.Default })));

    console.log('\n--- VENDORS TABLE COLUMNS ---');
    const [vcols] = await db.query(`DESCRIBE vendors`);
    console.table(vcols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null })));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

checkVendorData();
