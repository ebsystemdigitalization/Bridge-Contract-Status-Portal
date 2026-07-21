# Threat Model Analysis — Bridge Portal

## Scope

Reviewed code paths and configuration for:
- `backend/src/server.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/routes/*.ts`
- `backend/src/config.ts`
- `backend/src/firebaseAdmin.ts`
- `backend/src/services/*`
- `src/context/AuthContext.tsx`
- `src/pages/Login.tsx`
- `src/services/api.ts`
- `src/firebase.ts`
- `firestore.rules`
- `docs/enterprise-architecture-plan.md`

## Architecture Summary

The application currently combines two authentication models:
- Azure AD B2C as the enterprise identity provider
- Firebase Auth shadow accounts as a backend authorization bridge

Primary runtime flow:
1. User authenticates through Azure AD B2C using PKCE.
2. Browser exchanges authorization code for an ADB2C token.
3. Frontend derives a deterministic shadow Firebase email/password and attempts sign-in or creates a Firebase account.
4. The frontend obtains a Firebase ID token and uses it to call backend APIs.
5. The backend validates the token using either Firebase Admin or Entra ID depending on `AUTH_PROVIDER`.
6. Backend APIs perform business logic and write to Firestore.

## Critical Findings

### 1. Authentication architecture is broken and unsafe

- The ADB2C bridge is implemented entirely in the browser using deterministic shadow passwords:
  - `Shadow_!${staffId}_ADB2C`
  - `staff.${staffId}.adb2c@celcomdigi.com`
- This means authentication depends on a guessable password derived from a staff identifier.
- Shadow account creation and access occur client-side via `createUserWithEmailAndPassword` / `signInWithEmailAndPassword`.
- The backend only supports this flow through `config.authProvider === 'legacy-firebase'`.
- If the intended mode is Entra validation, the frontend still sends Firebase tokens, so the integration is inconsistent.

Risk: attacker can abuse weak deterministic credentials or spoof accounts if staff IDs are predictable.

### 2. Firestore security rules allow unwanted unauthenticated access

- `match /users/{userId}` permits reads when `request.auth == null`:
  - `allow get: if (request.auth == null) || ...`
- `match /users/{userId}` allows unauthenticated list operations with `request.query.limit == 1`.

Risk: any client can read user documents by UID or enumerate usernames, exposing identity data.

### 3. Secret material is present in repository / browser config

- `backend/serviceAccountKey.json` exists in the repo.
- `firebase-applet-config.json` stores Firebase configuration that is browser-visible.
- Frontend runtime uses `VITE_*` env vars for Firebase and Azure AD B2C.

Risk: sensitive credentials or service account metadata are committed and can be leaked.

### 4. Backend auth mode fallback is risky

- `backend/src/middleware/auth.ts` supports `authProvider = 'legacy-firebase'`.
- This fallback can unintentionally preserve old auth behavior in production if env is misconfigured.
- Debug log output exposes backend auth configuration and token validation details.

Risk: insecure legacy auth may remain active, and logs can leak security-sensitive token state.

### 5. Client-side auth callback handling contains origin validation weakness

- `window.opener.postMessage({ type: 'ADB2C_AUTH_SUCCESS' }, '*');`
- `handleADB2CCallback` depends on `localStorage` for PKCE verifier.

Risk: cross-window messaging should specify exact origin to avoid message injection.

### 6. Firestore rules trust ADB2C shadow email suffix too loosely

- `isADB2CShadow()` validates only by email suffix:
  - `email.lower().matches('.*adb2c@celcomdigi\.com$')`
- This trust model is too weak for security-critical authorization.

Risk: email claim manipulation or compromised shadow account can bypass stronger checks.

### 7. Backend profile and user update logic is permissive

- `/api/me/profile` allows updates to profile fields including `email`, `adb2cEmail`, and `role`.
- The backend uses `incoming.role === 'superadmin' || incoming.role === 'admin' ? incoming.role : 'user'`.

Risk: user-controlled profile updates should never be used to set roles or trusted identifiers.

### 8. Admin & import operations need stronger controls

