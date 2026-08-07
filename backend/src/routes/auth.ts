import { Router } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import admin from 'firebase-admin';

import { config } from '../config.js';
import { firestore, isFirestoreAvailable } from '../firebaseAdmin.js';


const issuer =
  `https://${config.adb2cTenantName}.b2clogin.com/${config.adb2cTenantId}/v2.0/`;

const jwksUrl =
  `https://${config.adb2cTenantName}.b2clogin.com/` +
  `${config.adb2cTenantId}/` +
  `${config.adb2cPolicy}/discovery/v2.0/keys`;

const jwks = createRemoteJWKSet(new URL(jwksUrl));


export const authRouter = Router();


// Resolve Firebase username login
authRouter.post('/resolve-login', async (req, res) => {
  const username = String(req.body?.username || '')
    .trim()
    .toLowerCase();

  if (!username) {
    return res.status(400).json({
      error: 'username is required.'
    });
  }

  if (username.includes('@')) {
    return res.json({
      email: username
    });
  }

  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({
      error: 'Firestore is not available.'
    });
  }

  const snapshot = await firestore
    .collection('users')
    .where('username', '==', username)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return res.json({
      email: null
    });
  }

  const user = snapshot.docs[0].data() as any;

  return res.json({
    email: user.email || null
  });
});


// Azure AD B2C Callback.
authRouter.post('/adb2c/callback', async (req, res) => {
  const {
    code,
    codeVerifier,
    redirectUri
  } = req.body;

  if (!config.adb2cRedirectUri) {
    return res.status(500).json({
      error: 'ADB2C redirect URI is not configured.'
    });
  }

  if (redirectUri !== config.adb2cRedirectUri) {
    return res.status(400).json({
      error: 'Invalid redirect URI.'
    });
  }

  if (!code || !codeVerifier || !redirectUri) {
    return res.status(400).json({
      error: 'code, codeVerifier and redirectUri are required.'
    });
  }

  if (
    !config.adb2cClientId ||
    !config.adb2cTenantId
  ) {
    return res.status(500).json({
      error: 'ADB2C backend configuration missing.'
    });
  }

  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({
      error: 'Firestore unavailable.'
    });
  }

  try {

    // 1. Exchange authorization code with ADB2C
    const tokenUrl =
      `https://${config.adb2cTenantName}.b2clogin.com/` +
      `${config.adb2cTenantId}/` +
      `${config.adb2cPolicy}/oauth2/v2.0/token`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },

      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.adb2cClientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier
      })
    });


    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();

      console.error(
        'ADB2C token exchange failed:',
        error
      );

      return res.status(401).json({
        error: 'Failed to exchange ADB2C authorization code.'
      });
    }


    const tokenData = await tokenResponse.json();
    const idToken = tokenData.id_token;


    if (!idToken) {
      return res.status(401).json({
        error: 'No ID token returned from ADB2C.'
      });
    }


    // 2. Verify ADB2C token
    const { payload } = await jwtVerify<{
      extension_StaffId?: string;
      oid?: string;
      sub?: string;
      name?: string;
      given_name?: string;
      email?: string;
      emails?: string[];
    }>(
      idToken,
      jwks,
      {
        issuer,
        audience: config.adb2cClientId
      }
    );


    const staffId = String(
      payload.extension_StaffId ||
      payload.oid ||
      payload.sub ||
      ''
    ).toLowerCase();


    if (!staffId) {
      return res.status(401).json({
        error: 'Unable to identify user.'
      });
    }


    const username = String(
      payload.name ||
      payload.given_name ||
      staffId
    );


    const email = String(
      payload.email ||
      payload.emails?.[0] ||
      ''
    ).toLowerCase();


    // 3. Create Firebase UID
    const uid = `adb2c_${staffId}`;


    // 4. Create / update Firestore profile
    const userRef = firestore
      .collection('users')
      .doc(uid);

    const existing = await userRef.get();

    const oldData = existing.exists
      ? existing.data()
      : {};


    const userData = {
      uid,
      username,
      email,
      adb2cEmail: email,
      authProvider: 'adb2c',
      role: oldData?.role || 'user',
      status: oldData?.status || 'Active',
      lastLoginAt:
        admin.firestore.FieldValue.serverTimestamp()
    };


    await userRef.set(userData, {
      merge: true
    });


    // 5. Create Firebase custom token
    const customToken = await admin.auth()
      .createCustomToken(uid, {
        provider: 'adb2c',
        staffId
      });


    return res.json({
      success: true,
      customToken,
      user: userData
    });


  } catch (error) {

    console.error(
      'ADB2C callback failed:',
      error
    );

    return res.status(500).json({
      error: 'ADB2C authentication failed.'
    });
  }
});