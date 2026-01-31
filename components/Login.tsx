
import React, { useState } from 'react';
import { Lock, User, Database, AlertCircle, RefreshCw } from 'lucide-react';

interface LoginProps {
  onLogin: (user: any, token: string) => void;
  isDbConnected?: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, isDbConnected = true }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDbConnected) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (data.success && data.token) {
        onLogin(data.user, data.token);
      } else {
        setError(data.message || 'Login gagal');
      }
    } catch (err) {
      setError('Gagal menghubungi server');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Database Status Indicator - Top Right */}
      <div className={`absolute top-4 right-4 z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium border shadow-sm transition-all duration-300 ${isDbConnected ? 'bg-white text-emerald-700 border-emerald-100' : 'bg-white text-rose-700 border-rose-100'}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${isDbConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
        {isDbConnected ? 'Database Terhubung' : 'Database Offline'}
      </div>

      {/* Database Disconnect Warning Modal */}
      {!isDbConnected && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border-t-4 border-rose-500">
            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-600 animate-pulse">
              <Database size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Koneksi Database Terputus</h3>
            <p className="text-slate-600 mb-8">
              Sistem tidak dapat terhubung ke database server. Mohon periksa koneksi internet Anda atau hubungi Administrator Sistem.
            </p>
            <button 
              onClick={handleRefresh}
              className="px-6 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all flex items-center gap-2 mx-auto"
            >
              <RefreshCw size={20} /> Coba Hubungkan Ulang
            </button>
          </div>
        </div>
      )}

      <div className={`bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 transition-all duration-300 ${!isDbConnected ? 'filter blur-sm pointer-events-none' : ''}`}>
        <div className="text-center mb-8">
          <img 
            src="https://ruangdimensirecords.com/img/logo.png" 
            alt="RDR Logo" 
            className="h-24 w-auto mx-auto mb-6 object-contain"
          />
          <h1 className="text-2xl font-bold text-slate-800">Selamat Datang</h1>
          <p className="text-slate-500">Sistem Informasi Keuangan RDR</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-lg text-center font-medium flex items-center justify-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={20} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                placeholder="Masukkan username"
                required
                disabled={!isDbConnected}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                placeholder="Masukkan password"
                required
                disabled={!isDbConnected}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || !isDbConnected}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Memproses...' : 'Masuk Sistem'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} RDR Finance System
        </div>
      </div>
    </div>
  );
};

export default Login;
