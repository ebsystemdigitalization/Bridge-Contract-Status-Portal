# Executive Assessment

## Scope

This assessment covers the current Bridge Portal repository state as of 2026-08-07 and is based on the implementation present in the React frontend, Express backend, Firestore rules, and deployment configuration files.

## Executive Summary

Bridge Portal has a reasonably structured authentication and authorization architecture, but the current implementation still contains several high-impact security weaknesses around authentication flows, public API exposure, and Firestore client-side authorization. The most significant issues are:

- Account enumeration and callback validation weaknesses in the ADB2C auth flow.
- Public API and browser hardening gaps that increase the impact of unauthenticated probing and script injection.
- Firestore rules that still allow self-service status changes and direct client access paths that can bypass the intended backend-only controls.
- Insufficient per-user throttling on contract search and broad admin export behavior.

## Assessment Outcome

The current implementation should be treated as a medium-risk application for the purposes of a fresh threat-model review. It is not yet at the level of a hardened Zero Trust deployment, because it still relies on a hybrid model where the browser can interact with Firestore and the backend depends on internal middleware plus public API exposure. The highest priority remediation work is to harden the auth callback flow, close direct client access paths to sensitive data, and tighten role- and content-based access controls.

## Priority Recommendations

1. Fix the auth callback and resolve-login flow so that redirects are server-validated and responses do not leak account state.
2. Tighten Firestore Security Rules so that users cannot self-assign or self-promote approval state and cannot directly read contract data.
3. Add per-user throttling and per-route limits to the public login, search, and import endpoints.
4. Strengthen browser and edge hardening with CSP, proxy timeouts, and consistent error handling.
5. Review Cloud Run service-account and deployment settings to reduce privilege creep and secret exposure risk.

## Threat Model Confidence

The assessment is based on repository evidence and the current deployment model. Confidence is medium because the source code clearly shows the intended architecture, but the actual deployed IAM bindings and Cloud Run configuration cannot be fully validated from source without runtime inspection.
