
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
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'rdr-secret-key-change-in-prod-999';

// Middleware
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rdr_admin', // Updated to rdr_admin
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

// Middleware: Authenticate Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Format: "Bearer <TOKEN>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Akses ditolak. Token tidak ditemukan.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token tidak valid atau kadaluwarsa.' });
        }
        req.user = user;
        next();
    });
};

// --- FILE UPLOAD STORAGE CONFIGURATION ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'file-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage: storage });

// --- API ROUTES ---

// Public Route
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

// Login Route (Generates Token)
app.post('/api/login', async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { username, password } = req.body;
    
    try {
        const hashedPassword = hashPassword(password);
        const [rows] = await pool.query('SELECT id, username, role FROM users WHERE username = ? AND password = ?', [username, hashedPassword]);
        
        if (rows.length > 0) {
            const user = rows[0];
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ success: true, user: user, token: token });
        } else {
            res.status(401).json({ success: false, message: 'Username atau password salah' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- PROTECTED ROUTES (Require Token) ---

app.get('/api/users', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    try {
        const [rows] = await pool.query('SELECT id, username, role FROM users');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

app.post('/api/users', authenticateToken, async (req, res) => {
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

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
});

// Upload API (Protected)
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ status: 'success', url: fileUrl });
});

// Transactions API (Protected)
app.get('/api/transactions', authenticateToken, async (req, res) => {
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

app.post('/api/transactions', authenticateToken, async (req, res) => {
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
                    'INSERT INTO transaction_items (id, transaction_id, name, qty, price, total, file_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [item.id, t.id, item.name, item.qty, item.price, item.total, item.filePreviewUrl || null]
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

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM transactions WHERE id = ?', [id]);
        res.json({ status: 'success', message: 'Transaction deleted' });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ message: 'Failed to delete transaction', error: error.message });
    }
});

app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const conn = await pool.getConnection();
    const { id } = req.params;
    const t = req.body;

    try {
        await conn.beginTransaction();
        await conn.query(
            'UPDATE transactions SET date=?, type=?, expense_type=?, category=?, activity_name=?, description=?, grand_total=? WHERE id=?',
            [t.date, t.type, t.expenseType || null, t.category, t.activityName, t.description, t.grandTotal, id]
        );
        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);
        if (t.items && t.items.length > 0) {
            for (const item of t.items) {
                 await conn.query(
                    'INSERT INTO transaction_items (id, transaction_id, name, qty, price, total, file_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [item.id, id, item.name, item.qty, item.price, item.total, item.filePreviewUrl || null]
                 );
            }
        }
        await conn.commit();
        res.json({ status: 'success', message: 'Transaction updated' });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ message: 'Failed to update transaction', error: error.message });
    } finally {
        conn.release();
    }
});

// Reimbursements API (Protected)
app.get('/api/reimbursements', authenticateToken, async (req, res) => {
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

app.post('/api/reimbursements', authenticateToken, async (req, res) => {
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
                    'INSERT INTO reimbursement_items (id, reimbursement_id, name, qty, price, total, file_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [item.id, r.id, item.name, item.qty, item.price, item.total, item.filePreviewUrl || null]
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

app.put('/api/reimbursements/:id/details', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const conn = await pool.getConnection();
    const { id } = req.params;
    const r = req.body;

    try {
        await conn.beginTransaction();
        await conn.query(
            'UPDATE reimbursements SET date=?, requestor_name=?, category=?, activity_name=?, description=?, grand_total=? WHERE id=?',
            [r.date, r.requestorName, r.category, r.activityName, r.description, r.grandTotal, id]
        );
        await conn.query('DELETE FROM reimbursement_items WHERE reimbursement_id = ?', [id]);
        if (r.items && r.items.length > 0) {
            for (const item of r.items) {
                 await conn.query(
                    'INSERT INTO reimbursement_items (id, reimbursement_id, name, qty, price, total, file_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [item.id, id, item.name, item.qty, item.price, item.total, item.filePreviewUrl || null]
                 );
            }
        }
        await conn.commit();
        res.json({ status: 'success', message: 'Reimbursement details updated' });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ message: 'Failed to update reimbursement', error: error.message });
    } finally {
        conn.release();
    }
});

app.delete('/api/reimbursements/:id', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM reimbursements WHERE id = ?', [id]);
        res.json({ status: 'success', message: 'Reimbursement deleted' });
    } catch (error) {
        console.error('Error deleting reimbursement:', error);
        res.status(500).json({ message: 'Failed to delete reimbursement', error: error.message });
    }
});

app.put('/api/reimbursements/:id', authenticateToken, async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { id } = req.params;
    const { status, rejectionReason, transferProofUrl } = req.body;
    
    try {
        await pool.query(
            'UPDATE reimbursements SET status = ?, rejection_reason = ?, transfer_proof_url = IFNULL(?, transfer_proof_url) WHERE id = ?',
            [status, rejectionReason || null, transferProofUrl || null, id]
        );
        res.json({ status: 'success', message: 'Status updated' });
    } catch (error) {
        console.error('Error updating reimbursement:', error);
        res.status(500).json({ message: 'Failed to update status', error: error.message });
    }
});

// Serve Static Frontend & Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const publicPath = path.join(__dirname, 'public');

if (fs.existsSync(publicPath)) {
    console.log(`[INFO] Serving static files from: ${publicPath}`);
    app.use(express.static(publicPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/uploads')) {
            return res.status(404).json({ message: 'Not Found' });
        }
        res.sendFile(path.join(publicPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send('Server Running. Please run npm run build inside root directory.'));
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
