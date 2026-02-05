
const path = require('path');
const fs = require('fs');

// Coba load dotenv dari folder server (force path)
const envPath = path.join(__dirname, '.env');
const dotenvResult = require('dotenv').config({ path: envPath });

if (dotenvResult.error) {
    console.log('[INFO] Dotenv config failed or file not found:', dotenvResult.error.message);
} else {
    console.log('[INFO] Dotenv loaded successfully from:', envPath);
    console.log('[INFO] DB_HOST loaded:', process.env.DB_HOST);
    console.log('[INFO] DB_USER loaded:', process.env.DB_USER);
}

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
console.log(`[INFO] Starting server... Environment PORT: ${process.env.PORT}, Using PORT: ${PORT}`);
const JWT_SECRET = process.env.JWT_SECRET || 'rdr-secret-key-change-in-prod-999';

// Middleware
app.use(cors());
app.use(express.json());

// --- SERVE STATIC FRONTEND (Moved to bottom) ---
// Static file serving logic has been moved to the end of the file 
// to ensure it doesn't intercept API requests.


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
    connectTimeout: 20000 // Tambah timeout jadi 20 detik
};

let pool;
let globalDbError = null;

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

        // 4. Jalankan Schema dan Helper (Menggunakan syncDatabaseSchema)
        await syncDatabaseSchema(pool);

    } catch (err) {
        globalDbError = err;
        console.error('\n===================================================');
        console.error('[FATAL] KONEKSI DATABASE GAGAL');
        console.error('Error Message:', err.message);
        console.error('Error Code:', err.code);
        console.error('Full Error:', err);
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

const ensureCompaniesTable = async () => {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS companies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('[SUCCESS] Tabel companies terverifikasi.');
    } catch (error) {
        console.error('[WARN] Gagal verifikasi tabel companies:', error.message);
    }
};

const ensureCompanyIdColumns = async () => {
    if (!pool) return;
    try {
        // Check transactions table
        const [tCols] = await pool.query("SHOW COLUMNS FROM transactions LIKE 'company_id'");
        if (tCols.length === 0) {
            await pool.query("ALTER TABLE transactions ADD COLUMN company_id INT");
            await pool.query("ALTER TABLE transactions ADD CONSTRAINT fk_transactions_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL");
            console.log('[SUCCESS] Kolom company_id ditambahkan ke transactions.');
        }

        // Check reimbursements table
        const [rCols] = await pool.query("SHOW COLUMNS FROM reimbursements LIKE 'company_id'");
        if (rCols.length === 0) {
            await pool.query("ALTER TABLE reimbursements ADD COLUMN company_id INT");
            await pool.query("ALTER TABLE reimbursements ADD CONSTRAINT fk_reimbursements_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL");
            console.log('[SUCCESS] Kolom company_id ditambahkan ke reimbursements.');
        }
    } catch (error) {
        console.error('[WARN] Gagal verifikasi kolom company_id:', error.message);
    }
};

const ensureCategorySchema = async () => {
    if (!pool) return;
    try {
        // 1. Add company_id column if not exists
        const [cols] = await pool.query("SHOW COLUMNS FROM categories LIKE 'company_id'");
        if (cols.length === 0) {
            await pool.query("ALTER TABLE categories ADD COLUMN company_id INT NULL");
            await pool.query("ALTER TABLE categories ADD CONSTRAINT fk_categories_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL");
            console.log('[SUCCESS] Kolom company_id ditambahkan ke categories.');
        }

        // 2. Fix Unique Constraint (Drop 'name' index if exists and replace with compound index)
        // Check if index 'name' exists
        const [indexes] = await pool.query("SHOW INDEX FROM categories WHERE Key_name = 'name'");
        if (indexes.length > 0) {
            try {
                await pool.query("ALTER TABLE categories DROP INDEX name");
                console.log('[SUCCESS] Index UNIQUE lama (name) dihapus dari categories.');
            } catch (e) {
                console.warn('[WARN] Gagal drop index name:', e.message);
            }
        }

        // Check if new index exists
        const [newIndexes] = await pool.query("SHOW INDEX FROM categories WHERE Key_name = 'uniq_category_type_company'");
        if (newIndexes.length === 0) {
            try {
                await pool.query("ALTER TABLE categories ADD UNIQUE KEY uniq_category_type_company (name, type, company_id)");
                console.log('[SUCCESS] Index UNIQUE baru (name, type, company_id) ditambahkan ke categories.');
            } catch (e) {
                 console.warn('[WARN] Gagal add index baru:', e.message);
            }
        }

    } catch (error) {
        console.error('[WARN] Gagal verifikasi schema categories:', error.message);
    }
};

