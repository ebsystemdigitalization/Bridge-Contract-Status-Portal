# STRIDE + Abuse Cases - Threat Analysis

> This analysis uses STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) extended with Abuse Cases. The "A" column represents Abuse: misuse of legitimate features, workflow manipulation, and business-logic abuse.

## Exploitability Tiers

Threats are classified into three exploitability tiers based on the prerequisites an attacker needs:

| Tier | Label | Prerequisites | Assignment Rule |
|------|-------|---------------|----------------|
| **Tier 1** | Direct Exposure | `None` | Exploitable by unauthenticated external attacker with NO prior access. The prerequisite field MUST say `None`. |
| **Tier 2** | Conditional Risk | Single prerequisite: `Authenticated User`, `Privileged User`, `Internal Network`, or single `{Boundary} Access` | Requires exactly ONE form of access. The prerequisite field has ONE item. |
| **Tier 3** | Defense-in-Depth | `Host/OS Access`, `Admin Credentials`, `{Component} Compromise`, `Physical Access`, or MULTIPLE prerequisites joined with `+` | Requires significant prior breach, infrastructure access, or multiple combined prerequisites. |

## Summary

| Component | Link | S | T | R | I | D | E | A | Total | T1 | T2 | T3 | Risk |
|-----------|------|---|---|---|---|---|---|---|-------|----|----|----|------|
| BrowserClient | [Link](#browserclient) | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 2 | 0 | 0 | 2 | Medium |
| NginxFrontend | [Link](#nginxfrontend) | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 2 | 2 | 0 | 0 | High |
| ExpressApi | [Link](#expressapi) | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 2 | 2 | 0 | 0 | High |
| AuthRouter | [Link](#authrouter) | 1 | 0 | 0 | 1 | 1 | 0 | 0 | 3 | 3 | 0 | 0 | High |
| AuthMiddleware | [Link](#authmiddleware) | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 2 | 0 | 2 | 0 | Low |
| MeRouter | [Link](#merouter) | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 2 | 0 | 2 | 0 | Low |
| ContractsRouter | [Link](#contractsrouter) | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 3 | 0 | 3 | 0 | High |
| AdminRouter | [Link](#adminrouter) | 0 | 0 | 1 | 1 | 0 | 1 | 0 | 3 | 0 | 3 | 0 | Medium |
| FirestoreAdminClient | [Link](#firestoreadminclient) | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 2 | 0 | 0 | 2 | Medium |
| FirestoreDatabase | [Link](#firestoredatabase) | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 2 | 0 | 2 | 0 | High |
| FirestoreRules | [Link](#firestorerules) | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 3 | 0 | 3 | 0 | Critical |
| FirebaseAuth | [Link](#firebaseauth) | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 2 | 2 | 0 | 0 | Low |
| AzureADB2C | [Link](#azureadb2c) | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 2 | 2 | 0 | 0 | Low |
| GoogleSecretManager | [Link](#googlesecretmanager) | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 2 | 0 | 0 | 2 | Low |
| CloudBuildCloudRun | [Link](#cloudbuildcloudrun) | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 3 | 0 | 0 | 3 | Medium |
| **Totals** | | **4** | **5** | **2** | **11** | **4** | **7** | **2** | **35** | **11** | **15** | **9** | |

---

## BrowserClient

**Trust Boundary:** PublicZone
**Role:** React SPA runtime, Firebase Auth client, ADB2C PKCE initiator, and backend API caller.
**Data Flows:** DF01, DF02, DF03, DF05, DF06, DF20
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* | | | | | | |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* | | | | | | |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T01.I | Information Disclosure | PKCE verifier and OAuth state are stored in localStorage, so injected script or local browser access could steal them before callback completion. | Host/OS Access | DF05 | Prefer sessionStorage or in-memory storage and add a strict CSP to reduce script-injection impact. | Open |
| T01.A | Abuse | Recent search values are stored in localStorage using a UID-derived key and can reveal sensitive lookup history on a shared workstation. | Host/OS Access | DF01 | Store recent search history only in memory or provide a privacy toggle and clear-on-logout behavior. | Open |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | Backend and Firebase token verification are the trust decisions for identity. |
| Tampering | The client cannot directly mutate supported business records through the app UI. |
| Repudiation | Server-side audit/search logs are written by backend routes. |
| Denial of Service | Browser-only failures do not directly exhaust shared backend capacity. |
| Elevation of Privilege | Role changes are performed by protected backend admin routes. |

---

## NginxFrontend

**Trust Boundary:** PublicZone
**Role:** nginx Cloud Run frontend that serves static assets and proxies `/api/`.
**Data Flows:** DF03, DF04, DF21
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T02.I | Information Disclosure | The frontend config sets nosniff, frame denial, and referrer policy, but no Content-Security-Policy is present to reduce XSS-driven token or localStorage theft. | None | DF03 | Add a strict CSP for scripts, connections, frames, and object sources. | Open |
| T02.D | Denial of Service | The `/api/` proxy has no visible request size, timeout, or buffering guard in nginx, leaving protection primarily to backend JSON limits and Cloud Run defaults. | None | DF04 | Add nginx proxy timeout/body-size limits and align them with backend endpoint limits. | Open |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* | | | | | | |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* | | | | | | |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | Identity decisions are delegated to ADB2C/Firebase and backend middleware. |
| Tampering | Static asset integrity depends on build/deploy controls covered under CloudBuildCloudRun. |
| Repudiation | No security-relevant audit events originate in nginx. |
| Elevation of Privilege | nginx does not make authorization decisions. |
| Abuse | No business workflow is implemented in nginx. |

---

## ExpressApi

**Trust Boundary:** PublicZone
**Role:** Public backend listener, JSON parser, common middleware, route dispatcher, and error handler.
**Data Flows:** DF04, DF07, DF08, DF09, DF10, DF11, DF22, DF23
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T03.I | Information Disclosure | The global error handler returns `error.message` to callers, which can expose internal validation, dependency, or upstream failure details. | None | DF04 | Return generic server errors to clients and log detailed errors server-side only. | Open |
| T03.D | Denial of Service | Express accepts JSON bodies up to 25 MB for all routes before route-level checks, including public auth endpoints. | None | DF04 | Apply smaller global JSON limits and route-specific larger parsers only where required. | Open |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* | | | | | | |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* | | | | | | |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | Authentication is delegated to AuthMiddleware and AuthRouter. |
| Tampering | Business writes are performed in specific route modules. |
| Repudiation | Route modules write domain logs where relevant. |
| Elevation of Privilege | Authorization checks are route-specific middleware. |
| Abuse | Business workflows are in route modules. |

---

## AuthRouter

**Trust Boundary:** BackendServices
**Role:** Public auth endpoint group for login resolution and ADB2C callback.
**Data Flows:** DF07, DF12, DF13
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T04.S | Spoofing | `/api/auth/adb2c/callback` accepts `redirectUri` from the request body and forwards it to ADB2C without a backend allow-list check. | None | DF12 | Validate redirectUri against a server-side allow-list before token exchange. | Open |
| T04.I | Information Disclosure | `/api/auth/resolve-login` is unauthenticated and reveals whether a username maps to a stored email or only the fallback domain. | None | DF07 | Require throttling and return indistinguishable responses or move resolution behind an anti-enumeration control. | Open |
| T04.D | Denial of Service | Public auth endpoints do not use the repository rate limiter, allowing repeated Firestore lookups or ADB2C token exchange attempts. | None | DF07 | Add IP/user-agent throttling and provider-aware backoff to auth routes. | Open |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* | | | | | | |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* | | | | | | |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Tampering | Profile writes use deterministic backend UID and merge semantics. |
| Repudiation | Auth failures are logged to application logs, not domain audit logs. |
| Elevation of Privilege | User role is preserved from existing profile and defaults to user. |
| Abuse | Abuse cases are covered by enumeration and throttling threats. |

---

## AuthMiddleware

**Trust Boundary:** BackendServices
**Role:** Bearer token validation, profile hydration, active-status checks, and role context creation.
**Data Flows:** DF08, DF14
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* | | | | | | |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T05.S | Spoofing | A forged bearer token could impersonate a user if issuer, audience, and signature checks were missing. | Authenticated User | DF08 | Existing code verifies ADB2C JWTs with `jose` and Firebase ID tokens with Firebase Admin. | Mitigated |
| T05.E | Elevation of Privilege | A user could reach admin endpoints if role checks were not enforced after authentication. | Authenticated User | DF08 | Existing `requireAdmin` and `requireSuperAdmin` middleware enforce route roles. | Mitigated |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* | | | | | | |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Tampering | Middleware does not mutate business records except profile last-login metadata. |
| Repudiation | Domain audit logging is handled by route modules. |
| Information Disclosure | Middleware returns generic auth failures for invalid tokens. |
| Denial of Service | Public throttling is covered at route level. |
| Abuse | Middleware has no business action beyond auth context creation. |

---

## MeRouter

**Trust Boundary:** BackendServices
**Role:** Authenticated profile read and create/update API.
**Data Flows:** DF09, DF15
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* | | | | | | |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T06.T | Tampering | Profile updates could tamper with role/status if client-supplied profile fields were trusted. | Authenticated User | DF15 | Existing validation permits only uid, username, and email; backend keeps role/status from trusted state. | Mitigated |
| T06.E | Elevation of Privilege | A user could update another user's profile if uid from request body were trusted. | Authenticated User | DF15 | Existing code ignores incoming uid and uses `req.user.oid`. | Mitigated |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* | | | | | | |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | Identity is supplied by AuthMiddleware. |
| Repudiation | Profile updates are not currently audit-logged, but admin-sensitive actions are outside this router. |
| Information Disclosure | GET profile reads only authenticated caller's document. |
| Denial of Service | Payload is bounded by Express JSON limit. |
| Abuse | No privileged workflow is implemented here. |

---

## ContractsRouter

**Trust Boundary:** BackendServices
**Role:** Contract search, admin bulk import, superadmin purge, search logs, and import audit logs.
**Data Flows:** DF10, DF16
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* | | | | | | |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T07.A | Abuse | Authenticated users can repeatedly query MSISDN or billing account numbers because `/search` has no per-user rate limiter. | Authenticated User | DF16 | Add per-user and per-IP search throttles and anomaly alerts. | Open |
| T07.D | Denial of Service | Admin import accepts up to 100,000 rows and global 25 MB JSON bodies before batched Firestore writes. | Privileged User | DF16 | Reduce limits, use streaming upload/storage staging, and enforce row-size validation. | Open |
| T07.R | Repudiation | Import and purge operations could be repudiated without audit records. | Privileged User | DF16 | Existing code writes BULK_UPLOAD and DATABASE_PURGE audit log entries. | Mitigated |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* | | | | | | |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | AuthMiddleware supplies caller identity. |
| Tampering | Import validation and deterministic IDs constrain writes, with separate Firestore-rule caveats covered elsewhere. |
| Information Disclosure | Search response disclosure is covered under search abuse and Firestore direct-access findings. |
| Elevation of Privilege | Import uses requireAdmin and purge uses requireSuperAdmin. |

---

## AdminRouter

**Trust Boundary:** BackendServices
**Role:** Admin user-management, audit-log retrieval, and search-log retrieval endpoints.
**Data Flows:** DF11, DF17
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* | | | | | | |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T08.I | Information Disclosure | Any admin can request `/api/admin/search-logs?all=true` and retrieve up to 5,000 search log entries containing user IDs, emails, and search terms. | Privileged User | DF17 | Restrict full export to superadmins or add purpose-based approval and redaction. | Open |
| T08.E | Elevation of Privilege | Admins could alter peers or superadmins if hierarchy checks were missing. | Privileged User | DF17 | Existing code blocks self-modification, admin changes by non-superadmins, and superadmin modification. | Mitigated |
| T08.R | Repudiation | User-management changes could be denied if not logged. | Privileged User | DF17 | Existing `writeAudit()` records status, role, and deletion actions. | Mitigated |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* | | | | | | |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | AuthMiddleware authenticates callers before router use. |
| Tampering | Role/status validation limits allowed state transitions. |
| Denial of Service | Admin router has a per-IP path limiter. |
| Abuse | Business abuse is represented by search-log export disclosure. |

---

## FirestoreAdminClient

**Trust Boundary:** BackendServices
**Role:** Firebase Admin SDK initialization, credential resolution, and Firestore REST access.
**Data Flows:** DF15, DF16, DF17, DF18
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* | | | | | | |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* | | | | | | |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T09.I | Information Disclosure | Credential resolution will load `serviceAccountKey.json` from several local paths if present, increasing blast radius if a static key is copied into an image or workspace. | Host/OS Access | DF18 | Prefer application default credentials only in Cloud Run and fail closed when static keys are present in production. | Open |
| T09.E | Elevation of Privilege | The backend service account performs Admin SDK operations that bypass Firestore Rules, so overbroad IAM would turn API bugs into unrestricted database writes. | Admin Credentials | DF18 | Use least-privilege service accounts and periodically validate IAM roles. | Open |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | Google application credentials authenticate SDK calls. |
| Tampering | Tampering risks are downstream in route handlers and Firestore access. |
| Repudiation | Domain audit records are written by route modules. |
| Denial of Service | SDK transport exhaustion depends on route-level request controls. |
| Abuse | No direct business workflow is exposed by this wrapper. |

---

## FirestoreDatabase

**Trust Boundary:** DataStorage
**Role:** Managed NoSQL database for portal users, contracts, audit logs, and search logs.
**Data Flows:** DF18, DF19, DF20
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* | | | | | | |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T10.I | Information Disclosure | Active authenticated users can perform direct Firestore `get` operations for arbitrary `contracts/{contractId}` documents if they know or can derive IDs. | Authenticated User | DF20 | Restrict direct client contract reads to backend-owned service accounts or narrowly scoped per-user rules. | Open |
| T10.T | Tampering | Backend Admin SDK writes bypass Firestore Rules by design, so route validation is the only write guard for API-originated data. | Privileged User | DF18 | Existing contract import validation and admin middleware reduce API write tampering. | Mitigated |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* | | | | | | |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | Firestore relies on Firebase Auth or Google IAM for caller identity. |
| Repudiation | Audit/search logs are separate collections. |
| Denial of Service | Query limits are enforced in API and rules for listed flows. |
| Elevation of Privilege | Role policy is represented in FirestoreRules and backend middleware. |
| Abuse | Search abuse is covered under ContractsRouter. |

---

## FirestoreRules

**Trust Boundary:** DataStorage
**Role:** Security policy backstop for direct client Firestore access.
**Data Flows:** DF19, DF20
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* | | | | | | |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T11.E | Elevation of Privilege | `users/{userId}` self-update permits affected key `status`, so an authenticated Firebase user can directly set their own status to `Active` through Firestore. | Authenticated User | DF20 | Remove `status` from self-update fields and require backend/admin transitions for approval state. | Open |
| T11.I | Information Disclosure | Direct client `contracts` list/get rules still allow active users to query contract records within rule limits even though the new architecture intends backend-only business access. | Authenticated User | DF20 | Make client contract reads deny by default and expose search only through the backend API. | Open |
| T11.T | Tampering | Default-deny, schema validation, role helpers, and query limits reduce direct write/list misuse. | Authenticated User | DF19 | Existing rules validate contract/user shapes and constrain list queries. | Mitigated |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* | | | | | | |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | Rules consume Firebase Auth claims rather than passwords or bearer strings. |
| Repudiation | Rules do not create audit records. |
| Denial of Service | List limits cover broad client scans. |
| Abuse | Abuse is represented by direct access and status-change threats. |

---

## FirebaseAuth

**Trust Boundary:** ExternalServices
**Role:** Firebase Authentication service for ID tokens and custom-token sign-in.
**Data Flows:** DF06, DF13, DF14
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T12.S | Spoofing | Firebase ID token signing and validation failure would allow forged portal sessions. | None | DF06 | Firebase Auth token signing and verification are managed by the external Firebase platform. | Platform |
| T12.E | Elevation of Privilege | Custom token misuse could mint unauthorized Firebase sessions if backend service credentials were compromised. | None | DF13 | Firebase enforces token signature verification; backend credential hardening is covered separately. | Platform |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* | | | | | | |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* | | | | | | |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Tampering | Firebase Auth does not store portal contract data. |
| Repudiation | Portal audit logs are in Firestore. |
| Information Disclosure | Token contents are consumed by backend and client only. |
| Denial of Service | Provider availability is external to repository controls. |
| Abuse | Application workflow abuse is covered in backend route components. |

---

## AzureADB2C

**Trust Boundary:** ExternalServices
**Role:** External OIDC provider for staff login.
**Data Flows:** DF05, DF12
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T13.S | Spoofing | If ADB2C token signing or JWKS publication failed, staff identities could be spoofed. | None | DF05 | Token signing and JWKS publication are managed by Azure AD B2C. | Platform |
| T13.I | Information Disclosure | Tenant, policy, and client identifiers are embedded in frontend/build config; these are public OIDC identifiers but still enable tenant-specific reconnaissance. | None | DF05 | Avoid placing secrets in frontend config and monitor public metadata exposure. | Open |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* | | | | | | |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* | | | | | | |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Tampering | Authorization-code tampering is covered under AuthRouter redirect/token exchange. |
| Repudiation | Login records are not owned by this repository. |
| Denial of Service | Provider availability is external to repository controls. |
| Elevation of Privilege | Portal roles are stored in Firestore profiles. |
| Abuse | Business abuse is not implemented in ADB2C. |

---

## GoogleSecretManager

**Trust Boundary:** ExternalServices
**Role:** Managed secrets API used by optional Excel encryption helper.
**Data Flows:** DF23
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* | | | | | | |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* | | | | | | |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T14.I | Information Disclosure | Secret values are cached in process memory after first retrieval, increasing exposure after backend process compromise. | Host/OS Access | DF23 | Existing helper avoids repository-stored keys; consider bounded TTL cache and memory-scrubbing for high-sensitivity material. | Mitigated |
| T14.T | Tampering | An attacker with secret-version control could force decryption/encryption with an unintended key version. | Admin Credentials | DF23 | Existing metadata records key version; restrict Secret Manager IAM and alert on version changes. | Mitigated |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | Google IAM authenticates secret access. |
| Repudiation | Secret Manager audit logging is platform-managed. |
| Denial of Service | Secret availability is provider/IAM dependent. |
| Elevation of Privilege | IAM privilege risk is covered under CloudBuildCloudRun and FirestoreAdminClient. |
| Abuse | No user-facing business workflow exists here. |

---

## CloudBuildCloudRun

**Trust Boundary:** CICD
**Role:** Build and deployment configuration for the frontend and backend Cloud Run services.
**Data Flows:** DF21, DF22
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 - Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* | | | | | | |

#### Tier 2 - Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* | | | | | | |

#### Tier 3 - Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T15.I | Information Disclosure | Frontend Cloud Build embeds Firebase and ADB2C identifiers as Docker build args and ENV values, making environment metadata visible in image/build history. | Admin Credentials | DF21 | Keep public identifiers documented as non-secret and move any confidential values to runtime secrets. | Open |
| T15.T | Tampering | Backend and frontend Dockerfiles use `node:22-slim`/`nginx:1.27-alpine` tags without digest pinning or image signing evidence. | Admin Credentials | DF21 | Pin images by digest and add artifact provenance/signing checks. | Open |
| T15.E | Elevation of Privilege | Runtime containers do not declare non-root users in Dockerfiles, increasing impact of a container escape or write primitive. | Admin Credentials | DF22 | Run containers as non-root and configure Cloud Run service hardening where available. | Open |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | Deployment authority depends on GCP IAM. |
| Repudiation | Build logs are Cloud Build platform artifacts. |
| Denial of Service | Service scaling limits are not defined in repository config. |
| Abuse | CI/CD does not implement a portal business workflow. |
