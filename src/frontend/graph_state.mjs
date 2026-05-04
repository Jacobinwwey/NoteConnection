/**
 * graph_state.mjs — Extracted graph visualization state management.
 * Manages focus mode, layout mode, semantic accessibility, and platform detection.
 * Formerly inline in app.js.
 */

/** Resolve the runtime platform from capabilities, navigator, and Capacitor. */
export function resolveRuntimePlatform(runtimeCaps) {
    const rawPlatform = runtimeCaps && typeof runtimeCaps.platform === 'string'
        ? runtimeCaps.platform.trim().toLowerCase()
        : '';

    if (rawPlatform.includes('android')) return 'android';
    if (rawPlatform.includes('ios')) return 'ios';
    if (rawPlatform.includes('windows') || rawPlatform === 'win32') return 'windows';
    if (rawPlatform.includes('macos') || rawPlatform.includes('darwin') || rawPlatform === 'mac') return 'macos';
    if (rawPlatform.includes('linux')) return 'linux';
    if (rawPlatform.includes('web')) return 'web';

    if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string') {
        const ua = navigator.userAgent;
        if (/Android/i.test(ua)) return 'android';
        if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
        if (/Windows/i.test(ua)) return 'windows';
        if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
        if (/Linux/i.test(ua)) return 'linux';
    }

    if (typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.getPlatform === 'function') {
        try {
            const capPlatform = String(window.Capacitor.getPlatform() || '').toLowerCase();
            if (capPlatform === 'android') return 'android';
            if (capPlatform === 'ios') return 'ios';
            if (capPlatform === 'web') return 'web';
        } catch (_err) { /* ignore */ }
    }

    return 'web';
}

/** Create the graph semantic accessibility state. */
export function createGraphA11yState() {
    return {
        lastSummaryKey: '',
        lastAnnouncementAt: 0,
        pendingReason: '',
        pendingTimer: null,
    };
}

/** Focus mode state for the graph visualization. */
export function createFocusState() {
    return {
        nodeId: null,
        frozen: false,
        verticalSpacing: 120,
        horizontalSpacing: 180,
    };
}

/** Layout mode for the graph. */
export const LAYOUT_MODES = {
    FORCE: 'force',
    DAG: 'dag',
};

/** Read the startup performance profile override from localStorage. */
export function readStartupPerfProfile() {
    if (typeof localStorage === 'undefined') return '';
    try {
        const value = localStorage.getItem('nc.startupPerfProfile');
        return typeof value === 'string' ? value.trim() : '';
    } catch (_err) {
        return '';
    }
}

/** Get the rendering engine preference. */
export function getRenderEnginePreference(nodeCount) {
    // Auto-switch to Canvas above 3000 nodes
    const savedPref = typeof localStorage !== 'undefined'
        ? localStorage.getItem('nc.renderEngine')
        : null;
    if (savedPref === 'svg' || savedPref === 'canvas') return savedPref;
    return nodeCount > 3000 ? 'canvas' : 'svg';
}

/** Performance timestamp helper. */
export function nowMs() {
    return (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
}

/** Build a diagnostic summary of the graph state. */
export function getGraphDiagnostics(state) {
    return {
        layoutMode: state.layoutMode || 'force',
        renderEngine: state.renderEngine || 'svg',
        focusNodeId: state.focusNodeId || null,
        nodeCount: state.nodes ? state.nodes.length : 0,
        edgeCount: state.edges ? state.edges.length : 0,
        platform: state.platform || 'unknown',
    };
}
