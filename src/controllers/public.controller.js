const db = require('../config/mysql');
const axios = require('axios');

/**
 * Get All Jobs (Public)
 */
const getAllJobs = async (req, res, next) => {
  try {
    const { search, location, job_type, status, page = 1, limit = 10 } = req.query;

    let query = `
            SELECT j.*, 
                   COALESCE(c.company_name, e.company_name) as display_company_name, 
                   COALESCE(c.company_logo, e.company_logo) as display_company_logo
            FROM jobs j 
            LEFT JOIN employers e ON j.employer_id = e.id 
            LEFT JOIN companies c ON e.company_id = c.id
            WHERE 1=1
        `;
    const params = [];

    // Filter by Status (Default Active)
    query += ' AND j.status = ?';
    params.push(status || 'Active');

    if (search) {
      query += ' AND (j.title LIKE ? OR j.description LIKE ? OR j.skills LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (location) {
      query += ' AND j.location LIKE ?';
      params.push(`%${location}%`);
    }

    if (job_type) {
      query += ' AND j.job_type = ?';
      params.push(job_type);
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Clone for count before adding order/limit
    const countSql = `SELECT COUNT(*) as count FROM (${query}) as t`;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].count;

    query += ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [jobs] = await db.query(query, params);

    // Format jobs
    const formattedJobs = jobs.map(job => ({
      ...job,
      employer: {
        id: job.employer_id,
        company_name: job.display_company_name,
        company_logo: job.display_company_logo
      }
    }));

    res.json({
      success: true,
      data: {
        jobs: formattedJobs,
        pagination: {
          total: total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) { next(error); }
};

/**
 * Get Single Job (Public)
 */
const getJobById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = `
            SELECT j.*, e.id as emp_id, 
                   COALESCE(c.company_name, e.company_name) as display_company_name, 
                   COALESCE(c.company_logo, e.company_logo) as display_company_logo, 
                   COALESCE(c.company_address, e.company_address) as display_company_address 
            FROM jobs j 
            LEFT JOIN employers e ON j.employer_id = e.id 
            LEFT JOIN companies c ON e.company_id = c.id
            WHERE j.id = ?
        `;
    const [rows] = await db.query(query, [id]);
    const job = rows[0];

    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });

    // Increment views count
    await db.query('UPDATE jobs SET views_count = views_count + 1 WHERE id = ?', [id]);

    // Format
    const formattedJob = {
      ...job,
      employer: {
        id: job.emp_id,
        company_name: job.display_company_name,
        company_logo: job.display_company_logo,
        company_address: job.display_company_address
      }
    };

    res.json({ success: true, data: formattedJob });
  } catch (error) { next(error); }
};

/**
 * Get Active Plans (Public)
 */
const getActivePlans = async (req, res, next) => {
  try {
    const [plans] = await db.query(`
            SELECT id, name, description, price, duration_months, max_employees, max_jobs, features 
            FROM plans 
            WHERE is_active = 1 
            ORDER BY price ASC
        `);
    const formattedPlans = plans.map(plan => {
      try {
        plan.features = typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || []);
      } catch (e) {
        plan.features = [];
      }
      return plan;
    });
    res.json({ success: true, data: formattedPlans });
  } catch (error) { next(error); }
};

/**
 * Create Company Signup Request (Public)
 */
