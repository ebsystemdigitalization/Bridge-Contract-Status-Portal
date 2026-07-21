import React from 'react';
import { cn } from '../lib/utils';

/**
 * Visual badge for contract status (Active/Expired).
 * @param status - The contract status string
 */
export const ContractStatusBadge = ({ status }: { status: string }) => {
  const isActive = status === 'ACTIVE';
  const displayStatus = status === 'EXPIRED' ? 'NO CONTRACT' : status;
  return (
    <span className={cn(
      "inline-block whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em]",
      isActive ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-rose-100 text-rose-700 border border-rose-200"
    )}>
      {displayStatus}
    </span>
  );
};
