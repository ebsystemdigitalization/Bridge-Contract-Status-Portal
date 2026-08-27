import { Router } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import admin from 'firebase-admin';

import { config } from '../config.js';
import { firestore, isFirestoreAvailable } from '../firebaseAdmin.js';

// =========================================================
// DMS / DEALER - AZURE AD B2C CONFIGURATION
// =========================================================

const adb2cIssuer =
  `https://${config.adb2cTenantName}.b2clogin.com/${config.adb2cTenantId}/v2.0/`;

const adb2cJwksUrl =
  `https://${config.adb2cTenantName}.b2clogin.com/` +
  `${config.adb2cTenantId}/` +
  `${config.adb2cPolicy}/discovery/v2.0/keys`;

const adb2cJwks = createRemoteJWKSet(
  new URL(adb2cJwksUrl)
);

// =========================================================
// INTERNAL EMPLOYEE - MICROSOFT ENTRA ID CONFIGURATION
// =========================================================

const employeeIssuer =
  `https://login.microsoftonline.com/${config.employeeEntraTenantId}/v2.0`;

const employeeJwksUrl =
  `https://login.microsoftonline.com/` +
  `${config.employeeEntraTenantId}/discovery/v2.0/keys`;

const employeeJwks = createRemoteJWKSet(
  new URL(employeeJwksUrl)
);

// =========================================================
// ROUTER
// =========================================================

export const authRouter = Router();

// =========================================================
// RESOLVE FIREBASE USERNAME LOGIN
// =========================================================

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

// =========================================================
// DMS / DEALER - AZURE AD B2C CALLBACK
// =========================================================

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

    // -----------------------------------------------------
    // 1. Exchange authorization code with Azure AD B2C
    // -----------------------------------------------------

    const tokenUrl =
      `https://${config.adb2cTenantName}.b2clogin.com/` +
      `${config.adb2cTenantId}/` +
      `${config.adb2cPolicy}/oauth2/v2.0/token`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded'
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
        error:
          'Failed to exchange ADB2C authorization code.'
      });
    }

    const tokenData = await tokenResponse.json();
    const idToken = tokenData.id_token;

    if (!idToken) {
      return res.status(401).json({
        error:
          'No ID token returned from ADB2C.'
      });
    }

    // -----------------------------------------------------
    // 2. Verify Azure AD B2C ID token
    // -----------------------------------------------------

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
      adb2cJwks,
      {
        issuer: adb2cIssuer,
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

    // -----------------------------------------------------
    // 3. Create Firebase UID
    // -----------------------------------------------------

    const uid = `adb2c_${staffId}`;

    // -----------------------------------------------------
    // 4. Create/update Firestore profile
    // -----------------------------------------------------

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

      role:
        oldData?.role ||
        'user',

      status:
        oldData?.status ||
        'Active',

      lastLoginAt:
        admin.firestore.FieldValue.serverTimestamp()
    };

    await userRef.set(
      userData,
      {
        merge: true
      }
    );

    // -----------------------------------------------------
    // 5. Create Firebase custom token
    // -----------------------------------------------------

    const customToken = await admin
      .auth()
      .createCustomToken(
        uid,
        {
          provider: 'adb2c',
          staffId
        }
      );

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
      error:
        'ADB2C authentication failed.'
    });
  }
});

// =========================================================
// INTERNAL EMPLOYEE - MICROSOFT ENTRA ID CALLBACK
// =========================================================