const ensureDriveColumnsRemoved = async () => {
    if (!pool) return;
    try {
        // Check transaction_items table
        const [tCols] = await pool.query("SHOW COLUMNS FROM transaction_items LIKE 'drive_file_id'");
        if (tCols.length > 0) {
            await pool.query("ALTER TABLE transaction_items DROP COLUMN drive_file_id");
            console.log('[SUCCESS] Kolom drive_file_id dihapus dari transaction_items.');
        }

        // Check reimbursement_items table
        const [rCols] = await pool.query("SHOW COLUMNS FROM reimbursement_items LIKE 'drive_file_id'");
        if (rCols.length > 0) {
            await pool.query("ALTER TABLE reimbursement_items DROP COLUMN drive_file_id");
            console.log('[SUCCESS] Kolom drive_file_id dihapus dari reimbursement_items.');
        }
    } catch (error) {
        console.error('[WARN] Gagal menghapus kolom drive_file_id:', error.message);
    }
};

const syncDatabaseSchema = async (poolInstance) => {
    if (!poolInstance) return;
    console.log('[MIGRATION] Memulai sinkronisasi schema...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        const conn = await poolInstance.getConnection();
        const queries = schemaSql.split(';').filter(q => q.trim().length > 0);
        for (const query of queries) {
            if (!query.trim()) continue;
            try {
                await conn.query(query);
            } catch (err) {
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
    await ensureAdminUser();
    await ensureEmployeesTable();
    await ensureCompaniesTable();
    await ensureCompanyIdColumns();
    await ensureCategorySchema();
    await ensureDriveColumnsRemoved();
};

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
// Tujuan: ../public/img (supaya bisa diakses frontend langsung jika diperlukan)
const publicImgDir = path.join(__dirname, '../public/img');

// Pastikan folder root public/img ada
if (!fs.existsSync(publicImgDir)) {
    fs.mkdirSync(publicImgDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ambil companyName dan type dari req.body (perlu setup multer agar body terparse sebelum file)
        // Namun, standard multer handling: req.body mungkin belum tersedia jika field file dikirim duluan.
        // Frontend harus kirim text fields SEBELUM file.
        
        let companyName = req.body.companyName || 'General';
        let type = req.body.type || 'others';

        // Sanitize folder names
        companyName = companyName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim().replace(/\s+/g, '_');
        type = type.replace(/[^a-zA-Z0-9\s-_]/g, '').trim().replace(/\s+/g, '_');

        if (!companyName) companyName = 'General';
        if (!type) type = 'others';

        const targetDir = path.join(publicImgDir, companyName, type);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'file-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage: storage });

// --- API ROUTES ---

// DEBUG ROUTE (Temporary for troubleshooting)
app.get('/api/debug-db', async (req, res) => {
    const debugInfo = {
        envLoaded: !!process.env.DB_HOST,
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        db: process.env.DB_NAME,
        port: process.env.DB_PORT,
        passwordLength: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0,
        globalError: globalDbError ? globalDbError.message : null
    };

    let connectionResult = null;
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'rdr_admin',
            port: process.env.DB_PORT || 3306
        });
        await connection.ping();
        await connection.end();
        connectionResult = 'SUCCESS: Direct connection established';
    } catch (err) {
        connectionResult = `FAILED: ${err.message} (Code: ${err.code})`;
    }

    res.json({
        status: 'debug',
        timestamp: new Date().toISOString(),
        connectionResult,
        debugInfo
    });
});

// Public Route
app.get('/api/test-db', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    // Tunggu pool sebentar (max 5 detik) jika server baru start
    await waitForPool(5000);

    if (!pool) return res.status(500).json({ status: 'error', message: 'Pool database belum terinisialisasi' });
    
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        
        // Check schema integrity (cek apakah tabel utama ada)
        const [tables] = await connection.query("SHOW TABLES LIKE 'transactions'");
        connection.release();

        if (tables.length === 0) {
            return res.json({ status: 'schema_missing', message: 'Database terhubung tapi tabel belum lengkap.' });
        }

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
        const [rows] = await pool.query(`
            SELECT c.id, c.name, c.type, c.company_id, com.name as company_name 
            FROM categories c 
            LEFT JOIN companies com ON c.company_id = com.id 
            ORDER BY c.name ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error('[API ERROR] Fetch categories failed:', error);
        res.status(500).json({ message: 'Failed to fetch categories' });
    }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { name, type, company_id } = req.body;
    
    // Validasi basic
    if (!name) return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });

    try {
        await pool.query('INSERT INTO categories (name, type, company_id) VALUES (?, ?, ?)', [name, type || 'EXPENSE', company_id || null]);
        res.json({ success: true, message: 'Category added' });
    } catch (error) {
        console.error('[API ERROR] Add category failed:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Kategori ini sudah ada untuk perusahaan/tipe tersebut' });
        }
        res.status(500).json({ success: false, message: 'Failed to add category' });
    }
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { id } = req.params; // Changed from name to id
    const { newName } = req.body;
    
    if (!newName || !newName.trim()) {
        return res.status(400).json({ success: false, message: 'Nama kategori baru tidak boleh kosong' });
    }

    try {
        // Cek duplicate (excluding self) - perlu cek company_id dan type dari record yg sedang diedit
        // Ambil data lama dulu
        const [current] = await pool.query('SELECT type, company_id FROM categories WHERE id = ?', [id]);
        if (current.length === 0) {
             return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
        }
        const { type, company_id } = current[0];

        // Cek apakah nama baru sudah ada di scope yang sama (type & company)
        const queryCheck = 'SELECT id FROM categories WHERE name = ? AND type = ? AND (company_id = ? OR (company_id IS NULL AND ? IS NULL)) AND id != ?';
        const [existing] = await pool.query(queryCheck, [newName, type, company_id, company_id, id]);
        
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Nama kategori sudah ada' });
        }

        await pool.query('UPDATE categories SET name = ? WHERE id = ?', [newName, id]);
        res.json({ success: true, message: 'Category updated' });
    } catch (error) {
        console.error('[API ERROR] Update category failed:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Kategori ini sudah ada untuk perusahaan/tipe tersebut' });
        }
        res.status(500).json({ success: false, message: 'Failed to update category' });
    }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { id } = req.params;
    
    try {
        await pool.query('DELETE FROM categories WHERE id = ?', [id]);
        res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
        console.error('[API ERROR] Delete category failed:', error);
        res.status(500).json({ success: false, message: 'Failed to delete category' });
    }
});

// Deprecated delete by name route removed

// --- COMPANIES API ---
app.get('/api/companies', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    try {
        const [rows] = await pool.query('SELECT id, name FROM companies ORDER BY name ASC');
        res.json(rows);
    } catch (error) {
        console.error('[API ERROR] Fetch companies failed:', error);
        res.status(500).json({ message: 'Failed to fetch companies' });
    }
});

app.post('/api/companies', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { name } = req.body;
    try {
        const [result] = await pool.query('INSERT INTO companies (name) VALUES (?)', [name]);
        res.json({ success: true, message: 'Perusahaan berhasil ditambahkan', company: { id: result.insertId, name } });
    } catch (error) {
        console.error('[API ERROR] Add company failed:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Nama perusahaan sudah ada.' });
        }
        res.status(500).json({ success: false, message: 'Gagal menambah perusahaan' });
    }
});

app.put('/api/companies/:id', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Nama perusahaan tidak boleh kosong' });
    }

    try {
        // Cek duplicate
        const [existing] = await pool.query('SELECT id FROM companies WHERE name = ? AND id != ?', [name, id]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Nama perusahaan sudah digunakan' });
        }

        await pool.query('UPDATE companies SET name = ? WHERE id = ?', [name, id]);
        res.json({ success: true, message: 'Perusahaan berhasil diperbarui' });
    } catch (error) {
        console.error('[API ERROR] Update company failed:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui perusahaan' });
    }
});

app.delete('/api/companies/:id', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM companies WHERE id = ?', [id]);
        res.json({ success: true, message: 'Perusahaan berhasil dihapus' });
    } catch (error) {
        console.error('[API ERROR] Delete company failed:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus perusahaan' });
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

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    if (!pool) return res.status(500).json({ message: 'DB not connected' });
    const { id } = req.params;
    const { username, password } = req.body;
    
    try {
        if (password && password.trim() !== '') {
            const hashedPassword = hashPassword(password);
            await pool.query('UPDATE users SET username = ?, password = ? WHERE id = ?', [username, hashedPassword, id]);
        } else {
            await pool.query('UPDATE users SET username = ? WHERE id = ?', [username, id]);
        }
        res.json({ success: true, message: 'User updated' });
    } catch (error) {
        console.error('[API ERROR] Update user failed:', error);
        res.status(500).json({ success: false, message: 'Failed to update user' });
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
    
    // Construct public URL
    // File disimpan di ../public/img/...
    // URL harus relative terhadap root frontend atau server static serve.
    // Kita akan serve ../public/img di route /img
    
    // Path relative dari folder public/img
    const companyName = req.body.companyName ? req.body.companyName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim().replace(/\s+/g, '_') : 'General';
    const type = req.body.type ? req.body.type.replace(/[^a-zA-Z0-9\s-_]/g, '').trim().replace(/\s+/g, '_') : 'others';
    
    const relativePath = `/img/${companyName}/${type}/${req.file.filename}`;
    
    res.json({ status: 'success', url: relativePath });
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
                companyId: t.company_id,
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
            'INSERT INTO transactions (id, date, type, expense_type, category, company_id, activity_name, description, grand_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [t.id, t.date, t.type, t.expenseType || null, t.category, t.companyId || null, t.activityName, t.description, t.grandTotal]
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
            'UPDATE transactions SET date=?, type=?, expense_type=?, category=?, company_id=?, activity_name=?, description=?, grand_total=? WHERE id=?',
            [t.date, t.type, t.expenseType || null, t.category, t.companyId || null, t.activityName, t.description, t.grandTotal, id]
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
                companyId: r.company_id,
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
            'INSERT INTO reimbursements (id, date, requestor_name, category, company_id, activity_name, description, grand_total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [r.id, r.date, r.requestorName, r.category, r.companyId || null, r.activityName, r.description, r.grandTotal, 'PENDING']
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
            'UPDATE reimbursements SET date=?, requestor_name=?, category=?, company_id=?, activity_name=?, description=?, grand_total=? WHERE id=?',
            [r.date, r.requestorName, r.category, r.companyId || null, r.activityName, r.description, r.grandTotal, id]
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
    
    const conn = await pool.getConnection();
    
    try {
        await conn.beginTransaction();

        // 1. Update Reimbursement Status
        await conn.query(
            'UPDATE reimbursements SET status = ?, rejection_reason = ?, transfer_proof_url = IFNULL(?, transfer_proof_url) WHERE id = ?',
            [status, rejectionReason || null, transferProofUrl || null, id]
        );

        // 2. If Status is BERHASIL, Post to Transactions (Jurnal Sistem)
        if (status === 'BERHASIL') {
            // Check if already exists in transactions (prevent duplicates)
            const [existing] = await conn.query('SELECT id FROM transactions WHERE id = ?', [id]);
            
            if (existing.length === 0) {
                // Fetch Reimbursement Details
                const [reimbRows] = await conn.query('SELECT * FROM reimbursements WHERE id = ?', [id]);
                
                if (reimbRows.length > 0) {
                    const r = reimbRows[0];
                    
                    // Fetch Reimbursement Items
                    const [rItems] = await conn.query('SELECT * FROM reimbursement_items WHERE reimbursement_id = ?', [id]);

                    // Insert into Transactions
                    // Description format: "Reimburse oleh: [Name] - [Description]"
                    const desc = `Reimburse oleh: ${r.requestor_name} - ${r.description}`;
                    
                    // Use the SAME ID as Reimbursement for traceability and duplicate prevention
                    await conn.query(
                        'INSERT INTO transactions (id, date, type, expense_type, category, company_id, activity_name, description, grand_total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [r.id, r.date, 'PENGELUARAN', 'REIMBURSE', r.category, r.company_id, r.activity_name, desc, r.grand_total, r.created_at]
                    );

                    // Insert Items
                    if (rItems.length > 0) {
                        for (const item of rItems) {
                             await conn.query(
                                'INSERT INTO transaction_items (id, transaction_id, name, qty, price, total, file_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                [item.id, r.id, item.name, item.qty, item.price, item.total, item.file_url]
                             );
                        }
                    }
                    console.log(`[AUTO-POST] Reimbursement ${id} posted to Transactions.`);
                }
            }
        }

        await conn.commit();
        res.json({ status: 'success', message: 'Status updated' });
    } catch (error) {
        await conn.rollback();
        console.error('Error updating reimbursement:', error);
        res.status(500).json({ message: 'Failed to update status', error: error.message });
    } finally {
        conn.release();
    }
});

// --- SERVE STATIC FRONTEND & UPLOADS ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Legacy support
app.use('/img', express.static(path.join(__dirname, '../public/img'))); // New Image Path

// Determine where the frontend build is located
// Priority 1: server/public (Vite build output for production)
// Priority 2: ../dist (Local development fallback)
const serverPublicPath = path.join(__dirname, 'public');
const rootDistPath = path.join(__dirname, '../dist');
let frontendPath = null;

if (fs.existsSync(serverPublicPath)) {
    frontendPath = serverPublicPath;
} else if (fs.existsSync(rootDistPath)) {
    frontendPath = rootDistPath;
}

if (frontendPath) {
    console.log(`[INFO] Serving static files from: ${frontendPath}`);
    app.use(express.static(frontendPath));
    
    // SPA Catch-all Route (MUST BE LAST)
    app.get('*', (req, res) => {
        // Skip API routes (let them 404 if not found above)
        if (req.path.startsWith('/api')) {
             return res.status(404).json({ message: 'API endpoint not found' });
        }
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
} else {
    console.log('[WARN] Frontend build not found (neither server/public nor ../dist).');
    app.get('/', (req, res) => res.send('API Server is Running. Frontend build not found. Please run npm run build.'));
}

// --- SYSTEM API ---
app.post('/api/system/db-migrate', async (req, res) => {
    // Tunggu pool max 5 detik
    await waitForPool(5000);
    if (!pool) return res.status(500).json({ success: false, message: 'Database Connection Failed' });

    try {
        await syncDatabaseSchema(pool);
        res.json({ success: true, message: 'Database migration completed successfully' });
    } catch (err) {
        console.error('[MIGRATION ERROR]', err);
        res.status(500).json({ success: false, message: 'Migration failed: ' + err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // Jalankan initDatabase (yang akan panggil syncDatabaseSchema) saat startup
    // Note: initDatabase sudah dipanggil di baris 246 (di level top-level async call pattern), 
    // tapi karena JS async, bisa jadi server listen dulu.
    // Kita biarkan initDatabase berjalan independen.
});