const createCompanyRequest = async (req, res, next) => {
  try {
    const { company_name, contact_name, email, phone, plan_id, company_address, gst_number, pan_number, notes } = req.body;

    if (!company_name || !contact_name || !email || !plan_id) {
      return res.status(400).json({ success: false, message: 'Required fields missing.' });
    }

    // Check for trial abuse (Strict Uniqueness on Phone, PAN, GST)
    let abuseCheckQuery = 'SELECT id FROM company_requests WHERE email = ?';
    let abuseCheckParams = [email.toLowerCase()];
    
    if (phone) {
        abuseCheckQuery += ' OR phone = ?';
        abuseCheckParams.push(phone);
    }
    if (pan_number) {
        abuseCheckQuery += ' OR pan_number = ?';
        abuseCheckParams.push(pan_number);
    }
    if (gst_number) {
        abuseCheckQuery += ' OR gst_number = ?';
        abuseCheckParams.push(gst_number);
    }

    const [existingReqs] = await db.query(abuseCheckQuery, abuseCheckParams);
    if (existingReqs.length > 0) {
        return res.status(409).json({
            success: false,
            message: 'A company request with this email, phone, or PAN/GST already exists. Please login or contact support.'
        });
    }

    // Also check in users table for phone
    if (phone) {
        const [existingUsers] = await db.query('SELECT id FROM users WHERE phone = ?', [phone]);
        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'This phone number is already registered to an account.'
            });
        }
    }

    const [planRows] = await db.query('SELECT * FROM plans WHERE id = ? AND is_active = 1', [plan_id]);
    if (planRows.length === 0) return res.status(404).json({ success: false, message: 'Plan not found.' });

    const [result] = await db.query(
      `INSERT INTO company_requests (company_name, contact_name, email, phone, plan_id, company_address, gst_number, pan_number, notes, payment_status, request_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', NOW(), NOW())`,
      [company_name, contact_name, email.toLowerCase(), phone || null, plan_id, company_address || null, gst_number || null, pan_number || null, notes || null]
    );

    res.status(201).json({ success: true, message: 'Request submitted successfully.', data: { id: result.insertId } });
  } catch (error) { next(error); }
};

/**
 * Update Company Request Payment Status (Publicly called after payment success)
 */
const updateCompanyRequestPaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { payment_status, paypal_order_id } = req.body;

    if (payment_status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Only paid status can be confirmed.' });
    }

    const [rows] = await db.query('SELECT * FROM company_requests WHERE id = ?', [id]);
    const companyRequest = rows[0];

    if (!companyRequest) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    if (companyRequest.payment_status === 'paid') {
      return res.json({ success: true, message: 'Payment already updated.', data: { id: companyRequest.id, payment_status: 'paid' } });
    }

    await db.query('UPDATE company_requests SET payment_status = ?, notes = ? WHERE id = ?', [
      'paid',
      paypal_order_id ? `${companyRequest.notes || ''} [PayPal: ${paypal_order_id}]`.trim() : companyRequest.notes,
      id
    ]);

    // If request was already accepted but payment was pending, try to activate subscription if company exists
    if (companyRequest.request_status === 'accepted' && companyRequest.created_company_id) {
      await db.query(
        'UPDATE subscriptions SET status = ? WHERE employer_id = ? AND status = ?',
        ['active', companyRequest.created_company_id, 'pending']
      );
      // Also update invoices if any
      await db.query(
        "UPDATE invoices SET status = 'paid' WHERE employer_id = ? AND status = 'pending' AND (plan_id = ? OR 1=1)",
        [companyRequest.created_company_id, companyRequest.plan_id]
      );
    }

    res.json({
      success: true,
      message: 'Payment status updated successfully.',
      data: {
        id: companyRequest.id,
        payment_status: 'paid',
      },
    });
  } catch (error) { next(error); }
};

/**
 * Create User Request (Public)
 */
