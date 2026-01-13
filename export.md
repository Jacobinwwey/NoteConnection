# Release Strategy: Standalone NoteConnection Application

## Goal

Distribute the NoteConnection application as a standalone, installable desktop package (Windows .exe/.msi) with a dedicated UI via Electron.

## Architecture: Electron Integration

We will use **Electron** to wrap the current Node.js backend and Vanilla JS frontend.

- **Backend (Main Process):** The existing `server.ts` will be integrated into the Electron Main process.
- **Frontend (Renderer Process):** The Electron window will load the application from the local server.

## Key Features & Modifications

### 1. "Open Vault" Functionality

- **Change:** Refactor `server.ts` to accept a dynamic root path instead of locking to `process.cwd()/Knowledge_Base`.
- **UI:** The Electron app will launch with a "Welcome" screen allowing the user to "Open Folder".

### 2. Standalone UI Enhancements

- **Native Menus:** Standard File/Edit/View menus.
- **Window Management:** Persist window state.

### 3. GPU & Performance Preservation

- **GPU:** Uses Chromium's native GPU stack.
- **Workers:** Node.js worker threads continue to function in the backend process.

## Implementation Steps

### Phase 1: Preparation (Refactoring)

1.  **Refactor `server.ts`:** Export a `createAppServer` function.
2.  **Clean Dependencies:** Ensure proper separation for packing.

### Phase 2: Electron Setup

1.  **Install:** `electron`, `electron-builder`.
2.  **`electron/main.ts`:** Main process entry point to spawn server and window.

### Phase 3: Packaging

1.  **Config:** `electron-builder.yml` for NSIS (Windows) installer.
2.  **Build:** Generate `.exe`.

## Verification

- **Install Test:** Clean install in sandbox.
- **Feature Check:** Verify Graph, GPU, and File IO.
