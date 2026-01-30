
// Coba load dotenv
try {
    require('dotenv').config();
} catch (e) {
    console.log('[INFO] Modul dotenv tidak ditemukan. Mengandalkan Environment Variables sistem.');
}

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'keuangan_rdr',
    dateStrings: true 
};

let pool;
try {
    pool = mysql.createPool(dbConfig);
    console.log('Database configuration loaded.');
} catch (err) {
    console.error('Database configuration error:', err);
}

// Helper: Hash Password (SHA256)
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// --- GOOGLE DRIVE OAUTH2 SETUP ---
let oauth2Client = null;
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
}

const upload = multer({ dest: 'uploads/' });

// --- API ROUTES ---

app.get('/api/test-db', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (!pool) return res.status(500).json({ status: 'error', message: 'Pool database belum terinisialisasi' });
    
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        res.json({ status: 'success', message: 'Terhubung ke MySQL Database!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Gagal terhubung ke Database.', error: error.message });
    }
});

// --- AUTH API ---
app.post('/api/login', async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { username, password } = req.body;
    
    try {
        const hashedPassword = hashPassword(password);
        const [rows] = await pool.query('SELECT id, username, role FROM users WHERE username = ? AND password = ?', [username, hashedPassword]);
        
        if (rows.length > 0) {
            res.json({ success: true, user: rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Username atau password salah' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/users', async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    try {
        const [rows] = await pool.query('SELECT id, username, role FROM users');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

app.post('/api/users', async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { username, password } = req.body;
    try {
        const hashedPassword = hashPassword(password);
        await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, 'admin']);
        res.json({ success: true, message: 'User created' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create user. Username might exist.' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
});

// --- TRANSACTIONS API ---
app.get('/api/transactions', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    try {
        const [rows] = await pool.query('SELECT * FROM transactions ORDER BY created_at DESC');
        
        if (!rows || rows.length === 0) {
            return res.json([]);
        }

        const transactions = await Promise.all(rows.map(async (t) => {
            const [items] = await pool.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [t.id]);
            return {
                id: t.id,
                date: t.date,
                type: t.type,
                expenseType: t.expense_type,
                category: t.category,
                activityName: t.activity_name,
                description: t.description,
                grandTotal: parseFloat(t.grand_total || 0),
                items: (items || []).map(i => ({
                    id: i.id,
                    name: i.name,
                    qty: i.qty,
                    price: parseFloat(i.price || 0),
                    total: parseFloat(i.total || 0),
                    filePreviewUrl: i.file_url 
                })),
                timestamp: new Date(t.created_at).getTime()
            };
        }));
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ message: 'Error fetching transactions', error: error.toString() });
    }
});

app.post('/api/transactions', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const t = req.body;
        
        await conn.query(
            'INSERT INTO transactions (id, date, type, expense_type, category, activity_name, description, grand_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [t.id, t.date, t.type, t.expenseType || null, t.category, t.activityName, t.description, t.grandTotal]
        );

        if (t.items && t.items.length > 0) {
            for (const item of t.items) {
                 await conn.query(
                    'INSERT INTO transaction_items (id, transaction_id, name, qty, price, total) VALUES (?, ?, ?, ?, ?, ?)',
                    [item.id, t.id, item.name, item.qty, item.price, item.total]
                 );
            }
        }

        await conn.commit();
        res.json({ status: 'success', message: 'Transaction saved' });
    } catch (error) {
        await conn.rollback();
        console.error('Error saving transaction:', error);
        res.status(500).json({ message: 'Failed to save transaction', error: error.message });
    } finally {
        conn.release();
    }
});

// --- REIMBURSEMENTS API ---
app.get('/api/reimbursements', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    try {
        const [rows] = await pool.query('SELECT * FROM reimbursements ORDER BY created_at DESC');
        
        if (!rows || rows.length === 0) {
            return res.json([]);
        }

        const reimbursements = await Promise.all(rows.map(async (r) => {
            const [items] = await pool.query('SELECT * FROM reimbursement_items WHERE reimbursement_id = ?', [r.id]);
            return {
                id: r.id,
                date: r.date,
                requestorName: r.requestor_name,
                category: r.category,
                activityName: r.activity_name,
                description: r.description,
                grandTotal: parseFloat(r.grand_total || 0),
                status: r.status,
                transferProofUrl: r.transfer_proof_url,
                rejectionReason: r.rejection_reason,
                items: (items || []).map(i => ({
                    id: i.id,
                    name: i.name,
                    qty: i.qty,
                    price: parseFloat(i.price || 0),
                    total: parseFloat(i.total || 0),
                    filePreviewUrl: i.file_url
                })),
                timestamp: new Date(r.created_at).getTime()
            };
        }));
        res.json(reimbursements);
    } catch (error) {
        console.error('Error fetching reimbursements:', error);
        res.status(500).json({ message: 'Error fetching reimbursements', error: error.toString() });
    }
});

