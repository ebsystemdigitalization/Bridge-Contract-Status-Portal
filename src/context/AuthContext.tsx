import React, { useState, useEffect, createContext, useContext } from 'react';

import {

  onAuthStateChanged,

  createUserWithEmailAndPassword,

  signInWithEmailAndPassword,

  signInWithCustomToken,

  signOut

} from 'firebase/auth';

import { ShieldAlert } from 'lucide-react';

import { auth } from '../firebase';

import { UserProfile, UserStatus } from '../types';

import { portalApi } from '../services/api';

import { normalizeState, validateAuthState } from '../lib/adb2cAuth';



interface AuthContextType {

  user: any | null;

  profile: UserProfile | null;

  loading: boolean;

  isAdmin: boolean;

  isSuperAdmin: boolean;



  register: (

    username: string,

    email: string,

    password: string

  ) => Promise<void>;



  login: (

    email: string,

    password: string

  ) => Promise<any>;



  // DMS / Dealer

  loginWithADB2C: (isAuto?: boolean) => Promise<void>;

  handleADB2CCallback: (

    code: string,

    state?: string | null

  ) => Promise<void>;



  // Internal Employee

  loginWithEmployeeSSO: () => Promise<void>;

  handleEmployeeCallback: (

    code: string,

    state?: string | null

  ) => Promise<void>;



  logout: () => Promise<void>;



  sessionExpired: boolean;

  clearSessionExpired: () => void;



  isADB2C: boolean;

  isEmployeeSSO: boolean;

}



const AuthContext = createContext<AuthContextType | null>(null);



const requiredEnv = (key: string) => {

  const value = (import.meta.env as any)[key];



  if (!value) {

    throw new Error(

      `${key} is required. Configure it in the environment before using enterprise login.`

    );

  }



  return value;

};



export const useAuth = () => {

  const context = useContext(AuthContext);



  if (!context) {

    throw new Error(

      'useAuth must be used within AuthProvider'

    );

  }



  return context;

};



