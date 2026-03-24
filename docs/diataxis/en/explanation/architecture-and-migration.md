# Explanation: Architecture and Migration Context

This page explains why NoteConnection shifted to a Tauri-first architecture and how migration decisions were made.

## Why Tauri-First

- Better runtime control for sidecar orchestration.
- Cleaner single-window behavior between Tauri and Godot.
- More explicit contract boundaries for desktop/mobile runtime capability differences.

## Why Diataxis for Docs

- Existing docs grew rapidly across releases and mixed intent types.
- Diataxis separates:
  - learning flow (`tutorials`)
  - task execution (`how-to`)
  - canonical contracts (`reference`)
  - architecture rationale (`explanation`)
- This reduces duplication and improves maintenance reliability.

## Canonical Explanation Sources

- [docs/en/tauri_brainstorming.md](../../../en/tauri_brainstorming.md)
- [docs/en/electron_migration_analysis.md](../../../en/electron_migration_analysis.md)
