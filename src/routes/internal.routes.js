/**
 * Internal Routes — Payroll Backend
 *
 * These routes are for SERVICE-TO-SERVICE communication only.
 * They MUST NOT be accessible from the public internet or Payroll frontend.
 *
 * Authentication: x-internal-api-key header (not JWT)
 *
 * Routes:
 *   POST /api/internal/provision-company     → create company tenant in Payroll DB
 *   PUT  /api/internal/companies/:id/status  → sync company status
 */

const express = require('express');
const router = express.Router();
const { internalAuth } = require('../middlewares/internal.middleware');
const internalController = require('../controllers/internal.controller');
const supportController = require('../controllers/support.controller');

// Apply internal API key auth to ALL routes in this file
router.use(internalAuth);

/**
 * POST /api/internal/provision-company
 * Create a new company + admin in the Payroll DB
 * Called by Super Admin backend when a company registers with Payroll selected
 */
router.post('/provision-company', internalController.provisionCompany);

/**
 * PUT /api/internal/companies/:id/status
 * Sync company status from Super Admin (active / suspended / inactive)
 * Called by Super Admin backend on toggleStatus or blockUser
 */
router.put('/companies/:id/status', internalController.syncCompanyStatus);

/**
 * POST /api/internal/support/sync
 * Sync support ticket replies and status changes from Super Admin
 */
router.post('/support/sync', supportController.syncTicketFromSuperadmin);

module.exports = router;
