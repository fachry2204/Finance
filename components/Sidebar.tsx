
import React from 'react';
import { LayoutDashboard, Receipt, FileText, X, PlusCircle, PieChart, Wallet, List, Settings as SettingsIcon } from 'lucide-react';
import { PageView } from '../types';

interface SidebarProps {
  activePage: PageView;
  setActivePage: (page: PageView) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, isOpen, setIsOpen }) => {
  
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
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      {/* Adjusted top position to account for 64px header. Changed bg-slate-900 to bg-white for light theme */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 text-slate-700 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col pt-0`}>
        
        {/* Mobile Close Button Header inside Sidebar */}
        <div className="flex md:hidden items-center justify-end p-4 border-b border-slate-100">
           <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-800">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
          {menuGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">
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
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                          : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
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

        {/* Footer Section */}
        <div className="p-4 text-xs text-center text-slate-400 border-t border-slate-100">
           v1.0.0 Stable
        </div>
      </div>
    </>
  );
};

export default Sidebar;
