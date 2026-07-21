# STRIDE + Abuse Cases — Threat Analysis

> This analysis uses the standard STRIDE methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) extended with Abuse Cases (business logic abuse, workflow manipulation, feature misuse). The "A" column below represents Abuse.

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
| BridgePortalFrontend | [Link](#bridgeportalfrontend) | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 6 | 2 | 4 | 0 | High |
| BridgePortalApi | [Link](#bridgeportalapi) | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 7 | 2 | 5 | 0 | High |
| FirestoreDatabase | [Link](#firestoredatabase) | 0 | 1 | 0 | 1 | 1 | 1 | 1 | 5 | 1 | 4 | 0 | High |
| AuthContext | [Link](#authcontext) | 1 | 1 | 0 | 1 | 0 | 1 | 1 | 5 | 1 | 4 | 0 | High |
| **Totals** | | **3** | **4** | **1** | **4** | **3** | **4** | **4** | **23** | **6** | **17** | **0** | |

## BridgePortalFrontend

**Trust Boundary:** Application
**Role:** Browser-facing entry point for login, profile, and admin actions.
**Data Flows:** DF01, DF02, DF05, DF07
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T01.1 | Spoofing | Popup-based auth callback could be driven by a hostile window if origin validation is weak. | None | DF02 | Require exact origin enforcement and state matching. | Open |
| T01.2 | Denial of Service | A malicious window can flood the login page with repeated callback messages. | None | DF02 | Ignore unexpected messages and keep the callback flow idempotent. | Open |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|--------|---------------|------------|--------|
| T02.1 | Tampering | Client-side auth state can be manipulated in local storage if a malicious script runs in the origin. | Authenticated User | DF02 | Keep sensitive state in memory and validate it server-side. | Open |
| T02.2 | Information Disclosure | Browser-visible auth configuration can expose identity metadata to a hostile script. | Authenticated User | DF05 | Minimize exposed environment data and avoid client-side trust decisions. | Open |
| T02.3 | Elevation of Privilege | A user could attempt to exploit the admin login path by manipulating URL parameters. | Privileged User | DF07 | Validate access mode server-side and require real admin identity. | Open |
| T02.4 | Abuse | The UI may allow a user to trigger repeated admin or search actions beyond intended cadence. | Authenticated User | DF05 | Enforce server-side rate limits and request validation. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Repudiation | The browser UI does not itself provide durable non-repudiation controls for these actions. |

## BridgePortalApi

**Trust Boundary:** Application
**Role:** Backend service that validates identity, serves profile/contract APIs, and persists data.
**Data Flows:** DF05, DF06, DF08
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T03.1 | Spoofing | A bearer token can be replayed if the API accepts weak or unvalidated JWTs. | None | DF05 | Validate issuer, audience, and signature on every request. | Open |
| T03.2 | Denial of Service | The API has bulk import and purge operations that can be abused to exhaust Firestore capacity. | None | DF05 | Enforce size limits, rate limits, and confirmation tokens. | Open |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|--------|---------------|------------|--------|
| T04.1 | Tampering | A client might alter role or identity fields through self-service profile requests. | Authenticated User | DF05 | Strictly sanitize profile updates and preserve server-controlled values. | Open |
| T04.2 | Repudiation | Admin actions may lack sufficient audit detail if the write path fails. | Privileged User | DF06 | Persist structured audit entries for every privileged action. | Open |
| T04.3 | Information Disclosure | Search logs or user data could leak if Firestore rules are overly permissive. | Authenticated User | DF06 | Require authenticated, role-based access for sensitive reads. | Open |
| T04.4 | Elevation of Privilege | A user may attempt to exploit role updates or admin routes if the middleware is bypassed. | Privileged User | DF05 | Recheck server-side authorization for every privileged route. | Open |
| T04.5 | Abuse | Contract imports can be used to create collisions or duplicate writes. | Authenticated User | DF05 | Normalize document ids and reject malformed payloads. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| None | All core STRIDE categories have at least one threat in this component. |

## FirestoreDatabase

**Trust Boundary:** DataStorage
**Role:** Persistent datastore for profile, contract, audit, and search data.
**Data Flows:** DF06
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T05.1 | Information Disclosure | A weak or partially deployed ruleset can expose user profiles to unauthenticated readers. | None | DF06 | Deploy the hardened Firestore rules and keep the default deny as the final safety net. | Open |
| T05.2 | Denial of Service | Large or repeated reads can exhaust query budgets if rules permit broad listings. | None | DF06 | Limit list operations and require authenticated access. | Open |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|--------|---------------|------------|--------|
| T06.1 | Tampering | A compromised client could write malformed or unauthorized document data if rules are weak. | Authenticated User | DF06 | Enforce allowlists and strict field validation in rules. | Open |
| T06.2 | Elevation of Privilege | A user might exploit a role-based rule gap to gain access to admin-only records. | Privileged User | DF06 | Require role checks and owner/admin conditions. | Open |
| T06.3 | Abuse | Bulk queries could be used to enumerate sensitive data at scale. | Authenticated User | DF06 | Remove broad list access and require explicit authorization. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Spoofing | Spoofing is not a primary concern for the datastore itself because authentication occurs at the API boundary. |
| Repudiation | Repudiation is handled by the application-side audit logging. |

## AuthContext

**Trust Boundary:** Application
**Role:** Browser-side auth orchestration that handles PKCE state and callback exchange.
**Data Flows:** DF02, DF03, DF04, DF05
**Pod Co-location:** N/A

### STRIDE-A Analysis

#### Tier 1 — Direct Exposure (No Prerequisites)

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| T07.1 | Spoofing | A hostile origin or popup could complete the callback without a valid state parameter. | None | DF03 | Bind the state to the starter request and validate it before token exchange. | Open |

#### Tier 2 — Conditional Risk

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|--------|---------------|------------|--------|
| T08.1 | Tampering | Browser state can be modified by a malicious script running on the same origin. | Authenticated User | DF02 | Keep PKCE verifier and state in memory or use server-side state storage. | Open |
| T08.2 | Information Disclosure | The auth flow can leak identity and email claims to the browser environment. | Authenticated User | DF03 | Avoid excessive client-side trust and move sensitive decisions server-side. | Open |
| T08.3 | Elevation of Privilege | A compromised client could try to mint a privileged profile by sending unsafe fields to the profile endpoint. | Privileged User | DF05 | Enforce strict server-side profile sanitization. | Open |
| T08.4 | Abuse | The auth flow could be abused to create repeated login attempts and lockout bypasses. | Authenticated User | DF03 | Use robust rate limiting and server-side challenge validation. | Open |

#### Tier 3 — Defense-in-Depth

| ID | Category | Threat | Prerequisites | Affected Flow | Mitigation | Status |
|----|----------|--------|---------------|---------------|------------|--------|
| *No Tier 3 threats identified.* |

#### Categories Not Applicable

| Category | Justification |
|----------|---------------|
| Repudiation | Browser-side auth state does not itself provide durable evidence of user actions. |
