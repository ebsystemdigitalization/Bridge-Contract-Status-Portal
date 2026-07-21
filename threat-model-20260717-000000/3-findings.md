# Security Findings

---

## Tier 1 — Direct Exposure (No Prerequisites)

### FIND-01: Weak callback state handling allows spoofed auth completion

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Important |
| CVSS 4.0 | 8.8 (CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:N/SC:H/SI:H/SA:N) |
| CWE | [CWE-287](https://cwe.mitre.org/data/definitions/287.html): Improper Authentication |
| OWASP | A07:2025 – Authentication Failures |
| Exploitation Prerequisites | None |
| Exploitability Tier | Tier 1 — Direct Exposure |
| Remediation Effort | Medium |
| Mitigation Type | Standard Mitigation |
| Component | BridgePortalFrontend |
| Related Threats | [T01.1](2-stride-analysis.md#bridgeportalfrontend), [T07.1](2-stride-analysis.md#authcontext) |

#### Description

The ADB2C callback flow previously depended on weak browser-side state assumptions and could be completed by a hostile window or forged message path. This makes the app vulnerable to authentication spoofing and account take-over attempts if the callback is not strictly bound to the initiating request.

#### Evidence

**Prerequisite basis:** The browser flow accepts OAuth callbacks and posts success or failure messages without a strict nonce/state check at the time of analysis. This aligns with the frontend auth code in [src/context/AuthContext.tsx](src/context/AuthContext.tsx) and [src/pages/Login.tsx](src/pages/Login.tsx).

#### Remediation

Bind the callback to a one-time random state value generated at login initiation, verify it before token exchange, and reject unexpected or replayed callbacks.

#### Verification

Verify the fix by initiating the login flow from a clean browser session and confirming that a callback without the matching state is rejected.

### FIND-02: Bulk contract operations are directly exploitable without a stronger confirmation gate

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Important |
| CVSS 4.0 | 8.2 (CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:N/SC:H/SI:H/SA:N) |
| CWE | [CWE-770](https://cwe.mitre.org/data/definitions/770.html): Allocation of Resources Without Limits or Throttling |
| OWASP | A04:2025 – Secure Design |
| Exploitation Prerequisites | None |
| Exploitability Tier | Tier 1 — Direct Exposure |
| Remediation Effort | Medium |
| Mitigation Type | Standard Mitigation |
| Component | BridgePortalApi |
| Related Threats | [T03.2](2-stride-analysis.md#bridgeportalapi) |

#### Description

The backend exposed bulk import and purge operations that could be abused by unauthenticated or weakly authenticated network clients to consume resources or perform destructive actions. This is a direct exposure issue because the decision to proceed was not strongly gated at the API layer.

#### Evidence

**Prerequisite basis:** The contract routes accepted large payloads and destructive purge requests without a robust server-side confirmation token. See [backend/src/routes/contracts.ts](backend/src/routes/contracts.ts).

#### Remediation

Require the stronger confirmation token, enforce size limits, and add server-side rate limiting plus audit logging for import and purge operations.

#### Verification

Verify by submitting purge requests without the confirmation token and confirming that they are rejected with HTTP 400.

---

## Tier 2 — Conditional Risk (Authenticated / Single Prerequisite)

### FIND-03: Client-controlled profile fields can tamper with trusted identity data

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Moderate |
| CVSS 4.0 | 6.9 (CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:N/SC:H/SI:H/SA:N) |
| CWE | [CWE-306](https://cwe.mitre.org/data/definitions/306.html): Missing Authentication |
| OWASP | A01:2025 – Broken Access Control |
| Exploitation Prerequisites | Authenticated User |
| Exploitability Tier | Tier 2 — Conditional Risk |
| Remediation Effort | Low |
| Mitigation Type | Standard Mitigation |
| Component | BridgePortalApi |
| Related Threats | [T04.1](2-stride-analysis.md#bridgeportalapi), [T08.3](2-stride-analysis.md#authcontext) |

#### Description

The profile update endpoint accepted client-supplied fields that could influence trusted identity and authorization state. Although the backend has been tightened locally, the previous behavior made role and identity manipulation feasible if the API layer was bypassed or misconfigured.

#### Evidence

**Prerequisite basis:** The profile update route previously accepted rich profile payloads and used them to overwrite properties such as role and status in the profile document. See [backend/src/routes/me.ts](backend/src/routes/me.ts).

#### Remediation

Allow only a minimal safe subset of profile fields from the client, preserve server-controlled values, and reject unsupported fields.

#### Verification

Verify by submitting a profile update that includes `role`, `status`, and `adb2cEmail` and confirming that the server ignores or strips them.

### FIND-04: Firestore rules must remain deployed to prevent unauthorized reads and writes

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Important |
| CVSS 4.0 | 7.5 (CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:N/SC:H/SI:H/SA:N) |
| CWE | [CWE-284](https://cwe.mitre.org/data/definitions/284.html): Improper Access Control |
| OWASP | A01:2025 – Broken Access Control |
| Exploitation Prerequisites | Authenticated User |
| Exploitability Tier | Tier 2 — Conditional Risk |
| Remediation Effort | Medium |
| Mitigation Type | Standard Mitigation |
| Component | FirestoreDatabase |
| Related Threats | [T05.1](2-stride-analysis.md#firestoredatabase), [T06.2](2-stride-analysis.md#firestoredatabase) |

#### Description

Firestore access controls are a critical enforcement point for this system. If the updated rules are not deployed to Firebase, the application can still be exposed to broad profile and audit-data read/write paths that bypass the intended server-side trust boundary.

#### Evidence

**Prerequisite basis:** The repo now contains hardened rules in [firestore.rules](firestore.rules), but Firestore rules are only effective after deployment to the Firebase project. The current local application state does not automatically publish them.

#### Remediation

Deploy the updated Firestore rules with `firebase deploy --only firestore:rules` and verify the project-level ruleset in Firebase Console.

#### Verification

Verify by reading the Firebase project rules in the console or by testing read access with a signed-in client that should not be allowed to access protected documents.

---

## Tier 3 — Defense-in-Depth (Prior Compromise / Host Access)

### FIND-05: Browser-side auth state and PKCE material remain a high-value target for compromised clients

| Attribute | Value |
|-----------|-------|
| SDL Bugbar Severity | Moderate |
| CVSS 4.0 | 5.9 (CVSS:4.0/AV:L/AC:L/AT:N/PR:H/UI:N/VC:H/VI:N/VA:N/SC:H/SI:N/SA:N) |
| CWE | [CWE-602](https://cwe.mitre.org/data/definitions/602.html): Client-Side Enforcement of Server-Side Security |
| OWASP | A06:2025 – Vulnerable and Outdated Components |
| Exploitation Prerequisites | Host/OS Access |
| Exploitability Tier | Tier 3 — Defense-in-Depth |
| Remediation Effort | High |
| Mitigation Type | Redesign |
| Component | AuthContext |
| Related Threats | [T08.1](2-stride-analysis.md#authcontext) |

#### Description

The existing auth flow still relies on client-side state and browser storage to coordinate the OAuth exchange. A compromised workstation or malicious browser extension can extract or tamper with this state, undermining the trust boundary that the backend expects.

#### Evidence

**Prerequisite basis:** The current flow stores PKCE material and callback state in browser storage and uses it to drive the token exchange. See [src/context/AuthContext.tsx](src/context/AuthContext.tsx).

#### Remediation

Move the high-risk state handling to a backend-for-frontend pattern or a server-side session store so the browser never acts as the sole trust anchor.

#### Verification

Verify by inspecting the browser state after an auth attempt and ensuring that the server-side session is the authoritative source of truth.

---

## Threat Coverage Verification

| Threat ID | Finding ID | Status |
|-----------|------------|--------|
| T01.1 | FIND-01 | ✅ Covered (FIND-01) |
| T01.2 | FIND-02 | ✅ Covered (FIND-02) |
| T02.1 | FIND-03 | ✅ Covered (FIND-03) |
| T02.2 | FIND-04 | ✅ Covered (FIND-04) |
| T02.3 | FIND-03 | ✅ Covered (FIND-03) |
| T02.4 | FIND-02 | ✅ Covered (FIND-02) |
| T03.1 | FIND-03 | ✅ Covered (FIND-03) |
| T03.2 | FIND-02 | ✅ Covered (FIND-02) |
| T04.1 | FIND-03 | ✅ Covered (FIND-03) |
| T04.2 | FIND-03 | ✅ Covered (FIND-03) |
| T04.3 | FIND-04 | ✅ Covered (FIND-04) |
| T04.4 | FIND-03 | ✅ Covered (FIND-03) |
| T04.5 | FIND-02 | ✅ Covered (FIND-02) |
| T05.1 | FIND-04 | ✅ Covered (FIND-04) |
| T05.2 | FIND-04 | ✅ Covered (FIND-04) |
| T06.1 | FIND-04 | ✅ Covered (FIND-04) |
| T06.2 | FIND-04 | ✅ Covered (FIND-04) |
| T06.3 | FIND-04 | ✅ Covered (FIND-04) |
| T07.1 | FIND-01 | ✅ Covered (FIND-01) |
| T08.1 | FIND-05 | ✅ Covered (FIND-05) |
| T08.2 | FIND-05 | ✅ Covered (FIND-05) |
| T08.3 | FIND-03 | ✅ Covered (FIND-03) |
| T08.4 | FIND-01 | ✅ Covered (FIND-01) |
