import test from 'node:test';
import assert from 'node:assert/strict';
import { getClientFirebaseConfig } from './firebaseConfig.js';

test('builds a minimal browser Firebase config and omits non-essential keys', () => {
  const { firebaseConfig, firebaseConfigError } = getClientFirebaseConfig({
    VITE_FIREBASE_API_KEY: 'test-api-key',
    VITE_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'test-project',
    VITE_FIREBASE_APP_ID: 'test-app-id',
    VITE_FIREBASE_STORAGE_BUCKET: 'bucket',
    VITE_FIREBASE_MESSAGING_SENDER_ID: 'sender-id'
  });

  assert.deepEqual(firebaseConfig, {
    apiKey: 'test-api-key',
    authDomain: 'example.firebaseapp.com',
    projectId: 'test-project',
    appId: 'test-app-id'
  });
  assert.equal(firebaseConfigError, null);
});
