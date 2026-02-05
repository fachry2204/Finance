const mysql = require('mysql2/promise');

async function checkData() {
    // Use localhost as per .env
    const config = {
        host: 'localhost', 
        user: 'dmsv_finance',
        password: 'Bangbens220488!',
        database: 'dmsv_finance',
        port: 3306
    };

    console.log('Connecting to DB...', config.host, config.user, config.database);

    try {
        const conn = await mysql.createConnection(config);
        console.log('Connected!');

        // Check Categories
        console.log('\n--- CATEGORIES (First 10) ---');
        const [cats] = await conn.query('SELECT * FROM categories LIMIT 10');
        console.table(cats);

        // Check Reimbursements that are APPROVED
        console.log('\n--- REIMBURSEMENTS (Approved, First 5) ---');
        const [reimbs] = await conn.query("SELECT id, status, grand_total, company_id FROM reimbursements WHERE status = 'BERHASIL' LIMIT 5");
        console.table(reimbs);

        // Check Transactions (Jurnal) linked to Reimbursements
        console.log('\n--- TRANSACTIONS (Reimburse Type, First 5) ---');
        const [trans] = await conn.query("SELECT id, type, expense_type, grand_total FROM transactions WHERE expense_type = 'REIMBURSE' LIMIT 5");
        console.table(trans);

        await conn.end();
    } catch (err) {
        console.error('Error connecting or querying database:');
        console.error(err);
    }
}

checkData();
