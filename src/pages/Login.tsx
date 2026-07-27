import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader2, User, Mail, Lock, ShieldCheck, UserCheck, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { Logo } from '../components/Logo';
import { isTrustedMessageOrigin } from '../lib/adb2cAuth';

export const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const { 
    user, 
    profile, 
    login, 
    register, 
    loginWithADB2C, 
    handleADB2CCallback,
    sessionExpired, 
    clearSessionExpired 
  } = useAuth();
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [codeProcessed, setCodeProcessed] = useState(false);

  // 1. Initialize Admin mode from URL - now using a secret key
  // Initialize login mode
  useEffect(() => {
    const isAdmin =
      searchParams.get('access') === 'admin';
    setIsAdminLogin(isAdmin);

    // Normal user access
    // / 
    // automatically redirect to ADB2C
    if (!isAdmin && !searchParams.get('code')) {
      loginWithADB2C(true);
    }
  }, [searchParams]);

  // 2. Handle ADB2C callback flow
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    // If we have an ADB2C code, strictly handle it and show loading
    if (code && !codeProcessed) {
      setCodeProcessed(true);
      setLoading(true);
      setError('');
      handleADB2CCallback(code, state)
        .then(() => {
          if (window.opener) {
            window.opener.postMessage({ type: 'ADB2C_AUTH_SUCCESS' }, window.location.origin);
            window.close();
          } else {
            navigate('/', { replace: true });
          }
        })
        .catch((err: any) => {
          console.error("ADB2C Handle Error:", err);
          setError(err.message || 'Staff Authentication failed. Please try again or contact IT.');
          setLoading(false);
          // Only redirect back to login if it's not a critical error we want them to see
          if (!err.message?.includes('CRITICAL')) {
            if (window.opener) {
              window.opener.postMessage({ type: 'ADB2C_AUTH_FAILURE', error: err.message }, window.location.origin);
              window.close();
            } else {
              navigate('/login', { replace: true });
            }
          }
        });
      return;
    }
  }, [searchParams, codeProcessed, handleADB2CCallback, navigate]);

  // Listen for popup messages if we are the main window
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
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  // Handle Lockout Countdown
  useEffect(() => {
    if (!lockoutTime) return;

    const timer = setInterval(() => {
      const remaining = Math.ceil((lockoutTime - Date.now()) / 1000);
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
          if (profile.role === 'admin' || profile.role === 'superadmin') {
              navigate('/admin');
          } else {
              navigate('/');
          }
        }
      } else if (profile.status === 'Pending') {
        setError('Your account is awaiting admin approval.');
      } else if (profile.status === 'Rejected') {
        setError('Your account registration has been rejected.');
      }
    }
  }, [user, profile, navigate]);

  const passwordRequirements = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_\-+=<>?/[\]{}|\\:;"',.~`]/.test(password)
  };

  const [showPassword,setShowPassword] = useState(false);

  const validatePassword = () => {

 const req = passwordRequirements;
  if(!req.length)
    return "Password must contain at least 12 characters.";

  if(!req.uppercase)
    return "Password must contain an uppercase letter.";

  if(!req.lowercase)
    return "Password must contain a lowercase letter.";

  if(!req.number)
    return "Password must contain a number.";

  if(!req.special)
    return "Password must contain a special character.";

  return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime) return;

    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        const validation = validatePassword(password);

        if (validation)
          throw new Error(validation);

        const usernameVal = email.trim().split('@')[0];

        await register(usernameVal, email.trim(), password);  
        setPassword('');
        setEmail('');
        setError('Registration successful! Your account is awaiting admin approval.');
      } else {
        await login(email.trim(), password);
        setFailedAttempts(0); 
        navigate('/');
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      
      if (!isRegistering) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        
        if (newAttempts >= 5) {
          const unlockAt = Date.now() + 30000;
          setLockoutTime(unlockAt);
          setError(`Security Breach Protection: Too many failed attempts. Locked for 30 seconds.`);
          setLoading(false);
          return;
        }
      }

      let friendlyMessage = err.message || 'Authentication failed. Please try again.';
      const errorCode = err.code || (err.message?.includes('auth/') ? err.message.match(/auth\/[a-z0-9-]+/)?.[0] : null);

      if (errorCode === 'auth/email-already-in-use') {
        friendlyMessage = 'This account already exists. Please sign in instead.';
      } else if (errorCode === 'auth/invalid-email') {
        friendlyMessage = 'Please enter a valid email address.';
      } else if (errorCode === 'auth/weak-password') {
        friendlyMessage = 'The password is too weak. Please use at least 6 characters.';
      } else if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
        friendlyMessage = 'Invalid credentials. Please check your username/email and password.';
      } else if (errorCode === 'auth/too-many-requests') {
        friendlyMessage = 'Too many failed attempts. Please try again later.';
      }
      
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // Show loader only while processing an ADB2C callback code.
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
        <div className="text-center mb-10">
          <div className="flex justify-center mb-2">
            
          </div>
          <div className="flex justify-center">
            <p className="text-xs font-black text-cd-cyan tracking-[0.4em] uppercase">
              Bridge Contract Status Portal
            </p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-4xl shadow-2xl shadow-slate-200/60 border border-slate-100 transition-all">
          {isAdminLogin && (
          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
            <button
              onClick={() => { 
                setIsAdminLogin(false); 
                setError('');
                // Remove access=admin from URL when switching to Staff
                if (searchParams.get('access') === 'admin') {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('access');
                  navigate(`/login?${newParams.toString()}`, { replace: true });
                }
              }}
              className={cn(
                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2 flex items-center justify-center",
                !isAdminLogin ? "bg-white text-cd-blue shadow-lg" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <UserCheck className="w-4 h-4" />
              Staff
            </button>
            <button
              onClick={() => { setIsAdminLogin(true); setError(''); }}
              className={cn(
                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2 flex items-center justify-center",
                isAdminLogin ? "bg-white text-cd-blue shadow-lg" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin
            </button>
          </div>
          )}

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "mb-6 p-4 border-2 rounded-2xl flex items-center gap-3 text-sm font-bold",
                  error.includes('successful') || error.includes('awaiting') 
                    ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                    : "bg-rose-50 border-rose-100 text-rose-700"
                )}
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {!isAdminLogin ? (
            <div className="space-y-6">
              <div className="text-center py-4">
                <h3 className="text-xl font-black text-cd-blue mb-2">Staff Portal Access</h3>
                <p className="text-slate-400 text-sm font-medium">Please sign in using your designated DMS ID.</p>
              </div>
              
              <button
                onClick={() => loginWithADB2C(true)}
                disabled={loading}
                className="w-full py-6 bg-cd-blue text-white font-black rounded-2xl hover:bg-cd-blue/90 active:scale-[0.98] transition-all flex items-center justify-center gap-4 shadow-xl shadow-cd-blue/20"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    LOGIN WITH DMS ID
                  </>
                )}
              </button>
              
              <div className="pt-4 text-center">
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  Secure Identity verification via Azure AD B2C
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-4">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className={cn(
                    "flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                    !isRegistering ? "bg-white text-cd-blue shadow" : "text-slate-400"
                  )}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegistering(true)}
                  className={cn(
                    "flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                    isRegistering ? "bg-white text-cd-blue shadow" : "text-slate-400"
                  )}
                >
                  Register
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                  ADMIN USERNAME
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-cd-blue/10 focus:border-cd-blue outline-none font-bold text-slate-700 transition-all placeholder:text-slate-300"
                    placeholder="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">PASSWORD</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-cd-blue/10 focus:border-cd-blue outline-none font-bold text-slate-700 transition-all placeholder:text-slate-300"
                    placeholder="••••••••"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-cd-blue hover:text-cd-blue/70"
                  >
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>

                {isRegistering && (
                  <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                      Password Requirements
                    </p>

                    <div className="space-y-2 text-xs font-bold">

                      <div className={passwordRequirements.length ? "text-emerald-600" : "text-slate-400"}>
                        {passwordRequirements.length ? "✓" : "○"} At least 12 characters
                      </div>

                      <div className={passwordRequirements.uppercase ? "text-emerald-600" : "text-slate-400"}>
                        {passwordRequirements.uppercase ? "✓" : "○"} One uppercase letter (A-Z)
                      </div>

                      <div className={passwordRequirements.lowercase ? "text-emerald-600" : "text-slate-400"}>
                        {passwordRequirements.lowercase ? "✓" : "○"} One lowercase letter (a-z)
                      </div>

                      <div className={passwordRequirements.number ? "text-emerald-600" : "text-slate-400"}>
                        {passwordRequirements.number ? "✓" : "○"} One number (0-9)
                      </div>

                      <div className={passwordRequirements.special ? "text-emerald-600" : "text-slate-400"}>
                        {passwordRequirements.special ? "✓" : "○"} One special character (!@#$%^&*)
                      </div>

                    </div>
                  </div>
                )}
              </div>

              

              <button
                type="submit"
                disabled={
                loading ||
                !!lockoutTime ||
                (isRegistering && !!validatePassword())
                }
                className={cn(
                  "w-full py-5 text-white font-black rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-2xl",
                  lockoutTime ? "bg-slate-400 shadow-none cursor-not-allowed" : "bg-cd-blue hover:bg-cd-blue/90 shadow-cd-blue/30"
                )}
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : lockoutTime ? (
                  `LOCKED (${timeRemaining}s)`
                ) : isRegistering ? (
                  'CREATE ADMIN ACCOUNT'
                ) : (
                  'ADMIN SIGN IN'
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
