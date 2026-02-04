import React, { useState } from 'react';
import { Plus, Trash2, Building, Pencil, AlertCircle } from 'lucide-react';
import { AppSettings, Company } from '../types';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';

interface CompanyManagerProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  authToken: string | null;
}

const CompanyManager: React.FC<CompanyManagerProps> = ({ settings, onUpdateSettings, authToken }) => {
  const [newCompany, setNewCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Edit State
  const [editingCompany, setEditingCompany] = useState<{id: number, name: string} | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const showFeedback = (type: 'success' | 'error', text: string) => {
      setFeedbackMessage({ type, text });
      setIsFeedbackModalOpen(true);
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const compName = newCompany.trim();
    if (!compName || settings.companies.some(c => c.name === compName)) return;

    if (authToken) {
       setLoading(true);
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
              if (data.success) {
                  const newComp: Company = { id: data.id || Date.now(), name: compName };
                  onUpdateSettings({
                      ...settings,
                      companies: [...settings.companies, newComp]
                  });
                  setNewCompany('');
                  showFeedback('success', 'Perusahaan berhasil ditambahkan');
              } else {
                  showFeedback('error', data.message || 'Gagal menambahkan perusahaan');
              }
          } else {
              showFeedback('error', 'Respon server tidak valid');
          }
       } catch (err) {
          showFeedback('error', 'Gagal menghubungi server');
       }
       setLoading(false);
    }
  };

  const openEditCompany = (comp: Company) => {
      setEditingCompany(comp);
      setEditCompanyName(comp.name);
      setIsEditCompanyModalOpen(true);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingCompany || !authToken) return;
      const newName = editCompanyName.trim();
      if (!newName) return;

      setLoading(true);
      try {
          const res = await fetch(`/api/companies/${editingCompany.id}`, {
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
                  companies: settings.companies.map(c => c.id === editingCompany.id ? { ...c, name: newName } : c)
              });
              setIsEditCompanyModalOpen(false);
              showFeedback('success', 'Perusahaan berhasil diperbarui');
          } else {
              showFeedback('error', data.message || 'Gagal update perusahaan');
          }
      } catch (e) {
          showFeedback('error', 'Gagal menghubungi server');
      } finally {
          setLoading(false);
      }
  };

  const openDeleteCompany = (comp: Company) => {
      setDeleteTarget(comp);
      setIsConfirmDeleteOpen(true);
  };

  const confirmDeleteCompany = async () => {
      if (!deleteTarget || !authToken) return;
      try {
          const res = await fetch(`/api/companies/${deleteTarget.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${authToken}` }
          });
          const data = await res.json();
          if (data.success) {
              onUpdateSettings({
                  ...settings,
                  companies: settings.companies.filter(c => c.id !== deleteTarget.id)
              });
              showFeedback('success', 'Perusahaan berhasil dihapus');
          } else {
              showFeedback('error', data.message || 'Gagal menghapus perusahaan');
          }
      } catch (e) {
          showFeedback('error', 'Gagal menghubungi server');
      } finally {
          setIsConfirmDeleteOpen(false);
          setDeleteTarget(null);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Building className="text-blue-600" />
                Manajemen Perusahaan
            </h2>

            {/* Add Company Form */}
            <form onSubmit={handleAddCompany} className="mb-8 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Tambah Perusahaan Baru</h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newCompany}
                        onChange={(e) => setNewCompany(e.target.value)}
                        placeholder="Nama PT / Perusahaan..."
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={loading || !newCompany.trim()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Plus size={20} />
                        Tambah
                    </button>
                </div>
            </form>

            {/* Companies List */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Daftar Perusahaan</h3>
                {settings.companies.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        Belum ada data perusahaan
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {settings.companies.map((comp) => (
                            <div key={comp.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                        {comp.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="font-medium text-slate-700">{comp.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openEditCompany(comp)}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                        title="Edit"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={() => openDeleteCompany(comp)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                        title="Hapus"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* Modals */}
        <Modal
            isOpen={isFeedbackModalOpen}
            onClose={() => setIsFeedbackModalOpen(false)}
            title={feedbackMessage?.type === 'success' ? 'Berhasil' : 'Gagal'}
        >
            <div className="text-center">
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${feedbackMessage?.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {feedbackMessage?.type === 'success' ? <Building size={24} /> : <AlertCircle size={24} />}
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
            isOpen={isEditCompanyModalOpen}
            onClose={() => setIsEditCompanyModalOpen(false)}
            title="Edit Perusahaan"
        >
            <form onSubmit={handleUpdateCompany} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Perusahaan</label>
                    <input
                        type="text"
                        value={editCompanyName}
                        onChange={(e) => setEditCompanyName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="button"
                        onClick={() => setIsEditCompanyModalOpen(false)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                </div>
            </form>
        </Modal>

        <ConfirmModal
            isOpen={isConfirmDeleteOpen}
            onClose={() => setIsConfirmDeleteOpen(false)}
            onConfirm={confirmDeleteCompany}
            title="Hapus Perusahaan?"
            message={`Apakah Anda yakin ingin menghapus "${deleteTarget?.name}"? Tindakan ini tidak dapat dibatalkan.`}
            confirmText="Hapus"
            cancelText="Batal"
            variant="danger"
        />
    </div>
  );
};

export default CompanyManager;