authRouter.post('/employee/callback', async (req, res) => {
  const {
    code,
    codeVerifier,
    redirectUri
  } = req.body;

  // -------------------------------------------------------
  // Basic validation
  // -------------------------------------------------------

  if (!code || !codeVerifier || !redirectUri) {
    return res.status(400).json({
      error:
        'code, codeVerifier and redirectUri are required.'
    });
  }

  if (!config.employeeEntraRedirectUri) {
    return res.status(500).json({
      error:
        'Employee Entra redirect URI is not configured.'
    });
  }

  if (
    redirectUri !==
    config.employeeEntraRedirectUri
  ) {
    return res.status(400).json({
      error:
        'Invalid employee redirect URI.'
    });
  }

  if (
    !config.employeeEntraTenantId ||
    !config.employeeEntraClientId
  ) {
    return res.status(500).json({
      error:
        'Employee Entra ID configuration missing.'
    });
  }

  if (
    !config.employeeEntraClientSecret
  ) {
    return res.status(500).json({
      error:
        'Employee Entra client secret is not configured.'
    });
  }

  if (!isFirestoreAvailable() || !firestore) {
    return res.status(503).json({
      error:
        'Firestore unavailable.'
    });
  }

  try {

    // -----------------------------------------------------
    // 1. Exchange Entra authorization code
    // -----------------------------------------------------

    const tokenUrl =
      `https://login.microsoftonline.com/` +
      `${config.employeeEntraTenantId}/oauth2/v2.0/token`;

    const tokenResponse = await fetch(
      tokenUrl,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded'
        },

        body: new URLSearchParams({
          grant_type:
            'authorization_code',

          client_id:
            config.employeeEntraClientId,

          client_secret:
            config.employeeEntraClientSecret,

          redirect_uri:
            redirectUri,

          code,

          code_verifier:
            codeVerifier,

          scope:
            'openid profile email'
        })
      }
    );

    if (!tokenResponse.ok) {
      const tokenError =
        await tokenResponse.text();

      console.error(
        'Employee Entra token exchange failed:',
        tokenError
      );

      return res.status(401).json({
        error:
          'Failed to exchange Employee Entra authorization code.'
      });
    }

    const tokenData =
      await tokenResponse.json();

    const idToken =
      tokenData.id_token;

    if (!idToken) {
      return res.status(401).json({
        error:
          'No ID token returned from Employee Entra ID.'
      });
    }

    // -----------------------------------------------------
    // 2. Verify Microsoft Entra ID token
    // -----------------------------------------------------

    const { payload } =
      await jwtVerify<{
        oid?: string;
        sub?: string;
        name?: string;
        preferred_username?: string;
        email?: string;
      }>(
        idToken,
        employeeJwks,
        {
          issuer:
            employeeIssuer,

          audience:
            config.employeeEntraClientId
        }
      );

    // -----------------------------------------------------
    // 3. Identify employee
    // -----------------------------------------------------

    const employeeId = String(
      payload.oid ||
      payload.sub ||
      ''
    ).toLowerCase();

    if (!employeeId) {
      return res.status(401).json({
        error:
          'Unable to identify employee.'
      });
    }

    const email = String(
      payload.preferred_username ||
      payload.email ||
      ''
    )
      .trim()
      .toLowerCase();

    const username = String(
      payload.name ||
      (
        email
          ? email.split('@')[0]
          : employeeId
      )
    );

    // -----------------------------------------------------
    // 4. Create separate Firebase UID for employees
    // -----------------------------------------------------

    const uid =
      `entra_${employeeId}`;

    // -----------------------------------------------------
    // 5. Create/update Firestore employee profile
    // -----------------------------------------------------

    const userRef = firestore
      .collection('users')
      .doc(uid);

    const existing =
      await userRef.get();

    const oldData =
      existing.exists
        ? existing.data()
        : {};

    const userData = {
      uid,
      username,
      email,

      authProvider:
        'entra',

      role:
        oldData?.role ||
        'user',

      status:
        oldData?.status ||
        'Active',

      lastLoginAt:
        admin.firestore.FieldValue.serverTimestamp()
    };

    await userRef.set(
      userData,
      {
        merge: true
      }
    );

    // -----------------------------------------------------
    // 6. Create Firebase custom token
    // -----------------------------------------------------

    const customToken =
      await admin
        .auth()
        .createCustomToken(
          uid,
          {
            provider:
              'entra',

            employeeId
          }
        );

    // -----------------------------------------------------
    // 7. Return Firebase token to frontend
    // -----------------------------------------------------

    return res.json({
      success: true,
      customToken,
      user: userData
    });

  } catch (error) {

    console.error(
      'Employee Entra callback failed:',
      error
    );

    return res.status(500).json({
      error:
        'Employee authentication failed.'
    });
  }
});