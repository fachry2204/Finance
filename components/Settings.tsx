
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, Database, CheckCircle, XCircle, Users, RefreshCw, UserPlus } from 'lucide-react';
import { AppSettings, DatabaseConfig, User } from '../types';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  authToken: string | null;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings, authToken }) => {
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'DATABASE' | 'USERS'>('GENERAL');
  
  // Local state
  const [newCategory, setNewCategory] = useState('');
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>(settings.database);
  
  // User Management State
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  
  const [isTestingDB, setIsTestingDB] = useState(false);
  const [dbMessage, setDbMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    // Fetch users when tab becomes active
    if (activeTab === 'USERS' && authToken) {
        fetchUsers();
    }
  }, [activeTab, authToken]);

  const fetchUsers = async () => {
      if (!authToken) return;
      try {
          const res = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          const data = await res.json();
          if (Array.isArray(data)) setUsers(data);
      } catch (e) {
          console.error("Failed to fetch users");
      }
  }

  // --- Category Handlers ---
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategory.trim() && !settings.categories.includes(newCategory.trim())) {
      onUpdateSettings({
        ...settings,
        categories: [...settings.categories, newCategory.trim()]
      });
      setNewCategory('');
    }
  };

  const handleDeleteCategory = (cat: string) => {
    onUpdateSettings({
      ...settings,
      categories: settings.categories.filter(c => c !== cat)
    });
  };

  // --- User Handlers ---
  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUsername.trim() || !newPassword.trim()) return;
      if (!authToken) return alert("Sesi habis");

      setUserLoading(true);
      try {
          const res = await fetch('/api/users', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({ username: newUsername, password: newPassword })
          });
          const data = await res.json();
          if (data.success) {
              setNewUsername('');
              setNewPassword('');
              fetchUsers();
              alert("User berhasil dibuat!");
          } else {
              alert(data.message);
          }
      } catch (e) {
          alert("Gagal membuat user");
      } finally {
          setUserLoading(false);
      }
  };

  const handleDeleteUser = async (id: number) => {
      if(!confirm("Yakin ingin menghapus user ini?")) return;
      if (!authToken) return alert("Sesi habis");
      try {
          const res = await fetch(`/api/users/${id}`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          const data = await res.json();
          if(data.success) fetchUsers();
      } catch(e) {
          alert("Gagal hapus user");
      }
  };

  // --- Database Handlers ---
  const testDbConnection = async () => {
    setIsTestingDB(true);
    setDbMessage(null);
    try {
      // Test DB route is public, but we can secure it if needed. Leaving public for diagnostics.
      const response = await fetch('/api/test-db');
      const data = await response.json();
      if (data.status === 'success') {
        setDbConfig(prev => ({ ...prev, isConnected: true }));
        setDbMessage({ type: 'success', text: data.message });
        onUpdateSettings({ ...settings, database: { ...dbConfig, isConnected: true } });
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      setDbMessage({ type: 'error', text: error.message || 'Gagal terkoneksi ke server.' });
    } finally {
      setIsTestingDB(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800">Pengaturan Aplikasi</h2>

      {/* TABS */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
        <button
          onClick={() => setActiveTab('GENERAL')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'GENERAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Kategori
        </button>
        <button
          onClick={() => setActiveTab('USERS')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'USERS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Manajemen User
        </button>
        <button
          onClick={() => setActiveTab('DATABASE')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'DATABASE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Database
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CONTENT AREA */}
        <div className="md:col-span-2 space-y-6">
          
          {/* --- GENERAL TAB --- */}
          {activeTab === 'GENERAL' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <Tag size={20} />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-slate-800">Kategori Kegiatan</h3>
                   <p className="text-xs text-slate-500">Kelola kategori untuk dropdown input.</p>
                </div>
              </div>

              <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  placeholder="Nama Kategori Baru..." 
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 rounded-lg border-slate-300 bg-slate-50 text-slate-900 border p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button 
                  type="submit"
                  disabled={!newCategory.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
                >
                  <Plus size={18} /> Tambah
                </button>
              </form>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {settings.categories.map((cat, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group hover:border-blue-200 transition-colors">
                    <span className="text-slate-700 font-medium">{cat}</span>
                    <button onClick={() => handleDeleteCategory(cat)} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- USER MANAGEMENT TAB --- */}
          {activeTab === 'USERS' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                        <Users size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Manajemen User</h3>
                        <p className="text-xs text-slate-500">Tambah atau hapus akses pengguna sistem.</p>
                    </div>
                </div>

                <form onSubmit={handleAddUser} className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><UserPlus size={16}/> Tambah User Baru</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <input type="text" placeholder="Username" required value={newUsername} onChange={e => setNewUsername(e.target.value)} className="p-2 rounded border border-slate-300 text-sm" />
                        <input type="password" placeholder="Password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="p-2 rounded border border-slate-300 text-sm" />
                    </div>
                    <button disabled={userLoading} className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 transition">
                        {userLoading ? 'Memproses...' : 'Buat User'}
                    </button>
                </form>

                <div className="overflow-hidden border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600 font-semibold">
                            <tr>
                                <th className="p-3">Username</th>
                                <th className="p-3">Role</th>
                                <th className="p-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map((u, index) => (
                                <tr key={u.id} className="even:bg-slate-50">
                                    <td className="p-3 text-slate-800">{u.username}</td>
                                    <td className="p-3 text-slate-500 uppercase text-xs font-bold">{u.role}</td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => handleDeleteUser(u.id)} className="text-rose-500 hover:text-rose-700 p-1"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )}

          {/* --- DATABASE TAB --- */}
          {activeTab === 'DATABASE' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
               <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                  <Database size={20} />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-slate-800">Koneksi MySQL</h3>
                   <p className="text-xs text-slate-500">Konfigurasi database server.</p>
                </div>
              </div>

              <div className="space-y-4">
                 <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                    <p className="mb-2 font-semibold">Status Koneksi:</p>
                    <div className="flex items-center gap-2">
                       <span className={`w-3 h-3 rounded-full ${dbConfig.isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                       <span className="text-slate-700">{dbConfig.isConnected ? 'Terhubung' : 'Terputus'}</span>
                    </div>
                 </div>

                 {dbMessage && (
                   <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${dbMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {dbMessage.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      {dbMessage.text}
                   </div>
                 )}

                 <div className="pt-4 flex justify-end">
                    <button 
                      onClick={testDbConnection}
                      disabled={isTestingDB}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors font-medium"
                    >
                      {isTestingDB ? <RefreshCw size={18} className="animate-spin" /> : <Database size={18} />}
                      Test Koneksi
                    </button>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
