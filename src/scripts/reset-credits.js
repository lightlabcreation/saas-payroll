const mysql = require('mysql2/promise');

async function resetCredits() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'saas_pop_db'
        });

        console.log("⚠️  WARNING: This will RESET all credits data!");
        console.log("=".repeat(60));

        // Show current data
        const [current] = await connection.query(`
            SELECT 
                SUM(total_added) as total_added,
                SUM(balance) as balance
            FROM credits
        `);

        console.log(`\nCurrent Credits:`);
        console.log(`  Total Added: ₹${parseFloat(current[0]?.total_added || 0).toLocaleString('en-IN')}`);
        console.log(`  Balance: ₹${parseFloat(current[0]?.balance || 0).toLocaleString('en-IN')}`);

        // Reset credits table
        console.log("\n🔄 Resetting credits table...");
        await connection.query('UPDATE credits SET total_added = 0, balance = 0');

        // Delete credit transactions
        console.log("🔄 Deleting credit transactions...");
        await connection.query("DELETE FROM transactions WHERE type = 'credit'");

        console.log("\n✅ Credits reset successfully!");
        console.log("Dashboard will now show ₹0");

    } catch (error) {
        console.error("❌ Error:", error.message);
    } finally {
        if (connection) await connection.end();
    }
}

resetCredits();
