import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, Save, Database, HardDrive, Server, CheckCircle, XCircle, Folder, RefreshCw, LogOut } from 'lucide-react';
import { AppSettings, DatabaseConfig, GoogleDriveConfig } from '../types';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings }) => {
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'DATABASE' | 'INTEGRATION'>('GENERAL');
  
  // Local state for forms
  const [newCategory, setNewCategory] = useState('');
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>(settings.database);
  const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig>(settings.drive);
  
  const [isTestingDB, setIsTestingDB] = useState(false);
  const [dbMessage, setDbMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Check URL params for OAuth callback status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'drive_connected') {
      setDriveConfig(prev => ({ ...prev, isConnected: true }));
      onUpdateSettings({ ...settings, drive: { ...settings.drive, isConnected: true } });
      window.history.replaceState({}, document.title, window.location.pathname); // Clean URL
      alert("Google Drive Berhasil Terhubung!");
    } else if (status === 'drive_failed') {
      alert("Gagal menghubungkan Google Drive.");
    }
  }, []);

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

  // --- Database Handlers ---
  const handleDbChange = (field: keyof DatabaseConfig, value: string) => {
    setDbConfig(prev => ({ ...prev, [field]: value, isConnected: false })); 
  };

  const testDbConnection = async () => {
    setIsTestingDB(true);
    setDbMessage(null);
    
    try {
      const response = await fetch('/api/test-db');
      
      // Cek apakah response adalah JSON valid
      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
          // Jika server mengembalikan HTML (misal halaman 404 default webserver), lempar error yang jelas
          const text = await response.text();
          console.error("Non-JSON response received:", text.substring(0, 100)); // Log sebagian response
          throw new Error("Gagal menghubungi Backend API. Pastikan Server Node.js berjalan dan URL benar.");
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        setDbConfig(prev => ({ ...prev, isConnected: true }));
        setDbMessage({ type: 'success', text: data.message });
        onUpdateSettings({ ...settings, database: { ...dbConfig, isConnected: true } });
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      console.error(error);
      setDbMessage({ type: 'error', text: error.message || 'Gagal terkoneksi ke server.' });
    } finally {
      setIsTestingDB(false);
    }
  };

  // --- Drive Handlers ---
  const handleConnectDrive = async () => {
    try {
      const response = await fetch('/auth/google');
      // Cek response JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
         throw new Error("Backend API tidak merespons JSON.");
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to Google Login
      }
    } catch (error) {
      console.error("Gagal memulai auth:", error);
      alert("Gagal menghubungi server backend. Pastikan server berjalan.");
    }
  };

  const handleDisconnectDrive = () => {
     setDriveConfig(prev => ({ ...prev, isConnected: false, email: undefined }));
     onUpdateSettings({ ...settings, drive: { ...settings.drive, isConnected: false, email: undefined } });
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFolder = e.target.value;
    setDriveConfig(prev => ({ ...prev, selectedFolderId: newFolder, selectedFolderName: e.target.options[e.target.selectedIndex].text }));
    onUpdateSettings({ ...settings, drive: { ...settings.drive, selectedFolderId: newFolder, selectedFolderName: e.target.options[e.target.selectedIndex].text } });
  }

  const handleAutoUploadToggle = () => {
    const newVal = !driveConfig.autoUpload;
    setDriveConfig(prev => ({ ...prev, autoUpload: newVal }));
    onUpdateSettings({ ...settings, drive: { ...settings.drive, autoUpload: newVal } });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Pengaturan Aplikasi</h2>

      {/* TABS */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('GENERAL')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'GENERAL' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
        >
          Master Data
        </button>
        <button
          onClick={() => setActiveTab('DATABASE')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'DATABASE' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
        >
          Koneksi Database
        </button>
        <button
          onClick={() => setActiveTab('INTEGRATION')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'INTEGRATION' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
        >
          Integrasi Drive
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CONTENT AREA */}
        <div className="md:col-span-2 space-y-6">
          
          {/* --- GENERAL TAB --- */}
          {activeTab === 'GENERAL' && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                  <Tag size={20} />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-slate-800 dark:text-white">Kategori Kegiatan</h3>
                   <p className="text-xs text-slate-500">Kelola kategori untuk dropdown input.</p>
                </div>
              </div>

              <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  placeholder="Nama Kategori Baru..." 
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white border p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
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
                {settings.categories.length > 0 ? (
                  settings.categories.map((cat, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700 group hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                      <span className="text-slate-700 dark:text-slate-200 font-medium">{cat}</span>
                      <button 
                        onClick={() => handleDeleteCategory(cat)}
                        className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                        title="Hapus Kategori"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 italic">
                    Belum ada kategori yang ditambahkan.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- DATABASE TAB --- */}
          {activeTab === 'DATABASE' && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
               <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <Database size={20} />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-slate-800 dark:text-white">Koneksi MySQL Server</h3>
                   <p className="text-xs text-slate-500">
                      Konfigurasi database diatur melalui file <code>.env</code> di server backend demi keamanan.
                   </p>
                </div>
              </div>

              <div className="space-y-4">
                 <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-600 text-sm">
                    <p className="mb-2 font-semibold">Status Koneksi Saat Ini:</p>
                    <div className="flex items-center gap-2">
                       <span className={`w-3 h-3 rounded-full ${dbConfig.isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                       <span className="text-slate-700 dark:text-slate-200">{dbConfig.isConnected ? 'Terhubung ke Database' : 'Terputus / Belum Dikonfigurasi'}</span>
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
                      {isTestingDB ? 'Mengecek...' : 'Test Koneksi Server'}
                    </button>
                 </div>
              </div>
            </div>
          )}

          {/* --- GOOGLE DRIVE TAB --- */}
          {activeTab === 'INTEGRATION' && (
             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
               <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                  <HardDrive size={20} />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-slate-800 dark:text-white">Integrasi Google Drive</h3>
                   <p className="text-xs text-slate-500">Backup dan simpan bukti transaksi secara realtime.</p>
                </div>
              </div>

              {!driveConfig.isConnected ? (
                <div className="text-center py-10 space-y-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                   <div className="bg-slate-100 dark:bg-slate-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-400">
                      <HardDrive size={32} />
                   </div>
                   <div>
                     <p className="text-slate-800 dark:text-white font-medium">Belum Terhubung</p>
                     <p className="text-sm text-slate-500">Hubungkan akun Google Anda untuk mengaktifkan penyimpanan cloud.</p>
                   </div>
                   <button 
                      onClick={handleConnectDrive}
                      className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm inline-flex items-center gap-2"
                   >
                     <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                     Sign in with Google
                   </button>
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center text-green-600 dark:text-green-400">
                           <CheckCircle size={20} />
                         </div>
                         <div>
                            <p className="font-bold text-slate-800 dark:text-white">Terhubung</p>
                            <p className="text-sm text-green-600 dark:text-green-400">Token OAuth Valid</p>
                         </div>
                      </div>
                      <button onClick={handleDisconnectDrive} className="text-rose-600 hover:text-rose-700 p-2" title="Putuskan Koneksi">
                        <LogOut size={20} />
                      </button>
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Auto Upload Bukti Transaksi</label>
                         <button 
                            onClick={handleAutoUploadToggle}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${driveConfig.autoUpload ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                         >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${driveConfig.autoUpload ? 'translate-x-6' : 'translate-x-0'}`} />
                         </button>
                      </div>
                   </div>
                </div>
              )}
             </div>
          )}

        </div>

        {/* INFO SIDEBAR */}
        <div className="h-fit space-y-6">
           <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Status Sistem</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-sm text-slate-500">Database</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${dbConfig.isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    {dbConfig.isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-sm text-slate-500">Google Drive</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${driveConfig.isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    {driveConfig.isConnected ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;