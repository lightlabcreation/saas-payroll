const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public.controller');

// TRULY Public routes (no authentication required)

// Job routes
router.get('/jobs', publicController.getAllJobs);
router.get('/jobs/:id', publicController.getJobById);

// Plans route
router.get('/plans', publicController.getActivePlans);

// Company signup request
router.post('/company-request', publicController.createCompanyRequest);
router.put('/company-request/:id/payment-status', publicController.updateCompanyRequestPaymentStatus);

// User registration request
router.post('/user-request', publicController.createRequest);

module.exports = router;
