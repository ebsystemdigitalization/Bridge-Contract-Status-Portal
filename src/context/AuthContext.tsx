import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  User 
} from 'firebase/auth';
import { ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jwtDecode } from 'jwt-decode';
import { auth } from '../firebase';
import { UserProfile, UserStatus } from '../types';
import { portalApi } from '../services/api';
import { normalizeState, validateAuthState } from '../lib/adb2cAuth';

interface AuthContextType {
  user: any | null; // Can be Firebase User or ADB2C User Info
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  register: (username: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithADB2C: (isAuto?: boolean) => void;
  handleADB2CCallback: (code: string, state?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  isADB2C: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const requiredEnv = (key: string) => {
  const value = (import.meta.env as any)[key];
  if (!value) {
    throw new Error(`${key} is required. Configure it in the environment before using enterprise login.`);
  }
  return value;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isADB2C, setIsADB2C] = useState(false);

  // Session Timeout Logic
  const TIMEOUT_MS = 10 * 60 * 1000;
  const WARNING_MS = 2 * 60 * 1000;
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!user) {
      setShowWarning(false);
      return;
    }

    const checkTimeout = () => {
      const now = Date.now();
      const elapsed = now - lastActivity;
      const remaining = TIMEOUT_MS - elapsed;

      if (remaining <= 0) {
        setSessionExpired(true);
        logout();
      } else if (remaining <= WARNING_MS) {
        setShowWarning(true);
        setTimeRemaining(Math.ceil(remaining / 1000));
      } else {
        setShowWarning(false);
      }
    };

    const activityHandler = () => {
      setLastActivity(Date.now());
      if (showWarning) setShowWarning(false);
    };

    const interval = setInterval(checkTimeout, 1000);
    window.addEventListener('mousemove', activityHandler);
    window.addEventListener('keydown', activityHandler);
    window.addEventListener('scroll', activityHandler);
    window.addEventListener('click', activityHandler);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', activityHandler);
      window.removeEventListener('keydown', activityHandler);
      window.removeEventListener('scroll', activityHandler);
      window.removeEventListener('click', activityHandler);
    };
  }, [user, lastActivity, showWarning]);

  // PKCE Helpers
  const generateRandomString = (length: number) => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  };

  const sha256 = async (plain: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  };

  const base64urlencode = (a: ArrayBuffer) => {
    let str = "";
    const bytes = new Uint8Array(a);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return btoa(str)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  const loginWithADB2C = async (isAuto = false) => {
    try {
      const verifier = generateRandomString(64);
      const challenge = base64urlencode(await sha256(verifier));
      const state = generateRandomString(32);
      
      localStorage.setItem('_sys_v1', verifier);
      localStorage.setItem('_sys_state', state);
      
      const clientId = requiredEnv('VITE_ADB2C_CLIENT_ID');
      const tenantId = requiredEnv('VITE_ADB2C_TENANT_ID');
      const policy = requiredEnv('VITE_ADB2C_POLICY');
      const redirectUri = import.meta.env.VITE_ADB2C_REDIRECT_URI || window.location.origin + '/login';
      
      // Construct authorize URL
      const authUrl = `https://celcomdigib2c.b2clogin.com/${tenantId}/${policy}/oauth2/v2.0/authorize?` + 
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=openid&` +
        `code_challenge=${challenge}&` +
        `code_challenge_method=S256&` +
        `state=${encodeURIComponent(state)}&` +
        `prompt=login`;
        
      if (isAuto) {
        window.location.href = authUrl;
      } else {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          authUrl,
          'adb2c_login',
          `width=${width},height=${height},left=${left},top=${top}`
        );
        
        if (!popup) {
          throw new Error('SignIn popup was blocked. Please allow popups for this site.');
        }
      }
    } catch (error) {
      console.error('ADB2C Login Initiation Error:', error);
      throw error;
    }
  };

  const handleADB2CCallback = async (code: string, state?: string | null) => {
    setLoading(true);
    try {
      const verifier = localStorage.getItem('_sys_v1');
      const storedState = normalizeState(localStorage.getItem('_sys_state'));
      const receivedState = normalizeState(state);
      if (!verifier) throw new Error('Missing code verifier');
      if (!validateAuthState(storedState, receivedState)) {
        throw new Error('Invalid authentication state');
      }

      const clientId = requiredEnv('VITE_ADB2C_CLIENT_ID');
      const tenantId = requiredEnv('VITE_ADB2C_TENANT_ID');
      const policy = requiredEnv('VITE_ADB2C_POLICY');
      const redirectUri = import.meta.env.VITE_ADB2C_REDIRECT_URI || window.location.origin + '/login';

      const tokenUrl = `https://celcomdigib2c.b2clogin.com/${tenantId}/${policy}/oauth2/v2.0/token`;
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          redirect_uri: redirectUri,
          code: code,
          code_verifier: verifier
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error_description || 'Failed to exchange code');
      }

      const data = await response.json();
      const idToken = data.id_token;
      const decoded: any = jwtDecode(idToken);
      
      // Extract Staff ID (format: 20601112)
      // Usually in 'extension_StaffId' or can be found in other claims
      const staffId = (decoded.extension_StaffId || decoded.oid || decoded.sub || 'unknown').toLowerCase();
      const username = decoded.name || decoded.given_name || staffId;
      const realEmail = (decoded.email || decoded.emails?.[0] || `${staffId}@celcomdigi.com`).toLowerCase();

      const signInResponse = await portalApi.adb2cSignIn(idToken);
      const firebaseCredential = await signInWithCustomToken(auth, signInResponse.customToken);
      const firebaseUser = firebaseCredential.user;

      if (!firebaseUser) {
        throw new Error('Firebase login failed after ADB2C validation.');
      }

      const adb2cUid = firebaseUser.uid;
      const authToken = await firebaseUser.getIdToken();
      const profileResponse = await portalApi.upsertMyProfile(authToken, {
        uid: adb2cUid,
        username,
        email: realEmail,
        role: 'user',
        status: UserStatus.ACTIVE,
        adb2cEmail: realEmail
      });
      const profileData = profileResponse.profile;

      // User profile is now kept in-memory only (removed localStorage cache to hide from DevTools)
      setUser(firebaseUser);
      setProfile(profileData);
      setIsADB2C(true);
      
      localStorage.removeItem('_sys_v1');
      localStorage.removeItem('_sys_state');
      
    } catch (error) {
      console.error('ADB2C Callback Error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Check if this is an ADB2C shadow account (either domain)
        setIsADB2C(firebaseUser.email?.endsWith('.adb2c@celcomdigi.com') || firebaseUser.email?.endsWith('@adb2c.internal') || false);
        
        // Removed localStorage cache check to hide profile from DevTools

        try {
          const authToken = await firebaseUser.getIdToken();
          const response = await portalApi.getMyProfile(authToken);
          setProfile(response.profile);
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUser(null);
        setProfile(null);
        setIsADB2C(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const register = async (username: string, inputEmail: string, password: string) => {
    const email = inputEmail.includes('@') ? inputEmail.trim().toLowerCase() : `${inputEmail.trim().toLowerCase()}@bridge.com`;
    const bootstrapEmails = [import.meta.env.VITE_ADMIN_EMAIL].filter(Boolean);
    const isBootstrap = bootstrapEmails.includes(email);
    const role = isBootstrap ? 'superadmin' : 'user';
    const status = isBootstrap ? UserStatus.ACTIVE : UserStatus.PENDING;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const newProfile: UserProfile = {
        uid,
        username,
        email,
        role,
        status,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      try {
        const authToken = await userCredential.user.getIdToken();
        const response = await portalApi.upsertMyProfile(authToken, newProfile);

        setProfile(response.profile);

        // Prevent auto-login after registration
        await signOut(auth);

        setUser(null);
        setProfile(null);
      } catch (profileErr: any) {
        console.error("User profile creation error:", profileErr);
        throw profileErr;
      }
    } catch (error: any) {
      throw error;
    }
  };

  const login = async (inputEmail: string, password: string) => {
    let email = inputEmail.trim().toLowerCase();
    if (!email.includes('@')) {
      try {
        const response = await portalApi.resolveLoginEmail(email);
        email = response.email || `${email}@celcomdigi.com`;
      } catch (e) {
        email = `${email}@celcomdigi.com`;
      }
    }
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  };

  const logout = async () => {
    setUser(null);
    setProfile(null);
    setIsADB2C(false);
    await signOut(auth);
  };

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || profile?.role === 'superadmin',
    isSuperAdmin: profile?.role === 'superadmin',
    sessionExpired,
    clearSessionExpired: () => setSessionExpired(false),
    register,
    login,
    loginWithADB2C,
    handleADB2CCallback,
    logout,
    isADB2C
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      
      <AnimatePresence>
        {showWarning && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-cd-blue/40 backdrop-blur-sm"
              onClick={() => {
                setLastActivity(Date.now());
                setShowWarning(false);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white p-10 rounded-4xl shadow-2xl border-4 border-cd-yellow relative z-10 max-w-md w-full text-center"
            >
              <div className="w-20 h-20 bg-cd-yellow/10 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-bounce">
                <ShieldAlert className="w-10 h-10 text-cd-blue" />
              </div>
              <h2 className="text-3xl font-black text-cd-blue mb-3 tracking-tighter">Session Expiring</h2>
              <p className="text-slate-500 font-medium mb-8">
                Due to inactivity on this portal, you will be logged out in <span className="font-black text-cd-blue underline decoration-cd-yellow decoration-4 underline-offset-4">{formatTime(timeRemaining)}</span>.
              </p>
              <button
                onClick={() => {
                  setLastActivity(Date.now());
                  setShowWarning(false);
                }}
                className="w-full py-5 bg-cd-blue text-white font-black rounded-2xl hover:bg-cd-blue/90 active:scale-[0.98] transition-all shadow-xl shadow-cd-blue/20"
              >
                STAY LOGGED IN
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  );
};
