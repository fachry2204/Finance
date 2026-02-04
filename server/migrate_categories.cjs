
const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

// Load env
const envPath = path.join(__dirname, 'server', '.env');
dotenv.config({ path: envPath });

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rdr_admin',
    port: process.env.DB_PORT || 3306
};

async function migrate() {
    console.log('Starting migration...');
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Check if column exists
        const [columns] = await connection.query("SHOW COLUMNS FROM categories LIKE 'type'");
        
        if (columns.length === 0) {
            console.log('Adding type column to categories...');
            await connection.query("ALTER TABLE categories ADD COLUMN type ENUM('INCOME', 'EXPENSE') NOT NULL DEFAULT 'EXPENSE'");
            console.log('Column added successfully.');
            
            // Optional: Update known income categories if any (manual mapping might be needed later)
            // For now, all default to EXPENSE as per requirement (most are likely expenses).
            // User can edit them later.
        } else {
            console.log('Column type already exists.');
        }

        await connection.end();
        console.log('Migration complete.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
