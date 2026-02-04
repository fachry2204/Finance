import React, { useState } from 'react';
import { Reimbursement, ItemDetail, ReimbursementStatus, Company } from '../types';
import { generateId, formatCurrency, formatDate } from '../utils';
import { Plus, Save, UploadCloud, Trash2, User, FileText, Eye, X, CheckCircle, XCircle, Clock, Loader, AlertCircle, Lock, Pencil, Check, Building2 } from 'lucide-react';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';

interface ReimbursementProps {
  reimbursements: Reimbursement[];
  onAddReimbursement: (reimb: Reimbursement) => void;
  onUpdateReimbursement: (reimb: Reimbursement) => void;
  onDeleteReimbursement: (id: string) => void;
  onUpdateReimbursementDetails: (reimb: Reimbursement) => void; 
  categories: string[];
  companies: Company[];
  authToken: string | null;
}

const ReimbursementPage: React.FC<ReimbursementProps> = ({ 
  reimbursements, 
  onAddReimbursement, 
  onUpdateReimbursement,
  onDeleteReimbursement,
  onUpdateReimbursementDetails,
  categories,
  companies,
  authToken 
}) => {
  const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
  const [selectedReimb, setSelectedReimb] = useState<Reimbursement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Mode State
  const [editingReimbId, setEditingReimbId] = useState<string | null>(null);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [requestorName, setRequestorName] = useState('');
  const [category, setCategory] = useState('');
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [activityName, setActivityName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ItemDetail[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Update Status Form State
  const [tempStatus, setTempStatus] = useState<ReimbursementStatus | null>(null);
  const [transferProofFile, setTransferProofFile] = useState<File | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Image Preview Modal State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // --- REUSABLE MODAL STATE ---
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false
  });
  
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  const showAlert = (message: string, type: 'success' | 'error' = 'error', title: string = 'Informasi') => {
    setAlertState({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
    setAlertState(prev => ({ ...prev, isOpen: false }));
  };

  const showConfirm = (message: string, onConfirm: () => void, title: string = 'Konfirmasi', isDestructive = false) => {
    setConfirmState({ isOpen: true, title, message, onConfirm, isDestructive });
  };

  const closeConfirm = () => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const addItem = () => {
    const newId = generateId();
    setItems([...items, { id: newId, name: '', qty: 1, price: 0, total: 0 }]);
    setEditingItemId(newId);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
    if(editingItemId === id) setEditingItemId(null);
  };

  const handleSaveItem = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (!item.name.trim() || item.qty <= 0) {
       showAlert("Mohon lengkapi nama item dan quantity minimal 1");
       return;
    }
    setEditingItemId(null);
  };

  const updateItem = (id: string, field: keyof ItemDetail, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'qty' || field === 'price') {
          updated.total = Number(updated.qty) * Number(updated.price);
        }
        return updated;
      }
      return item;
    }));
  };

   // Handle File Upload Item
   const handleFileUpload = (id: string, file: File | null) => {
    setItems(items.map(item => {
      if(item.id === id) {
        return { ...item, file, filePreviewUrl: file ? URL.createObjectURL(file) : undefined };
      }
      return item;
    }));
  }

  const calculateTotal = () => items.reduce((sum, i) => sum + i.total, 0);

  const uploadFile = async (file: File, companyName: string, type: string): Promise<string> => {
    if (!authToken) {
      showAlert("Sesi habis. Silakan login ulang.");
      return '';
    }
    const formData = new FormData();
    formData.append('companyName', companyName);
    formData.append('type', type);
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
           'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        return data.url;
      } else {
        throw new Error(data.message || 'Upload gagal');
      }
    } catch (err) {
      console.error('Upload Error:', err);
      return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // --- AUTOSAVE LOGIC ---
    if (editingItemId) {
      const itemBeingEdited = items.find(i => i.id === editingItemId);
      if (itemBeingEdited) {
         if (!itemBeingEdited.name.trim() || itemBeingEdited.qty <= 0) {
            showAlert("Mohon lengkapi Nama Item dan Qty pada baris yang sedang diedit.");
            return;
         }
         // Valid, proceed as if saved
      }
    }

    if (items.length === 0) return showAlert("Minimal 1 item reimburse.");
    if (!category) return showAlert("Silakan pilih kategori.");
    if (!companyId) return showAlert("Silakan pilih perusahaan.");

    setIsSubmitting(true);

    try {
      // Find Company Name
      const selectedCompany = companies.find(c => c.id === companyId);
      const companyName = selectedCompany ? selectedCompany.name : 'General';

      // Process items and upload files if present
      const processedItems = await Promise.all(items.map(async (item) => {
        let fileUrl = item.filePreviewUrl; 
        if (item.file) {
          const uploadedUrl = await uploadFile(item.file, companyName, 'reimburse');
          if (uploadedUrl) {
            fileUrl = uploadedUrl; 
          }
        }
        const { file, ...rest } = item;
        return { ...rest, filePreviewUrl: fileUrl };
      }));

      const reimbData: Reimbursement = {
        id: editingReimbId || generateId(),
        date,
        requestorName,
        category,
        companyId: companyId!,
        activityName,
        description,
        items: processedItems,
        grandTotal: calculateTotal(),
        status: 'PENDING', 
        timestamp: Date.now()
      };

      if (editingReimbId) {
          onUpdateReimbursementDetails(reimbData);
          showAlert("Data reimburse berhasil diperbarui", "success");
      } else {
          onAddReimbursement(reimbData);
      }

      setView('LIST');
      resetForm();
    } catch (error) {
      console.error("Gagal menyimpan reimburse:", error);
      showAlert("Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingReimbId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setRequestorName('');
    setCategory('');
    setCompanyId(undefined);
    setActivityName('');
    setDescription('');
    setItems([]);
    setEditingItemId(null);
  };

  // --- EDIT & DELETE HANDLERS ---
  const handleEdit = (e: React.MouseEvent, r: Reimbursement) => {
    e.stopPropagation();
    if (r.status !== 'PENDING') {
        showAlert("Hanya pengajuan berstatus PENDING yang dapat diedit.");
        return;
    }
    setEditingReimbId(r.id);
    setDate(r.date);
    setRequestorName(r.requestorName);
    setCategory(r.category);
    setCompanyId(r.companyId);
    setActivityName(r.activityName);
    setDescription(r.description);
    setItems(r.items.map(i => ({...i})));
    setView('FORM');
  };

  const handleDelete = (e: React.MouseEvent, r: Reimbursement) => {
    e.stopPropagation();
    if (r.status !== 'PENDING') {
        showAlert("Hanya pengajuan berstatus PENDING yang dapat dihapus.");
        return;
    }
    showConfirm("Yakin ingin menghapus pengajuan reimburse ini?", () => {
        onDeleteReimbursement(r.id);
    }, "Hapus Reimburse", true);
  };

  const getStatusColor = (status: ReimbursementStatus) => {
    switch (status) {
      case 'PENDING': return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
      case 'PROSES': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
      case 'BERHASIL': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'DITOLAK': return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusIcon = (status: ReimbursementStatus) => {
    switch (status) {
      case 'PENDING': return <Clock size={14} className="mr-1"/>;
      case 'PROSES': return <Loader size={14} className="mr-1 animate-spin-slow"/>;
      case 'BERHASIL': return <CheckCircle size={14} className="mr-1"/>;
      case 'DITOLAK': return <XCircle size={14} className="mr-1"/>;
    }
  };

  // Handle Update Status Logic (Admin Action)
  const openDetail = (r: Reimbursement) => {
    setSelectedReimb(r);
    setTempStatus(r.status);
    setTransferProofFile(null);
    setRejectionReason(r.rejectionReason || '');
  }

  const handleUpdateStatus = async () => {
    if (!selectedReimb || !tempStatus) return;

    // Validation for Success
    if (tempStatus === 'BERHASIL' && !transferProofFile && !selectedReimb.transferProofUrl) {
      showAlert('Wajib upload bukti transfer untuk mengubah status menjadi Berhasil.');
      return;
    }

    // Validation for Rejected
    if (tempStatus === 'DITOLAK' && !rejectionReason.trim()) {
      showAlert('Wajib mengisi alasan penolakan jika status Ditolak.');
      return;
    }

    setIsSubmitting(true);

    try {
        let proofUrl = selectedReimb.transferProofUrl;
        
        // Find Company Name for Transfer Proof (Assuming same company as reimbursement)
        // Since we are in list/modal view, we might not have the full company list easily accessible 
        // OR we can rely on selectedReimb.companyId. 
        // We have 'companies' prop.
        const selectedCompany = companies.find(c => c.id === selectedReimb.companyId);
        const companyName = selectedCompany ? selectedCompany.name : 'General';

        // Upload proof if new file selected
        if (transferProofFile) {
            const uploadedUrl = await uploadFile(transferProofFile, companyName, 'reimburse');
            if (uploadedUrl) {
                proofUrl = uploadedUrl;
            }
        }

        const updatedReimb: Reimbursement = {
            ...selectedReimb,
            status: tempStatus,
            transferProofUrl: proofUrl,
            rejectionReason: tempStatus === 'DITOLAK' ? rejectionReason : undefined
        };

        onUpdateReimbursement(updatedReimb);
        setSelectedReimb(null); // Close modal
    } catch(e) {
        showAlert("Gagal update status");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Tambah Reimburse</h2>
        {view === 'LIST' ? (
          <button 
            onClick={() => { resetForm(); setView('FORM'); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium"
          >
            <Plus size={18} /> Ajukan Reimburse
          </button>
        ) : (
          <button onClick={() => { resetForm(); setView('LIST'); }} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors font-medium">Kembali</button>
        )}
      </div>

      {view === 'FORM' ? (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 space-y-6 animate-fade-in transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tanggal Pengajuan</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border p-2.5 focus:ring-blue-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Pengaju</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input type="text" required placeholder="Nama Lengkap" value={requestorName} onChange={e => setRequestorName(e.target.value)} className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border p-2.5 pl-10 focus:ring-blue-500 outline-none transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Perusahaan (PT)</label>
              <select 
                required
                value={companyId || ''} 
                onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border p-2.5 outline-none transition-colors"
              >
                <option value="" disabled>Pilih Perusahaan</option>
                {companies.map((comp) => (
                  <option key={comp.id} value={comp.id}>{comp.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kategori</label>
              <select 
                required 
                value={category} 
                onChange={e => setCategory(e.target.value)} 
                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border p-2.5 outline-none transition-colors"
              >
                <option value="" disabled>Pilih Kategori</option>
                {categories.map((cat, idx) => (
                  <option key={idx} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Kegiatan</label>
              <input type="text" required value={activityName} onChange={e => setActivityName(e.target.value)} className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border p-2.5 outline-none transition-colors" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Keterangan</label>
              <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border p-2.5 outline-none transition-colors"></textarea>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
             <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Detail Item Reimburse</h3>
              <button type="button" onClick={addItem} className="text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 font-medium transition-colors">+ Tambah Item</button>
            </div>
            <div className="space-y-4">
              {items.map(item => {
                const isEditing = editingItemId === item.id;
                return (
                  <div key={item.id} className={`p-4 rounded-lg border border-slate-200 dark:border-slate-600 grid grid-cols-1 md:grid-cols-12 gap-4 items-center transition-colors ${isEditing ? 'bg-white dark:bg-slate-700 shadow-md ring-1 ring-blue-500/30' : 'even:bg-slate-50 dark:even:bg-slate-700/50 bg-white dark:bg-slate-800'}`}>
                     {isEditing ? (
                        <>
                          <div className="md:col-span-4">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Keterangan Barang/Jasa</label>
                            <input type="text" required value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded text-sm outline-none focus:border-blue-500" autoFocus />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Qty</label>
                            <input type="number" required min="1" value={item.qty} onChange={e => updateItem(item.id, 'qty', parseInt(e.target.value)||0)} className="w-full p-2 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded text-sm outline-none focus:border-blue-500" />
                          </div>
                          <div className="md:col-span-3">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Harga</label>
                            <input type="number" required min="0" value={item.price} onChange={e => updateItem(item.id, 'price', parseInt(e.target.value)||0)} className="w-full p-2 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded text-sm outline-none focus:border-blue-500" />
                          </div>
                          <div className="md:col-span-3">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Total</label>
                            <div className="w-full p-2 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-200 rounded text-sm font-medium">{formatCurrency(item.total)}</div>
                          </div>
                          <div className="md:col-span-12 flex justify-between pt-2 border-t border-slate-100 dark:border-slate-600 border-dashed mt-2">
                              <div className="flex items-center gap-3">
                                <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm">
                                    <UploadCloud size={14} /> 
                                    Upload Bukti
                                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => handleFileUpload(item.id, e.target.files?.[0] || null)} />
                                </label>
                                {item.file && <span className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate max-w-[150px]">{item.file.name}</span>}
                              </div>
                              
                              <div className="flex gap-2">
                                <button type="button" onClick={() => removeItem(item.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" title="Hapus"><Trash2 size={16}/></button>
                                <button type="button" onClick={() => handleSaveItem(item.id)} className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm" title="Simpan Item"><Check size={16}/></button>
                              </div>
                          </div>
                        </>
                     ) : (
                        <>
                          <div className="md:col-span-4">
                             <p className="text-xs text-slate-400 mb-0.5">Item</p>
                             <p className="font-medium text-slate-800 dark:text-slate-200">{item.name}</p>
                          </div>
                          <div className="md:col-span-2">
                             <p className="text-xs text-slate-400 mb-0.5">Qty</p>
                             <p className="text-slate-700 dark:text-slate-300">{item.qty}</p>
                          </div>
                          <div className="md:col-span-3">
                             <p className="text-xs text-slate-400 mb-0.5">Harga</p>
                             <p className="text-slate-700 dark:text-slate-300">{formatCurrency(item.price)}</p>
                          </div>
                          <div className="md:col-span-3 flex justify-between items-center">
                             <div>
                                <p className="text-xs text-slate-400 mb-0.5">Total</p>
                                <p className="font-bold text-slate-800 dark:text-white">{formatCurrency(item.total)}</p>
                             </div>
                             
                             <div className="flex gap-2">
                                {item.filePreviewUrl && (
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setPreviewImage(item.filePreviewUrl || null);
                                    }} 
                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" 
                                    title="Lihat Bukti"
                                  >
                                    <FileText size={16} />
                                  </button>
                                )}
                                <button type="button" onClick={() => setEditingItemId(item.id)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded" title="Edit">
                                  <Pencil size={16} />
                                </button>
                                <button type="button" onClick={() => removeItem(item.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded" title="Hapus">
                                  <Trash2 size={16} />
                                </button>
                             </div>
                          </div>
                        </>
                     )}
                  </div>
                );
              })}
            </div>
             <div className="flex justify-end mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
               <div className="text-right">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Grand Total Reimburse</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(calculateTotal())}</p>
               </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" disabled={isSubmitting} onClick={() => { resetForm(); setView('LIST'); }} className="px-6 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">Batal</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm shadow-blue-200 dark:shadow-none transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                {isSubmitting ? 'Memproses...' : <><Save size={18}/> {editingReimbId ? 'Update Pengajuan' : 'Simpan Pengajuan'}</>}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Tanggal</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Pengaju</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Kegiatan</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Items</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Total</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {reimbursements.length > 0 ? (
                  reimbursements.sort((a,b)=> b.timestamp - a.timestamp).map(r => (
                    <tr 
                      key={r.id} 
                      onClick={() => openDetail(r)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors even:bg-slate-50 dark:even:bg-slate-800 cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{formatDate(r.date)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">{r.requestorName}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        <div>{r.activityName}</div>
                        <div className="text-xs text-slate-400">{r.category}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{r.items.length} Item</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-800 dark:text-slate-200">{formatCurrency(r.grandTotal)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(r.status)}`}>
                          {getStatusIcon(r.status)} {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                           <button 
                             onClick={(e) => {
                                e.stopPropagation();
                                openDetail(r);
                             }}
                             className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg transition-colors"
                             title="Lihat Detail"
                           >
                             <Eye size={18} />
                           </button>
                           {/* Allow Edit/Delete only if Status is PENDING */}
                           {r.status === 'PENDING' && (
                             <>
                               <button 
                                 onClick={(e) => handleEdit(e, r)}
                                 className="text-slate-500 hover:text-blue-600 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                 title="Edit"
                               >
                                 <Pencil size={18} />
                               </button>
                               <button 
                                 onClick={(e) => handleDelete(e, r)}
                                 className="text-slate-500 hover:text-rose-600 p-1 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                 title="Hapus"
                               >
                                 <Trash2 size={18} />
                               </button>
                             </>
                           )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-400 dark:text-slate-500">Belum ada data reimburse</td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* DETAIL MODAL */}
          {selectedReimb && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
                   <div>
                     <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                       Detail Reimburse
                       <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${getStatusColor(selectedReimb.status)}`}>
                         {selectedReimb.status}
                       </span>
                     </h3>
                     <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">ID: {selectedReimb.id}</p>
                   </div>
                   <button onClick={() => setSelectedReimb(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                     <X size={24} />
                   </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-6">
                  {/* Rejection Alert if Rejected */}
                  {selectedReimb.status === 'DITOLAK' && selectedReimb.rejectionReason && (
                    <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-lg border border-rose-200 dark:border-rose-800 flex gap-3">
                      <AlertCircle className="text-rose-600 dark:text-rose-400 shrink-0" size={24} />
                      <div>
                        <h4 className="font-bold text-rose-700 dark:text-rose-300">Pengajuan Ditolak</h4>
                        <p className="text-sm text-rose-600 dark:text-rose-400 mt-1">{selectedReimb.rejectionReason}</p>
                      </div>
                    </div>
                  )}

                  {/* Info Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Pengaju</p>
                      <p className="font-medium text-slate-800 dark:text-white">{selectedReimb.requestorName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Tanggal</p>
                      <p className="font-medium text-slate-800 dark:text-white">{formatDate(selectedReimb.date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Kegiatan</p>
                      <p className="font-medium text-slate-800 dark:text-white">{selectedReimb.activityName}</p>
                      <p className="text-xs text-slate-500">{selectedReimb.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Keterangan</p>
                      <p className="font-medium text-slate-800 dark:text-white">{selectedReimb.description || '-'}</p>
                    </div>
                  </div>

                  {/* Items List */}
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-white mb-3">Item Pengajuan</h4>
                    <div className="border rounded-lg border-slate-200 dark:border-slate-700 overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-semibold">
                          <tr>
                            <th className="px-4 py-2">Item</th>
                            <th className="px-4 py-2 text-center">Qty</th>
                            <th className="px-4 py-2 text-right">Harga</th>
                            <th className="px-4 py-2 text-right">Total</th>
                            <th className="px-4 py-2 text-center">Bukti</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                          {selectedReimb.items.map((item, idx) => (
                            <tr key={idx} className="even:bg-slate-50 dark:even:bg-slate-700">
                              <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{item.name}</td>
                              <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400">{item.qty}</td>
                              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{formatCurrency(item.price)}</td>
                              <td className="px-4 py-2 text-right font-medium text-slate-800 dark:text-slate-200">{formatCurrency(item.total)}</td>
                              <td className="px-4 py-2 text-center">
                                {item.filePreviewUrl ? (
                                  <button 
                                    onClick={() => setPreviewImage(item.filePreviewUrl || null)}
                                    className="text-blue-500 hover:underline flex justify-center"
                                  >
                                    <FileText size={16}/>
                                  </button>
                                ) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 dark:bg-slate-700/50 font-bold text-slate-800 dark:text-white border-t border-slate-200 dark:border-slate-700">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-right">Grand Total</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(selectedReimb.grandTotal)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* ADMIN ACTION SECTION */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                       <User size={18} /> Aksi Admin
                    </h4>
                    
                    {/* LOGIC: Jika sudah BERHASIL, Lock. Jika belum, tampilkan kontrol */}
                    {selectedReimb.status === 'BERHASIL' ? (
                       <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            <Lock size={18} /> Status Final: BERHASIL
                          </div>
                          <p className="text-xs text-slate-500 ml-1">Data yang sudah berhasil tidak dapat diubah kembali.</p>

                          {selectedReimb.transferProofUrl && (
                            <div className="mt-2">
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Bukti Transfer:</p>
                              <button 
                                onClick={() => setPreviewImage(selectedReimb.transferProofUrl || null)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-blue-600 hover:text-blue-700"
                              >
                                <FileText size={16} /> Lihat Bukti Transfer
                              </button>
                            </div>
                          )}
                       </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-3">
                           {/* Status Controls */}
                           {['PENDING', 'PROSES', 'BERHASIL', 'DITOLAK'].map((s) => (
                             <button
                                key={s}
                                onClick={() => setTempStatus(s as ReimbursementStatus)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                  tempStatus === s 
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                             >
                               {s}
                             </button>
                           ))}
                        </div>

                        {/* Condition for BERHASIL: Upload Proof */}
                        {tempStatus === 'BERHASIL' && (
                          <div className="animate-fade-in p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                               Upload Bukti Transfer <span className="text-rose-500">*</span>
                             </label>
                             <div className="flex items-center gap-3">
                               <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors shadow-sm font-medium">
                                  <UploadCloud size={16} /> Upload Bukti
                                  <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*,.pdf"
                                    onChange={(e) => setTransferProofFile(e.target.files ? e.target.files[0] : null)}
                                  />
                               </label>
                               <span className="text-sm text-slate-500 truncate max-w-[200px]">
                                 {transferProofFile ? transferProofFile.name : (selectedReimb.transferProofUrl ? 'File sudah ada (ganti jika perlu)' : 'Belum ada file dipilih')}
                               </span>
                             </div>
                          </div>
                        )}

                        {/* Condition for DITOLAK: Rejection Reason */}
                        {tempStatus === 'DITOLAK' && (
                          <div className="animate-fade-in">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                              Alasan Penolakan <span className="text-rose-500">*</span>
                            </label>
                            <textarea 
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="Contoh: Bukti struk kurang jelas / Nominal tidak sesuai."
                              rows={3}
                              className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                            ></textarea>
                          </div>
                        )}

                        <div className="pt-2 flex justify-end">
                          <button 
                            onClick={handleUpdateStatus}
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            {isSubmitting ? <Loader size={18} className="animate-spin" /> : <Save size={18} />} Simpan Perubahan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* IMAGE PREVIEW MODAL WITH ERROR HANDLING */}
          {previewImage && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black bg-opacity-90 backdrop-blur-sm animate-fade-in" onClick={() => setPreviewImage(null)}>
              <button className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors" onClick={() => setPreviewImage(null)}>
                <X size={32} />
              </button>
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                 <img 
                  src={previewImage} 
                  alt="Bukti Reimburse" 
                  className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain bg-white"
                  onError={(e) => {
                     const target = e.target as HTMLImageElement;
                     target.onerror = null;
                     target.style.display = 'none';
                     target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden flex flex-col items-center justify-center p-10 bg-white rounded-lg shadow-xl text-slate-500 min-w-[300px] min-h-[200px]">
                    <AlertCircle size={48} className="text-rose-400 mb-3" />
                    <p className="font-medium text-lg text-slate-700">Gambar Tidak Ditemukan</p>
                    <p className="text-sm mt-1">File mungkin telah dihapus atau path salah.</p>
                </div>
              </div>
            </div>
          )}

      {/* GLOBAL MODALS */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={closeConfirm}
        onConfirm={() => {
          confirmState.onConfirm();
          closeConfirm();
        }}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
      />

      <Modal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col items-center justify-center text-center p-4">
            <div className={`p-3 rounded-full mb-4 ${alertState.type === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {alertState.type === 'error' ? <AlertCircle size={32} /> : <CheckCircle size={32} />}
            </div>
            <p className="text-slate-700 dark:text-slate-300 mb-6">{alertState.message}</p>
            <button 
                onClick={closeAlert}
                className="bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
                Tutup
            </button>
        </div>
      </Modal>
    </div>
  );
};

export default ReimbursementPage;