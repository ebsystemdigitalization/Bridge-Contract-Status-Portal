import { Router } from 'express';
import { firestore, isFirestoreAvailable, serverTimestamp } from '../firebaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeDoc } from '../utils/firestore.js';

export function validateProfilePayload(payload: any) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'profile payload must be an object.' };
  }

  const allowedFields = new Set(['username']);
  for (const key of Object.keys(payload)) {
    if (!allowedFields.has(key)) {
      return { error: `unsupported field '${key}'.` };
    }
  }

  if (payload.username !== undefined && typeof payload.username !== 'string') {
    return { error: 'username must be a string.' };
  }

  return null;
}

export function sanitizeProfileInput(payload: any, authContext: { oid: string; name?: string; email?: string }) {
  const username = typeof payload?.username === 'string' && payload.username.trim()
    ? payload.username.trim()
    : authContext.name || authContext.email?.split('@')[0] || authContext.oid;

  return {
    username,
    email: authContext.email || '',
    adb2cEmail: null,
    authProvider: 'adb2c'
  };
}

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get('/profile', async (req, res) => {
  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({ error: 'Firestore is not available.' });
  }
  const snapshot = await firestore.collection('users').doc(req.user!.oid).get();
  if (!snapshot.exists) {
    return res.status(404).json({ error: 'User profile not found.' });
  }
  return res.json({ profile: { ...serializeDoc(snapshot as any), uid: req.user!.oid } });
});

meRouter.put('/profile', async (req, res) => {
  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({ error: 'Firestore is not available.' });
  }
  const incoming = req.body?.profile || {};
  const validationError = validateProfilePayload(incoming);
  if (validationError) {
    return res.status(400).json(validationError);
  }

  const uid = req.user!.oid;
  const sanitized = sanitizeProfileInput(incoming, {
    oid: uid,
    name: req.user?.name,
    email: req.user?.email
  });

  const safeProfile = {
    uid,
    username: sanitized.username,
    email: sanitized.email,
    adb2cEmail: sanitized.adb2cEmail,
    authProvider: sanitized.authProvider,
    role: 'user',
    status: 'Pending',
    createdAt: incoming.createdAt || serverTimestamp(),
    lastLoginAt: serverTimestamp()
  };

  const ref = firestore.collection('users').doc(uid);
  const existing = await ref.get();
  if (existing.exists) {
    const existingData = existing.data() as any;
    await ref.update({
      username: safeProfile.username,
      email: existingData.email || safeProfile.email,
      adb2cEmail: existingData.adb2cEmail ?? safeProfile.adb2cEmail,
      authProvider: existingData.authProvider || safeProfile.authProvider,
      lastLoginAt: serverTimestamp(),
      status: existingData.status || safeProfile.status,
      role: existingData.role || safeProfile.role
    });
  } else {
    await ref.set(safeProfile);
  }

  const updated = await ref.get();
  return res.json({ profile: { ...serializeDoc(updated as any), uid } });
});
