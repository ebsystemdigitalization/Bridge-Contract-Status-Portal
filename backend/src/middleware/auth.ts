import { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import admin from 'firebase-admin';

import { config } from '../config.js';
import { firestore, isFirestoreAvailable, serverTimestamp } from '../firebaseAdmin.js';

export interface AuthenticatedUser {
  oid: string;
  subject: string;
  email?: string;
  name?: string;
  authProvider?: 'adb2c' | 'firebase';
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

const jwksUrl =
  `https://${config.entraTenantName}.b2clogin.com/${config.entraTenantName}.onmicrosoft.com/${config.entraPolicy}/discovery/v2.0/keys`;

const jwks = createRemoteJWKSet(new URL(jwksUrl));


async function getUserProfile(
  authUser: AuthenticatedUser,
  defaultStatus: 'Active' | 'Pending' = 'Pending'
) {

  if (!isFirestoreAvailable() || !firestore) {
    return {
      uid: authUser.oid,
      username: authUser.name || authUser.email?.split('@')[0] || authUser.oid,
      email: authUser.email,
      authProvider: authUser.authProvider,
      role: 'user',
      status: defaultStatus,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    };
  }


  const userDoc = await firestore
    .collection('users')
    .doc(authUser.oid)
    .get();


  if (!userDoc.exists) {

    const profile = {
      uid: authUser.oid,
      username: authUser.name || authUser.email?.split('@')[0] || authUser.oid,
      email: authUser.email,
      authProvider: authUser.authProvider,
      role: 'user',
      status:
        authUser.authProvider === 'adb2c'
          ? 'Active'
          : defaultStatus,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    };

    await userDoc.ref.set(profile);

    return profile;
  }


  const profile = userDoc.data() as any;

  await userDoc.ref.update({
    lastLoginAt: serverTimestamp()
  });

  return profile;
}


export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {

  try {

    const header = req.header('authorization') || '';

    const token =
      header.startsWith('Bearer ')
        ? header.substring(7)
        : '';


    if (!token) {
      return res.status(401).json({
        error: 'Missing bearer token.'
      });
    }


    try {

      const { payload } = await jwtVerify(
        token,
        jwks,
        {
          issuer,
          audience: config.entraAudience
        }
      );


      const oid =
        String(payload.oid || payload.sub || '');


      if (!oid) {
        throw new Error('Missing user identifier');
      }


      const email =
        String(
          (payload.emails as string[] | undefined)?.[0] ||
          payload.email ||
          ''
        );


      const profile = await getUserProfile(
        {
          oid,
          subject: String(payload.sub || oid),
          email,
          name: String(payload.name || ''),
          authProvider: 'adb2c',
          role: 'user',
          status: 'Active'
        },
        'Active'
      );


      if (profile.status !== 'Active') {
        return res.status(403).json({
          error: 'User is not active.'
        });
      }


      req.user = {
        oid,
        subject: String(payload.sub || oid),
        email: profile.email,
        name: profile.username,
        role: profile.role || 'user',
        status: profile.status,
        authProvider: 'adb2c'
      };


      return next();


    } catch (adb2cError) {

    }


    try {

      const decoded =
        await admin.auth().verifyIdToken(token);


      const oid =
        decoded.uid;


      const profile = await getUserProfile(
        {
          oid,
          subject: decoded.uid,
          email: decoded.email,
          name:
            decoded.name ||
            decoded.email?.split('@')[0],
          authProvider: 'firebase',
          role: 'user',
          status: 'Active'
        },
        'Pending'
      );


      if (profile.status === 'Rejected') {
        return res.status(403).json({
          error: 'Your account registration has been rejected.'
        });
      }


      req.user = {
        oid,
        subject: decoded.uid,
        email: profile.email || decoded.email,
        name: profile.username || decoded.name,
        role: profile.role || 'user',
        status: profile.status,
        authProvider: 'firebase'
      };


      return next();


    } catch(firebaseError) {

    }


    return res.status(401).json({
      error: 'Invalid authentication token.'
    });


  } catch(error) {

    console.error('Authentication error:', error);

    return res.status(500).json({
      error: 'Authentication processing failed.'
    });

  }
}


export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {

  if (
    req.user?.role === 'admin' ||
    req.user?.role === 'superadmin'
  ) {
    return next();
  }


  return res.status(403).json({
    error: 'Admin access is required.'
  });

}


export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {

  if (req.user?.role === 'superadmin') {
    return next();
  }


  return res.status(403).json({
    error: 'Superadmin access is required.'
  });

}