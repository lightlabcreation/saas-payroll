const cron = require('node-cron');
const db = require('../config/mysql');

/**
 * Daily Subscription Checker
 * Runs every day at midnight (00:00)
 */
const startSubscriptionScheduler = () => {
    console.log('[CRON] Subscription Scheduler Initialized');

    cron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Running daily subscription check...');
        const connection = await db.getConnection();
        try {
            // 1. Identify Expiring Subscriptions (Audit purpose)
            const [expiredSubs] = await connection.query(
                "SELECT id, employer_id FROM subscriptions WHERE status = 'active' AND end_date < NOW()"
            );

            if (expiredSubs.length > 0) {
                console.log(`[CRON] Found ${expiredSubs.length} expired subscriptions.`);

                // 2. Update Status to 'expired'
                const [result] = await connection.query(
                    "UPDATE subscriptions SET status = 'expired', updated_at = NOW() WHERE status = 'active' AND end_date < NOW()"
                );

                console.log(`[CRON] Updated ${result.affectedRows} subscriptions to 'expired'.`);

                // 3. Log to Audit (Bulk or individual)
                // For simplicity, just log summary
                // In real app, you might notify users here
            } else {
                console.log('[CRON] No expired subscriptions found today.');
            }

        } catch (error) {
            console.error('[CRON] Error during subscription check:', error);
        } finally {
            connection.release();
        }
    });

    // Optional: Run immediately on server start for dev testing (comment out in production)
    // checkSubscriptionsNow();
};

const checkSubscriptionsNow = async () => {
    // ... same logic for manual testing ...
};

module.exports = startSubscriptionScheduler;
