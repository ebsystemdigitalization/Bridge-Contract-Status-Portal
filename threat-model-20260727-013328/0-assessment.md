# Security Assessment

---

## Report Files

| File | Description |
|------|-------------|
| [0-assessment.md](0-assessment.md) | This document - executive summary, risk rating, action plan, metadata |
| [0.1-architecture.md](0.1-architecture.md) | Architecture overview, components, scenarios, tech stack |
| [1-threatmodel.md](1-threatmodel.md) | Threat model DFD diagram with element, flow, and boundary tables |
| [1.1-threatmodel.mmd](1.1-threatmodel.mmd) | Pure Mermaid DFD source file |
| [2-stride-analysis.md](2-stride-analysis.md) | Full STRIDE-A analysis for all components |
| [3-findings.md](3-findings.md) | Prioritized security findings with remediation |

---

## Executive Summary

This fresh STRIDE assessment reflects the current architecture where the React frontend no longer performs business Firestore operations directly and the Express backend API is the primary enforcement point. That shift materially improves the design: authentication and authorization are centralized in backend middleware, admin operations use explicit role gates, and contract import includes validation, deduplication, batching, rate limiting, audit logging, and destructive-operation confirmation.

The main residual risk is that Firestore Security Rules still expose some direct-client paths that do not fully match the backend-only intent. In particular, the self-profile update rule permits users to modify their own `status`, which can bypass the administrative approval workflow if a user calls Firestore directly with their Firebase credentials.

The analysis covers 17 system elements across 5 trust boundaries.

### Risk Rating: Elevated

The system has a stronger architecture than a direct-client Firestore application, but the Firestore rule mismatch creates a high-impact authenticated-user access-control issue. Several Tier 1 findings are public hardening issues around auth helper enumeration, OAuth callback validation, error handling, and request limits; these are narrower than direct database exposure but should be remediated before broad production use.

> **Note on threat counts:** This analysis identified 35 threats across 15 components. This count reflects comprehensive STRIDE-A coverage, not systemic insecurity. Of these, **11 are directly exploitable** without prerequisites (Tier 1). The remaining 24 represent conditional risks and defense-in-depth considerations.

---

## Action Summary

