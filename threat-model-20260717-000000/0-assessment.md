# Security Assessment

---

## Report Files

| File | Description |
|------|-------------|
| [0-assessment.md](0-assessment.md) | This document — executive summary, risk rating, action plan, metadata |
| [0.1-architecture.md](0.1-architecture.md) | Architecture overview, components, scenarios, tech stack |
| [1-threatmodel.md](1-threatmodel.md) | Threat model DFD diagram with element, flow, and boundary tables |
| [1.1-threatmodel.mmd](1.1-threatmodel.mmd) | Pure Mermaid DFD source file |
| [2-stride-analysis.md](2-stride-analysis.md) | Full STRIDE-A analysis for all components |
| [3-findings.md](3-findings.md) | Prioritized security findings with remediation |

---

## Executive Summary

Bridge Portal is a staff-facing web application that combines a React front end, an Express API, Firebase Authentication, and Firestore persistence. The current implementation provides a usable login and contract-management workflow, but the security posture remains mixed because the browser still participates directly in authentication and the authorization boundary relies on both frontend and backend trust decisions.

The analysis covers 8 system elements across 3 trust boundaries. The most significant risks are in the authentication callback flow, the self-service profile path, and the Firestore access boundary, because these areas control trust and authorization for the rest of the system.

### Risk Rating: Elevated

The security posture is elevated risk because the system combines browser-driven auth with remote data access and because the deployment depends on both the backend and Firebase rules being configured correctly. The most urgent issues are the callback state binding, the need to deploy the hardened Firestore rules, and the need to preserve server-controlled role and identity values.

> **Note on threat counts:** This analysis identified 23 threats across 4 components. This count reflects comprehensive STRIDE-A coverage, not systemic insecurity. Of these, **6 are directly exploitable** without prerequisites (Tier 1). The remaining 17 represent conditional risks and defense-in-depth considerations.

---

## Action Summary

