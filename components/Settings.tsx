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
  const [activeTab, setActiveTab] = useState<'INCOME_CATEGORIES' | 'EXPENSE_CATEGORIES' | 'DATABASE'>('INCOME_CATEGORIES');
  
  // Local state for Inputs
  const [newCategory, setNewCategory] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>(''); // For filtering and adding
  
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>(settings.database);
  
  // Loading States
  const [categoryLoading, setCategoryLoading] = useState(false);
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

  // Deletion
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Initialize selected company
  useEffect(() => {
    if (settings.companies.length > 0 && selectedCompanyId === '') {
        setSelectedCompanyId(settings.companies[0].id);
    }
  }, [settings.companies]);

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
    const companyId = selectedCompanyId === '' ? null : Number(selectedCompanyId);

    if (!catName) return;
    if (!companyId) {
        showFeedback('error', 'Pilih perusahaan terlebih dahulu');
        return;
    }

    // Check duplicate in client state
    const isDuplicate = settings.categories.some(c => 
        c.name === catName && 
        c.type === type && 
        c.company_id === companyId
    );
    if (isDuplicate) {
        showFeedback('error', 'Kategori sudah ada di perusahaan ini');
        return;
    }

    if (authToken) {
       setCategoryLoading(true);
       try {
          const res = await fetch('/api/categories', {
              method: 'POST',
              headers: { 
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${authToken}` 
              },
              body: JSON.stringify({ name: catName, type, company_id: companyId })
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

    // Update Local State (Idealnya fetch ulang, tapi optimistik update ok)
    // Kita perlu ID, tapi API mungkin tidak balik ID di insert simpel. 
    // Best practice: Reload all categories or API return new ID.
    // For now, reload categories is safer to get ID.
    if (authToken) {
        const res = await fetch('/api/categories', { headers: { 'Authorization': `Bearer ${authToken}` } });
        const cats = await res.json();
        onUpdateSettings({ ...settings, categories: cats });
    }

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
              // Reload categories to ensure consistency
              const resList = await fetch('/api/categories', { headers: { 'Authorization': `Bearer ${authToken}` } });
              const cats = await resList.json();
              onUpdateSettings({ ...settings, categories: cats });

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
            
            // Reload categories
            const resList = await fetch('/api/categories', { headers: { 'Authorization': `Bearer ${authToken}` } });
            const cats = await resList.json();
            onUpdateSettings({ ...settings, categories: cats });

            showFeedback('success', 'Kategori berhasil dihapus');
        } catch (e) {
            showFeedback('error', "Gagal menghubungi server");
        } finally {
            setIsConfirmDeleteOpen(false);
            setDeleteTarget(null);
        }
  };


  // --- DATABASE HANDLERS ---
  const handleDbTest = async () => {
      setIsTestingDB(true);
      setDbMessage(null);
      try {
          const res = await fetch('/api/test-db');
          const data = await res.json();
          if (data.status === 'success') {
              setDbMessage({ type: 'success', text: 'Koneksi Database Berhasil!' });
          } else {
              setDbMessage({ type: 'error', text: `Gagal: ${data.message}` });
          }
      } catch (e) {
          setDbMessage({ type: 'error', text: 'Server tidak dapat dihubungi.' });
      } finally {
          setIsTestingDB(false);
      }
  };

  // --- RENDER HELPERS ---
  const filteredCategories = settings.categories.filter(c => {
      const typeMatch = activeTab === 'INCOME_CATEGORIES' ? c.type === 'INCOME' : c.type === 'EXPENSE';
      const companyMatch = selectedCompanyId ? c.company_id === Number(selectedCompanyId) : true;
      return typeMatch && companyMatch;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* HEADER TABS */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
         <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Tag className="text-blue-600" />
            Pengaturan
         </h2>
         <div className="flex p-1 bg-slate-200 rounded-lg">
            <button 
                onClick={() => setActiveTab('INCOME_CATEGORIES')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'INCOME_CATEGORIES' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
                Kategori Pemasukan
            </button>
            <button 
                onClick={() => setActiveTab('EXPENSE_CATEGORIES')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'EXPENSE_CATEGORIES' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
                Kategori Pengeluaran
            </button>
            <button 
                onClick={() => setActiveTab('DATABASE')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'DATABASE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
                Database
            </button>
         </div>
      </div>

      {/* CONTENT: CATEGORIES */}
      {(activeTab === 'INCOME_CATEGORIES' || activeTab === 'EXPENSE_CATEGORIES') && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-700">
                    {activeTab === 'INCOME_CATEGORIES' ? 'Daftar Kategori Pemasukan' : 'Daftar Kategori Pengeluaran'}
                </h3>
                
                {/* Company Filter Dropdown */}
                <div className="flex items-center gap-2">
                    <Building size={16} className="text-slate-400" />
                    <select
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {settings.companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
             </div>

             {/* Add Form */}
             <form onSubmit={handleAddCategory} className="mb-8 bg-slate-50 p-4 rounded-lg border border-slate-200">
                 <h4 className="text-sm font-semibold text-slate-700 mb-3">Tambah Kategori Baru</h4>
                 <div className="flex gap-2">
                    <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder={`Nama Kategori ${activeTab === 'INCOME_CATEGORIES' ? 'Pemasukan' : 'Pengeluaran'}...`}
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={categoryLoading || !newCategory.trim() || !selectedCompanyId}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Plus size={20} />
                        Tambah
                    </button>
                 </div>
                 {!selectedCompanyId && <p className="text-xs text-rose-500 mt-2">* Pilih perusahaan terlebih dahulu</p>}
             </form>

             {/* List */}
             <div className="space-y-2">
                {filteredCategories.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 border border-dashed border-slate-300 rounded-lg">
                        Belum ada kategori untuk perusahaan ini.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredCategories.map((cat, idx) => (
                            <div key={cat.id || idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow group">
                                <span className="text-slate-700 font-medium">{cat.name}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openEditCategory(cat)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => openDeleteCategory(cat)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
             </div>
          </div>
      )}

      {/* CONTENT: DATABASE */}
      {activeTab === 'DATABASE' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-700 mb-6 flex items-center gap-2">
                  <Database className="text-slate-500" />
                  Konfigurasi Database
              </h3>
              
              <div className="space-y-4 max-w-lg">
                  <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 mb-4">
                      <p>Database menggunakan konfigurasi dari file <strong>.env</strong> di server.</p>
                      <p className="mt-1">Host: {dbConfig.host}</p>
                      <p>Database: {dbConfig.name}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                      <button
                          onClick={handleDbTest}
                          disabled={isTestingDB}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
                      >
                          {isTestingDB ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                          Tes Koneksi
                      </button>
                  </div>

                  {dbMessage && (
                      <div className={`p-4 rounded-lg flex items-center gap-2 ${dbMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {dbMessage.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                          {dbMessage.text}
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* MODALS */}
      <Modal
            isOpen={isFeedbackModalOpen}
            onClose={() => setIsFeedbackModalOpen(false)}
            title={feedbackMessage?.type === 'success' ? 'Berhasil' : 'Gagal'}
        >
            <div className="text-center">
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${feedbackMessage?.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {feedbackMessage?.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                </div>
                <p className="text-slate-600 mb-6">{feedbackMessage?.text}</p>
                <button
                    onClick={() => setIsFeedbackModalOpen(false)}
                    className="w-full bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-900"
                >
                    Tutup
                </button>
            </div>
      </Modal>

      <Modal
            isOpen={isEditCategoryModalOpen}
            onClose={() => setIsEditCategoryModalOpen(false)}
            title="Edit Kategori"
      >
            <form onSubmit={handleUpdateCategory} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Kategori</label>
                    <input
                        type="text"
                        value={editCategoryName}
                        onChange={(e) => setEditCategoryName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="button"
                        onClick={() => setIsEditCategoryModalOpen(false)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={categoryLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {categoryLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                </div>
            </form>
      </Modal>

      <ConfirmModal
            isOpen={isConfirmDeleteOpen}
            onClose={() => setIsConfirmDeleteOpen(false)}
            onConfirm={confirmDeleteCategory}
            title="Hapus Kategori?"
            message={`Apakah Anda yakin ingin menghapus kategori "${deleteTarget?.name}"?`}
            confirmText="Hapus"
            cancelText="Batal"
            variant="danger"
      />

    </div>
  );
};

export default Settings;