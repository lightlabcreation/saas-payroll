const db = require('../config/mysql');
const axios = require('axios');

/**
 * Helper to dynamically get the company ID and name for a user based on their role
 */
const getUserCompanyDetails = async (userId, role) => {
  try {
    if (role === 'admin') {
      const [rows] = await db.query('SELECT id as company_id, company_name FROM companies WHERE user_id = ? LIMIT 1', [userId]);
      if (rows.length > 0) return rows[0];
    }
    if (role === 'employer') {
      const [rows] = await db.query('SELECT company_id, company_name FROM employers WHERE user_id = ? LIMIT 1', [userId]);
      if (rows.length > 0) return rows[0];
    }
    if (role === 'employee') {
      const [rows] = await db.query(`
        SELECT emp.company_id, emp.company_name 
        FROM employees e 
        JOIN employers emp ON e.employer_id = emp.id 
        WHERE e.user_id = ? LIMIT 1
      `, [userId]);
      if (rows.length > 0) return rows[0];
    }
    if (role === 'vendor') {
      const [rows] = await db.query('SELECT company_id, company_name FROM vendors WHERE user_id = ? LIMIT 1', [userId]);
      if (rows.length > 0) return rows[0];
    }
  } catch (err) {
    console.error('[SUPPORT_CONTROLLER] Error fetching company details:', err);
  }
  return { company_id: 0, company_name: 'Unknown Company' };
};

/**
 * Raise a Support Ticket
 */
const createTicket = async (req, res, next) => {
  const connection = await db.getConnection();
  await connection.beginTransaction();
  try {
    const { subject, category, priority, description } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const userDetails = await getUserCompanyDetails(userId, userRole);
    const companyId = userDetails.company_id;
    const companyName = userDetails.company_name;

    if (!subject || !description) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Subject and Description are required.' });
    }

    const ticketNumber = 'TKT-' + Date.now().toString().slice(-8) + '-' + Math.floor(100 + Math.random() * 900);

    // 1. Save ticket in Payroll DB
    const [ticketResult] = await connection.query(
      `INSERT INTO support_tickets (ticket_number, company_id, company_name, project_name, user_id, subject, category, priority, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', NOW(), NOW())`,
      [ticketNumber, companyId, companyName, 'Payroll SaaS', userId, subject, category, priority || 'Low', description]
    );
    const ticketId = ticketResult.insertId;

    // 2. Save first message in ticket_messages
    await connection.query(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message, created_at)
       VALUES (?, 'client', ?, ?, NOW())`,
      [ticketId, userId, description]
    );

    await connection.commit();

    // 3. If raised by Employer / Admin and it is a Platform issue, sync to Super Admin Backend
    let superadminSynced = false;
    const isPlatformTicket = userRole === 'admin' || userRole === 'employer';
    if (isPlatformTicket) {
      try {
        const saUrl = `${process.env.SUPERADMIN_API_URL || 'http://localhost:5000/api'}/support/create-ticket`;
        const saBody = {
          ticketNumber,
          companyId,
          companyName,
          userId,
          subject,
          category,
          priority,
          description,
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
        console.error('[SUPPORT] Failed to sync ticket to Super Admin (non-fatal):', err.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully.',
      ticket: {
        id: ticketId,
        ticketNumber,
        subject,
        status: 'Open',
        superadminSynced
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Get tickets raised by the current user
 */
const getMyTickets = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [tickets] = await db.query(
      `SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ success: true, tickets });
  } catch (error) {
    next(error);
  }
};

/**
 * Get tickets raised by Employees/Vendors in the Employer's Company
 */
const getCompanyTickets = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const userDetails = await getUserCompanyDetails(userId, userRole);
    
    // Fetch tickets of this company raised by employees/vendors
    const [tickets] = await db.query(
      `SELECT t.*, u.name as sender_name, u.role as sender_role 
       FROM support_tickets t
       JOIN users u ON t.user_id = u.id
       WHERE t.company_id = ? AND u.role IN ('employee', 'vendor')
       ORDER BY t.created_at DESC`,
      [userDetails.company_id]
    );
    res.json({ success: true, tickets });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Ticket Details and Chat Timeline
 */
const getTicketDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [tickets] = await db.query('SELECT * FROM support_tickets WHERE id = ?', [id]);
    const ticket = tickets[0];

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    // Fetch messages
    const [messages] = await db.query(
      `SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
      [id]
    );

    res.json({ success: true, ticket, messages });
  } catch (error) {
    next(error);
  }
};

/**
 * Send reply message
 */
const replyToTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
    }

    const [tickets] = await db.query('SELECT * FROM support_tickets WHERE id = ?', [id]);
    const ticket = tickets[0];
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    // Determine sender type (Employer is 'admin' only when replying to an employee's ticket)
    let senderType = 'client';
    if (userRole === 'admin' || userRole === 'employer') {
      if (ticket.user_id !== userId) {
        senderType = 'admin';
      }
    }

    // Insert message
    await db.query(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [id, senderType, userId, message]
    );

    // Update status to In Progress if Employer replied to an Employee ticket
    let newStatus = ticket.status;
    if (senderType === 'admin' && ticket.status === 'Open') {
      newStatus = 'In Progress';
    }
    await db.query(
      `UPDATE support_tickets SET status = ?, updated_at = NOW() WHERE id = ?`,
      [newStatus, id]
    );

    // If this is a ticket raised to Super Admin, sync the reply to Super Admin backend
    if (ticket.user_id === userId && (userRole === 'admin' || userRole === 'employer')) {
      try {
        const saUrl = `${process.env.SUPERADMIN_API_URL || 'http://localhost:5000/api'}/support/reply/${ticket.ticket_number}`;
        await axios.post(saUrl, {
          message,
          senderType: 'client',
          senderId: userId
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': process.env.INTERNAL_API_KEY || 'kiaan_internal_secret_2026'
          },
          timeout: 5000
        });
      } catch (err) {
        console.error('[SUPPORT] Failed to sync reply to Super Admin (non-fatal):', err.message);
      }
    }

    res.json({ success: true, message: 'Reply sent successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Ticket Status (Resolve / Close)
 */
const updateTicketStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Resolved', 'Closed', etc.

    if (!['Resolved', 'Closed', 'In Progress', 'Open'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const [result] = await db.query(
      'UPDATE support_tickets SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    // Sync status back to Super Admin if it's a platform ticket
    const [tickets] = await db.query('SELECT * FROM support_tickets WHERE id = ?', [id]);
    const ticket = tickets[0];
    if (ticket && (ticket.category === 'Platform Bug' || ticket.category === 'Billing Issue')) {
      try {
        const saUrl = `${process.env.SUPERADMIN_API_URL || 'http://localhost:5000/api'}/support/${ticket.ticket_number}/status`;
        await axios.put(saUrl, { status }, {
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': process.env.INTERNAL_API_KEY || 'kiaan_internal_secret_2026'
          },
          timeout: 5000
        });
      } catch (err) {
        console.error('[SUPPORT] Failed to sync status to Super Admin (non-fatal):', err.message);
      }
    }

    res.json({ success: true, message: 'Ticket status updated.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Sync status & replies from Super Admin to Payroll DB
 */
const syncTicketFromSuperadmin = async (req, res, next) => {
  try {
    const { action, ticketNumber, reply, status } = req.body;

    const [tickets] = await db.query('SELECT * FROM support_tickets WHERE ticket_number = ?', [ticketNumber]);
    const ticket = tickets[0];

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    if (action === 'reply' && reply) {
      await db.query(
        `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message, created_at)
         VALUES (?, 'admin', ?, ?, NOW())`,
        [ticket.id, 0, reply]
      );
      
      await db.query(
        `UPDATE support_tickets SET status = 'Waiting For Client', updated_at = NOW() WHERE id = ?`,
        [ticket.id]
      );
    } else if (action === 'status' && status) {
      await db.query(
        `UPDATE support_tickets SET status = ?, updated_at = NOW() WHERE id = ?`,
        [status, ticket.id]
      );
    }

    res.json({ success: true, message: 'Sync successful.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTicket,
  getMyTickets,
  getCompanyTickets,
  getTicketDetails,
  replyToTicket,
  updateTicketStatus,
  syncTicketFromSuperadmin
};
