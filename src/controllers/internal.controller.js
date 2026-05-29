/**
 * Internal Controller — Payroll Backend
 *
 * These endpoints are ONLY called by the Super Admin backend.
 * They are NOT exposed to end-users or the Payroll frontend.
 *
 * Protected by x-internal-api-key header (see internal.middleware.js)
 *
 * Endpoints:
 *   POST /api/internal/provision-company  → create company + admin in Payroll DB
 *   PUT  /api/internal/companies/:id/status → sync company status (active/suspended)
 */

const db = require('../config/mysql');
const superAdminService = require('../services/superadmin.service');
const authService = require('../services/auth.service');

/**
 * Provision a new company in the Payroll system.
 *
 * Called from Super Admin's registerUser when softwareName === 'Payroll Software'.
 *
 * Body:
 *   {
 *     company_name    : string  (required)
 *     admin_email     : string  (required)
 *     admin_name      : string  (required)
 *     admin_password  : string  (required)
 *     admin_phone     : string  (optional)
 *     company_address : string  (optional)
 *     gst_number      : string  (optional)
 *     pan_number      : string  (optional)
 *   }
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       payrollCompanyId : number,
 *       payrollAdminId   : number,
 *       company_name     : string,
 *       admin_email      : string
 *     }
 *   }
 */
const provisionCompany = async (req, res, next) => {
  try {
    const {
      company_name,
      admin_email,
      admin_name,
      admin_password,
      admin_phone,
      company_address,
      gst_number,
      pan_number,
    } = req.body;

    // Validation
    if (!company_name || !admin_email || !admin_name || !admin_password) {
      return res.status(400).json({
        success: false,
        message: 'company_name, admin_email, admin_name, and admin_password are required.',
      });
    }

    console.log(`[INTERNAL] Provisioning Payroll company: "${company_name}" for admin: ${admin_email}`);

    // Use the existing superAdminService — no duplication
    // We pass a dummy superAdminId (0) since this is a system-level call
    const result = await superAdminService.createCompanyWithAdmin(
      {
        company_name,
        company_address: company_address || null,
        gst_number: gst_number || null,
        pan_number: pan_number || null,
        subscription_plan: 'basic',
      },
      {
        name: admin_name,
        email: admin_email,
        password: admin_password,
        phone: admin_phone || null,
      },
      0 // system-level call, no Super Admin user in Payroll system
    );

    console.log(`[INTERNAL] Payroll company provisioned successfully. ID: ${result.company.id}`);

    return res.status(201).json({
      success: true,
      message: 'Payroll company provisioned successfully.',
      data: {
        payrollCompanyId: result.company.id,
        payrollAdminId: result.admin.id,
        company_name: result.company.company_name,
        admin_email: result.admin.email,
      },
    });
  } catch (error) {
    // Email already registered in Payroll DB — still return success with a flag
    // so Super Admin can store company info, just without a new Payroll admin
    if (error.message && error.message.includes('already registered')) {
      console.warn(`[INTERNAL] Payroll: Email already exists — ${req.body.admin_email}. Attempting company lookup.`);

      try {
        // Try to find the existing company by admin email
        const [rows] = await db.query(
          `SELECT c.id as company_id, u.id as admin_id, u.email, c.company_name
           FROM users u
           INNER JOIN admins a ON a.user_id = u.id
           INNER JOIN companies c ON c.admin_id = a.id
           WHERE u.email = ? LIMIT 1`,
          [req.body.admin_email.trim().toLowerCase()]
        );

        if (rows.length > 0) {
          return res.status(200).json({
            success: true,
            message: 'Company already exists in Payroll DB — returning existing record.',
            data: {
              payrollCompanyId: rows[0].company_id,
              payrollAdminId: rows[0].admin_id,
              company_name: rows[0].company_name,
              admin_email: rows[0].email,
              alreadyExisted: true,
            },
          });
        }
      } catch (lookupErr) {
        console.error('[INTERNAL] Lookup error after duplicate email:', lookupErr.message);
      }
    }

    console.error('[INTERNAL] provisionCompany error:', error.message);
    next(error);
  }
};

/**
 * Sync company status from Super Admin → Payroll.
 *
 * Called when Super Admin activates, deactivates, or blocks a company.
 *
 * Params: id (Payroll company ID — stored as payrollCompanyId in Super Admin DB)
 * Body:   { status: 'active' | 'suspended' | 'inactive' }
 */
const syncCompanyStatus = async (req, res, next) => {
  const connection = await db.getConnection();
  await connection.beginTransaction();
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'suspended', 'inactive'];
    if (!validStatuses.includes(status)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}.`,
      });
    }

    // Verify company exists
    const [rows] = await connection.query('SELECT id, company_name, status FROM companies WHERE id = ?', [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: `Payroll company with ID ${id} not found.`,
      });
    }

    const company = rows[0];

    // Update company status
    await connection.query('UPDATE companies SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);

    // Sync user status: active → active, suspended/inactive → blocked
    const userStatus = status === 'active' ? 'active' : 'blocked';
    await connection.query(
      'UPDATE users SET status = ?, updated_at = NOW() WHERE id IN (SELECT user_id FROM admins WHERE id = (SELECT admin_id FROM companies WHERE id = ?))',
      [userStatus, id]
    );

    await connection.commit();

    console.log(`[INTERNAL] Company "${company.company_name}" (ID: ${id}) status synced to: ${status}`);

    return res.json({
      success: true,
      message: `Payroll company status updated to "${status}".`,
      data: {
        payrollCompanyId: parseInt(id),
        company_name: company.company_name,
        previousStatus: company.status,
        newStatus: status,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[INTERNAL] syncCompanyStatus error:', error.message);
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  provisionCompany,
  syncCompanyStatus,
};