export const AuthProvider = ({

  children

}: {

  children: React.ReactNode;

}) => {

  const [user, setUser] = useState<any | null>(null);



  const [profile, setProfile] =

    useState<UserProfile | null>(null);



  const [loading, setLoading] =

    useState(true);



  const [sessionExpired, setSessionExpired] =

    useState(false);



  const [isADB2C, setIsADB2C] =

    useState(false);



  const [isEmployeeSSO, setIsEmployeeSSO] =

    useState(false);



  // =======================================================

  // SESSION TIMEOUT

  // =======================================================



  const TIMEOUT_MS =

    10 * 60 * 1000;



  const WARNING_MS =

    2 * 60 * 1000;



  const [lastActivity, setLastActivity] =

    useState(Date.now());



  const [showWarning, setShowWarning] =

    useState(false);



  const [timeRemaining, setTimeRemaining] =

    useState(0);



  useEffect(() => {

    if (!user) {

      setShowWarning(false);

      return;

    }



    const checkTimeout = () => {

      const now = Date.now();



      const elapsed =

        now - lastActivity;



      const remaining =

        TIMEOUT_MS - elapsed;



      if (remaining <= 0) {

        setSessionExpired(true);

        logout();

      } else if (remaining <= WARNING_MS) {

        setShowWarning(true);



        setTimeRemaining(

          Math.ceil(remaining / 1000)

        );

      } else {

        setShowWarning(false);

      }

    };



    const activityHandler = () => {

      setLastActivity(Date.now());



      if (showWarning) {

        setShowWarning(false);

      }

    };



    const interval =

      setInterval(

        checkTimeout,

        1000

      );



    window.addEventListener(

      'mousemove',

      activityHandler

    );



    window.addEventListener(

      'keydown',

      activityHandler

    );



    window.addEventListener(

      'scroll',

      activityHandler

    );



    window.addEventListener(

      'click',

      activityHandler

    );



    return () => {

      clearInterval(interval);



      window.removeEventListener(

        'mousemove',

        activityHandler

      );



      window.removeEventListener(

        'keydown',

        activityHandler

      );



      window.removeEventListener(

        'scroll',

        activityHandler

      );



      window.removeEventListener(

        'click',

        activityHandler

      );

    };

  }, [

    user,

    lastActivity,

    showWarning

  ]);



  // =======================================================

  // PKCE HELPERS

  // =======================================================



  const generateRandomString = (

    length: number

  ) => {

    const charset =

      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._\~';



    let result = '';



    for (

      let i = 0;

      i < length;

      i++

    ) {

      result += charset.charAt(

        Math.floor(

          Math.random() *

          charset.length

        )

      );

    }



    return result;

  };



  const sha256 = async (

    plain: string

  ) => {

    const encoder =

      new TextEncoder();



    const data =

      encoder.encode(plain);



    return window.crypto.subtle.digest(

      'SHA-256',

      data

    );

  };



  const base64urlencode = (

    value: ArrayBuffer

  ) => {

    let str = '';



    const bytes =

      new Uint8Array(value);



    for (

      let i = 0;

      i < bytes.byteLength;

      i++

    ) {

      str += String.fromCharCode(

        bytes[i]

      );

    }



     return btoa(str)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  };



  // =======================================================

  // DMS / DEALER - AZURE AD B2C LOGIN

  // =======================================================



  const loginWithADB2C = async (

    isAuto = false

  ) => {

    try {

      const verifier =

        generateRandomString(64);



      const challenge =

        base64urlencode(

          await sha256(verifier)

        );



      const state =

        generateRandomString(32);



      sessionStorage.setItem(

        '_sys_v1',

        verifier

      );



      sessionStorage.setItem(

        '_sys_state',

        state

      );



      const clientId =

        requiredEnv(

          'VITE_ADB2C_CLIENT_ID'

        );



      const tenantId =

        requiredEnv(

          'VITE_ADB2C_TENANT_ID'

        );



      const policy =

        requiredEnv(

          'VITE_ADB2C_POLICY'

        );



      const redirectUri =

        import.meta.env

          .VITE_ADB2C_REDIRECT_URI ||

        window.location.origin +

          '/login';



      const authUrl =

        `https\://celcomdigib2c.b2clogin.com/${tenantId}/${policy}/oauth2/v2.0/authorize?` +

        `client_id=${encodeURIComponent(clientId)}&` +

        `redirect_uri=${encodeURIComponent(redirectUri)}&` +

        `response_type=code&` +

        `scope=${encodeURIComponent('openid')}&` +

        `code_challenge=${encodeURIComponent(challenge)}&` +

        `code_challenge_method=S256&` +

        `state=${encodeURIComponent(state)}&` +

        `prompt=login`;



      if (isAuto) {

        window.location.href =

          authUrl;



        return;

      }



      const width = 600;

      const height = 700;



      const left =

        window.screenX +

        (

          window.outerWidth -

          width

        ) /

          2;



      const top =

        window.screenY +

        (

          window.outerHeight -

          height

        ) /

          2;



      const popup =

        window.open(

          authUrl,

          'adb2c_login',

          `width=${width},height=${height},left=${left},top=${top}`

        );



      if (!popup) {

        throw new Error(

          'SignIn popup was blocked. Please allow popups for this site.'

        );

      }



    } catch (error) {

      console.error(

        'ADB2C Login Initiation Error:',

        error

      );



      throw error;

    }

  };



  // =======================================================

  // DMS / DEALER CALLBACK

  // =======================================================



  const handleADB2CCallback =

    async (

      code: string,

      state?: string | null

    ) => {

      setLoading(true);



      try {

        const verifier =

          sessionStorage.getItem(

            '_sys_v1'

          );



        const storedState =

          normalizeState(

            sessionStorage.getItem(

              '_sys_state'

            )

          );



        const receivedState =

          normalizeState(state);



        if (!verifier) {

          throw new Error(

            'Missing code verifier'

          );

        }



        if (

          !validateAuthState(

            storedState,

            receivedState

          )

        ) {

          throw new Error(

            'Invalid authentication state'

          );

        }



        const redirectUri =

          import.meta.env

            .VITE_ADB2C_REDIRECT_URI ||

          window.location.origin +

            '/login';



        const response =

          await portalApi

            .adb2cCallback(

              code,

              verifier,

              redirectUri

            );



        await signInWithCustomToken(

          auth,

          response.customToken

        );



        sessionStorage.removeItem(

          '_sys_v1'

        );



        sessionStorage.removeItem(

          '_sys_state'

        );



      } catch (error) {

        console.error(

          'ADB2C Callback Error:',

          error

        );



        throw error;



      } finally {

        setLoading(false);

      }

    };



  // =======================================================

  // INTERNAL EMPLOYEE - MICROSOFT ENTRA LOGIN

  // =======================================================



  const loginWithEmployeeSSO =

    async () => {

      try {

        const verifier =

          generateRandomString(64);



        const challenge =

          base64urlencode(

            await sha256(verifier)

          );



        const state =

          generateRandomString(32);



        // Employee uses separate storage keys so it cannot

        // interfere with the existing DMS authentication.

        sessionStorage.setItem(

          '_employee_pkce_verifier',

          verifier

        );



        sessionStorage.setItem(

          '_employee_oauth_state',

          state

        );



        const clientId =

          requiredEnv(

            'VITE_EMPLOYEE_ENTRA_CLIENT_ID'

          );



        const tenantId =

          requiredEnv(

            'VITE_EMPLOYEE_ENTRA_TENANT_ID'

          );



        const redirectUri =

          import.meta.env

            .VITE_EMPLOYEE_ENTRA_REDIRECT_URI ||

          window.location.origin +

            '/auth/employee/callback';



        const scope =

          'openid profile email';



        const authUrl =

          `https\://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +

          `client_id=${encodeURIComponent(clientId)}&` +

          `response_type=code&` +

          `redirect_uri=${encodeURIComponent(redirectUri)}&` +

          `response_mode=query&` +

          `scope=${encodeURIComponent(scope)}&` +

          `code_challenge=${encodeURIComponent(challenge)}&` +

          `code_challenge_method=S256&` +

          `state=${encodeURIComponent(state)}&` +

          `prompt=select_account`;



        window.location.href =

          authUrl;



      } catch (error) {

        console.error(

          'Employee SSO Login Initiation Error:',

          error

        );



        throw error;

      }

    };



  // =======================================================

  // INTERNAL EMPLOYEE CALLBACK

  // =======================================================



  const handleEmployeeCallback =

    async (

      code: string,

      state?: string | null

    ) => {

      setLoading(true);



      try {

        const verifier =

          sessionStorage.getItem(

            '_employee_pkce_verifier'

          );



        const storedState =

          normalizeState(

            sessionStorage.getItem(

              '_employee_oauth_state'

            )

          );



        const receivedState =

          normalizeState(state);



        if (!verifier) {

          throw new Error(

            'Missing employee PKCE verifier'

          );

        }



        if (

          !validateAuthState(

            storedState,

            receivedState

          )

        ) {

          throw new Error(

            'Invalid employee authentication state'

          );

        }



        const redirectUri =

          import.meta.env

            .VITE_EMPLOYEE_ENTRA_REDIRECT_URI ||

          window.location.origin +

            '/auth/employee/callback';



        const response =

          await portalApi

            .employeeCallback(

              code,

              verifier,

              redirectUri

            );



        await signInWithCustomToken(

          auth,

          response.customToken

        );



        sessionStorage.removeItem(

          '_employee_pkce_verifier'

        );



        sessionStorage.removeItem(

          '_employee_oauth_state'

        );



      } catch (error) {

        console.error(

          'Employee SSO Callback Error:',

          error

        );



        throw error;



      } finally {

        setLoading(false);

      }

    };



  // =======================================================

  // FIREBASE AUTH STATE

  // =======================================================



  useEffect(() => {

    const unsubscribe =

      onAuthStateChanged(

        auth,

        async firebaseUser => {

          if (firebaseUser) {

            setUser(

              firebaseUser

            );



            setIsADB2C(

              firebaseUser.uid

                .startsWith(

                  'adb2c_'

                )

            );



            setIsEmployeeSSO(

              firebaseUser.uid

                .startsWith(

                  'entra_'

                )

            );



            try {

              const authToken =

                await firebaseUser

                  .getIdToken();



              const response =

                await portalApi

                  .getMyProfile(

                    authToken

                  );



              setProfile(

                response.profile

              );



            } catch (error) {

              console.error(

                'Error fetching user profile:',

                error

              );

            }



          } else {

            setUser(null);

            setProfile(null);

            setIsADB2C(false);

            setIsEmployeeSSO(false);

          }



          setLoading(false);

        }

      );



    return () =>

      unsubscribe();



  }, []);



  // =======================================================

  // FIREBASE REGISTRATION

  // =======================================================



  const register = async (

    username: string,

    inputEmail: string,

    password: string

  ) => {

    const email =

      inputEmail.includes('@')

        ? inputEmail

            .trim()

            .toLowerCase()

        : `${inputEmail

            .trim()

            .toLowerCase()}@bridge.com`;



    const bootstrapEmails = [

      import.meta.env

        .VITE_ADMIN_EMAIL

    ].filter(Boolean);



    const isBootstrap =

      bootstrapEmails.includes(

        email

      );



    const role =

      isBootstrap

        ? 'superadmin'

        : 'user';



    const status =

      isBootstrap

        ? UserStatus.ACTIVE

        : UserStatus.PENDING;



    // Preserve these for compatibility with

    // existing registration logic.

    void role;

    void status;



    try {

      const userCredential =

        await createUserWithEmailAndPassword(

          auth,

          email,

          password

        );



      const firebaseUser =

        userCredential.user;



      const authToken =

        await firebaseUser

          .getIdToken();



      const response =

        await portalApi

          .upsertMyProfile(

            authToken,

            {

              username

            }

          );



      setProfile(

        response.profile

      );



      await signOut(auth);



      setUser(null);

      setProfile(null);



    } catch (error) {

      console.error(

        'Registration failed:',

        error

      );



      throw error;

    }

  };



  // =======================================================

  // FIREBASE LOGIN

  // =======================================================



  const login = async (

    inputEmail: string,

    password: string

  ) => {

    let email =

      inputEmail

        .trim()

        .toLowerCase();



    if (!email.includes('@')) {

      try {

        const response =

          await portalApi

            .resolveLoginEmail(

              email

            );



        if (!response.email) {

          throw new Error(

            'Invalid username or password.'

          );

        }



        email =

          response.email;



      } catch {

        throw new Error(

          'Invalid username or password.'

        );

      }

    }



    const userCredential =

      await signInWithEmailAndPassword(

        auth,

        email,

        password

      );



    return userCredential.user;

  };



  // =======================================================

  // LOGOUT

  // =======================================================



  const logout = async () => {

    try {

      const wasADB2C =

        isADB2C;



      setUser(null);

      setProfile(null);

      setIsADB2C(false);

      setIsEmployeeSSO(false);



      await signOut(auth);



      sessionStorage.removeItem(

        '_sys_v1'

      );



      sessionStorage.removeItem(

        '_sys_state'

      );



      sessionStorage.removeItem(

        '_employee_pkce_verifier'

      );



      sessionStorage.removeItem(

        '_employee_oauth_state'

      );



      // Existing DMS users continue through

      // the Azure AD B2C logout endpoint.

      if (wasADB2C) {

        const tenantId =

          requiredEnv(

            'VITE_ADB2C_TENANT_ID'

          );



        const policy =

          requiredEnv(

            'VITE_ADB2C_POLICY'

          );



        const clientId =

          requiredEnv(

            'VITE_ADB2C_CLIENT_ID'

          );



        const redirectUri =

          import.meta.env

            .VITE_ADB2C_REDIRECT_URI ||

          window.location.origin +

            '/login';



        const logoutUrl =

          `https\://celcomdigib2c.b2clogin.com/${tenantId}/${policy}/oauth2/v2.0/logout?` +

          `client_id=${encodeURIComponent(clientId)}&` +

          `post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`;



        window.location.href =

          logoutUrl;



        return;

      }



      // Firebase / Employee SSO:

      // return to BCSP login page.

      window.location.href =

        '/login';



    } catch (error) {

      console.error(

        'Logout failed:',

        error

      );

    }

  };



  // =======================================================

  // CONTEXT VALUE

  // =======================================================



  const value: AuthContextType = {

    user,

    profile,

    loading,



    isAdmin:

      profile?.role === 'admin' ||

      profile?.role === 'superadmin',



    isSuperAdmin:

      profile?.role ===

      'superadmin',



    sessionExpired,



    clearSessionExpired:

      () =>

        setSessionExpired(

          false

        ),



    register,

    login,



    loginWithADB2C,

    handleADB2CCallback,



    loginWithEmployeeSSO,

    handleEmployeeCallback,



    logout,



    isADB2C,

    isEmployeeSSO

  };



  const formatTime = (

    seconds: number

  ) => {

    const mins =

      Math.floor(

        seconds / 60

      );



    const secs =

      seconds % 60;



    return `${mins}:${secs

      .toString()

      .padStart(2, '0')}`;

  };



  return (

    <AuthContext.Provider

      value={value}

    >

      {children}



      {showWarning && (

          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">

            <div

              className="absolute inset-0 bg-cd-blue/40 backdrop-blur-sm"

              onClick={() => {

                setLastActivity(

                  Date.now()

                );



                setShowWarning(

                  false

                );

              }}

            />



            <div

              className="bg-white p-10 rounded-4xl shadow-2xl border-4 border-cd-yellow relative z-10 max-w-md w-full text-center"

            >

              <div className="w-20 h-20 bg-cd-yellow/10 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-bounce">

                <ShieldAlert className="w-10 h-10 text-cd-blue" />

              </div>



              <h2 className="text-3xl font-black text-cd-blue mb-3 tracking-tighter">

                Session Expiring

              </h2>



              <p className="text-slate-500 font-medium mb-8">

                Due to inactivity on

                this portal, you will

                be logged out in{' '}

                <span className="font-black text-cd-blue underline decoration-cd-yellow decoration-4 underline-offset-4">

                  {formatTime(

                    timeRemaining

                  )}

                </span>

                .

              </p>



              <button

                onClick={() => {

                  setLastActivity(

                    Date.now()

                  );



                  setShowWarning(

                    false

                  );

                }}

                className="w-full py-5 bg-cd-blue text-white font-black rounded-2xl hover:bg-cd-blue/90 active:scale-[0.98] transition-all shadow-xl shadow-cd-blue/20"

              >

                STAY LOGGED IN

              </button>

            </div>

          </div>

      )}

    </AuthContext.Provider>

  );

};
