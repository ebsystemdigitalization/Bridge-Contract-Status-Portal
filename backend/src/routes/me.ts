import { Router } from 'express';
import { firestore, isFirestoreAvailable, serverTimestamp } from '../firebaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeDoc } from '../utils/firestore.js';

export function validateProfilePayload(payload: any) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'profile payload must be an object.' };
  }

  // uid is accepted because frontend sends it,
  // but backend will not trust it.
  const allowedFields = new Set([
    'uid',
    'username',
    'email'
  ]);

  for (const key of Object.keys(payload)) {
    if (!allowedFields.has(key)) {
      return { error: `unsupported field '${key}'.` };
    }
  }

  if (payload.uid !== undefined && typeof payload.uid !== 'string') {
    return { error: 'uid must be a string.' };
  }

  if (payload.username !== undefined && typeof payload.username !== 'string') {
    return { error: 'username must be a string.' };
  }

  return null;
}


export function sanitizeProfileInput(
  payload: any,
  authContext: {
    oid: string;
    name?: string;
    email?: string;
  }
) {
  const username =
    typeof payload?.username === 'string' && payload.username.trim()
      ? payload.username.trim()
      : authContext.name ||
        authContext.email?.split('@')[0] ||
        authContext.oid;

  return {
    username,
    email: authContext.email || '',
    adb2cEmail: null,
    authProvider: 'firebase'
  };
}


export const meRouter = Router();

meRouter.use(requireAuth);


// =========================
// GET PROFILE
// =========================
meRouter.get('/profile', async (req, res) => {

  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({
      error: 'Firestore is not available.'
    });
  }

  const uid = req.user!.oid;

  const snapshot = await firestore
    .collection('users')
    .doc(uid)
    .get();


  if (!snapshot.exists) {
    return res.status(404).json({
      error: 'User profile not found.'
    });
  }


  return res.json({
    profile: {
      ...serializeDoc(snapshot as any),
      uid
    }
  });

});


// =========================
// CREATE / UPDATE PROFILE
// =========================
meRouter.put('/profile', async (req, res) => {

  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({
      error: 'Firestore is not available.'
    });
  }


  const incoming = req.body?.profile || {};


  const validationError = validateProfilePayload(incoming);

  if (validationError) {
    return res.status(400).json(validationError);
  }


  // IMPORTANT:
  // Never trust incoming.uid
  // Always use authenticated token UID
  const uid = req.user!.oid;


  const sanitized = sanitizeProfileInput(
    incoming,
    {
      oid: uid,
      name: req.user?.name,
      email: req.user?.email
    }
  );


  const ref = firestore
    .collection('users')
    .doc(uid);


  const existing = await ref.get();



  // Existing user
  if (existing.exists) {

    const existingData = existing.data() as any;


    await ref.update({

      username: sanitized.username,

      email:
        existingData.email ||
        sanitized.email,

      adb2cEmail:
        existingData.adb2cEmail ??
        sanitized.adb2cEmail,


      authProvider:
        existingData.authProvider ||
        sanitized.authProvider,


      lastLoginAt:
        serverTimestamp(),


      // Keep existing approval state
      status:
        existingData.status ||
        'Pending',


      role:
        existingData.role ||
        'user'

    });

  }

  // New user
  else {

    await ref.set({

      uid,

      username:
        sanitized.username,


      email:
        sanitized.email,


      adb2cEmail:
        sanitized.adb2cEmail,


      authProvider:
        sanitized.authProvider,


      role:
        'user',


      status:
        'Pending',


      createdAt:
        serverTimestamp(),


      lastLoginAt:
        serverTimestamp()

    });

  }



  const updated = await ref.get();


  return res.json({

    profile: {
      ...serializeDoc(updated as any),
      uid
    }

  });

});