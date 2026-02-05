const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

async function reconcile() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'finance_db',
        port: process.env.DB_PORT || 3306
    };

    console.log('Starting Reconciliation...');
    console.log(`Connecting to ${config.host}:${config.port} user=${config.user} db=${config.database}`);

    let conn;
    try {
        conn = await mysql.createConnection(config);
        console.log('Connected to database.');

        // 1. Get all APPROVED reimbursements
        const [reimbursements] = await conn.query("SELECT * FROM reimbursements WHERE status = 'BERHASIL'");
        console.log(`Found ${reimbursements.length} approved reimbursements.`);

        let postedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const r of reimbursements) {
            try {
                // 2. Check if exists in transactions
                const [existing] = await conn.query('SELECT id FROM transactions WHERE id = ?', [r.id]);

                if (existing.length > 0) {
                    skippedCount++;
                    continue;
                }

                console.log(`Posting Reimbursement ID: ${r.id} to Transactions...`);

                // 3. Get Items
                const [items] = await conn.query('SELECT * FROM reimbursement_items WHERE reimbursement_id = ?', [r.id]);

                // 4. Insert Transaction
                // Description format: "Reimburse oleh: [Name] - [Description]"
                const desc = `Reimburse oleh: ${r.requestor_name} - ${r.description}`;

                await conn.beginTransaction();

                await conn.query(
                    'INSERT INTO transactions (id, date, type, expense_type, category, company_id, activity_name, description, grand_total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [r.id, r.date, 'PENGELUARAN', 'REIMBURSE', r.category, r.company_id, r.activity_name, desc, r.grand_total, r.created_at]
                );

                // 5. Insert Items
                if (items.length > 0) {
                    for (const item of items) {
                        await conn.query(
                            'INSERT INTO transaction_items (id, transaction_id, name, qty, price, total, file_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [item.id, r.id, item.name, item.qty, item.price, item.total, item.file_url]
                        );
                    }
                }

                await conn.commit();
                postedCount++;
                console.log(`  -> Success.`);

            } catch (err) {
                await conn.rollback();
                console.error(`  -> Failed to post ID ${r.id}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n--- Reconciliation Complete ---');
        console.log(`Total Approved: ${reimbursements.length}`);
        console.log(`Already Posted: ${skippedCount}`);
        console.log(`Newly Posted: ${postedCount}`);
        console.log(`Errors: ${errorCount}`);

    } catch (err) {
        console.error('Fatal Error:', err);
    } finally {
        if (conn) await conn.end();
    }
}

reconcile();
