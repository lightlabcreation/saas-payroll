const db = require('../config/mysql');
async function run() {
  const [txns] = await db.query(
    "SELECT id, user_id, employer_id, type, amount, status, beneficiary, created_at FROM transactions WHERE type = 'vendor_payment' LIMIT 10"
  );
  console.table(txns);
  
  // Also check all txns for vendor user_id = 55
  const [userTxns] = await db.query(
    "SELECT id, user_id, employer_id, type, amount, status, description, created_at FROM transactions WHERE user_id = 55 LIMIT 10"
  );
  console.log('\n--- All txns for vendor user 55 ---');
  console.table(userTxns);
  
  // Also check vendors table columns
  const [vcols] = await db.query("DESCRIBE vendors");
  console.log('\n--- Vendors table columns ---');
  console.table(vcols.map(c => ({ Field: c.Field, Type: c.Type })));
  
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
