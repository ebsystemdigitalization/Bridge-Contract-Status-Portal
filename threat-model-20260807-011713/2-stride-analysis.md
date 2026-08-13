# STRIDE + Abuse Cases — Threat Analysis

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
| BrowserClient | [Link](#browserclient) | 0 | 0 | 0 | 1 | 1 | 0 | 1 | 3 | 2 | 1 | 0 | Medium |
| NginxFrontend | [Link](#nginxfrontend) | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 2 | 2 | 0 | 0 | Medium |
| ExpressApi | [Link](#expressapi) | 0 | 0 | 0 | 1 | 1 | 1 | 1 | 4 | 2 | 1 | 1 | Medium |
| AuthRouter | [Link](#authrouter) | 1 | 0 | 0 | 1 | 0 | 1 | 1 | 4 | 2 | 2 | 0 | High |
| AuthMiddleware | [Link](#authmiddleware) | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 2 | 0 | 2 | 0 | Medium |
| MeRouter | [Link](#merouter) | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 2 | 0 | 2 | 0 | Medium |
| ContractsRouter | [Link](#contractsrouter) | 0 | 0 | 0 | 1 | 1 | 0 | 1 | 3 | 1 | 2 | 0 | Medium |
| AdminRouter | [Link](#adminrouter) | 0 | 0 | 0 | 1 | 0 | 1 | 1 | 3 | 0 | 3 | 0 | Medium |
| FirestoreAdminClient | [Link](#firestoreadminclient) | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 2 | 0 | 1 | 1 | Medium |
| FirestoreDatabase | [Link](#firestoredatabase) | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 2 | 0 | 2 | 0 | Medium |
| FirestoreRules | [Link](#firestorerules) | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 2 | 0 | 2 | 0 | Medium |
| AzureADB2C | [Link](#azureadb2c) | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | Low |
| FirebaseAuth | [Link](#firebaseauth) | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | Low |
| GoogleSecretManager | [Link](#googlesecretmanager) | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | Low |
| CloudBuildCloudRun | [Link](#cloudbuildcloudrun) | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 2 | 0 | 0 | 2 | Medium |
| **Totals** | | **1** | **0** | **0** | **14** | **4** | **8** | **8** | **35** | **11** | **18** | **5** | |

---

## BrowserClient

**Trust Boundary:** PublicZone
**Role:** React SPA that handles user auth and API calls.
**Data Flows:** DF01, DF03, DF05, DF06, DF20
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T01.1 | Information Disclosure | Browser session state and auth metadata can be observed by injected scripts if CSP is missing. | None | DF03 | Add a strict CSP and remove verbose client-side error handling. | Open |
| T01.2 | Denial of Service | Public frontend requests can be driven to repeated auth redirects and state churn without client-side throttling. | None | DF05 | Add client-side retry caps and clear error screens. | Open |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|------------|------------|--------|
| T02.1 | Abuse | A user could repeatedly trigger login initiation to create noisy traffic and disrupt the login experience. | Authenticated User | DF05 | Add server-side anti-automation checks and client-side cooldowns. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | The browser does not establish identity for other components; it consumes identity data from upstream providers. |
| Tampering | The SPA does not directly modify server-side state without API calls. |
| Repudiation | Client-side actions are logged by the backend. |
| Elevation of Privilege | The browser cannot bypass server authorization policies. |

## NginxFrontend

**Trust Boundary:** PublicZone
**Role:** nginx edge service that serves the SPA and proxies the API.
**Data Flows:** DF03, DF04, DF22
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T03.1 | Information Disclosure | Missing CSP leaves the public SPA more exposed to script injection and token leakage via browser execution. | None | DF03 | Add a restrictive Content-Security-Policy and reduce inline script usage. | Open |
| T03.2 | Denial of Service | Unbounded request forwarding and lack of proxy timeouts can amplify request floods and slow the service. | None | DF04 | Add proxy timeouts, small request size limits, and upstream buffering controls. | Open |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | The reverse proxy is not an identity provider. |
| Tampering | Proxy tampering is limited by TLS and server hardening. |
| Repudiation | The proxy does not generate business-significant audit claims. |
| Elevation of Privilege | The proxy does not grant backend privileges. |
| Abuse | The proxy is a transport layer, not a business workflow. |

## ExpressApi

**Trust Boundary:** PublicZone
**Role:** Public entrypoint for authentication and protected business APIs.
**Data Flows:** DF04, DF07, DF08, DF09, DF10, DF11, DF21
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T04.1 | Information Disclosure | The API returns generic but still diagnostic error details to callers in some paths if errors propagate. | None | DF04 | Centralize error handling and return consistent generic responses. | Open |
| T04.2 | Denial of Service | Large JSON payloads and repeated unauthenticated requests can consume CPU and memory before auth checks complete. | None | DF04 | Apply smaller request limits on public routes and add backend throttling. | Open |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T05.1 | Elevation of Privilege | If a route is accidentally exposed without middleware, its handler may bypass role enforcement. | Authenticated User | DF10 | Keep middleware ordering explicit and add route-level tests for every protected endpoint. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|------------|------------|--------|
| T06.1 | Abuse | Large imports can still consume worker time and storage even though the route is rate limited. | Admin Credentials | DF10 | Add per-tenant quotas and asynchronous processing. | Open |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | The API does not authenticate clients itself beyond bearer tokens. |
| Tampering | Data integrity is enforced by route logic and Firestore writes. |
| Repudiation | The backend writes audit logs for privileged actions. |

## AuthRouter

**Trust Boundary:** BackendServices
**Role:** Public auth bridge for login resolution and ADB2C callback exchange.
**Data Flows:** DF07, DF12, DF13
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T07.1 | Spoofing | The resolve-login endpoint can be used to probe for registered accounts by observing distinct email responses. | None | DF07 | Return indistinguishable responses and add anti-automation controls. | Open |
| T07.2 | Information Disclosure | The auth route leaks whether an account exists by returning a stored email or a null response. | None | DF07 | Standardize responses and throttle repeated lookups. | Open |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T08.1 | Elevation of Privilege | A compromised client could attempt to replay or mutate the callback flow if server-side validation is relaxed. | Authenticated User | DF12 | Keep exact redirect-uri matching and strict token verification. | Open |
| T08.2 | Abuse | A user could repeatedly trigger login resolution to build a target list for later phishing or credential attacks. | Privileged User | DF07 | Apply account-level throttling and challenge-based validation. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Tampering | The router relies on upstream token verification. |
| Repudiation | The backend writes profile updates and audit records. |
| Denial of Service | The limiter on the route reduces this risk. |

## AuthMiddleware

**Trust Boundary:** BackendServices
**Role:** Validates bearer tokens and hydrates the authenticated user context.
**Data Flows:** DF08, DF14
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T09.1 | Elevation of Privilege | A malformed token that reaches the fallback path could be accepted if middleware order changes in future updates. | Authenticated User | DF08 | Keep explicit token-acceptance branches and unit tests for each identity provider. | Open |
| T09.2 | Abuse | A user could attempt to exploit the profile-status branch to access endpoints while pending or rejected. | Authenticated User | DF08 | Keep explicit status checks and deny non-active accounts before route dispatch. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Information Disclosure | The middleware typically returns generic auth errors. |
| Denial of Service | Token verification overhead is bounded. |

## MeRouter

**Trust Boundary:** BackendServices
**Role:** Authenticated profile APIs.
**Data Flows:** DF09, DF15
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T10.1 | Information Disclosure | Profile responses include user data that may be more detailed than necessary if the document structure changes. | Authenticated User | DF15 | Limit serialization to fields needed by the UI and add field allow-lists. | Open |
| T10.2 | Elevation of Privilege | A malicious client could attempt to overwrite profile fields that should be immutable. | Authenticated User | DF15 | Keep server-side field allow-lists and preserve existing role/status values. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | The router trusts the authenticated context from middleware. |
| Tampering | Profile updates are validated. |

## ContractsRouter

**Trust Boundary:** BackendServices
**Role:** Contract search, import, and purge endpoints.
**Data Flows:** DF10, DF16
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T11.1 | Abuse | A public user could repeatedly probe the search endpoint to enumerate contract identifiers and billing accounts. | None | DF10 | Add per-user rate limiting and stricter query limits. | Open |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T12.1 | Information Disclosure | Search results can leak contract data to a user who should only access a smaller set of records. | Authenticated User | DF16 | Enforce strict authorization predicates and audit successful searches. | Open |
| T12.2 | Denial of Service | Large import payloads can still consume significant storage and compute resources. | Privileged User | DF16 | Add asynchronous processing and per-user import quotas. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | The route is bound to the authenticated identity. |
| Tampering | The backend validates payload shape before writes. |

## AdminRouter

**Trust Boundary:** BackendServices
**Role:** Admin and superadmin management APIs.
**Data Flows:** DF11, DF17
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T13.1 | Information Disclosure | Search log exports can expose large sets of user activity data to administrators who do not need full history. | Privileged User | DF17 | Restrict `all=true` exports to superadmins and redact sensitive values. | Open |
| T13.2 | Elevation of Privilege | A lower-privilege admin could attempt to change roles or status through the API if route order or checks regressed. | Privileged User | DF17 | Keep explicit superadmin-only checks on role updates and preserve audit logs. | Open |
| T13.3 | Abuse | An admin could misuse the list endpoints to gather user inventory and target accounts. | Privileged User | DF17 | Add export limits, admin-specific dashboards, and access review. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | The API relies on validated auth context. |
| Tampering | Writes are validated and audited. |

## FirestoreAdminClient

**Trust Boundary:** BackendServices
**Role:** Firestore access path used by backend services.
**Data Flows:** DF15, DF16, DF17, DF18
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T14.1 | Information Disclosure | Backend service account misconfiguration could expose data through broad Firestore reads. | Authenticated User | DF18 | Lock Admin SDK access to the minimum collection set and add tests for each route. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T15.1 | Elevation of Privilege | A compromised backend process could write or delete data outside the intended flow. | Host/OS Access | DF18 | Use separate service accounts per workload and restrict Firestore IAM. | Open |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | The Admin SDK uses service-account trust. |
| Denial of Service | Firestore quotas are outside the route logic. |

## FirestoreDatabase

**Trust Boundary:** DataStorage
**Role:** Persistent data store for portal data.
**Data Flows:** DF18, DF19
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T16.1 | Information Disclosure | A misconfigured Firestore rule could allow broader reads than intended. | Authenticated User | DF18 | Keep rules reviewed and tested in CI. | Open |
| T16.2 | Abuse | A user could use the data store as a side channel to reconstruct business data if listings or queries are too broad. | Authenticated User | DF18 | Keep list queries bounded and leaky fields absent from rules. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | Firestore identity is managed by Firebase Auth. |
| Tampering | Data writes are validated by the backend. |

## FirestoreRules

**Trust Boundary:** DataStorage
**Role:** Firestore client-policy decision point.
**Data Flows:** DF19, DF20
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T17.1 | Information Disclosure | A policy change could unintentionally expose user profile documents to other authenticated users. | Authenticated User | DF19 | Add deterministic policy tests and CI checks. | Open |
| T17.2 | Elevation of Privilege | A logic bug could allow authenticated clients to update fields that should remain admin-controlled. | Authenticated User | DF20 | Keep admin-only fields in server-side code and deny them in rules. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Denial of Service | Rules are not the primary DoS control. |
| Abuse | Client-side rules are not a business workflow. |

## AzureADB2C

**Trust Boundary:** ExternalServices
**Role:** Identity provider used during the login flow.
**Data Flows:** DF05, DF12
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T18.1 | Information Disclosure | Misconfigured OIDC metadata or redirect registration can leak identity details and support phishing. | None | DF12 | Keep the app registration tightly scoped and validate redirect URIs server-side. | Open |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | The provider is the trust anchor for the flow. |
| Tampering | The provider signs tokens. |

## FirebaseAuth

**Trust Boundary:** ExternalServices
**Role:** Authentication provider for Firebase sessions and custom tokens.
**Data Flows:** DF06, DF13, DF14
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T19.1 | Information Disclosure | A misconfigured custom-token flow could expose auth metadata to an attacker who manipulates the callback response. | None | DF13 | Keep the custom-token exchange server-side and verify the state and token chain. | Open |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | Firebase Auth is the trusted identity service. |
| Tampering | Tokens are signed. |

## GoogleSecretManager

**Trust Boundary:** ExternalServices
**Role:** Secrets storage used by backend services.
**Data Flows:** DF21
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T20.1 | Information Disclosure | If the service account lacks least-privilege access, Secret Manager reads could expose sensitive values beyond the intended workload. | Admin Credentials | DF21 | Keep IAM bindings least-privileged and review them regularly. | Open |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | The service account is the trust anchor. |
| Tampering | Secret values are protected by GCP IAM. |

## CloudBuildCloudRun

**Trust Boundary:** CICD
**Role:** Pipeline and deployment definitions for the frontend and backend services.
**Data Flows:** DF22, DF23
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 1 threats identified.* |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 2 threats identified.* |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|------------|------------|--------|
| T21.1 | Elevation of Privilege | Build definitions could deploy services with broader privileges than intended if env vars or secrets change. | Admin Credentials | DF23 | Review deployment settings in CI and enforce change review. | Open |
| T21.2 | Information Disclosure | Build outputs and logs could expose environment values or identifiers if secrets are emitted. | Admin Credentials | DF22 | Keep logging sanitized and prevent secret echoing. | Open |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Denial of Service | CI/CD is not the primary public DoS vector. |
| Abuse | Deployment automation is not a business workflow. |