const createRequest = async (req, res, next) => {
  try {
    const { name, address, city, state, country, mobile, request_type } = req.body;

    if (!name || !address || !city || !state || !country || !mobile || !request_type) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Security: Block Admin Registration
    if (request_type === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin registration is restricted. Please contact support.'
      });
    }

    const query = `
            INSERT INTO user_requests (name, address, city, state, country, mobile, request_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

    const [result] = await db.query(query, [name, address, city, state, country, mobile, request_type]);

    res.status(201).json({
      success: true,
      message: 'Request submitted successfully',
      data: { id: result.insertId }
    });
  } catch (error) { next(error); }
};

/**
 * Create Support Ticket from Public Login Page
 */
const createPublicSupportTicket = async (req, res, next) => {
  try {
    const { email, subject, description, category = 'General Support' } = req.body;

    if (!email || !subject || !description) {
      return res.status(400).json({ success: false, message: 'Email, Subject, and Description are required.' });
    }

    // 1. Check if user exists to link the ticket
    const [userRows] = await db.query('SELECT id, role FROM users WHERE email = ? LIMIT 1', [email.toLowerCase()]);
    
    let userId = 0;
    let userRole = 'public';
    let companyId = 0;
    let companyName = 'Public Inquiry';

    if (userRows.length > 0) {
      userId = userRows[0].id;
      userRole = userRows[0].role?.toLowerCase() || '';

      // Fetch company details
      try {
        if (userRole === 'admin') {
          const [rows] = await db.query('SELECT id as company_id, company_name FROM companies WHERE user_id = ? LIMIT 1', [userId]);
          if (rows.length > 0) {
            companyId = rows[0].company_id;
            companyName = rows[0].company_name;
          }
        } else if (userRole === 'employer') {
          const [rows] = await db.query('SELECT company_id, company_name FROM employers WHERE user_id = ? LIMIT 1', [userId]);
          if (rows.length > 0) {
            companyId = rows[0].company_id;
            companyName = rows[0].company_name;
          }
        } else if (userRole === 'employee') {
          const [rows] = await db.query(`
            SELECT emp.company_id, emp.company_name 
            FROM employees e 
            JOIN employers emp ON e.employer_id = emp.id 
            WHERE e.user_id = ? LIMIT 1
          `, [userId]);
          if (rows.length > 0) {
            companyId = rows[0].company_id;
            companyName = rows[0].company_name;
          }
        } else if (userRole === 'vendor') {
          const [rows] = await db.query('SELECT company_id, company_name FROM vendors WHERE user_id = ? LIMIT 1', [userId]);
          if (rows.length > 0) {
            companyId = rows[0].company_id;
            companyName = rows[0].company_name;
          }
        }
      } catch (err) {
        console.error('[PUBLIC_SUPPORT] Error fetching company details:', err);
      }
    }

    const ticketNumber = 'TKT-PUB-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);

    // Save ticket in Payroll DB
    const [ticketResult] = await db.query(
      `INSERT INTO support_tickets (ticket_number, company_id, company_name, project_name, user_id, subject, category, priority, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Medium', ?, 'Open', NOW(), NOW())`,
      [ticketNumber, companyId, companyName, 'Payroll SaaS', userId, `[Public Form] ${subject}`, category, `Sender Email: ${email}\n\n${description}`]
    );
    const ticketId = ticketResult.insertId;

    // Save first message in ticket_messages
    await db.query(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message, created_at)
       VALUES (?, 'client', ?, ?, NOW())`,
      [ticketId, userId, `Sender: ${email}\nMessage: ${description}`]
    );

    // Sync to Super Admin Backend
    let superadminSynced = false;
    try {
      const saUrl = `${process.env.SUPERADMIN_API_URL || 'http://localhost:5000/api'}/support/create-ticket`;
      const saBody = {
        ticketNumber,
        companyId,
        companyName,
        userId,
        subject: `[Public Ticket] ${subject}`,
        category,
        priority: 'Medium',
        description: `Submitted by: ${email}\n\n${description}`,
        projectName: 'Payroll SaaS'
      };
      const response = await axios.post(saUrl, saBody, {
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': process.env.INTERNAL_API_KEY || 'kiaan_internal_secret_2026'
        },
        timeout: 5000
      });
      if (response.data.success) {
        superadminSynced = true;
      }
    } catch (err) {
      console.error('[PUBLIC_SUPPORT] Failed to sync ticket to Super Admin (non-fatal):', err.message);
    }

    res.status(201).json({
      success: true,
      message: 'Support request submitted successfully.',
      ticketNumber
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllJobs,
  getJobById,
  getActivePlans,
  createCompanyRequest,
  updateCompanyRequestPaymentStatus,
  createRequest,
  createPublicSupportTicket
};
