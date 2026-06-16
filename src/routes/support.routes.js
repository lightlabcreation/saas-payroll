const express = require('express');
const router = express.Router();
const supportController = require('../controllers/support.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All endpoints require authentication
router.use(authenticate);

// General ticket operations
router.post('/create-ticket', supportController.createTicket);
router.get('/my-tickets', supportController.getMyTickets);
router.get('/ticket/:id', supportController.getTicketDetails);
router.post('/reply/:id', supportController.replyToTicket);
router.put('/ticket/:id/status', supportController.updateTicketStatus);

// Employer-only endpoint to fetch tickets raised by their Employees/Vendors
router.get('/company-tickets', authorize('admin', 'employer'), supportController.getCompanyTickets);

module.exports = router;
