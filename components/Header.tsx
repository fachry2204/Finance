
import React from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLogoutClick: () => void;
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogoutClick, toggleSidebar }) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 fixed top-0 left-0 right-0 z-40 px-4 md:px-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-sm">R</div>
        <span className="font-bold text-lg text-slate-800 tracking-tight hidden md:block">KEUANGAN <span className="text-blue-600">RDR</span></span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <UserIcon size={16} />
          </div>
          <div className="hidden md:block pr-2">
            <p className="text-sm font-semibold text-slate-700">{user?.username || 'Admin'}</p>
            <p className="text-[10px] text-slate-500 uppercase leading-none">{user?.role || 'User'}</p>
          </div>
        </div>
        
        <button 
          onClick={onLogoutClick}
          className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          title="Keluar Sistem"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
