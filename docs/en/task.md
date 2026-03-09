# 2026-03-04 v1.5.13 - Tauri Migration Task Consolidation

## English Document

### Priority Task Snapshot

- [x] Bridge-first migration baseline is active (`Tauri + Node sidecar + Godot Path Mode`).
- [x] Runtime path adaptation has been integrated for sidecar and frontend data roots.
- [x] Worker runtime resolution has been stabilized for packaged sidecar scenarios.
- [ ] Existing-cache prompt parity in Tauri load flow needs final strict regression confirmation.
- [ ] Duplicate load execution guard needs final verification across startup/reconnect scenarios.
- [ ] Godot history tracking for center-switch actions needs final acceptance checks.
- [ ] Final Electron decommission readiness checklist remains pending.

### Current Acceptance Targets

1. Exactly one prompt for cache decision when cache exists.
2. Exactly one load/build/restore execution per user-triggered load.
3. Stable websocket lifecycle without startup churn side effects.
4. History panel records central-node switches from Godot interactions.
5. Tauri desktop + Android path documented with Capacitor coexistence strategy.

