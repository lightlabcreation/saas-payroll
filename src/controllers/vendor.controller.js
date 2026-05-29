const db = require('../config/mysql');

/**
 * Get Vendor Dashboard Data
 */
const getDashboard = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
        SELECT v.*, u.name as u_name, u.email as u_email
        FROM vendors v
        JOIN users u ON v.user_id = u.id
        WHERE v.user_id = ?
    `, [req.user.id]);
    const vendor = rows[0];

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found.',
      });
    }

    res.json({
      success: true,
      data: {
        vendor: {
          id: vendor.id,
          company_name: vendor.company_name,
          service_type: vendor.service_type,
          payment_status: vendor.payment_status,
          status: vendor.status,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Payment Status
 */
const getPaymentStatus = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT v.*, u.name as u_name, u.email as u_email
      FROM vendors v
      JOIN users u ON v.user_id = u.id
      WHERE v.user_id = ?
    `, [req.user.id]);
    const vendor = rows[0];

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found.',
      });
    }

    res.json({
      success: true,
      data: {
        payment_status: vendor.payment_status,
        service_type: vendor.service_type,
        address: vendor.address,
        phone: vendor.phone,
        contact_person: vendor.contact_person,
        company_name: vendor.company_name || vendor.u_name || '',
        email: vendor.u_email || '',
        tax_id: vendor.tax_id || vendor.gst_number || '',
        description: vendor.description || vendor.service_type || '',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Contract Details
 */
const updateContractDetails = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM vendors WHERE user_id = ?', [req.user.id]);
    const vendor = rows[0];

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found.',
      });
    }

    const { service_type, address, phone, contact_person } = req.body;

    const updates = [];
    const params = [];
    if (service_type !== undefined) { updates.push('service_type = ?'); params.push(service_type); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (contact_person !== undefined) { updates.push('contact_person = ?'); params.push(contact_person); }

    if (updates.length > 0) {
      params.push(vendor.id);
      await db.query(`UPDATE vendors SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    }

    const [updated] = await db.query('SELECT * FROM vendors WHERE id = ?', [vendor.id]);

    res.json({
      success: true,
      message: 'Contract details updated successfully.',
      data: updated[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get My Payments
 */
const getMyPayments = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM vendors WHERE user_id = ?', [req.user.id]);
    const vendor = rows[0];

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found.',
      });
    }

    // Get transactions where vendor is the beneficiary - show all statuses
    const [transactions] = await db.query(`
        SELECT t.*, emp.company_name as emp_company_name
        FROM transactions t
        LEFT JOIN employers emp ON t.employer_id = emp.id
        WHERE t.user_id = ? AND t.type = 'vendor_payment'
        ORDER BY t.created_at DESC
    `, [req.user.id]);

    // Also fetch by vendor_id if stored differently
    const [vendorTxns] = await db.query(`
        SELECT t.*, emp.company_name as emp_company_name
        FROM transactions t
        LEFT JOIN employers emp ON t.employer_id = emp.id
        WHERE t.vendor_id = ?
        ORDER BY t.created_at DESC
    `, [vendor.id]).catch(() => [[]]);

    // Merge and deduplicate
    const allTxnIds = new Set(transactions.map(t => t.id));
    const merged = [...transactions, ...vendorTxns.filter(t => !allTxnIds.has(t.id))];
    merged.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
    const finalTransactions = merged;

    // Calculate totals
    const totalPaid = finalTransactions
      .filter(t => (t.status || '').toLowerCase() === 'success' || (t.status || '').toLowerCase() === 'completed')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const pendingAmount = finalTransactions
      .filter(t => (t.status || '').toLowerCase() === 'pending')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    res.json({
      success: true,
      data: {
        summary: {
          totalPaid: parseFloat(totalPaid.toFixed(2)),
          totalRevenue: parseFloat(totalPaid.toFixed(2)),
          totalContracts: 1,
          completedContracts: vendor.payment_status === 'paid' ? 1 : 0,
          pendingAmount: parseFloat(pendingAmount.toFixed(2)),
          pendingPayments: parseFloat(pendingAmount.toFixed(2)),
          paymentStatus: vendor.payment_status,
        },
        transactions: finalTransactions.map(t => ({
          id: t.id,
          amount: parseFloat(t.amount || 0),
          description: t.description,
          employer: t.emp_company_name || 'N/A',
          date: t.date || t.created_at,
          reference: t.reference || t.transaction_id || `TXN-${t.id}`,
          status: (t.status === 'success' || t.status === 'completed') ? 'Completed' : (t.status === 'pending' ? 'Pending' : 'Failed'),
          paymentStatus: t.status === 'success' ? 'completed' : t.status
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Vendor Bank Accounts
 */
const getBankAccounts = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM vendor_bank_accounts WHERE user_id = ?', [req.user.id]);
    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add Vendor Bank Account
 */
const addBankAccount = async (req, res, next) => {
  try {
    const { bankName, accountNumber, accountType, ifscCode, branch, isPrimary } = req.body;
    
    // If setting as primary, remove primary from others
    if (isPrimary) {
      await db.query('UPDATE vendor_bank_accounts SET is_primary = FALSE WHERE user_id = ?', [req.user.id]);
    }

    const [result] = await db.query(
      'INSERT INTO vendor_bank_accounts (user_id, bank_name, account_number, account_type, ifsc_code, branch, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, bankName, accountNumber, accountType || 'Savings', ifscCode, branch, isPrimary ? 1 : 0]
    );

    const [newAccount] = await db.query('SELECT * FROM vendor_bank_accounts WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Bank account added successfully.',
      data: newAccount[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Vendor Bank Account
 */
const deleteBankAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM vendor_bank_accounts WHERE id = ? AND user_id = ?', [id, req.user.id]);

    res.json({
      success: true,
      message: 'Bank account deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set Primary Bank Account
 */
const setPrimaryBankAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Unset all primary accounts first
    await db.query('UPDATE vendor_bank_accounts SET is_primary = FALSE WHERE user_id = ?', [req.user.id]);
    
    // Set the selected one as primary
    await db.query('UPDATE vendor_bank_accounts SET is_primary = TRUE WHERE id = ? AND user_id = ?', [id, req.user.id]);

    res.json({
      success: true,
      message: 'Primary bank account updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  getPaymentStatus,
  updateContractDetails,
  getMyPayments,
  getBankAccounts,
  addBankAccount,
  deleteBankAccount,
  setPrimaryBankAccount,
};

