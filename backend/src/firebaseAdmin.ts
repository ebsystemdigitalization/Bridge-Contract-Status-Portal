import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { config } from './config.js';

let firestore: ReturnType<typeof getFirestore> | null = null;
let firestoreReady = false;
let firestoreInitError: Error | null = null;

function resolveCredential() {
  const explicitPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const candidatePaths = [
    explicitPath ? path.resolve(explicitPath) : '',
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
    path.resolve(process.cwd(), 'backend', 'serviceAccountKey.json'),
    path.resolve(process.cwd(), '..', 'serviceAccountKey.json')
  ].filter(Boolean);

  for (const candidatePath of candidatePaths) {
    if (!fs.existsSync(candidatePath)) {
      continue;
    }

    const raw = fs.readFileSync(candidatePath, 'utf8');
    return admin.credential.cert(JSON.parse(raw));
  }

  return admin.credential.applicationDefault();
}

function initializeFirestore() {
  if (firestoreReady && firestore) {
    return firestore;
  }

  if (!admin.apps.length) {
    const appOptions: admin.AppOptions = {};
    if (config.gcpProjectId) {
      appOptions.projectId = config.gcpProjectId;
    }

    try {
      appOptions.credential = resolveCredential();
      admin.initializeApp(appOptions);
    } catch (error) {
      firestoreInitError = error as Error;
      console.warn('Firestore credentials are unavailable; continuing without Firestore.', error);
      return null;
    }
  }

  const app = admin.app();
  firestore = getFirestore(app, config.firestoreDatabaseId);
  firestore.settings({ preferRest: true });
  firestoreReady = true;
  firestoreInitError = null;
  console.log('Using Firestore REST transport');
  return firestore;
}

initializeFirestore();

export function isFirestoreAvailable() {
  return firestoreReady && !!firestore;
}

export function markFirestoreUnavailable(error: unknown) {
  firestoreReady = false;
  firestore = null;
  firestoreInitError = error instanceof Error ? error : new Error(String(error));
  console.warn('Firestore became unavailable during request handling.', error);
}

export const serverTimestamp = FieldValue.serverTimestamp;
export const writeBatch = () => firestore?.batch?.() as any;

export { firestore, firestoreReady, firestoreInitError };
