# Bridge Portal Enterprise Architecture Plan

## 1. Current Architecture Analysis

Current framework: Vite + React + TypeScript, styled with Tailwind utility classes and Motion React.

Current authentication: `src/context/AuthContext.tsx` handles Firebase email/password auth and a custom Azure AD B2C authorization-code flow. The ADB2C flow creates or signs into deterministic Firebase "shadow accounts".

Current database access: Firestore is initialized in `src/firebase.ts`. Before this migration, pages imported Firestore directly for contract search, admin user management, search logs, audit logs, upload, and purge operations.

Current secrets/config: `firebase-applet-config.json` contains Firebase project configuration, including a browser API key. ADB2C client IDs, tenant IDs, policies, redirect URLs, and admin email are read from `VITE_*` environment variables, which are browser-visible. No Cloud Secret Manager integration exists yet.

Current deployment: Single frontend application generated from Google AI Studio, Vite build output, no separate API service, and no source-controlled Cloud Build pipeline in this baseline repository.

Current diagram:

```text
User Browser
  |
  | React SPA
  v
Vite Frontend
  |                 |
  | Firebase SDK    | Browser-driven ADB2C authorize/token calls
  v                 v
Firebase Auth   Azure AD B2C
  |
  | Firebase client SDK
  v
Firestore
```

## 2. Current Security Weaknesses

- Frontend directly accesses Firestore, so database authorization depends heavily on browser-side Firebase identity and Firestore rules.
- Business logic and authorization checks exist in the browser, where they can be inspected and bypassed.
- Custom Firebase password/shadow-account authentication remains in the client, contrary to the target enterprise requirement.
- ADB2C token exchange happens from the browser.
- Firebase config is committed in `firebase-applet-config.json`; browser API keys are not equivalent to service account secrets, but they should still be governed and restricted.
- No Secret Manager usage for backend-only secrets, encryption keys, service configuration, or rotation.
- Excel parsing/upload writes were previously executed directly from the browser to Firestore.
- Audit logging was previously best-effort from the browser.
- No CI/CD definition for dev, UAT, and production.
- No backend rate limiting, centralized authorization, or request validation layer.

## 3. Target Architecture Diagram

```text
User Browser
  |
  | HTTPS
  v
Frontend Cloud Run Service
  |
  | HTTPS REST + Bearer token
  v
Backend API Cloud Run Service
  |
  | Validate Entra ID / Azure AD B2C JWT
  | Authorize Admin/User role
  | Business logic, audit logs, Excel processing
  | Secret Manager runtime access
  v
Firestore

Sophia
  |
  | HTTPS REST / encrypted file transfer
  v
Backend API Cloud Run Service
```

## 4. Proposed Folder Structure

```text
/
  src/                         # Frontend React app
    services/api.ts             # Frontend REST API client
  backend/
    src/
      server.ts                 # Express API entrypoint
      config.ts                 # Runtime configuration placeholders
      firebaseAdmin.ts          # Backend-only Firestore Admin SDK
      middleware/auth.ts        # Entra token validation and RBAC
      routes/
        contracts.ts            # Search, import, purge
        admin.ts                # Users, roles, audit/search logs
      utils/
        firestore.ts            # Backend serialization helpers
    Dockerfile
    package.json
  Dockerfile.frontend
  nginx.conf
  docs/
    enterprise-architecture-plan.md
```

## 5. Migration Steps

1. Create backend API service and route frontend page database operations through REST.
2. Replace Firebase/shadow-account auth with Microsoft Entra ID / Azure AD B2C login.
3. Validate Entra JWTs in backend middleware and map users to secure backend-managed profiles.
4. Move secrets and encryption keys to Google Cloud Secret Manager.
5. Move Excel import, encryption, decryption, export, and Sophia integration to backend.
6. Apply least privilege IAM so only the backend service account can access Firestore.
7. Add Dockerfiles and Cloud Build pipelines for dev, UAT, and production.
8. Harden monitoring, audit logs, alerting, and rate controls.