| Tier | Description | Threats | Findings | Priority |
|------|-------------|---------|----------|----------|
| [Tier 1](3-findings.md#tier-1--direct-exposure-no-prerequisites) | Directly exploitable | 6 | 2 | 🔴 Critical Risk |
| [Tier 2](3-findings.md#tier-2--conditional-risk-authenticated--single-prerequisite) | Requires authenticated access | 17 | 3 | 🟠 Elevated Risk |
| [Tier 3](3-findings.md#tier-3--defense-in-depth-prior-compromise--host-access) | Requires prior compromise | 0 | 1 | 🟡 Moderate Risk |
| **Total** | | **23** | **5** | |

### Priority by Tier and CVSS Score (Top 10)

| Finding | Tier | CVSS Score | SDL Severity | Title |
|---------|------|------------|-------------|-------|
| [FIND-01](3-findings.md#find-01-weak-callback-state-handling-allows-spoofed-auth-completion) | T1 | 8.8 | Important | Weak callback state handling allows spoofed auth completion |
| [FIND-02](3-findings.md#find-02-bulk-contract-operations-are-directly-exploitable-without-a-stronger-confirmation-gate) | T1 | 8.2 | Important | Bulk contract operations are directly exploitable without a stronger confirmation gate |
| [FIND-04](3-findings.md#find-04-firestore-rules-must-remain-deployed-to-prevent-unauthorized-reads-and-writes) | T2 | 7.5 | Important | Firestore rules must remain deployed to prevent unauthorized reads and writes |
| [FIND-03](3-findings.md#find-03-client-controlled-profile-fields-can-tamper-with-trusted-identity-data) | T2 | 6.9 | Moderate | Client-controlled profile fields can tamper with trusted identity data |
| [FIND-05](3-findings.md#find-05-browser-side-auth-state-and-pkce-material-remain-a-high-value-target-for-compromised-clients) | T3 | 5.9 | Moderate | Browser-side auth state and PKCE material remain a high-value target for compromised clients |

### Quick Wins

| Finding | Title | Why Quick |
|---------|-------|-----------|
| [FIND-01](3-findings.md#find-01-weak-callback-state-handling-allows-spoofed-auth-completion) | Callback state binding | The fix is a small change to the auth flow and blocks a high-impact spoofing path. |
| [FIND-02](3-findings.md#find-02-bulk-contract-operations-are-directly-exploitable-without-a-stronger-confirmation-gate) | Stronger confirmation and rate limiting | The endpoint already has a route boundary, so the change is localized and low risk. |
| [FIND-04](3-findings.md#find-04-firestore-rules-must-remain-deployed-to-prevent-unauthorized-reads-and-writes) | Deploy Firestore rules | This is a deployment step that closes a major access-control gap. |

---

## Analysis Context & Assumptions

### Analysis Scope
| Constraint | Description |
|------------|-------------|
| Scope | Review of the current React frontend, Express backend, Firestore rules, and auth flow implementation. |
| Excluded | External deployment environment, production secrets, and live Firebase project state. |
| Focus Areas | Auth flow, profile updates, Firestore authorization, and contract operations. |

### Infrastructure Context
| Category | Discovered from Codebase | Findings Affected |
|----------|--------------------------|-------------------|
| Identity Provider | [src/context/AuthContext.tsx](src/context/AuthContext.tsx), [backend/src/middleware/auth.ts](backend/src/middleware/auth.ts) | FIND-01, FIND-03, FIND-05 |
| Firestore Rules | [firestore.rules](firestore.rules) | FIND-04 |
| API Rate Limiting | [backend/src/middleware/rateLimit.ts](backend/src/middleware/rateLimit.ts) | FIND-02 |

### Needs Verification
| Item | Question | What to Check | Why Uncertain |
|------|----------|---------------|---------------|
| Deployment of Firestore rules | Are the hardened rules actually active in the Firebase project? | Check Firebase Console or deploy the ruleset. | The local repo contains the updated rules, but deployment status was not verified here. |
| Production auth config | Are issuer, audience, and redirect URIs configured correctly in the live environment? | Review runtime environment variables and identity provider settings. | This analysis is based on the local code and configuration patterns. |

### Finding Overrides
| Finding ID | Original Severity | Override | Justification | New Status |
|------------|-------------------|----------|---------------|------------|
| — | — | — | No overrides applied. Update this section after review. | — |

### Additional Notes

No additional notes.

---

## References Consulted

### Security Standards
| Standard | URL | How Used |
|----------|-----|----------|
| Microsoft SDL Bug Bar | https://www.microsoft.com/en-us/msrc/sdlbugbar | Severity classification |
| OWASP Top 10:2025 | https://owasp.org/Top10/2025/ | Threat categorization |
| CVSS 4.0 | https://www.first.org/cvss/v4.0/specification-document | Risk scoring |
| CWE | https://cwe.mitre.org/ | Weakness classification |
| STRIDE | https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats | Threat enumeration |

### Component Documentation
| Component | Documentation URL | Relevant Section |
|-----------|------------------|------------------|
| React | https://react.dev/ | Frontend architecture |
| Express | https://expressjs.com/ | Backend routing and middleware |
| Firestore | https://firebase.google.com/docs/firestore | Data access model |

---

## Report Metadata

| Field | Value |
|-------|-------|
| Source Location | `c:\Users\202059\Projects\Bridge Portal` |
| Git Repository | `Bridge Portal` |
| Git Branch | `unknown` |
| Git Commit | `unknown` (`unknown`) |
| Model | `MAI-Code-1-Flash` |
| Machine Name | `L-DNB05440` |
| Analysis Started | `2026-07-17 00:00:00` |
| Analysis Completed | `2026-07-17 00:00:00` |
| Duration | `N/A` |
| Output Folder | `threat-model-20260717-000000` |
| Prompt | `Run the STRIDE threat-model-analyst analysis from skills folder against the whole coding again` |

---

## Classification Reference

| Classification | Values |
|---------------|--------|
| **Exploitability Tiers** | **T1** Direct Exposure (no prerequisites) · **T2** Conditional Risk (single prerequisite) · **T3** Defense-in-Depth (multiple prerequisites or infrastructure access) |
| **STRIDE + Abuse** | **S** Spoofing · **T** Tampering · **R** Repudiation · **I** Information Disclosure · **D** Denial of Service · **E** Elevation of Privilege · **A** Abuse (feature misuse) |
| **SDL Severity** | `Critical` · `Important` · `Moderate` · `Low` |
| **Remediation Effort** | `Low` · `Medium` · `High` |
| **Mitigation Type** | `Redesign` · `Standard Mitigation` · `Custom Mitigation` · `Existing Control` · `Accept Risk` · `Transfer Risk` |
| **Threat Status** | `Open` · `Mitigated` · `Platform` |
| **CVSS** | CVSS 4.0 vector with `CVSS:4.0/` prefix |
| **CWE** | Hyperlinked CWE ID (e.g., [CWE-306](https://cwe.mitre.org/data/definitions/306.html)) |
| **OWASP** | OWASP Top 10:2025 mapping (e.g., A01:2025 – Broken Access Control) |
