
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Journal from './components/Journal';
import ReimbursementPage from './components/Reimbursement';
import Report from './components/Report';
import Settings from './components/Settings';
import Login from './components/Login';
import EmployeeManager from './components/EmployeeManager';
import EmployeeDashboard from './components/EmployeeDashboard';
import SystemUpdater from './components/SystemUpdater';
import { Transaction, Reimbursement, PageView, AppSettings, User, ConnectionStatus } from './types';
import { AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSystemUpdater, setShowSystemUpdater] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CHECKING');

  // App State
  const [activePage, setActivePage] = useState<PageView>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Check LocalStorage for Persisted Login (Session Only)
  useEffect(() => {
      const savedUser = localStorage.getItem('dmasiv_user');
      const savedToken = localStorage.getItem('dmasiv_token');
      if (savedUser && savedToken) {
          setCurrentUser(JSON.parse(savedUser));
          setToken(savedToken);
          setIsLoggedIn(true);
      }
  }, []);

  // --- DATABASE CONNECTION CHECK & AUTO LOGOUT ---
  const checkDbConnection = async () => {
    try {
      const response = await fetch('/api/test-db');
      const data = await response.json();
      
      if (data.status === 'schema_missing') {
          // Database terhubung tapi tabel tidak lengkap -> Trigger Auto Update
          setShowSystemUpdater(true);
          setConnectionStatus('CONNECTED'); // Secara teknis konek, cuma perlu migrasi
          return true;
      }

      const isConnected = data.status === 'success';
      
      if (isConnected) {
        setConnectionStatus('CONNECTED');
        if (showSystemUpdater) setShowSystemUpdater(false);
      } else {
        setConnectionStatus('DB_ERROR');
      }
      return isConnected;
    } catch (e) {
      setConnectionStatus('SERVER_ERROR');
      return false;
    }
  };

  // Poll database connection every 30 seconds
  useEffect(() => {
    checkDbConnection(); // Initial check
    const interval = setInterval(async () => {
      const connected = await checkDbConnection();
      
      // Auto Logout Logic if DB disconnects while logged in
      if (!connected && isLoggedIn) {
        handleLogoutConfirm();
      }
    }, 30000); 

    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // LOGIN HANDLER
  const handleLogin = (user: User, authToken: string) => {
      setCurrentUser(user);
      setToken(authToken);
      setIsLoggedIn(true);
      localStorage.setItem('dmasiv_user', JSON.stringify(user));
      localStorage.setItem('dmasiv_token', authToken);
  };

  // LOGOUT HANDLER
  const handleLogoutConfirm = () => {
      localStorage.removeItem('dmasiv_user');
      localStorage.removeItem('dmasiv_token');
      setIsLoggedIn(false);
      setCurrentUser(null);
      setToken(null);
      setShowLogoutModal(false);
  };

  // --- HELPER FETCH WITH AUTH ---
  const authFetch = async (url: string, options: RequestInit = {}) => {
      if (!token) return null;
      
      const headers = {
          ...options.headers,
          'Authorization': `Bearer ${token}`
      };

      try {
          const response = await fetch(url, { ...options, headers });
          
          if (response.status === 401 || response.status === 403) {
              handleLogoutConfirm(); // Token Expired
              return null;
          }
          
          return response;
      } catch (e) {
          console.error("Fetch Error:", e);
          return null;
      }
  };

  // --- APP SETTINGS STATE (No LocalStorage) ---
  const [appSettings, setAppSettings] = useState<AppSettings>({
    categories: [], // Loaded from DB
    companies: [], // Loaded from DB
    database: { host: '', user: '', password: '', name: '', port: '3306', isConnected: false },
    drive: { isConnected: false, selectedFolderId: '', selectedFolderName: '', autoUpload: false }
  });

  const handleUpdateSettings = (newSettings: AppSettings) => setAppSettings(newSettings);

  // --- DATA STATE & API ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);

  const safeFetchJson = async (url: string) => {
    const response = await authFetch(url);
    if (!response) return null;
    const text = await response.text();
    try { return JSON.parse(text); } catch (e) { return null; }
  };

  useEffect(() => {
    if (isLoggedIn && connectionStatus === 'CONNECTED' && token && currentUser?.role !== 'employee') {
        const fetchData = async () => {
          // 1. Transactions
          const txData = await safeFetchJson('/api/transactions');
          if (Array.isArray(txData)) setTransactions(txData);
          
          // 2. Reimbursements
          const rmData = await safeFetchJson('/api/reimbursements');
          if (Array.isArray(rmData)) setReimbursements(rmData);
          
          // 3. Categories from DB (Critical for Sync)
          const catData = await safeFetchJson('/api/categories');
          
          // 4. Companies from DB
          const compData = await safeFetchJson('/api/companies');

          // 5. Other Settings from DB
          const settingsData = await safeFetchJson('/api/settings');

          setAppSettings(prev => ({ 
            ...prev, 
            categories: Array.isArray(catData) ? catData : [],
            companies: Array.isArray(compData) ? compData : [],
            drive: settingsData?.drive || prev.drive,
            database: { ...prev.database, isConnected: true } 
          }));
        };
        fetchData();
    }
  }, [isLoggedIn, connectionStatus, token, currentUser]);

  // --- TRANSACTION HANDLERS ---
  const handleAddTransaction = async (transaction: Transaction) => {
    setTransactions(prev => [transaction, ...prev]);
    await authFetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transaction) });
  };

  const handleDeleteTransaction = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    await authFetch(`/api/transactions/${id}`, { method: 'DELETE' });
  };

  const handleUpdateTransaction = async (transaction: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === transaction.id ? transaction : t));
    await authFetch(`/api/transactions/${transaction.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transaction) });
  };

  // --- REIMBURSEMENT HANDLERS ---
  const handleAddReimbursement = async (reimbursement: Reimbursement) => {
    setReimbursements(prev => [reimbursement, ...prev]);
    await authFetch('/api/reimbursements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reimbursement) });
  };

  const handleDeleteReimbursement = async (id: string) => {
    setReimbursements(prev => prev.filter(r => r.id !== id));
    await authFetch(`/api/reimbursements/${id}`, { method: 'DELETE' });
  };

  const handleUpdateReimbursementDetails = async (reimbursement: Reimbursement) => {
    setReimbursements(prev => prev.map(r => r.id === reimbursement.id ? reimbursement : r));
    await authFetch(`/api/reimbursements/${reimbursement.id}/details`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reimbursement) });
  };

  const handleUpdateReimbursementStatus = async (updatedReimb: Reimbursement) => {
    setReimbursements(prev => prev.map(r => r.id === updatedReimb.id ? updatedReimb : r));
    await authFetch(`/api/reimbursements/${updatedReimb.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: updatedReimb.status, rejectionReason: updatedReimb.rejectionReason }) });
  };

  const renderContent = () => {
    const commonProps = { authToken: token };

    switch (activePage) {
      case 'DASHBOARD': return <Dashboard transactions={transactions} reimbursements={reimbursements} isDarkMode={false} filterType="ALL" />;
      case 'STAT_EXPENSE': return <Dashboard transactions={transactions} reimbursements={reimbursements} isDarkMode={false} filterType="EXPENSE" />;
      case 'ADD_EXPENSE': return <Journal onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} onUpdateTransaction={handleUpdateTransaction} transactions={transactions} defaultType="PENGELUARAN" filterType="PENGELUARAN" initialView="LIST" categories={appSettings.categories} companies={appSettings.companies} {...commonProps} />;
      case 'REIMBURSE': return <ReimbursementPage reimbursements={reimbursements} onAddReimbursement={handleAddReimbursement} onDeleteReimbursement={handleDeleteReimbursement} onUpdateReimbursementDetails={handleUpdateReimbursementDetails} onUpdateReimbursement={handleUpdateReimbursementStatus} categories={appSettings.categories} companies={appSettings.companies} {...commonProps} />;
      case 'REPORT_EXPENSE': return <Report transactions={transactions} reimbursements={reimbursements} fixedFilterType="PENGELUARAN" categories={appSettings.categories.map(c => c.name)} />;
      case 'ADD_INCOME': return <Journal onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} onUpdateTransaction={handleUpdateTransaction} transactions={transactions} defaultType="PEMASUKAN" filterType="PEMASUKAN" initialView="LIST" categories={appSettings.categories} companies={appSettings.companies} {...commonProps} />;
      case 'DASHBOARD_INCOME': return <Dashboard transactions={transactions} reimbursements={reimbursements} isDarkMode={false} filterType="INCOME" />;
      case 'STAT_INCOME': return <Report transactions={transactions} reimbursements={reimbursements} fixedFilterType="PEMASUKAN" categories={appSettings.categories.map(c => c.name)} />;
      case 'JOURNAL_LIST': return <Journal onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} onUpdateTransaction={handleUpdateTransaction} transactions={transactions} defaultType="PENGELUARAN" initialView="LIST" categories={appSettings.categories} companies={appSettings.companies} {...commonProps} />;
      case 'REPORT': return <Report transactions={transactions} reimbursements={reimbursements} categories={appSettings.categories.map(c => c.name)} />;
      case 'EMPLOYEES': return <EmployeeManager {...commonProps} />;
      case 'SETTINGS': return <Settings settings={appSettings} onUpdateSettings={handleUpdateSettings} {...commonProps} />;
      default: return <Dashboard transactions={transactions} reimbursements={reimbursements} isDarkMode={false} />;
    }
  };

  // --- RENDER LOGIC ---

  if (!isLoggedIn) {
      return <Login onLogin={handleLogin} connectionStatus={connectionStatus} />;
  }

  // IF ROLE IS EMPLOYEE, SHOW MOBILE DASHBOARD
  if (currentUser?.role === 'employee') {
      return (
          <>
            <EmployeeDashboard user={currentUser} onLogout={() => setShowLogoutModal(true)} />
             {showLogoutModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
                    <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                    <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Konfirmasi Keluar</h3>
                    <p className="text-slate-500 mb-6">Anda yakin ingin keluar?</p>
                    <div className="flex gap-3 justify-center">
                    <button onClick={() => setShowLogoutModal(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors">Batal</button>
                    <button onClick={handleLogoutConfirm} className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 shadow-md shadow-rose-200 transition-colors">Keluar</button>
                    </div>
                </div>
                </div>
            )}
          </>
      );
  }

  // DEFAULT ADMIN VIEW
  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      <Header 
        user={currentUser} 
        onLogoutClick={() => setShowLogoutModal(true)} 
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        connectionStatus={connectionStatus}
      />
      <div className="flex flex-1 pt-16 overflow-hidden">
        <Sidebar activePage={activePage} setActivePage={setActivePage} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin">
                <div className="max-w-7xl mx-auto">
                    {renderContent()}
                </div>
            </main>
            <div className="shrink-0 z-20">
              <Footer />
            </div>
        </div>
      </div>

      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Konfirmasi Keluar</h3>
            <p className="text-slate-500 mb-6">Apakah Anda yakin ingin keluar dari sistem?</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowLogoutModal(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors">Batal</button>
              <button onClick={handleLogoutConfirm} className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 shadow-md shadow-rose-200 transition-colors">Ya, Keluar</button>
            </div>
          </div>
        </div>
      )}

      {showSystemUpdater && (
        <SystemUpdater 
            onComplete={() => {
                setShowSystemUpdater(false);
                checkDbConnection();
            }} 
        />
      )}
    </div>
  );
};

export default App;
