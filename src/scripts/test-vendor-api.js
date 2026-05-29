/**
 * Test vendor API endpoints directly
 * Run: node src/scripts/test-vendor-api.js
 */
const db = require('../config/mysql');

async function testVendorPayments() {
  try {
    // Simulate what getMyPayments does for vendor user_id = 55
    const userId = 55;
    
    console.log('\n--- Step 1: Find vendor ---');
    const [rows] = await db.query('SELECT * FROM vendors WHERE user_id = ?', [userId]);
    const vendor = rows[0];
    console.log('Vendor:', vendor ? { id: vendor.id, company_name: vendor.company_name, payment_status: vendor.payment_status } : 'NOT FOUND');
    
    if (!vendor) { process.exit(0); }
    
    console.log('\n--- Step 2: Get transactions (user_id based) ---');
    const [transactions] = await db.query(`
      SELECT t.*, emp.company_name as emp_company_name
      FROM transactions t
      LEFT JOIN employers emp ON t.employer_id = emp.id
      WHERE t.user_id = ? AND t.type = 'vendor_payment'
      ORDER BY t.created_at DESC
    `, [userId]);
    console.log(`Found ${transactions.length} transactions`);
    console.table(transactions.map(t => ({
      id: t.id, amount: t.amount, status: t.status, 
      type: t.type, employer: t.emp_company_name, date: t.created_at
    })));
    
    console.log('\n--- Step 3: Calculate totals ---');
    const totalPaid = transactions
      .filter(t => ['success', 'completed'].includes((t.status||'').toLowerCase()))
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    console.log('totalPaid:', totalPaid);
    
    console.log('\n--- Step 4: Final API response ---');
    const response = {
      success: true,
      data: {
        summary: {
          totalPaid,
          pendingAmount: 0,
          paymentStatus: vendor.payment_status,
        },
        transactions: transactions.map(t => ({
          id: t.id,
          amount: parseFloat(t.amount || 0),
          description: t.description,
          employer: t.emp_company_name || 'N/A',
          date: t.date || t.created_at,
          reference: t.reference || t.transaction_id || `TXN-${t.id}`,
          status: (t.status === 'success' || t.status === 'completed') ? 'Completed' : (t.status === 'pending' ? 'Pending' : 'Failed'),
        })),
      }
    };
    console.log('Response:', JSON.stringify(response, null, 2));
    
    console.log('\n--- Step 5: Test getPaymentStatus ---');
    const [statusRows] = await db.query(`
      SELECT v.*, u.name as u_name, u.email as u_email
      FROM vendors v
      JOIN users u ON v.user_id = u.id
      WHERE v.user_id = ?
    `, [userId]);
    const v = statusRows[0];
    if (v) {
      console.log('Profile data:', {
        company_name: v.company_name || v.u_name,
        email: v.email || v.u_email,
        phone: v.phone,
        contact_person: v.contact_person,
        address: v.address,
        payment_status: v.payment_status,
      });
    }
    
  } catch (err) {
    console.error('Error:', err.message, err.stack);
  } finally {
    process.exit(0);
  }
}

testVendorPayments();
