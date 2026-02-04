
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'dmsv_finance',
    password: process.env.DB_PASSWORD || 'Bangbens220488!',
    database: process.env.DB_NAME || 'dmsv_finance',
    port: process.env.DB_PORT || 3306
};

async function check() {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [rows] = await conn.query("SELECT * FROM reimbursement_items LIMIT 5");
        console.log(JSON.stringify(rows, null, 2));
        await conn.end();
    } catch (e) {
        console.error(e);
    }
}

check();
