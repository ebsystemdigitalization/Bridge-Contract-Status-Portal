import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Users, 
  Check, 
  X, 
  Shield, 
  ShieldAlert, 
  Search as SearchIcon,
  History,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import { isValid, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, UserStatus, AuditLog } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { portalApi } from '../services/api';

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const date = new Date(value);
  return isValid(date) ? date : null;
};

const formatTimestamp = (value: any, pattern: string, fallback = 'Pending') => {
  const date = toDate(value);
  return date ? format(date, pattern) : fallback;
};

/**
 * Admin panel page for bulk data management and user approvals.
 */
export const AdminPanel = () => {
  const { user: currentUser, profile, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'search'>('users');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // User Management State
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [processingUser, setProcessingUser] = useState<string | null>(null);

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  // Search Log State
  const [searchLogs, setSearchLogs] = useState<any[]>([]);
  const [loadingSearchLogs, setLoadingSearchLogs] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [exportingSearchLogs, setExportingSearchLogs] = useState(false);

  // Performance Monitoring
  const [sessionReads, setSessionReads] = useState(0);
  const trackRead = (count: number) => setSessionReads(prev => prev + count);

  // User Sorting State
  const [userSort, setUserSort] = useState<{
    key: keyof UserProfile;
    direction: 'asc' | 'desc';
  }>({ key: 'createdAt', direction: 'desc' });

  // Pagination State
  const [itemsPerPage] = useState(10);
  const [userPage, setUserPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [queryCount, setQueryCount] = useState(0);

  const fetchUsers = async () => {
    if (!currentUser) return;
    setLoadingUsers(true);
    setQueryCount(prev => prev + 1);
    try {
      const authToken = currentUser?.getIdToken ? await currentUser.getIdToken() : null;
      const response = await portalApi.listUsers(authToken);
      trackRead(response.readCount || 1);
      const users = response.users;
      setAllUsers(users);
      setPendingUsers(users.filter(u => u.status === UserStatus.PENDING));
    } catch (error: any) {
      console.error("User fetch error:", error);
      setMessage({ type: 'error', text: error.message || 'Failed to fetch users.' });
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchLogs = async () => {
    if (!currentUser) return;
    setLoadingLogs(true);
    setQueryCount(prev => prev + 1);
    try {
      const authToken = currentUser?.getIdToken ? await currentUser.getIdToken() : null;
      const response = await portalApi.listAuditLogs(authToken);
      trackRead(response.readCount || 1);
      setAuditLogs(response.logs);
      setAuditPage(1);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchSearchLogs = async () => {
    if (!currentUser) return;
    setLoadingSearchLogs(true);
    setQueryCount(prev => prev + 1);
    try {
      const authToken = currentUser?.getIdToken ? await currentUser.getIdToken() : null;
      const response = await portalApi.listSearchLogs(authToken);
      trackRead(response.readCount || 1);
      setSearchLogs(response.logs);
      setSearchPage(1);
    } catch (error) {
      console.error("Failed to fetch search logs:", error);
    } finally {
      setLoadingSearchLogs(false);
    }
  };

  const exportAllSearchLogsToExcel = async () => {
    if (!currentUser) return;
    setExportingSearchLogs(true);
    setQueryCount(prev => prev + 1);
    try {
      const authToken = currentUser?.getIdToken ? await currentUser.getIdToken() : null;
      const response = await portalApi.listSearchLogs(authToken, true);
      trackRead(response.readCount || 1);
      const docs = response.logs;
      
      if (docs.length === 0) {
        setMessage({ type: 'error', text: 'No search logs available to export.' });
        return;
      }

      // 2. Format as Excel-friendly CSV with Excel-specific headers
      const headers = ['Log ID', 'Timestamp', 'User Name', 'Email', 'User ID', 'Search By', 'Search Term', 'Results Count'];
      const rows = docs.map(doc => {
        let dateStr = 'Pending';
        dateStr = formatTimestamp(doc.timestamp, 'yyyy-MM-dd HH:mm:ss', 'Pending');
        
        // Escape values for CSV (doubles double-quotes and wraps in quotes)
        const clean = (val: any) => {
          if (val === undefined || val === null) return '';
          const str = String(val);
          if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        return [
          clean(doc.id),
          clean(dateStr),
          clean(doc.username),
          clean(doc.email),
          clean(doc.userId),
          clean(doc.searchBy),
          clean(`\t${doc.searchTerm}`),
          clean(doc.resultsCount)
        ];
      });

      const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
      // 3. Trigger download process with BOM prefix for MS Excel UTF-8 support
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const timestampStr = format(new Date(), 'yyyyMMdd_HHmmss');
      link.setAttribute('download', `celcomdigi_search_logs_${timestampStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: `Successfully exported all ${docs.length} search logs to Excel/CSV.` });
    } catch (error: any) {
      console.error("Export failed:", error);
      setMessage({ type: 'error', text: `Export failed: ${error.message || error}` });
    } finally {
      setExportingSearchLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'audit') fetchLogs();
    if (activeTab === 'search') fetchSearchLogs();
  }, [activeTab, isSuperAdmin, currentUser]);

  const handleUserStatus = async (targetUser: UserProfile, status: UserStatus) => {
    if (targetUser.uid === currentUser?.uid) {
      setMessage({ type: 'error', text: "Security Policy: You cannot modify your own status." });
      return;
    }

    // Hierarchy check: Only superadmin can modify admins
    if (targetUser.role === 'admin' && !isSuperAdmin) {
      setMessage({ type: 'error', text: "Security Policy: Only Superadmins can modify Admin status." });
      return;
    }

    // Hierarchy check: No one can modify superadmins
    if (targetUser.role === 'superadmin') {
      setMessage({ type: 'error', text: "Security Policy: Superadmin status cannot be modified." });
      return;
    }

    setProcessingUser(targetUser.uid);
    try {
      const authToken = currentUser?.getIdToken ? await currentUser.getIdToken() : null;
      await portalApi.updateUserStatus(authToken, targetUser.uid, status);
      setMessage({ type: 'success', text: `User status updated to ${status}.` });
      await fetchUsers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update user status.' });
    } finally {
      setProcessingUser(null);
    }
  };

  const handleUserRole = async (targetUser: UserProfile, role: 'superadmin' | 'admin' | 'user') => {
    if (!isSuperAdmin) {
      setMessage({ type: 'error', text: "Security Policy: Only Superadmins can manage user roles." });
      return;
    }

    if (targetUser.uid === currentUser?.uid) {
      setMessage({ type: 'error', text: "Security Policy: You cannot modify your own role." });
      return;
    }

    // Hierarchy check: Only superadmin can manage roles of admins
    if (targetUser.role === 'admin' && !isSuperAdmin) {
      setMessage({ type: 'error', text: "Security Policy: Only Superadmins can modify Admin roles." });
      return;
    }

    // Hierarchy check: No one can modify superadmins
    if (targetUser.role === 'superadmin') {
      setMessage({ type: 'error', text: "Security Policy: Superadmin roles cannot be modified." });
      return;
    }

    // Hierarchy check: Only superadmin can promote to superadmin
    if (role === 'superadmin' && !isSuperAdmin) {
      setMessage({ type: 'error', text: "Security Policy: Only Superadmins can promote others to Superadmin." });
      return;
    }
    
    setProcessingUser(targetUser.uid);
    try {
      const authToken = currentUser?.getIdToken ? await currentUser.getIdToken() : null;
      await portalApi.updateUserRole(authToken, targetUser.uid, role);
      setMessage({ type: 'success', text: `User role updated to ${role}.` });
      await fetchUsers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update user role.' });
    } finally {
      setProcessingUser(null);
    }
  };

  const deleteUser = async (targetUser: UserProfile) => {
    if (targetUser.uid === currentUser?.uid) {
      setMessage({ type: 'error', text: "Security Policy: You cannot delete yourself." });
      return;
    }

    // Hierarchy check: Only superadmin can delete admins
    if (targetUser.role === 'admin' && !isSuperAdmin) {
      setMessage({ type: 'error', text: "Security Policy: Only Superadmins can delete Admins." });
      return;
    }

    // Hierarchy check: No one can delete superadmins except other superadmins
    if (targetUser.role === 'superadmin' && !isSuperAdmin) {
      setMessage({ type: 'error', text: "Security Policy: Only Superadmins can manage other Superadmins." });
      return;
    }

    setProcessingUser(targetUser.uid);
    try {
      const authToken = currentUser?.getIdToken ? await currentUser.getIdToken() : null;
      await portalApi.deleteUser(authToken, targetUser.uid);
      setMessage({ 
        type: 'success', 
        text: `Database record for ${targetUser.username} has been deleted. Note: The login account still exists in Authentication.` 
      });
      setConfirmDelete(null);
      await fetchUsers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete user.' });
    } finally {
      setProcessingUser(null);
    }
  };

  const handleUserSort = (key: typeof userSort.key) => {
    setUserSort(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredUsers = useMemo(() => {
    const search = userSearch.toLowerCase();
    const filtered = allUsers.filter(u => {
      const username = u.username || '';
      return username.toLowerCase().includes(search);
    });

    return filtered.sort((a, b) => {
      let aVal = a[userSort.key] as any;
      let bVal = b[userSort.key] as any;

      // Handle null/undefined
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      // Handle Firestore timestamps and API timestamp strings
      if (aVal?.toDate || Date.parse(aVal)) aVal = toDate(aVal)?.getTime() || 0;
      if (bVal?.toDate || Date.parse(bVal)) bVal = toDate(bVal)?.getTime() || 0;

      if (aVal < bVal) return userSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return userSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allUsers, userSearch, userSort]);

  const UserSortIndicator = ({ column }: { column: typeof userSort.key }) => {
    if (userSort.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return userSort.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-cd-blue" /> : <ArrowDown className="w-3 h-3 text-cd-blue" />;
  };

  // Pagination Logic
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, userPage, itemsPerPage]);

  const paginatedAuditLogs = useMemo(() => {
    const start = (auditPage - 1) * itemsPerPage;
    return auditLogs.slice(start, start + itemsPerPage);
  }, [auditLogs, auditPage, itemsPerPage]);

  const paginatedSearchLogs = useMemo(() => {
    const start = (searchPage - 1) * itemsPerPage;
    return searchLogs.slice(start, start + itemsPerPage);
  }, [searchLogs, searchPage, itemsPerPage]);

  const totalUserPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const totalAuditPages = Math.ceil(auditLogs.length / itemsPerPage);
  const totalSearchPages = Math.ceil(searchLogs.length / itemsPerPage);

  const PaginationControls = ({ currentPage, totalPages, totalItems, onPageChange }: { 
    currentPage: number; 
    totalPages: number; 
    totalItems: number;
    onPageChange: (page: number) => void;
  }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="p-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-50/30">
        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
          Page <span className="text-cd-blue">{currentPage}</span> of <span className="text-cd-blue">{totalPages}</span>
          <span className="ml-4 opacity-50">•</span>
          <span className="ml-4">Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-3 bg-white border border-slate-100 rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all text-slate-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-1">
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              let pageNum = currentPage;
              if (totalPages > 5) {
                if (currentPage < 3) pageNum = i + 1;
                else if (currentPage > totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
              } else {
                pageNum = i + 1;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    "w-10 h-10 rounded-xl text-xs font-black transition-all",
                    currentPage === pageNum 
                      ? "bg-cd-blue text-white" 
                      : "bg-white text-slate-500 hover:bg-slate-100"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-3 bg-white border border-slate-100 rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all text-slate-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-cd-blue mb-3 tracking-tighter">Admin Control</h1>
          <p className="text-lg text-slate-500 font-medium">Manage database records and system access.</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xs font-bold text-cd-blue/30 uppercase tracking-tighter">Calls: {queryCount}</span>
            <span className="w-1 h-1 bg-slate-200 rounded-full" />
            <span className="text-xs font-bold text-rose-400 uppercase tracking-tighter">Reads: {sessionReads}</span>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              "px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center gap-2",
              activeTab === 'users' ? "bg-white text-cd-blue shadow-lg" : "text-slate-400 hover:text-slate-600"
            )}
          >
            User Management
            {pendingUsers.length > 0 && (activeTab === 'users') && (
              <span className="w-5 h-5 bg-cd-yellow text-cd-blue rounded-full flex items-center justify-center text-[10px]">
                {pendingUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={cn(
              "px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all",
              activeTab === 'audit' ? "bg-white text-cd-blue shadow-lg" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={cn(
              "px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all",
              activeTab === 'search' ? "bg-white text-cd-blue shadow-lg" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Search Logs
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "mb-8 p-6 rounded-3xl flex items-center gap-4 border-2",
              message.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"
            )}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            <span className="font-bold">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto hover:opacity-50"><X className="w-5 h-5" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full">
        {activeTab === 'users' ? (
          <motion.div
            key="users"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="bg-white p-10 rounded-4xl shadow-2xl shadow-slate-200/60 border border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-cd-cyan/5 rounded-2xl flex items-center justify-center">
                    <Users className="w-7 h-7 text-cd-cyan" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-cd-blue tracking-tight">User Directory</h2>
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">System Access Control</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={fetchUsers} 
                    disabled={loadingUsers}
                    className="p-4 bg-slate-50 text-slate-400 hover:text-cd-blue hover:bg-cd-blue/5 rounded-2xl transition-all disabled:opacity-50"
                  >
                    <History className={cn("w-5 h-5", loadingUsers && "animate-spin")} />
                  </button>
                  <div className="relative flex-1 md:w-96">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-cd-blue/5 focus:border-cd-blue outline-none font-bold text-slate-700 transition-all"
                    />
                  </div>
                </div>
              </div>

              {loadingUsers ? (
                <div className="py-24 flex flex-col items-center">
                  <Loader2 className="w-12 h-12 text-cd-blue animate-spin mb-4" />
                  <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Syncing Directory</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th onClick={() => handleUserSort('username')} className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-slate-100/50 transition-colors">
                          <div className="flex items-center gap-2">User Profile <UserSortIndicator column="username" /></div>
                        </th>
                        <th onClick={() => handleUserSort('role')} className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-slate-100/50 transition-colors">
                          <div className="flex items-center gap-2">Role <UserSortIndicator column="role" /></div>
                        </th>
                        <th onClick={() => handleUserSort('lastLoginAt')} className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-slate-100/50 transition-colors">
                          <div className="flex items-center gap-2">Last Login <UserSortIndicator column="lastLoginAt" /></div>
                        </th>
                        <th onClick={() => handleUserSort('status')} className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-slate-100/50 transition-colors">
                          <div className="flex items-center gap-2">Status <UserSortIndicator column="status" /></div>
                        </th>
                        <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginatedUsers.map((user) => (
                        <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-cd-blue text-lg">
                                {(user.username || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-black text-slate-900">{user.username || 'Anonymous'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className={cn(
                              "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                              user.role === 'superadmin' ? "bg-cd-blue text-white ring-2 ring-cd-yellow" :
                              user.role === 'admin' ? "bg-cd-blue text-white" : "bg-slate-100 text-slate-500"
                            )}>
                              {user.role === 'superadmin' ? <ShieldAlert className="w-3 h-3" /> :
                               user.role === 'admin' ? <Shield className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                              {user.role}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-xs font-bold text-slate-500">
                              {formatTimestamp(user.lastLoginAt, 'MMM d, HH:mm', 'Never')}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className={cn(
                              "inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                              user.status === UserStatus.ACTIVE ? "bg-emerald-100 text-emerald-700" : 
                              user.status === UserStatus.PENDING ? "bg-cd-yellow/20 text-cd-blue" : "bg-rose-100 text-rose-700"
                            )}>
                              {user.status}
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {user.status === UserStatus.PENDING && (
                                <>
                                  <button
                                    onClick={() => handleUserStatus(user, UserStatus.ACTIVE)}
                                    disabled={!!processingUser}
                                    className="p-3 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-all disabled:opacity-50"
                                    title="Approve"
                                  >
                                    {processingUser === user.uid ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                  </button>
                                  <button
                                    onClick={() => handleUserStatus(user, UserStatus.REJECTED)}
                                    disabled={!!processingUser}
                                    className="p-3 bg-rose-100 text-rose-700 rounded-xl hover:bg-rose-200 transition-all disabled:opacity-50"
                                    title="Reject"
                                  >
                                    {processingUser === user.uid ? <Loader2 className="w-5 h-5 animate-spin" /> : <X className="w-5 h-5" />}
                                  </button>
                                </>
                              )}
                              
                              {isSuperAdmin && user.status === UserStatus.ACTIVE && user.role !== 'superadmin' && (
                                <button
                                  onClick={() => handleUserRole(user, user.role === 'admin' ? 'user' : 'admin')}
                                  disabled={!!processingUser || user.uid === currentUser?.uid}
                                  className={cn(
                                    "p-3 rounded-xl transition-all disabled:opacity-50",
                                    user.role === 'admin' ? "bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-600" : "bg-cd-blue/10 text-cd-blue hover:bg-cd-blue hover:text-white"
                                  )}
                                  title={user.role === 'admin' ? "Revoke Admin" : "Make Admin"}
                                >
                                  {processingUser === user.uid ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                                   user.role === 'admin' ? <ShieldAlert className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                                </button>
                              )}

                              {user.uid !== currentUser?.uid && (user.role !== 'superadmin' || isSuperAdmin) && (
                                <div className="relative">
                                  {confirmDelete === user.uid ? (
                                    <div className="absolute right-0 bottom-full mb-2 bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 z-50 w-64 text-left">
                                      <p className="text-xs font-bold text-slate-600 mb-3">Permanently delete {user.email}?</p>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => deleteUser(user)}
                                          disabled={!!processingUser}
                                          className="flex-1 py-2 bg-rose-600 text-white text-[10px] font-black rounded-lg hover:bg-rose-700 transition-all"
                                        >
                                          CONFIRM
                                        </button>
                                        <button
                                          onClick={() => setConfirmDelete(null)}
                                          className="flex-1 py-2 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg hover:bg-slate-200 transition-all"
                                        >
                                          CANCEL
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                  <button
                                    onClick={() => setConfirmDelete(user.uid)}
                                    disabled={!!processingUser || (user.role === 'admin' && !isSuperAdmin)}
                                    className="p-3 bg-rose-50 text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50"
                                    title={user.role === 'admin' && !isSuperAdmin ? "Only Superadmins can delete Admins" : "Delete User"}
                                  >
                                    {processingUser === user.uid ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <PaginationControls 
                currentPage={userPage}
                totalPages={totalUserPages}
                totalItems={filteredUsers.length}
                onPageChange={setUserPage}
              />
            </div>
          </motion.div>
        ) : activeTab === 'audit' ? (
          <motion.div
            key="audit"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white p-10 rounded-4xl shadow-2xl shadow-slate-200/60 border border-slate-100"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <History className="w-7 h-7 text-slate-400" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-cd-blue tracking-tight">System Audit Core</h2>
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Global Administrative Intelligence</p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={fetchLogs} 
                  disabled={loadingLogs}
                  className="p-4 bg-slate-50 text-slate-400 hover:text-cd-blue hover:bg-cd-blue/5 rounded-2xl transition-all disabled:opacity-50"
                >
                  <History className={cn("w-5 h-5", loadingLogs && "animate-spin")} />
                </button>
              </div>
            </div>

            {loadingLogs ? (
              <div className="py-24 flex flex-col items-center">
                <Loader2 className="w-12 h-12 text-cd-blue animate-spin mb-4" />
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Retrieving Logs</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-24 text-center">
                <p className="text-slate-400 font-bold">No administrative actions logged yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Timestamp</th>
                      <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Administrator</th>
                      <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Operation</th>
                      <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Target User</th>
                      <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="text-[10px] font-black text-slate-900">
                            {formatTimestamp(log.timestamp, 'dd MMM yyyy')}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">
                            {formatTimestamp(log.timestamp, 'HH:mm:ss', '...')}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-sm font-black text-cd-blue">{log.adminUsername}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">UID: {log.adminId.slice(0, 12)}...</div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={cn(
                            "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
                            log.action.includes('DELETE') ? "bg-rose-100 text-rose-700" :
                            log.action.includes('EXPORT') ? "bg-emerald-100 text-emerald-700" :
                            "bg-cd-blue/10 text-cd-blue"
                          )}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-xs font-bold text-slate-700">{log.targetUserUsername || 'System Scope'}</div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-medium text-slate-500 border border-slate-100">
                            {log.details}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <PaginationControls 
              currentPage={auditPage}
              totalPages={totalAuditPages}
              totalItems={auditLogs.length}
              onPageChange={setAuditPage}
            />
          </motion.div>
        ) : activeTab === 'search' ? (
          <motion.div
            key="search_logs"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white p-10 rounded-4xl shadow-2xl shadow-slate-200/60 border border-slate-100"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <SearchIcon className="w-7 h-7 text-slate-400" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-cd-blue tracking-tight">Search Intelligence</h2>
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">User Query Monitoring</p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={exportAllSearchLogsToExcel}
                  disabled={exportingSearchLogs || loadingSearchLogs}
                  className="px-6 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-500/10 flex items-center gap-2"
                  title="Export all search logs to Excel/CSV directly from Firestore"
                >
                  {exportingSearchLogs ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Export Excel (CSV)
                </button>
                <button 
                  onClick={fetchSearchLogs} 
                  disabled={loadingSearchLogs}
                  className="p-4 bg-slate-50 text-slate-400 hover:text-cd-blue hover:bg-cd-blue/5 rounded-2xl transition-all disabled:opacity-50"
                  title="Refresh Logs"
                >
                  <History className={cn("w-5 h-5", loadingSearchLogs && "animate-spin")} />
                </button>
              </div>
            </div>

            {loadingSearchLogs ? (
              <div className="py-24 flex flex-col items-center">
                <Loader2 className="w-12 h-12 text-cd-blue animate-spin mb-4" />
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Retrieving Search Logs</p>
              </div>
            ) : searchLogs.length === 0 ? (
              <div className="py-24 text-center">
                <p className="text-slate-400 font-bold">No search queries logged yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Timestamp</th>
                      <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">User</th>
                      <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Search By</th>
                      <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Term</th>
                      <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Results</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedSearchLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="text-[10px] font-black text-slate-900">
                            {formatTimestamp(log.timestamp, 'dd MMM yyyy')}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">
                            {formatTimestamp(log.timestamp, 'HH:mm:ss', '...')}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-sm font-black text-cd-blue">{log.username}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{log.email}</div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                            {log.searchBy}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-xs font-bold text-slate-700">{log.searchTerm}</div>
                        </td>
                        <td className="px-8 py-6">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black",
                            log.resultsCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          )}>
                            {log.resultsCount}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <PaginationControls 
              currentPage={searchPage}
              totalPages={totalSearchPages}
              totalItems={searchLogs.length}
              onPageChange={setSearchPage}
            />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};
