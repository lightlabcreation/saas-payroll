const mysqldump = require('mysqldump');
const { execSync } = require('child_process');

async function syncDb() {
    try {
        console.log("Starting database sync...");
        
        // 1. Dump live db
        console.log("Dumping live DB from Railway...");
        await mysqldump({
            connection: {
                host: 'hopper.proxy.rlwy.net',
                port: 19134,
                user: 'root',
                password: 'askkRPyBRbelCzTnAETtdfcRdpcHqfzP',
                database: 'railway',
            },
            dumpToFile: './live_dump.sql',
        });
        console.log("Dump successful: live_dump.sql created.");

        // 2. Import into local DB
        console.log("Dropping and recreating local database (saas_pop_db)...");
        execSync('C:\\xampp\\mysql\\bin\\mysql.exe -u root -e "DROP DATABASE IF EXISTS saas_pop_db; CREATE DATABASE saas_pop_db;"', { stdio: 'inherit' });
        
        console.log("Importing data into local database...");
        execSync('C:\\xampp\\mysql\\bin\\mysql.exe -u root saas_pop_db < live_dump.sql', { stdio: 'inherit' });
        
        console.log("Import successful!");
        console.log("Local database is now fully synced with the live Railway database.");

    } catch (err) {
        console.error("An error occurred during sync:", err);
    }
}

syncDb();
