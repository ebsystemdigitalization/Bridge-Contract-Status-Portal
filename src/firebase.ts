import { initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { getClientFirebaseConfig } from './lib/firebaseConfig.js';

const { firebaseConfig, firebaseConfigError } = getClientFirebaseConfig(import.meta.env);

let firebaseAuth: Auth | null = null;

if (!firebaseConfigError) {
  const app = initializeApp(firebaseConfig);
  firebaseAuth = getAuth(app);
}

export { firebaseConfigError };
export const auth = firebaseAuth;
