
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Reimbursement } from '../types';
import { formatCurrency } from '../utils';
import { Download, Filter, Printer } from 'lucide-react';

interface ReportProps {
  transactions: Transaction[];
  reimbursements: Reimbursement[];
  fixedFilterType?: string; // If present, locks the filter dropdown
}

const Report: React.FC<ReportProps> = ({ transactions, reimbursements, fixedFilterType }) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Handle fixed filter
  useEffect(() => {
    if (fixedFilterType) {
      setFilterType(fixedFilterType);
    } else {
      setFilterType('ALL');
    }
  }, [fixedFilterType]);

  // Merge Data for reporting
  const reportData = useMemo(() => {
    let data = [
      ...transactions.map(t => ({
        id: t.id,
        date: t.date,
        type: t.type,
        subType: t.expenseType || 'NORMAL',
        category: t.category,
        activity: t.activityName,
        total: t.grandTotal,
        desc: t.description,
        timestamp: t.timestamp,
        source: 'JURNAL'
      })),
      // ONLY include Reimbursements that are BERHASIL (Approved)
      ...reimbursements
        .filter(r => r.status === 'BERHASIL')
        .map(r => ({
          id: r.id,
          date: r.date,
          type: 'PENGELUARAN',
          subType: 'REIMBURSE',
          category: r.category,
          activity: r.activityName,
          total: r.grandTotal,
          desc: `Reimburse oleh: ${r.requestorName} - ${r.description}`,
          timestamp: r.timestamp,
          source: 'REIMBURSE_MODULE'
        }))
    ];

    // Filter Logic
    if (startDate) data = data.filter(d => d.date >= startDate);
    if (endDate) data = data.filter(d => d.date <= endDate);
    if (filterType !== 'ALL') data = data.filter(d => d.type === filterType || (filterType === 'REIMBURSE' && d.subType === 'REIMBURSE'));
    if (categoryFilter) data = data.filter(d => d.category.toLowerCase().includes(categoryFilter.toLowerCase()));

    return data.sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, reimbursements, startDate, endDate, filterType, categoryFilter]);

  const summary = useMemo(() => {
    return {
      income: reportData.filter(d => d.type === 'PEMASUKAN').reduce((s, d) => s + d.total, 0),
      expense: reportData.filter(d => d.type === 'PENGELUARAN').reduce((s, d) => s + d.total, 0),
      reimburse: reportData.filter(d => d.subType === 'REIMBURSE').reduce((s, d) => s + d.total, 0),
    };
  }, [reportData]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Tanggal', 'Jenis', 'Sub Jenis', 'Kategori', 'Kegiatan', 'Deskripsi', 'Total'];
    const rows = reportData.map(d => [
      d.date, 
      d.type, 
      d.subType, 
      d.category, 
      d.activity, 
      `"${d.desc}"`, 
      d.total
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_keuangan_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPageTitle = () => {
    if (fixedFilterType === 'PENGELUARAN') return 'Laporan Pengeluaran (Cash Out)';
    return 'Laporan Keuangan';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{getPageTitle()}</h2>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
            <Download size={18} /> Excel
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors">
            <Printer size={18} /> PDF / Print
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-4 transition-colors">
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Dari Tanggal</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Sampai Tanggal</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm outline-none focus:border-blue-500" />
        </div>
        
        {/* Hide report type dropdown if fixedFilterType is present */}
        {!fixedFilterType && (
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Jenis Laporan</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm outline-none focus:border-blue-500">
              <option value="ALL">Semua Transaksi</option>
              <option value="PEMASUKAN">Pemasukan</option>
              <option value="PENGELUARAN">Pengeluaran</option>
              <option value="REIMBURSE">Khusus Reimburse</option>
            </select>
          </div>
        )}

        <div>
           <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Cari Kategori</label>
           <div className="relative">
             <Filter className="absolute left-2.5 top-2.5 text-slate-400" size={14}/>
             <input type="text" placeholder="Filter Kategori..." value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full p-2 pl-8 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm outline-none focus:border-blue-500" />
           </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(!fixedFilterType || fixedFilterType === 'PEMASUKAN') && (
           <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800">
             <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Total Pemasukan</p>
             <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(summary.income)}</p>
           </div>
        )}
        
        {(!fixedFilterType || fixedFilterType === 'PENGELUARAN') && (
          <>
            <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-lg border border-rose-100 dark:border-rose-800">
              <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold uppercase">Total Pengeluaran (Cash)</p>
              <p className="text-xl font-bold text-rose-700 dark:text-rose-300">{formatCurrency(summary.expense - summary.reimburse)}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-800">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase">Total Reimburse (Cair)</p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(summary.reimburse)}</p>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-600">
               <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold uppercase">Total Cash Out</p>
               <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{formatCurrency(summary.expense)}</p>
             </div>
          </>
        )}
        
        {!fixedFilterType && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase">Saldo Periode Ini</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(summary.income - summary.expense)}</p>
          </div>
        )}
      </div>

      {/* Report Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Tanggal</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Jenis</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Kategori & Kegiatan</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Keterangan</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {reportData.length > 0 ? (
                reportData.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{d.date}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          d.type === 'PEMASUKAN' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                        }`}>
                          {d.type}
                        </span>
                        {d.subType === 'REIMBURSE' && (
                          <span className="inline-flex w-fit items-center px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            REIMBURSE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <div className="font-medium text-slate-700 dark:text-slate-300">{d.activity}</div>
                      <div className="text-xs text-slate-400">{d.category}</div>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {d.desc}
                    </td>
                    <td className={`px-6 py-3 text-sm font-bold text-right ${d.type === 'PEMASUKAN' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                      {formatCurrency(d.total)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 dark:text-slate-500">
                    Tidak ada data laporan yang sesuai filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Report;
