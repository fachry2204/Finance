
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, ExpenseType, ItemDetail } from '../types';
import { generateId, formatCurrency, formatDate } from '../utils';
import { Plus, Trash2, Save, UploadCloud, FileText, X, Calendar, Tag, File, Pencil, Check } from 'lucide-react';

interface JournalProps {
  onAddTransaction: (transaction: Transaction) => void;
  transactions: Transaction[];
  defaultType?: TransactionType;
  filterType?: TransactionType; // New prop to filter list view
  initialView?: 'LIST' | 'FORM';
  categories: string[]; // List of categories for dropdown
}

const Journal: React.FC<JournalProps> = ({ 
  onAddTransaction, 
  transactions, 
  defaultType = 'PENGELUARAN',
  filterType,
  initialView = 'LIST',
  categories
}) => {
  const [view, setView] = useState<'LIST' | 'FORM'>(initialView);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<TransactionType>(defaultType);
  const [expenseType, setExpenseType] = useState<ExpenseType>('NORMAL');
  const [category, setCategory] = useState('');
  const [activityName, setActivityName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ItemDetail[]>([]);
  
  // Item Editing State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Image Preview Modal State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Update state when props change
  useEffect(() => {
    setView(initialView);
    setType(defaultType);
    if (defaultType === 'PENGELUARAN') {
      setExpenseType('NORMAL');
    }
  }, [initialView, defaultType]);

  // Filter transactions for the list view
  const filteredTransactions = useMemo(() => {
    if (!filterType) return transactions;
    return transactions.filter(t => t.type === filterType);
  }, [transactions, filterType]);

  // Add Item
  const addItem = () => {
    const newId = generateId();
    setItems([
      ...items,
      { id: newId, name: '', qty: 1, price: 0, total: 0 }
    ]);
    setEditingItemId(newId); // Auto enter edit mode
  };

  // Remove Item
  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    if (editingItemId === id) setEditingItemId(null);
  };

  // Save Item (Exit Edit Mode)
  const handleSaveItem = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (!item.name.trim() || item.qty <= 0) {
       alert("Mohon lengkapi nama item dan quantity minimal 1");
       return;
    }
    setEditingItemId(null);
  };

  // Update Item
  const updateItem = (id: string, field: keyof ItemDetail, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'qty' || field === 'price') {
          updatedItem.total = Number(updatedItem.qty) * Number(updatedItem.price);
        }
        return updatedItem;
      }
      return item;
    }));
  };

  // Handle File Upload
  const handleFileUpload = (id: string, file: File | null) => {
    setItems(items.map(item => {
      if(item.id === id) {
        const url = file ? URL.createObjectURL(file) : undefined;
        return { ...item, file, filePreviewUrl: url };
      }
      return item;
    }));
  }

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
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
    if (editingItemId) {
      alert("Mohon simpan (klik centang) pada item yang sedang diedit terlebih dahulu.");
      return;
    }
    if (!category || !activityName || items.length === 0) {
      alert("Mohon lengkapi data wajib dan minimal 1 item.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Process items and upload files if present
      const processedItems = await Promise.all(items.map(async (item) => {
        let fileUrl = item.filePreviewUrl; // Default to existing object URL or undefined
        if (item.file) {
          const uploadedUrl = await uploadFile(item.file);
          if (uploadedUrl) {
            fileUrl = uploadedUrl; // Use relative path from server
          }
        }
        // Return item without the raw File object to keep JSON clean
        const { file, ...rest } = item;
        return { ...rest, filePreviewUrl: fileUrl };
      }));

      const newTransaction: Transaction = {
        id: generateId(),
        date,
        type,
        expenseType: type === 'PENGELUARAN' ? expenseType : undefined,
        category,
        activityName,
        description,
        items: processedItems,
        grandTotal: calculateGrandTotal(),
        timestamp: Date.now()
      };

      onAddTransaction(newTransaction);
      setView('LIST');
      resetForm();
    } catch (error) {
      console.error("Gagal menyimpan transaksi:", error);
      alert("Terjadi kesalahan saat menyimpan transaksi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setCategory('');
    setActivityName('');
    setDescription('');
    setItems([]);
    setEditingItemId(null);
  };

  const getTitle = () => {
     if (view === 'FORM') {
        return type === 'PEMASUKAN' ? 'Tambah Pemasukan' : 'Tambah Pengeluaran';
     }
     if (filterType === 'PENGELUARAN') return 'Data Pengeluaran';
     if (filterType === 'PEMASUKAN') return 'Data Pemasukan';
     return 'Daftar Jurnal Transaksi';
  }

  const getButtonLabel = () => {
    if (filterType === 'PENGELUARAN') return '+ Tambah Pengeluaran';
    if (filterType === 'PEMASUKAN') return '+ Tambah Pemasukan';
    return '+ Tambah Transaksi';
  }

  // Check if we are in specific mode (via filterType) to hide general dropdowns in form
  const isSpecificMode = !!filterType;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{getTitle()}</h2>
        {view === 'LIST' ? (
          <button 
            onClick={() => setView('FORM')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium"
          >
            {getButtonLabel()}
          </button>
        ) : (
             <button 
              onClick={() => setView('LIST')}
              className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Kembali
            </button>
        )}
      </div>

      {view === 'FORM' ? (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 space-y-6 animate-fade-in transition-colors">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tanggal</label>
              <input 
                type="date" 
                required
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              />
            </div>

            {/* Hide dropdowns if in specific ADD mode */}
            {!isSpecificMode && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Jenis Transaksi</label>
                  <select 
                    value={type} 
                    onChange={(e) => setType(e.target.value as TransactionType)}
                    className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                  >
                    <option value="PEMASUKAN">Pemasukan</option>
                    <option value="PENGELUARAN">Pengeluaran</option>
                  </select>
                </div>
                {type === 'PENGELUARAN' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Jenis Pengeluaran</label>
                    <select 
                      value={expenseType} 
                      onChange={(e) => setExpenseType(e.target.value as ExpenseType)}
                      className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="REIMBURSE">Reimburse</option>
                    </select>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kategori Kegiatan</label>
              <select 
                required
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              >
                <option value="" disabled>Pilih Kategori</option>
                {categories.map((cat, idx) => (
                  <option key={idx} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Kegiatan</label>
              <input 
                type="text" 
                required
                placeholder="Contoh: Pembelian ATK Bulanan"
                value={activityName} 
                onChange={(e) => setActivityName(e.target.value)}
                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Keterangan Tambahan</label>
              <textarea 
                rows={2}
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              ></textarea>
            </div>
          </div>

          {/* Items Section */}
          <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Detail Item</h3>
              <button 
                type="button"
                onClick={addItem}
                className="text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 font-medium transition-colors"
              >
                + Tambah Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item) => {
                const isEditing = editingItemId === item.id;
                return (
                  <div key={item.id} className={`p-4 rounded-lg border border-slate-200 dark:border-slate-600 grid grid-cols-1 md:grid-cols-12 gap-4 items-center relative transition-colors ${isEditing ? 'bg-white dark:bg-slate-700 shadow-md ring-1 ring-blue-500/30' : 'even:bg-slate-50 dark:even:bg-slate-700/50 bg-white dark:bg-slate-800'}`}>
                    
                    {isEditing ? (
                      // --- EDIT MODE ---
                      <>
                        <div className="md:col-span-4">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Nama Item</label>
                          <input 
                            type="text" 
                            placeholder="Nama barang/jasa"
                            value={item.name}
                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                            className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-blue-500 transition-colors"
                            autoFocus
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Qty</label>
                          <input 
                            type="number" 
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value) || 0)}
                            className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Harga Satuan</label>
                          <input 
                            type="number" 
                            min="0"
                            value={item.price}
                            onChange={(e) => updateItem(item.id, 'price', parseInt(e.target.value) || 0)}
                            className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div className="md:col-span-3 flex justify-between items-end">
                           <div className="w-full">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Total</label>
                              <div className="w-full p-2 bg-slate-100 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200">
                                {formatCurrency(item.total)}
                              </div>
                           </div>
                        </div>

                        {/* File Upload Row for Edit Mode */}
                        <div className="md:col-span-12 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-600 border-dashed mt-2">
                          <div className="flex items-center gap-3">
                            <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm">
                                <UploadCloud size={14} />
                                Upload Bukti
                                <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => handleFileUpload(item.id, e.target.files ? e.target.files[0] : null)} />
                            </label>
                            {item.file && <span className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate max-w-[150px]">{item.file.name}</span>}
                          </div>
                          
                          <div className="flex gap-2">
                             <button type="button" onClick={() => removeItem(item.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" title="Hapus">
                               <Trash2 size={16} />
                             </button>
                             <button type="button" onClick={() => handleSaveItem(item.id)} className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm" title="Simpan Item">
                               <Check size={16} />
                             </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      // --- VIEW MODE ---
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

              {items.length === 0 && (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                  Belum ada item ditambahkan
                </div>
              )}
            </div>
            
            <div className="flex justify-end mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
               <div className="text-right">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Grand Total</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(calculateGrandTotal())}</p>
               </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <button 
              type="button"
              disabled={isSubmitting}
              onClick={() => setView('LIST')}
              className="px-6 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm shadow-blue-200 dark:shadow-none transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Menyimpan...' : ( <><Save size={18} /> Simpan Transaksi</> )}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Tanggal</th>
                    {!filterType && <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Jenis</th>}
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Kategori</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Kegiatan</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Item</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Total</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">Bukti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.sort((a,b) => b.timestamp - a.timestamp).map((t) => (
                      <tr 
                        key={t.id} 
                        onClick={() => setSelectedTransaction(t)}
                        className="hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer even:bg-slate-50 dark:even:bg-slate-800"
                        title="Klik untuk melihat detail"
                      >
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{formatDate(t.date)}</td>
                        {!filterType && (
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              t.type === 'PEMASUKAN' 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            }`}>
                              {t.type}
                            </span>
                          </td>
                        )}
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{t.category}</td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                          <div className="font-medium">{t.activityName}</div>
                          <div className="text-xs text-slate-400 truncate max-w-[200px]">{t.description}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                          {t.items.length} Item
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-800 dark:text-slate-200 text-right">
                          {formatCurrency(t.grandTotal)}
                        </td>
                        <td className="px-6 py-4 text-center">
                           {t.items.some(i => i.filePreviewUrl) ? (
                              <div className="flex justify-center gap-1">
                                  {t.items.filter(i => i.filePreviewUrl).map((i, idx) => (
                                      <button 
                                        key={idx} 
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setPreviewImage(i.filePreviewUrl || null);
                                        }}
                                        className="text-blue-500 p-1 hover:text-blue-700" 
                                        title={i.name}
                                      >
                                          <FileText size={16} />
                                      </button>
                                  ))}
                              </div>
                           ) : <span className="text-slate-300 dark:text-slate-600">-</span>}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={filterType ? 6 : 7} className="px-6 py-10 text-center text-slate-400 dark:text-slate-500">
                        Belum ada data {filterType ? filterType.toLowerCase() : 'jurnal'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DETAIL MODAL */}
          {selectedTransaction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Detail Transaksi</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">ID: {selectedTransaction.id}</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedTransaction(null); }} 
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-lg flex items-center gap-3 border ${
                    selectedTransaction.type === 'PEMASUKAN' 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                      : 'bg-rose-50 border-rose-100 text-rose-800'
                  }`}>
                    {selectedTransaction.type === 'PEMASUKAN' ? <Plus size={24} /> : <Tag size={24} />}
                    <div>
                      <p className="text-xs font-bold uppercase opacity-70">Jenis Transaksi</p>
                      <p className="font-bold text-lg">{selectedTransaction.type} {selectedTransaction.expenseType ? `(${selectedTransaction.expenseType})` : ''}</p>
                    </div>
                    <div className="ml-auto text-right">
                       <p className="text-xs font-bold uppercase opacity-70">Total Nilai</p>
                       <p className="font-bold text-lg">{formatCurrency(selectedTransaction.grandTotal)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 flex items-center gap-1 mb-1"><Calendar size={14}/> Tanggal</p>
                      <p className="font-medium text-slate-800">{formatDate(selectedTransaction.date)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 flex items-center gap-1 mb-1"><Tag size={14}/> Kategori</p>
                      <p className="font-medium text-slate-800">{selectedTransaction.category}</p>
                    </div>
                    <div className="col-span-2">
                       <p className="text-slate-500 mb-1">Nama Kegiatan</p>
                       <p className="font-medium text-slate-800">{selectedTransaction.activityName}</p>
                    </div>
                     <div className="col-span-2">
                       <p className="text-slate-500 mb-1">Keterangan</p>
                       <p className="text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100">{selectedTransaction.description || '-'}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><FileText size={18}/> Detail Item</h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                          <tr>
                            <th className="px-4 py-2">Item</th>
                            <th className="px-4 py-2 text-center">Qty</th>
                            <th className="px-4 py-2 text-right">Harga</th>
                            <th className="px-4 py-2 text-right">Total</th>
                            <th className="px-4 py-2 text-center">Bukti</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedTransaction.items.map((item, i) => (
                            <tr key={i} className="even:bg-slate-50">
                              <td className="px-4 py-2">{item.name}</td>
                              <td className="px-4 py-2 text-center">{item.qty}</td>
                              <td className="px-4 py-2 text-right">{formatCurrency(item.price)}</td>
                              <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                              <td className="px-4 py-2 text-center">
                                {item.filePreviewUrl ? (
                                  <button 
                                    onClick={() => setPreviewImage(item.filePreviewUrl || null)}
                                    className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                                  >
                                    <File size={14}/> Lihat
                                  </button>
                                ) : <span className="text-slate-300">-</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* IMAGE PREVIEW MODAL */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black bg-opacity-90 backdrop-blur-sm animate-fade-in" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors" onClick={() => setPreviewImage(null)}>
            <X size={32} />
          </button>
          <img 
            src={previewImage} 
            alt="Preview" 
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain" 
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
};

export default Journal;
