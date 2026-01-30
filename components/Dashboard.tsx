
import React, { useMemo, useState } from 'react';
import { Transaction, Reimbursement } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, X, Calendar, Tag, FileText, Plus, File } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardProps {
  transactions: Transaction[];
  reimbursements: Reimbursement[];
  isDarkMode: boolean;
  filterType?: 'ALL' | 'INCOME' | 'EXPENSE';
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, reimbursements, isDarkMode, filterType = 'ALL' }) => {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  const stats = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === 'PEMASUKAN')
      .reduce((sum, t) => sum + t.grandTotal, 0);

    const totalExpense = transactions
      .filter(t => t.type === 'PENGELUARAN')
      .reduce((sum, t) => sum + t.grandTotal, 0);

    // Only count PENDING reimbursements for the "Pending" card
    const totalReimbursePending = reimbursements
      .filter(r => r.status === 'PENDING')
      .reduce((sum, r) => sum + r.grandTotal, 0);
    
    const balance = totalIncome - totalExpense;

    return { totalIncome, totalExpense, totalReimbursePending, balance };
  }, [transactions, reimbursements]);

  const chartData = useMemo(() => {
    // Filter transactions based on view type
    let filteredTransactions = transactions;
    if (filterType === 'INCOME') {
      filteredTransactions = transactions.filter(t => t.type === 'PEMASUKAN');
    } else if (filterType === 'EXPENSE') {
      filteredTransactions = transactions.filter(t => t.type === 'PENGELUARAN');
    }

    // Group by category for a simple chart
    const data: Record<string, number> = {};
    
    filteredTransactions.forEach(t => {
      if (!data[t.category]) data[t.category] = 0;
      data[t.category] += t.grandTotal;
    });

    return Object.keys(data).map(key => ({
      name: key,
      value: data[key],
    })).slice(0, 5); // Top 5
  }, [transactions, filterType]);

  const getTitle = () => {
    if (filterType === 'INCOME') return 'Statistik Pemasukan';
    if (filterType === 'EXPENSE') return 'Statistik Pengeluaran';
    return 'Dashboard Ringkasan';
  }

  const getChartTitle = () => {
    if (filterType === 'INCOME') return 'Pemasukan per Kategori';
    if (filterType === 'EXPENSE') return 'Pengeluaran per Kategori';
    return 'Transaksi per Kategori';
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{getTitle()}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(filterType === 'ALL' || filterType === 'INCOME') && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 relative overflow-hidden transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total Pemasukan</p>
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.totalIncome)}</h3>
              </div>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={24} />
              </div>
            </div>
          </div>
        )}

        {(filterType === 'ALL' || filterType === 'EXPENSE') && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 relative overflow-hidden transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total Pengeluaran</p>
                <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400">{formatCurrency(stats.totalExpense)}</h3>
              </div>
              <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400">
                <TrendingDown size={24} />
              </div>
            </div>
          </div>
        )}

        {(filterType === 'ALL' || filterType === 'EXPENSE') && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 relative overflow-hidden transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total Reimburse (Pending)</p>
                <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(stats.totalReimbursePending)}</h3>
              </div>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                <AlertCircle size={24} />
              </div>
            </div>
          </div>
        )}

        {filterType === 'ALL' && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 relative overflow-hidden transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Saldo Akhir</p>
                <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(stats.balance)}</h3>
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                <Wallet size={24} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 transition-colors">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Transaksi Terakhir</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  <th className="pb-3 px-3">Tanggal</th>
                  <th className="pb-3 px-3">Kategori</th>
                  <th className="pb-3 px-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {transactions
                  .filter(t => filterType === 'ALL' || (filterType === 'INCOME' && t.type === 'PEMASUKAN') || (filterType === 'EXPENSE' && t.type === 'PENGELUARAN'))
                  .slice(0, 5).map((t) => (
                  <tr 
                    key={t.id} 
                    onClick={() => setSelectedTransaction(t)}
                    className="text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors even:bg-slate-50 dark:even:bg-slate-800 cursor-pointer"
                    title="Klik untuk melihat detail"
                  >
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{formatDate(t.date)}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        t.type === 'PEMASUKAN' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                      }`}>
                        {t.category}
                      </span>
                    </td>
                    <td className={`py-3 px-3 text-right font-medium ${t.type === 'PEMASUKAN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {t.type === 'PEMASUKAN' ? '+' : '-'} {formatCurrency(t.grandTotal)}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-400 dark:text-slate-500">Belum ada data transaksi</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 transition-colors">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{getChartTitle()}</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                <XAxis 
                  dataKey="name" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }} 
                />
                <YAxis 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `${value / 1000}k`} 
                  tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }} 
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  cursor={{ fill: isDarkMode ? '#334155' : '#f8fafc' }}
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1e293b' : '#fff', 
                    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                    color: isDarkMode ? '#f1f5f9' : '#1e293b'
                  }}
                  itemStyle={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}
                />
                <Bar dataKey="value" fill={filterType === 'INCOME' ? '#10b981' : filterType === 'EXPENSE' ? '#f43f5e' : '#3b82f6'} radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={
                      filterType === 'INCOME' ? (index % 2 === 0 ? '#10b981' : '#34d399') :
                      filterType === 'EXPENSE' ? (index % 2 === 0 ? '#f43f5e' : '#fb7185') :
                      (index % 2 === 0 ? '#3b82f6' : '#60a5fa')
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

       {/* DETAIL MODAL (Reused from Journal) */}
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
                                  <a 
                                    href={item.filePreviewUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()} // Prevent row click
                                  >
                                    <File size={14}/> Lihat
                                  </a>
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
    </div>
  );
};

export default Dashboard;
