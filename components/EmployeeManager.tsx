import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Search, User as UserIcon, Mail, Phone, Briefcase, Lock, Save, X, RefreshCw, AlertCircle, Shield, Users } from 'lucide-react';
import { Employee, User as UserType } from '../types';

interface EmployeeManagerProps {
  authToken: string | null;
}

const EmployeeManager: React.FC<EmployeeManagerProps> = ({ authToken }) => {
  const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'ADMINS'>('EMPLOYEES');

  // --- EMPLOYEE STATE ---
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Employee Form State
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // --- ADMIN STATE ---
  const [admins, setAdmins] = useState<UserType[]>([]);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    if (authToken) {
      if (activeTab === 'EMPLOYEES') fetchEmployees();
      if (activeTab === 'ADMINS') fetchAdmins();
    }
  }, [authToken, activeTab]);

  // --- EMPLOYEE FUNCTIONS ---
  const fetchEmployees = async () => {
    setFetchError(null);
    try {
      const res = await fetch('/api/employees', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (!res.ok) {
         const text = await res.text();
         throw new Error(`Server Error (${res.status}): ${text.substring(0, 100)}`);
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setEmployees(data);
      } else {
        setEmployees([]);
      }
    } catch (e: any) {
      console.error("Gagal load pegawai", e);
      setFetchError(e.message || "Gagal memuat data pegawai.");
    }
  };

  const resetForm = () => {
    setName('');
    setPosition('');
    setPhone('');
    setEmail('');
    setUsername('');
    setPassword('');
    setCurrentId(null);
    setIsEditing(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setName(emp.name);
    setPosition(emp.position);
    setPhone(emp.phone);
    setEmail(emp.email);
    setUsername(emp.username);
    setPassword('');
    setCurrentId(emp.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;

    setIsLoading(true);
    const payload = { name, position, phone, email, username, password };

    try {
      let url = '/api/employees';
      let method = 'POST';

      if (isEditing && currentId) {
        url = `/api/employees/${currentId}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
         const text = await res.text();
         try {
            const json = JSON.parse(text);
            throw new Error(json.message || `Gagal menyimpan (${res.status})`);
         } catch (parseErr) {
            throw new Error(`Server Error: ${text.substring(0, 150)}...`);
         }
      }

      const data = await res.json();

      if (data.success) {
        fetchEmployees();
        setIsModalOpen(false);
        resetForm();
        alert(isEditing ? "Data berhasil diperbarui" : "Pegawai berhasil ditambahkan");
      } else {
        alert(data.message || "Gagal menyimpan data.");
      }
    } catch (error: any) {
      console.error("Submit Error:", error);
      alert(error.message || "Terjadi kesalahan sistem saat menghubungi server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin menghapus data pegawai ini?")) return;
    if (!authToken) return;

    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
         fetchEmployees();
      } else {
         alert(data.message || "Gagal menghapus");
      }
    } catch (e) {
      alert("Gagal menghubungi server untuk menghapus.");
    }
  };

  // --- ADMIN FUNCTIONS ---
  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Filter only admins if the API returns all users (though it currently seems to return all users from 'users' table which are admins)
        setAdmins(data.filter((u: UserType) => u.role === 'admin')); 
      }
    } catch (e) {
      console.error("Failed to fetch admins", e);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    setIsLoading(true);
    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ username: adminUsername, password: adminPassword })
        });
        const data = await res.json();
        if (data.success) {
            fetchAdmins();
            setIsAdminModalOpen(false);
            setAdminUsername('');
            setAdminPassword('');
            alert('Admin berhasil ditambahkan');
        } else {
            alert(data.message || 'Gagal menambah admin');
        }
    } catch (e) {
        alert('Error connecting to server');
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteAdmin = async (id: number) => {
      if (!confirm('Hapus admin ini?')) return;
      if (!authToken) return;
      
      try {
          const res = await fetch(`/api/users/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${authToken}` }
          });
          const data = await res.json();
          if (data.success) {
              fetchAdmins();
          } else {
              alert(data.message || 'Gagal menghapus admin');
          }
      } catch (e) {
          alert('Gagal menghubungi server');
      }
  };


  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Manajemen User</h2>
           <p className="text-slate-500 text-sm">Kelola data pegawai dan administrator sistem.</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('EMPLOYEES')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'EMPLOYEES' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users size={16} /> Data Pegawai
          </div>
        </button>
        <button
          onClick={() => setActiveTab('ADMINS')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative ${
            activeTab === 'ADMINS' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield size={16} /> Administrator
          </div>
        </button>
      </div>

      {/* --- EMPLOYEES TAB CONTENT --- */}
      {activeTab === 'EMPLOYEES' && (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input 
                    type="text" 
                    placeholder="Cari nama atau jabatan..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                </div>
                <button 
                onClick={handleOpenAdd}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors"
                >
                <Plus size={18} /> Tambah Pegawai
                </button>
            </div>

            {/* Error Banner */}
            {fetchError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <AlertCircle size={20} />
                    <span>Error: {fetchError}</span>
                </div>
                <button onClick={fetchEmployees} className="text-sm font-bold underline hover:text-rose-900 flex items-center gap-1">
                    <RefreshCw size={14}/> Coba Lagi
                </button>
                </div>
            )}

            {/* Grid Card View */}
            {filteredEmployees.length === 0 && !fetchError ? (
                <div className="text-center py-12 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200">
                    <UserIcon size={48} className="mx-auto mb-3 opacity-20" />
                    <p>Belum ada data pegawai.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEmployees.map((emp) => (
                    <div key={emp.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 group hover:border-blue-200 dark:hover:border-blue-800 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg">
                            {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenEdit(emp)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded"><Pencil size={16}/></button>
                            <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-1">{emp.name}</h3>
                        <p className="text-blue-600 dark:text-blue-400 font-medium text-sm mb-4 flex items-center gap-1">
                        <Briefcase size={14} /> {emp.position}
                        </p>

                        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-4">
                            <div className="flex items-center gap-2">
                            <Phone size={14} className="text-slate-400" /> {emp.phone}
                            </div>
                            <div className="flex items-center gap-2">
                            <Mail size={14} className="text-slate-400" /> {emp.email}
                            </div>
                            <div className="flex items-center gap-2">
                            <UserIcon size={14} className="text-slate-400" /> Login: <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1 rounded">{emp.username}</span>
                            </div>
                        </div>
                    </div>
                    ))}
                </div>
            )}
        </div>
      )}

      {/* --- ADMIN TAB CONTENT --- */}
      {activeTab === 'ADMINS' && (
          <div className="animate-fade-in space-y-6">
              <div className="flex justify-between items-center">
                  <p className="text-slate-500">Daftar akun administrator yang memiliki akses penuh ke sistem.</p>
                  <button 
                  onClick={() => setIsAdminModalOpen(true)}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors"
                  >
                  <Plus size={18} /> Tambah Admin
                  </button>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          <tr>
                              <th className="p-4 font-medium">Username</th>
                              <th className="p-4 font-medium">Role</th>
                              <th className="p-4 font-medium text-right">Aksi</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {admins.map((admin) => (
                              <tr key={admin.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                  <td className="p-4 flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                          <Shield size={16} />
                                      </div>
                                      <span className="font-medium text-slate-800 dark:text-white">{admin.username}</span>
                                  </td>
                                  <td className="p-4">
                                      <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full uppercase font-bold tracking-wide">
                                          {admin.role}
                                      </span>
                                  </td>
                                  <td className="p-4 text-right">
                                      <button 
                                          onClick={() => handleDeleteAdmin(admin.id)}
                                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                                          title="Hapus Admin"
                                      >
                                          <Trash2 size={18} />
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {admins.length === 0 && (
                              <tr>
                                  <td colSpan={3} className="p-8 text-center text-slate-400">
                                      Tidak ada data admin.
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- EMPLOYEE MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
                 <h3 className="text-xl font-bold text-slate-800 dark:text-white">{isEditing ? 'Edit Data Pegawai' : 'Tambah Pegawai Baru'}</h3>
                 <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
                    <div className="relative">
                       <UserIcon className="absolute left-3 top-2.5 text-slate-400" size={18} />
                       <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full pl-10 p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Jabatan</label>
                        <div className="relative">
                           <Briefcase className="absolute left-3 top-2.5 text-slate-400" size={18} />
                           <input type="text" required value={position} onChange={e => setPosition(e.target.value)} className="w-full pl-10 p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">No. HP / WA</label>
                        <div className="relative">
                           <Phone className="absolute left-3 top-2.5 text-slate-400" size={18} />
                           <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full pl-10 p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                    <div className="relative">
                       <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
                       <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                 </div>

                 <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-2">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-3">Akses Login</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
                            <input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password {isEditing && '(Opsional)'}</label>
                            <div className="relative">
                               <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
                               <input type="password" required={!isEditing} value={password} onChange={e => setPassword(e.target.value)} placeholder={isEditing ? 'Biarkan kosong jika tetap' : ''} className="w-full pl-10 p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                    </div>
                 </div>

                 <div className="flex justify-end gap-3 mt-6">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                    <button type="submit" disabled={isLoading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                       {isLoading ? 'Menyimpan...' : <><Save size={18}/> Simpan Data</>}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* --- ADMIN MODAL --- */}
      {isAdminModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-sm w-full">
                  <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">Tambah Admin</h3>
                      <button onClick={() => setIsAdminModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>
                  <form onSubmit={handleAdminSubmit} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
                          <div className="relative">
                              <UserIcon className="absolute left-3 top-2.5 text-slate-400" size={18} />
                              <input 
                                  type="text" 
                                  required 
                                  value={adminUsername} 
                                  onChange={e => setAdminUsername(e.target.value)} 
                                  className="w-full pl-10 p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500" 
                              />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                          <div className="relative">
                              <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
                              <input 
                                  type="password" 
                                  required 
                                  value={adminPassword} 
                                  onChange={e => setAdminPassword(e.target.value)} 
                                  className="w-full pl-10 p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500" 
                              />
                          </div>
                      </div>
                      <div className="flex justify-end gap-3 mt-4">
                          <button type="button" onClick={() => setIsAdminModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                          <button type="submit" disabled={isLoading} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 flex items-center gap-2">
                              {isLoading ? 'Menyimpan...' : 'Simpan Admin'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default EmployeeManager;
