
import React from 'react';
import { LayoutDashboard, Receipt, FileText, X, Sun, Moon, PlusCircle, PieChart, Wallet, CreditCard, List, Settings as SettingsIcon } from 'lucide-react';
import { PageView } from '../types';

interface SidebarProps {
  activePage: PageView;
  setActivePage: (page: PageView) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, isOpen, setIsOpen, theme, toggleTheme }) => {
  
  const menuGroups = [
    {
      title: 'Menu Utama',
      items: [
        { id: 'DASHBOARD' as PageView, label: 'Dashboard', icon: LayoutDashboard },
        { id: 'JOURNAL_LIST' as PageView, label: 'Semua Jurnal', icon: List },
        { id: 'REPORT' as PageView, label: 'Laporan Umum', icon: FileText },
      ]
    },
    {
      title: 'Pengeluaran',
      items: [
        { id: 'STAT_EXPENSE' as PageView, label: 'Dashboard Cash Out', icon: PieChart },
        { id: 'ADD_EXPENSE' as PageView, label: 'Tambah Pengeluaran', icon: PlusCircle },
        { id: 'REIMBURSE' as PageView, label: 'Tambah Reimburse', icon: Receipt },
        { id: 'REPORT_EXPENSE' as PageView, label: 'Laporan Pengeluaran', icon: FileText },
      ]
    },
    {
      title: 'Pemasukan',
      items: [
        { id: 'ADD_INCOME' as PageView, label: 'Tambah Pemasukan', icon: Wallet },
        { id: 'STAT_INCOME' as PageView, label: 'Statistik Pemasukan', icon: PieChart },
      ]
    },
    {
      title: 'Lainnya',
      items: [
        { id: 'SETTINGS' as PageView, label: 'Pengaturan', icon: SettingsIcon },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 dark:bg-slate-950 text-white transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <div className="flex items-center justify-between p-6 border-b border-slate-700 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-xl text-white">R</div>
            <span className="text-xl font-bold tracking-wide">KEUANGAN RDR</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
          {menuGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActivePage(item.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm ${
                        isActive 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                          : 'text-slate-400 hover:bg-slate-800 dark:hover:bg-slate-900 hover:text-white'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-700 dark:border-slate-800 mt-auto">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between mb-6 bg-slate-800 dark:bg-slate-900 p-1.5 rounded-lg">
            <button
              onClick={toggleTheme}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-colors ${theme === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              <Sun size={14} /> Light
            </button>
            <button
              onClick={toggleTheme}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              <Moon size={14} /> Dark
            </button>
          </div>

          <div className="flex items-center gap-3">
            <img src="https://picsum.photos/40/40" alt="Admin" className="w-10 h-10 rounded-full border-2 border-slate-600" />
            <div>
              <p className="text-sm font-semibold text-white">Admin Keuangan</p>
              <p className="text-xs text-slate-400">Online</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
