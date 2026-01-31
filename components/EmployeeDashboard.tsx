
import React from 'react';
import { User, LogOut, Bell, Briefcase, Phone, Mail, FileText, Calendar, CheckCircle } from 'lucide-react';
import { User as UserType } from '../types';
import { getCurrentDateFormatted } from '../utils';

interface EmployeeDashboardProps {
  user: UserType;
  onLogout: () => void;
}

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ user, onLogout }) => {
  const employeeDetails = user.details;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* Mobile Header */}
      <div className="bg-blue-600 text-white p-6 pb-12 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
           <Briefcase size={120} />
        </div>
        
        <div className="flex justify-between items-start mb-6 relative z-10">
           <div>
              <p className="text-blue-100 text-sm mb-1">{getCurrentDateFormatted()}</p>
              <h1 className="text-2xl font-bold">Halo, {employeeDetails?.name || user.username}</h1>
              <p className="text-blue-100 opacity-90">{employeeDetails?.position || 'Staff'}</p>
           </div>
           <button onClick={onLogout} className="bg-white/20 p-2 rounded-full hover:bg-white/30 backdrop-blur-sm transition-colors">
              <LogOut size={20} />
           </button>
        </div>

        {/* Quick Stats / Highlights */}
        <div className="flex gap-4 relative z-10">
           <div className="bg-white/20 backdrop-blur-md rounded-xl p-3 flex-1">
              <p className="text-xs text-blue-100 mb-1">Status</p>
              <div className="flex items-center gap-1 font-bold">
                 <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div> Aktif
              </div>
           </div>
           <div className="bg-white/20 backdrop-blur-md rounded-xl p-3 flex-1">
              <p className="text-xs text-blue-100 mb-1">Notifikasi</p>
              <div className="flex items-center gap-1 font-bold">
                 <Bell size={14} /> 0 Baru
              </div>
           </div>
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-20 space-y-6">
         
         {/* Profile Card */}
         <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
               <User size={18} className="text-blue-600"/> Data Diri
            </h3>
            <div className="space-y-3">
               <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                     <Briefcase size={18} />
                  </div>
                  <div>
                     <p className="text-xs text-slate-500">Jabatan</p>
                     <p className="font-medium text-slate-800">{employeeDetails?.position || '-'}</p>
                  </div>
               </div>
               <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                     <Phone size={18} />
                  </div>
                  <div>
                     <p className="text-xs text-slate-500">Telepon / WhatsApp</p>
                     <p className="font-medium text-slate-800">{employeeDetails?.phone || '-'}</p>
                  </div>
               </div>
               <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                     <Mail size={18} />
                  </div>
                  <div className="overflow-hidden">
                     <p className="text-xs text-slate-500">Email</p>
                     <p className="font-medium text-slate-800 truncate">{employeeDetails?.email || '-'}</p>
                  </div>
               </div>
            </div>
         </div>

         {/* Announcements / Tasks Placeholder */}
         <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-100">
             <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
               <FileText size={18} className="text-amber-500"/> Informasi
            </h3>
            <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-500 text-sm">
               <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
               <p>Belum ada pengumuman atau tugas khusus untuk Anda saat ini.</p>
            </div>
         </div>

      </div>

      {/* Simple Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 flex justify-around text-xs font-medium text-slate-400 z-50">
         <button className="flex flex-col items-center gap-1 text-blue-600">
            <User size={20} />
            <span>Profil</span>
         </button>
         <button className="flex flex-col items-center gap-1 hover:text-slate-600">
            <CheckCircle size={20} />
            <span>Tugas</span>
         </button>
         <button className="flex flex-col items-center gap-1 hover:text-slate-600">
            <Bell size={20} />
            <span>Info</span>
         </button>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
