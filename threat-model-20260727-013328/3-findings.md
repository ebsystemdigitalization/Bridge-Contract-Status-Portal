# Security Findings

---

## Tier 1 - Direct Exposure (No Prerequisites)

### FIND-01: Public Login Resolution Enables Account Enumeration

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Important |
| CVSS 4.0 | 6.9 (CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:L/SC:N/SI:N/SA:N) |
| CWE | [CWE-203](https://cwe.mitre.org/data/definitions/203.html): Observable Discrepancy |
| OWASP | A07:2025 - Authentication Failures |
| Exploitation Prerequisites | None |
| Exploitability Tier | Tier 1 - Direct Exposure |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | AuthRouter |
| Related Threats | [T04.I](2-stride-analysis.md#authrouter), [T04.D](2-stride-analysis.md#authrouter) |

#### Description

The unauthenticated `/api/auth/resolve-login` endpoint performs a Firestore username lookup and returns a stored email when a profile exists, or a synthesized fallback address when it does not. This creates a remotely observable difference that can support account discovery and targeted password attacks.

#### Evidence

**Prerequisite basis:** AuthRouter is externally reachable through the unauthenticated Cloud Run API and the route does not use `requireAuth`.

`backend/src/routes/auth.ts` defines `authRouter.post('/resolve-login', ...)`, queries `firestore.collection('users').where('username', '==', username).limit(1)`, and returns either `user.email` or a fallback email. `cloudbuild.backend.yaml` deploys the backend with `--allow-unauthenticated`.

#### Remediation

Require anti-automation controls on login resolution, return indistinguishable responses, and consider doing username-to-email resolution only after Firebase Auth or a one-time challenge flow has established legitimacy.

#### Verification

Call `/api/auth/resolve-login` for existing and non-existing usernames and confirm the response shape, timing, and message do not reveal whether a profile exists; verify rate limiting blocks repeated probes.

### FIND-02: ADB2C Callback Trusts Client-Supplied Redirect URI

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Important |
| CVSS 4.0 | 7.1 (CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:H/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-346](https://cwe.mitre.org/data/definitions/346.html): Origin Validation Error |
| OWASP | A07:2025 - Authentication Failures |
| Exploitation Prerequisites | None |
| Exploitability Tier | Tier 1 - Direct Exposure |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | AuthRouter |
| Related Threats | [T04.S](2-stride-analysis.md#authrouter) |

#### Description

The backend ADB2C callback forwards `redirectUri` from the request body into the token exchange. Even though ADB2C enforces registered redirect URIs, the backend should not allow the browser to select this value because it is part of the OAuth security binding.

#### Evidence

**Prerequisite basis:** `/api/auth/adb2c/callback` is a public route under the unauthenticated backend service.

`backend/src/routes/auth.ts` reads `{ code, codeVerifier, redirectUri }` from `req.body`, checks only presence, and passes `redirect_uri: redirectUri` to ADB2C. No server-side allow-list comparison is present in `backend/src/config.ts`.

#### Remediation

Configure allowed redirect URIs on the backend and reject any callback whose `redirectUri` is not an exact match. Prefer deriving the redirect URI from server-side config rather than trusting request body input.

#### Verification

Send callback requests with an unapproved redirect URI and confirm the backend rejects them before contacting ADB2C; add tests for exact-match URI validation.

### FIND-03: Public Error and Browser Hardening Gaps Increase Token Exposure Impact

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Moderate |
| CVSS 4.0 | 6.4 (CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-209](https://cwe.mitre.org/data/definitions/209.html): Generation of Error Message Containing Sensitive Information |
| OWASP | A02:2025 - Security Misconfiguration |
| Exploitation Prerequisites | None |
| Exploitability Tier | Tier 1 - Direct Exposure |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | ExpressApi, NginxFrontend |
| Related Threats | [T02.I](2-stride-analysis.md#nginxfrontend), [T03.I](2-stride-analysis.md#expressapi) |

#### Description

The backend global error handler sends internal exception messages to clients, and the frontend nginx config lacks a Content-Security-Policy. Together these gaps raise the impact of public probing and browser-side script injection against a token-bearing SPA.

#### Evidence

**Prerequisite basis:** NginxFrontend and ExpressApi are externally reachable and include unauthenticated routes.

`backend/src/server.ts` returns `error.message || 'Internal server error.'` from the global error handler. `nginx.conf` sets `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`, but no `Content-Security-Policy` header.

#### Remediation

Return generic 500 responses to clients while keeping detailed errors in server logs. Add a CSP that limits script sources, connection targets, frame ancestors, object sources, and base URI according to the app's actual assets and identity endpoints.

#### Verification

Trigger representative backend errors and confirm client responses do not include internal exception text. Inspect frontend responses and confirm a strict CSP is present and does not break login/API flows.

### FIND-04: Global JSON and Proxy Limits Are Too Broad for Public API Paths

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Moderate |
| CVSS 4.0 | 6.5 (CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N) |
| CWE | [CWE-770](https://cwe.mitre.org/data/definitions/770.html): Allocation of Resources Without Limits or Throttling |
| OWASP | A10:2025 - Mishandling of Exceptional Conditions |
| Exploitation Prerequisites | None |
| Exploitability Tier | Tier 1 - Direct Exposure |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | ExpressApi, NginxFrontend |
| Related Threats | [T02.D](2-stride-analysis.md#nginxfrontend), [T03.D](2-stride-analysis.md#expressapi) |

#### Description

The backend applies `express.json({ limit: '25mb' })` globally, including public authentication routes that do not require large payloads. The nginx `/api/` proxy does not visibly declare request size and timeout controls to reduce pressure before requests reach Express.

#### Evidence

**Prerequisite basis:** ExpressApi and NginxFrontend are public Cloud Run network services with unauthenticated public routes.

`backend/src/server.ts` applies the 25 MB JSON parser before route dispatch. `nginx.conf` proxies `/api/` without `client_max_body_size`, `proxy_read_timeout`, or route-specific constraints.

#### Remediation

Set a small global body limit for normal JSON routes and apply larger parsers only to import endpoints. Add nginx and Cloud Run request limits aligned to the largest legitimate import payload.

#### Verification

Send oversized JSON bodies to `/api/auth/resolve-login` and `/api/auth/adb2c/callback` and confirm they are rejected at the smallest intended layer.

### FIND-05: ADB2C Public Metadata Is Embedded in Build Configuration

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Low |
| CVSS 4.0 | 3.7 (CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:N/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-200](https://cwe.mitre.org/data/definitions/200.html): Exposure of Sensitive Information to an Unauthorized Actor |
| OWASP | A02:2025 - Security Misconfiguration |
| Exploitation Prerequisites | None |
| Exploitability Tier | Tier 1 - Direct Exposure |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | AzureADB2C |
| Related Threats | [T13.I](2-stride-analysis.md#azureadb2c) |

#### Description

The frontend build embeds ADB2C tenant and client identifiers. These values are usually public OIDC metadata, but documenting them as non-secret and ensuring no secrets enter frontend build args prevents accidental expansion of public configuration into credential exposure.

#### Evidence

**Prerequisite basis:** The deployed SPA is public, and build arguments become part of browser-delivered configuration.

`cloudbuild.frontend.yaml` passes `VITE_ADB2C_CLIENT_ID`, `VITE_ADB2C_TENANT_ID`, `VITE_ADB2C_POLICY`, and `VITE_ADB2C_REDIRECT_URI` as Docker build args. `Dockerfile.frontend` copies those values into `ENV` before build.

#### Remediation

Maintain an explicit allow-list of public frontend configuration keys, keep client secrets exclusively in backend Secret Manager bindings, and scan built assets/images for accidental secret-shaped values.

#### Verification

Inspect built frontend assets and Cloud Build logs to confirm only public identifiers are present and `ADB2C_CLIENT_SECRET` never appears in frontend build inputs.

---

## Tier 2 - Conditional Risk (Authenticated / Single Prerequisite)

### FIND-06: Firestore Rules Let Users Promote Their Own Approval Status

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Critical |
| CVSS 4.0 | 8.7 (CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-266](https://cwe.mitre.org/data/definitions/266.html): Incorrect Privilege Assignment |
| OWASP | A01:2025 - Broken Access Control |
| Exploitation Prerequisites | Authenticated User |
| Exploitability Tier | Tier 2 - Conditional Risk |
| Remediation Effort | Low |
| Mitigation Type | Custom Mitigation |
| Component | FirestoreRules |
| Related Threats | [T11.E](2-stride-analysis.md#firestorerules) |

#### Description

The redesigned backend creates and updates profiles through APIs, but Firestore Rules still allow a direct authenticated client to update its own `status` field. A pending Firebase Auth user can bypass the intended admin approval workflow by using the Firebase SDK or Firestore REST API directly against their own `users/{uid}` document.

#### Evidence

**Prerequisite basis:** FirestoreRules are externally reachable to authenticated Firebase users.

`firestore.rules` under `match /users/{userId}` allows self-update when `incoming().diff(existing()).affectedKeys().hasOnly(['username', 'email', 'lastLoginAt', 'status', 'adb2cEmail'])` and then validates only that status is one of `Pending`, `Active`, or `Rejected`. `backend/src/routes/me.ts` intentionally preserves existing role/status and does not expose approval changes, showing a backend invariant that the rules do not preserve.

#### Remediation

Remove `status` from self-service update fields. Allow approval-state changes only through backend admin APIs or rules branches requiring `isAdmin()`/`isSuperAdmin()` with explicit transition validation.

#### Verification

Using a pending non-admin Firebase account, attempt a direct Firestore update of `users/{uid}.status` to `Active`; the operation should be denied. Confirm the same status change still works through authorized admin backend APIs.

### FIND-07: Direct Firestore Contract Reads Remain Available to Active Users

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Important |
| CVSS 4.0 | 7.0 (CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-284](https://cwe.mitre.org/data/definitions/284.html): Improper Access Control |
| OWASP | A01:2025 - Broken Access Control |
| Exploitation Prerequisites | Authenticated User |
| Exploitability Tier | Tier 2 - Conditional Risk |
| Remediation Effort | Medium |
| Mitigation Type | Redesign |
| Component | FirestoreDatabase, FirestoreRules |
| Related Threats | [T10.I](2-stride-analysis.md#firestoredatabase), [T11.I](2-stride-analysis.md#firestorerules) |

#### Description

The current application path searches contracts through the backend API, but Firestore Rules still allow active users to directly read contract documents and perform limited list queries. This widens the data exposure surface beyond the audited, logged, and rate-controlled backend search endpoint.

#### Evidence

**Prerequisite basis:** FirestoreDatabase and FirestoreRules expose direct client access to authenticated active users.

`firestore.rules` allows `get` on `/contracts/{contractId}` for `isActive()` and allows `list` for active users with `request.query.limit <= 100`. The frontend business API path in `src/services/api.ts` uses `/api/contracts/search`, confirming backend API access is now the intended workflow.

#### Remediation

Change contract client rules to deny direct reads and writes by default, or restrict reads to narrow per-user authorization predicates that exactly match business requirements. Keep backend Admin SDK access as the single contract search path with audit logging and rate limiting.

#### Verification

Authenticate as a normal active user and attempt direct Firestore SDK `getDoc()`/`getDocs()` on contracts; the operations should be denied while `/api/contracts/search` continues to function.

### FIND-08: Contract Search Lacks Per-User Rate Limiting

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Important |
| CVSS 4.0 | 7.3 (CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:L/SC:N/SI:N/SA:N) |
| CWE | [CWE-307](https://cwe.mitre.org/data/definitions/307.html): Improper Restriction of Excessive Authentication Attempts |
| OWASP | A06:2025 - Insecure Design |
| Exploitation Prerequisites | Authenticated User |
| Exploitability Tier | Tier 2 - Conditional Risk |
| Remediation Effort | Medium |
| Mitigation Type | Standard Mitigation |
| Component | ContractsRouter |
| Related Threats | [T07.A](2-stride-analysis.md#contractsrouter) |

#### Description

Authenticated users can repeatedly search contract identifiers with no endpoint-specific limiter. Since the searched values include MSISDN and billing account numbers, this can support systematic enumeration even though each query is bounded to five results.

#### Evidence

**Prerequisite basis:** `/api/contracts/search` requires `requireAuth`, so the attacker must be authenticated.

`backend/src/routes/contracts.ts` applies `requireAuth` to `/search` but does not apply `createRateLimiter`; the limiter is applied to `/import` and `/purge`. The route queries Firestore by `msisdn` or `billingAccountNumber` and logs only successful result searches.

#### Remediation

Add per-user and per-IP rate limits to `/api/contracts/search`, log zero-result attempts, and alert on high-volume or sequential identifier patterns.

#### Verification

Run repeated authenticated search requests and confirm the API returns 429 after the configured user/IP threshold and that both hit and miss attempts are observable in security logs.

### FIND-09: Bulk Import Allows Large Privileged Resource Consumption

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Important |
| CVSS 4.0 | 6.8 (CVSS:4.0/AV:N/AC:L/AT:N/PR:H/UI:N/VC:N/VI:L/VA:H/SC:N/SI:N/SA:N) |
| CWE | [CWE-400](https://cwe.mitre.org/data/definitions/400.html): Uncontrolled Resource Consumption |
| OWASP | A10:2025 - Mishandling of Exceptional Conditions |
| Exploitation Prerequisites | Privileged User |
| Exploitability Tier | Tier 2 - Conditional Risk |
| Remediation Effort | Medium |
| Mitigation Type | Redesign |
| Component | ContractsRouter |
| Related Threats | [T07.D](2-stride-analysis.md#contractsrouter) |

#### Description

The import route has valuable controls including validation, deduplication, batching, rate limiting, and audit logging, but it still accepts up to 100,000 rows in one JSON request. A compromised admin account or mistaken upload could consume API memory, Firestore write capacity, and Cloud Run resources.

#### Evidence

**Prerequisite basis:** `/api/contracts/import` requires `requireAuth` and `requireAdmin`, so the attacker must be privileged.

`backend/src/server.ts` sets a 25 MB JSON parser. `backend/src/routes/contracts.ts` accepts `contracts.length <= 100000`, builds an in-memory `Map`, and writes batches of 500.

#### Remediation

Move bulk import to staged object upload plus background processing, lower synchronous row limits, validate per-field lengths for all accepted fields, and provide preview/commit phases for large imports.

#### Verification

Submit maximum-size authorized imports in staging and confirm memory, latency, write quota, and rollback behavior remain within documented bounds.

### FIND-10: Admin Search Log Export Exposes High-Volume User Activity Data

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Moderate |
| CVSS 4.0 | 5.9 (CVSS:4.0/AV:N/AC:L/AT:N/PR:H/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-200](https://cwe.mitre.org/data/definitions/200.html): Exposure of Sensitive Information to an Unauthorized Actor |
| OWASP | A01:2025 - Broken Access Control |
| Exploitation Prerequisites | Privileged User |
| Exploitability Tier | Tier 2 - Conditional Risk |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | AdminRouter |
| Related Threats | [T08.I](2-stride-analysis.md#adminrouter) |

#### Description

Any admin can request a broad search-log export containing users, emails, search terms, and result counts. Search terms may be MSISDNs, billing account numbers, or fibre usernames, so this endpoint should have tighter role and purpose controls than ordinary admin list views.

#### Evidence

**Prerequisite basis:** AdminRouter requires `requireAdmin`, not superadmin, for `/search-logs`.

`backend/src/routes/admin.ts` sets `const limitCount = req.query.all === 'true' ? 5000 : 50` and returns mapped search log documents. `src/pages/AdminPanel.tsx` calls `portalApi.listSearchLogs(authToken, true)` for export.

#### Remediation

Restrict `all=true` export to superadmins, redact or tokenize sensitive search terms by default, and audit each export action with actor, count, and purpose.

#### Verification

Authenticate as an admin but not superadmin and confirm `/api/admin/search-logs?all=true` is denied or capped/redacted; confirm superadmin exports create audit entries.

### FIND-11: Backend Authentication and RBAC Controls Are Centralized and Effective

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Low |
| CVSS 4.0 | 2.0 (CVSS:4.0/AV:N/AC:H/AT:P/PR:L/UI:N/VC:N/VI:L/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-862](https://cwe.mitre.org/data/definitions/862.html): Missing Authorization |
| OWASP | A01:2025 - Broken Access Control |
| Exploitation Prerequisites | Authenticated User |
| Exploitability Tier | Tier 2 - Conditional Risk |
| Remediation Effort | Low |
| Mitigation Type | Existing Control |
| Component | AuthMiddleware, MeRouter, AdminRouter, ContractsRouter |
| Related Threats | [T05.S](2-stride-analysis.md#authmiddleware), [T05.E](2-stride-analysis.md#authmiddleware), [T06.T](2-stride-analysis.md#merouter), [T06.E](2-stride-analysis.md#merouter), [T07.R](2-stride-analysis.md#contractsrouter), [T08.E](2-stride-analysis.md#adminrouter), [T08.R](2-stride-analysis.md#adminrouter), [T10.T](2-stride-analysis.md#firestoredatabase) |

#### Description

The backend now centralizes protected Firestore operations behind token validation, profile hydration, role middleware, route validation, and audit logging. This finding documents an existing control because the new architecture meaningfully reduces the prior direct-client Firestore attack surface.

#### Evidence

**Prerequisite basis:** These threats require an authenticated or privileged user because the relevant routes use `requireAuth`, `requireAdmin`, or `requireSuperAdmin`.

`backend/src/middleware/auth.ts` verifies ADB2C and Firebase bearer tokens, rejects inactive/rejected users, and exports `requireAdmin`/`requireSuperAdmin`. `backend/src/routes/me.ts` ignores incoming uid and preserves role/status. `backend/src/routes/contracts.ts` audits import and purge. `backend/src/routes/admin.ts` enforces hierarchy checks and writes audit logs.

#### Remediation

Preserve this centralized pattern and add tests that every protected route includes the expected middleware. Consider a route registration convention that makes unauthenticated exceptions explicit.

#### Verification

Run route tests that call protected APIs without tokens, with normal user tokens, with admin tokens, and with superadmin tokens; confirm each endpoint accepts only the intended role.

### FIND-12: Firestore Default-Deny and Validation Controls Are Valuable but Need Alignment

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Low |
| CVSS 4.0 | 2.1 (CVSS:4.0/AV:N/AC:H/AT:P/PR:L/UI:N/VC:N/VI:L/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-693](https://cwe.mitre.org/data/definitions/693.html): Protection Mechanism Failure |
| OWASP | A05:2025 - Injection |
| Exploitation Prerequisites | Authenticated User |
| Exploitability Tier | Tier 2 - Conditional Risk |
| Remediation Effort | Low |
| Mitigation Type | Existing Control |
| Component | FirestoreRules |
| Related Threats | [T11.T](2-stride-analysis.md#firestorerules) |

#### Description

The Firestore Rules file includes a global deny fallback, helper functions, schema validation, role checks, and list query limits. Those controls should be retained, but their authorization predicates must be aligned with the backend-only data-access model.

#### Evidence

**Prerequisite basis:** Direct Firestore misuse requires an authenticated Firebase user.

`firestore.rules` starts with `match /{document=**} { allow read, write: if false; }`, defines validation helpers, limits normal contract list queries, and blocks audit/search log updates and deletes.

#### Remediation

Keep the default-deny and validation structure, but remove direct-client permissions that duplicate backend-owned workflows, especially self-status updates and broad contract reads.

#### Verification

Run the Firebase rules emulator with test cases for default-deny, allowed backend-equivalent operations, denied direct status changes, denied direct contract reads, and admin-only log visibility.

---

## Tier 3 - Defense-in-Depth (Prior Compromise / Host Access)

### FIND-13: Local Browser Storage Holds PKCE and Search Artifacts

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Moderate |
| CVSS 4.0 | 5.3 (CVSS:4.0/AV:L/AC:L/AT:N/PR:L/UI:N/VC:H/VI:L/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-922](https://cwe.mitre.org/data/definitions/922.html): Insecure Storage of Sensitive Information |
| OWASP | A04:2025 - Cryptographic Failures |
| Exploitation Prerequisites | Host/OS Access |
| Exploitability Tier | Tier 3 - Defense-in-Depth |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | BrowserClient |
| Related Threats | [T01.I](2-stride-analysis.md#browserclient), [T01.A](2-stride-analysis.md#browserclient) |

#### Description

The frontend stores PKCE verifier/state values and recent search terms in localStorage. These values survive tab closure and can be read by injected scripts or local browser access, increasing the impact of XSS or shared-workstation exposure.

#### Evidence

**Prerequisite basis:** BrowserClient has no network listener; exploitation requires local browser/host access or a script execution foothold.

`src/context/AuthContext.tsx` stores `_sys_v1` and `_sys_state` in localStorage before ADB2C login. `src/pages/SearchPage.tsx` stores recent searches under `_sc_h_${user.uid.substring(0, 8)}`.

#### Remediation

Use sessionStorage or memory for PKCE data, clear search history on logout, and consider disabling recent searches for sensitive identifiers. Pair this with a strict CSP from FIND-03.

#### Verification

Complete login and search flows, close/reopen the browser, and verify PKCE and search artifacts are not retained beyond the intended session.

### FIND-14: Static Service Account Key Fallback Increases Credential Exposure Risk

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Important |
| CVSS 4.0 | 7.0 (CVSS:4.0/AV:L/AC:L/AT:N/PR:H/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-798](https://cwe.mitre.org/data/definitions/798.html): Use of Hard-coded Credentials |
| OWASP | A04:2025 - Cryptographic Failures |
| Exploitation Prerequisites | Admin Credentials |
| Exploitability Tier | Tier 3 - Defense-in-Depth |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | FirestoreAdminClient |
| Related Threats | [T09.I](2-stride-analysis.md#firestoreadminclient), [T09.E](2-stride-analysis.md#firestoreadminclient) |

#### Description

The backend credential resolver searches for local `serviceAccountKey.json` files before falling back to application default credentials. In Cloud Run, workload/service account identity is preferable because static JSON keys are long-lived and easy to leak through images, workspaces, or support bundles.

#### Evidence

**Prerequisite basis:** Exploitation requires host, image, workspace, or GCP admin access to place or read a key file.

`backend/src/firebaseAdmin.ts` checks `GOOGLE_APPLICATION_CREDENTIALS`, `serviceAccountKey.json`, `backend/serviceAccountKey.json`, and `../serviceAccountKey.json`, then calls `admin.credential.cert(JSON.parse(raw))`. `.gitignore` excludes service account keys, but runtime loading remains possible.

#### Remediation

Disable static key fallback in production and rely on Cloud Run service account ADC. Add startup checks that fail closed when a local service account key exists in production.

#### Verification

Deploy with `NODE_ENV=production` and a local key path present in a staging image; confirm startup fails or ignores the static key and uses ADC.

### FIND-15: Build and Container Hardening Gaps Increase Supply Chain Impact

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Moderate |
| CVSS 4.0 | 5.8 (CVSS:4.0/AV:L/AC:L/AT:P/PR:H/UI:N/VC:H/VI:H/VA:L/SC:N/SI:N/SA:N) |
| CWE | [CWE-1104](https://cwe.mitre.org/data/definitions/1104.html): Use of Unmaintained Third Party Components |
| OWASP | A03:2025 - Software Supply Chain Failures |
| Exploitation Prerequisites | Admin Credentials |
| Exploitability Tier | Tier 3 - Defense-in-Depth |
| Remediation Effort | Medium |
| Mitigation Type | Standard Mitigation |
| Component | CloudBuildCloudRun |
| Related Threats | [T15.I](2-stride-analysis.md#cloudbuildcloudrun), [T15.T](2-stride-analysis.md#cloudbuildcloudrun), [T15.E](2-stride-analysis.md#cloudbuildcloudrun) |

#### Description

The Dockerfiles use mutable base image tags and do not declare non-root runtime users. This is a defense-in-depth issue because exploitation requires CI/CD or container compromise, but hardening reduces the impact of dependency, image, and runtime escape failures.

#### Evidence

**Prerequisite basis:** CI/CD and container hardening threats require admin credentials or prior control of the build/runtime environment.

`backend/Dockerfile` uses `FROM node:22-slim` and no `USER` directive. `Dockerfile.frontend` uses `FROM node:22-slim` and `FROM nginx:1.27-alpine` with no digest pinning or non-root runtime user.

#### Remediation

Pin base images by digest, run final containers as non-root, enable provenance/signing in CI/CD, and scan images before Cloud Run deployment.

#### Verification

Inspect deployed image metadata for digest-pinned bases and run containers with a non-root UID; verify build provenance/signature checks are required before deployment.

### FIND-16: Secret Manager Helper Correctly Avoids Repository Keys but Caches Secrets In Process

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Low |
| CVSS 4.0 | 2.6 (CVSS:4.0/AV:L/AC:H/AT:P/PR:H/UI:N/VC:L/VI:N/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-525](https://cwe.mitre.org/data/definitions/525.html): Use of Web Browser Cache Containing Sensitive Information |
| OWASP | A04:2025 - Cryptographic Failures |
| Exploitation Prerequisites | Host/OS Access |
| Exploitability Tier | Tier 3 - Defense-in-Depth |
| Remediation Effort | Low |
| Mitigation Type | Existing Control |
| Component | GoogleSecretManager |
| Related Threats | [T14.I](2-stride-analysis.md#googlesecretmanager), [T14.T](2-stride-analysis.md#googlesecretmanager) |

#### Description

The optional Excel crypto helper uses Google Secret Manager and AES-256-GCM instead of committing encryption keys. It caches secret values in memory, which is a reasonable performance tradeoff but should be bounded if these keys protect high-sensitivity imports.

#### Evidence

**Prerequisite basis:** Reading process memory or controlling secret versions requires host/admin-level access.

`backend/src/services/secretManager.ts` retrieves secret versions from Google Secret Manager and stores them in a `Map`. `backend/src/services/excelCrypto.ts` requires a 32-byte base64 key and uses `aes-256-gcm` with random 12-byte IVs and auth tags.

#### Remediation

Keep Secret Manager as the source of truth, add TTL-based cache expiration if key sensitivity warrants it, and ensure Secret Manager IAM changes generate alerts.

#### Verification

Run encryption/decryption tests with a rotated secret version and confirm metadata selects the intended version while old cached values expire according to policy.

---

## Threat Coverage Verification

| Threat ID | Finding ID | Status |
|-----------|------------|--------|
| T01.I | FIND-13 | ✅ Covered (FIND-13) |
| T01.A | FIND-13 | ✅ Covered (FIND-13) |
| T02.I | FIND-03 | ✅ Covered (FIND-03) |
| T02.D | FIND-04 | ✅ Covered (FIND-04) |
| T03.I | FIND-03 | ✅ Covered (FIND-03) |
| T03.D | FIND-04 | ✅ Covered (FIND-04) |
| T04.S | FIND-02 | ✅ Covered (FIND-02) |
| T04.I | FIND-01 | ✅ Covered (FIND-01) |
| T04.D | FIND-01 | ✅ Covered (FIND-01) |
| T05.S | FIND-11 | ✅ Mitigated (FIND-11) |
| T05.E | FIND-11 | ✅ Mitigated (FIND-11) |
| T06.T | FIND-11 | ✅ Mitigated (FIND-11) |
| T06.E | FIND-11 | ✅ Mitigated (FIND-11) |
| T07.A | FIND-08 | ✅ Covered (FIND-08) |
| T07.D | FIND-09 | ✅ Covered (FIND-09) |
| T07.R | FIND-11 | ✅ Mitigated (FIND-11) |
| T08.I | FIND-10 | ✅ Covered (FIND-10) |
| T08.E | FIND-11 | ✅ Mitigated (FIND-11) |
| T08.R | FIND-11 | ✅ Mitigated (FIND-11) |
| T09.I | FIND-14 | ✅ Covered (FIND-14) |
| T09.E | FIND-14 | ✅ Covered (FIND-14) |
| T10.I | FIND-07 | ✅ Covered (FIND-07) |
| T10.T | FIND-11 | ✅ Mitigated (FIND-11) |
| T11.E | FIND-06 | ✅ Covered (FIND-06) |
| T11.I | FIND-07 | ✅ Covered (FIND-07) |
| T11.T | FIND-12 | ✅ Mitigated (FIND-12) |
| T12.S | - | 🔄 Mitigated by Platform |
| T12.E | - | 🔄 Mitigated by Platform |
| T13.S | - | 🔄 Mitigated by Platform |
| T13.I | FIND-05 | ✅ Covered (FIND-05) |
| T14.I | FIND-16 | ✅ Mitigated (FIND-16) |
| T14.T | FIND-16 | ✅ Mitigated (FIND-16) |
| T15.I | FIND-15 | ✅ Covered (FIND-15) |
| T15.T | FIND-15 | ✅ Covered (FIND-15) |
| T15.E | FIND-15 | ✅ Covered (FIND-15) |
