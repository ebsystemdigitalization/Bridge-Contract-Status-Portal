import { Router } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import admin from 'firebase-admin';
import { config } from '../config.js';
import { firestore, isFirestoreAvailable } from '../firebaseAdmin.js';

const issuer = `https://${config.entraTenantName}.b2clogin.com/${config.entraTenantId}/v2.0/`;
const jwksUrl = `https://${config.entraTenantName}.b2clogin.com/${config.entraTenantName}.onmicrosoft.com/${config.entraPolicy}/discovery/v2.0/keys`;
const jwks = createRemoteJWKSet(new URL(jwksUrl));

export const authRouter = Router();

authRouter.post('/resolve-login', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  if (!username) {
    return res.status(400).json({ error: 'username is required.' });
  }

  if (username.includes('@')) {
    return res.json({ email: username });
  }

  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({ error: 'Firestore is not available.' });
  }

  const snapshot = await firestore
    .collection('users')
    .where('username', '==', username)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return res.json({ email: `${username}@celcomdigi.com` });
  }

  const user = snapshot.docs[0].data() as any;
  return res.json({ email: user.email || `${username}@celcomdigi.com` });
});

authRouter.post('/adb2c-sign-in', async (req, res) => {
  const idToken = String(req.body?.idToken || '');
  if (!idToken) {
    return res.status(400).json({ error: 'idToken is required.' });
  }

  if (config.entraAudience.startsWith('(configure') || config.entraTenantName.startsWith('(configure')) {
    return res.status(500).json({ error: 'Entra ID token validation is not configured.' });
  }

  try {
    if (!isFirestoreAvailable() || !firestore) {
      return res.status(503).json({ error: 'Firestore is not available.' });
    }
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer,
      audience: config.entraAudience
    });

    const uid = String(payload.oid || payload.sub || '');
    if (!uid) {
      return res.status(401).json({ error: 'Token does not contain a usable subject.' });
    }

    const customToken = await admin.auth().createCustomToken(uid, { provider: 'adb2c' });
    return res.json({ customToken });
  } catch (error) {
    console.error('ADB2C sign-in failed:', error);
    return res.status(401).json({ error: 'Invalid ADB2C token.' });
  }
});
