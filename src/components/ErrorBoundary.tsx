import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

/**
 * Global error boundary to catch and display runtime exceptions.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isQuotaError = false;
      
      try {
        const errorStr = this.state.error.message || String(this.state.error);
        if (errorStr.toLowerCase().includes('quota') || errorStr.toLowerCase().includes('limit exceeded')) {
          isQuotaError = true;
          errorMessage = "The system has reached its daily data access limit. Please wait until the quota resets (usually tomorrow) or contact your administrator.";
        } else {
          const parsed = JSON.parse(errorStr);
          if (parsed.error) errorMessage = parsed.error;
        }
      } catch {
        errorMessage = (this.state.error.message || String(this.state.error)) || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-rose-100 relative overflow-hidden">
            {isQuotaError && <div className="absolute top-0 left-0 w-full h-1.5 bg-cd-yellow animate-pulse" />}
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className={isQuotaError ? "text-cd-yellow w-8 h-8" : "text-rose-600 w-8 h-8"} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{isQuotaError ? "Service Temporarily Throttled" : "System Error"}</h2>
            <p className="text-gray-600 mb-6 text-sm leading-relaxed">{errorMessage}</p>
            {!isQuotaError && (
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-lg"
              >
                Reload Portal
              </button>
            )}
            {isQuotaError && (
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 py-3 rounded-lg mx-4">
                Optimization fixes applied. Service will resume normally upon quota reset.
              </p>
            )}
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
