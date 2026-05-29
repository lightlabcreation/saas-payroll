const { generateTokens, verifyToken } = require('../utils/jwt');
const db = require('../config/mysql');
const bcrypt = require('bcrypt');
const axios = require('axios');
const crypto = require('crypto');
const { getLoginRedirect, getDashboardRoute } = require('../middlewares/role.middleware');

/**
 * Register a new user
 */
const register = async (req, res, next) => {
  const connection = await db.getConnection();
  await connection.beginTransaction();
  try {
    const { name, email, password, role, phone } = req.body;

    // Validate input
    if (!name || !email || !password) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const [existingUser] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists.',
      });
    }

    // Check if phone already exists (if provided)
    if (phone) {
      const [existingPhone] = await connection.query(
        'SELECT id FROM users WHERE phone = ?',
        [phone]
      );
      if (existingPhone.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: 'User with this phone number already exists.',
        });
      }
    }

    // Validate role
    const allowedRoles = ['employer', 'employee', 'vendor', 'jobseeker'];
    const userRole = role && allowedRoles.includes(role.toLowerCase())
      ? role.toLowerCase()
      : 'jobseeker';

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [userResult] = await connection.query(
      `INSERT INTO users (name, email, password, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', NOW(), NOW())`,
      [name.trim(), normalizedEmail, hashedPassword, userRole]
    );
    const userId = userResult.insertId;

    // Create role-specific records
    if (userRole === 'employer') {
      await connection.query(
        `INSERT INTO employers (user_id, company_name, status, created_at, updated_at)
         VALUES (?, ?, 'active', NOW(), NOW())`,
        [userId, `${name}'s Company`]
      );
    } else if (userRole === 'employee') {
      await connection.query(
        `INSERT INTO employees (user_id, status, created_at, updated_at)
         VALUES (?, 'active', NOW(), NOW())`,
        [userId]
      );
    } else if (userRole === 'vendor') {
      await connection.query(
        `INSERT INTO vendors (user_id, company_name, payment_status, status, created_at, updated_at)
         VALUES (?, ?, 'pending', 'active', NOW(), NOW())`,
        [userId, `${name}'s Vendor Company`]
      );
    } else if (userRole === 'jobseeker') {
      await connection.query(
        `INSERT INTO job_seekers (user_id, name, email, phone, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', NOW(), NOW())`,
        [userId, name, email, phone || null]
      );
    }

    await connection.commit();

    const user = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      role: userRole,
      status: 'active'
    };

    // Generate tokens
    const tokens = generateTokens(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[REGISTER] Error:', error.message);
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Standard User Login (For Employers/Employees/Managers)
 */
const login = async (req, res, next) => {
  try {
    const { email, password, recaptchaToken } = req.body;

    // Validate reCAPTCHA
    if (!recaptchaToken) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA token is required.',
      });
    }

    try {
      const secretKey = process.env.RECAPTCHA_SECRET_KEY || '6LdsnwItAAAAAAY8cvmiwCrhwm-OQLAmDNdE51Db';
      const recaptchaResponse = await axios.post(`https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`);
      
      if (!recaptchaResponse.data.success) {
        return res.status(400).json({
          success: false,
          message: 'reCAPTCHA verification failed. Please try again.',
        });
      }
    } catch (captchaError) {
      console.error('[CAPTCHA VERIFY ERROR]', captchaError);
      return res.status(500).json({
        success: false,
        message: 'Error verifying reCAPTCHA.',
      });
    }

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // Normalize email (trim whitespace)
    const normalizedEmail = email.trim();

    // 1. Fetch User (SQL)
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    let user = rows[0];

    // Fallback: case-insensitive lookup
    if (!user) {
      const [rows2] = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [normalizedEmail]);
      user = rows2[0];
    }

    // Safe debug log
    if (!user) {
      console.log(`[LOGIN] User not found for email: ${normalizedEmail}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // CRITICAL: Prevent Admins from logging in via standard login route
    // They MUST use the specialized admin/hidden login
    if (user.role === 'admin' || user.role === 'superadmin') {
      console.log(`[LOGIN] Blocked Admin login attempt via standard route: ${user.email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.', // Keep message generic for security
      });
    }

    console.log(`[LOGIN] User found: ${user.email} (ID: ${user.id}, Role: ${user.role})`);

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log(`[LOGIN] Password mismatch for user: ${user.email} (ID: ${user.id})`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Please contact administrator.',
      });
    }

    // --- Verify Master Subscription ---
    try {
      let employerEmail = user.email;
      if (user.role !== 'employer' && user.company_id) {
        const [empRows] = await db.query('SELECT user_id FROM employers WHERE id = ?', [user.company_id]);
        if (empRows.length > 0) {
          const [uRows] = await db.query('SELECT email FROM users WHERE id = ?', [empRows[0].user_id]);
          if (uRows.length > 0) {
            employerEmail = uRows[0].email;
          }
        }
      }
      
      const masterApiUrl = process.env.SUPERADMIN_API_URL || 'http://localhost:5000/api';
      const verifyRes = await fetch(`${masterApiUrl}/master/verify-subscription?email=${encodeURIComponent(employerEmail)}`);
      
      if (!verifyRes.ok) {
        const verifyData = await verifyRes.json();
        return res.status(403).json({
          success: false,
          message: verifyData.message || 'Company subscription has expired or is invalid.',
        });
      }
    } catch (err) {
      console.error('[LOGIN] Error verifying subscription:', err.message);
      // Depending on strictness, we might want to block or allow if Master backend is down.
      // We will block to be safe.
      return res.status(500).json({
        success: false,
        message: 'Unable to verify subscription status.',
      });
    }
    // ----------------------------------

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Generate tokens
    const tokens = generateTokens(user);

    console.log(`[LOGIN] Successful login for: ${user.email} (Role: ${user.role})`);

    // Get role-based dashboard redirect
    const redirectInfo = getLoginRedirect(user.role);

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        // CRITICAL: Dashboard route based on role
        dashboardRoute: redirectInfo.dashboard,
        redirectMessage: redirectInfo.message
      },
    });
  } catch (error) {
    console.error('[LOGIN] Error:', error.message);
    next(error);
  }
};

/**
 * Admin Specialized Login
 */
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND role IN ("admin", "superadmin")', [email.trim()]);
    let user = rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Admin account is inactive.' });
    }

    const tokens = generateTokens(user);
    const redirectInfo = getLoginRedirect(user.role);

    res.json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        dashboardRoute: redirectInfo.dashboard
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required.',
      });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token.',
      });
    }

    // Find user using Pure SQL
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [decoded.id]);
    const user = rows[0];

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive.',
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    res.json({
      success: true,
      message: 'Token refreshed successfully.',
      data: tokens,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  // Since we're using stateless JWT, logout is handled client-side
  // In a production app, you might want to maintain a blacklist of tokens
  res.json({
    success: true,
    message: 'Logged out successfully.',
  });
};


/**
 * Change Password (Authenticated User)
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new passwords are required.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect current password.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, userId]);

    res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    // For now, since backend email is not fully set up, we just return success
    // This allows the frontend to show the "Reset link sent" message
    res.json({
      success: true,
      message: 'If an account exists with this email, a reset link will be sent.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  adminLogin,
  refreshToken,
  logout,
  changePassword,
  forgotPassword,
};