| Tier | Description | Threats | Findings | Priority |
|------|-------------|---------|----------|----------|
| [Tier 1](3-findings.md#tier-1---direct-exposure-no-prerequisites) | Directly exploitable | 11 | 5 | 🔴 Critical Risk |
| [Tier 2](3-findings.md#tier-2---conditional-risk-authenticated--single-prerequisite) | Requires authenticated access | 15 | 7 | 🟠 Elevated Risk |
| [Tier 3](3-findings.md#tier-3---defense-in-depth-prior-compromise--host-access) | Requires prior compromise | 9 | 4 | 🟡 Moderate Risk |
| **Total** | | **35** | **16** | |

### Priority by Tier and CVSS Score (Top 10)

| Finding | Tier | CVSS Score | SDL Severity | Title |
|---------|------|------------|-------------|-------|
| [FIND-02](3-findings.md#find-02-adb2c-callback-trusts-client-supplied-redirect-uri) | T1 | 7.1 | Important | ADB2C Callback Trusts Client-Supplied Redirect URI |
| [FIND-01](3-findings.md#find-01-public-login-resolution-enables-account-enumeration) | T1 | 6.9 | Important | Public Login Resolution Enables Account Enumeration |
| [FIND-04](3-findings.md#find-04-global-json-and-proxy-limits-are-too-broad-for-public-api-paths) | T1 | 6.5 | Moderate | Global JSON and Proxy Limits Are Too Broad for Public API Paths |
| [FIND-03](3-findings.md#find-03-public-error-and-browser-hardening-gaps-increase-token-exposure-impact) | T1 | 6.4 | Moderate | Public Error and Browser Hardening Gaps Increase Token Exposure Impact |
| [FIND-05](3-findings.md#find-05-adb2c-public-metadata-is-embedded-in-build-configuration) | T1 | 3.7 | Low | ADB2C Public Metadata Is Embedded in Build Configuration |
| [FIND-06](3-findings.md#find-06-firestore-rules-let-users-promote-their-own-approval-status) | T2 | 8.7 | Critical | Firestore Rules Let Users Promote Their Own Approval Status |
| [FIND-08](3-findings.md#find-08-contract-search-lacks-per-user-rate-limiting) | T2 | 7.3 | Important | Contract Search Lacks Per-User Rate Limiting |
| [FIND-07](3-findings.md#find-07-direct-firestore-contract-reads-remain-available-to-active-users) | T2 | 7.0 | Important | Direct Firestore Contract Reads Remain Available to Active Users |
| [FIND-09](3-findings.md#find-09-bulk-import-allows-large-privileged-resource-consumption) | T2 | 6.8 | Important | Bulk Import Allows Large Privileged Resource Consumption |
| [FIND-10](3-findings.md#find-10-admin-search-log-export-exposes-high-volume-user-activity-data) | T2 | 5.9 | Moderate | Admin Search Log Export Exposes High-Volume User Activity Data |

### Quick Wins

| Finding | Title | Why Quick |
|---------|-------|-----------|
| [FIND-06](3-findings.md#find-06-firestore-rules-let-users-promote-their-own-approval-status) | Firestore Rules Let Users Promote Their Own Approval Status | Remove `status` from one self-update allow-list. |
| [FIND-02](3-findings.md#find-02-adb2c-callback-trusts-client-supplied-redirect-uri) | ADB2C Callback Trusts Client-Supplied Redirect URI | Add backend redirect URI allow-list validation. |
| [FIND-01](3-findings.md#find-01-public-login-resolution-enables-account-enumeration) | Public Login Resolution Enables Account Enumeration | Add throttling and indistinguishable responses. |
| [FIND-03](3-findings.md#find-03-public-error-and-browser-hardening-gaps-increase-token-exposure-impact) | Public Error and Browser Hardening Gaps Increase Token Exposure Impact | Replace client error detail and add CSP. |
| [FIND-10](3-findings.md#find-10-admin-search-log-export-exposes-high-volume-user-activity-data) | Admin Search Log Export Exposes High-Volume User Activity Data | Require superadmin for `all=true` export. |

---

## Analysis Context & Assumptions

### Analysis Scope

| Constraint | Description |
|------------|-------------|
| Scope | Entire current repository except `.git`, `node_modules`, `dist`, and prior `threat-model-*` outputs. |
| Excluded | Live GCP IAM bindings, deployed Cloud Run runtime settings not present in YAML, live ADB2C policy settings, live Firebase project settings. |
| Focus Areas | Backend API enforcement, ADB2C PKCE code exchange, Firebase custom tokens, Firestore Rules, admin/import flows, Cloud Run deployment. |

### Infrastructure Context

| Category | Discovered from Codebase | Findings Affected |
|----------|--------------------------|-------------------|
| Deployment | `cloudbuild.backend.yaml` and `cloudbuild.frontend.yaml` deploy public Cloud Run services with `--allow-unauthenticated`. | FIND-01, FIND-02, FIND-03, FIND-04 |
| Authentication | `backend/src/routes/auth.ts`, `backend/src/middleware/auth.ts`, `src/context/AuthContext.tsx` implement ADB2C code exchange and Firebase custom-token sign-in. | FIND-02, FIND-11, FIND-13 |
| Authorization | `requireAdmin` and `requireSuperAdmin` in `backend/src/middleware/auth.ts`; admin and contract routes apply them. | FIND-09, FIND-10, FIND-11 |
| Firestore Policy | `firestore.rules` uses default deny, helpers, role checks, validation, and limited list queries. | FIND-06, FIND-07, FIND-12 |
| Container/CI | `Dockerfile.frontend`, `backend/Dockerfile`, and Cloud Build YAML define image and deployment flow. | FIND-05, FIND-15 |
| Secrets | `backend/src/services/secretManager.ts`, `backend/src/services/excelCrypto.ts`, and `cloudbuild.backend.yaml` use Secret Manager. | FIND-14, FIND-16 |

### Needs Verification

| Item | Question | What to Check | Why Uncertain |
|------|----------|---------------|---------------|
| GCP IAM | Is the backend Cloud Run service account least-privileged for only required Firestore and Secret Manager actions? | Inspect IAM roles for `bridge-portal-api@$PROJECT_ID.iam.gserviceaccount.com`. | IAM policy is not stored in this repository. |
| Firestore Rules Tests | Are emulator tests covering direct-client denial for self-status and contract reads? | Run or add Firebase Rules emulator tests. | No rules test suite was found in the codebase. |
| ADB2C App Registration | Are only exact production/staging redirect URIs registered? | Inspect Azure AD B2C app registration. | Live identity-provider configuration is external. |
| Cloud Run Limits | Are max instances, concurrency, ingress, timeout, and request-size protections set outside YAML? | Inspect deployed Cloud Run service config. | The YAML does not include all runtime controls. |

### Finding Overrides

| Finding ID | Original Severity | Override | Justification | New Status |
|------------|-------------------|----------|---------------|------------|
| - | - | - | No overrides applied. Update this section after review. | - |

### Additional Notes

The prior report was not used as a baseline; this is a new standalone assessment. The current architecture explicitly improves security posture by moving Firestore business operations behind Express APIs, but Firestore Rules remain security-critical because any Firebase-authenticated client can attempt direct Firestore access outside the shipped UI.

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
| Express | https://expressjs.com/en/4x/api.html | Middleware, routing, JSON body parsing |
| Firebase Admin Auth | https://firebase.google.com/docs/auth/admin/verify-id-tokens | ID token verification and custom tokens |
| Firestore Security Rules | https://firebase.google.com/docs/firestore/security/rules-structure | Rule structure and access control |
| Azure AD B2C OAuth2 | https://learn.microsoft.com/en-us/azure/active-directory-b2c/authorization-code-flow | Authorization code flow with PKCE |
| Google Cloud Run | https://cloud.google.com/run/docs | Cloud Run deployment and service identity |
| Google Secret Manager | https://cloud.google.com/secret-manager/docs | Secret retrieval and IAM model |

---

## Report Metadata

| Field | Value |
|-------|-------|
| Source Location | `C:\Users\202059\Projects\Bridge Portal` |
| Git Repository | `https://github.com/ebsystemdigitalization/Bridge-Contract-Status-Portal.git` |
| Git Branch | `main` |
| Git Commit | `003781f` (`2026-07-24 10:45:37 +0800`) |
| Model | `GPT-5 Codex` |
| Machine Name | `L-DNB05440` |
| Analysis Started | `2026-07-27 01:33:28 UTC` |
| Analysis Completed | `2026-07-27 01:45:56 UTC` |
| Duration | `12 minutes 28 seconds` |
| Output Folder | `threat-model-20260727-013328` |
| Prompt | `Run the STRIDE threat-model-analyst analysis again using the skills/threat-model-analyst folder against the entire current codebase. Treat this as a completely new assessment rather than updating the previous report.` |

---

## Classification Reference

| Classification | Values |
|---------------|--------|
| **Exploitability Tiers** | **T1** Direct Exposure (no prerequisites) - **T2** Conditional Risk (single prerequisite) - **T3** Defense-in-Depth (multiple prerequisites or infrastructure access) |
| **STRIDE + Abuse** | **S** Spoofing - **T** Tampering - **R** Repudiation - **I** Information Disclosure - **D** Denial of Service - **E** Elevation of Privilege - **A** Abuse (feature misuse) |
| **SDL Severity** | `Critical` - `Important` - `Moderate` - `Low` |
| **Remediation Effort** | `Low` - `Medium` - `High` |
| **Mitigation Type** | `Redesign` - `Standard Mitigation` - `Custom Mitigation` - `Existing Control` - `Accept Risk` - `Transfer Risk` |
| **Threat Status** | `Open` - `Mitigated` - `Platform` |
| **Incremental Tags** | `[Existing]` - `[Fixed]` - `[Partial]` - `[New]` - `[Removed]` (incremental reports only) |
| **CVSS** | CVSS 4.0 vector with `CVSS:4.0/` prefix |
| **CWE** | Hyperlinked CWE ID (e.g., [CWE-306](https://cwe.mitre.org/data/definitions/306.html)) |
| **OWASP** | OWASP Top 10:2025 mapping (e.g., A01:2025 - Broken Access Control) |
