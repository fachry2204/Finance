
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
import { Transaction, Reimbursement, PageView, AppSettings, User } from './types';
import { AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // App State
  const [activePage, setActivePage] = useState<PageView>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Check LocalStorage for Persisted Login
  useEffect(() => {
      const savedUser = localStorage.getItem('rdr_user');
      if (savedUser) {
          setCurrentUser(JSON.parse(savedUser));
          setIsLoggedIn(true);
      }
  }, []);

  const handleLogin = (user: User) => {
      setCurrentUser(user);
      setIsLoggedIn(true);
      localStorage.setItem('rdr_user', JSON.stringify(user));
  };

  const handleLogoutConfirm = () => {
      localStorage.removeItem('rdr_user');
      setIsLoggedIn(false);
      setCurrentUser(null);
      setShowLogoutModal(false);
  };

  // --- APP SETTINGS STATE ---
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('appSettings');
    if (saved) return JSON.parse(saved);
    return {
      categories: ['Operasional', 'Transportasi', 'Makan & Minum', 'ATK', 'Marketing', 'Gaji', 'Maintenance', 'Project Alpha'],
      database: { host: '', user: '', password: '', name: '', port: '3306', isConnected: false },
      drive: { isConnected: false, selectedFolderId: '', selectedFolderName: '', autoUpload: false }
    };
  });

  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
  }, [appSettings]);

  const handleUpdateSettings = (newSettings: AppSettings) => setAppSettings(newSettings);

  // --- DATA STATE & API ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);

  const safeFetchJson = async (url: string) => {
    try {
      const response = await fetch(url);
      const text = await response.text();
      try { return JSON.parse(text); } catch (e) { return null; }
    } catch (e) { return null; }
  };

  useEffect(() => {
    if (isLoggedIn) {
        const fetchData = async () => {
        const txData = await safeFetchJson('/api/transactions');
        if (Array.isArray(txData)) setTransactions(txData);
        const rmData = await safeFetchJson('/api/reimbursements');
        if (Array.isArray(rmData)) setReimbursements(rmData);
        };
        fetchData();
    }
  }, [isLoggedIn]);

  const handleAddTransaction = async (transaction: Transaction) => {
    setTransactions(prev => [transaction, ...prev]);
    await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transaction) });
  };

  const handleAddReimbursement = async (reimbursement: Reimbursement) => {
    setReimbursements(prev => [reimbursement, ...prev]);
    await fetch('/api/reimbursements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reimbursement) });
  };

  const handleUpdateReimbursement = async (updatedReimb: Reimbursement) => {
    setReimbursements(prev => prev.map(r => r.id === updatedReimb.id ? updatedReimb : r));
    await fetch(`/api/reimbursements/${updatedReimb.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: updatedReimb.status, rejectionReason: updatedReimb.rejectionReason }) });
  };

  const renderContent = () => {
    switch (activePage) {
      case 'DASHBOARD': return <Dashboard transactions={transactions} reimbursements={reimbursements} isDarkMode={false} filterType="ALL" />;
      case 'STAT_EXPENSE': return <Dashboard transactions={transactions} reimbursements={reimbursements} isDarkMode={false} filterType="EXPENSE" />;
      case 'ADD_EXPENSE': return <Journal onAddTransaction={handleAddTransaction} transactions={transactions} defaultType="PENGELUARAN" filterType="PENGELUARAN" initialView="LIST" categories={appSettings.categories} />;
      case 'REIMBURSE': return <ReimbursementPage reimbursements={reimbursements} onAddReimbursement={handleAddReimbursement} onUpdateReimbursement={handleUpdateReimbursement} categories={appSettings.categories} />;
      case 'REPORT_EXPENSE': return <Report transactions={transactions} reimbursements={reimbursements} fixedFilterType="PENGELUARAN" />;
      case 'ADD_INCOME': return <Journal onAddTransaction={handleAddTransaction} transactions={transactions} defaultType="PEMASUKAN" filterType="PEMASUKAN" initialView="LIST" categories={appSettings.categories} />;
      case 'STAT_INCOME': return <Dashboard transactions={transactions} reimbursements={reimbursements} isDarkMode={false} filterType="INCOME" />;
      case 'JOURNAL_LIST': return <Journal onAddTransaction={handleAddTransaction} transactions={transactions} defaultType="PENGELUARAN" initialView="LIST" categories={appSettings.categories} />;
      case 'REPORT': return <Report transactions={transactions} reimbursements={reimbursements} />;
      case 'SETTINGS': return <Settings settings={appSettings} onUpdateSettings={handleUpdateSettings} />;
      default: return <Dashboard transactions={transactions} reimbursements={reimbursements} isDarkMode={false} />;
    }
  };

  if (!isLoggedIn) {
      return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* 1. Header (Fixed Top) */}
      <Header 
        user={currentUser} 
        onLogoutClick={() => setShowLogoutModal(true)} 
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* 2. Main Layout (Below Header) */}
      <div className="flex flex-1 pt-16 overflow-hidden">
        
        {/* Sidebar */}
        <Sidebar 
          activePage={activePage} 
          setActivePage={setActivePage} 
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin">
                <div className="max-w-7xl mx-auto min-h-[calc(100vh-160px)]">
                    {renderContent()}
                </div>
                {/* Footer attached to bottom of scrollable content area if content is short, or scrolls with it */}
                <div className="mt-8">
                    <Footer />
                </div>
            </main>
        </div>
      </div>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Konfirmasi Keluar</h3>
            <p className="text-slate-500 mb-6">Apakah Anda yakin ingin keluar dari sistem?</p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setShowLogoutModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleLogoutConfirm}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 shadow-md shadow-rose-200 transition-colors"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
