
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Journal from './components/Journal';
import ReimbursementPage from './components/Reimbursement';
import Report from './components/Report';
import Settings from './components/Settings';
import { Transaction, Reimbursement, PageView, AppSettings } from './types';
import { Menu } from 'lucide-react';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageView>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme as 'light' | 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // --- APP SETTINGS STATE (Categories, DB, Drive) ---
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      return JSON.parse(saved);
    }
    // Default Settings
    return {
      categories: [
        'Operasional', 
        'Transportasi', 
        'Makan & Minum', 
        'ATK', 
        'Marketing', 
        'Gaji', 
        'Maintenance',
        'Project Alpha'
      ],
      database: {
        host: '',
        user: '',
        password: '',
        name: '',
        port: '3306',
        isConnected: false
      },
      drive: {
        isConnected: false,
        selectedFolderId: '',
        selectedFolderName: '',
        autoUpload: false
      }
    };
  });

  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
  }, [appSettings]);

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
  };

  // --- DATA STATE & API INTEGRATION ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);

  // Fetch Data on Load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const txRes = await fetch('/api/transactions');
        const txData = await txRes.json();
        if (Array.isArray(txData)) setTransactions(txData);

        const rmRes = await fetch('/api/reimbursements');
        const rmData = await rmRes.json();
        if (Array.isArray(rmData)) setReimbursements(rmData);
      } catch (error) {
        console.error("Gagal mengambil data:", error);
      }
    };
    fetchData();
  }, []);

  const handleAddTransaction = async (transaction: Transaction) => {
    try {
       // Optimistic UI Update
       setTransactions(prev => [transaction, ...prev]);

       const res = await fetch('/api/transactions', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(transaction)
       });
       
       if (!res.ok) {
         throw new Error('Gagal menyimpan ke server');
       }
    } catch (error) {
      alert("Gagal menyimpan transaksi ke database.");
      console.error(error);
    }
  };

  const handleAddReimbursement = async (reimbursement: Reimbursement) => {
    try {
      setReimbursements(prev => [reimbursement, ...prev]);
      
      const res = await fetch('/api/reimbursements', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(reimbursement)
      });
      if (!res.ok) throw new Error('Gagal menyimpan reimburse');

    } catch (error) {
       alert("Gagal menyimpan reimburse ke database.");
       console.error(error);
    }
  };

  const handleUpdateReimbursement = async (updatedReimb: Reimbursement) => {
    try {
      setReimbursements(prev => prev.map(r => r.id === updatedReimb.id ? updatedReimb : r));
      
      const res = await fetch(`/api/reimbursements/${updatedReimb.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: updatedReimb.status,
          rejectionReason: updatedReimb.rejectionReason
        })
      });

      if (!res.ok) throw new Error('Gagal update status');
    } catch (error) {
      alert("Gagal mengupdate status di database.");
      console.error(error);
    }
  };

  const renderContent = () => {
    switch (activePage) {
      case 'DASHBOARD':
        return <Dashboard transactions={transactions} reimbursements={reimbursements} isDarkMode={theme === 'dark'} filterType="ALL" />;
      
      // Expense Category Views
      case 'STAT_EXPENSE':
        return <Dashboard transactions={transactions} reimbursements={reimbursements} isDarkMode={theme === 'dark'} filterType="EXPENSE" />;
      case 'ADD_EXPENSE':
        return <Journal onAddTransaction={handleAddTransaction} transactions={transactions} defaultType="PENGELUARAN" filterType="PENGELUARAN" initialView="LIST" categories={appSettings.categories} />;
      case 'REIMBURSE':
        return <ReimbursementPage reimbursements={reimbursements} onAddReimbursement={handleAddReimbursement} onUpdateReimbursement={handleUpdateReimbursement} categories={appSettings.categories} />;
      case 'REPORT_EXPENSE':
        return <Report transactions={transactions} reimbursements={reimbursements} fixedFilterType="PENGELUARAN" />;
      
      // Income Category Views
      case 'ADD_INCOME':
        return <Journal onAddTransaction={handleAddTransaction} transactions={transactions} defaultType="PEMASUKAN" filterType="PEMASUKAN" initialView="LIST" categories={appSettings.categories} />;
      case 'STAT_INCOME':
        return <Dashboard transactions={transactions} reimbursements={reimbursements} isDarkMode={theme === 'dark'} filterType="INCOME" />;
      
      // General Views
      case 'JOURNAL_LIST':
        return <Journal onAddTransaction={handleAddTransaction} transactions={transactions} defaultType="PENGELUARAN" initialView="LIST" categories={appSettings.categories} />;
      case 'REPORT':
        return <Report transactions={transactions} reimbursements={reimbursements} />;
      
      // Settings
      case 'SETTINGS':
        return <Settings settings={appSettings} onUpdateSettings={handleUpdateSettings} />;
        
      default:
        return <Dashboard transactions={transactions} reimbursements={reimbursements} isDarkMode={theme === 'dark'} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between p-4 z-10">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
            <span className="text-blue-600 dark:text-blue-400">RDR</span> Finance
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
            <Menu size={24} />
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
          <div className="max-w-7xl mx-auto">
             {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
