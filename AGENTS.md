# Repository Guidelines

## Project Structure & Module Organization

- `src/`: TypeScript backend + graph/layout core. Main entry points are `src/server.ts` (CLI + HTTP server) and `src/index.ts` (graph build APIs).
- `src/frontend/`: Static UI (HTML/CSS/vanilla JS). Includes optional large demo assets like `data.js` and `graph_data.json` (excluded in “mini” builds).
- `src-tauri/`: Tauri (Rust) desktop shell. Configuration lives in `src-tauri/tauri.conf.json`; sidecar binaries live in `src-tauri/bin/`.
- `scripts/`: Build helpers (asset copying, path-core bundling, smoke tests).
- `android/`: Capacitor Android project (APK build output is under `android/app/build/…`).
- `dist/`: Generated build output from `tsc` and asset bundling (do not edit by hand).

## Build, Test, and Development Commands

This repo is Node/TypeScript-first (CI uses Node.js 20).

```bash
npm install            # install dependencies
npm start              # dev server at http://localhost:3000
npm run build          # tsc -> dist/ + copy/bundle frontend assets
npm test               # jest (ts-jest)

npm run electron:dev   # Electron desktop dev
npm run electron:build # Electron installer build (uses electron-builder)

npm run tauri:dev      # Tauri dev (runs build + sidecar build)
npm run tauri:build    # Tauri bundle build
npm run build:sidecar  # pkg -> src-tauri/bin/server-…exe
```

Android (Windows): run `build_apk.bat` (requires Node.js, Java JDK 17+, and Android SDK).

## Coding Style & Naming Conventions

- TypeScript `strict` is enabled (`tsconfig.json`); keep public APIs typed and avoid `any` unless unavoidable.
- Naming pattern: `PascalCase.ts` with a matching `PascalCase.test.ts` for unit tests.
- Indentation varies across the repo (both 2- and 4-space files exist); match the surrounding file and keep formatting consistent within a file.

## Testing Guidelines

- Framework: Jest with `ts-jest` (`jest.config.js`).
- Tests are colocated under `src/**` and can be run with `npm test`.
- When changing graph/layout algorithms, add or update regression tests in the same module directory.

## Commit & Pull Request Guidelines

- Follow the existing Conventional Commit style: `feat: …`, `fix: …`, `docs: …` (optional scope like `fix(renderer): …`).
- PRs should include: what changed, why, how to test locally, and screenshots for UI changes.
- Release tags `vX.Y.Z` must match `package.json`’s version (CI enforces this).