app.post('/api/reimbursements', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const r = req.body;
        
        await conn.query(
            'INSERT INTO reimbursements (id, date, requestor_name, category, activity_name, description, grand_total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [r.id, r.date, r.requestorName, r.category, r.activityName, r.description, r.grandTotal, 'PENDING']
        );

        if (r.items && r.items.length > 0) {
            for (const item of r.items) {
                 await conn.query(
                    'INSERT INTO reimbursement_items (id, reimbursement_id, name, qty, price, total) VALUES (?, ?, ?, ?, ?, ?)',
                    [item.id, r.id, item.name, item.qty, item.price, item.total]
                 );
            }
        }

        await conn.commit();
        res.json({ status: 'success', message: 'Reimbursement saved' });
    } catch (error) {
        await conn.rollback();
        console.error('Error saving reimbursement:', error);
        res.status(500).json({ message: 'Failed to save reimbursement', error: error.message });
    } finally {
        conn.release();
    }
});

app.put('/api/reimbursements/:id', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    
    try {
        await pool.query(
            'UPDATE reimbursements SET status = ?, rejection_reason = ? WHERE id = ?',
            [status, rejectionReason || null, id]
        );
        res.json({ status: 'success', message: 'Status updated' });
    } catch (error) {
        console.error('Error updating reimbursement:', error);
        res.status(500).json({ message: 'Failed to update status', error: error.message });
    }
});

// --- AUTH & DRIVE API ---
app.get('/auth/google', (req, res) => {
    if (!oauth2Client) return res.status(500).json({ message: 'Google Client ID belum dikonfigurasi.' });
    const scopes = ['https://www.googleapis.com/auth/drive.file'];
    const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: scopes, prompt: 'consent' });
    res.json({ url });
});

app.get('/auth/google/callback', async (req, res) => {
    if (!oauth2Client) return res.status(500).send('OAuth Client not configured');
    const { code } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync('tokens.json', JSON.stringify(tokens));
        res.redirect('/settings?status=drive_connected');
    } catch (error) {
        console.error(error);
        res.redirect('/settings?status=drive_failed');
    }
});

const loadTokens = () => {
    if (!oauth2Client) return false;
    if (fs.existsSync('tokens.json')) {
        const tokens = JSON.parse(fs.readFileSync('tokens.json'));
        oauth2Client.setCredentials(tokens);
        return true;
    }
    return false;
};

app.post('/api/upload-drive', upload.single('file'), async (req, res) => {
    if (!loadTokens()) return res.status(401).json({ message: 'Google Drive belum terhubung.' });
    const { folderId } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    try {
        const fileMetadata = {
            name: file.originalname,
            parents: folderId && folderId !== 'root' ? [folderId] : []
        };
        const media = { mimeType: file.mimetype, body: fs.createReadStream(file.path) };
        const response = await drive.files.create({
            requestBody: fileMetadata, media: media, fields: 'id, webViewLink'
        });
        fs.unlinkSync(file.path);
        res.json({ status: 'success', fileId: response.data.id, url: response.data.webViewLink });
    } catch (error) {
        res.status(500).json({ message: 'Upload gagal', error: error.message });
    }
});

// --- SERVE STATIC FRONTEND ---
const publicPath = path.join(__dirname, 'public');

if (fs.existsSync(publicPath)) {
    console.log(`[INFO] Serving static files from: ${publicPath}`);
    app.use(express.static(publicPath));
    
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
            return res.status(404).json({ message: 'API Endpoint Not Found' });
        }
        res.sendFile(path.join(publicPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send('Server Running. Please run npm run build inside root directory.'));
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
