/**
 * Internal API Middleware
 * Protects internal endpoints from outside access.
 * Uses a pre-shared API key instead of JWT — the Super Admin backend
 * never needs to log in to the Payroll system.
 *
 * Header required: x-internal-api-key: <INTERNAL_API_KEY>
 */
const internalAuth = (req, res, next) => {
  const providedKey = req.headers['x-internal-api-key'];
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    console.error('[INTERNAL_AUTH] INTERNAL_API_KEY not set in environment!');
    return res.status(500).json({
      success: false,
      message: 'Internal server configuration error.',
    });
  }

  if (!providedKey || providedKey !== expectedKey) {
    console.warn(`[INTERNAL_AUTH] Unauthorized internal API access attempt from ${req.ip}`);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or missing internal API key.',
    });
  }

  next();
};

module.exports = { internalAuth };
