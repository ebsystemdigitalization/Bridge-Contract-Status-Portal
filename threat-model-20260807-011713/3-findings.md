# Security Findings

---

## Tier 1 — Direct Exposure (No Prerequisites)

### FIND-01: Public Login Resolution Enables Account Enumeration

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Important |
| CVSS 4.0 | 6.9 (CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:L/SC:N/SI:N/SA:N) |
| CWE | [CWE-203](https://cwe.mitre.org/data/definitions/203.html): Observable Discrepancy |
| OWASP | A07:2025 – Authentication Failures |
| Exploitation Prerequisites | None |
| Exploitability Tier | Tier 1 — Direct Exposure |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | AuthRouter |
| Related Threats | [T07.1](2-stride-analysis.md#authrouter), [T07.2](2-stride-analysis.md#authrouter) |

#### Description

The unauthenticated resolve-login endpoint returns a distinct response for existing users versus absent users, enabling account discovery through repeated probing. This is a classic observable discrepancy and lowers the barrier for targeted phishing or password attacks.

#### Evidence

**Prerequisite basis:** The route is publicly reachable under the backend Cloud Run service and does not require auth, as shown in [backend/src/routes/auth.ts](../backend/src/routes/auth.ts). The deployment also exposes the API with `--allow-unauthenticated` in [cloudbuild.backend.yaml](../cloudbuild.backend.yaml).

The route in [backend/src/routes/auth.ts](../backend/src/routes/auth.ts) performs a Firestore lookup on `users` by username and returns either the stored email or `null`, making the existence of the profile observable to remote callers.

#### Remediation

Return indistinguishable responses for existing and missing accounts, add anti-automation throttling, and consider requiring a stronger authentication step before revealing any account state.

#### Verification

Probe the endpoint for existing and non-existing usernames and confirm that the response shape and timing do not distinguish the two cases. Verify that repeated probes are throttled.

### FIND-02: ADB2C Callback Trusts a Client-Supplied Redirect URI

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Important |
| CVSS 4.0 | 7.1 (CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:H/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-346](https://cwe.mitre.org/data/definitions/346.html): Origin Validation Error |
| OWASP | A07:2025 – Authentication Failures |
| Exploitation Prerequisites | None |
| Exploitability Tier | Tier 1 — Direct Exposure |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | AuthRouter |
| Related Threats | [T08.1](2-stride-analysis.md#authrouter) |

#### Description

The callback route accepts a `redirectUri` from the request body and compares it only for presence/absence before sending it to ADB2C. This trusting of a browser-controlled parameter weakens the OAuth security binding and increases the chance of redirect confusion and phishing.

#### Evidence

**Prerequisite basis:** The callback route is public and is invoked directly by the browser before any authenticated session exists, as shown in [backend/src/routes/auth.ts](../backend/src/routes/auth.ts) and the deployment in [cloudbuild.backend.yaml](../cloudbuild.backend.yaml).

The handler reads `code`, `codeVerifier`, and `redirectUri` from the request body and sends `redirect_uri: redirectUri` to the token exchange without enforcing a server-side allow-list.

#### Remediation

Derive the redirect URI from server-side configuration, compare it against an exact allow-list, and reject any mismatch before contacting the identity provider.

#### Verification

Send callback requests with an unapproved redirect URI and confirm the backend rejects them before the token exchange call proceeds.

### FIND-03: Public Error and Browser Hardening Gaps Increase Token Exposure Impact

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Moderate |
| CVSS 4.0 | 6.4 (CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-209](https://cwe.mitre.org/data/definitions/209.html): Generation of Error Message Containing Sensitive Information |
| OWASP | A02:2025 – Security Misconfiguration |
| Exploitation Prerequisites | None |
| Exploitability Tier | Tier 1 — Direct Exposure |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | NginxFrontend, ExpressApi |
| Related Threats | [T03.1](2-stride-analysis.md#nginxfrontend), [T04.1](2-stride-analysis.md#expressapi) |

#### Description

The backend error handler returns a generic message, but the public frontend lacks a content-security-policy and the nginx layer does not constrain the risk of script injection or token leakage in the browser. The combination increases the impact of public probing and malicious script execution.

#### Evidence

**Prerequisite basis:** The frontend and API are public network services, and the nginx service is reachable from the public internet, as shown in [nginx.conf](../nginx.conf) and [backend/src/server.ts](../backend/src/server.ts).

The nginx configuration includes X-Content-Type-Options, X-Frame-Options, and Referrer-Policy but no Content-Security-Policy header, and the Express app does not add a stronger wrapper for safe error responses beyond a generic message.

#### Remediation

Add a strict CSP that limits script sources, frame ancestors, object sources, and connection targets, and keep error handling consistent for both public API and browser responses.

#### Verification

Inspect the frontend responses for a CSP header and verify that common error paths do not expose internal exception details.

### FIND-04: Global JSON and Proxy Limits Are Too Broad for Public API Paths

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Moderate |
| CVSS 4.0 | 6.5 (CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N) |
| CWE | [CWE-770](https://cwe.mitre.org/data/definitions/770.html): Allocation of Resources Without Limits or Throttling |
| OWASP | A10:2025 – Mishandling of Exceptional Conditions |
| Exploitation Prerequisites | None |
| Exploitability Tier | Tier 1 — Direct Exposure |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | ExpressApi, NginxFrontend |
| Related Threats | [T03.2](2-stride-analysis.md#nginxfrontend), [T04.2](2-stride-analysis.md#expressapi) |

#### Description

The backend uses a 1 MB JSON parser globally and nginx exposes a public /api proxy without request-timeout or body-size controls tuned to the public authentication routes. This increases the risk of resource exhaustion from oversized or repeated requests.

#### Evidence

**Prerequisite basis:** The public Express API and nginx frontend are both externally reachable, as shown in [backend/src/server.ts](../backend/src/server.ts) and [nginx.conf](../nginx.conf).

The backend applies `express.json({ limit: '1mb' })` globally, while nginx uses a 25 MB client max body size and no route-specific proxy timeout or request-size controls for `/api/`.

#### Remediation

Use smaller limits on public authentication routes and add explicit proxy timeouts, request-size limits, and buffering controls where appropriate.

#### Verification

Send oversized JSON bodies to public auth routes and confirm they are rejected at the edge before the application spends significant resources on processing them.

### FIND-05: ADB2C and Firebase Authentication Metadata Are Exposed in Frontend Build Inputs

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Low |
| CVSS 4.0 | 3.7 (CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:N/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-200](https://cwe.mitre.org/data/definitions/200.html): Exposure of Sensitive Information to an Unauthorized Actor |
| OWASP | A02:2025 – Security Misconfiguration |
| Exploitation Prerequisites | None |
| Exploitability Tier | Tier 1 — Direct Exposure |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | BrowserClient |
| Related Threats | [T01.1](2-stride-analysis.md#browserclient) |

#### Description

The frontend build uses environment values for ADB2C client identifiers and redirect URIs that are embedded in the public SPA build. While these are usually public, they should still be treated as build-time configuration that is visible to anyone inspecting the client assets.

#### Evidence

**Prerequisite basis:** The browser client is public and the build arguments are emitted into the shipped frontend assets, as shown in [Dockerfile.frontend](../Dockerfile.frontend) and [src/context/AuthContext.tsx](../src/context/AuthContext.tsx).

The frontend reads `VITE_ADB2C_*` values from build-time environment and uses them directly in the authorization URL construction.

#### Remediation

Keep a minimal allow-list of public frontend configuration values and ensure no secret-like values are ever passed into the frontend build pipeline.

#### Verification

Inspect the built frontend configuration and confirm that only public identifiers are embedded and no secret values are present.

---

## Tier 2 — Conditional Risk (Authenticated / Single Prerequisite)

### FIND-06: Firestore Rules Still Permit Direct Client Updates That Can Bypass Approval State

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Critical |
| CVSS 4.0 | 8.7 (CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-266](https://cwe.mitre.org/data/definitions/266.html): Incorrect Privilege Assignment |
| OWASP | A01:2025 – Broken Access Control |
| Exploitation Prerequisites | Authenticated User |
| Exploitability Tier | Tier 2 — Conditional Risk |
| Remediation Effort | Low |
| Mitigation Type | Custom Mitigation |
| Component | FirestoreRules |
| Related Threats | [T17.2](2-stride-analysis.md#firestorerules) |

#### Description

The Firestore rules still allow a self-updating client to change its own `status` value under certain conditions. That means an authenticated user can attempt to promote their account directly through the Firestore client path even though the backend intends approval state to be controlled server-side.

#### Evidence

**Prerequisite basis:** Firestore rules are reachable to any authenticated Firebase client, and the repository’s backend logic keeps approval state server-side, as shown in [firestore.rules](../firestore.rules) and [backend/src/routes/me.ts](../backend/src/routes/me.ts).

The `match /users/{userId}` rule allows self-update with `incoming().diff(existing()).affectedKeys().hasOnly([... 'status' ...])` and only checks that the status is one of the allowed values.

#### Remediation

Remove `status` from self-service update fields and require admin-only transitions that are enforced both in server-side logic and Firestore rules.

#### Verification

Attempt a direct Firestore update of `users/{uid}.status` from a non-admin account and confirm it is denied. Verify that admin-only status changes continue to work through the backend API.

### FIND-07: Direct Firestore Contract Reads Remain Available to Active Users

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Important |
| CVSS 4.0 | 7.0 (CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-284](https://cwe.mitre.org/data/definitions/284.html): Improper Access Control |
| OWASP | A01:2025 – Broken Access Control |
| Exploitation Prerequisites | Authenticated User |
| Exploitability Tier | Tier 2 — Conditional Risk |
| Remediation Effort | Medium |
| Mitigation Type | Redesign |
| Component | FirestoreDatabase, FirestoreRules |
| Related Threats | [T16.1](2-stride-analysis.md#firestoredatabase), [T17.1](2-stride-analysis.md#firestorerules) |

#### Description

The current backend search flow is centralized, but Firestore rules still allow direct contract reads and list queries for active users. That widens the exposure surface beyond the audited and rate-limited backend API.

#### Evidence

**Prerequisite basis:** The backend routes now use the API path, but direct client access remains possible under the rules layer, as shown in [firestore.rules](../firestore.rules) and [src/services/api.ts](../src/services/api.ts).

The rules file still permits `get` and `list` access to contracts for active users under the existing policy logic, while the frontend uses the backend search route as the intended path.

#### Remediation

Deny direct contract reads by default and reserve Firestore access for the trusted backend path, or restrict client reads to a narrow and fully justified authorization predicate.

#### Verification

Authenticate as a normal active user and attempt a direct Firestore SDK `getDoc()` or `getDocs()` for contract paths; the operation should be denied while `/api/contracts/search` continues to work.

### FIND-08: Contract Search Lacks Per-User Rate Limiting

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Important |
| CVSS 4.0 | 7.3 (CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:L/SC:N/SI:N/SA:N) |
| CWE | [CWE-307](https://cwe.mitre.org/data/definitions/307.html): Improper Restriction of Excessive Authentication Attempts |
| OWASP | A06:2025 – Insecure Design |
| Exploitation Prerequisites | Authenticated User |
| Exploitability Tier | Tier 2 — Conditional Risk |
| Remediation Effort | Medium |
| Mitigation Type | Standard Mitigation |
| Component | ContractsRouter |
| Related Threats | [T11.1](2-stride-analysis.md#contractsrouter), [T12.1](2-stride-analysis.md#contractsrouter) |

#### Description

Authenticated users can repeatedly search contract identifiers with no per-user limiter. Because the search terms include MSISDN and billing account values, this creates a path for systematic enumeration even though each query is bounded to five results.

#### Evidence

**Prerequisite basis:** The search endpoint is authenticated and publicly reachable through the API, as shown in [backend/src/routes/contracts.ts](../backend/src/routes/contracts.ts).

The route applies a general rate limiter but uses an in-memory IP-based key, so different users on the same public IP share the same bucket and the endpoint lacks per-user throttling.

#### Remediation

Apply a per-user limiter keyed by authenticated identity or a signed session token, and reduce query counts for repeated searches.

#### Verification

Reissue many searches from one authenticated account and confirm that the requests are throttled per user rather than only per IP.

### FIND-09: Admin Search Log Export Exposes Broad User Activity Data

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Moderate |
| CVSS 4.0 | 5.9 (CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-200](https://cwe.mitre.org/data/definitions/200.html): Exposure of Sensitive Information to an Unauthorized Actor |
| OWASP | A01:2025 – Broken Access Control |
| Exploitation Prerequisites | Privileged User |
| Exploitability Tier | Tier 2 — Conditional Risk |
| Remediation Effort | Medium |
| Mitigation Type | Standard Mitigation |
| Component | AdminRouter |
| Related Threats | [T13.1](2-stride-analysis.md#adminrouter) |

#### Description

The admin search-log endpoint accepts an `all=true` parameter that can retrieve a large volume of search activity records without a strong privilege boundary. This broad data export could expose more user activity than intended for ordinary admins.

#### Evidence

**Prerequisite basis:** The endpoint is protected by admin middleware but allows a broad export path for any admin or superadmin, as shown in [backend/src/routes/admin.ts](../backend/src/routes/admin.ts).

The route uses `req.query.all === 'true' ? 50000 : 50` while returning user activity rows from `search_logs`.

#### Remediation

Restrict the large export path to superadmins only and redact or summarize sensitive activity values for non-superadmin admins.

#### Verification

Call the search-log endpoint with `all=true` as a non-superadmin admin and verify that the request is denied or results are heavily restricted.

---

## Tier 3 — Defense-in-Depth (Prior Compromise / Host Access)

### FIND-10: Backend Service Account and Secret Access Could Escalate Beyond the Intended Workload

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Moderate |
| CVSS 4.0 | 5.7 (CVSS:4.0/AV:N/AC:L/AT:N/PR:H/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-250](https://cwe.mitre.org/data/definitions/250.html): Execution with Unnecessary Privileges |
| OWASP | A01:2025 – Broken Access Control |
| Exploitation Prerequisites | Admin Credentials |
| Exploitability Tier | Tier 3 — Defense-in-Depth |
| Remediation Effort | Medium |
| Mitigation Type | Standard Mitigation |
| Component | GoogleSecretManager |
| Related Threats | [T20.1](2-stride-analysis.md#googlesecretmanager) |

#### Description

The backend uses secret-manager and Firestore access through a service account. If the runtime account has broad IAM roles or the deployment is misconfigured, a compromised application process could access more secrets or data than the intended workload needs.

#### Evidence

**Prerequisite basis:** The Cloud Run deployment uses a specific service account and secret binding configuration in [cloudbuild.backend.yaml](../cloudbuild.backend.yaml), while the backend uses Secret Manager through a helper in [backend/src/services/secretManager.ts](../backend/src/services/secretManager.ts).

The repository does not contain the actual IAM role bindings, so this is a deployment-configuration risk rather than a code-level bug.

#### Remediation

Apply least-privilege IAM roles to the Cloud Run service account, separate workload identities when practical, and review secret access paths regularly.

#### Verification

Review the deployed service-account IAM bindings and confirm the backend service account can only perform the minimum required Firestore and Secret Manager actions.

### FIND-11: Deployment Automation Can Expand Privilege if CI/CD Settings Drift

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Moderate |
| CVSS 4.0 | 5.3 (CVSS:4.0/AV:N/AC:L/AT:N/PR:H/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N) |
| CWE | [CWE-284](https://cwe.mitre.org/data/definitions/284.html): Improper Access Control |
| OWASP | A02:2025 – Security Misconfiguration |
| Exploitation Prerequisites | Admin Credentials |
| Exploitability Tier | Tier 3 — Defense-in-Depth |
| Remediation Effort | Medium |
| Mitigation Type | Standard Mitigation |
| Component | CloudBuildCloudRun |
| Related Threats | [T21.1](2-stride-analysis.md#cloudbuildcloudrun) |

#### Description

The Cloud Build pipeline deploys the backend and frontend services and also injects secrets and environment values. If the deployment configuration drifts or is altered without review, the resulting service can gain broader access than intended.

#### Evidence

**Prerequisite basis:** The backend Cloud Build definition includes `--allow-unauthenticated`, `--set-env-vars`, and Secret Manager updates, as shown in [cloudbuild.backend.yaml](../cloudbuild.backend.yaml).

The deployment model is infrastructure-controlled and therefore not fully verifiable from source alone, but the repository clearly includes the settings that can broaden runtime exposure.

#### Remediation

Require deployment review for env-var and secret changes, pin images and build artifacts, and reduce unnecessary deployment privileges.

#### Verification

Review recent CI changes and confirm that deployments are reviewed and that secrets are only injected through approved paths.

---

## Threat Coverage Verification

| Threat ID | Finding ID | Status |
|-----------|------------|--------|
| T01.1 | FIND-05 | ✅ Covered (FIND-05) |
| T01.2 | FIND-05 | ✅ Covered (FIND-05) |
| T02.1 | FIND-05 | ✅ Covered (FIND-05) |
| T03.1 | FIND-03 | ✅ Covered (FIND-03) |
| T03.2 | FIND-04 | ✅ Covered (FIND-04) |
| T04.1 | FIND-03 | ✅ Covered (FIND-03) |
| T04.2 | FIND-04 | ✅ Covered (FIND-04) |
| T05.1 | FIND-04 | ✅ Covered (FIND-04) |
| T06.1 | FIND-04 | ✅ Covered (FIND-04) |
| T07.1 | FIND-01 | ✅ Covered (FIND-01) |
| T07.2 | FIND-01 | ✅ Covered (FIND-01) |
| T08.1 | FIND-02 | ✅ Covered (FIND-02) |
| T08.2 | FIND-01 | ✅ Covered (FIND-01) |
| T09.1 | FIND-04 | ✅ Covered (FIND-04) |
| T09.2 | FIND-04 | ✅ Covered (FIND-04) |
| T10.1 | FIND-04 | ✅ Covered (FIND-04) |
| T10.2 | FIND-04 | ✅ Covered (FIND-04) |
| T11.1 | FIND-08 | ✅ Covered (FIND-08) |
| T12.1 | FIND-08 | ✅ Covered (FIND-08) |
| T12.2 | FIND-08 | ✅ Covered (FIND-08) |
| T13.1 | FIND-09 | ✅ Covered (FIND-09) |
| T13.2 | FIND-09 | ✅ Covered (FIND-09) |
| T13.3 | FIND-09 | ✅ Covered (FIND-09) |
| T14.1 | FIND-10 | ✅ Covered (FIND-10) |
| T15.1 | FIND-10 | ✅ Covered (FIND-10) |
| T16.1 | FIND-07 | ✅ Covered (FIND-07) |
| T16.2 | FIND-07 | ✅ Covered (FIND-07) |
| T17.1 | FIND-07 | ✅ Covered (FIND-07) |
| T17.2 | FIND-06 | ✅ Covered (FIND-06) |
| T18.1 | FIND-02 | ✅ Covered (FIND-02) |
| T19.1 | FIND-02 | ✅ Covered (FIND-02) |
| T20.1 | FIND-10 | ✅ Covered (FIND-10) |
| T21.1 | FIND-11 | ✅ Covered (FIND-11) |
| T21.2 | FIND-11 | ✅ Covered (FIND-11) |
