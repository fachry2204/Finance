
import React, { useState } from 'react';
import { Lock, User, Database, AlertCircle, RefreshCw } from 'lucide-react';
import { ConnectionStatus } from '../types';

interface LoginProps {
  onLogin: (user: any, token: string) => void;
  connectionStatus?: ConnectionStatus;
}

const Login: React.FC<LoginProps> = ({ onLogin, connectionStatus = 'CHECKING' }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isConnected = connectionStatus === 'CONNECTED';

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'CONNECTED': return { 
          text: 'DB Connected', 
          color: 'bg-emerald-50 text-emerald-700 border-emerald-100', 
          dot: 'bg-emerald-500 animate-pulse' 
      };
      case 'DB_ERROR': return { 
          text: 'Database Tidak Konek Hubungi Admin', 
          color: 'bg-orange-50 text-orange-700 border-orange-100', 
          dot: 'bg-orange-500' 
      };
      case 'SERVER_ERROR': return { 
          text: 'Node JS Mati', 
          color: 'bg-rose-50 text-rose-700 border-rose-100', 
          dot: 'bg-rose-500' 
      };
      case 'CHECKING':
      default: return { 
          text: 'Checking...', 
          color: 'bg-slate-50 text-slate-500 border-slate-100', 
          dot: 'bg-slate-400 animate-pulse' 
      };
    }
  };

  const statusConfig = getStatusConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return;

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
      
      <div className={`bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 transition-all duration-300 relative`}>
        
        {/* Database Status Indicator - Top Right of Login Form */}
        <div className={`absolute top-4 right-4 z-10 inline-flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-medium border shadow-sm transition-all duration-300 ${statusConfig.color}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}></div>
          {statusConfig.text}
        </div>

        {!isConnected && (
            <button 
                onClick={handleRefresh}
                className="absolute top-4 left-4 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                title="Refresh Page"
            >
                <RefreshCw size={10} /> Refresh
            </button>
        )}

        <div className="text-center mb-8">
          <img 
            src="https://fin.dmasiv.id/img/logodmsv.png" 
            alt="D'MASIV Logo" 
            className="h-24 w-auto mx-auto mb-6 object-contain"
          />
          <h1 className="text-2xl font-bold text-slate-800">Selamat Datang</h1>
          <p className="text-slate-500">Sistem Finance D'MASIV</p>
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
                disabled={!isConnected}
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
                disabled={!isConnected}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || !isConnected}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Memproses...' : 'Masuk Sistem'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} D'MASIV Finance System
        </div>
      </div>
    </div>
  );
};

export default Login;
