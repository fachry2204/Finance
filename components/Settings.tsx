import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, Database, CheckCircle, XCircle, RefreshCw, Building, Pencil, AlertCircle } from 'lucide-react';
import { AppSettings, DatabaseConfig, Category } from '../types';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  authToken: string | null;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings, authToken }) => {
  const [activeTab, setActiveTab] = useState<'INCOME_CATEGORIES' | 'EXPENSE_CATEGORIES' | 'DATABASE' | 'COMPANIES'>('INCOME_CATEGORIES');
  
  // Local state for Inputs
  const [newCategory, setNewCategory] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>(settings.database);
  
  // Loading States
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [isTestingDB, setIsTestingDB] = useState(false);
  
  // Feedback States
  const [dbMessage, setDbMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // --- EDIT & DELETE STATES ---
  // Category Edit
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);

  // Company Edit
  const [editingCompany, setEditingCompany] = useState<{id: number, name: string} | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);

  // Deletion
  const [deleteType, setDeleteType] = useState<'CATEGORY' | 'COMPANY' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // --- HELPER: Show Feedback Modal ---
  const showFeedback = (type: 'success' | 'error', text: string) => {
      setFeedbackMessage({ type, text });
      setIsFeedbackModalOpen(true);
  };

  // --- CATEGORY HANDLERS ---
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const catName = newCategory.trim();
    const type = activeTab === 'INCOME_CATEGORIES' ? 'INCOME' : 'EXPENSE';

    if (!catName || settings.categories.some(c => c.name === catName && c.type === type)) return;

    if (authToken) {
       setCategoryLoading(true);
       try {
          const res = await fetch('/api/categories', {
              method: 'POST',
              headers: { 
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${authToken}` 
              },
              body: JSON.stringify({ name: catName, type })
          });
          const data = await res.json();
          if (!data.success) {
             showFeedback('error', data.message || 'Gagal menambahkan kategori ke server');
             setCategoryLoading(false);
             return;
          }
       } catch (err) {
          showFeedback('error', 'Gagal menghubungi server');
          setCategoryLoading(false);
          return;
       }
       setCategoryLoading(false);
    }

    const newCatObj: Category = { name: catName, type };
    onUpdateSettings({
      ...settings,
      categories: [...settings.categories, newCatObj]
    });
    setNewCategory('');
    showFeedback('success', 'Kategori berhasil ditambahkan');
  };

  const openEditCategory = (cat: Category) => {
      setEditingCategory(cat);
      setEditCategoryName(cat.name);
      setIsEditCategoryModalOpen(true);
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingCategory || !authToken) return;
      
      const newName = editCategoryName.trim();
      if (!newName) return;

      setCategoryLoading(true);
      try {
          // If we have ID, use it. If not (legacy), rely on name (risky if renamed, but handled by API usually)
          // Since we migrated, we should ideally use ID. But frontend might not have it if not refreshed.
          // Assuming API supports update by ID or Name.
          // The API endpoint is /api/categories/:idOrName
          
          const identifier = editingCategory.id ? editingCategory.id.toString() : editingCategory.name;

          const res = await fetch(`/api/categories/${encodeURIComponent(identifier)}`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({ newName })
          });
          const data = await res.json();
          
          if (data.success) {
              onUpdateSettings({
                  ...settings,
                  categories: settings.categories.map(c => c.name === editingCategory.name && c.type === editingCategory.type ? { ...c, name: newName } : c)
              });
              setIsEditCategoryModalOpen(false);
              showFeedback('success', 'Kategori berhasil diperbarui');
          } else {
              showFeedback('error', data.message || 'Gagal update kategori');
          }
      } catch (err: any) {
          showFeedback('error', 'Gagal menghubungi server: ' + err.message);
      } finally {
          setCategoryLoading(false);
      }
  };

  const openDeleteCategory = (cat: Category) => {
      setDeleteType('CATEGORY');
      setDeleteTarget(cat);
      setIsConfirmDeleteOpen(true);
  };

  const confirmDeleteCategory = async () => {
      if (!deleteTarget || !authToken) return;
      const cat = deleteTarget as Category;
      
      try {
            const identifier = cat.id ? cat.id.toString() : cat.name;
            const res = await fetch(`/api/categories/${encodeURIComponent(identifier)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await res.json();
            if (!data.success) {
                showFeedback('error', "Gagal menghapus kategori di server");
                return;
            }
            
            onUpdateSettings({
              ...settings,
              categories: settings.categories.filter(c => !(c.name === cat.name && c.type === cat.type))
            });
            showFeedback('success', 'Kategori berhasil dihapus');
        } catch (e) {
            showFeedback('error', "Gagal menghubungi server");
        } finally {
            setIsConfirmDeleteOpen(false);
            setDeleteTarget(null);
        }
  };


  // --- COMPANY HANDLERS ---
  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const compName = newCompany.trim();
    if (!compName || settings.companies.some(c => c.name === compName)) return;

    if (authToken) {
       setCompanyLoading(true);
       try {
          const res = await fetch('/api/companies', {
              method: 'POST',
              headers: { 
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${authToken}` 
              },
              body: JSON.stringify({ name: compName })
          });
          
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
              const data = await res.json();
              if (!data.success) {
                 throw new Error(data.message || 'Gagal menambahkan perusahaan ke server');
              }
              
              if (data.company) {
                  onUpdateSettings({
                      ...settings,
                      companies: [...settings.companies, data.company]
                  });
              } else {
                  // Fallback re-fetch
                  const listRes = await fetch('/api/companies', { 
                      headers: { 'Authorization': `Bearer ${authToken}` } 
                  });
                  const listData = await listRes.json();
                  if (Array.isArray(listData)) {
                      onUpdateSettings({ ...settings, companies: listData });
                  }
              }
              showFeedback('success', 'Perusahaan berhasil ditambahkan');
          } else {
              const text = await res.text();
              throw new Error(`Server error (${res.status}): ${text.substring(0, 100)}`);
          }
       } catch (err: any) {
          console.error("Add company error:", err);
          showFeedback('error', `Gagal: ${err.message}`);
       } finally {
          setCompanyLoading(false);
          setNewCompany('');
       }
    }
  };

  const openEditCompany = (comp: {id: number, name: string}) => {
      setEditingCompany(comp);
      setEditCompanyName(comp.name);
      setIsEditCompanyModalOpen(true);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingCompany || !authToken) return;
      
      const newName = editCompanyName.trim();
      if (!newName) return;

      setCompanyLoading(true);
      try {
          const res = await fetch(`/api/companies/${editingCompany.id}`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({ name: newName })
          });
          const data = await res.json();
          
          if (data.success) {
              onUpdateSettings({
                  ...settings,
                  companies: settings.companies.map(c => c.id === editingCompany.id ? { ...c, name: newName } : c)
              });
              setIsEditCompanyModalOpen(false);
              showFeedback('success', 'Perusahaan berhasil diperbarui');
          } else {
              showFeedback('error', data.message || 'Gagal update perusahaan');
          }
      } catch (err: any) {
          showFeedback('error', 'Gagal menghubungi server: ' + err.message);
      } finally {
          setCompanyLoading(false);
      }
  };

  const openDeleteCompany = (id: number) => {
      setDeleteType('COMPANY');
      setDeleteTarget(id);
      setIsConfirmDeleteOpen(true);
  };

  const confirmDeleteCompany = async () => {
      if (!deleteTarget || !authToken) return;
      const id = deleteTarget;

      try {
            const res = await fetch(`/api/companies/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await res.json();
            if (!data.success) {
                showFeedback('error', "Gagal menghapus perusahaan di server");
                return;
            }
            onUpdateSettings({
              ...settings,
              companies: settings.companies.filter(c => c.id !== id)
            });
            showFeedback('success', 'Perusahaan berhasil dihapus');
        } catch (e) {
            showFeedback('error', "Gagal menghubungi server");
        } finally {
            setIsConfirmDeleteOpen(false);
            setDeleteTarget(null);
        }
  };


  // --- DATABASE HANDLERS ---
  const testDbConnection = async () => {
    setIsTestingDB(true);
    setDbMessage(null);
    try {
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

  const filteredCategories = settings.categories.filter(c => {
    if (activeTab === 'INCOME_CATEGORIES') return c.type === 'INCOME';
    if (activeTab === 'EXPENSE_CATEGORIES') return c.type === 'EXPENSE';
    return false;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800">Pengaturan Aplikasi</h2>

      {/* TABS */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
        <button
          onClick={() => setActiveTab('INCOME_CATEGORIES')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'INCOME_CATEGORIES' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Kategori Pemasukan
        </button>
        <button
          onClick={() => setActiveTab('EXPENSE_CATEGORIES')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'EXPENSE_CATEGORIES' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Kategori Pengeluaran
        </button>
        <button
          onClick={() => setActiveTab('COMPANIES')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'COMPANIES' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Perusahaan
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
          
          {/* --- CATEGORIES TABS --- */}
          {(activeTab === 'INCOME_CATEGORIES' || activeTab === 'EXPENSE_CATEGORIES') && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <Tag size={20} />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-slate-800">
                     {activeTab === 'INCOME_CATEGORIES' ? 'Kategori Pemasukan' : 'Kategori Pengeluaran'}
                   </h3>
                   <p className="text-xs text-slate-500">Kelola kategori untuk dropdown input.</p>
                </div>
              </div>

              <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  placeholder={`Nama Kategori ${activeTab === 'INCOME_CATEGORIES' ? 'Pemasukan' : 'Pengeluaran'} Baru...`}
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 rounded-lg border-slate-300 bg-slate-50 text-slate-900 border p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={categoryLoading}
                />
                <button 
                  type="submit"
                  disabled={!newCategory.trim() || categoryLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
                >
                  {categoryLoading ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />} Tambah
                </button>
              </form>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredCategories.map((cat, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group hover:border-blue-200 transition-colors">
                    <span className="text-slate-700 font-medium">{cat.name}</span>
                    <div className="flex gap-2">
                        <button onClick={() => openEditCategory(cat)} className="text-slate-400 hover:text-blue-600 p-1 hover:bg-slate-100 rounded transition-colors" title="Edit">
                            <Pencil size={16} />
                        </button>
                        <button onClick={() => openDeleteCategory(cat)} className="text-slate-400 hover:text-rose-500 p-1 hover:bg-rose-50 rounded transition-colors" title="Hapus">
                            <Trash2 size={16} />
                        </button>
                    </div>
                  </div>
                ))}
                {filteredCategories.length === 0 && (
                  <div className="text-center p-4 text-slate-400 text-sm">Belum ada kategori.</div>
                )}
              </div>
            </div>
          )}

          {/* --- COMPANIES TAB --- */}
          {activeTab === 'COMPANIES' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <Building size={20} />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-slate-800">Manajemen Perusahaan</h3>
                   <p className="text-xs text-slate-500">Kelola daftar perusahaan (PT) untuk transaksi.</p>
                </div>
              </div>

              <form onSubmit={handleAddCompany} className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  placeholder="Nama PT Baru..." 
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="flex-1 rounded-lg border-slate-300 bg-slate-50 text-slate-900 border p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={companyLoading}
                />
                <button 
                  type="submit"
                  disabled={!newCompany.trim() || companyLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
                >
                  {companyLoading ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />} Tambah
                </button>
              </form>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {settings.companies && settings.companies.map((comp) => (
                  <div key={comp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group hover:border-blue-200 transition-colors">
                    <span className="text-slate-700 font-medium">{comp.name}</span>
                    <div className="flex gap-2">
                        <button onClick={() => openEditCompany(comp)} className="text-slate-400 hover:text-blue-600 p-1 hover:bg-slate-100 rounded transition-colors" title="Edit">
                            <Pencil size={16} />
                        </button>
                        <button onClick={() => openDeleteCompany(comp.id)} className="text-slate-400 hover:text-rose-500 p-1 hover:bg-rose-50 rounded transition-colors" title="Hapus">
                            <Trash2 size={16} />
                        </button>
                    </div>
                  </div>
                ))}
                {(!settings.companies || settings.companies.length === 0) && (
                  <div className="text-center p-4 text-slate-400 text-sm">Belum ada data perusahaan.</div>
                )}
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
                      {isTestingDB ? 'Mengecek...' : 'Cek Koneksi'}
                    </button>
                 </div>
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* MODALS */}
      <Modal
        isOpen={isEditCategoryModalOpen}
        onClose={() => setIsEditCategoryModalOpen(false)}
        title="Edit Kategori"
      >
        <form onSubmit={handleUpdateCategory}>
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Kategori</label>
                <input 
                    type="text" 
                    required 
                    value={editCategoryName} 
                    onChange={e => setEditCategoryName(e.target.value)}
                    className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-blue-500" 
                />
            </div>
            <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditCategoryModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Simpan</button>
            </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditCompanyModalOpen}
        onClose={() => setIsEditCompanyModalOpen(false)}
        title="Edit Perusahaan"
      >
        <form onSubmit={handleUpdateCompany}>
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Perusahaan</label>
                <input 
                    type="text" 
                    required 
                    value={editCompanyName} 
                    onChange={e => setEditCompanyName(e.target.value)}
                    className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-blue-500" 
                />
            </div>
            <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditCompanyModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Simpan</button>
            </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={deleteType === 'CATEGORY' ? confirmDeleteCategory : confirmDeleteCompany}
        title={deleteType === 'CATEGORY' ? "Hapus Kategori" : "Hapus Perusahaan"}
        message={`Apakah Anda yakin ingin menghapus ${deleteType === 'CATEGORY' ? 'kategori' : 'perusahaan'} ini?`}
        isDestructive={true}
      />

      <Modal
         isOpen={isFeedbackModalOpen}
         onClose={() => setIsFeedbackModalOpen(false)}
         title={feedbackMessage?.type === 'success' ? 'Berhasil' : 'Gagal'}
      >
         <div className="text-center p-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${feedbackMessage?.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {feedbackMessage?.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
            </div>
            <p className="text-slate-700">{feedbackMessage?.text}</p>
            <button onClick={() => setIsFeedbackModalOpen(false)} className="mt-6 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 rounded-lg transition-colors">
                Tutup
            </button>
         </div>
      </Modal>

    </div>
  );
};

export default Settings;