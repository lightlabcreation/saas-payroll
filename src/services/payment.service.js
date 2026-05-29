/**
 * Mock Payment Gateway Service
 * Abstracts Stripe/Razorpay logic
 */
const db = require('../config/mysql');

class PaymentService {
    /**
     * Create a mock payment intent
     * In a real system, this would call Stripe/Razorpay API
     */
    async createPaymentIntent(amount, currency = 'USD') {
        // Simulate real gateway API call
        return {
            transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            amount,
            currency,
            status: 'pending',
            gateway: 'MockGateway',
            clientSecret: `secret_${Date.now()}` // for frontend if needed
        };
    }

    /**
     * Verify Payment
     * In a real system, verify signature/webhook
     */
    async verifyPayment(transactionId) {
        // Determine success/failure deterministically or randomly for testing
        const isSuccess = true;

        return {
            success: isSuccess,
            status: isSuccess ? 'success' : 'failed',
            transactionId,
            timestamp: new Date()
        };
    }

    /**
     * Refund Payment (Optional)
     */
    async refundPayment(transactionId) {
        return {
            success: true,
            status: 'refunded',
            transactionId
        };
    }
}

module.exports = new PaymentService();