- `POST /api/contracts/import` derives Firestore doc IDs from untrusted imported fields.
- `DELETE /api/contracts/purge` performs bulk deletion without additional safeguards.
- `GET /api/admin/search-logs?all=true` can return up to 5000 records.

Risk: data collisions, accidental data loss, and PII exposure during admin operations.

## STRIDE Summary

Spoofing:
- Weak deterministic shadow account passwords and legacy Firebase auth fallback.
- Insecure `postMessage` origin.

Tampering:
- Client-side account creation / login flow can be manipulated.
- Profile update endpoint allows user-controlled fields.

Repudiation:
- Audit logs exist, but can be bypassed if admin accounts are abused.

Information Disclosure:
- Firestore rules allow unauthenticated `/users/{userId}` reads.
- Browser config includes Firebase / ADB2C environment values.

Denial of Service:
- Bulk purge and import operations lack confirmation and rate limits.
- `search-logs` can expose large audit data sets.

Elevation of Privilege:
- Role assignment logic in `/api/me/profile` and `admin` routes can be too permissive.
- `AUTH_PROVIDER` fallback could allow unexpected auth paths.

## Recommended Remediation

### A. Fix authentication flow

1. Remove browser-based shadow Firebase password auth entirely.
2. Implement server-side shadow account provisioning or custom tokens in a backend-for-frontend flow.
3. Accept and validate Azure AD B2C / Entra tokens in the backend directly.
4. Disable `legacy-firebase` mode in production, or remove it once Azure AD B2C is confirmed.
5. Do not derive service passwords from `staffId` or other predictable claims.
6. Replace browser `window.postMessage(..., '*')` with the exact origin.

### B. Harden Firestore rules

1. Change `/users/{userId}` `allow get` to require `isSignedIn()` and appropriate authorization.
2. Remove unauthenticated `/users` queries entirely.
3. Avoid email suffix heuristics in `isADB2CShadow()`; validate based on UID or stored profile data.
4. Require `request.auth.uid == userId` or admin scope for sensitive profile reads.
5. Validate all incoming document changes with strict field allowlists.

### C. Remove secrets from source control

1. Delete `backend/serviceAccountKey.json` from version control and rotate the service account key.
2. Move all sensitive backend config into environment variables and secret manager.
3. Keep browser-visible config to the minimum required values only.

### D. Strengthen backend API controls

1. Add explicit request validation on `/api/me/profile`, `/api/admin/users/*`, and `/api/contracts/import`.
2. Remove user-controlled role assignments from self-service profile updates.
3. Introduce an approval workflow or confirmation step before `/api/contracts/purge`.
4. Add rate limiting and size limits to admin endpoints.
5. Log auth failures without exposing token payloads.

### E. Improve observability and trust boundaries

1. Build a documented architecture diagram that separates browser, auth provider, backend, and Firestore.
2. Use backend-managed identity for Firestore access; do not allow any client-side Firestore writes or reads in production.
3. Verify that `src/firebase.ts` and `src/utils/firestore.ts` are not used for direct Firestore access in production builds.

## Priority Action List

1. Fix Firestore rule `allow get` for `/users/{userId}` immediately.
2. Remove or disable `backend/serviceAccountKey.json` and rotate service account credentials.
3. Stop client-side shadow account creation and move auth bridging to the backend.
4. Harden `AUTH_PROVIDER` config and remove fallback paths.
5. Add backend validation to all profile, admin, and import endpoints.
6. Restrict `window.postMessage` origin and confirm auth callback security.

## Notes

- The backend API routes are generally better controlled than the Firestore rules, but the existence of browser-side Firebase config and shadow auth means the current trust boundary is unclear.
- The biggest security gap is the authentication bridge: it trusts a weak password scheme and keeps the primary identity provider token outside server validation.
- If the system must keep Firebase shadow accounts, generate and store shadow credentials solely on the backend, and use Firebase custom tokens or direct server-side mapping.

---

If you want, I can also generate a second document with a full Threat Model `1-threatmodel.md` structure and Mermaid data flow diagram for this repo.