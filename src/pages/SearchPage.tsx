import React, { useState, useEffect } from 'react';
import { Search, Loader2, ChevronRight, LayoutDashboard, User as UserIcon, AlertCircle, Clock, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ContractData } from '../types';
import { ContractStatusBadge } from '../components/ContractStatusBadge';
import { calculateContractStatus } from '../utils/contractUtils';
import { useAuth } from '../context/AuthContext';
import { portalApi } from '../services/api';

/**
 * Search page component for verifying customer contract records.
 * Supports searching by MSISDN or Billing Account Number.
 * Maintains a local history of recent searches.
 */
export const SearchPage = () => {
  const { user, profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState<'msisdn' | 'billingAccountNumber' | 'username'>('msisdn');
  const [results, setResults] = useState<ContractData[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [queryCount, setQueryCount] = useState(0);
  const [sessionReads, setSessionReads] = useState(0);
  const trackRead = (count: number) => setSessionReads(prev => prev + count);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem(`_sc_h_${user.uid.substring(0, 8)}`);
    if (saved) setRecentSearches(JSON.parse(saved));
  }, [user]);

  const saveRecentSearch = (term: string) => {
    if (!user) return;
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 3);
    setRecentSearches(updated);
    localStorage.setItem(`_sc_h_${user.uid.substring(0, 8)}`, JSON.stringify(updated));
  };

  const performSearch = async (term: string, mode: typeof searchBy) => {
    if (!term.trim()) return;

    setSearching(true);
    setHasSearched(true);
    setErrorMsg(null);
    try {
      const normalizedTerm = term.trim();

      const authToken = user?.getIdToken ? await user.getIdToken() : null;
      const response = await portalApi.searchContracts(authToken, mode, normalizedTerm);
      const data = response.results;

      setQueryCount(prev => prev + response.queryCount);
      trackRead(response.readCount);
      setResults(data);
      
      if (data.length > 0) {
        saveRecentSearch(normalizedTerm);
      }
    } catch (error: any) {
      console.error("Search failed:", error);
      setErrorMsg(error.message || "Query failure. Please check your connection or system permissions.");
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchTerm, searchBy);
  };

  const exportToCSV = () => {
    if (results.length === 0) return;

    const headers = [
      'Billing Account Number',
      'MSISDN',
      'Product Name',
      'Contract Name',
      'Contract Start Date',
      'Contract End Date',
      'Contract Duration',
      'Penalty Amount (RM)',
      'Segment',
      'Status',
      'Remaining Months'
    ];

    const csvRows = results.map(contract => {
      const { remainingMonths, status } = calculateContractStatus(contract.contractEndDate);
      const displayStatus = status === 'EXPIRED' ? 'NO CONTRACT' : status;
      return [
        `"${contract.billingAccountNumber}"`,
        `"${contract.msisdn}"`,
        `"${contract.productName || 'N/A'}"`,
        `"${contract.contractName || 'N/A'}"`,
        `"${contract.contractStartDate || '-'}"`,
        `"${contract.contractEndDate || '-'}"`,
        `"${contract.contractDuration}"`,
        `"${contract.contractPenaltyAmount || 0}"`,
        `"${contract.segment || 'N/A'}"`,
        `"${displayStatus}"`,
        `"${remainingMonths}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Formatting date for proper naming
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `CD_Contract_Audit_${searchTerm.trim()}_${timestamp}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12 flex items-end justify-between">
        <div>
          <h1 className="text-5xl font-black text-cd-blue mb-3 tracking-tighter">Search Records</h1>
          <p className="text-lg text-slate-500 font-medium">This portal is for Enterprise CI customers only & CO can check via SPP</p>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <div className="text-xs font-bold text-cd-blue/40 uppercase tracking-tighter">Calls: {queryCount}</div>
            <div className="w-1 h-1 bg-slate-200 rounded-full" />
            <div className="text-xs font-bold text-emerald-500 uppercase tracking-tighter">Reads: {sessionReads}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-16">
        <div className="lg:col-span-3">
          <div className="bg-white p-10 rounded-4xl shadow-2xl shadow-slate-200/60 border border-slate-100 relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cd-yellow/10 rounded-full -mr-16 -mt-16 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-cd-cyan/10 rounded-full -ml-16 -mb-16 blur-3xl" />
            
            <form onSubmit={handleSearch} className="relative space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Search By</label>
                  <select 
                    value={searchBy}
                    onChange={(e) => setSearchBy(e.target.value as any)}
                    className="w-full px-5 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-cd-blue/5 focus:border-cd-blue transition-all outline-none font-bold text-slate-700 appearance-none"
                  >
                    <option value="msisdn">MSISDN Number</option>
                    <option value="billingAccountNumber">Billing Account Number</option>
                    <option value="username">Username (Fibre Only)</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Identity Value</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                      <Search className="h-6 w-6 text-slate-300" />
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={
                        searchBy === 'msisdn' ? "e.g. 0123456789" : 
                        searchBy === 'billingAccountNumber' ? "e.g. 12345678" :
                        "e.g. 0123456789@celcomhome"
                      }
                      className="block w-full pl-14 pr-5 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-bold placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-cd-blue/5 focus:border-cd-blue transition-all"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={searching}
                  className="px-12 py-5 bg-cd-blue text-white font-black rounded-2xl hover:bg-cd-blue/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-3 shadow-2xl shadow-cd-blue/30"
                >
                  {searching ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
                  RUN QUERY
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white p-10 rounded-4xl shadow-xl shadow-slate-200/50 border border-slate-100 h-full">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-cd-cyan" />
              Recent
            </h3>
            {recentSearches.length > 0 ? (
              <div className="space-y-3">
                {recentSearches.map((term, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSearchTerm(term);
                      performSearch(term, searchBy);
                    }}
                    className="w-full text-left px-5 py-4 text-sm font-bold text-slate-600 bg-slate-50 hover:bg-cd-blue hover:text-white rounded-2xl transition-all flex items-center justify-between group"
                  >
                    {term}
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-xs text-slate-300 font-bold italic uppercase tracking-widest">History Empty</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-8 p-6 bg-rose-50 border-2 border-rose-100 rounded-3xl flex items-center gap-4 text-rose-800"
          >
            <AlertCircle className="w-6 h-6 shrink-0" />
            <span className="font-bold">{errorMsg}</span>
          </motion.div>
        )}

        {searching ? (
          <motion.div 
            key="searching"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center py-24"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-cd-blue/20 blur-2xl rounded-full animate-pulse" />
              <Loader2 className="w-16 h-16 text-cd-blue animate-spin relative" />
            </div>
            <p className="mt-6 text-slate-400 font-black uppercase tracking-[0.3em] text-sm">Accessing Core Database</p>
          </motion.div>
        ) : hasSearched ? (
          results.length > 0 ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black text-cd-blue tracking-tight">Search Results</h2>
                  <span className="px-4 py-1.5 bg-cd-cyan/10 text-cd-cyan text-xs font-black rounded-full uppercase tracking-widest">
                    {results.length} Matches Found
                  </span>
                </div>
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-slate-100 hover:border-cd-blue hover:text-cd-blue text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
              
              <div className="bg-white rounded-4xl shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Billing Acc</th>
                        <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">MSISDN / Username</th>
                        <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Product Name</th>
                        <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contract Name</th>
                        <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Start Date</th>
                        <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">End Date</th>
                        <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contract Duration</th>
                        <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Penalty</th>
                        <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Segment</th>
                        <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contract Status</th>
                        <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Remaining Month</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {results.map((contract) => {
                        const { remainingMonths, status } = calculateContractStatus(contract.contractEndDate);
                        return (
                          <tr key={contract.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-6 text-sm font-bold text-slate-900">{contract.billingAccountNumber}</td>
                            <td className="px-6 py-6 text-sm font-medium text-slate-600">
                              <div className="flex flex-col">
                                <span className={contract.msisdn.includes('@') ? "text-cd-blue font-bold" : ""}>
                                  {contract.msisdn}
                                </span>
                                {contract.msisdn.includes('@') && (
                                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter mt-0.5">
                                    Fibre Identity
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-6 text-sm font-bold text-cd-blue uppercase">{contract.productName || 'N/A'}</td>
                            <td className="px-6 py-6 text-sm font-bold text-cd-blue uppercase">{contract.contractName || 'N/A'}</td>
                            <td className="px-6 py-6 text-sm font-medium text-slate-600">{contract.contractStartDate || '-'}</td>
                            <td className="px-6 py-6 text-sm font-medium text-slate-600">{contract.contractEndDate || '-'}</td>
                            <td className="px-6 py-6 text-sm font-bold text-slate-900">{contract.contractDuration}</td>
                            <td className="px-6 py-6 text-sm font-black text-cd-blue">RM {contract.contractPenaltyAmount?.toLocaleString() || '0'}</td>
                            <td className="px-6 py-6 text-sm font-bold text-slate-600 uppercase">{contract.segment || 'N/A'}</td>
                            <td className="px-6 py-6">
                              <ContractStatusBadge status={status} />
                            </td>
                            <td className="px-6 py-6 text-sm font-black text-cd-blue">
                              {remainingMonths}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="no-results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-24 bg-white rounded-4xl border-2 border-dashed border-slate-200"
            >
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-12 h-12 text-slate-200" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">No records found</h3>
              <p className="text-slate-400 font-medium">This customer is not under enterprise segment</p>
            </motion.div>
          )
        ) : null}
      </AnimatePresence>
    </div>
  );
};
