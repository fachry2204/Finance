
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('INCOME', 'EXPENSE') NOT NULL DEFAULT 'EXPENSE',
    company_id INT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    UNIQUE KEY uniq_category_type_company (name, type, company_id)
);

-- Upgrade: ensure 'type' column exists on legacy databases
ALTER TABLE categories ADD COLUMN IF NOT EXISTS type ENUM('INCOME', 'EXPENSE') NOT NULL DEFAULT 'EXPENSE';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS company_id INT NULL;
-- Attempt to drop old unique constraint on name if it exists (might fail if not exists, but that's fine in sync)
-- We use a stored procedure or just try/catch block in application code, but here we can try:
-- ALTER TABLE categories DROP INDEX name; 
-- (Commented out because it might stop execution if fails. We'll handle index migration via application code or manual query if needed, 
--  but better: we can try to add the new index. If old one exists, it might conflict on data but not schema definition if we don't drop it.
--  Actually, if 'name' is UNIQUE, we can't have duplicate names even with different company_id.
--  So we MUST drop the 'name' index.)

-- Safe index migration usually requires checking if index exists. 
-- For now, we rely on the server startup script to handle complex migrations or we just assume this is a dev env.
-- Let's add the column first.

UPDATE categories SET type = 'EXPENSE' WHERE type IS NULL OR type = '';

CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    date DATE NOT NULL,
    type ENUM('PEMASUKAN', 'PENGELUARAN') NOT NULL,
    expense_type ENUM('NORMAL', 'REIMBURSE'),
    category VARCHAR(255),
    company_id INT,
    activity_name VARCHAR(255),
    description TEXT,
    grand_total DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transaction_items (
    id VARCHAR(50) PRIMARY KEY,
    transaction_id VARCHAR(50),
    name VARCHAR(255),
    qty INT,
    price DECIMAL(15, 2),
    total DECIMAL(15, 2),
    file_url TEXT,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reimbursements (
    id VARCHAR(50) PRIMARY KEY,
    date DATE NOT NULL,
    requestor_name VARCHAR(255),
    category VARCHAR(255),
    company_id INT,
    activity_name VARCHAR(255),
    description TEXT,
    grand_total DECIMAL(15, 2) DEFAULT 0,
    status ENUM('PENDING', 'PROSES', 'BERHASIL', 'DITOLAK') DEFAULT 'PENDING',
    transfer_proof_url TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reimbursement_items (
    id VARCHAR(50) PRIMARY KEY,
    reimbursement_id VARCHAR(50),
    name VARCHAR(255),
    qty INT,
    price DECIMAL(15, 2),
    total DECIMAL(15, 2),
    file_url TEXT,
    FOREIGN KEY (reimbursement_id) REFERENCES reimbursements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin'
);

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

CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT
);

-- Seed Categories
INSERT IGNORE INTO categories (name, type) VALUES 
('Operasional', 'EXPENSE'), 
('Transportasi', 'EXPENSE'), 
('Makan & Minum', 'EXPENSE'), 
('ATK', 'EXPENSE'), 
('Marketing', 'EXPENSE'), 
('Gaji', 'EXPENSE'), 
('Maintenance', 'EXPENSE'), 
('Project Alpha', 'EXPENSE');

INSERT IGNORE INTO categories (name, type) VALUES 
('Penjualan', 'INCOME'), 
('Jasa', 'INCOME'), 
('Bunga', 'INCOME'), 
('Lain-lain', 'INCOME');

-- Indexes are handled by server/index.js migration logic to ensure safety
-- ALTER TABLE categories DROP INDEX name;
-- ALTER TABLE categories ADD UNIQUE KEY uniq_category_type (name, type);

-- Seed Default Admin (Password: admin) - SHA256 hash
INSERT IGNORE INTO users (username, password, role) VALUES ('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'admin');

-- Seed Default Employee (User: pegawai, Pass: pegawai)
INSERT IGNORE INTO employees (name, position, phone, email, username, password) VALUES ('Budi Santoso', 'Staff Operasional', '08123456789', 'budi@dmasiv.id', 'pegawai', '04784992524a87754b5dfd4d29a008c37d4529304193309a962a984485542289');
