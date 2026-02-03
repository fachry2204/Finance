
import React from 'react';
import { LogOut, User as UserIcon, Calendar, Database } from 'lucide-react';
import { User, ConnectionStatus } from '../types';
import { getCurrentDateFormatted } from '../utils';

interface HeaderProps {
  user: User | null;
  onLogoutClick: () => void;
  toggleSidebar: () => void;
  connectionStatus: ConnectionStatus;
}

const Header: React.FC<HeaderProps> = ({ user, onLogoutClick, toggleSidebar, connectionStatus }) => {
  
  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'CONNECTED': return { text: 'DB Online', color: 'bg-emerald-50 border-emerald-100 text-emerald-700', dot: 'bg-emerald-500 animate-pulse' };
      case 'DB_ERROR': return { text: 'DB Error', color: 'bg-orange-50 border-orange-100 text-orange-700', dot: 'bg-orange-500' };
      case 'SERVER_ERROR': return { text: 'Node JS Mati', color: 'bg-rose-50 border-rose-100 text-rose-700', dot: 'bg-rose-500' };
      default: return { text: 'Unknown', color: 'bg-slate-50 border-slate-100 text-slate-500', dot: 'bg-slate-400' };
    }
  };
  
  const statusConfig = getStatusConfig();

  return (
    <header className="h-16 bg-white border-b border-slate-200 fixed top-0 left-0 right-0 z-40 px-4 md:px-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <img 
          src="https://fin.dmasiv.id/img/logodmsv.png" 
          alt="D'MASIV Finance" 
          className="h-10 w-auto object-contain"
        />
        <span className="font-bold text-lg text-slate-800 tracking-tight hidden md:block">KEUANGAN <span className="text-blue-600">D'MASIV</span></span>
      </div>

      <div className="flex items-center gap-4">
        {/* Date Display - Hidden on mobile */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
           <Calendar size={14} className="text-slate-400" />
           {getCurrentDateFormatted()}
        </div>

        {/* Database Status Indicator */}
        <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${statusConfig.color}`} title={statusConfig.text}>
           <Database size={14} />
           <span className="flex items-center gap-1.5">
             <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`}></span>
             {statusConfig.text}
           </span>
        </div>

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
