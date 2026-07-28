import React, { useState } from 'react';
import { 
  Upload, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  X, 
  Trash2,
  Trash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { portalApi } from '../services/api';

/**
 * Maintenance page for bulk data management (Upload & Purge).
 */
export const MaintenancePage = () => {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgePaused, setPurgePaused] = useState(false);
  const purgePausedRef = React.useRef(false); // Used to ensure the loop sees the latest state
  const [purgeProgress, setPurgeProgress] = useState<{ current: number, total: number | null }>({ current: 0, total: null });
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number, total: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Performance Monitoring
  const [sessionReads, setSessionReads] = useState(0);
  const trackRead = (count: number) => setSessionReads(prev => prev + count);

  const processFile = async(file:File)=>{
      setUploading(true);
      setMessage(null);
      try{
          const authToken = currentUser?.getIdToken
              ? await currentUser.getIdToken()
              : null;
          const response = await portalApi.uploadExcel(
              authToken,
              file
          );
          setMessage({
              type:'success',
              text:`Imported ${response.totalUnique} contracts successfully.`
          });
      }catch(error){
          console.error("UPLOAD ERROR:", error);

          setMessage({
              type:'error',
              text: error instanceof Error 
                  ? error.message 
                  : 'Upload failed.'
          });
      }
      finally{
          setUploading(false);
      }
  };

  const purgeAllContracts = async () => {
    if (!isSuperAdmin) {
      setMessage({ type: 'error', text: 'Security Policy: Only Superadmins can purge the database.' });
      return;
    }
    
    setPurging(true);
    setPurgePaused(false);
    purgePausedRef.current = false;
    setMessage(null);
    
    try {
      const authToken = currentUser?.getIdToken ? await currentUser.getIdToken() : null;
      const response = await portalApi.purgeContracts(authToken);
      setPurgeProgress({ current: response.deletedCount, total: response.deletedCount });
      setMessage({ type: 'success', text: `Success! ${response.deletedCount.toLocaleString()} records removed.` });
      setShowPurgeConfirm(false);
      setPurgeProgress({ current: 0, total: null });
    } catch (error) {
      console.error("Critical Purge error:", error);
      const message = error instanceof Error ? error.message : 'Fatal error during purge. Please refresh and try again.';
      setMessage({ type: 'error', text: message });
    } finally {
      setPurging(false);
    }
  };

  const togglePause = () => {
    const newState = !purgePaused;
    setPurgePaused(newState);
    purgePausedRef.current = newState;
    if (!newState) {
      // If we just unpaused, restart the function
      purgeAllContracts();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      const isCsv = file.name.endsWith('.csv');
      
      if (isExcel || isCsv) {
        processFile(file);
      } else {
        setMessage({ type: 'error', text: 'Invalid file type. Please drop an Excel or CSV file.' });
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-5xl font-black text-cd-blue mb-3 tracking-tighter">Maintenance Portal</h1>
        <p className="text-lg text-slate-500 font-medium">Database bulk operations and cleanup tools.</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-tighter">Reads this session: {sessionReads}</span>
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

      <div className="space-y-8">
        <div className="bg-white p-12 rounded-4xl shadow-2xl shadow-slate-200/60 border border-slate-100">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-14 h-14 bg-cd-blue/5 rounded-2xl flex items-center justify-center">
              <Upload className="w-7 h-7 text-cd-blue" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-cd-blue tracking-tight">Bulk Upload</h2>
              <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Excel / CSV Data Mapping</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
            <div className="space-y-6">
              <div className="bg-slate-50 p-8 rounded-3xl border-2 border-slate-100">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Required Data Schema</h3>
                <div className="grid grid-cols-1 gap-3">
                  {['BILLING_ACCOUNT_NUMBER', 'MSISDN', 'PRODUCT_NAME', 'CONTRACT_NAME', 'CONTRACT_START_DATE', 'CONTRACT_END_DATE', 'CONTRACT_DURATION_IN_MONTHS', 'CONTRACT_PENALTY_AMOUNT', 'SEGMENT'].map(col => (
                    <div key={col} className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-cd-cyan rounded-full" />
                      <span className="text-sm font-black text-slate-600 font-mono">{col}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <label 
              className="relative group cursor-pointer block"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} disabled={uploading} className="hidden" />
              <div className={cn(
                "border-4 border-dashed rounded-4xl p-16 text-center transition-all h-full flex flex-col items-center justify-center",
                isDragging 
                  ? "border-cd-blue bg-cd-blue/10 scale-[1.02]" 
                  : "border-slate-100 group-hover:border-cd-blue group-hover:bg-cd-blue/5"
              )}>
                <div className={cn(
                  "w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-all shadow-sm",
                  isDragging ? "bg-white scale-110" : "bg-slate-50 group-hover:scale-110 group-hover:bg-white"
                )}>
                  <Upload className={cn(
                    "w-10 h-10 transition-all",
                    isDragging ? "text-cd-blue" : "text-slate-300 group-hover:text-cd-blue"
                  )} />
                </div>
                <span className="block text-2xl font-black text-slate-700 mb-2">
                  {isDragging ? 'Drop it here!' : 'Drop Excel or CSV File'}
                </span>
                <span className="block text-sm text-slate-400 font-bold uppercase tracking-widest">or click to browse</span>
              </div>
              {uploading && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-4xl flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-cd-blue/20 blur-xl rounded-full animate-pulse" />
                      <Loader2 className="w-12 h-12 text-cd-blue animate-spin relative" />
                    </div>
                    <span className="text-sm font-black text-cd-blue uppercase tracking-[0.3em]">
                      Processing Upload
                    </span>
                  </div>
                </div>
              )}
            </label>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="bg-white p-12 rounded-4xl shadow-2xl shadow-slate-200/60 border border-slate-100 border-t-4 border-t-rose-500">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center">
                  <Trash2 className="w-7 h-7 text-rose-500" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight">Database Purge</h2>
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Cleanup and Management</p>
                </div>
              </div>

              {!showPurgeConfirm ? (
                <button
                  onClick={() => setShowPurgeConfirm(true)}
                  className="px-10 py-5 bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-xl shadow-rose-200"
                >
                  Purge All Records
                </button>
              ) : (
                <div className="flex flex-col items-end gap-3 max-w-sm">
                  <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <p className="text-rose-700 text-xs font-bold leading-relaxed">
                      <span className="block mb-1 underline">QUOTA IMPACT</span>
                      Purging records will consume 1 Read and 1 Delete unit per document.
                    </p>
                  </div>
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={purging ? togglePause : purgePaused ? togglePause : purgeAllContracts}
                      className={cn(
                        "flex-1 px-8 py-4 text-white rounded-xl font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 shadow-lg",
                        purging ? "bg-amber-500 hover:bg-amber-600" : purgePaused ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
                      )}
                    >
                      {purging ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-[10px]">Pause Purge</span>
                        </>
                      ) : purgePaused ? 'Resume Purging' : 'Yes, Purge'}
                    </button>
                    {purgeProgress.current > 0 && (
                      <div className="absolute -top-12 left-0 right-0 p-2 bg-white rounded-lg border shadow-sm text-center">
                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mb-1">
                          <motion.div 
                            className="bg-rose-500 h-full"
                            style={{ width: '100%', transition: 'width 0.3s ease-out' }}
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                        </div>
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest animate-pulse">
                          Progress: {purgeProgress.current.toLocaleString()} deleted
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => setShowPurgeConfirm(false)}
                      disabled={purging}
                      className="px-8 py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase tracking-widest hover:bg-slate-200 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 p-4 bg-rose-50 rounded-xl border border-rose-100">
              <p className="text-xs text-rose-800 font-bold leading-relaxed">
                <AlertCircle className="w-4 h-4 inline mr-2 mb-0.5" />
                DANGER: This action will permanently remove all contract records from the database. This cannot be undone. 
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
