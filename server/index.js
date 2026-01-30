
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

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// --- SERVE STATIC FRONTEND (PRODUCTION) ---
// Mencari folder 'dist' (hasil build vite) di folder root (satu tingkat di atas folder server ini)
const distPath = path.resolve(__dirname, '../dist');

// Jika folder dist ada, layani file statisnya (CSS, JS, Images)
if (fs.existsSync(distPath)) {
    console.log(`[INFO] Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
} else {
    console.warn(`[WARN] Folder build '../dist' tidak ditemukan. Pastikan Anda sudah menjalankan 'npm run build'.`);
}

// --- DATABASE CONNECTION ---
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'keuangan_rdr'
};

let pool;
try {
    pool = mysql.createPool(dbConfig);
    console.log('Database configuration loaded.');
} catch (err) {
    console.error('Database configuration error:', err);
}

// --- GOOGLE DRIVE OAUTH2 SETUP ---
let oauth2Client = null;
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
} else {
    console.warn('[WARN] Google OAuth Credentials belum diset di .env');
}

const upload = multer({ dest: 'uploads/' });

// --- API ROUTES ---

// 1. TEST DB CONNECTION
app.get('/api/test-db', async (req, res) => {
    // Set Header explicit JSON agar frontend tidak bingung
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

// 2. GOOGLE AUTH START
app.get('/auth/google', (req, res) => {
    if (!oauth2Client) return res.status(500).json({ message: 'Google Client ID/Secret belum dikonfigurasi.' });

    const scopes = ['https://www.googleapis.com/auth/drive.file'];
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });
    res.json({ url });
});

// 3. GOOGLE AUTH CALLBACK
app.get('/auth/google/callback', async (req, res) => {
    if (!oauth2Client) return res.status(500).send('OAuth Client not configured');
    
    const { code } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync('tokens.json', JSON.stringify(tokens));
        res.redirect('/settings?status=drive_connected');
    } catch (error) {
        console.error('Error retrieving access token', error);
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

// 4. UPLOAD TO DRIVE
app.post('/api/upload-drive', upload.single('file'), async (req, res) => {
    if (!loadTokens()) {
        return res.status(401).json({ message: 'Google Drive belum terhubung.' });
    }

    const { folderId } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    try {
        const fileMetadata = {
            name: file.originalname,
            parents: folderId && folderId !== 'root' ? [folderId] : []
        };
        const media = {
            mimeType: file.mimetype,
            body: fs.createReadStream(file.path)
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink, webContentLink'
        });

        fs.unlinkSync(file.path);

        res.json({
            status: 'success',
            fileId: response.data.id,
            url: response.data.webViewLink
        });
    } catch (error) {
        console.error('Drive Upload Error:', error);
        res.status(500).json({ message: 'Upload ke Drive gagal', error: error.message });
    }
});

// --- CATCH ALL ROUTE (HANDLE REACT ROUTER) ---
// Route ini harus diletakkan PALING BAWAH, setelah semua route API.
// Fungsinya: Jika request bukan ke /api, maka kembalikan file index.html milik React.
if (fs.existsSync(distPath)) {
    app.get('*', (req, res) => {
        // Jangan intercept request API yang salah ketik (biarkan 404 json)
        if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
            return res.status(404).json({ message: 'API Endpoint Not Found' });
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    // Fallback jika belum di-build
    app.get('/', (req, res) => {
        res.send(`
            <h1>Backend Server Berjalan</h1>
            <p>Namun folder <code>dist</code> (Frontend) tidak ditemukan.</p>
            <p>Silakan jalankan <code>npm run build</code> di root project Anda, lalu restart server.</p>
        `);
    });
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
