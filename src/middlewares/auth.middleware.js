const { verifyToken } = require('../utils/jwt');
const db = require('../config/mysql');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please login again.',
      });
    }

    // Fetch user from database
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE id = ?',
      [decoded.id]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Please contact administrator.',
      });
    }

    // Remove password from user object
    delete user.password;

    // Attach user to request
    req.user = user;

    let targetEmployerId = null;
    let targetCreatedAt = null;

    if (user.role === 'employer') {
      const [empRows] = await db.execute('SELECT * FROM employers WHERE user_id = ? LIMIT 1', [user.id]);
      if (empRows[0]) {
        req.employer = empRows[0];
        targetEmployerId = empRows[0].id;
        targetCreatedAt = empRows[0].created_at;
      }
    } else if (user.role === 'employee') {
      const [empRows] = await db.execute('SELECT * FROM employees WHERE user_id = ? LIMIT 1', [user.id]);
      if (empRows[0] && empRows[0].employer_id) {
        req.employee = empRows[0];
        const [parentRows] = await db.execute('SELECT id, created_at FROM employers WHERE id = ? LIMIT 1', [empRows[0].employer_id]);
        if (parentRows[0]) {
          targetEmployerId = parentRows[0].id;
          targetCreatedAt = parentRows[0].created_at;
        }
      }
    } else if (user.role === 'admin') {
      const [adminRows] = await db.execute('SELECT * FROM admins WHERE user_id = ? LIMIT 1', [user.id]);
      if (adminRows[0]) {
        const [compRows] = await db.execute('SELECT id, created_at FROM companies WHERE admin_id = ? LIMIT 1', [adminRows[0].id]);
        if (compRows[0]) {
          targetEmployerId = compRows[0].id;
          targetCreatedAt = compRows[0].created_at;
        }
      }
    }

    // 7-DAY TRIAL CHECK
    if (targetEmployerId && targetCreatedAt) {
      const createdDate = new Date(targetCreatedAt);
      const now = new Date();
      const diffTime = Math.abs(now - createdDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 7) {
        // Trial is over. Check for active subscription
        const [subRows] = await db.execute(
          'SELECT * FROM subscriptions WHERE employer_id = ? AND status = "active" AND end_date >= NOW() LIMIT 1', 
          [targetEmployerId]
        );
        
        const hasActiveSub = subRows.length > 0;

        if (!hasActiveSub) {
          // Allow access to billing, subscription, and auth routes to purchase a plan
          const path = req.originalUrl || req.path || '';
          const isBillingRoute = path.includes('/subscription') || 
                                 path.includes('/plans') || 
                                 path.includes('/payments') || 
                                 path.includes('/payment-status') ||
                                 path.includes('/auth');
          
          if (!isBillingRoute) {
            return res.status(403).json({
              success: false,
              code: 'TRIAL_EXPIRED',
              message: 'Your 7-Day Free Trial has expired. Please purchase a plan to continue.',
            });
          }
        }
      }
    }


    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed. Please try again.',
    });
  }
};

/**
 * Authorization Middleware
 * Checks if user has required role(s)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const userRole = req.user.role.toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase());

    if (!normalizedAllowedRoles.includes(userRole)) {
      console.warn(`[AUTH] Access denied for user ${req.user.id}. Role: ${req.user.role}. Required: ${allowedRoles.join(', ')}`);
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };

