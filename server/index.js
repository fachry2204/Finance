
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

// --- SERVE STATIC FRONTEND (PRODUCTION MODE) ---
// Configured to serve from 'public' folder inside server directory (Vite build output)
const distPath = path.join(__dirname, 'public'); 

if (fs.existsSync(distPath)) {
    console.log('[INFO] Serving static files from:', distPath);
    app.use(express.static(distPath));
    
    // Handle SPA Routing: Send index.html for any unknown route
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
} else {
    // Fallback check for 'dist' folder (legacy or local dev)
    const legacyDistPath = path.join(__dirname, '../dist');
    if (fs.existsSync(legacyDistPath)) {
        console.log('[INFO] Serving static files from:', legacyDistPath);
        app.use(express.static(legacyDistPath));
        app.get('*', (req, res) => {
            if (!req.path.startsWith('/api')) {
                res.sendFile(path.join(legacyDistPath, 'index.html'));
            }
        });
    }
}

// --- DATABASE CONNECTION CONFIGURATION ---
// PENTING: Gunakan 127.0.0.1, bukan localhost untuk menghindari isu IPv6 di Node.js
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rdr_admin',
    port: process.env.DB_PORT || 3306,
    dateStrings: true,
    multipleStatements: true, // Penting untuk menjalankan schema.sql
    // Tambahan untuk koneksi Remote (Hosting)
    connectTimeout: 20000, // Tambah timeout jadi 20 detik
    ssl: {
        rejectUnauthorized: false // Izinkan Self-Signed Certificate (umum di shared hosting)
    }
};

let pool;

// Helper: Hash Password (SHA256)
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// Helper: Wait for Pool Initialization
const waitForPool = async (timeoutMs = 10000) => {
    const start = Date.now();
    while (!pool) {
        if (Date.now() - start > timeoutMs) return false;
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return true;
};

// --- INITIALIZE DATABASE AUTOMATICALLY ---
const initDatabase = async () => {
    try {
        console.log(`[INIT] Mencoba menghubungkan ke MySQL...`);
        console.log(`       Host: ${dbConfig.host}`);
        console.log(`       User: ${dbConfig.user}`);
        console.log(`       Database: ${dbConfig.database}`);
        
        // 1. Koneksi awal TANPA database untuk mengecek/membuat DB
        const connection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            port: dbConfig.port
        });

        // 2. Buat Database jika belum ada
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
        console.log(`[SUCCESS] Database '${dbConfig.database}' siap/tersedia.`);
        await connection.end();

        // 3. Buat Pool Koneksi ke Database yang sudah pasti ada
        pool = mysql.createPool(dbConfig);

        // 4. Jalankan Schema (Buat Tabel Otomatis)
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            const conn = await pool.getConnection();
            
            // Split query berdasarkan ';' untuk eksekusi satu per satu (lebih aman)
            const queries = schemaSql.split(';').filter(q => q.trim().length > 0);
            
            for (const query of queries) {
                if (!query.trim()) continue;
                try {
                    await conn.query(query);
                } catch (err) {
                    // Abaikan error jika tabel sudah ada
                    if (!err.message.includes("already exists") && !err.message.includes("Duplicate entry")) {
                        console.warn("[WARN] Gagal eksekusi query schema:", err.message);
                    }
                }
            }
            conn.release();
            console.log('[SUCCESS] Tabel database berhasil disinkronisasi.');
        } else {
            console.warn('[WARN] File schema.sql tidak ditemukan.');
        }

        // 5. Pastikan User Admin Ada (Fallback jika schema.sql gagal seed)
        await ensureAdminUser();
        
        // 6. Explicitly Ensure Employees Table Exists (Safety Check)
        await ensureEmployeesTable();

    } catch (err) {
        console.error('\n===================================================');
        console.error('[FATAL] KONEKSI DATABASE GAGAL');
        console.error('Error:', err.message);
        console.error('---------------------------------------------------');
        console.error('Solusi:');
        console.error('1. Pastikan XAMPP (MySQL) sudah di-START.');
        console.error('2. Pastikan password di file .env benar (kosongkan jika default XAMPP).');
        console.error('3. Pastikan port MySQL adalah 3306.');
        console.error('===================================================\n');
    }
};

const ensureAdminUser = async () => {
    if (!pool) return;
    try {
        const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', ['admin']);
        if (rows.length === 0) {
            console.log('[INFO] User admin tidak ditemukan. Membuat user admin default...');
            const hashedPassword = hashPassword('admin');
            await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hashedPassword, 'admin']);
            console.log('[SUCCESS] User admin berhasil dibuat (Pass: admin).');
        }
    } catch (error) {
        console.error('[WARN] Gagal mengecek/membuat user admin:', error.message);
    }
};

const ensureEmployeesTable = async () => {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS employees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                position VARCHAR(100),
                phone VARCHAR(20),
                email VARCHAR(100),
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('[SUCCESS] Tabel employees terverifikasi.');
    } catch (error) {
        console.error('[WARN] Gagal verifikasi tabel employees:', error.message);
    }
}

// Jalankan inisialisasi
initDatabase();

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
    
    // Tunggu pool sebentar (max 5 detik) jika server baru start
    await waitForPool(5000);

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

// Login Route (Supports Users & Employees)
app.post('/api/login', async (req, res) => {
    // Tunggu pool max 5 detik
    await waitForPool(5000);

    if (!pool) return res.status(500).json({ success: false, message: 'Database Tidak Konek Hubungi Admin' });
    const { username, password } = req.body;

    console.log(`[LOGIN ATTEMPT] User: ${username}`);
    
    try {
        const hashedPassword = hashPassword(password);
        
        // 1. Cek Tabel Users (Admin)
        const [users] = await pool.query('SELECT id, username, role FROM users WHERE username = ? AND password = ?', [username, hashedPassword]);
        
        if (users.length > 0) {
            const user = users[0];
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            console.log(`[LOGIN SUCCESS] Admin: ${username}`);
            return res.json({ success: true, user: user, token: token });
        } 

        // 2. Cek Tabel Employees (Pegawai)
        const [employees] = await pool.query('SELECT id, username, name, position, email, phone FROM employees WHERE username = ? AND password = ?', [username, hashedPassword]);
        
        if (employees.length > 0) {
            const emp = employees[0];
            const token = jwt.sign({ id: emp.id, username: emp.username, role: 'employee', name: emp.name }, JWT_SECRET, { expiresIn: '24h' });
            console.log(`[LOGIN SUCCESS] Employee: ${username}`);
            
            const userObj = {
                id: emp.id,
                username: emp.username,
                role: 'employee',
                details: emp 
            };
            
            return res.json({ success: true, user: userObj, token: token });
        }

        console.log(`[LOGIN FAILED] Invalid credentials for: ${username}`);
        res.status(401).json({ success: false, message: 'Username atau password salah' });

    } catch (error) {
        console.error(`[LOGIN ERROR]`, error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// --- SETTINGS API (NEW) ---
app.get('/api/settings', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    try {
        const [rows] = await pool.query('SELECT * FROM settings');
        const settings = {};
        rows.forEach(row => {
            try {
                settings[row.setting_key] = JSON.parse(row.setting_value);
            } catch (e) {
                settings[row.setting_key] = row.setting_value;
            }
        });
        res.json(settings);
    } catch (error) {
        console.error('[API ERROR] Fetch settings failed:', error);
        res.status(500).json({ message: 'Failed to fetch settings' });
    }
});

app.post('/api/settings', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { key, value } = req.body;
    try {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
        await pool.query(
            'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [key, stringValue, stringValue]
        );
        res.json({ success: true, message: 'Settings saved' });
    } catch (error) {
        console.error('[API ERROR] Save setting failed:', error);
        res.status(500).json({ success: false, message: 'Failed to save setting' });
    }
});

// --- CATEGORIES API ---
app.get('/api/categories', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    try {
        const [rows] = await pool.query('SELECT name FROM categories ORDER BY name ASC');
        res.json(rows.map(r => r.name));
    } catch (error) {
        console.error('[API ERROR] Fetch categories failed:', error);
        res.status(500).json({ message: 'Failed to fetch categories' });
    }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { name } = req.body;
    try {
        await pool.query('INSERT INTO categories (name) VALUES (?)', [name]);
        res.json({ success: true, message: 'Category added' });
    } catch (error) {
        console.error('[API ERROR] Add category failed:', error);
        res.status(500).json({ success: false, message: 'Failed to add category' });
    }
});

app.delete('/api/categories/:name', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { name } = req.params;
    try {
        await pool.query('DELETE FROM categories WHERE name = ?', [name]);
        res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
        console.error('[API ERROR] Delete category failed:', error);
        res.status(500).json({ success: false, message: 'Failed to delete category' });
    }
});

// --- USERS API (Admin Only) ---
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

// --- EMPLOYEES API ---
app.get('/api/employees', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    try {
        const [rows] = await pool.query('SELECT id, name, position, phone, email, username FROM employees ORDER BY name ASC');
        res.json(rows);
    } catch (error) {
        console.error('[API ERROR] Fetch employees failed:', error);
        res.status(500).json({ message: 'Failed to fetch employees: ' + error.message });
    }
});

app.post('/api/employees', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { name, position, phone, email, username, password } = req.body;
    try {
        const hashedPassword = hashPassword(password);
        await pool.query(
            'INSERT INTO employees (name, position, phone, email, username, password) VALUES (?, ?, ?, ?, ?, ?)',
            [name, position, phone, email, username, hashedPassword]
        );
        res.json({ success: true, message: 'Pegawai berhasil ditambahkan' });
    } catch (error) {
        console.error('[API ERROR] Add employee failed:', error);
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(400).json({ success: false, message: 'Username atau Email sudah terdaftar.' });
        }
        res.status(500).json({ success: false, message: 'Gagal menambah pegawai: ' + error.message });
    }
});

app.put('/api/employees/:id', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { id } = req.params;
    const { name, position, phone, email, username, password } = req.body;
    
    try {
        if (password) {
            const hashedPassword = hashPassword(password);
            await pool.query(
                'UPDATE employees SET name=?, position=?, phone=?, email=?, username=?, password=? WHERE id=?',
                [name, position, phone, email, username, hashedPassword, id]
            );
        } else {
            await pool.query(
                'UPDATE employees SET name=?, position=?, phone=?, email=?, username=? WHERE id=?',
                [name, position, phone, email, username, id]
            );
        }
        res.json({ success: true, message: 'Data pegawai diperbarui' });
    } catch (error) {
        console.error('[API ERROR] Update employee failed:', error);
        res.status(500).json({ success: false, message: 'Gagal update pegawai: ' + error.message });
    }
});

app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM employees WHERE id = ?', [id]);
        res.json({ success: true, message: 'Pegawai dihapus' });
    } catch (error) {
         console.error('[API ERROR] Delete employee failed:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus pegawai: ' + error.message });
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

// Catch-all route untuk React Router (Harus ditaruh paling bawah sebelum app.listen)
app.get('*', (req, res) => {
    // Abaikan request API
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'API endpoint not found' });
    }

    const indexHtml = path.join(__dirname, '../dist', 'index.html');
    if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
    } else {
        res.send('API Server is Running. Frontend build not found.');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
