import { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import admin from 'firebase-admin';
import { config } from '../config.js';
import { firestore, isFirestoreAvailable, serverTimestamp } from '../firebaseAdmin.js';
import { normalizeAuthProvider } from '../utils/authIdentity.js';

export interface AuthenticatedUser {
  oid: string;
  subject: string;
  email?: string;
  name?: string;
  role: 'superadmin' | 'admin' | 'user';
  status: 'Active' | 'Pending' | 'Rejected';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const issuer = `https://${config.entraTenantName}.b2clogin.com/${config.entraTenantId}/v2.0/`;
const jwksUrl = `https://${config.entraTenantName}.b2clogin.com/${config.entraTenantName}.onmicrosoft.com/${config.entraPolicy}/discovery/v2.0/keys`;
const jwks = createRemoteJWKSet(new URL(jwksUrl));

async function getUserProfile(authUser: AuthenticatedUser,defaultStatus: 'Active' | 'Pending' = 'Pending') {
  if (!isFirestoreAvailable() || !firestore) {
    return {
      uid: authUser.oid,
      username: authUser.name || authUser.email?.split('@')[0] || authUser.oid,
      email: authUser.email,
      role: 'user',
      status: defaultStatus,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    };
  }

  const userDoc = await firestore.collection('users').doc(authUser.oid).get();
  if (!userDoc.exists) {
    const authProvider = normalizeAuthProvider(config.authProvider);
    const isADB2C = authProvider === 'adb2c';
    const profile = {
      uid: authUser.oid,
      username: authUser.name || authUser.email?.split('@')[0] || authUser.oid,
      email: authUser.email,
      authProvider,
      role: 'user',
      status: isADB2C ? 'Active' : 'Pending',
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    };
    await userDoc.ref.set(profile);
    return profile;
  }

  const profile = userDoc.data() as any;
  await userDoc.ref.update({ lastLoginAt: serverTimestamp() });
  return profile;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';

    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token.' });
    }

    if (config.authProvider === 'legacy-firebase') {
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: 'Legacy Firebase auth is disabled in production.' });
      }

      const decoded = await admin.auth().verifyIdToken(token);

      const oid = decoded.uid;
      const profile = await getUserProfile({
        oid,
        subject: decoded.uid,
        email: decoded.email,
        name: decoded.name || decoded.email?.split('@')[0],
        role: 'user',
        status: 'Active'
      });

      if (profile.status === 'Rejected') {
        return res.status(403).json({ error: 'Your account registration has been rejected.' });
      }

      req.user = {
        oid,
        subject: decoded.uid,
        email: profile.email || decoded.email,
        name: profile.username || decoded.name,
        role: profile.role || 'user',
        status: profile.status
      };
      return next();
    }

    if (config.entraAudience.startsWith('(configure') || config.entraTenantName.startsWith('(configure')) {
      return res.status(500).json({ error: 'Entra ID token validation is not configured.' });
    }

    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: config.entraAudience
    });

    const oid = String(payload.oid || payload.sub || '');
    if (!oid) {
      return res.status(401).json({ error: 'Token does not contain a usable subject.' });
    }

    const profile = await getUserProfile({
      oid,
      subject: String(payload.sub || oid),
      email: String((payload.emails as string[] | undefined)?.[0] || payload.email || ''),
      name: String(payload.name || ''),
      role: 'user',
      status: 'Active'
    });

    if (profile.status !== 'Active') {
      return res.status(403).json({ error: 'User is not active.' });
    }

    req.user = {
      oid,
      subject: String(payload.sub || oid),
      email: profile.email,
      name: profile.username,
      role: profile.role || 'user',
      status: profile.status
    };
    return next();
  } catch (error) {
    console.warn('Token validation failed.');
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin' || req.user?.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin access is required.' });
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({ error: 'Superadmin access is required.' });
}