## 6. Required Code Changes

- Remove direct Firestore calls from React pages.
- Keep frontend communication limited to `/api/*`.
- Replace custom password authentication with Entra ID login.
- Add backend token validation, RBAC, request validation, and audit logging.
- Add Secret Manager helper and key version metadata.
- Add backend Excel encryption/decryption service.
- Add Cloud Build YAML files and environment-specific deployment config.

## 7. Required Google Cloud Resources

- Cloud Run service: frontend.
- Cloud Run service: backend API.
- Firestore database.
- Secret Manager secrets for auth config, encryption keys, and service credentials.
- Artifact Registry repositories for frontend/backend images.
- Cloud Build triggers for dev, UAT, production branches.
- Dedicated service accounts:
  - Cloud Build deployer.
  - Frontend runtime, no Firestore access.
  - Backend runtime, least privilege Firestore and Secret Manager access.
- Cloud Logging, Monitoring, Error Reporting, and alert policies.

## 8. CI/CD Pipeline Design

```text
GitHub
  |
  v
Cloud Build Trigger
  |
  v
Build frontend/backend Docker images
  |
  v
Push to Artifact Registry
  |
  v
Deploy to Cloud Run
```

Environment mapping:

- `develop` -> development Cloud Run services.
- `uat` -> UAT Cloud Run services.
- `main` -> production Cloud Run services.

No manual server changes. Deployments must be source-control triggered.

## 9. Security Improvement Checklist

- [ ] Remove frontend Firestore SDK usage.
- [ ] Remove Firebase password/shadow-account login.
- [ ] Enforce Entra ID / Azure AD B2C MFA and password policies.
- [ ] Validate JWT issuer, audience, expiry, signature, and policy in backend.
- [ ] Store sensitive backend config in Secret Manager.
- [ ] Rotate encryption keys every 6 months.
- [ ] Use backend-only Firestore service account.
- [ ] Add audit logs for admin, import, export, and purge actions.
- [ ] Add rate limiting and request size controls.
- [ ] Add Cloud Armor or equivalent edge protection if exposed publicly.
- [ ] Add structured logs and monitoring alerts.

## 10. STRIDE Analysis

| Threat | Attack Scenario | Risk | Mitigation |
| --- | --- | --- | --- |
| Spoofing | Attacker forges identity or reuses an invalid token against API. | High | Validate Entra JWT signature, issuer, audience, policy, expiry; require HTTPS; reject unsigned/expired tokens. |
| Tampering | User modifies frontend code to promote role or alter upload records. | High | Enforce all RBAC and validation in backend; frontend is not trusted; audit privileged changes. |
| Repudiation | Admin denies purging records or exporting logs. | Medium | Backend-generated audit logs with actor ID, timestamp, action, and request metadata. |
| Information Disclosure | Browser directly queries Firestore or downloads sensitive Excel data. | High | Remove frontend DB access; backend field-level filtering; encrypted file storage/transmission; least privilege IAM. |
| Denial of Service | Large uploads, repeated searches, or purge loops exhaust backend/Firestore quota. | Medium | Request size limits, rate limiting, Cloud Run concurrency controls, batch limits, monitoring alerts. |
| Elevation of Privilege | Normal user calls admin API or edits role in client state. | High | Backend `requireAdmin` and `requireSuperAdmin`; roles loaded from backend-managed profiles; no client-side authority. |

## Excel Security Design

- Sophia should call backend REST endpoints directly over HTTPS.
- Backend validates Sophia integration credentials or workload identity.
- Excel files are encrypted before storage/transmission using envelope encryption.
- Data encryption keys are versioned and protected in Secret Manager or Cloud KMS.
- Key metadata is stored with each file/import batch.
- Rotation cadence: every 6 months, with old key versions retained for decrypting historical files until re-encryption is complete.
