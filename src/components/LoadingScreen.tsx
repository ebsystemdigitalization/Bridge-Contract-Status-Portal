import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Full-screen loading indicator.
 */
export const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center justify-center gap-6 text-center">
      <div className="h-16 w-32 flex items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
        <span className="text-sm font-black uppercase tracking-[0.25em] text-slate-700">
          Bridge Portal
        </span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 text-cd-blue animate-spin" />
        <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">Loading Portal...</p>
      </div>
    </div>
  </div>
);
