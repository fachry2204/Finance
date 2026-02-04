
export type TransactionType = 'PEMASUKAN' | 'PENGELUARAN';
export type ExpenseType = 'NORMAL' | 'REIMBURSE';

export interface ItemDetail {
  id: string;
  name: string; // Keterangan untuk reimburse
  qty: number;
  price: number;
  total: number;
  file?: File | null; // Simulasikan upload
  filePreviewUrl?: string;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  expenseType?: ExpenseType; // Only if type is PENGELUARAN
  category: string;
  companyId: number; // Mandatory: PT Selection
  activityName: string;
  description: string;
  items: ItemDetail[];
  grandTotal: number;
  timestamp: number; // For sorting
}

export type ReimbursementStatus = 'PENDING' | 'PROSES' | 'BERHASIL' | 'DITOLAK';

export type ConnectionStatus = 'CONNECTED' | 'DB_ERROR' | 'SERVER_ERROR' | 'CHECKING';

export interface Reimbursement {
  id: string;
  date: string;
  requestorName: string;
  category: string;
  companyId: number; // Mandatory: PT Selection
  activityName: string;
  description: string;
  items: ItemDetail[];
  grandTotal: number;
  status: ReimbursementStatus;
  transferProof?: File | null; // Bukti Transfer admin
  transferProofUrl?: string;
  rejectionReason?: string; // Alasan penolakan jika status DITOLAK
  timestamp: number;
}

export type PageView = 
  | 'DASHBOARD' 
  | 'ADD_EXPENSE' 
  | 'REIMBURSE' 
  | 'STAT_EXPENSE' 
  | 'REPORT_EXPENSE' 
  | 'ADD_INCOME' 
  | 'DASHBOARD_INCOME'
  | 'STAT_INCOME' 
  | 'JOURNAL_LIST' 
  | 'REPORT'
  | 'EMPLOYEES' // New Page
  | 'SETTINGS'
  | 'COMPANIES'; // New Page for Company Management

// --- NEW CONFIGURATION TYPES ---

export interface DatabaseConfig {
  host: string;
  user: string;
  password: string;
  name: string;
  port: string;
  isConnected: boolean;
}

export interface GoogleDriveConfig {
  isConnected: boolean;
  selectedFolderId: string;
  selectedFolderName: string;
  autoUpload: boolean;
  email?: string;
}

export interface Category {
  id?: number;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  company_id?: number | null;
  company_name?: string;
}

export interface AppSettings {
  categories: Category[];
  companies: Company[];
  database: DatabaseConfig;
  drive: GoogleDriveConfig;
}

export interface Company {
  id: number;
  name: string;
}

export interface Employee {
  id: number;
  name: string;
  position: string;
  phone: string;
  email: string;
  username: string;
  password?: string;
}

export interface User {
  id: number;
  username: string;
  role: string;
  details?: Employee; // For Employee Role
}
