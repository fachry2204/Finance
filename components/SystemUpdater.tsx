import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, AlertTriangle, Loader, RefreshCw } from 'lucide-react';

interface SystemUpdaterProps {
  onComplete: () => void;
}

const SystemUpdater: React.FC<SystemUpdaterProps> = ({ onComplete }) => {
  const [status, setStatus] = useState<'IDLE' | 'UPDATING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState('Sistem mendeteksi pembaruan database diperlukan.');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [...prev, `> ${msg}`]);

  const performUpdate = async () => {
    setStatus('UPDATING');
    addLog('Memulai pembaruan database...');
    
    try {
      const res = await fetch('/api/system/db-migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      
      if (data.success) {
        addLog('Migrasi berhasil.');
        addLog('Update versi sistem selesai.');
        setStatus('SUCCESS');
        setTimeout(() => {
            onComplete();
        }, 2000);
      } else {
        throw new Error(data.message || 'Gagal update database');
      }
    } catch (error: any) {
      console.error('Update Error:', error);
      addLog(`ERROR: ${error.message}`);
      setStatus('ERROR');
      setMessage(`Gagal memperbarui database: ${error.message}`);
    }
  };

  useEffect(() => {
      // Auto start update if component mounted? 
      // User asked for "system mengupdate secara otomatis".
      // But also "muncul modal informasi".
      // So we show modal, and maybe auto start or wait for click?
      // "system mengupdate secara otomatis" implies auto start.
      // Let's auto start after a brief delay to let user see the modal.
      const timer = setTimeout(() => {
          performUpdate();
      }, 1500);
      return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900 bg-opacity-80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-blue-600 p-6 text-center">
           <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
              <Database size={40} className="text-white" />
           </div>
           <h2 className="text-2xl font-bold text-white">Pembaruan Sistem</h2>
           <p className="text-blue-100 mt-2">Sinkronisasi Database Otomatis</p>
        </div>

        <div className="p-6">
           <div className="mb-6 text-center">
              {status === 'IDLE' && <p className="text-slate-600">Mempersiapkan pembaruan...</p>}
              {status === 'UPDATING' && (
                  <div className="flex flex-col items-center gap-3">
                      <RefreshCw size={32} className="text-blue-600 animate-spin" />
                      <p className="text-slate-600 font-medium">Sedang memperbarui struktur database...</p>
                  </div>
              )}
              {status === 'SUCCESS' && (
                  <div className="flex flex-col items-center gap-3">
                      <CheckCircle size={40} className="text-emerald-500 animate-bounce-short" />
                      <p className="text-emerald-700 font-bold text-lg">Pembaruan Berhasil!</p>
                      <p className="text-slate-500 text-sm">Mengalihkan ke aplikasi...</p>
                  </div>
              )}
              {status === 'ERROR' && (
                  <div className="flex flex-col items-center gap-3">
                      <AlertTriangle size={40} className="text-rose-500" />
                      <p className="text-rose-700 font-bold">Terjadi Kesalahan</p>
                      <p className="text-slate-500 text-sm">{message}</p>
                      <button 
                        onClick={performUpdate}
                        className="mt-4 px-6 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
                      >
                        Coba Lagi
                      </button>
                  </div>
              )}
           </div>

           <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400 h-40 overflow-y-auto custom-scrollbar shadow-inner">
              {logs.map((log, i) => (
                  <div key={i} className="mb-1">{log}</div>
              ))}
              {status === 'UPDATING' && <div className="animate-pulse">_</div>}
           </div>
        </div>
      </div>
    </div>
  );
};

export default SystemUpdater;
