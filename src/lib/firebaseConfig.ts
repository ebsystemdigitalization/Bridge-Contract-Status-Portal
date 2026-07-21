export interface ClientFirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
}

export interface FirebaseConfigResult {
  firebaseConfig: ClientFirebaseConfig;
  firebaseConfigError: string | null;
}

export function getClientFirebaseConfig(env: Record<string, string | undefined> = {}): FirebaseConfigResult {
  const firebaseConfig: ClientFirebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID
  };

  const requiredFirebaseKeys = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
  const missingKeys = requiredFirebaseKeys.filter(key => !firebaseConfig[key]);

  return {
    firebaseConfig,
    firebaseConfigError: missingKeys.length > 0
      ? `Missing Firebase environment variables: ${missingKeys.map(key => `VITE_FIREBASE_${key.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()}`).join(', ')}`
      : null
  };
}
