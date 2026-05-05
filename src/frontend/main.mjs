/**
 * main.mjs - ES Module entry point for the NoteConnection frontend.
 * Replaces the legacy <script> tag dependency chain with explicit imports.
 *
 * Legacy load order: i18n.js → runtime_bridge.js → workspace_panes.js →
 *   agent_workspace.js → path_app.js → app.js
 *
 * Each module self-registers on window for backward compat, then we load
 * the legacy payload scripts as side-effect imports.
 */

// 1. Foundation modules (ES module versions with window backward compat)
import './i18n.mjs';
import './runtime_bridge.mjs';

// 2. Extracted ES modules (loaded before legacy scripts, register on window.*)
import './path_worker_bridge.mjs';
import './workbench_state.mjs';
import './graph_state.mjs';
import './path_layout.mjs';

// 3. Legacy IIFE modules (loaded as side-effect scripts; these register on window.*)
import './workspace_panes.js';
import './agent_workspace.js';
import './settings.js';
import './source_manager.js';
import './storage_provider.js';

// 3. Web Workers remain as separate files (workers can't be ES modules in all browsers yet).
// simulationWorker.js and path_worker.js are loaded by app.js and path_app.js respectively.

// 4. Large application payloads (loaded as side-effect modules)
import './path_app.js';
import './app.js';
