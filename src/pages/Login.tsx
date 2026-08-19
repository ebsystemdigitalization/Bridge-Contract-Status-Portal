import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { isTrustedMessageOrigin } from '../lib/adb2cAuth';

export const Login = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const {
    user,
    profile,
    loginWithADB2C,
    handleADB2CCallback,
    sessionExpired,
    clearSessionExpired
  } = useAuth();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [codeProcessed, setCodeProcessed] = useState(false);

  // Handle ADB2C callback flow
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && !codeProcessed) {
      setCodeProcessed(true);
      setLoading(true);
      setError('');

      handleADB2CCallback(code, state)
        .then(() => {
          if (window.opener) {
            window.opener.postMessage(
              { type: 'ADB2C_AUTH_SUCCESS' },
              window.location.origin
            );
            window.close();
          } else {
            navigate('/', { replace: true });
          }
        })
        .catch((err: any) => {
          console.error('ADB2C Handle Error:', err);

          setError(
            err.message ||
              'Staff Authentication failed. Please try again or contact IT.'
          );

          setLoading(false);

          if (!err.message?.includes('CRITICAL')) {
            if (window.opener) {
              window.opener.postMessage(
                {
                  type: 'ADB2C_AUTH_FAILURE',
                  error: err.message
                },
                window.location.origin
              );

              window.close();
            } else {
              navigate('/login', { replace: true });
            }
          }
        });

      return;
    }
  }, [
    searchParams,
    codeProcessed,
    handleADB2CCallback,
    navigate
  ]);

  // Listen for popup messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const expectedOrigin = window.location.origin;

      if (!isTrustedMessageOrigin(event.origin, expectedOrigin)) {
        return;
      }

      if (event.data?.type === 'ADB2C_AUTH_SUCCESS') {
        navigate('/', { replace: true });
      } else if (event.data?.type === 'ADB2C_AUTH_FAILURE') {
        setError(event.data.error || 'Authentication failed');
      }
    };

    window.addEventListener('message', handleMessage);

    return () =>
      window.removeEventListener('message', handleMessage);
  }, [navigate]);

  // Handle lockout countdown
  useEffect(() => {
    if (!lockoutTime) return;

    const timer = setInterval(() => {
      const remaining = Math.ceil(
        (lockoutTime - Date.now()) / 1000
      );

      if (remaining <= 0) {
        setLockoutTime(null);
        setFailedAttempts(0);
        setError('');
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutTime]);

  useEffect(() => {
    if (sessionExpired) {
      setError('You have been logged out due to inactivity.');
      clearSessionExpired();
    }
  }, [sessionExpired, clearSessionExpired]);

  useEffect(() => {
    if (user && profile) {
      if (profile.status === 'Active') {
        navigate('/');
      } else if (profile.status === 'Pending') {
        setError('Your account is awaiting admin approval.');
      } else if (profile.status === 'Rejected') {
        setError(
          'Your account registration has been rejected.'
        );
      }
    }
  }, [user, profile, navigate]);

  // Temporary Internal Employee SSO handler
  const handleInternalLogin = () => {
    setError(
      'Internal Employee SSO is currently being configured.'
    );

    /*
      Later this will become something like:

      loginWithInternalSSO();

      We will add this after IT provides:
      - Employee Entra ID Client ID
      - Tenant ID
      - Authorization endpoint
      - Token endpoint / OIDC metadata
      - Confirmed redirect URI
    */
  };

  const isProcessingCode = !!searchParams.get('code');

  if (isProcessingCode && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#001871]">
        <div className="text-center">

          <Loader2 className="w-12 h-12 animate-spin text-cd-cyan mx-auto mb-4" />

          <p className="text-cd-cyan font-black tracking-widest text-xs uppercase animate-pulse">
            Finalizing Secure Access...
          </p>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#001871] p-4 relative overflow-hidden">

      {/* Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">

        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-[#009BDF]/20 rounded-full blur-[120px]" />

        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#0064DC]/30 rounded-full blur-[100px]" />

        <div className="absolute top-[10%] right-[5%] w-[40%] h-[40%] bg-[#7ED3F1]/10 rounded-full blur-[80px]" />

      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full relative z-10"
      >

        {/* Portal title */}
        <div className="text-center mb-10">

          <div className="flex justify-center">

            <p className="text-xs font-black text-cd-cyan tracking-[0.4em] uppercase">
              Bridge Contract Status Portal
            </p>

          </div>

        </div>

        {/* Login card */}
        <div className="bg-white p-10 rounded-4xl shadow-2xl shadow-slate-200/60 border border-slate-100 transition-all">

          <AnimatePresence mode="wait">

            {error && (
              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.95
                }}
                animate={{
                  opacity: 1,
                  scale: 1
                }}
                exit={{
                  opacity: 0,
                  scale: 0.95
                }}
                className={cn(
                  'mb-6 p-4 border-2 rounded-2xl flex items-center gap-3 text-sm font-bold',
                  error.includes('successful') ||
                    error.includes('awaiting')
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-rose-50 border-rose-100 text-rose-700'
                )}
              >

                <AlertCircle className="w-5 h-5 shrink-0" />

                {error}

              </motion.div>
            )}

          </AnimatePresence>

          <div className="space-y-6">

            {/* Header */}
            <div className="text-center py-4">

              <h3 className="text-xl font-black text-cd-blue mb-2">
                Staff Portal Access
              </h3>

              <p className="text-slate-400 text-sm font-medium">
                Please select your login method.
              </p>

            </div>

            {/* ============================= */}
            {/* DMS DEALER LOGIN */}
            {/* ============================= */}

            <button
              onClick={() => loginWithADB2C(true)}
              disabled={loading}
              className="w-full py-6 bg-cd-blue text-white font-black rounded-2xl hover:bg-cd-blue/90 active:scale-[0.98] transition-all flex items-center justify-center gap-4 shadow-xl shadow-cd-blue/20"
            >

              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                'LOGIN WITH DMS ID'
              )}

            </button>

            {/* Separator */}

            <div className="flex items-center gap-4">

              <div className="h-px bg-slate-200 flex-1" />

              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                OR
              </span>

              <div className="h-px bg-slate-200 flex-1" />

            </div>

            {/* ============================= */}
            {/* INTERNAL EMPLOYEE LOGIN */}
            {/* ============================= */}

            <button
              onClick={handleInternalLogin}
              disabled={loading}
              className="w-full py-6 bg-[#009BDF] text-white font-black rounded-2xl hover:bg-[#0088c4] active:scale-[0.98] transition-all flex items-center justify-center gap-4 shadow-xl shadow-[#009BDF]/20"
            >

              INTERNAL USERS LOGIN

            </button>

            {/* Footer */}

            <div className="pt-4 text-center">

              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                Secure Identity Verification
              </p>

            </div>

          </div>

        </div>

      </motion.div>

    </div>
  );
};