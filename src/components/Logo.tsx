import React, { useState } from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  variant?: 'light' | 'dark';
  src?: string;
}

/**
 * Reusable Logo component for Bridge Contract Status Portal.
 * Uses the user-provided logo with a neutral text fallback.
 */
export const Logo = ({ className, showText = true, variant = 'dark', src }: LogoProps) => {
  const [imageError, setImageError] = useState(false);

  const logoUrl = src?.trim() || '';

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative h-full flex items-center">
        {logoUrl && !imageError ? (
          <img 
            src={logoUrl}
            alt="Bridge Portal Logo"
            className="h-full w-auto object-contain"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          <span className="text-base font-black uppercase tracking-[0.25em] text-slate-700">
            Bridge Portal
          </span>
        )}
      </div>
    </div>
  );
};
