# NoteConnection Fixrisk TODO (Live Status)

Last updated: 2026-03-13

## Scope
This document tracks only real, currently verifiable risks. Items are marked `Closed` only when backed by code + contract tests (or an explicit operational gate).

## Issues (Live)
| ID | Issue | Severity | Status | Evidence |
| :-- | :-- | :-- | :-- | :-- |
| FR-001 | HTTP request-body memory risk under large payloads | Critical | Closed | `src/server.ts` uses bounded body policy + spool-to-disk flow. |
| FR-002 | Sidecar packager conflict (`pkg` + `@yao-pkg/pkg`) | Critical | Closed | Fixed to `@yao-pkg/pkg` 6.14.1. |
| FR-003 | Capacitor sidecar loopback binding was implicit | High | Closed | Explicit loopback policy in `capacitor.config.ts`. |
| FR-004 | Runtime eval/new Function snapshot/CSP risk | Critical | Closed | Contract gate enforces no dynamic eval fallback. |
| FR-005 | Hard-coded 12GB startup heap | High | Closed | Startup uses adaptive memory policy. |
| FR-006 | No enforceable signed-sidecar gate policy | Medium | Closed | Contract wiring in workflows. |
| FR-007 | Canvas graph semantics inaccessible to assistive tech | Critical | Closed | Accessibility contract in migration gate set. |
| FR-008 | Privacy manifest compliance gate missing | Critical | Closed | iOS privacy manifest active. |
| FR-009 | Physical-device evidence not explicitly tied to large-graph | High | Closed | Strict verifier controls enforce constraints. |
| FR-010 | Node 20 deprecation in GitHub Actions | Medium | Closed | Updated to Node 24. |
| FR-011 | Android/Tauri toolchain feasibility drift | High | Closed | Java 21 enforcement. |
| FR-012 | App Store rejection risk (missing tracking usage description) | High | Closed | `ios/App/Info.plist` now includes `NSUserTrackingUsageDescription`; verifier + contract enforce it (`scripts/verify-privacy-manifest.js`, `src/privacy.manifest.contract.test.ts`). |
| FR-013 | Unbound localhost server port fallback | Medium | Closed | Ephemeral fallback requires explicit opt-in (`NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK=1`) and is contract-tested (`src/server.ts`, `src/server.port.fallback.contract.test.ts`). |

## Next Steps
- Continue deferred hardening items outside fixrisk critical scope.
