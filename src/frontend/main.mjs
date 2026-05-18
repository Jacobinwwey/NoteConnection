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

function shouldSkipModuleBootstrap() {
    if (typeof window === 'undefined') {
        return false;
    }

    // Legacy IIFE bootstrap is the active production path on index.html.
    // If it is already present, the module chain must stay dormant to avoid
    // duplicate i18n/runtime/app initialization and graph state races.
    if (window.i18n || window.NoteConnectionRuntime || window.settingsManager) {
        return true;
    }

    const scriptTags = Array.from(document.querySelectorAll('script[src]'));
    return scriptTags.some((tag) => {
        const src = String(tag.getAttribute('src') || '').trim();
        return src.endsWith('i18n.js')
            || src.endsWith('runtime_bridge.js')
            || src.endsWith('source_manager.js');
    });
}

async function bootModuleFrontend() {
    // 1. Foundation modules (ES module versions with window backward compat)
    await import('./i18n.mjs');
    await import('./runtime_bridge.mjs');

    // 2. Extracted ES modules (loaded before legacy scripts, register on window.*)
    await import('./path_worker_bridge.mjs');
    await import('./workbench_state.mjs');
    await import('./graph_state.mjs');
    await import('./path_layout.mjs');

    // 3. Legacy IIFE modules (loaded as side-effect scripts; these register on window.*)
    await import('./workspace_panes.js');
    await import('./agent_workspace.js');
    await import('./storage_provider.js');
    await import('./settings.js');
    await import('./source_manager.js');

    // 4. Large application payloads (loaded as side-effect modules)
    await import('./path_app.js');
    await import('./app.js');
}

if (shouldSkipModuleBootstrap()) {
    console.log('[main.mjs] Module frontend bootstrap skipped because the legacy script bootstrap is active.');
} else {
    void bootModuleFrontend();
}
