// Initialize Graph
const container = document.getElementById('graph-container');
let focusNode = null;
const graphSemanticA11yState = {
    lastSummaryKey: '',
    lastAnnouncementAt: 0,
    pendingReason: '',
    pendingTimer: null
};

function nowMs() {
    return (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
}

function readStartupPerfProfileOverride() {
    if (typeof localStorage === 'undefined') {
        return '';
    }

    try {
        const value = localStorage.getItem('nc.startupPerfProfile');
        return typeof value === 'string' ? value.trim() : '';
    } catch (_err) {
        return '';
    }
}

const mermaidErrorGuardState = {
    observer: null,
    toastHost: null,
    seenAtBySignature: new Map(),
    renderGuardInstalled: false,
    periodicSweepHandle: null,
    suppressedArtifacts: [],
};

function isMermaidErrorArtifactText(text) {
    const normalized = String(text || '').toLowerCase();
    if (!normalized) {
        return false;
    }
    return (
        normalized.includes('syntax error in text') ||
        normalized.includes('lexical error on line') ||
        normalized.includes('parse error on line') ||
        normalized.includes('mermaid version') ||
        normalized.includes('diagram syntax error')
    );
}

function normalizeMermaidErrorArtifactText(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);
}

function registerMermaidSuppressedArtifact(detail, context = {}) {
    const signature = normalizeMermaidErrorArtifactText(detail);
    if (!signature) {
        return;
    }
    const entry = {
        signature,
        detectedAt: new Date().toISOString(),
        context,
    };
    mermaidErrorGuardState.suppressedArtifacts.push(entry);
    if (mermaidErrorGuardState.suppressedArtifacts.length > 20) {
        mermaidErrorGuardState.suppressedArtifacts.shift();
    }
}

function ensureMermaidErrorToastHost() {
    if (mermaidErrorGuardState.toastHost && mermaidErrorGuardState.toastHost.isConnected) {
        return mermaidErrorGuardState.toastHost;
    }
    const host = document.createElement('div');
    host.id = 'mermaid-error-toast-stack';
    host.className = 'mermaid-error-toast-stack';
    document.body.appendChild(host);
    mermaidErrorGuardState.toastHost = host;
    return host;
}

function emitMermaidErrorToast(detail) {
    const signature = normalizeMermaidErrorArtifactText(detail);
    if (!signature) {
        return;
    }
    const now = Date.now();
    const lastSeenAt = mermaidErrorGuardState.seenAtBySignature.get(signature) || 0;
    if ((now - lastSeenAt) < 8000) {
        return;
    }
    mermaidErrorGuardState.seenAtBySignature.set(signature, now);

    const host = ensureMermaidErrorToastHost();
    const toast = document.createElement('div');
    toast.className = 'mermaid-error-toast';

    const title = document.createElement('div');
    title.className = 'mermaid-error-toast-title';
    title.textContent = 'Mermaid diagram skipped';
    toast.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'mermaid-error-toast-summary';
    summary.textContent = 'A malformed Mermaid block was suppressed to keep the workspace readable.';
    toast.appendChild(summary);

    const detailLine = document.createElement('div');
    detailLine.className = 'mermaid-error-toast-detail';
    detailLine.textContent = signature;
    toast.appendChild(detailLine);

    host.appendChild(toast);
    while (host.childElementCount > 3) {
        host.removeChild(host.firstElementChild);
    }

    window.setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 6500);
}

function createInlineMermaidErrorNotice(detail) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid-inline-guard';

    const title = document.createElement('div');
    title.className = 'mermaid-inline-guard-title';
    title.textContent = 'Mermaid diagram unavailable';
    wrapper.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'mermaid-inline-guard-summary';
    summary.textContent = 'Malformed Mermaid content was suppressed in this view.';
    wrapper.appendChild(summary);

    if (detail) {
        const detailLine = document.createElement('div');
        detailLine.className = 'mermaid-inline-guard-detail';
        detailLine.textContent = normalizeMermaidErrorArtifactText(detail);
        wrapper.appendChild(detailLine);
    }

    return wrapper;
}

function resolveMermaidErrorArtifactHost(node) {
    if (!node || typeof node.closest !== 'function') {
        return node;
    }
    return (
        node.closest('.mermaid-render-host-offscreen') ||
        node.closest('.mermaid-render-failed') ||
        node.closest('.mermaid') ||
        node.closest('.reader-block') ||
        node.closest('svg') ||
        node
    );
}

function isProtectedMermaidSuppressionHost(host) {
    if (!host || host.nodeType !== Node.ELEMENT_NODE) {
        return true;
    }
    return (
        host === document.body ||
        host === document.documentElement ||
        host === document.head ||
        host.id === 'graph-wrapper' ||
        host.id === 'path-container' ||
        host.id === 'reading-window' ||
        host.id === 'reading-content-box' ||
        host.id === 'reading-body'
    );
}

function collectMermaidErrorArtifactCandidates(root) {
    const hosts = [];
    const hostSet = new Set();
    const candidates = [];

    if (!root) {
        return hosts;
    }
    if (
        root.nodeType === Node.ELEMENT_NODE &&
        root !== document.body &&
        root !== document.documentElement &&
        root !== document.head
    ) {
        candidates.push(root);
    }

    const queryRoot = root.nodeType === Node.ELEMENT_NODE ? root : document.body;
    if (queryRoot && typeof queryRoot.querySelectorAll === 'function') {
        queryRoot.querySelectorAll('svg, .mermaid, div, section, article, aside, img, foreignObject').forEach((node) => candidates.push(node));
    }

    candidates.forEach((candidate) => {
        if (!candidate || candidate.nodeType !== Node.ELEMENT_NODE) {
            return;
        }
        const element = candidate;
        const text = normalizeMermaidErrorArtifactText(
            element.textContent ||
            element.getAttribute?.('alt') ||
            element.getAttribute?.('aria-label') ||
            ''
        );
        if (!isMermaidErrorArtifactText(text)) {
            return;
        }
        const host = resolveMermaidErrorArtifactHost(element);
        if (!host || hostSet.has(host) || isProtectedMermaidSuppressionHost(host)) {
            return;
        }
        hostSet.add(host);
        hosts.push(host);
    });

    return hosts;
}

function suppressMermaidErrorArtifacts(root, context = {}) {
    if (!root) {
        return;
    }

    const candidates = collectMermaidErrorArtifactCandidates(root);
    candidates.forEach((candidate) => {
        if (!candidate || candidate.dataset?.mermaidErrorSuppressed === '1') {
            return;
        }
        const text = normalizeMermaidErrorArtifactText(candidate.textContent || '');
        if (!isMermaidErrorArtifactText(text)) {
            return;
        }

        const host = resolveMermaidErrorArtifactHost(candidate);
        if (!host || host.dataset?.mermaidErrorSuppressed === '1') {
            return;
        }
        if (host.dataset) {
            host.dataset.mermaidErrorSuppressed = '1';
        }
        registerMermaidSuppressedArtifact(text, {
            hostTag: host.tagName || '',
            hostId: host.id || '',
            hostClass: host.className || '',
            ...context,
        });

        const shouldKeepInline = Boolean(
            host.closest('#reading-window') ||
            host.closest('#reading-body') ||
            host.closest('.notemd-embed-shell')
        );

        if (shouldKeepInline) {
            const inlineNotice = createInlineMermaidErrorNotice(text);
            if (host.parentNode) {
                host.parentNode.replaceChild(inlineNotice, host);
            }
        } else {
            emitMermaidErrorToast(text);
            if (host.parentNode) {
                host.parentNode.removeChild(host);
            } else {
                host.style.display = 'none';
            }
        }
    });
}

function installMermaidRuntimeGuards() {
    const mermaid = window.mermaid;
    if (!mermaid || mermaidErrorGuardState.renderGuardInstalled === true || mermaid.__noteConnectionErrorGuardInstalled === true) {
        return;
    }

    if (typeof mermaid.render === 'function') {
        const originalRender = mermaid.render.bind(mermaid);
        mermaid.render = async function(...args) {
            const result = await originalRender(...args);
            if (result && typeof result.svg === 'string' && isMermaidErrorArtifactText(result.svg)) {
                registerMermaidSuppressedArtifact(result.svg, {
                    source: 'mermaid.render',
                });
                throw new Error('Suppressed Mermaid error SVG before it could be mounted.');
            }
            return result;
        };
    }

    if (typeof mermaid.run === 'function') {
        const originalRun = mermaid.run.bind(mermaid);
        mermaid.run = async function(options) {
            const result = await originalRun(options);
            try {
                if (options && Array.isArray(options.nodes) && options.nodes.length > 0) {
                    options.nodes.forEach((node) => suppressMermaidErrorArtifacts(node, {
                        source: 'mermaid.run.nodes',
                    }));
                } else {
                    suppressMermaidErrorArtifacts(document.body, {
                        source: 'mermaid.run.document',
                    });
                }
            } catch (_error) {
                // Guard should never break main rendering.
            }
            return result;
        };
    }

    mermaid.__noteConnectionErrorGuardInstalled = true;
    mermaidErrorGuardState.renderGuardInstalled = true;
}

function exposeMermaidDebugInterface() {
    const existing = (window.__NC_DEBUG__ && typeof window.__NC_DEBUG__ === 'object')
        ? window.__NC_DEBUG__
        : {};
    window.__NC_DEBUG__ = {
        ...existing,
        scanMermaidErrorArtifacts: () => collectMermaidErrorArtifactCandidates(document.body).map((host) => ({
            tag: host.tagName || '',
            id: host.id || '',
            className: host.className || '',
            text: normalizeMermaidErrorArtifactText(host.textContent || ''),
        })),
        suppressMermaidErrorArtifactsNow: () => {
            suppressMermaidErrorArtifacts(document.body, { source: 'manual-debug-scan' });
            return mermaidErrorGuardState.suppressedArtifacts.slice();
        },
        getMermaidGuardState: () => ({
            renderGuardInstalled: mermaidErrorGuardState.renderGuardInstalled,
            suppressedArtifacts: mermaidErrorGuardState.suppressedArtifacts.slice(),
        }),
        captureRuntimeState: () => ({
            url: window.location.href,
            title: document.title,
            mermaidGuardState: {
                renderGuardInstalled: mermaidErrorGuardState.renderGuardInstalled,
                suppressedArtifacts: mermaidErrorGuardState.suppressedArtifacts.slice(),
            },
            activeMermaidErrors: collectMermaidErrorArtifactCandidates(document.body).map((host) => ({
                tag: host.tagName || '',
                id: host.id || '',
                className: host.className || '',
                text: normalizeMermaidErrorArtifactText(host.textContent || ''),
            })),
        }),
    };
}

function installMermaidErrorArtifactObserver() {
    installMermaidRuntimeGuards();
    exposeMermaidDebugInterface();

    if (mermaidErrorGuardState.observer || typeof MutationObserver === 'undefined') {
        suppressMermaidErrorArtifacts(document.body, { source: 'observer-reuse' });
        return;
    }

    mermaidErrorGuardState.observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (!node || node.nodeType !== Node.ELEMENT_NODE) {
                    return;
                }
                suppressMermaidErrorArtifacts(node, { source: 'mutation-observer' });
            });
        });
    });

    mermaidErrorGuardState.observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    suppressMermaidErrorArtifacts(document.body, { source: 'observer-install' });
    window.setTimeout(() => {
        installMermaidRuntimeGuards();
        suppressMermaidErrorArtifacts(document.body, { source: 'delayed-sweep-1200' });
    }, 1200);
    window.setTimeout(() => {
        installMermaidRuntimeGuards();
        suppressMermaidErrorArtifacts(document.body, { source: 'delayed-sweep-3200' });
    }, 3200);
    if (mermaidErrorGuardState.periodicSweepHandle === null) {
        mermaidErrorGuardState.periodicSweepHandle = window.setInterval(() => {
            installMermaidRuntimeGuards();
            suppressMermaidErrorArtifacts(document.body, { source: 'periodic-sweep' });
        }, 750);
    }
}

installMermaidErrorArtifactObserver();

function resolveRuntimePlatform(runtimeCaps) {
    const rawPlatform = runtimeCaps && typeof runtimeCaps.platform === 'string'
        ? runtimeCaps.platform.trim().toLowerCase()
        : '';

    if (rawPlatform.includes('android')) {
        return 'android';
    }
    if (rawPlatform.includes('ios')) {
        return 'ios';
    }
    if (rawPlatform.includes('windows') || rawPlatform === 'win32') {
        return 'windows';
    }
    if (rawPlatform.includes('macos') || rawPlatform.includes('darwin') || rawPlatform === 'mac') {
        return 'macos';
    }
    if (rawPlatform.includes('linux')) {
        return 'linux';
    }
    if (rawPlatform.includes('web')) {
        return 'web';
    }

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
        } catch (_err) {
            // Ignore and fall through.
        }
    }

    return 'unknown';
}

function resolveStartupPerfProfile(runtimeCaps) {
    const base = {
        id: 'default',
        pilotEnabled: false,
        tickMaxFps: 0,
        edgeGeometryDelayMs: 0,
        edgeStartupWindowMs: 0,
        edgeStartupSvgCap: 0,
        edgeStage1TopK: 0,
        stableAlphaThreshold: 0.05,
        stableHoldTicks: 8,
        stableTimeoutMs: 12000,
        lowAlphaThreshold: 0.08,
        lowAlphaTickMaxFps: 0,
        deltaTickEnabled: false,
        deltaEpsilonPx: 0.6,
        deltaFullSyncEveryTicks: 3,
        deltaLowAlphaEpsilonMultiplier: 1.35,
        deltaLowAlphaFullSyncEveryTicks: 5,
        startupOverlayEnabled: true,
        overlaySafetyTimeoutMs: 30000,
        overlayMinStars: 70,
        overlayMaxStars: 180,
        overlayStarDensity: 2400,
        overlayDprCap: 2
    };

    const profileCatalog = {
        desktop_windows_pilot: {
            ...base,
            id: 'desktop_windows_pilot',
            pilotEnabled: true,
            tickMaxFps: 26,
            edgeGeometryDelayMs: 400,
            edgeStartupWindowMs: 1500,
            edgeStartupSvgCap: 18000,
            edgeStage1TopK: 3500,
            lowAlphaTickMaxFps: 12,
            deltaTickEnabled: true,
            deltaEpsilonPx: 0.75,
            deltaFullSyncEveryTicks: 3,
            deltaLowAlphaEpsilonMultiplier: 1.45,
            deltaLowAlphaFullSyncEveryTicks: 5,
            overlayMinStars: 90,
            overlayMaxStars: 220,
            overlayStarDensity: 2200
        },
        desktop_macos_pilot: {
            ...base,
            id: 'desktop_macos_pilot',
            pilotEnabled: true,
            tickMaxFps: 24,
            edgeGeometryDelayMs: 430,
            edgeStartupWindowMs: 1700,
            edgeStartupSvgCap: 15000,
            edgeStage1TopK: 3000,
            lowAlphaTickMaxFps: 11,
            deltaTickEnabled: true,
            deltaEpsilonPx: 0.75,
            deltaFullSyncEveryTicks: 3,
            deltaLowAlphaEpsilonMultiplier: 1.45,
            deltaLowAlphaFullSyncEveryTicks: 5,
            overlayMinStars: 84,
            overlayMaxStars: 200,
            overlayStarDensity: 2400
        },
        desktop_linux_pilot: {
            ...base,
            id: 'desktop_linux_pilot',
            pilotEnabled: true,
            tickMaxFps: 24,
            edgeGeometryDelayMs: 420,
            edgeStartupWindowMs: 1600,
            edgeStartupSvgCap: 16000,
            edgeStage1TopK: 3200,
            lowAlphaTickMaxFps: 11,
            deltaTickEnabled: true,
            deltaEpsilonPx: 0.75,
            deltaFullSyncEveryTicks: 3,
            deltaLowAlphaEpsilonMultiplier: 1.45,
            deltaLowAlphaFullSyncEveryTicks: 5,
            overlayMinStars: 86,
            overlayMaxStars: 205,
            overlayStarDensity: 2350
        },
        mobile_android_pilot: {
            ...base,
            id: 'mobile_android_pilot',
            pilotEnabled: true,
            tickMaxFps: 18,
            edgeGeometryDelayMs: 560,
            edgeStartupWindowMs: 2200,
            edgeStartupSvgCap: 7000,
            edgeStage1TopK: 1500,
            stableHoldTicks: 10,
            stableTimeoutMs: 18000,
            lowAlphaThreshold: 0.1,
            lowAlphaTickMaxFps: 8,
            deltaTickEnabled: true,
            deltaEpsilonPx: 0.95,
            deltaFullSyncEveryTicks: 4,
            deltaLowAlphaEpsilonMultiplier: 1.6,
            deltaLowAlphaFullSyncEveryTicks: 6,
            overlaySafetyTimeoutMs: 36000,
            overlayMinStars: 52,
            overlayMaxStars: 120,
            overlayStarDensity: 3600,
            overlayDprCap: 1.6
        },
        mobile_ios_pilot: {
            ...base,
            id: 'mobile_ios_pilot',
            pilotEnabled: true,
            tickMaxFps: 17,
            edgeGeometryDelayMs: 600,
            edgeStartupWindowMs: 2300,
            edgeStartupSvgCap: 6200,
            edgeStage1TopK: 1300,
            stableHoldTicks: 10,
            stableTimeoutMs: 19000,
            lowAlphaThreshold: 0.1,
            lowAlphaTickMaxFps: 8,
            deltaTickEnabled: true,
            deltaEpsilonPx: 0.95,
            deltaFullSyncEveryTicks: 4,
            deltaLowAlphaEpsilonMultiplier: 1.6,
            deltaLowAlphaFullSyncEveryTicks: 6,
            overlaySafetyTimeoutMs: 36000,
            overlayMinStars: 48,
            overlayMaxStars: 110,
            overlayStarDensity: 3900,
            overlayDprCap: 1.5
        }
    };

    const detectedPlatform = resolveRuntimePlatform(runtimeCaps);
    const override = readStartupPerfProfileOverride();
    if (override === 'off') {
        return {
            ...base,
            override: 'off',
            detectedPlatform
        };
    }

    if (override && Object.prototype.hasOwnProperty.call(profileCatalog, override)) {
        return {
            ...profileCatalog[override],
            override: 'forced',
            detectedPlatform
        };
    }

    if (override && override !== 'auto') {
        console.warn(`[Startup Perf] Unknown override profile "${override}", fallback to auto-detected platform profile.`);
    }

    switch (detectedPlatform) {
        case 'windows':
            return { ...profileCatalog.desktop_windows_pilot, override: '', detectedPlatform };
        case 'macos':
            return { ...profileCatalog.desktop_macos_pilot, override: '', detectedPlatform };
        case 'linux':
            return { ...profileCatalog.desktop_linux_pilot, override: '', detectedPlatform };
        case 'android':
            return { ...profileCatalog.mobile_android_pilot, override: '', detectedPlatform };
        case 'ios':
            return { ...profileCatalog.mobile_ios_pilot, override: '', detectedPlatform };
        default:
            return { ...base, override: '', detectedPlatform };
    }
}

const startupRuntimeCaps = (typeof window !== 'undefined' && window.__NC_RUNTIME_CAPS)
    ? window.__NC_RUNTIME_CAPS
    : {};
const startupPerfProfile = resolveStartupPerfProfile(startupRuntimeCaps);
const startupPerfState = {
    bootTs: nowMs(),
    checkpoints: {},
    t3Seen: false,
    t4Seen: false,
    t5Seen: false,
    edgeDelayLogged: false,
    edgeDelayReleasedLogged: false,
    edgeCapLogged: false,
    edgeCapReleasedLogged: false,
    edgeStage1Logged: false,
    edgeStage1ReleasedLogged: false,
    tickModeSamples: {},
    lastWorkerAlpha: null,
    tickMessagesReceived: 0,
    tickPayloadNodesTotal: 0,
    tickPayloadNodesMax: 0,
    tickFramesApplied: 0,
    tickEmptyDeltaFramesSkipped: 0
};

const STARTUP_LAYOUT_SNAPSHOT_DB_NAME = 'noteconnection-startup';
const STARTUP_LAYOUT_SNAPSHOT_STORE_NAME = 'layoutSnapshots';
const STARTUP_LAYOUT_SNAPSHOT_LS_PREFIX = 'nc.startupLayoutSnapshot.';
const STARTUP_LAYOUT_SNAPSHOT_VERSION = 1;
const STARTUP_LAYOUT_SNAPSHOT_MAX_RECORDS = 6;
const STARTUP_LAYOUT_SNAPSHOT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

const startupLayoutSnapshotState = {
    fingerprint: '',
    warmRestoreApplied: false,
    pendingRecord: null,
    restorePromise: null,
    saveHandle: null,
    lastSaveAtMs: 0,
    sourceLayoutSummary: null,
    sourceLayoutById: null
};

function hashFNV1a32(input) {
    let hash = 0x811c9dc5;
    const text = String(input || '');
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildStartupGraphFingerprint(nodeList, linkList, graphPayload) {
    const safeNodes = Array.isArray(nodeList) ? nodeList : [];
    const safeLinks = Array.isArray(linkList) ? linkList : [];
    const graphVersion = graphPayload && graphPayload.version !== undefined
        ? String(graphPayload.version)
        : 'v0';

    const nodeStep = Math.max(1, Math.floor(safeNodes.length / 256));
    const nodeTokens = [];
    for (let index = 0; index < safeNodes.length && nodeTokens.length < 256; index += nodeStep) {
        const item = safeNodes[index];
        nodeTokens.push(item && item.id !== undefined ? String(item.id) : `idx:${index}`);
    }

    const linkStep = Math.max(1, Math.floor(safeLinks.length / 256));
    const linkTokens = [];
    for (let index = 0; index < safeLinks.length && linkTokens.length < 256; index += linkStep) {
        const item = safeLinks[index];
        const sourceId = item && item.source && typeof item.source === 'object' ? item.source.id : item && item.source;
        const targetId = item && item.target && typeof item.target === 'object' ? item.target.id : item && item.target;
        linkTokens.push(`${sourceId}->${targetId}`);
    }

    const signature = [
        `version=${graphVersion}`,
        `nodes=${safeNodes.length}`,
        `links=${safeLinks.length}`,
        `nodeSample=${nodeTokens.join('|')}`,
        `linkSample=${linkTokens.join('|')}`
    ].join('||');

    return `nc-layout-v${STARTUP_LAYOUT_SNAPSHOT_VERSION}-${hashFNV1a32(signature)}`;
}

function summarizeLayoutPositions(positionItems) {
    const safeItems = Array.isArray(positionItems) ? positionItems : [];
    const finitePositions = safeItems.filter((item) => (
        item &&
        Number.isFinite(Number(item.x)) &&
        Number.isFinite(Number(item.y))
    ));

    if (finitePositions.length === 0) {
        return {
            finiteCount: 0,
            minX: 0,
            maxX: 0,
            minY: 0,
            maxY: 0,
            spanX: 0,
            spanY: 0,
            uniqueRatio: 0
        };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const uniqueBuckets = new Set();

    for (let index = 0; index < finitePositions.length; index += 1) {
        const item = finitePositions[index];
        const x = Number(item.x);
        const y = Number(item.y);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        uniqueBuckets.add(`${Math.round(x)}:${Math.round(y)}`);
    }

    return {
        finiteCount: finitePositions.length,
        minX,
        maxX,
        minY,
        maxY,
        spanX: maxX - minX,
        spanY: maxY - minY,
        uniqueRatio: uniqueBuckets.size / Math.max(1, finitePositions.length)
    };
}

function isDegenerateLayoutSummary(summary) {
    return Boolean(
        summary &&
        summary.finiteCount > 0 &&
        ((summary.spanX < 48 && summary.spanY < 48) || summary.uniqueRatio < 0.12)
    );
}

function isSnapshotLayoutCollapsedVsSource(summary, sourceSummary) {
    if (!summary || !sourceSummary || sourceSummary.finiteCount < 10) {
        return false;
    }

    const sourceWideX = sourceSummary.spanX >= 320;
    const sourceWideY = sourceSummary.spanY >= 320;
    if (!sourceWideX && !sourceWideY) {
        return false;
    }

    const spanXTooSmall = sourceWideX && summary.spanX < Math.max(72, sourceSummary.spanX * 0.08);
    const spanYTooSmall = sourceWideY && summary.spanY < Math.max(72, sourceSummary.spanY * 0.08);
    return spanXTooSmall && spanYTooSmall;
}

function buildSourceLayoutById(nodeList) {
    const map = new Map();
    const safeNodes = Array.isArray(nodeList) ? nodeList : [];
    for (let index = 0; index < safeNodes.length; index += 1) {
        const node = safeNodes[index];
        if (!node || node.id === undefined || node.id === null) {
            continue;
        }
        const x = Number(node.x);
        const y = Number(node.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            continue;
        }
        map.set(node.id, { x, y });
    }
    return map;
}

function restoreSourceLayoutOrJitterNodes(nodeList, viewportWidth, viewportHeight, reason = '') {
    const safeNodes = Array.isArray(nodeList) ? nodeList : [];
    if (safeNodes.length === 0) {
        return false;
    }

    const currentSummary = summarizeLayoutPositions(safeNodes);
    const sourceSummary = startupLayoutSnapshotState.sourceLayoutSummary;
    const sourceLayoutById = startupLayoutSnapshotState.sourceLayoutById;
    const shouldRestoreSource = Boolean(
        sourceLayoutById instanceof Map &&
        sourceLayoutById.size > 0 &&
        isSnapshotLayoutCollapsedVsSource(currentSummary, sourceSummary)
    );

    if (!isDegenerateLayoutSummary(currentSummary) && !shouldRestoreSource) {
        return false;
    }

    if (shouldRestoreSource) {
        let restoredCount = 0;
        for (let index = 0; index < safeNodes.length; index += 1) {
            const node = safeNodes[index];
            const sourcePos = sourceLayoutById.get(node.id);
            if (!sourcePos) {
                continue;
            }
            node.x = sourcePos.x;
            node.y = sourcePos.y;
            node.fx = null;
            node.fy = null;
            if (currentPositions && typeof currentPositions.set === 'function') {
                currentPositions.set(node.id, { x: node.x, y: node.y });
            }
            restoredCount += 1;
        }
        console.warn('[Startup Warm Snapshot] Restored source layout because active positions collapsed relative to source.', {
            reason,
            restoredCount,
            currentSpanX: Number(currentSummary.spanX.toFixed(2)),
            currentSpanY: Number(currentSummary.spanY.toFixed(2)),
            sourceSpanX: sourceSummary ? Number(sourceSummary.spanX.toFixed(2)) : null,
            sourceSpanY: sourceSummary ? Number(sourceSummary.spanY.toFixed(2)) : null
        });
        return restoredCount > 0;
    }

    const centerX = Number.isFinite(Number(viewportWidth)) && Number(viewportWidth) > 0
        ? Number(viewportWidth) / 2
        : 400;
    const centerY = Number.isFinite(Number(viewportHeight)) && Number(viewportHeight) > 0
        ? Number(viewportHeight) / 2
        : 300;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let index = 0; index < safeNodes.length; index += 1) {
        const node = safeNodes[index];
        const rankOffset = Number.isFinite(Number(node.rank)) ? Number(node.rank) * 4 : 0;
        const radius = 28 + (Math.sqrt(index + 1) * 18) + rankOffset;
        const angle = (index * goldenAngle) + (rankOffset * 0.017);
        node.x = centerX + (Math.cos(angle) * radius);
        node.y = centerY + (Math.sin(angle) * radius);
        node.fx = null;
        node.fy = null;
        if (currentPositions && typeof currentPositions.set === 'function') {
            currentPositions.set(node.id, { x: node.x, y: node.y });
        }
    }

    console.warn('[Startup Warm Snapshot] Re-seeded degenerate initial layout before simulation bootstrap.', {
        reason,
        nodeCount: safeNodes.length,
        spanX: Number(currentSummary.spanX.toFixed(2)),
        spanY: Number(currentSummary.spanY.toFixed(2)),
        uniqueRatio: Number(currentSummary.uniqueRatio.toFixed(4))
    });
    return true;
}

function openStartupLayoutSnapshotDb() {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            resolve(null);
            return;
        }

        let request;
        try {
            request = window.indexedDB.open(STARTUP_LAYOUT_SNAPSHOT_DB_NAME, STARTUP_LAYOUT_SNAPSHOT_VERSION);
        } catch (error) {
            reject(error);
            return;
        }

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STARTUP_LAYOUT_SNAPSHOT_STORE_NAME)) {
                const store = db.createObjectStore(STARTUP_LAYOUT_SNAPSHOT_STORE_NAME, { keyPath: 'fingerprint' });
                store.createIndex('savedAt', 'savedAt');
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('indexedDB open failed'));
    });
}

function loadStartupLayoutSnapshotFromLocalStorage(fingerprint) {
    if (!fingerprint || typeof localStorage === 'undefined') {
        return null;
    }
    const key = `${STARTUP_LAYOUT_SNAPSHOT_LS_PREFIX}${fingerprint}`;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_err) {
        return null;
    }
}

function saveStartupLayoutSnapshotToLocalStorage(record) {
    if (!record || !record.fingerprint || typeof localStorage === 'undefined') {
        return;
    }
    try {
        const key = `${STARTUP_LAYOUT_SNAPSHOT_LS_PREFIX}${record.fingerprint}`;
        localStorage.setItem(key, JSON.stringify(record));
    } catch (_err) {
        // Ignore quota failures.
    }
}

async function loadStartupLayoutSnapshotRecord(fingerprint) {
    if (!fingerprint) {
        return null;
    }

    const db = await openStartupLayoutSnapshotDb();
    if (!db) {
        return loadStartupLayoutSnapshotFromLocalStorage(fingerprint);
    }

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STARTUP_LAYOUT_SNAPSHOT_STORE_NAME, 'readonly');
        const store = tx.objectStore(STARTUP_LAYOUT_SNAPSHOT_STORE_NAME);
        const req = store.get(fingerprint);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error('indexedDB read failed'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
        tx.onabort = () => db.close();
    });
}

async function persistStartupLayoutSnapshotRecord(record) {
    if (!record || !record.fingerprint) {
        return;
    }

    const db = await openStartupLayoutSnapshotDb();
    if (!db) {
        saveStartupLayoutSnapshotToLocalStorage(record);
        return;
    }

    await new Promise((resolve, reject) => {
        const tx = db.transaction(STARTUP_LAYOUT_SNAPSHOT_STORE_NAME, 'readwrite');
        const store = tx.objectStore(STARTUP_LAYOUT_SNAPSHOT_STORE_NAME);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('indexedDB write failed'));
        tx.onabort = () => reject(tx.error || new Error('indexedDB write aborted'));
    });

    // Keep snapshot store bounded to avoid unbounded growth.
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STARTUP_LAYOUT_SNAPSHOT_STORE_NAME, 'readwrite');
        const store = tx.objectStore(STARTUP_LAYOUT_SNAPSHOT_STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
            const now = Date.now();
            const allRecords = Array.isArray(req.result) ? req.result : [];
            allRecords.sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));
            for (let i = 0; i < allRecords.length; i += 1) {
                const item = allRecords[i];
                const isExpired = Number.isFinite(item.savedAt) && (now - item.savedAt) > STARTUP_LAYOUT_SNAPSHOT_MAX_AGE_MS;
                const overflow = i >= STARTUP_LAYOUT_SNAPSHOT_MAX_RECORDS;
                if (isExpired || overflow) {
                    store.delete(item.fingerprint);
                }
            }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('indexedDB cleanup failed'));
        tx.onabort = () => reject(tx.error || new Error('indexedDB cleanup aborted'));
    });

    db.close();
}

async function deleteStartupLayoutSnapshotRecord(fingerprint) {
    if (!fingerprint) {
        return;
    }

    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.removeItem(`${STARTUP_LAYOUT_SNAPSHOT_LS_PREFIX}${fingerprint}`);
        } catch (_err) {
            // Ignore localStorage cleanup failures.
        }
    }

    const db = await openStartupLayoutSnapshotDb();
    if (!db) {
        return;
    }

    await new Promise((resolve, reject) => {
        const tx = db.transaction(STARTUP_LAYOUT_SNAPSHOT_STORE_NAME, 'readwrite');
        const store = tx.objectStore(STARTUP_LAYOUT_SNAPSHOT_STORE_NAME);
        store.delete(fingerprint);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('indexedDB delete failed'));
        tx.onabort = () => reject(tx.error || new Error('indexedDB delete aborted'));
    });

    db.close();
}

function collectStartupLayoutSnapshotRecord(reason = '') {
    if (!startupLayoutSnapshotState.fingerprint || !Array.isArray(nodes) || nodes.length === 0) {
        return null;
    }

    const positions = new Array(nodes.length);
    for (let index = 0; index < nodes.length; index += 1) {
        const n = nodes[index];
        positions[index] = {
            id: n.id,
            x: Number.isFinite(Number(n.x)) ? Number(n.x) : 0,
            y: Number.isFinite(Number(n.y)) ? Number(n.y) : 0,
            fx: null,
            fy: null
        };
    }

    return {
        fingerprint: startupLayoutSnapshotState.fingerprint,
        savedAt: Date.now(),
        reason: String(reason || ''),
        profileId: startupPerfProfile.id,
        nodeCount: nodes.length,
        edgeCount: Array.isArray(links) ? links.length : 0,
        positions
    };
}

function validateStartupLayoutSnapshotRecord(record) {
    if (!record || !Array.isArray(record.positions) || record.positions.length === 0) {
        return { ok: false, reason: 'empty-positions' };
    }

    if (startupLayoutSnapshotState.fingerprint && record.fingerprint && record.fingerprint !== startupLayoutSnapshotState.fingerprint) {
        return { ok: false, reason: 'fingerprint-mismatch' };
    }

    const now = Date.now();
    if (Number.isFinite(record.savedAt) && (now - record.savedAt) > STARTUP_LAYOUT_SNAPSHOT_MAX_AGE_MS) {
        return { ok: false, reason: 'snapshot-expired' };
    }

    const expectedNodeCount = Array.isArray(nodes) ? nodes.length : 0;
    const expectedEdgeCount = Array.isArray(links) ? links.length : 0;

    if (Number.isFinite(record.nodeCount) && expectedNodeCount > 0 && record.nodeCount !== expectedNodeCount) {
        return { ok: false, reason: 'node-count-mismatch' };
    }
    if (Number.isFinite(record.edgeCount) && expectedEdgeCount > 0 && record.edgeCount !== expectedEdgeCount) {
        return { ok: false, reason: 'edge-count-mismatch' };
    }

    const positionCount = record.positions.length;
    const coverage = expectedNodeCount > 0 ? (positionCount / expectedNodeCount) : 0;
    if (expectedNodeCount > 0 && coverage < 0.9) {
        return { ok: false, reason: 'position-coverage-low', coverage: Number(coverage.toFixed(4)) };
    }

    const positionSummary = summarizeLayoutPositions(record.positions);
    if (expectedNodeCount >= 10 && positionSummary.finiteCount > 0) {
        if (isDegenerateLayoutSummary(positionSummary)) {
            return {
                ok: false,
                reason: 'degenerate-layout',
                purge: true,
                spanX: Number(positionSummary.spanX.toFixed(2)),
                spanY: Number(positionSummary.spanY.toFixed(2)),
                uniqueRatio: Number(positionSummary.uniqueRatio.toFixed(4)),
            };
        }

        if (isSnapshotLayoutCollapsedVsSource(positionSummary, startupLayoutSnapshotState.sourceLayoutSummary)) {
            return {
                ok: false,
                reason: 'degenerate-layout-vs-source',
                purge: true,
                spanX: Number(positionSummary.spanX.toFixed(2)),
                spanY: Number(positionSummary.spanY.toFixed(2)),
                uniqueRatio: Number(positionSummary.uniqueRatio.toFixed(4)),
                sourceSpanX: startupLayoutSnapshotState.sourceLayoutSummary
                    ? Number(startupLayoutSnapshotState.sourceLayoutSummary.spanX.toFixed(2))
                    : null,
                sourceSpanY: startupLayoutSnapshotState.sourceLayoutSummary
                    ? Number(startupLayoutSnapshotState.sourceLayoutSummary.spanY.toFixed(2))
                    : null
            };
        }
    }

    return {
        ok: true,
        coverage: Number(coverage.toFixed(4)),
        positionCount,
        expectedNodeCount,
        expectedEdgeCount
    };
}

function applyStartupLayoutSnapshotRecord(record) {
    if (!record || !Array.isArray(record.positions) || record.positions.length === 0 || !nodeMap) {
        return { appliedCount: 0, total: 0 };
    }
    const layoutById = new Map(record.positions.map((item) => [item.id, item]));
    let appliedCount = 0;

    for (let index = 0; index < nodes.length; index += 1) {
        const n = nodes[index];
        const saved = layoutById.get(n.id);
        if (!saved) {
            continue;
        }
        n.x = Number.isFinite(saved.x) ? saved.x : n.x;
        n.y = Number.isFinite(saved.y) ? saved.y : n.y;
        n.fx = null;
        n.fy = null;
        if (currentPositions && typeof currentPositions.set === 'function') {
            currentPositions.set(n.id, { x: n.x, y: n.y });
        }
        appliedCount += 1;
    }

    return { appliedCount, total: nodes.length };
}

function maybeApplyStartupWarmSnapshot(trigger = '') {
    if (startupLayoutSnapshotState.warmRestoreApplied) {
        return false;
    }
    const record = startupLayoutSnapshotState.pendingRecord;
    if (!record || !simulationWorker) {
        return false;
    }

    const validation = validateStartupLayoutSnapshotRecord(record);
    if (!validation.ok) {
        console.warn('[Startup Warm Snapshot] Skip applying invalid snapshot record.', {
            trigger,
            reason: validation.reason,
            fingerprint: startupLayoutSnapshotState.fingerprint,
            recordFingerprint: record.fingerprint || null,
            recordNodeCount: record.nodeCount || 0,
            recordEdgeCount: record.edgeCount || 0,
            positionCount: Array.isArray(record.positions) ? record.positions.length : 0,
            spanX: validation.spanX,
            spanY: validation.spanY,
            uniqueRatio: validation.uniqueRatio,
        });
        if (validation.purge === true && record.fingerprint) {
            deleteStartupLayoutSnapshotRecord(record.fingerprint).catch((error) => {
                console.warn('[Startup Warm Snapshot] Failed to purge invalid snapshot record:', error && error.message ? error.message : String(error));
            });
        }
        startupLayoutSnapshotState.pendingRecord = null;
        return false;
    }

    const result = applyStartupLayoutSnapshotRecord(record);
    if (result.appliedCount <= 0) {
        return false;
    }
    startupLayoutSnapshotState.warmRestoreApplied = true;

    console.log('[Startup Warm Snapshot] Applied persisted layout snapshot.', {
        trigger,
        fingerprint: startupLayoutSnapshotState.fingerprint,
        appliedCount: result.appliedCount,
        totalNodes: result.total,
        savedAt: record.savedAt || null,
        coverage: validation.coverage
    });

    if (typeof ticked === 'function') {
        ticked();
    }

    const syncNodes = nodes.map((n) => ({
        id: n.id,
        x: Number.isFinite(Number(n.x)) ? Number(n.x) : 0,
        y: Number.isFinite(Number(n.y)) ? Number(n.y) : 0,
        fx: Number.isFinite(Number(n.fx)) ? Number(n.fx) : null,
        fy: Number.isFinite(Number(n.fy)) ? Number(n.fy) : null,
        rank: n.rank
    }));
    const syncLinks = physicsLinks.map((l) => ({
        source: l.source && typeof l.source === 'object' ? l.source.id : l.source,
        target: l.target && typeof l.target === 'object' ? l.target.id : l.target
    }));
    simulationWorker.postMessage({
        type: 'setNodes',
        payload: {
            nodes: syncNodes,
            links: syncLinks,
            restart: true
        }
    });
    simulationWorker.postMessage({
        type: 'updateParams',
        payload: {
            alpha: 0.18,
            velocityDecay: 0.92,
            restart: true
        }
    });

    return true;
}

function scheduleStartupLayoutSnapshotPersist(reason = '', delayMs = 800) {
    if (startupPerfProfile.pilotEnabled !== true) {
        return;
    }
    if (!startupLayoutSnapshotState.fingerprint) {
        return;
    }

    if (startupLayoutSnapshotState.saveHandle !== null) {
        clearTimeout(startupLayoutSnapshotState.saveHandle);
        startupLayoutSnapshotState.saveHandle = null;
    }

    startupLayoutSnapshotState.saveHandle = setTimeout(async () => {
        startupLayoutSnapshotState.saveHandle = null;
        const record = collectStartupLayoutSnapshotRecord(reason);
        if (!record) {
            return;
        }
        try {
            await persistStartupLayoutSnapshotRecord(record);
            startupLayoutSnapshotState.lastSaveAtMs = record.savedAt;
            console.log('[Startup Warm Snapshot] Persisted layout snapshot.', {
                fingerprint: record.fingerprint,
                reason: record.reason,
                nodeCount: record.nodeCount
            });
        } catch (error) {
            console.warn('[Startup Warm Snapshot] Persist failed:', error && error.message ? error.message : String(error));
        }
    }, Math.max(0, Math.floor(delayMs)));
}

let startupWorldOverlayState = null;

function createStartupWorldOverlay() {
    if (startupPerfProfile.startupOverlayEnabled === false) {
        return null;
    }

    const wrapper = document.getElementById('graph-wrapper');
    if (!wrapper) {
        return null;
    }

    const existing = document.getElementById('startup-world-overlay');
    if (existing) {
        return null;
    }

    const overlay = document.createElement('div');
    overlay.id = 'startup-world-overlay';
    overlay.className = 'startup-world-overlay';
    overlay.innerHTML = `
        <div class="startup-world-card" role="status" aria-live="polite">
            <div class="startup-world-title">等待世界构建</div>
            <div class="startup-world-subtitle">星辰正在连接知识节点...</div>
            <canvas class="startup-world-canvas" aria-label="Startup Starfield"></canvas>
            <div class="startup-world-hint">点击星辰可点暗</div>
        </div>
    `;
    wrapper.appendChild(overlay);

    const card = overlay.querySelector('.startup-world-card');
    const canvas = overlay.querySelector('.startup-world-canvas');
    if (!card || !canvas) {
        overlay.remove();
        return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        overlay.remove();
        return null;
    }

    const state = {
        overlay,
        card,
        canvas,
        ctx,
        stars: [],
        running: true,
        frameHandle: null,
        resizeObserver: null,
        resizeHandler: null,
        width: 0,
        height: 0,
        dpr: 1,
        leaveHandle: null,
        fallbackHandle: null,
        hidden: false,
        reducedMotion: false
    };

    if (typeof window.matchMedia === 'function') {
        try {
            state.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (_err) {
            state.reducedMotion = false;
        }
    }

    function buildStars() {
        const minStars = Number.isFinite(startupPerfProfile.overlayMinStars)
            ? Math.max(20, Math.floor(startupPerfProfile.overlayMinStars))
            : 70;
        const maxStars = Number.isFinite(startupPerfProfile.overlayMaxStars)
            ? Math.max(minStars, Math.floor(startupPerfProfile.overlayMaxStars))
            : 180;
        const densityDivisor = Number.isFinite(startupPerfProfile.overlayStarDensity)
            ? Math.max(800, Math.floor(startupPerfProfile.overlayStarDensity))
            : 2400;
        let starCount = Math.min(maxStars, Math.max(minStars, Math.round((state.width * state.height) / densityDivisor)));
        if (state.reducedMotion) {
            starCount = Math.max(24, Math.round(starCount * 0.7));
        }
        state.stars = new Array(starCount);
        const twinkleScale = state.reducedMotion ? 0.45 : 1;
        for (let index = 0; index < starCount; index += 1) {
            state.stars[index] = {
                x: Math.random() * state.width,
                y: Math.random() * state.height,
                radius: 0.7 + Math.random() * 2.4,
                hue: 195 + Math.random() * 35,
                lightness: 75 + Math.random() * 20,
                baseAlpha: 0.3 + Math.random() * 0.55,
                twinkleSpeed: (0.8 + Math.random() * 2.4) * twinkleScale,
                phase: Math.random() * Math.PI * 2,
                dimTarget: 0,
                dimValue: 0
            };
        }
    }

    function resizeCanvas() {
        const rect = state.canvas.getBoundingClientRect();
        state.width = Math.max(1, Math.floor(rect.width));
        state.height = Math.max(1, Math.floor(rect.height));
        const dprCap = Number.isFinite(startupPerfProfile.overlayDprCap)
            ? Math.max(1, startupPerfProfile.overlayDprCap)
            : 2;
        state.dpr = Math.min(dprCap, Math.max(1, window.devicePixelRatio || 1));
        state.canvas.width = Math.floor(state.width * state.dpr);
        state.canvas.height = Math.floor(state.height * state.dpr);
        state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
        buildStars();
    }

    function drawFrame(frameTimeMs) {
        if (!state.running) {
            return;
        }

        const t = frameTimeMs * 0.001;
        const renderCtx = state.ctx;
        renderCtx.clearRect(0, 0, state.width, state.height);

        const nebulaA = renderCtx.createRadialGradient(
            state.width * 0.28,
            state.height * 0.28,
            8,
            state.width * 0.28,
            state.height * 0.28,
            state.width * 0.85
        );
        nebulaA.addColorStop(0, 'rgba(108, 149, 255, 0.22)');
        nebulaA.addColorStop(1, 'rgba(108, 149, 255, 0)');
        renderCtx.fillStyle = nebulaA;
        renderCtx.fillRect(0, 0, state.width, state.height);

        const nebulaB = renderCtx.createRadialGradient(
            state.width * 0.78,
            state.height * 0.72,
            12,
            state.width * 0.78,
            state.height * 0.72,
            state.width * 0.7
        );
        nebulaB.addColorStop(0, 'rgba(165, 126, 255, 0.18)');
        nebulaB.addColorStop(1, 'rgba(165, 126, 255, 0)');
        renderCtx.fillStyle = nebulaB;
        renderCtx.fillRect(0, 0, state.width, state.height);

        for (let index = 0; index < state.stars.length; index += 1) {
            const star = state.stars[index];
            star.dimValue += (star.dimTarget - star.dimValue) * 0.12;

            const twinkle = state.reducedMotion
                ? 0.82
                : (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * star.twinkleSpeed + star.phase)));
            const alpha = Math.max(0.02, star.baseAlpha * twinkle * (1 - 0.9 * star.dimValue));
            const radius = star.radius * (0.9 + twinkle * 0.3);

            renderCtx.beginPath();
            renderCtx.arc(star.x, star.y, radius, 0, Math.PI * 2);
            renderCtx.fillStyle = `hsla(${star.hue}, 92%, ${star.lightness}%, ${alpha})`;
            renderCtx.shadowBlur = state.reducedMotion ? (5 + star.radius * 3) : (9 + star.radius * 6);
            renderCtx.shadowColor = `hsla(${star.hue}, 95%, ${Math.min(98, star.lightness + 5)}%, ${Math.min(0.85, alpha + 0.12)})`;
            renderCtx.fill();
            renderCtx.shadowBlur = 0;
        }

        state.frameHandle = window.requestAnimationFrame(drawFrame);
    }

    function dimNearestStar(event) {
        const rect = state.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        let nearestStar = null;
        let nearestDistSq = Infinity;
        for (let index = 0; index < state.stars.length; index += 1) {
            const star = state.stars[index];
            const dx = star.x - x;
            const dy = star.y - y;
            const distSq = dx * dx + dy * dy;
            const hitRadius = Math.max(11, star.radius * 5);
            if (distSq <= hitRadius * hitRadius && distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearestStar = star;
            }
        }

        if (nearestStar) {
            nearestStar.dimTarget = 1;
        }
    }

    state.canvas.addEventListener('pointerdown', dimNearestStar);

    state.resizeHandler = resizeCanvas;
    if (typeof ResizeObserver === 'function') {
        state.resizeObserver = new ResizeObserver(() => resizeCanvas());
        state.resizeObserver.observe(state.card);
    } else {
        window.addEventListener('resize', state.resizeHandler);
    }

    resizeCanvas();
    state.frameHandle = window.requestAnimationFrame(drawFrame);

    return state;
}

function hideStartupWorldOverlay(reason = '') {
    if (!startupWorldOverlayState || startupWorldOverlayState.hidden) {
        return;
    }

    const state = startupWorldOverlayState;
    state.hidden = true;
    state.running = false;

    if (state.frameHandle !== null) {
        window.cancelAnimationFrame(state.frameHandle);
        state.frameHandle = null;
    }

    if (state.resizeObserver) {
        state.resizeObserver.disconnect();
        state.resizeObserver = null;
    } else if (state.resizeHandler) {
        window.removeEventListener('resize', state.resizeHandler);
    }

    if (state.fallbackHandle !== null) {
        window.clearTimeout(state.fallbackHandle);
        state.fallbackHandle = null;
    }

    state.overlay.classList.add('is-leaving');
    if (reason) {
        console.log(`[Startup Overlay] Closing overlay: ${reason}`);
    }

    state.leaveHandle = window.setTimeout(() => {
        if (state.overlay && state.overlay.parentNode) {
            state.overlay.parentNode.removeChild(state.overlay);
        }
        startupWorldOverlayState = null;
    }, 620);
}

function markStartupCheckpoint(label, details = null) {
    if (Object.prototype.hasOwnProperty.call(startupPerfState.checkpoints, label)) {
        return startupPerfState.checkpoints[label];
    }

    const at = nowMs();
    const elapsedMs = at - startupPerfState.bootTs;
    startupPerfState.checkpoints[label] = at;

    if (details && typeof details === 'object' && Object.keys(details).length > 0) {
        console.log(`[Startup Perf] ${label} +${elapsedMs.toFixed(2)}ms`, details);
    } else {
        console.log(`[Startup Perf] ${label} +${elapsedMs.toFixed(2)}ms`);
    }

    if (typeof label === 'string' && label.startsWith('T5 ')) {
        hideStartupWorldOverlay('initial-layout-complete');
    }

    return at;
}

markStartupCheckpoint('T0 app_boot', {
    profile: startupPerfProfile.id,
    pilotEnabled: startupPerfProfile.pilotEnabled,
    platform: startupPerfProfile.detectedPlatform || 'unknown',
    runtimePlatformRaw: startupRuntimeCaps && startupRuntimeCaps.platform ? startupRuntimeCaps.platform : 'unknown',
    override: startupPerfProfile.override || 'none'
});

// State for Cluster Filtering
let activeClusterFilter = localStorage.getItem('activeClusterFilter') || 'all';
// Clear it immediately so it doesn't persist unwantedly on manual refreshes? 
// No, user might want to refresh. We need a UI to clear it.

// Create SVG with 100% dimensions
const svg = d3.select("#graph-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .on("click", (event) => {
        // Clear highlight on background click using highlightManager
        // 使用highlightManager在背景点击时清除高亮
        if (event.target.tagName === 'svg') {
             // Only if not in Focus Mode (Focus Mode has its own exit)
             // 仅当不在专注模式时（专注模式有自己的退出方式）
             if (!focusNode && window.highlightManager) {
                 const state = window.highlightManager.getState();
                 if (state.isFrozen || state.currentNode) {
                     // Clear highlight with force option
                     // 使用强制选项清除高亮
                     window.highlightManager.unhighlight({ force: true });
                     
                     // Hide statistics popup if visible
                     // 如果统计弹窗可见则隐藏
                     const popup = document.getElementById('node-stats-popup');
                     if (popup) popup.style.display = 'none';
                 }
             }
        }
    })
    .call(d3.zoom().on("zoom", (event) => {
        g.attr("transform", event.transform);
        // v0.9.31: Check simulation state on zoom
        if (typeof checkSimulationState === 'function') checkSimulationState();
    }));

const g = svg.append("g");

// Tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Data
// Handle Mini Build: graphData may be undefined if data.js is excluded
// Use typeof to avoid ReferenceError
const runtimeGraphData =
    (typeof graphData !== 'undefined' && graphData !== null)
        ? graphData
        : ((typeof window !== 'undefined' && window.graphData) ? window.graphData : null);
const graphDataExists = runtimeGraphData !== null;
const sourceNodes = (graphDataExists && Array.isArray(runtimeGraphData.nodes)) ? runtimeGraphData.nodes : [];
const sourceLinks = (graphDataExists && Array.isArray(runtimeGraphData.edges)) ? runtimeGraphData.edges : [];

if (graphDataExists && sourceNodes.length > 0) {
    startupWorldOverlayState = createStartupWorldOverlay();
    if (startupWorldOverlayState) {
        const overlaySafetyTimeoutMs = Number.isFinite(startupPerfProfile.overlaySafetyTimeoutMs)
            ? Math.max(8000, Math.floor(startupPerfProfile.overlaySafetyTimeoutMs))
            : 30000;
        console.log('[Startup Overlay] Activated.', {
            profile: startupPerfProfile.id,
            platform: startupPerfProfile.detectedPlatform || 'unknown',
            overlaySafetyTimeoutMs
        });
        startupWorldOverlayState.fallbackHandle = window.setTimeout(() => {
            hideStartupWorldOverlay('safety-timeout');
        }, overlaySafetyTimeoutMs);
    } else {
        console.log('[Startup Overlay] Skipped by profile/runtime policy.', {
            profile: startupPerfProfile.id,
            platform: startupPerfProfile.detectedPlatform || 'unknown'
        });
    }
} else {
    console.log('[Startup Overlay] Skipped: no preloaded graph payload detected.');
}

const graphPreprocessStartTs = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();

// Use direct shallow clones instead of Object.create(...) prototype chains.
// This keeps property access predictable and avoids startup overhead on huge graphs.
const nodes = new Array(sourceNodes.length);
for (let nodeIndex = 0; nodeIndex < sourceNodes.length; nodeIndex += 1) {
    const rawNode = sourceNodes[nodeIndex];
    nodes[nodeIndex] = (rawNode && typeof rawNode === 'object')
        ? { ...rawNode }
        : rawNode;
}
let links = [];

// Log startup mode for diagnostics
if (!graphDataExists) {
    console.log('[Init] Mini Build detected: No pre-bundled data loaded. Please select a Knowledge Base.');
} else {
    console.log(`[Init] Full Build detected: Loaded ${nodes.length} nodes from bundled data.js`);
}

// Optimization: Pre-resolve links to ensure they are objects, not strings.
// This allows us to feed a SUBSET to the physics engine while keeping ALL links for rendering.
// 优化：预解析连接以确保它们是对象而不是字符串。
// 这允许我们将子集提供给物理引擎，同时保留所有连接以供渲染。
const nodeMap = new Map();
for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
    const node = nodes[nodeIndex];
    if (node && node.id !== undefined && node.id !== null) {
        nodeMap.set(node.id, node);
    }
}

const normalizedLinks = new Array(sourceLinks.length);
let validLinkCount = 0;
for (let linkIndex = 0; linkIndex < sourceLinks.length; linkIndex += 1) {
    const rawLink = sourceLinks[linkIndex];
    if (!rawLink || typeof rawLink !== 'object') {
        continue;
    }
    const link = { ...rawLink };

    const sourceId = (link.source && typeof link.source === 'object')
        ? link.source.id
        : link.source;
    const targetId = (link.target && typeof link.target === 'object')
        ? link.target.id
        : link.target;
    const sourceNode = nodeMap.get(sourceId);
    const targetNode = nodeMap.get(targetId);
    if (!sourceNode || !targetNode) {
        continue;
    }

    link.source = sourceNode;
    link.target = targetNode;
    normalizedLinks[validLinkCount] = link;
    validLinkCount += 1;
}

if (validLinkCount < normalizedLinks.length) {
    normalizedLinks.length = validLinkCount;
}
links = normalizedLinks;
const graphPreprocessElapsedMs = ((typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now()) - graphPreprocessStartTs;
console.log(`[Init Perf] Graph preprocessing completed in ${graphPreprocessElapsedMs.toFixed(2)}ms (nodes=${nodes.length}, links=${links.length}).`);
markStartupCheckpoint('T1 graph_preprocessed', {
    nodes: nodes.length,
    links: links.length,
    preprocessMs: Number(graphPreprocessElapsedMs.toFixed(2))
});

startupLayoutSnapshotState.sourceLayoutById = buildSourceLayoutById(nodes);
startupLayoutSnapshotState.sourceLayoutSummary = summarizeLayoutPositions(nodes);
if (startupLayoutSnapshotState.sourceLayoutSummary.finiteCount > 0) {
    console.log('[Startup Warm Snapshot] Source layout summary prepared.', {
        finiteCount: startupLayoutSnapshotState.sourceLayoutSummary.finiteCount,
        spanX: Number(startupLayoutSnapshotState.sourceLayoutSummary.spanX.toFixed(2)),
        spanY: Number(startupLayoutSnapshotState.sourceLayoutSummary.spanY.toFixed(2)),
        uniqueRatio: Number(startupLayoutSnapshotState.sourceLayoutSummary.uniqueRatio.toFixed(4))
    });
}

startupLayoutSnapshotState.fingerprint = buildStartupGraphFingerprint(nodes, links, runtimeGraphData);
console.log('[Startup Warm Snapshot] Fingerprint prepared.', {
    fingerprint: startupLayoutSnapshotState.fingerprint,
    nodes: nodes.length,
    links: links.length
});
startupLayoutSnapshotState.restorePromise = loadStartupLayoutSnapshotRecord(startupLayoutSnapshotState.fingerprint)
    .then((record) => {
        startupLayoutSnapshotState.pendingRecord = record;
        if (!record) {
            console.log('[Startup Warm Snapshot] No persisted snapshot matched current fingerprint.');
            return;
        }
        if (!Array.isArray(record.positions) || record.positions.length === 0) {
            console.log('[Startup Warm Snapshot] Matched snapshot is empty. Skip applying.');
            return;
        }
        console.log('[Startup Warm Snapshot] Snapshot matched and ready for apply.', {
            fingerprint: startupLayoutSnapshotState.fingerprint,
            savedAt: record.savedAt || null,
            positionCount: record.positions.length
        });
        maybeApplyStartupWarmSnapshot('restore-ready');
    })
    .catch((error) => {
        console.warn('[Startup Warm Snapshot] Restore load failed:', error && error.message ? error.message : String(error));
    });

// Optimization: Default to Canvas for large graphs (>3000 nodes) to save memory
if (nodes.length > 3000) {
    console.log(`[Optimization] Large graph detected (${nodes.length} nodes). Switching to Canvas mode.`);
    const canvasRadio = document.querySelector('input[name="rendererMode"][value="canvas"]');
    const svgRadio = document.querySelector('input[name="rendererMode"][value="svg"]');
    
    if (canvasRadio && svgRadio) {
        canvasRadio.checked = true;
        svgRadio.checked = false;
        
        // Manually trigger visibility update since listeners might not have fired yet
        // or just set initial state
        const svgEl = document.querySelector('#graph-container svg');
        const canvasEl = document.getElementById('graph-canvas');
        if (svgEl) svgEl.style.display = 'none';
        if (canvasEl) canvasEl.style.display = 'block';

        // v0.9.67 Fix: Force initial resize and tick to ensure canvas is drawn
        // The canvas needs to be sized and content rendered immediately
        setTimeout(() => {
             if (typeof resizeCanvas === 'function') resizeCanvas();
             if (typeof ticked === 'function') ticked();
             console.log("[Init] Forced initial Canvas render.");
        }, 100);
    }
}

// v0.9.67: Auto-enable Compact Mode for very large graphs
// Criteria: > 5000 Nodes OR > 100,000 Edges
if (nodes.length > 5000 || links.length > 100000) {
    console.log(`[Optimization] Massive graph detected (${nodes.length} nodes, ${links.length} edges). Enabling Compact Mode.`);
    // Only set if user hasn't explicitly saved a preference? 
    // For now, we enforce default if no setting exists or override for performance safety.
    // Let's check if settingsManager is available and update it.
    if (window.settingsManager) {
        // We set it but don't save it to localStorage to avoid persisting it permanently 
        // if the user switches to a small graph later? 
        // Actually, settings are global. 
        // Better: Update the runtime setting.
        window.settingsManager.set('performance', 'compactMode', true);
        
        // Also update UI if Settings Modal exists (might not be init yet)
        // The settings UI init code will read from settingsManager.
    }
}

// Update stats
document.getElementById('node-count').innerText = nodes.length;
document.getElementById('edge-count').innerText = links.length;

// Inject Filter Reset UI if needed
if (activeClusterFilter !== 'all') {
    const controls = document.getElementById('controls');
    const filterMsg = document.createElement('div');
    filterMsg.style.background = '#742a2a';
    filterMsg.style.color = 'white';
    filterMsg.style.padding = '5px';
    filterMsg.style.marginTop = '10px';
    filterMsg.style.borderRadius = '4px';
    filterMsg.style.fontSize = '0.85rem';
    filterMsg.style.display = 'flex';
    filterMsg.style.justifyContent = 'space-between';
    filterMsg.style.alignItems = 'center';
    filterMsg.innerHTML = `<span>Filter: <b>${activeClusterFilter}</b></span> <button id="clear-cluster-filter" style="font-size:0.8em; cursor:pointer;">X</button>`;
    
    // Insert after Search box
    const searchBox = document.querySelector('.search-box');
    searchBox.parentNode.insertBefore(filterMsg, searchBox.nextSibling);
    
    setTimeout(() => {
        document.getElementById('clear-cluster-filter').addEventListener('click', () => {
            localStorage.removeItem('activeClusterFilter');
            window.location.reload();
        });
    }, 100);
}

// Initialize Controls
const maxDegree = d3.max(nodes, d => d.inDegree + d.outDegree) || 0;
const minDegreeSlider = document.getElementById('min-degree-slider');
minDegreeSlider.max = maxDegree;
document.getElementById('min-degree-val').innerText = minDegreeSlider.value;

// v0.9.69 Fix: Move controls definition UP to prevent ResizeObserver/setTimeout race condition
// caused by renderCanvas accessing 'controls' before it was defined.
const controls = {
    minDegree: document.getElementById('min-degree-slider'),
    showOrphans: document.getElementById('show-orphans'),
    search: document.getElementById('search-input'),
    export: document.getElementById('export-btn')
};

// Simulation
// Initial Center
let width = container.clientWidth;
let height = container.clientHeight;

// Optimization: Limit Physics Edges
// For CPU physics (d3.forceLink), we must limit edges to prevent main thread freeze.
// For GPU physics (gpuLink), we can handle significantly more.
let physicsLinks = links;

function updatePhysicsLinks(settings) {
    const isGPUEnabled = settings && settings.performance && settings.performance.gpuRendering;
    const limit = isGPUEnabled ? 2000000 : 20000;
    
    if (links.length > limit) {
        console.log(`[Optimization] Too many edges (${links.length}). Limiting physics simulation to ${limit} to prevent freeze.`);
        physicsLinks = links.slice(0, limit); 
    } else {
        physicsLinks = links;
    }
}

// Initial update using current settings
if (window.settingsManager) {
    updatePhysicsLinks(settingsManager.settings);
} else {
    // Fallback default
    if (links.length > 20000) {
        console.warn(`[Optimization] Too many edges (${links.length}). Limiting physics simulation to 20000 (Safe Default).`);
        physicsLinks = links.slice(0, 20000);
    }
}

// Simulation Worker Setup
const simulationWorker = new Worker("simulationWorker.js");

// Position buffer for rendering
let currentPositions = new Map();
const startupTickApplyQueue = {
    frameHandle: null,
    pendingById: new Map(),
    pendingTickMode: 'delta',
    pendingStable: false
};

function buildStartupTickModeSummary() {
    const fullCount = Number(startupPerfState.tickModeSamples.full || 0);
    const deltaCount = Number(startupPerfState.tickModeSamples.delta || 0);
    const totalTickCount = fullCount + deltaCount;
    return {
        tickMessages: startupPerfState.tickMessagesReceived,
        tickFramesApplied: startupPerfState.tickFramesApplied,
        fullTicks: fullCount,
        deltaTicks: deltaCount,
        deltaRatio: totalTickCount > 0 ? Number((deltaCount / totalTickCount).toFixed(4)) : 0,
        avgPayloadNodes: startupPerfState.tickMessagesReceived > 0
            ? Number((startupPerfState.tickPayloadNodesTotal / startupPerfState.tickMessagesReceived).toFixed(2))
            : 0,
        maxPayloadNodes: startupPerfState.tickPayloadNodesMax,
        skippedEmptyDeltaFrames: startupPerfState.tickEmptyDeltaFramesSkipped
    };
}

function flushStartupTickApplyQueue() {
    startupTickApplyQueue.frameHandle = null;

    if (focusNode) {
        startupTickApplyQueue.pendingById.clear();
        startupTickApplyQueue.pendingTickMode = 'delta';
        startupTickApplyQueue.pendingStable = false;
        return;
    }

    let appliedCount = 0;
    startupTickApplyQueue.pendingById.forEach((payloadNode, nodeId) => {
        if (!payloadNode) {
            return;
        }

        const payloadIndex = Number(payloadNode.i);
        const hasValidIndex = Number.isInteger(payloadIndex) && payloadIndex >= 0 && payloadIndex < nodes.length;
        let originalNode = hasValidIndex ? nodes[payloadIndex] : null;
        if (!originalNode || originalNode.id !== nodeId) {
            originalNode = nodeMap.get(nodeId);
        }
        if (!originalNode) {
            return;
        }

        const nextX = Number.isFinite(Number(payloadNode.x)) ? Number(payloadNode.x) : originalNode.x;
        const nextY = Number.isFinite(Number(payloadNode.y)) ? Number(payloadNode.y) : originalNode.y;
        originalNode.x = nextX;
        originalNode.y = nextY;
        currentPositions.set(nodeId, { x: nextX, y: nextY });
        appliedCount += 1;
    });

    const shouldRender = appliedCount > 0 || startupTickApplyQueue.pendingTickMode !== 'delta';
    if (shouldRender) {
        ticked();
        startupPerfState.tickFramesApplied += 1;
    } else {
        startupPerfState.tickEmptyDeltaFramesSkipped += 1;
    }

    if (!startupPerfState.t4Seen && shouldRender) {
        startupPerfState.t4Seen = true;
        const rendererModeInput = document.querySelector('input[name="rendererMode"]:checked');
        const layoutModeInput = document.querySelector('input[name="layoutMode"]:checked');
        markStartupCheckpoint('T4 first_interactive_render', {
            renderer: rendererModeInput ? rendererModeInput.value : 'unknown',
            layout: layoutModeInput ? layoutModeInput.value : 'unknown'
        });
    }

    if (startupTickApplyQueue.pendingStable === true && !startupPerfState.t5Seen) {
        startupPerfState.t5Seen = true;
        markStartupCheckpoint('T5 stable_layout', {
            alpha: Number.isFinite(startupPerfState.lastWorkerAlpha) ? Number(startupPerfState.lastWorkerAlpha.toFixed(4)) : null,
            source: 'worker_tick',
            tickSummary: buildStartupTickModeSummary()
        });
        scheduleStartupLayoutSnapshotPersist('startup-stable-worker-tick');
    }

    startupTickApplyQueue.pendingById.clear();
    startupTickApplyQueue.pendingTickMode = 'delta';
    startupTickApplyQueue.pendingStable = false;
}

function scheduleStartupTickApplyFlush() {
    if (startupTickApplyQueue.frameHandle !== null) {
        return;
    }

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        startupTickApplyQueue.frameHandle = window.requestAnimationFrame(() => {
            flushStartupTickApplyQueue();
        });
    } else {
        startupTickApplyQueue.frameHandle = setTimeout(() => {
            flushStartupTickApplyQueue();
        }, 16);
    }
}

function queueStartupTickForApply(workerNodes, resolvedTickMode, isStartupStable) {
    if (resolvedTickMode === 'full') {
        startupTickApplyQueue.pendingById.clear();
        startupTickApplyQueue.pendingTickMode = 'full';
    } else if (startupTickApplyQueue.pendingTickMode !== 'full') {
        startupTickApplyQueue.pendingTickMode = 'delta';
    }

    for (let index = 0; index < workerNodes.length; index += 1) {
        const n = workerNodes[index];
        if (!n || n.id === undefined || n.id === null) {
            continue;
        }
        startupTickApplyQueue.pendingById.set(n.id, n);
    }

    if (isStartupStable === true) {
        startupTickApplyQueue.pendingStable = true;
    }
    scheduleStartupTickApplyFlush();
}

simulationWorker.onmessage = function(event) {
    const {
        type,
        nodes: workerNodes,
        alpha: workerAlpha,
        isStartupStable,
        isDelta,
        tickMode
    } = event.data;
    if (type === 'tick') {
        const safeWorkerNodes = Array.isArray(workerNodes) ? workerNodes : [];
        const resolvedTickMode = (typeof tickMode === 'string' && tickMode.length > 0)
            ? tickMode
            : (isDelta === true ? 'delta' : 'full');

        startupPerfState.tickMessagesReceived += 1;
        startupPerfState.tickPayloadNodesTotal += safeWorkerNodes.length;
        startupPerfState.tickPayloadNodesMax = Math.max(startupPerfState.tickPayloadNodesMax, safeWorkerNodes.length);

        if (!Object.prototype.hasOwnProperty.call(startupPerfState.tickModeSamples, resolvedTickMode)) {
            startupPerfState.tickModeSamples[resolvedTickMode] = 0;
        }
        startupPerfState.tickModeSamples[resolvedTickMode] += 1;

        if (!startupPerfState.t3Seen) {
            startupPerfState.t3Seen = true;
            markStartupCheckpoint('T3 first_tick_received', {
                alpha: Number.isFinite(workerAlpha) ? Number(workerAlpha.toFixed(4)) : null,
                tickMode: resolvedTickMode,
                payloadNodes: safeWorkerNodes.length
            });
        }

        if (Number.isFinite(workerAlpha)) {
            startupPerfState.lastWorkerAlpha = workerAlpha;
        }

        // v0.9.80: Ignore worker ticks in Focus Mode to prevent position overwrite
        // In Focus Mode, positions are managed by the main thread's highlightManager
        if (focusNode) return;
        queueStartupTickForApply(safeWorkerNodes, resolvedTickMode, isStartupStable === true);
    } else if (type === 'startupStable') {
        if (!startupPerfState.t5Seen) {
            startupPerfState.t5Seen = true;
            markStartupCheckpoint('T5 stable_layout', {
                alpha: Number.isFinite(workerAlpha) ? Number(workerAlpha.toFixed(4)) : null,
                source: 'worker_signal',
                tickSummary: buildStartupTickModeSummary()
            });
            scheduleStartupLayoutSnapshotPersist('startup-stable-worker-signal');
        }
    }
};

// Simulation Proxy to mimic D3 API for compatibility
const simulation = {
    force: (name, ...args) => {
        // Simplified proxy: We only support specific updates via messages
        // If args provided, it's a setter.
        // This is complex because d3 uses chaining and function arguments.
        // We will refactor usage sites instead of perfect proxying.
        return simulation; // Chaining
    },
    alpha: (a) => {
        if (a !== undefined) {
             const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
             if (isFrozen) {
                 console.log("[Simulation] Alpha update blocked by Freeze Layout.");
                 return simulation;
             }
             simulationWorker.postMessage({ type: 'updateParams', payload: { alpha: a, restart: true } });
             return simulation;
        }
        return 0; // Dummy
    },
    alphaTarget: (a) => {
         // Used in drag
         // We handle drag separately
         return simulation; 
    },
    restart: () => {
        const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
        if (isFrozen) {
            console.log("[Simulation] Restart blocked by Freeze Layout.");
            return simulation;
        }
        simulationWorker.postMessage({ type: 'restart', payload: {} });
        return simulation; 
    },
    stop: () => {
        simulationWorker.postMessage({ type: 'stop', payload: {} });
        return simulation;
    },
    velocityDecay: (d) => {
        if (d !== undefined) {
            // Decay updates are fine, but don't auto-restart if frozen
            simulationWorker.postMessage({ type: 'updateParams', payload: { velocityDecay: d } });
            return simulation;
        }
        return 0.2; // Dummy default
    },
    nodes: () => nodes // Return reference to main thread nodes
};

// Initialize Worker
// Send simplified data structure (avoid circular refs)
const workerPayloadBuildStartTs = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();
restoreSourceLayoutOrJitterNodes(nodes, width, height, 'worker-init');
const workerNodes = new Array(nodes.length);
for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
    const node = nodes[nodeIndex];
    const hasX = Number.isFinite(Number(node && node.x));
    const hasY = Number.isFinite(Number(node && node.y));
    workerNodes[nodeIndex] = {
        id: node.id,
        x: hasX ? Number(node.x) : Math.random() * width,
        y: hasY ? Number(node.y) : Math.random() * height,
        fx: node.fx,
        fy: node.fy,
        rank: node.rank,
    };
}
const workerLinks = new Array(physicsLinks.length);
for (let linkIndex = 0; linkIndex < physicsLinks.length; linkIndex += 1) {
    const link = physicsLinks[linkIndex];
    workerLinks[linkIndex] = {
        source: link.source.id,
        target: link.target.id,
    };
}
const workerPayloadBuildElapsedMs = ((typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now()) - workerPayloadBuildStartTs;
console.log(`[Init Perf] Worker payload prepared in ${workerPayloadBuildElapsedMs.toFixed(2)}ms (workerNodes=${workerNodes.length}, workerLinks=${workerLinks.length}).`);

const workerStartupProfile = {
    id: startupPerfProfile.id,
    pilotEnabled: startupPerfProfile.pilotEnabled === true,
    tickMaxFps: startupPerfProfile.tickMaxFps,
    lowAlphaTickMaxFps: startupPerfProfile.lowAlphaTickMaxFps,
    lowAlphaThreshold: startupPerfProfile.lowAlphaThreshold,
    stableAlphaThreshold: startupPerfProfile.stableAlphaThreshold,
    stableHoldTicks: startupPerfProfile.stableHoldTicks,
    stableTimeoutMs: startupPerfProfile.stableTimeoutMs,
    deltaEnabled: startupPerfProfile.deltaTickEnabled === true,
    deltaEpsilonPx: startupPerfProfile.deltaEpsilonPx,
    fullSyncEveryTicks: startupPerfProfile.deltaFullSyncEveryTicks,
    lowAlphaDeltaEpsilonMultiplier: startupPerfProfile.deltaLowAlphaEpsilonMultiplier,
    lowAlphaFullSyncEveryTicks: startupPerfProfile.deltaLowAlphaFullSyncEveryTicks
};

markStartupCheckpoint('T2 worker_init_sent', {
    workerNodes: workerNodes.length,
    workerLinks: workerLinks.length,
    profile: workerStartupProfile.id,
    tickMaxFps: workerStartupProfile.tickMaxFps,
    deltaEnabled: workerStartupProfile.deltaEnabled,
    deltaFullSyncEveryTicks: workerStartupProfile.fullSyncEveryTicks,
    deltaLowAlphaEpsilonMultiplier: workerStartupProfile.lowAlphaDeltaEpsilonMultiplier,
    deltaLowAlphaFullSyncEveryTicks: workerStartupProfile.lowAlphaFullSyncEveryTicks
});
simulationWorker.postMessage({ 
    type: 'init', 
    payload: { 
        nodes: workerNodes, 
        links: workerLinks, 
        width, 
        height,
            settings: {
                repulsion: -300,
                distance: 100,
                velocityDecay: 0.2,
                gpuRendering: (window.settingsManager ? window.settingsManager.settings.performance.gpuRendering : true)
            },
            startupProfile: workerStartupProfile
    } 
});
maybeApplyStartupWarmSnapshot('after-worker-init');

// v0.9.37: Two-stage Damping Strategy handled in worker or re-implemented here?
// Re-implementing logic via messages
setTimeout(() => {
    // We assume default hasn't changed manually
    // Send update
    simulationWorker.postMessage({ type: 'updateParams', payload: { velocityDecay: 0.95 } });
    
    // Sync UI
    if (typeof simSpeedSlider !== 'undefined' && simSpeedSlider) {
        simSpeedSlider.value = 0.95;
        if (typeof simSpeedVal !== 'undefined' && simSpeedVal) {
             simSpeedVal.innerText = "0.95";
        }
    }
    
    // Static Mode Enforcement
    if (nodes.length > 5000 || links.length > 200000) {
         console.log("[Simulation] Large graph detected. Freezing simulation after relaxation.");
        simulation.stop();
    }
}, 2000);

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            scheduleStartupLayoutSnapshotPersist('visibility-hidden', 0);
        }
    });
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', () => {
        scheduleStartupLayoutSnapshotPersist('beforeunload', 0);
    });
}

// Handle Resize
const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        width = entry.contentRect.width;
        height = entry.contentRect.height;
        
        if (typeof resizeCanvas === 'function') resizeCanvas();

        // v0.9.75: Skip layout updates if in Focus Mode to maintain static state
        if (focusModeState && focusModeState.active) {
            console.log("[Resize] Focus Mode active. Skipping layout update.");
            // Optional: Re-center focus node? For now, just render.
            ticked();
            return;
        }

        const mode = document.querySelector('input[name="layoutMode"]:checked') ? document.querySelector('input[name="layoutMode"]:checked').value : 'force';
        
        // Send layout update to worker
        // We reuse the updateLayout logic which now sends messages
        updateLayout(); 
        
        const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
        if (!isFrozen) {
            simulation.restart();
        }
    }
});
resizeObserver.observe(container);

// Arrows for edges
const defs = svg.append("defs");
const markers = [
    { id: "arrow", color: "#555" },
    { id: "arrow-in", color: "#ff6b6b" },
    { id: "arrow-out", color: "#4488ff" }
];

defs.selectAll("marker")
    .data(markers)
    .enter().append("marker")
    .attr("id", d => d.id)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15) // Position of arrow
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", d => d.color);

// Render Links
const link = g.append("g")
    .attr("class", "links")
    .selectAll("path")
    .data(links)
    .enter().append("path")
    .attr("class", "link")
    .attr("marker-end", "url(#arrow)");

function buildStartupStage1LinkSet(allNodes, allLinks, topK) {
    if (!Array.isArray(allLinks) || allLinks.length === 0) {
        return null;
    }
    const normalizedTopK = Math.max(0, Math.floor(Number(topK) || 0));
    if (normalizedTopK <= 0 || normalizedTopK >= allLinks.length) {
        return null;
    }

    const topNodeCount = Math.min(Math.max(normalizedTopK, 64), Math.max(64, Math.floor(allNodes.length * 0.08)));
    const sortedNodes = allNodes
        .map((n) => ({
            id: n.id,
            score: Number.isFinite(Number(n.centrality))
                ? Number(n.centrality)
                : Number((n.inDegree || 0) + (n.outDegree || 0))
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topNodeCount);
    const topNodeIds = new Set(sortedNodes.map((item) => item.id));

    const selectedLinks = [];
    for (let index = 0; index < allLinks.length && selectedLinks.length < normalizedTopK; index += 1) {
        const edge = allLinks[index];
        const sourceId = edge && edge.source && typeof edge.source === 'object' ? edge.source.id : edge.source;
        const targetId = edge && edge.target && typeof edge.target === 'object' ? edge.target.id : edge.target;
        if (topNodeIds.has(sourceId) || topNodeIds.has(targetId)) {
            selectedLinks.push(edge);
        }
    }

    if (selectedLinks.length < normalizedTopK) {
        for (let index = 0; index < allLinks.length && selectedLinks.length < normalizedTopK; index += 1) {
            const edge = allLinks[index];
            if (!selectedLinks.includes(edge)) {
                selectedLinks.push(edge);
            }
        }
    }

    return new Set(selectedLinks);
}

const startupStage1TopK = Math.max(
    0,
    Math.floor(
        Number.isFinite(startupPerfProfile.edgeStage1TopK) && startupPerfProfile.edgeStage1TopK > 0
            ? startupPerfProfile.edgeStage1TopK
            : startupPerfProfile.edgeStartupSvgCap
    )
);
const startupStage1LinkSet = buildStartupStage1LinkSet(nodes, links, startupStage1TopK);
let startupSvgStage1LinkSelection = link;
if (startupStage1LinkSet && startupStage1LinkSet.size > 0 && startupStage1LinkSet.size < links.length) {
    startupSvgStage1LinkSelection = link.filter((edgeDatum) => startupStage1LinkSet.has(edgeDatum));
    console.log('[Startup Perf] Startup SVG key-edge stage prepared.', {
        totalLinks: links.length,
        stage1Links: startupStage1LinkSet.size,
        stage1TopK: startupStage1TopK
    });
}

// Render Nodes
const node = g.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(nodes)
    .enter().append("g")
    .attr("class", "node")
    .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

// Node Circles (Color by degree)
// Scales
const colorScaleDegree = d3.scaleSequential(d3.interpolateBlues)
    .domain([0, maxDegree]);

const uniqueClusters = Array.from(new Set(nodes.map(d => d.clusterId))).sort();
const colorScaleCluster = d3.scaleOrdinal(d3.schemeCategory10)
    .domain(uniqueClusters);

// Size Scale
const maxCentrality = d3.max(nodes, d => d.centrality || 0) || 1;
const sizeScaleCentrality = d3.scaleSqrt()
    .domain([0, maxCentrality])
    .range([3, 12]); // Min 3px, Max 12px

const circles = node.append("circle")
    .attr("r", 5);

// Labels
const texts = node.append("text")
    .attr("dx", 8)
    .attr("dy", ".35em")
    .text(d => d.label);

// Initialize Node Highlight Manager
// 初始化节点高亮管理器
const focusModeState = { active: false, node: null };
const highlightManager = window.createNodeHighlightManager({
    nodes: nodes,
    links: links,
    nodeSelection: node,
    linkSelection: link,
    tooltip: tooltip,
    simulation: simulation,
    onTick: ticked
});
window.highlightManager = highlightManager;

// Update focus mode state helper
// 更新专注模式状态辅助函数
function updateFocusModeState(active, node = null) {
    focusModeState.active = active;
    focusModeState.node = node;
    highlightManager.setFocusMode(focusModeState);
}

function isGraphA11yZhMode() {
    if (!window.i18n || !window.i18n.currentLanguage) {
        return false;
    }
    return String(window.i18n.currentLanguage).toLowerCase().startsWith('zh');
}

function getRuntimeAppConfig() {
    if (
        window.NoteConnectionRuntime &&
        typeof window.NoteConnectionRuntime.getAppRuntimeConfig === 'function'
    ) {
        return window.NoteConnectionRuntime.getAppRuntimeConfig();
    }
    if (window.__NC_APP_CONFIG && typeof window.__NC_APP_CONFIG === 'object') {
        return window.__NC_APP_CONFIG;
    }
    return null;
}

function resolveRuntimeMultiWindowOptions() {
    const defaults = {
        singleWindowMode: true,
        hideTauriWhenPathmodeOpens: true,
        restoreTauriWhenPathmodeExits: true,
        confirmBeforeFullShutdownFromGodot: true,
        syncLanguage: true
    };
    const config = getRuntimeAppConfig();
    if (!config || typeof config !== 'object' || !config.multiWindow || typeof config.multiWindow !== 'object') {
        return defaults;
    }
    const next = { ...defaults };
    Object.keys(defaults).forEach((key) => {
        if (typeof config.multiWindow[key] === 'boolean') {
            next[key] = config.multiWindow[key];
        }
    });
    return next;
}

function getGraphRendererMode() {
    const checked = document.querySelector('input[name="rendererMode"]:checked');
    if (!checked || (checked.value !== 'svg' && checked.value !== 'canvas')) {
        return 'svg';
    }
    return checked.value;
}

function resolveGraphEndpointId(endpoint) {
    if (!endpoint) {
        return '';
    }
    if (typeof endpoint === 'object' && endpoint.id) {
        return String(endpoint.id);
    }
    if (typeof endpoint === 'string') {
        return endpoint;
    }
    return '';
}

function resolveGraphNodeLabel(nodeRef) {
    if (!nodeRef) {
        return '';
    }
    const label = nodeRef.label || nodeRef.id || '';
    return String(label).trim();
}

function ensureGraphSemanticA11y() {
    const zh = isGraphA11yZhMode();
    const hostId = 'graph-semantic-shadow';
    let host = document.getElementById(hostId);
    const graphContainer = document.getElementById('graph-container');
    if (!graphContainer) {
        return null;
    }

    const regionLabel = zh ? '图谱语义摘要' : 'Graph semantic summary';
    graphContainer.setAttribute('role', 'group');
    graphContainer.setAttribute('aria-label', regionLabel);

    const graphCanvas = document.getElementById('graph-canvas');
    if (graphCanvas) {
        graphCanvas.setAttribute('aria-label', zh ? '图谱画布渲染视图' : 'Graph canvas renderer view');
    }

    const graphSvg = graphContainer.querySelector('svg');
    if (graphSvg) {
        graphSvg.setAttribute('aria-label', zh ? '图谱矢量渲染视图' : 'Graph SVG renderer view');
    }

    if (host) {
        host.setAttribute('aria-label', regionLabel);
        return host;
    }

    host = document.createElement('section');
    host.id = hostId;
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', regionLabel);
    host.style.position = 'absolute';
    host.style.width = '1px';
    host.style.height = '1px';
    host.style.padding = '0';
    host.style.margin = '-1px';
    host.style.overflow = 'hidden';
    host.style.clip = 'rect(0 0 0 0)';
    host.style.clipPath = 'inset(50%)';
    host.style.whiteSpace = 'nowrap';
    host.style.border = '0';

    const summary = document.createElement('p');
    summary.id = 'graph-semantic-summary';
    summary.textContent = '';

    const live = document.createElement('div');
    live.id = 'graph-semantic-live';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');

    host.appendChild(summary);
    host.appendChild(live);
    graphContainer.appendChild(host);
    return host;
}

function buildGraphSemanticSummary() {
    const zh = isGraphA11yZhMode();
    const rendererMode = getGraphRendererMode();
    const rendererLabel = rendererMode === 'canvas'
        ? (zh ? '画布' : 'canvas')
        : (zh ? '矢量' : 'svg');

    const totalNodes = Array.isArray(nodes) ? nodes.length : 0;
    const minDegree = controls && controls.minDegree
        ? (Number.parseInt(controls.minDegree.value, 10) || 0)
        : 0;
    const showOrphans = !!(controls && controls.showOrphans && controls.showOrphans.checked);
    const searchTerm = controls && controls.search
        ? String(controls.search.value || '').trim()
        : '';
    const clusterFilter = activeClusterFilter || 'all';
    const hasActiveFilters = (
        minDegree > 0
        || !showOrphans
        || searchTerm.length > 0
        || clusterFilter !== 'all'
    );

    let visibleNodeCount = 0;
    let visibleNodeIds = null;
    if (!hasActiveFilters && !focusNode) {
        visibleNodeCount = totalNodes;
    } else {
        visibleNodeIds = new Set();
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
            const nodeRef = nodes[nodeIndex];
            if (!isNodeVisible(nodeRef)) {
                continue;
            }
            visibleNodeCount += 1;
            if (nodeRef && nodeRef.id) {
                visibleNodeIds.add(nodeRef.id);
            }
        }
    }

    const highlightState = window.highlightManager && typeof window.highlightManager.getState === 'function'
        ? window.highlightManager.getState()
        : null;
    const selectedNode = highlightState && highlightState.currentNode ? highlightState.currentNode : null;
    const focusLabel = focusNode ? resolveGraphNodeLabel(focusNode) : '';
    const selectedLabel = selectedNode ? resolveGraphNodeLabel(selectedNode) : '';
    const focusId = focusNode ? String(focusNode.id || '') : '';
    const selectedId = selectedNode ? String(selectedNode.id || '') : '';

    let visibleEdgeCount = 0;
    if (focusNode && rendererMode === 'svg') {
        const activeVisibleNodeIds = visibleNodeIds || new Set();
        links.forEach((edge) => {
            const sourceId = resolveGraphEndpointId(edge ? edge.source : null);
            const targetId = resolveGraphEndpointId(edge ? edge.target : null);
            if (!sourceId || !targetId) {
                return;
            }
            if (activeVisibleNodeIds.has(sourceId) && activeVisibleNodeIds.has(targetId)) {
                visibleEdgeCount += 1;
            }
        });
    } else if (!focusNode && selectedNode && window.highlightManager && typeof window.highlightManager.getCurrentConnections === 'function') {
        const connections = window.highlightManager.getCurrentConnections();
        if (connections && Array.isArray(connections.links)) {
            visibleEdgeCount = connections.links.length;
        }
    } else if (!hasActiveFilters && !focusNode) {
        visibleEdgeCount = links.length;
    }

    const parts = [];
    if (zh) {
        parts.push(`渲染模式 ${rendererLabel}`);
        parts.push(`可见节点 ${visibleNodeCount}/${totalNodes}`);
        parts.push(`可见连接 ${visibleEdgeCount}`);
        parts.push(focusLabel ? `专注节点 ${focusLabel}` : '专注模式 未启用');
        parts.push(selectedLabel ? `已选节点 ${selectedLabel}` : '已选节点 无');
        parts.push(`筛选 最小度 ${minDegree}`);
        parts.push(showOrphans ? '孤立节点 显示' : '孤立节点 隐藏');
        parts.push(clusterFilter === 'all' ? '簇过滤 全部' : `簇过滤 ${clusterFilter}`);
        if (searchTerm) {
            parts.push(`搜索 ${searchTerm}`);
        }
    } else {
        parts.push(`Renderer ${rendererLabel}`);
        parts.push(`Visible nodes ${visibleNodeCount} of ${totalNodes}`);
        parts.push(`Visible edges ${visibleEdgeCount}`);
        parts.push(focusLabel ? `Focus node ${focusLabel}` : 'Focus mode inactive');
        parts.push(selectedLabel ? `Selected node ${selectedLabel}` : 'Selected node none');
        parts.push(`Filters min degree ${minDegree}`);
        parts.push(showOrphans ? 'Orphan nodes shown' : 'Orphan nodes hidden');
        parts.push(clusterFilter === 'all' ? 'Cluster filter all' : `Cluster filter ${clusterFilter}`);
        if (searchTerm) {
            parts.push(`Search ${searchTerm}`);
        }
    }

    return {
        key: [
            zh ? 'zh' : 'en',
            rendererMode,
            visibleNodeCount,
            totalNodes,
            visibleEdgeCount,
            focusId,
            selectedId,
            minDegree,
            showOrphans ? '1' : '0',
            clusterFilter,
            searchTerm
        ].join('|'),
        text: parts.join('. ') + '.'
    };
}

function refreshGraphSemanticA11y(reason = '') {
    const host = ensureGraphSemanticA11y();
    if (!host) {
        return;
    }

    const summaryEl = document.getElementById('graph-semantic-summary');
    const liveEl = document.getElementById('graph-semantic-live');
    if (!summaryEl || !liveEl) {
        return;
    }

    const snapshot = buildGraphSemanticSummary();
    summaryEl.textContent = snapshot.text;
    if (snapshot.key === graphSemanticA11yState.lastSummaryKey) {
        return;
    }

    const now = Date.now();
    if ((now - graphSemanticA11yState.lastAnnouncementAt) < 250) {
        return;
    }

    const reasonText = typeof reason === 'string' ? reason.trim() : '';
    liveEl.textContent = reasonText ? `${reasonText}: ${snapshot.text}` : snapshot.text;
    graphSemanticA11yState.lastSummaryKey = snapshot.key;
    graphSemanticA11yState.lastAnnouncementAt = now;
}

function scheduleGraphSemanticA11yRefresh(reason = '') {
    const reasonText = typeof reason === 'string' ? reason.trim() : '';
    if (reasonText) {
        graphSemanticA11yState.pendingReason = reasonText;
    }

    if (graphSemanticA11yState.pendingTimer !== null) {
        return;
    }

    graphSemanticA11yState.pendingTimer = window.setTimeout(() => {
        graphSemanticA11yState.pendingTimer = null;
        const pendingReason = graphSemanticA11yState.pendingReason;
        graphSemanticA11yState.pendingReason = '';
        refreshGraphSemanticA11y(pendingReason);
    }, 120);
}

// Initial State
updateColor();
updateSize();
ensureGraphSemanticA11y();
updateVisibility('Graph initialized'); // v1.0.2: Enforce initial visibility state (edges hidden)

// Version Info
const APP_VERSION = "1.0.0";
const controlsPanelEl = document.getElementById('controls');
if (controlsPanelEl) {
    const versionEl = document.createElement('div');
    versionEl.style.marginTop = '15px';
    versionEl.style.borderTop = '1px solid #444';
    versionEl.style.paddingTop = '10px';
    versionEl.style.fontSize = '0.7rem';
    versionEl.style.color = '#666';
    versionEl.style.textAlign = 'center';
    versionEl.innerText = `v${APP_VERSION}`;
    controlsPanelEl.appendChild(versionEl);
}


// Helper to get degree based on selection
function getDegree(d) {
    const mode = document.querySelector('input[name="degreeMode"]:checked').value;
    if (mode === 'in') return d.inDegree || 0;
    if (mode === 'out') return d.outDegree || 0;
    return (d.inDegree || 0) + (d.outDegree || 0);
}

function updateColor() {
    const mode = document.querySelector('input[name="colorMode"]:checked').value;
    if (mode === 'cluster') {
        circles.attr("fill", d => colorScaleCluster(d.clusterId || 'unknown'));
    } else {
        // Update domain based on current max degree
        const maxDeg = d3.max(nodes, d => getDegree(d)) || 1;
        colorScaleDegree.domain([0, maxDeg]);
        circles.attr("fill", d => colorScaleDegree(getDegree(d)));
    }
}

function updateSize() {
    const mode = document.querySelector('input[name="sizeMode"]:checked').value;
    
    if (mode === 'centrality') {
        // Node Size by Centrality
        circles.transition().duration(300).attr("r", d => sizeScaleCentrality(d.centrality || 0));
        
        texts.transition().duration(300)
             .attr("font-size", d => Math.max(10, sizeScaleCentrality(d.centrality || 0) * 1.2) + "px")
             .attr("font-weight", d => (d.centrality || 0) > maxCentrality * 0.5 ? "bold" : "normal")
             .attr("dx", d => sizeScaleCentrality(d.centrality || 0) + 4);

        simulation.force("collide", d3.forceCollide().radius(d => sizeScaleCentrality(d.centrality || 0) + 5));
    
    } else if (mode === 'degree') {
        // Node Size by Degree
        const maxDeg = d3.max(nodes, d => getDegree(d)) || 1;
        const sizeScaleDegree = d3.scaleSqrt().domain([0, maxDeg]).range([3, 12]);

        circles.transition().duration(300).attr("r", d => sizeScaleDegree(getDegree(d)));
        
        texts.transition().duration(300)
             .attr("font-size", d => Math.max(10, sizeScaleDegree(getDegree(d)) * 1.2) + "px")
             .attr("dx", d => sizeScaleDegree(getDegree(d)) + 4);

        simulation.force("collide", d3.forceCollide().radius(d => sizeScaleDegree(getDegree(d)) + 5));

    } else {
        // Uniform
        circles.transition().duration(300).attr("r", 5);
        texts.transition().duration(300)
             .attr("font-size", "10px")
             .attr("font-weight", "normal")
             .attr("dx", 8);
        
        simulation.force("collide", d3.forceCollide().radius(8));
    }
    
    // v0.9.36: Check Freeze Layout State before restarting
    // Requirement: "when I modified 'Degree Basis' or 'Size By', the node started to move again... node should not start to move"
    const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
    if (!isFrozen) {
        simulation.alpha(0.3).restart();
    } else {
        console.log("[Simulation] Restart blocked by Freeze Layout.");
    }
}

// Layout State Caching (v0.9.33)
const layoutCache = { force: null, dag: null };
let currentLayoutMode = 'force'; // Default start mode
let isLayoutSwitching = false; // v0.9.82: Handshake flag

function cacheLayoutState(mode) {
    console.log(`[Layout] Caching state for mode: ${mode} (${nodes.length} nodes)`);
    // Deep copy specific properties
    layoutCache[mode] = nodes.map(n => ({
        id: n.id,
        x: n.x, y: n.y,
        fx: n.fx, fy: n.fy,
        vx: n.vx, vy: n.vy
    }));
}

function restoreLayoutState(mode) {
    console.log(`[Layout] Attempting to restore mode: ${mode}`);
    if (!layoutCache[mode]) {
        console.log(`[Layout] No cache found for ${mode}`);
        return false;
    }
    
    const cacheMap = new Map(layoutCache[mode].map(c => [c.id, c]));
    let restoredCount = 0;

    nodes.forEach(n => {
        const c = cacheMap.get(n.id);
        if (c) {
            n.x = c.x; n.y = c.y;
            n.fx = c.fx; n.fy = c.fy;
            n.vx = c.vx; n.vy = c.vy;
            restoredCount++;
        }
    });
    console.log(`[Layout] Restored ${restoredCount}/${nodes.length} nodes from cache`);
    // v0.9.81: Strict restoration check. If we lost most nodes (filter?), treat as cache miss.
    return restoredCount > (nodes.length * 0.5);
}

function updateLayout() {
    const newMode = document.querySelector('input[name="layoutMode"]:checked').value;
    
    // v0.9.79: Prevent layout shift on resize when frozen
    // If mode hasn't changed and we are frozen, do not re-send layout params (which resets center).
    const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
    if (newMode === currentLayoutMode && isFrozen) {
        console.log("[Layout] Update blocked by Freeze Layout.");
        return;
    }

    console.log(`[Layout] Switching from ${currentLayoutMode} to ${newMode}`);
    
    // 1. Cache previous state if mode changed
    if (newMode !== currentLayoutMode) {
        cacheLayoutState(currentLayoutMode);
        currentLayoutMode = newMode;
    }

    // Prepare settings for worker
    const settings = settingsManager ? settingsManager.settings.physics : {};

    // 2. Attempt to Restore State
    // 2. Attempt to Restore State
    const hasCache = !!layoutCache[newMode];
    let restored = false;

    if (hasCache) {
        restored = restoreLayoutState(newMode);
    }
    
    // v0.9.81: User Logic - If cache exists and valid, use it. Else restart (relax).
    // If restore failed (restored=false) even if hasCache=true, we MUST restart.
    const shouldRestart = !restored;

    // Send command to worker
    simulationWorker.postMessage({ 
        type: 'updateLayout', 
        payload: { 
            mode: newMode, 
            width, 
            height,
            settings: { 
                repulsion: settings.repulsionForce || -300, 
             },
            restart: shouldRestart // Restart if no cache OR restore failed
        } 
    });

    // 3. Simulation Control
    if (restored) {
        // IMMEDIATE UI UPDATE: Render the restored state instantly
        ticked();

        console.log("[Layout] State restored. Syncing worker in background.");
        
        // v0.9.82: Remove setTimeout to prioritize sync and prevent stale ticks.
        // We use a handshake to ignore ticks until this sync is complete.
        isLayoutSwitching = true; // Block ticks

        // Sync Worker with restored positions
        const workerNodes = nodes.map(n => ({
            id: n.id,
            x: n.x, y: n.y,
            fx: n.fx, fy: n.fy,
            vx: n.vx, vy: n.vy,
            rank: n.rank 
        }));
        
        simulationWorker.postMessage({
            type: 'setNodes',
            payload: {
                nodes: workerNodes,
                links: physicsLinks.map(l => ({ source: l.source.id, target: l.target.id })),
                restart: false // keep stopped
            }
        });

        // Ensure it stays stopped
        simulationWorker.postMessage({ type: 'stop' });
        
        // Send handshake
        simulationWorker.postMessage({ type: 'layoutSwitchDone' });
                   
    } else {
        // v0.9.34: Force Unfreeze
        nodes.forEach(n => {
            n.fx = null;
            n.fy = null;
            n.isCulled = false; 
        });
        
        // Notify worker to unfix all nodes (except dragged ones? logic needed)
        // For now, assume unfix all.
        // simulationWorker.postMessage({ type: 'fixNodes', payload: nodes.map(n => ({id: n.id, cmd: 'unfix'})) });

        // v0.9.39: Rapid Relaxation on Layout Switch (Only for FRESH layouts)
        simulationWorker.postMessage({ type: 'updateParams', payload: { velocityDecay: 0.2, restart: true } });

        setTimeout(() => {
             simulationWorker.postMessage({ type: 'updateParams', payload: { velocityDecay: 0.95 } });
             
             // Sync UI
             if (typeof simSpeedSlider !== 'undefined' && simSpeedSlider) {
                simSpeedSlider.value = 0.95;
                if (typeof simSpeedVal !== 'undefined' && simSpeedVal) {
                    simSpeedVal.innerText = "0.95";
                }
            }

            const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
            const isLargeGraph = nodes.length > 5000 || links.length > 200000;
            
            if (isFrozen || isLargeGraph) {
                if (isLargeGraph) console.log("[Simulation] Large graph detected. Freezing simulation after layout switch.");
                simulationWorker.postMessage({ type: 'stop', payload: {} });
            }
        }, 2000);
    }
}

// Listeners
document.querySelectorAll('input[name="layoutMode"]').forEach(radio => {
    radio.addEventListener('change', updateLayout);
});

document.querySelectorAll('input[name="colorMode"]').forEach(radio => {
    radio.addEventListener('change', updateColor);
});
document.querySelectorAll('input[name="sizeMode"]').forEach(radio => {
    radio.addEventListener('change', updateSize);
});
document.querySelectorAll('input[name="degreeMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
        updateColor(); // Color might depend on degree mode
        updateSize();  // Size might depend on degree mode
    });
});

// Localization
// Localization is now handled by i18n.js
// We just need to listen for changes to update dynamic UI components like Analysis Panel
if (window.i18n) {
    window.i18n.onLanguageChange((newLang) => {
        if (typeof window.updateAnalysisUI === 'function') {
            window.updateAnalysisUI();
        }
        if (window.pathApp && typeof window.pathApp.syncLanguageWithBridge === 'function') {
            window.pathApp.syncLanguageWithBridge(newLang);
        }
        scheduleGraphSemanticA11yRefresh('Language changed');
    });
}

// Language Selector in Settings
const langSelect = document.getElementById('set-language');
if (langSelect) {
    // Sync with i18n on load
    if (window.i18n && window.i18n.currentLanguage) {
        langSelect.value = window.i18n.currentLanguage;
    }
    
    // Listen for changes from the dropdown
    langSelect.addEventListener('change', async (e) => {
        const newLang = e.target.value;
        if (window.i18n) {
            await window.i18n.setLanguage(newLang);
        } else {
            window.updateLanguage(newLang);
        }
    });
    
    // Also sync when language changes externally (e.g., from language selector modal)
    if (window.i18n && window.i18n.onLanguageChange) {
        window.i18n.onLanguageChange((newLang) => {
            if (langSelect.value !== newLang) {
                langSelect.value = newLang;
            }
        });
    }
}


// v0.9.45: View Mode Removed
// Cluster aggregation logic removed.

// Simulation Controls
const simSpeedSlider = document.getElementById('sim-speed-slider');
const simSpeedVal = document.getElementById('sim-speed-val');
const freezeLayoutCheckbox = document.getElementById('freeze-layout');

if (simSpeedSlider) {
    simSpeedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        simSpeedVal.innerText = val;
        // D3 velocityDecay: 1 = frictionless, 0 = frozen? No.
        // D3: velocityDecay(0.4) is default. 
        // We map slider 0-1 to reasonable decay. 
        // Let's treat slider as "Friction": 1 = high friction (stop), 0 = low friction.
        // Actually, d3.velocityDecay corresponds to (1 - friction) per tick.
        // Standard range [0, 1]. 
        simulation.velocityDecay(val);
        simulation.alphaTarget(0.3).restart();
    });
}

if (freezeLayoutCheckbox) {
    freezeLayoutCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            simulation.stop();
            // Optional: Fix all nodes in place to be sure?
            // simulation.nodes().forEach(d => { d.fx = d.x; d.fy = d.y; });
        } else {
            // Release nodes? Only if we fixed them. 
            // For now, just restart.
            simulation.alphaTarget(0.3).restart();
        }
    });
}

// Interactions
let transform = d3.zoomIdentity;
let clickTimer = null;

// Event Handlers using highlightManager
// 使用highlightManager的事件处理器
node.on("mouseover", function(event, d) {
    const state = highlightManager.getState();
    if (!state.isFrozen && !focusModeState.active) {
        highlightManager.highlight(d, { event: event });
    }
}).on("mouseout", function(event, d) {
    const state = highlightManager.getState();
    if (!state.isFrozen && !focusModeState.active) {
        highlightManager.unhighlight();
    }
}).on("dblclick", (event) => event.stopPropagation());

// Click & Double Click Logic
node.on("click", (event, d) => {
    if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        // Double Click Detected
        handleDoubleClick(event, d);
    } else {
        clickTimer = setTimeout(() => {
            clickTimer = null;
            // Single Click Detected
            handleSingleClick(event, d);
        }, 250); // 250ms delay to wait for potential second click
    }
    event.stopPropagation();
});

function handleSingleClick(event, d) {
    // Requirement: "this effect does not exist in 'Focus mode'"
    if (focusNode) return;

    // Use highlightManager with freeze option
    // 使用带冻结选项的highlightManager
    highlightManager.highlight(d, { 
        event: event, 
        freeze: true 
    });
    
    // Show Statistics Panel (Floating Popup)
    // 显示统计弹窗
    showNodePopup(d.id);
    scheduleGraphSemanticA11yRefresh('Node selected');
}

function handleDoubleClick(event, d) {
    // Requirement: Double Click enters Focus Mode
    // 要求：双击进入专注模式
    // v0.9.19 Fix: Allow re-entering focus mode for different nodes
    // v0.9.19 修复：允许为不同节点重新进入专注模式
    // v0.9.20 Enhancement: Auto-clear selection state when entering focus mode
    // v0.9.20 增强：进入专注模式时自动清除选择状态
    
    if (focusNode && focusNode.id === d.id) {
        // Already focused on same node -> Open Reader
        // 已经专注于同一节点 -> 打开阅读器
        if (window.reader) window.reader.open(d);
    } else {
        // Clear any existing selection/highlight state before entering focus mode
        // 在进入专注模式前清除任何现有的选择/高亮状态
        if (window.highlightManager) {
            window.highlightManager.unhighlight({ force: true });
        }
        
        // Hide statistics popup if visible
        // 如果统计弹窗可见则隐藏
        const popup = document.getElementById('node-stats-popup');
        if (popup && popup.style.display !== 'none') {
            popup.style.display = 'none';
        }
        
        // Enter or Re-enter Focus Mode for new node
        // 为新节点进入或重新进入专注模式
        // This properly handles the case when double-clicking a related node while in focus mode
        // 这正确处理了在专注模式下双击相关节点的情况
        enterFocusMode(d);
    }
}


// --- Node Statistics Popup Logic ---
// --- 节点统计弹窗逻辑 ---
const statsPopup = document.getElementById('node-stats-popup');
const popupCloseBtn = document.getElementById('popup-close-btn');

// Popup drag functionality / 弹窗拖动功能
// v0.9.19: Add draggable support for statistics popup
// v0.9.19: 为统计弹窗添加可拖动支持
let popupDragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    currentScale: 1
};

const popupDragHandle = document.getElementById('popup-drag-handle');
if (popupDragHandle && statsPopup) {
    // --- Mouse Drag Support ---
    popupDragHandle.addEventListener('mousedown', (e) => {
        // Only start drag if clicking on header, not on buttons
        // 仅在点击标题时开始拖动，不在按钮上
        if (e.target.closest('button')) return;
        
        popupDragState.isDragging = true;
        popupDragState.startX = e.clientX;
        popupDragState.startY = e.clientY;
        
        const rect = statsPopup.getBoundingClientRect();
        popupDragState.startLeft = rect.left;
        popupDragState.startTop = rect.top;
        
        statsPopup.classList.add('dragging');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!popupDragState.isDragging) return;
        
        const deltaX = e.clientX - popupDragState.startX;
        const deltaY = e.clientY - popupDragState.startY;
        
        const newLeft = popupDragState.startLeft + deltaX;
        const newTop = popupDragState.startTop + deltaY;
        
        // Update position / 更新位置
        statsPopup.style.left = `${newLeft}px`;
        statsPopup.style.top = `${newTop}px`;
        statsPopup.style.right = 'auto'; // Remove default right positioning
        
        e.preventDefault();
    });

    document.addEventListener('mouseup', () => {
        if (popupDragState.isDragging) {
            popupDragState.isDragging = false;
            statsPopup.classList.remove('dragging');
        }
    });

    // --- Touch Drag Support (Mobile) ---
    popupDragHandle.addEventListener('touchstart', (e) => {
        if (e.target.closest('button')) return;
        if (e.touches.length !== 1) return; // Single finger for drag
        
        popupDragState.isDragging = true;
        popupDragState.startX = e.touches[0].clientX;
        popupDragState.startY = e.touches[0].clientY;
        
        const rect = statsPopup.getBoundingClientRect();
        popupDragState.startLeft = rect.left;
        popupDragState.startTop = rect.top;
        
        statsPopup.classList.add('dragging');
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!popupDragState.isDragging) return;
        if (e.touches.length !== 1) return;
        
        const deltaX = e.touches[0].clientX - popupDragState.startX;
        const deltaY = e.touches[0].clientY - popupDragState.startY;
        
        const newLeft = popupDragState.startLeft + deltaX;
        const newTop = popupDragState.startTop + deltaY;
        
        statsPopup.style.left = `${newLeft}px`;
        statsPopup.style.top = `${newTop}px`;
        statsPopup.style.right = 'auto';
        
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (popupDragState.isDragging) {
            popupDragState.isDragging = false;
            statsPopup.classList.remove('dragging');
        }
    });

    // --- Pinch to Zoom Support (Mobile) ---
    let pinchState = {
        isPinching: false,
        startDist: 0,
        startScale: 1
    };

    statsPopup.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            // Two fingers detected - Start Pinch
            pinchState.isPinching = true;
            pinchState.startDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            pinchState.startScale = popupDragState.currentScale;
            e.preventDefault(); // Prevent default browser zoom
        }
    }, { passive: false });

    statsPopup.addEventListener('touchmove', (e) => {
        if (pinchState.isPinching && e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            
            if (pinchState.startDist > 0) {
                const scaleDiff = dist / pinchState.startDist;
                let newScale = pinchState.startScale * scaleDiff;
                
                // Clamp scale between 0.5 and 2.0
                newScale = Math.max(0.5, Math.min(2.0, newScale));
                
                popupDragState.currentScale = newScale;
                
                // Apply Scale
                const content = statsPopup.querySelector('.popup-content');
                if (content) {
                    content.style.fontSize = `${newScale}rem`;
                }
            }
            e.preventDefault();
        }
    }, { passive: false });

    statsPopup.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            pinchState.isPinching = false;
        }
    });
}

// Popup zoom functionality / 弹窗缩放功能
// v0.9.19: Add zoom controls for statistics popup
// v0.9.19: 为统计弹窗添加缩放控制
const popupZoomIn = document.getElementById('popup-zoom-in');
const popupZoomOut = document.getElementById('popup-zoom-out');
const popupResetSize = document.getElementById('popup-reset-size');

if (popupZoomIn && popupZoomOut && popupResetSize && statsPopup) {
    popupZoomIn.addEventListener('click', () => {
        popupDragState.currentScale = Math.min(popupDragState.currentScale + 0.1, 2.0);
        applyPopupZoom();
    });
    
    popupZoomOut.addEventListener('click', () => {
        popupDragState.currentScale = Math.max(popupDragState.currentScale - 0.1, 0.5);
        applyPopupZoom();
    });
    
    popupResetSize.addEventListener('click', () => {
        popupDragState.currentScale = 1.0;
        applyPopupZoom();
        // Also reset size if manually resized / 如果手动调整了大小也重置
        statsPopup.style.width = '280px';
        statsPopup.style.height = 'auto';
    });
    
    function applyPopupZoom() {
        const content = statsPopup.querySelector('.popup-content');
        if (content) {
            content.style.fontSize = `${popupDragState.currentScale}rem`;
        }
    }
}

// Close button handler / 关闭按钮处理器
if (popupCloseBtn) {
    popupCloseBtn.addEventListener('click', () => {
        if (statsPopup) {
            statsPopup.style.display = 'none';
            // Reset position to default / 重置位置到默认
            statsPopup.style.left = 'auto';
            statsPopup.style.right = '20px';
            statsPopup.style.top = '80px';
        }
        
        // Clear highlight using highlightManager
        // 使用highlightManager清除高亮
        if (window.highlightManager) {
            window.highlightManager.unhighlight({ force: true });
        }
    });
}

function showNodePopup(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !statsPopup) return;

    // Find Edges (Visible in Frontend)
    // 查找前端可见的边
    const inNeighbors = [...new Set(links.filter(l => l.target.id === nodeId).map(l => l.source))];
    const outNeighbors = [...new Set(links.filter(l => l.source.id === nodeId).map(l => l.target))];

    // Populate Data
    document.getElementById('popup-node-name').innerText = node.label;
    
    // In-Degree Logic based on Setting
    const degreeMode = settingsManager.get('visuals', 'degreeMode') || 'visible';
    const totalIn = node.inDegree || 0;
    const visibleIn = inNeighbors.length;
    
    const inTextEl = document.getElementById('popup-in-count');
    
    if (degreeMode === 'total') {
        inTextEl.innerText = totalIn;
        if (totalIn !== visibleIn) {
             inTextEl.title = `Total: ${totalIn}, Visible: ${visibleIn}`;
        }
    } else {
        // Default: Visible
        inTextEl.innerText = visibleIn;
        if (totalIn !== visibleIn) {
             inTextEl.innerHTML = `${visibleIn} <span style="font-size:0.8em; color:#aaa">/ ${totalIn}</span>`;
             inTextEl.title = "Visible Nodes / Total Statistical Count";
        }
    }

    // Out-Degree Logic (Matches In-Degree setting for consistency?)
    // Or just visible default? Let's apply same logic.
    const totalOut = node.outDegree || 0;
    const visibleOut = outNeighbors.length;
    const outTextEl = document.getElementById('popup-out-count');
    
    if (degreeMode === 'total') {
        outTextEl.innerText = totalOut;
    } else {
        outTextEl.innerText = visibleOut;
        if (totalOut !== visibleOut) {
             outTextEl.innerHTML = `${visibleOut} <span style="font-size:0.8em; color:#aaa">/ ${totalOut}</span>`;
        }
    }

    const inList = document.getElementById('popup-in-list');
    const outList = document.getElementById('popup-out-list');
    inList.innerHTML = '';
    outList.innerHTML = '';

    const createItem = (n) => {
        const li = document.createElement('li');
        li.innerText = n.label;
        li.title = n.label; // Tooltip for long names
        li.addEventListener('click', (e) => {
            // Navigate to neighbor
            e.stopPropagation(); // Prevent background click
            handleSingleClick(e, n); // Recursively show stats for neighbor
        });
        return li;
    };

    inNeighbors.forEach(n => inList.appendChild(createItem(n)));
    outNeighbors.forEach(n => outList.appendChild(createItem(n)));

    // Show Popup
    statsPopup.style.display = 'flex';
}



// v0.9.31: Simulation Optimization (Viewport Culling)
// v0.9.31: 模拟优化 (视口剔除)
function checkSimulationState() {
    // Only apply optimization in standard force layout mode
    const layoutMode = document.querySelector('input[name="layoutMode"]:checked').value;
    if (layoutMode !== 'force' || focusNode) return;

    const transform = d3.zoomTransform(svg.node());
    const scale = transform.k;
    
    // 1. Full View Freeze
    // If zoomed out enough to see everything (approximate), freeze simulation
    // 如果缩小到足以看到所有内容（近似值），冻结模拟
    // Assuming initial scale 1 fits mostly. scale < 0.4 is definitely "bird's eye view".
    // v0.9.35: Relaxed threshold to 0.1 per user request
    if (scale < 0.1) {
        simulation.stop();
        return;
    }

    // 2. Off-screen Freezing
    // Calculate visible bounds in simulation coordinates
    // 计算模拟坐标中的可见边界
    const visibleWidth = width / scale;
    const visibleHeight = height / scale;
    const visibleX = -transform.x / scale;
    const visibleY = -transform.y / scale;
    
    // Add buffer (e.g., 800px visual range)
    // v0.9.35: Dynamic buffer based on scale ("fixed range extending outward")
    const buffer = 800 / scale;
    const minX = visibleX - buffer;
    const maxX = visibleX + visibleWidth + buffer;
    const minY = visibleY - buffer;
    const maxY = visibleY + visibleHeight + buffer;

    // Filter nodes: Active if inside bounds OR connected to someone inside bounds (to keep edges moving correctly)
    // 过滤节点：如果在边界内或连接到边界内的人（以保持边缘正确移动），则为活动
    // Simplified: Just check node position for now.
    
    let activeCount = 0;
    simulation.nodes().forEach(d => {
        const isVisible = d.x >= minX && d.x <= maxX && d.y >= minY && d.y <= maxY;
        if (isVisible) {
            d.isCulled = false;
            // Only unlock if NOT dragging and NOT globally frozen
            // 仅在未拖动且未全局冻结时解锁
            // Actually, we should just clear fx/fy if it was set by culling. 
            // If it was set by Drag, isDragging protects it? 
            // Drag sets fx/fy. We must NOT clear it if dragging.
            if (!d.isDragging && !focusNode) {
                 d.fx = null;
                 d.fy = null;
            }
            activeCount++;
        } else {
            d.isCulled = true;
            // Freeze if off-screen (and not manually dragged)
            // 如果在屏幕外（且未手动拖动），则冻结
            if (!d.isDragging) {
                d.fx = d.x;
                d.fy = d.y;
            }
        }
    });

    // If active nodes exist, ensure simulation is running
    // 如果存在活动节点，请确保模拟正在运行
    // But check global freeze first
    const isGlobalFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
    if (!isGlobalFrozen && activeCount > 0) {
        simulation.alphaTarget(0.3).restart();
    } else if (activeCount === 0) {
        simulation.stop();
    }
}

function startupElapsedMs() {
    return nowMs() - startupPerfState.bootTs;
}

function shouldBypassStartupEdgeOptimizations() {
    if (focusNode) {
        return true;
    }

    const highlightState = window.highlightManager ? window.highlightManager.getState() : null;
    return Boolean(highlightState && highlightState.currentNode);
}

function isStartupEdgeDelayActive() {
    if (startupPerfProfile.pilotEnabled !== true) {
        return false;
    }

    if (!Number.isFinite(startupPerfProfile.edgeGeometryDelayMs) || startupPerfProfile.edgeGeometryDelayMs <= 0) {
        return false;
    }

    if (shouldBypassStartupEdgeOptimizations()) {
        return false;
    }

    return startupElapsedMs() < startupPerfProfile.edgeGeometryDelayMs;
}

function shouldUseStartupSvgStage1Edges() {
    if (startupPerfProfile.pilotEnabled !== true) {
        return false;
    }

    if (!Number.isFinite(startupPerfProfile.edgeStartupWindowMs) || startupPerfProfile.edgeStartupWindowMs <= 0) {
        return false;
    }

    if (startupSvgStage1LinkSelection === link) {
        return false;
    }

    if (shouldBypassStartupEdgeOptimizations()) {
        return false;
    }

    return startupElapsedMs() < startupPerfProfile.edgeStartupWindowMs;
}

// Simulation Tick
function ticked() {
    const renderer = document.querySelector('input[name="rendererMode"]:checked').value;
    const layoutMode = document.querySelector('input[name="layoutMode"]:checked').value;

    // v0.9.31: Continuous check (optional, can be expensive, maybe just on zoom is enough?)
    // Actually, checking every tick is expensive. Let's rely on Zoom event + occasional checks.
    // But if nodes move INTO view, they need to wake up.
    // Ideally, we run checkSimulationState periodically or if alpha is high.
    // For now, let's keep it lightweight and rely on Zoom event + Drag.
    // If we want accurate "wake up on move", we'd need to check bounds here.
    // To satisfy requirement "particles within range move, others frozen", we need to update it.
    // Let's add a throttle or check only every N ticks.
    if (simulation.alpha() > 0.05) { // Only check if simulation is active enough
         // We can't call it every tick efficiently.
         // Let's assume nodes don't move drastically fast out of view.
    }

    if (renderer === 'svg') {
        const edgeDelayActive = isStartupEdgeDelayActive();
        if (edgeDelayActive && !startupPerfState.edgeDelayLogged) {
            startupPerfState.edgeDelayLogged = true;
            console.log('[Startup Perf] Startup SVG edge geometry delay active.', {
                edgeGeometryDelayMs: startupPerfProfile.edgeGeometryDelayMs
            });
        }

        if (!edgeDelayActive) {
            if (startupPerfState.edgeDelayLogged && !startupPerfState.edgeDelayReleasedLogged) {
                startupPerfState.edgeDelayReleasedLogged = true;
                console.log('[Startup Perf] Startup SVG edge geometry delay released.', {
                    elapsedMs: Number(startupElapsedMs().toFixed(2))
                });
            }

            const useStartupStage1Edges = shouldUseStartupSvgStage1Edges();
            if (useStartupStage1Edges && !startupPerfState.edgeStage1Logged) {
                startupPerfState.edgeStage1Logged = true;
                console.log('[Startup Perf] Startup SVG key-edge stage active.', {
                    edgeStartupWindowMs: startupPerfProfile.edgeStartupWindowMs,
                    edgeStage1TopK: startupStage1TopK
                });
            }

            if (!useStartupStage1Edges && startupPerfState.edgeStage1Logged && !startupPerfState.edgeStage1ReleasedLogged) {
                startupPerfState.edgeStage1ReleasedLogged = true;
                console.log('[Startup Perf] Startup SVG key-edge stage released.', {
                    elapsedMs: Number(startupElapsedMs().toFixed(2))
                });
            }

            const activeLinkSelection = useStartupStage1Edges ? startupSvgStage1LinkSelection : link;
            if (layoutMode === 'dag') {
                activeLinkSelection.attr("d", d => {
                    const sx = d.source.x;
                    const sy = d.source.y;
                    const tx = d.target.x;
                    const ty = d.target.y;
                    return `M${sx},${sy} C${sx},${(sy + ty) / 2} ${tx},${(sy + ty) / 2} ${tx},${ty}`;
                });
            } else {
                activeLinkSelection.attr("d", d => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);
            }
        }
        node.filter(d => !d.isCulled).attr("transform", d => `translate(${d.x},${d.y})`);
    } else {
        // Canvas Update Logic
        renderCanvas(layoutMode);
    }
}

function renderCanvas(layoutMode) {
    if (!ctx) return; // Canvas context missing
    
    try {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Apply Zoom/Pan
        ctx.translate(currentTransform.x, currentTransform.y);
        ctx.scale(currentTransform.k, currentTransform.k);

        // Get highlight state from highlightManager
        // 从highlightManager获取高亮状态
        const highlightState = window.highlightManager ? window.highlightManager.getState() : null;
        const highlightConnections = highlightState && highlightState.currentNode ? 
            window.highlightManager.getCurrentConnections() : null;

        // v0.9.67: Compact Mode Optimization
        // If Compact Mode is ON, and we are NOT highlighting/focusing, skip edge iteration entirely.
        // This saves iterating 1.2M items per frame.
        const isCompact = window.settingsManager ? window.settingsManager.get('performance', 'compactMode') : false;
        
        // v0.9.72: Extreme Scale Constraint
        // "When the number of nodes or edges becomes excessive (exceeding 10,000 nodes or 1,000,000 edges), 
        // edges shall never be rendered in the frontend display (even when a node is selected on the canvas)."
        const isExtremeScale = nodes.length > 10000 || links.length > 1000000;
        
        const shouldRenderEdges = !isExtremeScale && (!isCompact || focusNode || highlightConnections);

        // Draw Links / 绘制连接
        ctx.lineWidth = 1;

        if (shouldRenderEdges) {
            links.forEach(d => {
                // Check Visibility / 检查可见性
                // 1. Focus Mode / 专注模式
                if (focusNode) {
                    // v0.9.46: Do not display any edges in Focus Mode under Canvas
                    return; 
                } 
                // 2. Highlight Mode (using highlightManager) / 高亮模式（使用highlightManager）
                else if (highlightConnections) {
                    const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                    const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                    const currentNodeId = highlightState.currentNode.id;
                    
                    if (sourceId === currentNodeId) {
                        // Outgoing edge / 出度边
                        ctx.globalAlpha = 1;
                        ctx.strokeStyle = "#4488ff"; // Blue for outgoing / 蓝色表示出度
                        ctx.lineWidth = 2.5;
                    } else if (targetId === currentNodeId) {
                        // Incoming edge / 入度边
                        ctx.globalAlpha = 1;
                        ctx.strokeStyle = "#ff6b6b"; // Red for incoming / 红色表示入度
                        ctx.lineWidth = 2.5;
                    } else {
                        return; // Hide others / 隐藏其他
                    }
                }
                else {
                    // Default Mode (No Highlight/Focus)
                    // If Compact Mode is ON, we shouldn't be here (guarded by shouldRenderEdges).
                    // But if we are here, it means we are in Normal Mode.
                    // In Normal Mode, edges are default hidden (return) unless some logic changes?
                    // Existing logic: "else { return; // Default Hidden }"
                    // So edges were ALREADY hidden by default in Canvas.
                    return; // Default Hidden / 默认隐藏
                }
        
                ctx.beginPath();
                if (layoutMode === 'dag') {
                    const sx = d.source.x;
                    const sy = d.source.y;
                    const tx = d.target.x;
                    const ty = d.target.y;
                    const cp1x = sx;
                    const cp1y = (sy + ty) / 2;
                    const cp2x = tx;
                    const cp2y = (sy + ty) / 2;
                    ctx.moveTo(sx, sy);
                    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tx, ty);
                } else {
                    ctx.moveTo(d.source.x, d.source.y);
                    ctx.lineTo(d.target.x, d.target.y);
                }
                ctx.stroke();
            });
        }

        // Draw Nodes / 绘制节点
        // Draw Nodes / 绘制节点 (Batched Optimization)
        const batches = new Map(); // Key: "fill|alpha", Value: [nodes]
        const textToDraw = [];

        // Scales Setup
        const sizeMode = document.querySelector('input[name="sizeMode"]:checked') ? document.querySelector('input[name="sizeMode"]:checked').value : 'uniform';
        const colorMode = document.querySelector('input[name="colorMode"]:checked') ? document.querySelector('input[name="colorMode"]:checked').value : 'degree';
        
        let sizeScale = null;
        if (sizeMode === 'degree') {
             const maxDeg = d3.max(nodes, n => (n.inDegree||0) + (n.outDegree||0)) || 1;
             sizeScale = d3.scaleSqrt().domain([0, maxDeg]).range([3, 12]);
        }

        nodes.forEach(d => {
            if (!isNodeVisible(d)) return;

            // Determine State
            const isHighlightedNode = highlightState && highlightState.currentNode && highlightState.currentNode.id === d.id;
            const isFocus = focusNode && focusNode.id === d.id;
            const isConnected = highlightConnections && highlightConnections.nodeIds.has(d.id);
            const shouldDim = highlightState && highlightState.currentNode && !isConnected && !focusNode;

            const alpha = shouldDim ? 0.05 : 1.0;
            
            // Determine Size
            let r = 5;
            if (isFocus) {
                r = 25;
            } else if (sizeMode === 'centrality') {
                r = sizeScaleCentrality(d.centrality || 0);
            } else if (sizeMode === 'degree') {
                const deg = (d.inDegree||0) + (d.outDegree||0);
                r = sizeScale ? sizeScale(deg) : 5;
            } else {
                r = 5;
            }

            if (isHighlightedNode) r += 2; 
            d._renderR = r; // Cache

            // Determine Color
            let fill = "#ccc";
            if (isFocus) {
                fill = "#ffd700";
            } else if (isHighlightedNode) {
                fill = "#ffaa00";
            } else {
                 if (colorMode === 'cluster') fill = colorScaleCluster(d.clusterId || 'unknown');
                 else fill = colorScaleDegree(getDegree(d));
            }
            
            // Add to Batch
            const key = fill + '|' + alpha;
            if (!batches.has(key)) batches.set(key, []);
            batches.get(key).push(d);

            // Check Label with adaptive threshold for large graphs
            // For graphs >3000 nodes, require higher zoom (2.5x) to show labels
            const isLargeGraph = nodes.length > 3000;
            const labelZoomThreshold = isLargeGraph ? 2.5 : 1.2;
            if (!shouldDim && (isFocus || isHighlightedNode || currentTransform.k > labelZoomThreshold)) {
                textToDraw.push(d);
            }
        });

        // Execute Batches
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;

        batches.forEach((batchNodes, key) => {
            const [fill, alphaStr] = key.split('|');
            ctx.fillStyle = fill;
            ctx.globalAlpha = parseFloat(alphaStr);
            
            ctx.beginPath();
            batchNodes.forEach(d => {
                 ctx.moveTo(d.x + d._renderR, d.y);
                 ctx.arc(d.x, d.y, d._renderR, 0, 2 * Math.PI);
            });
            ctx.fill();
            ctx.stroke();
        });

        // Draw Labels with adaptive opacity for large graphs
        // For graphs >3000 nodes, use 70% opacity by default to reduce overlap
        const isLargeGraph = nodes.length > 3000;
        const labelOpacity = isLargeGraph ? 0.7 : 1.0;
        ctx.globalAlpha = labelOpacity;
        ctx.fillStyle = "#ccc";
        textToDraw.forEach(d => {
            const isFocus = focusNode && focusNode.id === d.id;
            ctx.font = isFocus ? "bold 16px Sans-Serif" : "10px Sans-Serif";
            const labelDx = d._labelDx !== undefined ? d._labelDx : 8;
            ctx.fillText(d.label, d.x + labelDx, d.y + 4);
        });

        // Draw Focus Labels (Canvas) / 绘制专注标签（Canvas）
        if (focusNode && window.focusLabels) {
            ctx.save();
            ctx.font = "bold 16px Segoe UI";
            ctx.fillStyle = "#61dafb";
            ctx.textAlign = "center";
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = 4;
            
            window.focusLabels.forEach(lbl => {
                ctx.fillText(lbl.text, lbl.x, lbl.y);
            });
            ctx.restore();
        }

        ctx.restore();
    } catch (e) {
        console.error("Canvas Render Error:", e);
    }
}

// Canvas Setup / Canvas设置
const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');
let currentTransform = d3.zoomIdentity;

// Resize Canvas / 调整Canvas大小
function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    // v0.9.78: Fix Analysis stability - Guard against simulation restart/movement
    const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
    if (isFrozen) {
        simulation.stop();
    }

    if (document.querySelector('input[name="rendererMode"]:checked').value === 'canvas') {
        ticked();
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Canvas Zoom / Canvas缩放
d3.select(canvas).call(d3.zoom()
    .scaleExtent([0.1, 8])
    .filter(function(event) {
        // v0.9.47: Prevent double-click zoom if clicking on a node (to allow Focus Mode)
        if (event.type === 'dblclick') {
            const rect = canvas.getBoundingClientRect();
            // findNodeAt might not be hoisted/available if defined below. 
            // However, function declarations are hoisted. 
            // We need to ensure 'currentTransform' is available. It is defined above.
            const node = findNodeAt(event.clientX - rect.left, event.clientY - rect.top);
            if (node) return false;
        }
        return !event.ctrlKey && !event.button; // Default filter: no ctrl, left button only
    })
    .on("zoom", (event) => {
        currentTransform = event.transform;
        ticked();
    }));

// v0.9.45: Canvas Interactivity
function findNodeAt(x, y) {
    const tx = (x - currentTransform.x) / currentTransform.k;
    const ty = (y - currentTransform.y) / currentTransform.k;
    
    // Search radius: constant 10px visual, converted to simulation space
    const searchRadius = 15 / currentTransform.k; 
    let closest = null;
    let minDist = Infinity;

    for (const n of nodes) {
        if (!isNodeVisible(n)) continue;
        
        // Approximate hit test
        const dist = (n.x - tx) ** 2 + (n.y - ty) ** 2;
        // Use squared distance for performance
        // Check against searchRadius^2 + nodeRadius^2 estimate
        // Simple radius check:
        const r = 10; // Avg node radius
        const threshold = (r + searchRadius) ** 2;
        
        if (dist < threshold && dist < minDist) {
            minDist = dist;
            closest = n;
        }
    }
    return closest;
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const node = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    
    if (node) {
        canvas.style.cursor = 'pointer';
        const state = highlightManager.getState();
        // Only highlight if not frozen (or if we want to allow hover highlight in frozen state too?)
        // SVG Logic: node.on("mouseover", ...) checks !state.isFrozen && !focusModeState.active
        if (!state.isFrozen && !focusModeState.active) {
             highlightManager.highlight(node, { event: e });
        }
    } else {
        canvas.style.cursor = 'default';
        const state = highlightManager.getState();
        if (!state.isFrozen && !focusModeState.active) {
             highlightManager.unhighlight();
        }
    }
});

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const node = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    
    if (node) {
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
            // Double Click
            handleDoubleClick(e, node);
        } else {
            clickTimer = setTimeout(() => {
                clickTimer = null;
                // Single Click
                handleSingleClick(e, node);
            }, 250);
        }
    } else {
        // Background Click
        if (!focusNode && window.highlightManager) {
             const state = window.highlightManager.getState();
             if (state.isFrozen || state.currentNode) {
                 window.highlightManager.unhighlight({ force: true });
                 const popup = document.getElementById('node-stats-popup');
                 if (popup) popup.style.display = 'none';
             }
        }
    }
});

// simulation.on("tick", ticked); // Handled via worker message

// Renderer Toggle
document.querySelectorAll('input[name="rendererMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (mode === 'canvas') {
            document.querySelector('#graph-container svg').style.display = 'none';
            canvas.style.display = 'block';
            ticked();
        } else {
            document.querySelector('#graph-container svg').style.display = 'block';
            canvas.style.display = 'none';
            // Sync zoom state
            g.attr("transform", currentTransform);
            ticked();
        }
        scheduleGraphSemanticA11yRefresh('Renderer changed');
    });
});

// Controls & Filtering
// Controls object moved to top (v0.9.69) to fix initialization race condition.

if (controls.minDegree) controls.minDegree.addEventListener('input', updateVisibility);
if (controls.showOrphans) controls.showOrphans.addEventListener('change', updateVisibility);
if (controls.search) controls.search.addEventListener('input', updateVisibility);
if (controls.export) controls.export.addEventListener('click', exportSVG);

const btnRandom = document.getElementById('btn-random-focus');
if (btnRandom) {
    btnRandom.addEventListener('click', () => {
        if (!nodes || nodes.length === 0) return;
        const candidates = nodes.filter(n => isNodeVisible(n));
        if (candidates.length === 0) return;
        const rnd = candidates[Math.floor(Math.random() * candidates.length)];
        
        if (window.highlightManager) window.highlightManager.unhighlight({ force: true });
        // Use focusOnNode helper if available, or direct
        if (window.focusOnNode) window.focusOnNode(rnd.id);
        else enterFocusMode(rnd);
    });
}

// Mobile: Toggle Controls Panel
const controlsPanel = document.getElementById('controls');
if (controlsPanel) {
    controlsPanel.addEventListener('click', (e) => {
        // Only toggle if strictly clicking the container (or the hamburger icon background)
        // AND screen is small (checked via class or simple width check, but let's just toggle 'expanded' class)
        // But we must NOT toggle if clicking an input/button inside
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'LABEL' || e.target.tagName === 'SELECT') {
            return;
        }
        
        // If it's already expanded, and we clicked "empty space" inside, we might want to keep it open.
        // The requirement is to make it usable. A simple toggle on the "header" or just the container when collapsed is best.
        // Since we hid children with opacity 0 when collapsed, clicking 'controls' when collapsed hits the div.
        
        if (!controlsPanel.classList.contains('expanded')) {
            controlsPanel.classList.add('expanded');
        } else {
            // If clicking the header h3, toggle close?
            if (e.target.tagName === 'H3' || e.target === controlsPanel) {
               controlsPanel.classList.remove('expanded');
            }
        }
    });
}

// Label Opacity Control
const labelOpacitySlider = document.getElementById('label-opacity-slider');
const labelOpacityVal = document.getElementById('label-opacity-val');

if (labelOpacitySlider && labelOpacityVal) {
    labelOpacitySlider.addEventListener('input', (e) => {
        const val = e.target.value;
        labelOpacityVal.innerText = val + '%';
        texts.style("opacity", val / 100);
    });
}

function isNodeVisible(d) {
    if (focusNode) {
        // In Focus Mode, visibility is controlled by the enterFocusMode logic setting classes or explicit styles.
        // However, updateVisibility() is called by mouseout and controls.
        // We should respect the 'focus-visible' flag if we use one, OR check against the focus set.
        // To keep it simple and robust: If focusNode is set, we let enterFocusMode handle opacity.
        // But wait, updateVisibility resets opacity.
        // So we need logic here:
        if (d.id === focusNode.id) return true;
        if (d.isFocusVisible) return true; // We will tag nodes in enterFocusMode
        return false;
    }

    // v0.9.69 Fix: Guard against controls not being ready
    if (!controls || !controls.minDegree) return true;

    const minDegree = parseInt(controls.minDegree.value);
    const showOrphans = controls.showOrphans.checked;
    const term = controls.search.value.toLowerCase();
    
    const degree = d.inDegree + d.outDegree;
    const matchesDegree = degree >= minDegree;
    const isOrphan = degree === 0;
    const allowedOrphan = !isOrphan || showOrphans;
    const matchesSearch = !term || d.label.toLowerCase().includes(term);
    
    // Check Cluster Filter
    const matchesCluster = activeClusterFilter === 'all' || (d.clusterId === activeClusterFilter);

    return matchesDegree && allowedOrphan && matchesSearch && matchesCluster;
}

function updateVisibility(reason = 'Filter visibility updated') {
    const minVal = controls.minDegree.value;
    document.getElementById('min-degree-val').innerText = minVal;

    // Check highlight state from highlightManager
    // 从highlightManager检查高亮状态
    const highlightState = window.highlightManager ? window.highlightManager.getState() : null;
    const isHighlighting = highlightState && highlightState.currentNode;

    // Don't reset opacity if we're in highlighting mode
    // 如果在高亮模式中则不重置透明度
    if (!isHighlighting) {
        node.style("opacity", d => isNodeVisible(d) ? 1 : 0.1)
            .style("pointer-events", d => isNodeVisible(d) ? "all" : "none");

        link.style("opacity", d => {
            // If in Focus Mode, show connections to focus node
            if (focusNode) {
                const isConnected = d.source.id === focusNode.id || d.target.id === focusNode.id;
                const sourceVis = isNodeVisible(d.source);
                const targetVis = isNodeVisible(d.target);
                return (sourceVis && targetVis) ? 0.6 : 0;
            }
            
            // Default Mode: Show edges with low opacity
            // Hover/click will increase opacity to 1 for highlighted edges
            return 0; 
        });
    }

    scheduleGraphSemanticA11yRefresh(reason);
}

function exportSVG() {
    const svgEl = document.querySelector("#graph-container svg");
    
    // 1. Clone the SVG to manipulate it without affecting the UI
    const clone = svgEl.cloneNode(true);
    
    // 2. Add Background Rect
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", "100%");
    bgRect.setAttribute("height", "100%");
    bgRect.setAttribute("fill", "#1e1e1e"); // Match body background
    clone.insertBefore(bgRect, clone.firstChild);

    // 3. Inline Computed Styles for Nodes and Links
    // We need to match elements in clone with original to get computed styles
    const originalNodes = svgEl.querySelectorAll('.node circle, .node text');
    const cloneNodes = clone.querySelectorAll('.node circle, .node text');
    
    originalNodes.forEach((orig, i) => {
        const cl = cloneNodes[i];
        const style = window.getComputedStyle(orig);
        cl.setAttribute("fill", style.fill);
        cl.setAttribute("stroke", style.stroke);
        cl.setAttribute("stroke-width", style.strokeWidth);
        cl.setAttribute("opacity", style.opacity);
        cl.setAttribute("font-size", style.fontSize);
        cl.setAttribute("font-family", style.fontFamily);
    });

    const originalLinks = svgEl.querySelectorAll('.link');
    const cloneLinks = clone.querySelectorAll('.link');
    
    originalLinks.forEach((orig, i) => {
        const cl = cloneLinks[i];
        const style = window.getComputedStyle(orig);
        cl.setAttribute("stroke", style.stroke);
        cl.setAttribute("stroke-width", style.strokeWidth);
        cl.setAttribute("stroke-opacity", style.strokeOpacity);
        cl.setAttribute("fill", "none"); // Links shouldn't have fill
    });

    // 4. Serialize
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clone);

    // Add namespaces if missing
    if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if(!source.match(/^<svg[^>]+\"http\:\/\/www\.w3\.org\/1999\/xlink"/)){
        source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    const preamble = '<?xml version="1.0" standalone="no"?>\r\n';
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(preamble + source);
    
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = "note_connection_graph.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// Save Layout
document.getElementById('save-layout-btn').addEventListener('click', saveLayout);

function saveLayout() {
    const layoutData = nodes.map(n => ({
        id: n.id,
        x: Math.round(n.x),
        y: Math.round(n.y)
    }));

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(layoutData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "layout.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Drag functions
// Drag functions
function dragstarted(event, d) {
  d.isDragging = true; 
  const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
  
  // v0.9.79: Allow manual drag in Focus Mode (No Physics)
  if (focusNode) {
      d.fx = d.x; d.fy = d.y; // Lock position
      return; 
  }
  
  if (isFrozen) return; 

  // Notify Worker
  simulationWorker.postMessage({ type: 'dragStart', payload: { id: d.id, x: d.x, y: d.y, active: event.active } });
  
  // Local Update (for instant feedback before tick)
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
  
   // v0.9.79: Allow manual drag in Focus Mode (No Physics)
  if (focusNode) {
      if (!d.isDragging) return;
      // Manually update position
      d.x = event.x; d.y = event.y;
      d.fx = event.x; d.fy = event.y;
      ticked(); // Force render
      return;
  }

  if (isFrozen) return;

  // Notify Worker
  simulationWorker.postMessage({ type: 'drag', payload: { id: d.id, x: event.x, y: event.y, active: event.active } });
  
  // Local Update
  d.fx = event.x;
  d.fy = event.y;
}

function dragended(event, d) {
  d.isDragging = false; 
  const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
  
   // v0.9.79: Focus Mode Drag End
  if (focusNode) {
      // Keep fixed (fx/fy already set in dragged)
      return;
  }

  if (isFrozen) return;

  const shouldClear = !focusNode && !isFrozen; // Standard logic

  // Notify Worker
  simulationWorker.postMessage({ 
      type: 'dragEnd', 
      payload: { 
          id: d.id, 
          x: event.x, 
          y: event.y, 
          active: event.active,
          shouldClear: shouldClear 
      } 
  });
  
  if (shouldClear) {
        d.fx = null;
        d.fy = null;
  }
}

// Old click listener removed.
// Focus Mode Logic
// v0.9.44: Independent spacing settings for Horizontal/Vertical layouts
const focusSpacingSettings = {
    horizontal: { layer: 125, node: 80 }, // Layer 1/2 of original (250->125)
    vertical: { layer: 250, node: 20 }    // Node 1/4 of original (80->20)
};

const focusSpacingSlider = document.getElementById('focus-spacing-slider');
const focusHSpacingSlider = document.getElementById('focus-h-spacing-slider');
const focusLayoutSelect = document.getElementById('focus-layout-select');

document.getElementById('btn-exit-focus').addEventListener('click', exitFocusMode);
document.getElementById('btn-open-content').addEventListener('click', () => {
    if (focusNode && window.reader) {
        window.reader.open(focusNode);
    }
});

document.getElementById('btn-reset-focus-layout').addEventListener('click', () => {
    const mode = focusLayoutSelect.value;
    // Reset to defaults
    if (mode === 'horizontal') {
        focusSpacingSettings.horizontal.layer = 125;
        focusSpacingSettings.horizontal.node = 80;
    } else {
        focusSpacingSettings.vertical.layer = 250;
        focusSpacingSettings.vertical.node = 20;
    }
    
    // Update UI
    focusSpacingSlider.value = focusSpacingSettings[mode].layer;
    focusHSpacingSlider.value = focusSpacingSettings[mode].node;
    
    // Refresh
    if (focusNode) enterFocusMode(focusNode);
});

// Update Settings on Slider Change
focusSpacingSlider.addEventListener('input', (e) => {
    const mode = focusLayoutSelect.value;
    focusSpacingSettings[mode].layer = parseInt(e.target.value);
    if (focusNode) enterFocusMode(focusNode);
});

focusHSpacingSlider.addEventListener('input', (e) => {
    const mode = focusLayoutSelect.value;
    focusSpacingSettings[mode].node = parseInt(e.target.value);
    if (focusNode) enterFocusMode(focusNode);
});

// Sync Sliders on Layout Change
focusLayoutSelect.addEventListener('change', () => {
    const mode = focusLayoutSelect.value;
    // Update UI controls to match stored settings
    focusSpacingSlider.value = focusSpacingSettings[mode].layer;
    focusHSpacingSlider.value = focusSpacingSettings[mode].node;
    
    if (focusNode) enterFocusMode(focusNode);
});
      
      
// Helper to expose highlightNode for external modules (like Analysis)
// 为外部模块（如Analysis）公开highlightNode
window.highlightNode = function(id) {
    const d = nodes.find(n => n.id === id);
    if (d && window.highlightManager) {
        // Requirement: Clicking in Analysis should have SAME effect as clicking in graph.
        // Graph click triggers: highlight(freeze=true) AND showNodePopup.
        
        // 1. Clear previous highlight to ensure we can switch nodes
        // (If previous was frozen, highlight() would block switching otherwise)
        window.highlightManager.unhighlight({ force: true });
        
        // 2. Highlight with freeze option
        window.highlightManager.highlight(d, { freeze: true });
        
        // 3. Show Popup
        showNodePopup(id);
    }
};

// Helper to expose focusOnNode for external modules
// 为外部模块公开focusOnNode
window.focusOnNode = function(id) {
    const d = nodes.find(n => n.id === id);
    if (d) {
        // Reuse double click logic or call enterFocusMode directly
        // Clear highlight first
        if (window.highlightManager) {
            window.highlightManager.unhighlight({ force: true });
        }
        
        // Hide popup
        const popup = document.getElementById('node-stats-popup');
        if (popup) popup.style.display = 'none';

        // Enter Focus Mode
        enterFocusMode(d);
    }
};

function normalizeGraphViewText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeGraphViewLookupKey(value) {
    return normalizeGraphViewText(value).toLowerCase();
}

function resolveGraphViewSourceBasename(sourcePath) {
    const normalized = String(sourcePath || '').replace(/\\/g, '/').trim();
    if (!normalized) {
        return '';
    }
    const fileName = normalized.split('/').filter(Boolean).pop() || normalized;
    return fileName.replace(/\.[^/.]+$/, '').trim();
}

function getGraphViewNodeLabel(node) {
    return normalizeGraphViewText(node && (node.label || node.title || node.name || node.id));
}

function getGraphViewLinkNodeId(endpoint) {
    if (endpoint && typeof endpoint === 'object') {
        return normalizeGraphViewText(endpoint.id || endpoint.nodeId || endpoint.key);
    }
    return normalizeGraphViewText(endpoint);
}

function collectGraphViewKnowledgePointCandidates(payload) {
    const candidates = [];
    const seen = new Set();
    const appendCandidate = (value) => {
        const normalized = normalizeGraphViewText(value);
        if (!normalized || seen.has(normalized)) {
            return;
        }
        seen.add(normalized);
        candidates.push(normalized);
    };
    appendCandidate(payload && payload.graphNodeId);
    appendCandidate(payload && payload.graphTargetId);
    appendCandidate(payload && payload.nodeId);
    appendCandidate(payload && payload.documentId);
    appendCandidate(payload && payload.title);
    appendCandidate(payload && payload.label);
    appendCandidate(payload && payload.sourceBasename);
    appendCandidate(resolveGraphViewSourceBasename(payload && payload.sourcePath));
    appendCandidate(payload && payload.atomId);
    if (Array.isArray(payload && payload.atomIds)) {
        payload.atomIds.forEach(appendCandidate);
    }
    if (Array.isArray(payload && payload.nodeIds)) {
        payload.nodeIds.forEach(appendCandidate);
    }
    if (Array.isArray(payload && payload.matchedSpans)) {
        payload.matchedSpans.forEach((span) => {
            appendCandidate(span && span.title);
            appendCandidate(span && span.atomId);
            appendCandidate(resolveGraphViewSourceBasename(span && span.sourcePath));
        });
    }
    return candidates;
}

function resolveGraphViewNodeByIdOrLabel(candidate) {
    const normalized = normalizeGraphViewText(candidate);
    if (!normalized || !Array.isArray(nodes)) {
        return null;
    }
    const exactId = nodes.find((node) => normalizeGraphViewText(node && node.id) === normalized);
    if (exactId) {
        return exactId;
    }
    const lookupKey = normalizeGraphViewLookupKey(normalized);
    const exactLabelMatches = nodes.filter((node) => normalizeGraphViewLookupKey(getGraphViewNodeLabel(node)) === lookupKey);
    if (exactLabelMatches.length === 1) {
        return exactLabelMatches[0];
    }
    const sourceMatches = nodes.filter((node) => {
        const metadata = node && typeof node.metadata === 'object' ? node.metadata : {};
        return normalizeGraphViewLookupKey(resolveGraphViewSourceBasename(node && (node.sourcePath || node.filepath || metadata.filepath || metadata.sourcePath))) === lookupKey;
    });
    return sourceMatches.length === 1 ? sourceMatches[0] : null;
}

function resolveGraphViewNodeByKnowledgePoint(payload) {
    const candidates = collectGraphViewKnowledgePointCandidates(payload);
    for (const candidate of candidates) {
        const node = resolveGraphViewNodeByIdOrLabel(candidate);
        if (node) {
            return node;
        }
    }
    return null;
}

function buildGraphViewFocusModeSnapshot(nodeId) {
    const focusD = resolveGraphViewNodeByIdOrLabel(nodeId);
    if (!focusD) {
        return null;
    }
    const incoming = [];
    const outgoing = [];
    const linkList = Array.isArray(links) ? links : [];
    linkList.forEach((linkItem) => {
        const sourceId = getGraphViewLinkNodeId(linkItem && linkItem.source);
        const targetId = getGraphViewLinkNodeId(linkItem && linkItem.target);
        if (sourceId === focusD.id) {
            const targetNode = resolveGraphViewNodeByIdOrLabel(targetId);
            if (targetNode) {
                outgoing.push(targetNode);
            }
        } else if (targetId === focusD.id) {
            const sourceNode = resolveGraphViewNodeByIdOrLabel(sourceId);
            if (sourceNode) {
                incoming.push(sourceNode);
            }
        }
    });

    const uniqueById = (items) => {
        const seen = new Set();
        const unique = [];
        items.forEach((item) => {
            const id = normalizeGraphViewText(item && item.id);
            if (!id || seen.has(id)) {
                return;
            }
            seen.add(id);
            unique.push(item);
        });
        return unique;
    };
    const incomingNodes = uniqueById(incoming).slice(0, 5);
    const outgoingNodes = uniqueById(outgoing).slice(0, 5);
    const snapshotNodes = [];
    const addSnapshotNode = (node, role, x, y) => {
        snapshotNodes.push({
            id: normalizeGraphViewText(node && node.id),
            label: getGraphViewNodeLabel(node),
            role,
            x,
            y,
        });
    };
    const placeLane = (nodeList, role, x) => {
        const step = 80 / (nodeList.length + 1);
        nodeList.forEach((node, index) => {
            addSnapshotNode(node, role, x, 10 + step * (index + 1));
        });
    };
    placeLane(incomingNodes, 'incoming', 22);
    addSnapshotNode(focusD, 'anchor', 50, 50);
    placeLane(outgoingNodes, 'outgoing', 78);

    const visibleIds = new Set(snapshotNodes.map((node) => node.id));
    const snapshotEdges = linkList
        .map((linkItem) => {
            const sourceId = getGraphViewLinkNodeId(linkItem && linkItem.source);
            const targetId = getGraphViewLinkNodeId(linkItem && linkItem.target);
            if (!sourceId || !targetId || !visibleIds.has(sourceId) || !visibleIds.has(targetId)) {
                return null;
            }
            return {
                sourceId,
                targetId,
                relationKind: normalizeGraphViewText(linkItem && (linkItem.type || linkItem.relationKind || linkItem.kind)) || 'related',
                confidence: Number(linkItem && (linkItem.confidence || linkItem.weight)),
            };
        })
        .filter(Boolean);

    return {
        anchorId: focusD.id,
        anchorLabel: getGraphViewNodeLabel(focusD),
        nodes: snapshotNodes,
        edges: snapshotEdges,
    };
}

function buildGraphViewFocusModeProjection(nodeId, options = {}) {
    const focusD = resolveGraphViewNodeByIdOrLabel(nodeId);
    if (!focusD) {
        return null;
    }
    const linkList = Array.isArray(links) ? links : [];
    const uniqueById = (items) => {
        const seen = new Set();
        const unique = [];
        items.forEach((item) => {
            const id = normalizeGraphViewText(item && item.id);
            if (!id || seen.has(id)) {
                return;
            }
            seen.add(id);
            unique.push(item);
        });
        return unique;
    };
    const getEndpointNode = (endpoint) => {
        if (endpoint && typeof endpoint === 'object') {
            const endpointId = normalizeGraphViewText(endpoint.id || endpoint.nodeId || endpoint.key);
            return endpointId ? resolveGraphViewNodeByIdOrLabel(endpointId) || endpoint : null;
        }
        return resolveGraphViewNodeByIdOrLabel(endpoint);
    };
    const getLinkWeight = (linkItem) => {
        const numericWeight = Number(linkItem && (linkItem.weight || linkItem.confidence));
        return Number.isFinite(numericWeight) ? numericWeight : 0.5;
    };
    const getRelationKind = (linkItem) => (
        normalizeGraphViewText(linkItem && (linkItem.type || linkItem.relationKind || linkItem.kind)) || 'related'
    );
    const outgoing = [];
    const incoming = [];
    const focusEdgeMap = new Map();
    linkList.forEach((linkItem) => {
        const sourceId = getGraphViewLinkNodeId(linkItem && linkItem.source);
        const targetId = getGraphViewLinkNodeId(linkItem && linkItem.target);
        if (!sourceId || !targetId) {
            return;
        }
        if (sourceId === focusD.id || targetId === focusD.id) {
            focusEdgeMap.set(`${sourceId}-${targetId}`, linkItem);
        }
        if (sourceId === focusD.id) {
            const targetNode = getEndpointNode(linkItem && linkItem.target);
            if (targetNode) {
                outgoing.push(targetNode);
            }
            return;
        }
        if (targetId === focusD.id) {
            const sourceNode = getEndpointNode(linkItem && linkItem.source);
            if (sourceNode) {
                incoming.push(sourceNode);
            }
        }
    });
    const scoreNode = (node) => {
        const key1 = `${focusD.id}-${node.id}`;
        const key2 = `${node.id}-${focusD.id}`;
        const edge = focusEdgeMap.get(key1) || focusEdgeMap.get(key2);
        const weight = getLinkWeight(edge);
        const degreeRatio = (Number(node && node.outDegree) || 0) / ((Number(node && node.inDegree) || 0) + 1);
        const normalizedDegreeRatio = Math.min(degreeRatio, 5) / 5;
        return (weight * 0.7) + (normalizedDegreeRatio * 0.3);
    };
    const sortByFocusScore = (left, right) => scoreNode(right) - scoreNode(left);
    const incomingNodes = uniqueById(incoming).sort(sortByFocusScore);
    const outgoingNodes = uniqueById(outgoing).sort(sortByFocusScore);
    const activeIdSet = new Set([focusD.id].concat(
        incomingNodes.map((node) => node.id),
        outgoingNodes.map((node) => node.id)
    ));
    const associatedNodes = uniqueById(linkList
        .map((linkItem) => {
            const sourceId = getGraphViewLinkNodeId(linkItem && linkItem.source);
            const targetId = getGraphViewLinkNodeId(linkItem && linkItem.target);
            if ((sourceId !== focusD.id && targetId !== focusD.id) || getLinkWeight(linkItem) <= 0.6) {
                return null;
            }
            const otherId = sourceId === focusD.id ? targetId : sourceId;
            if (!otherId || activeIdSet.has(otherId)) {
                return null;
            }
            return getEndpointNode(sourceId === focusD.id ? linkItem.target : linkItem.source);
        })
        .filter(Boolean))
        .sort(sortByFocusScore);
    associatedNodes.forEach((node) => activeIdSet.add(node.id));

    const currentWidth = Number.isFinite(Number(width)) ? Number(width) : 1200;
    const currentHeight = Number.isFinite(Number(height)) ? Number(height) : 800;
    const cx = Number.isFinite(Number(focusD.x)) ? Number(focusD.x) : currentWidth / 2;
    const cy = Number.isFinite(Number(focusD.y)) ? Number(focusD.y) : currentHeight / 2;
    const selectedLayoutType = normalizeGraphViewText(options.layoutType)
        || (document.getElementById('focus-layout-select') ? document.getElementById('focus-layout-select').value : '')
        || 'horizontal';
    const layoutType = selectedLayoutType === 'vertical' ? 'vertical' : 'horizontal';
    const defaultLayerGap = focusSpacingSettings && focusSpacingSettings[layoutType]
        ? Number(focusSpacingSettings[layoutType].layer)
        : (layoutType === 'horizontal' ? 125 : 250);
    const defaultNodeGap = focusSpacingSettings && focusSpacingSettings[layoutType]
        ? Number(focusSpacingSettings[layoutType].node)
        : (layoutType === 'horizontal' ? 80 : 20);
    const layerGap = Number.isFinite(Number(options.layerGap)) ? Number(options.layerGap) : defaultLayerGap;
    const nodeGap = Number.isFinite(Number(options.nodeGap)) ? Number(options.nodeGap) : defaultNodeGap;
    const projectionNodes = [];
    const projectionLabels = [];
    const points = new Map();
    const addProjectionNode = (node, role, x, y, labelDy, labelDx) => {
        const id = normalizeGraphViewText(node && node.id);
        if (!id || points.has(id)) {
            return;
        }
        points.set(id, { x, y });
        projectionNodes.push({
            id,
            label: getGraphViewNodeLabel(node) || id,
            role,
            x,
            y,
            score: Number(scoreNode(node).toFixed(4)),
            inDegree: Number(node && node.inDegree) || 0,
            outDegree: Number(node && node.outDegree) || 0,
            sourcePath: normalizeGraphViewText(node && (
                node.sourcePath
                || node.filepath
                || (node.metadata && (node.metadata.sourcePath || node.metadata.filepath))
            )),
            radius: role === 'anchor' ? 25 : 8,
            labelDy,
            labelDx,
        });
    };
    addProjectionNode(focusD, 'anchor', cx, cy, 35, layoutType === 'vertical' ? 25 : 29);
    if (layoutType === 'vertical') {
        const spreadVertical = (nodeList, baselineX, role) => {
            const totalHeight = (nodeList.length - 1) * nodeGap;
            const startY = cy - totalHeight / 2;
            nodeList.forEach((node, index) => {
                addProjectionNode(node, role, baselineX, startY + (index * nodeGap), 25, 25);
            });
        };
        spreadVertical(incomingNodes, cx - layerGap, 'incoming');
        spreadVertical(outgoingNodes, cx + layerGap, 'outgoing');
        projectionLabels.push({
            text: typeof t === 'function' ? t('focus_inbound') : 'Inbound',
            x: cx - layerGap,
            y: cy - (incomingNodes.length * nodeGap / 2) - 40,
            align: 'middle',
            role: 'incoming',
        });
        projectionLabels.push({
            text: typeof t === 'function' ? t('focus_outbound') : 'Outbound',
            x: cx + layerGap,
            y: cy - (outgoingNodes.length * nodeGap / 2) - 40,
            align: 'middle',
            role: 'outgoing',
        });
    } else {
        const spreadHorizontal = (nodeList, baselineY, role) => {
            const totalWidth = (nodeList.length - 1) * nodeGap;
            const startX = cx - totalWidth / 2;
            nodeList.forEach((node, index) => {
                const nodeScore = scoreNode(node);
                const stagger = (index % 2 === 0 ? -1 : 1) * 20;
                const nodeY = baselineY + stagger + (nodeScore * 20);
                addProjectionNode(node, role, startX + (index * nodeGap), nodeY, nodeY < baselineY ? -15 : 25, 12);
            });
        };
        spreadHorizontal(outgoingNodes, cy - layerGap, 'outgoing');
        spreadHorizontal(incomingNodes, cy + layerGap, 'incoming');
        projectionLabels.push({
            text: typeof t === 'function' ? t('focus_outbound') : 'Outbound',
            x: cx,
            y: cy - layerGap - 60,
            align: 'middle',
            role: 'outgoing',
        });
        projectionLabels.push({
            text: typeof t === 'function' ? t('focus_inbound') : 'Inbound',
            x: cx,
            y: cy + layerGap + 80,
            align: 'middle',
            role: 'incoming',
        });
    }
    if (associatedNodes.length > 0) {
        const left = [];
        const right = [];
        associatedNodes.forEach((node, index) => {
            if (index % 2 === 0) {
                left.push(node);
            } else {
                right.push(node);
            }
        });
        const sideGap = layerGap * 1.2;
        const placeSide = (nodeList, direction) => {
            nodeList.forEach((node, index) => {
                addProjectionNode(
                    node,
                    'associated',
                    cx + (direction * sideGap),
                    cy + (index * 60) - (nodeList.length * 30),
                    25,
                    12
                );
            });
        };
        placeSide(left, -1);
        placeSide(right, 1);
    }

    const visibleIds = new Set(projectionNodes.map((node) => node.id));
    const projectionEdges = linkList
        .map((linkItem) => {
            const sourceId = getGraphViewLinkNodeId(linkItem && linkItem.source);
            const targetId = getGraphViewLinkNodeId(linkItem && linkItem.target);
            if (!sourceId || !targetId || !visibleIds.has(sourceId) || !visibleIds.has(targetId)) {
                return null;
            }
            return {
                sourceId,
                targetId,
                relationKind: getRelationKind(linkItem),
                confidence: getLinkWeight(linkItem),
                role: sourceId === focusD.id
                    ? 'outgoing'
                    : targetId === focusD.id
                        ? 'incoming'
                        : 'associated',
            };
        })
        .filter(Boolean);
    const maxContextNodes = Number.isFinite(Number(options.maxContextNodes))
        ? Math.max(0, Math.min(500, Math.trunc(Number(options.maxContextNodes))))
        : 220;
    const contextNodes = maxContextNodes > 0
        ? (Array.isArray(nodes) ? nodes : [])
            .map((node) => {
                const id = normalizeGraphViewText(node && node.id);
                const x = Number(node && node.x);
                const y = Number(node && node.y);
                if (!id || visibleIds.has(id) || !Number.isFinite(x) || !Number.isFinite(y)) {
                    return null;
                }
                const dx = x - cx;
                const dy = y - cy;
                const distance = Math.sqrt((dx * dx) + (dy * dy));
                const degree = (Number(node && node.inDegree) || 0) + (Number(node && node.outDegree) || 0);
                const degreeScore = Math.min(degree, 40) / 40;
                const proximityScore = 1 / (1 + (distance / Math.max(layerGap, nodeGap, 1)));
                return {
                    id,
                    label: getGraphViewNodeLabel(node) || id,
                    x,
                    y,
                    inDegree: Number(node && node.inDegree) || 0,
                    outDegree: Number(node && node.outDegree) || 0,
                    score: Number(((proximityScore * 0.72) + (degreeScore * 0.28)).toFixed(4)),
                };
            })
            .filter(Boolean)
            .sort((left, right) => right.score - left.score)
            .slice(0, maxContextNodes)
        : [];
    const boundsPoints = projectionNodes
        .map((node) => ({ x: node.x, y: node.y }))
        .concat(projectionLabels.map((label) => ({ x: label.x, y: label.y })));
    const contextBoundsPoints = contextNodes.length > 0
        ? contextNodes.map((node) => ({ x: node.x, y: node.y }))
        : boundsPoints;
    const minX = Math.min(...boundsPoints.map((point) => point.x));
    const maxX = Math.max(...boundsPoints.map((point) => point.x));
    const minY = Math.min(...boundsPoints.map((point) => point.y));
    const maxY = Math.max(...boundsPoints.map((point) => point.y));
    const contextMinX = Math.min(...contextBoundsPoints.map((point) => point.x));
    const contextMaxX = Math.max(...contextBoundsPoints.map((point) => point.x));
    const contextMinY = Math.min(...contextBoundsPoints.map((point) => point.y));
    const contextMaxY = Math.max(...contextBoundsPoints.map((point) => point.y));
    return {
        anchorId: focusD.id,
        anchorLabel: getGraphViewNodeLabel(focusD) || focusD.id,
        layoutType,
        layerGap,
        nodeGap,
        stats: {
            inDegree: Number(focusD.inDegree) || incomingNodes.length,
            outDegree: Number(focusD.outDegree) || outgoingNodes.length,
            incomingCount: incomingNodes.length,
            outgoingCount: outgoingNodes.length,
            associatedCount: associatedNodes.length,
            contextCount: contextNodes.length,
        },
        controls: {
            layoutType,
            layerGap,
            nodeGap,
            rendererMode: document.querySelector('input[name="rendererMode"]:checked')
                ? document.querySelector('input[name="rendererMode"]:checked').value
                : '',
        },
        labels: projectionLabels,
        contextNodes,
        nodes: projectionNodes,
        edges: projectionEdges,
        bounds: {
            minX,
            maxX,
            minY,
            maxY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
        },
        contextBounds: {
            minX: contextMinX,
            maxX: contextMaxX,
            minY: contextMinY,
            maxY: contextMaxY,
            width: Math.max(1, contextMaxX - contextMinX),
            height: Math.max(1, contextMaxY - contextMinY),
        },
    };
}

// Compatibility API for agent workspace graph-focus capabilities.
// Keeps agent runtime decoupled from historical global helper names.
window.NoteConnectionGraphView = {
    resolveNodeById: function(nodeId) {
        const id = String(nodeId || '').trim();
        if (!id) {
            return null;
        }
        return resolveGraphViewNodeByIdOrLabel(id);
    },
    resolveNodeByKnowledgePoint: function(payload) {
        return resolveGraphViewNodeByKnowledgePoint(payload);
    },
    openFocusModeById: function(nodeId) {
        const node = this.resolveNodeById(nodeId);
        if (!node) {
            return false;
        }
        if (window.highlightManager && typeof window.highlightManager.unhighlight === 'function') {
            window.highlightManager.unhighlight({ force: true });
        }
        const popup = document.getElementById('node-stats-popup');
        if (popup) {
            popup.style.display = 'none';
        }
        enterFocusMode(node);
        return true;
    },
    getFocusNode: function() {
        return focusNode && typeof focusNode === 'object'
            ? focusNode
            : null;
    },
    getFocusModeSnapshot: function(nodeId) {
        return buildGraphViewFocusModeSnapshot(nodeId || (focusNode && focusNode.id));
    },
    getFocusModeProjection: function(nodeId, options) {
        return buildGraphViewFocusModeProjection(nodeId || (focusNode && focusNode.id), options || {});
    },
    getNodeCount: function() {
        return Array.isArray(nodes) ? nodes.length : 0;
    },
};



// --- Query History Implementation (v0.9.77) ---
window.focusHistory = [];
const MAX_HISTORY = 10;

function updateFocusHistory(newNode) {
    // Avoid duplicates: Remove if exists, then add to top
    // Requirement: "pin the corresponding node to the top"
    window.focusHistory = window.focusHistory.filter(n => n.id !== newNode.id);
    
    // Add to specific history list
    window.focusHistory.unshift(newNode);
    if (window.focusHistory.length > MAX_HISTORY) window.focusHistory.pop();
    
    renderFocusHistory();
}

function renderFocusHistory() {
    const container = document.getElementById('focus-history-list');
    if (!container) return; // Should be created by init
    
    container.innerHTML = '';
    
    if (window.focusHistory.length === 0) {
        container.innerHTML = '<div style="padding:5px; color:#aaa; font-style:italic">No history</div>';
        return;
    }

    window.focusHistory.forEach(node => {
        const item = document.createElement('div');
        item.style.padding = '4px 8px';
        item.style.cursor = 'pointer';
        item.style.borderBottom = '1px solid #444';
        item.style.fontSize = '0.8rem';
        item.style.color = '#eee';
        item.innerText = node.label;
        item.title = `Cluster: ${node.clusterId || '-'}`;
        
        item.addEventListener('mouseenter', () => item.style.background = '#444');
        item.addEventListener('mouseleave', () => item.style.background = '');
        
        item.addEventListener('click', (e) => {
             e.stopPropagation(); // prevent closing dropdown immediately?
             // Close dropdown handled by global click?
             document.getElementById('focus-history-dropdown').style.display = 'none';
             enterFocusMode(node);
        });
        
        container.appendChild(item);
    });
}

// Inject History UI
function initFocusHistoryUI() {
    const parent = document.getElementById('focus-exit-btn');
    if (!parent || document.getElementById('btn-focus-history')) return;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.marginRight = '5px';

    const btn = document.createElement('button');
    btn.id = 'btn-focus-history';
    btn.innerText = 'History ▼';
    btn.style.fontSize = '0.8rem';
    btn.style.padding = '2px 6px';
    btn.style.cursor = 'pointer';
    
    const dropdown = document.createElement('div');
    dropdown.id = 'focus-history-dropdown';
    dropdown.style.display = 'none';
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.background = '#222';
    dropdown.style.border = '1px solid #555';
    dropdown.style.zIndex = '2000';
    dropdown.style.minWidth = '150px';
    dropdown.style.maxHeight = '300px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';

    const list = document.createElement('div');
    list.id = 'focus-history-list';
    
    dropdown.appendChild(list);
    wrapper.appendChild(btn);
    wrapper.appendChild(dropdown);
    
    // Insert before 'Specific Content' button
    const neighbor = document.getElementById('btn-open-content');
    if (neighbor) {
        parent.insertBefore(wrapper, neighbor);
    } else {
        parent.appendChild(wrapper);
    }

    // Toggle Logic
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';
    });
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// Ensure init happens
initFocusHistoryUI();

function enterFocusMode(focusDInput) {
    // v1.0.1 Fix: Resolve to live node instance (Defensive)
    // Ensures we don't accidentally use a stale object (e.g. from graphData) 
    // while the renderer iterates over the live 'nodes' array.
    let focusD = focusDInput;
    if (nodes && nodes.length > 0) {
        const id = focusDInput.id || focusDInput; // Handle ID string or Node object
        const liveNode = nodes.find(n => n.id === id);
        if (liveNode) {
            focusD = liveNode;
        } else {
            console.warn('[Focus] Node not found in active simulation:', id);
            return;
        }
    }
    // Backup original positions AND visual properties to ensure complete restoration upon exit (v1.0.0)
    // 备份原始位置和视觉属性以确保退出时完全恢复
    nodes.forEach((n, idx) => {
        // Only backup if not already backed up (in case of re-entry/nested calls)
        if (n._origX === undefined) {
            n._origX = n.x;
            n._origY = n.y;
            n._origFx = n.fx;
            n._origFy = n.fy;
            
            // NEW: Save visual properties (size)
            // Get the actual rendered radius and font size from DOM elements
            const circleEl = circles.filter(d => d.id === n.id);
            const textEl = texts.filter(d => d.id === n.id);
            
            if (!circleEl.empty()) {
                n._origRadius = parseFloat(circleEl.attr('r')) || 5;
            } else {
                n._origRadius = 5; // fallback
            }
            
            if (!textEl.empty()) {
                n._origFontSize = textEl.attr('font-size') || '10px';
            } else {
                n._origFontSize = '10px'; //fallback
            }
        }
    });

    // Update focus mode state
    // 更新专注模式状态
    updateFocusModeState(true, focusD);
    
    // v0.9.77: Add to History
    updateFocusHistory(focusD);

    // Update Stats
    document.getElementById('focus-node-stats').innerText = `In: ${focusD.inDegree} | Out: ${focusD.outDegree}`;

    // RESET ALL NODES first to prevent accumulation of visible nodes
    nodes.forEach(n => {
        n.isFocusVisible = false;
        // Optional: Reset fx/fy for cleanliness, but important one is visibility flag
        // We generally want to release nodes that are no longer part of the focus set
        n.fx = null;
        n.fy = null; 
        n._labelDy = null;
    });

    focusNode = focusD;
    
    // 1. UI Updates
    document.getElementById('focus-exit-btn').style.display = 'flex';
    // v0.9.46: Hide main interface settings in Focus Mode
    document.getElementById('source-control').style.display = 'none';
    document.getElementById('controls').style.display = 'none';

    document.getElementById('focus-node-name').innerText = focusD.label;
    // document.getElementById('controls').style.opacity = '0.3'; // Dim controls - Removed as we hide it now
    // document.getElementById('controls').style.pointerEvents = 'none'; // Disable controls - Removed as we hide it now
    
    // 2. Identify Nodes (OPTIMIZED with adjacency cache)
    const superiors = []; // Outgoing: Focus -> Target (Superior / Further Exploration)
    const subordinates = []; // Incoming: Source -> Focus (Subordinate / Helping to understand)
    
    const startTime = performance.now();
    
    // Fast lookup using adjacency cache (built once, reused)
    if (!window._adjacencyCache || window._adjacencyCacheStale) {
        console.log('[Focus] Building adjacency cache...');
        const cacheStart = performance.now();
        
        window._adjacencyCache = {
            outgoing: new Map(), // nodeId -> [targetNodes]
            incoming: new Map()  // nodeId -> [sourceNodes]
        };
        
        links.forEach(l => {
            const srcId = l.source.id;
            const tgtId = l.target.id;
            
            if (!window._adjacencyCache.outgoing.has(srcId)) {
                window._adjacencyCache.outgoing.set(srcId, []);
            }
            window._adjacencyCache.outgoing.get(srcId).push(l.target);
            
            if (!window._adjacencyCache.incoming.has(tgtId)) {
                window._adjacencyCache.incoming.set(tgtId, []);
            }
            window._adjacencyCache.incoming.get(tgtId).push(l.source);
        });
        
        window._adjacencyCacheStale = false;
        console.log(`[Focus] Cache built in ${(performance.now() - cacheStart).toFixed(2)}ms`);
    }
    
    // Fast retrieval O(1) instead of O(N) for each lookup
    const outgoingNodes = window._adjacencyCache.outgoing.get(focusD.id) || [];
    const incomingNodes = window._adjacencyCache.incoming.get(focusD.id) || [];
    
    superiors.push(...outgoingNodes);
    subordinates.push(...incomingNodes);
    
    const uniqueSup = [...new Set(superiors)];
    const uniqueSub = [...new Set(subordinates)];
    
    console.log(`[Focus] Node lookup: ${(performance.now() - startTime).toFixed(2)}ms (${uniqueSup.length} outgoing, ${uniqueSub.length} incoming)`);
    
    // 3. Intra-layer Sorting & Scoring (OPTIMIZED with cached edge lookup)
    // Build edge lookup map for scoring (only for focus node edges)
    const edgeMap = new Map();
    links.forEach(l => {
        if (l.source.id === focusD.id || l.target.id === focusD.id) {
            const key = `${l.source.id}-${l.target.id}`;
            edgeMap.set(key, l);
        }
    });
    
    const getFocusScore = (n) => {
        const key1 = `${focusD.id}-${n.id}`;
        const key2 = `${n.id}-${focusD.id}`;
        const edge = edgeMap.get(key1) || edgeMap.get(key2);
        const weight = edge ? (edge.weight || 0.5) : 0.5;
        const degreeRatio = (n.outDegree || 0) / ((n.inDegree || 0) + 1);
        const normRatio = Math.min(degreeRatio, 5) / 5; 
        return (weight * 0.7) + (normRatio * 0.3);
    };

    uniqueSup.forEach(n => n._focusScore = getFocusScore(n));
    uniqueSub.forEach(n => n._focusScore = getFocusScore(n));

    const sortFn = (a, b) => b._focusScore - a._focusScore;
    uniqueSup.sort(sortFn);
    uniqueSub.sort(sortFn);
    
    // 4. Layout Calculation
    // Stop simulation to prevent movement during calculation
    simulationWorker.postMessage({ type: 'stop' });
    
    // Requirement: "central position of this node should be the original position"
    // We use focusD.x / focusD.y as the anchor.
    // If the node hasn't been simulated yet (unlikely), fallback to center.
    const cx = focusD.x || width / 2;
    const cy = focusD.y || height / 2;
    
    // Center the view on this node (Optional, but good UX if we keep original pos)
    // We need to transform the graph so (cx, cy) is at screen center.
    // currentTransform is k, x, y. 
    // We want: newX + cx*k = screenWidth/2
    // newX = screenWidth/2 - cx*k
    // Let's preserve current scale 'k' or zoom in slightly?
    const targetScale = Math.max(1, d3.zoomTransform(svg.node()).k);
    svg.transition().duration(750).call(
        d3.zoom().transform, 
        d3.zoomIdentity.translate(width/2 - cx * targetScale, height/2 - cy * targetScale).scale(targetScale)
    );

    // Get settings
    const layoutType = document.getElementById('focus-layout-select') ? document.getElementById('focus-layout-select').value : 'horizontal';

    // v0.9.44: Sync sliders from stored settings for this mode
    if (typeof focusSpacingSettings !== 'undefined' && focusSpacingSettings[layoutType]) {
        document.getElementById('focus-spacing-slider').value = focusSpacingSettings[layoutType].layer;
        document.getElementById('focus-h-spacing-slider').value = focusSpacingSettings[layoutType].node;
    }

    const layerGap = parseInt(document.getElementById('focus-spacing-slider').value) || 250; 
    const hSpacing = parseInt(document.getElementById('focus-h-spacing-slider').value) || 80;

    // Set Focus Node Fixed Position
    focusD.fx = cx;
    focusD.fy = cy;
    // v0.9.80: Sync internal position to prevent snap-back on drag
    focusD.x = cx;
    focusD.y = cy;
    
    focusD.isFocusVisible = true;
    focusD._labelDy = 35; 
    if (layoutType === 'vertical') focusD._labelDx = 25; 

    // Define Semantic Labels for rendering
    window.focusLabels = [];

    if (layoutType === 'vertical') {
        // Vertical Layout (Left-to-Right structure: Inbound -> Selected -> Outbound)
        // Requirement: "arranged from left to right as 'inbound node - selected node - outbound node'"
        // So: Left = Inbound (Sub), Center = Focus, Right = Outbound (Sup)
        
        const spreadVertical = (nodeList, baselineX) => {
            const count = nodeList.length;
            if (count === 0) return;
            const totalHeight = (count - 1) * hSpacing;
            const startY = cy - totalHeight / 2;
            
            nodeList.forEach((n, i) => {
                n.fx = baselineX;
                n.fy = startY + i * hSpacing;
                // v0.9.80: Sync internal position
                n.x = n.fx; n.y = n.fy;
                
                n.isFocusVisible = true;
                n._labelDy = 25;
                n._labelDx = 25;
            });
        };

        spreadVertical(uniqueSub, cx - layerGap); // Left: Inbound
        spreadVertical(uniqueSup, cx + layerGap); // Right: Outbound

        // Add Labels
        window.focusLabels.push({ text: t("focus_inbound"), x: cx - layerGap, y: cy - (uniqueSub.length * hSpacing / 2) - 40, align: "middle" });
        window.focusLabels.push({ text: t("focus_outbound"), x: cx + layerGap, y: cy - (uniqueSup.length * hSpacing / 2) - 40, align: "middle" });

    } else {
        // Horizontal Layout (Standard / Top-Bottom)
        // Top = Outbound (Sup), Bottom = Inbound (Sub)
        
        const spreadHorizontal = (nodeList, baselineY) => {
            const count = nodeList.length;
            if (count === 0) return;
            const totalWidth = (count - 1) * hSpacing;
            const startX = cx - totalWidth / 2;
            
            nodeList.forEach((n, i) => {
                n.fx = startX + i * hSpacing;
                
                // Stagger
                const stagger = (i % 2 === 0 ? -1 : 1) * 20; 
                const criteriaOffset = (n._focusScore * 20); 
                n.fy = baselineY + stagger + criteriaOffset;
                
                // v0.9.80: Sync internal position
                n.x = n.fx; n.y = n.fy;
                
                n.isFocusVisible = true;
                if (n.fy < baselineY) n._labelDy = -15; else n._labelDy = 25;
            });
        };

        spreadHorizontal(uniqueSup, cy - layerGap); // Top (Outbound)
        spreadHorizontal(uniqueSub, cy + layerGap); // Bottom (Inbound)

        // Labels
        // Top Area (Outbound) -> "Further exploration"
        window.focusLabels.push({ text: t("focus_outbound"), x: cx, y: cy - layerGap - 60, align: "middle" });
        // Bottom Area (Inbound) -> "Helping to understand"
        window.focusLabels.push({ text: t("focus_inbound"), x: cx, y: cy + layerGap + 80, align: "middle" });
    }
    
    // Associated Nodes (Side placement - simplified for now, keep existing logic but adapt to cx/cy)
    const associated = [];
    links.forEach(l => {
        if ((l.source.id === focusD.id || l.target.id === focusD.id) && l.weight > 0.6) { 
             const other = l.source.id === focusD.id ? l.target : l.source;
             if (!uniqueSup.includes(other) && !uniqueSub.includes(other)) {
                 associated.push(other);
             }
        }
    });
    
    if (associated.length > 0) {
        const left = [];
        const right = [];
        associated.forEach((n, i) => {
            n.isFocusVisible = true;
            if (i % 2 === 0) left.push(n); else right.push(n);
        });
        
        // Place associated nodes loosely around
        const sideGap = layerGap * 1.2; 
        const placeSide = (list, dir) => {
             list.forEach((n, i) => {
                n.fx = cx + (dir * sideGap);
                n.fy = cy + (i * 60) - (list.length * 30);
                n._labelDy = 25;
                // v0.9.80: Sync internal position for associated nodes too
                n.x = n.fx; n.y = n.fy;
             });
        };
        placeSide(left, -1);
        placeSide(right, 1);
    }

    // 5. Apply Updates
    simulation.stop(); // Stop main thread proxy if needed (it does nothing)
    link.style("display", "none");
    updateVisibility();
    
    // Optimization: Subset Simulation
    const activeNodes = [focusD, ...uniqueSup, ...uniqueSub, ...associated];
    const activeNodeIds = new Set(activeNodes.map(n => n.id));
    const activeLinks = links.filter(l => activeNodeIds.has(l.source.id) && activeNodeIds.has(l.target.id));
    
    // Convert to simplified objects for worker
    const workerActiveNodes = activeNodes.map(n => ({
        id: n.id,
        x: n.x, y: n.y,
        fx: n.fx, fy: n.fy, // Important: fx/fy are set by manual layout logic above
        rank: n.rank
    }));
    
    const workerActiveLinks = activeLinks.map(l => ({
        source: l.source.id,
        target: l.target.id
    }));

    simulationWorker.postMessage({
        type: 'setNodes',
        payload: {
            nodes: workerActiveNodes,
            links: workerActiveLinks,
            restart: false // v0.9.75: Ensure simulation is STOPPED in Focus Mode
        }
    });


    // Render Focus Labels (SVG)
    g.selectAll(".focus-label-group").remove(); // Clear old
    if (document.querySelector('input[name="rendererMode"]:checked').value === 'svg') {
        const labelGroup = g.append("g").attr("class", "focus-label-group");
        window.focusLabels.forEach(lbl => {
            labelGroup.append("text")
                .attr("class", "focus-label")
                .attr("x", lbl.x)
                .attr("y", lbl.y)
                .attr("text-anchor", lbl.align || "middle")
                .text(lbl.text);
        });
    }

    node.each(function(d) {
        if (isNodeVisible(d)) {
            const el = d3.select(this);
            el.transition().duration(750)
                .attr("transform", `translate(${d.fx},${d.fy})`);
            
            // Safe Attribute Interpolation
            // Ensure values are numbers before adding 'px', or use safe defaults
            const safeDy = d._labelDy !== undefined && !isNaN(d._labelDy) ? d._labelDy + "px" : ".35em";
            const safeDx = d._labelDx !== undefined && !isNaN(d._labelDx) ? d._labelDx + "px" : (d.id === focusD.id ? "29px" : "12px");

            el.select("text").transition().duration(750)
                .attr("dy", safeDy)
                .attr("dx", safeDx);
            if (d.id === focusD.id) {
                el.select("circle").transition().duration(750)
                    .attr("r", 25).attr("fill", "#ffd700").attr("stroke", "#fff").attr("stroke-width", "3px");
                el.select("text").transition().duration(750)
                    .attr("font-size", "16px").attr("font-weight", "bold").attr("fill", "#fff");
            } else {
                const isSup = uniqueSup.includes(d);
                const isSub = uniqueSub.includes(d);
                const color = isSup ? "#4ecdc4" : (isSub ? "#ff6b6b" : "#aaa");
                el.select("circle").transition().duration(750)
                    .attr("r", 8).attr("fill", color);
                el.select("text").transition().duration(750)
                    .attr("font-size", "10px").attr("font-weight", "normal").attr("fill", "#ccc");
            }
        } else {
             d.fx = null; d.fy = null; d.isFocusVisible = false; d._labelDy = null;
        }
    });
    // v0.9.75: Removed simulation.alpha(0.1).restart() to comply with "cease simulating" requirement.
    // simulation.alpha(0.1).restart();
    ticked(); // Force render update (Canvas)
    scheduleGraphSemanticA11yRefresh('Focus mode entered');
}
      
      
      
      function exitFocusMode() {
    // Update focus mode state
    // 更新专注模式状态
    updateFocusModeState(false, null);
    
    focusNode = null;

    document.getElementById('focus-exit-btn').style.display = 'none';

    // v0.9.46: Restore main interface settings
    document.getElementById('source-control').style.display = ''; 
    document.getElementById('controls').style.display = '';

    link.style("display", "block");

    // 1. Restore Original Positions FIRST (Critical Step)
    // We must revert to the pre-focus state *before* syncing with the worker
    nodes.forEach(d => {
        // Restore original positions (v0.9.30)
        // 恢复原始位置
        if (d._origX !== undefined) d.x = d._origX;
        if (d._origY !== undefined) d.y = d._origY;
        
        // Restore fx/fy only if they were set (e.g., manual drag outside focus)
        // 仅在设置了 fx/fy 时恢复（例如，专注模式外的移动）
        d.fx = d._origFx !== undefined ? d._origFx : null;
        d.fy = d._origFy !== undefined ? d._origFy : null;
        
        // Cleanup backup props
        delete d._origX; delete d._origY; delete d._origFx; delete d._origFy;

        // Reset Focus flags
        d.isFocusVisible = false; 
        d._labelDy = null;
    });

    // 2. Restore Visual State (Dimensions & Colors) - IMMEDIATELY without transition
    // NEW v1.0.0: Restore exact pre-focus sizes before calling updateSize()
    nodes.forEach(d => {
        // Restore circle radius
        if (d._origRadius !== undefined) {
            const circleEl = circles.filter(node => node.id === d.id);
            if (!circleEl.empty()) {
                // Instantly restore original radius (no transition to avoid morphing artifact)
                circleEl.attr('r', d._origRadius);
            }
            delete d._origRadius;
        }
        
        // Restore text font size
        if (d._origFontSize !== undefined) {
            const textEl = texts.filter(node => node.id === d.id);
            if (!textEl.empty()) {
                textEl.attr('font-size', d._origFontSize);
            }
            delete d._origFontSize;
        }
    });
    
    // Call these explicitly to reset sizes from Focus Mode values (25px/8px) back to global settings
    updateVisibility(); 
    
    // Instant restoration of size/color to avoid "morphing" from focus state
    // We can use a special flag or just rely on the transition being fast/imperceptible if we remove delay?
    // Let's force a "clean" update.
    updateColor();
    updateSize();

    // Reset Texts specific focus overrides (dy)
    node.selectAll("text").transition().duration(500).attr("dy", ".35em");
    node.selectAll("circle").transition().duration(500).attr("stroke-width", "1.5px");
    
    // Clear Focus Labels (SVG)
    g.selectAll(".focus-label-group").remove();
    window.focusLabels = [];

    // 3. Sync Worker with Restored State
    const workerNodes = nodes.map(n => ({ 
        id: n.id, 
        x: n.x, y: n.y, 
        fx: n.fx, fy: n.fy, 
        rank: n.rank,
        vx: n.vx || 0, vy: n.vy || 0 // optionally reset velocity?
    }));
    const workerLinks = physicsLinks.map(l => ({ source: l.source.id, target: l.target.id }));

    simulationWorker.postMessage({
        type: 'setNodes',
        payload: {
            nodes: workerNodes,
            links: workerLinks,
            restart: false // Set data, don't restart yet
        }
    });

    // 4. Check Freeze Layout State & Restart if needed
    const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;

    if (isFrozen) {
        simulation.stop();
        ticked(); // Force one render to show all nodes in their current (restored) positions
    } else {
        simulation.alpha(1).restart();
    }
    scheduleGraphSemanticA11yRefresh('Focus mode exited');
}

// Expose Focus Mode functions for Tutorial and External Modules
window.enterFocusMode = enterFocusMode;
window.exitFocusMode = exitFocusMode;

// Max Workers (Performance)
const workersSlider = document.getElementById('set-workers-slider');
    const workersInput = document.getElementById('set-workers-input');
    const gpuCheckbox = document.getElementById('set-gpu');

    if (workersSlider && workersInput) {
        const updateWorkers = (val) => {
            const num = parseInt(val);
            if (isNaN(num) || num < 1) return;
            workersSlider.value = num;
            workersInput.value = num;
            settingsManager.set('performance', 'maxWorkers', num);
        };

        workersSlider.addEventListener('input', (e) => updateWorkers(e.target.value));
        workersInput.addEventListener('change', (e) => updateWorkers(e.target.value));
    }
    
    if (gpuCheckbox) {
        gpuCheckbox.addEventListener('change', (e) => {
            settingsManager.set('performance', 'enableGPU', e.target.checked);
        });
    }

    // --- Settings Integration ---
function initSettingsUI() {
    const modal = document.getElementById('settings-modal');
    const agentModal = document.getElementById('agent-settings-modal');
    const openBtn = document.getElementById('btn-open-settings');
    const mainCloseBtns = modal ? modal.querySelectorAll('[data-settings-close="main"]') : [];
    const agentCloseBtns = agentModal ? agentModal.querySelectorAll('[data-settings-close="agent"]') : [];
    const openAgentSettingsBtn = document.getElementById('btn-open-agent-settings');
    const agentSettingsBackBtn = document.getElementById('btn-agent-settings-back');
    const agentSettingsBackFooterBtn = document.getElementById('btn-agent-settings-back-footer');
    const resetBtn = document.getElementById('btn-reset-settings');
    
    // Track settings page state so simulation only resumes after every settings
    // surface is actually closed.
    let activeSettingsPage = null;

    // Controls
    const inputs = {
        charge: document.getElementById('set-charge'),
        distance: document.getElementById('set-distance'),
        collision: document.getElementById('set-collision'),
        opacity: document.getElementById('set-opacity')
    };

    const displays = {
        charge: document.getElementById('val-charge'),
        distance: document.getElementById('val-distance'),
        collision: document.getElementById('val-collision'),
        opacity: document.getElementById('val-opacity')
    };
    
    // Performance Controls
    const workersSlider = document.getElementById('set-workers-slider');
    const workersInput = document.getElementById('set-workers-input');
    const gpuCheckbox = document.getElementById('set-gpu');
    const staticModeCheckbox = document.getElementById('set-static-mode');
    const gpuRenderingCheckbox = document.getElementById('set-gpu-rendering');
    const memorySavingCheckbox = document.getElementById('set-memory-saving');
    const compactModeCheckbox = document.getElementById('set-compact-mode');
    const deepDebugCheckbox = document.getElementById('set-deep-debug');
    
    // Reader Settings
    const inputReadingMode = document.getElementById('set-reading-mode');

    // Simplified NoteMD Provider Settings
    const providerTemplateSelect = document.getElementById('set-notemd-provider-template');
    const providerTemplateHint = document.getElementById('set-notemd-provider-template-hint');
    const providerNameSelect = document.getElementById('set-notemd-provider-name');
    const providerBaseUrlInput = document.getElementById('set-notemd-provider-base-url');
    const providerModelInput = document.getElementById('set-notemd-provider-model');
    const providerApiKeyInput = document.getElementById('set-notemd-provider-api-key');
    const providerApiVersionInput = document.getElementById('set-notemd-provider-api-version');
    const providerApiVersionRow = document.getElementById('set-notemd-provider-api-version-row');
    const providerApiVersionHint = document.getElementById('set-notemd-provider-api-version-hint');
    const providerStatus = document.getElementById('set-notemd-provider-status');
    const providerConfigPath = document.getElementById('set-notemd-provider-config-path');
    const applyProviderTemplateBtn = document.getElementById('btn-apply-notemd-provider-template');
    const testProviderBtn = document.getElementById('btn-test-notemd-provider');
    const saveProviderBtn = document.getElementById('btn-save-notemd-provider');
    const materializeProviderTemplatesBtn = document.getElementById('btn-materialize-notemd-provider-templates');
    const NOTEMD_PROVIDER_DRAFT_STORAGE_KEY = 'nc.notemdProviderDraft.v1';
    const NOTEMD_PROVIDER_AUTOSAVE_DEBOUNCE_MS = 900;

    const notemdProviderModalState = {
        settings: null,
        templates: [],
        configPath: '',
        loading: false,
        autosaveTimer: null,
        lastSavedFingerprint: '',
        applyingDraft: false,
    };

    const t = (key, fallback, params) => {
        if (window.i18n && typeof window.i18n.t === 'function') {
            const translated = window.i18n.t(key, params);
            if (translated && translated !== key) {
                return translated;
            }
        }
        return fallback;
    };

    const buildRuntimeUrl = (resourcePath) => {
        if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.buildUrl === 'function') {
            return window.NoteConnectionRuntime.buildUrl(resourcePath.replace(/^\/+/, ''));
        }
        return resourcePath;
    };

    const buildRuntimeFetchOptions = (init) => {
        if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.buildFetchOptions === 'function') {
            return window.NoteConnectionRuntime.buildFetchOptions(init);
        }
        return init;
    };

    const cloneJson = (value) => JSON.parse(JSON.stringify(value));

    const clearProviderAutosaveTimer = () => {
        if (notemdProviderModalState.autosaveTimer) {
            clearTimeout(notemdProviderModalState.autosaveTimer);
            notemdProviderModalState.autosaveTimer = null;
        }
    };

    const readProviderDraftStore = () => {
        try {
            const raw = localStorage.getItem(NOTEMD_PROVIDER_DRAFT_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_error) {
            return {};
        }
    };

    const writeProviderDraftStore = (draftStore) => {
        try {
            localStorage.setItem(NOTEMD_PROVIDER_DRAFT_STORAGE_KEY, JSON.stringify(draftStore || {}));
        } catch (_error) {
            // Best effort only.
        }
    };

    const getProviderDraft = (providerName) => {
        const draftStore = readProviderDraftStore();
        const key = String(providerName || '').trim();
        if (!key || !draftStore[key] || typeof draftStore[key] !== 'object') {
            return null;
        }
        return draftStore[key];
    };

    const updateProviderDraft = (providerName, draftPatch) => {
        const key = String(providerName || '').trim();
        if (!key) {
            return;
        }
        const draftStore = readProviderDraftStore();
        const current = draftStore[key] && typeof draftStore[key] === 'object' ? draftStore[key] : {};
        draftStore[key] = {
            ...current,
            ...draftPatch,
            updatedAt: new Date().toISOString(),
        };
        writeProviderDraftStore(draftStore);
    };

    const removeProviderDraft = (providerName) => {
        const key = String(providerName || '').trim();
        if (!key) {
            return;
        }
        const draftStore = readProviderDraftStore();
        if (Object.prototype.hasOwnProperty.call(draftStore, key)) {
            delete draftStore[key];
            writeProviderDraftStore(draftStore);
        }
    };

    const setProviderModalStatus = (message, tone = 'muted') => {
        if (!providerStatus) {
            return;
        }
        providerStatus.textContent = String(message || '');
        providerStatus.style.color =
            tone === 'error'
                ? '#fca5a5'
                : tone === 'success'
                    ? '#93c5fd'
                    : '#aeb7c3';
    };

    const setProviderModalBusy = (busy) => {
        notemdProviderModalState.loading = busy === true;
        const disabled = notemdProviderModalState.loading;
        [
            providerTemplateSelect,
            providerNameSelect,
            providerBaseUrlInput,
            providerModelInput,
            providerApiKeyInput,
            providerApiVersionInput,
            applyProviderTemplateBtn,
            testProviderBtn,
            saveProviderBtn,
            materializeProviderTemplatesBtn,
        ].forEach((element) => {
            if (element) {
                element.disabled = disabled;
            }
        });
    };

    const ensureRuntimeBridgeReady = async () => {
        if (
            window.NoteConnectionRuntime
            && typeof window.NoteConnectionRuntime.whenReady === 'function'
        ) {
            await window.NoteConnectionRuntime.whenReady();
        }
    };

    const refreshRuntimeBridgeFromTauri = async () => {
        if (
            !window.NoteConnectionRuntime
            || typeof window.NoteConnectionRuntime.refreshFromTauri !== 'function'
        ) {
            return false;
        }
        try {
            await window.NoteConnectionRuntime.refreshFromTauri();
            return true;
        } catch (error) {
            console.warn('[Settings] Runtime bridge refresh failed before retrying agent settings request.', error);
            return false;
        }
    };

    const fetchRuntimeJsonOnce = async (resourcePath, init) => {
        await ensureRuntimeBridgeReady();
        const response = await fetch(buildRuntimeUrl(resourcePath), buildRuntimeFetchOptions(init));
        const payload = await response.json().catch(() => null);
        return { response, payload };
    };

    const isSuccessfulRuntimeJsonResponse = ({ response, payload }) => (
        response.ok && payload && payload.success === true
    );

    const buildRuntimeJsonError = (resourcePath, { response, payload }) => {
        const message = payload && payload.error
            ? String(payload.error)
            : `Request failed (${resourcePath} ${response.status})`;
        return new Error(message);
    };

    const requestRuntimeJson = async (resourcePath, init = {}) => {
        const firstAttempt = await fetchRuntimeJsonOnce(resourcePath, init);
        if (isSuccessfulRuntimeJsonResponse(firstAttempt)) {
            return firstAttempt.payload;
        }

        if (firstAttempt.response.status === 401 && await refreshRuntimeBridgeFromTauri()) {
            const secondAttempt = await fetchRuntimeJsonOnce(resourcePath, init);
            if (isSuccessfulRuntimeJsonResponse(secondAttempt)) {
                return secondAttempt.payload;
            }
            throw buildRuntimeJsonError(resourcePath, secondAttempt);
        }

        throw buildRuntimeJsonError(resourcePath, firstAttempt);
    };

    const isAnySettingsPanelOpen = () => activeSettingsPage !== null;

    const resumeSimulationIfAllowed = () => {
        const isFrozen = document.getElementById('freeze-layout')
            ? document.getElementById('freeze-layout').checked
            : false;
        if (!isFrozen) {
            simulation.alpha(0.3).restart();
        }
    };

    const showMainSettingsPage = () => {
        if (modal) {
            modal.style.display = 'flex';
            const body = modal.querySelector('.settings-modal-body');
            if (body) {
                body.scrollTop = 0;
            }
        }
        if (agentModal) {
            agentModal.style.display = 'none';
        }
        activeSettingsPage = 'main';
        simulation.stop();
    };

    const showAgentSettingsPage = async () => {
        if (modal) {
            modal.style.display = 'none';
        }
        if (agentModal) {
            agentModal.style.display = 'flex';
            const body = agentModal.querySelector('.settings-modal-body');
            if (body) {
                body.scrollTop = 0;
            }
        }
        activeSettingsPage = 'agent';
        simulation.stop();
        await loadNotemdProviderModalState();
    };

    const closeAllSettingsPages = () => {
        clearProviderAutosaveTimer();
        const nextFingerprint = getCurrentProviderFingerprint();
        if (
            activeSettingsPage === 'agent'
            && nextFingerprint
            && nextFingerprint !== notemdProviderModalState.lastSavedFingerprint
            && !notemdProviderModalState.loading
        ) {
            void saveNotemdProviderModalState({ auto: true }).catch((error) => {
                setProviderModalStatus(
                    t('notemd_provider_autosave_failed', 'Auto-save failed: {error}', {
                        error: error && error.message ? error.message : String(error),
                    }),
                    'error'
                );
            });
        }
        if (modal) {
            modal.style.display = 'none';
        }
        if (agentModal) {
            agentModal.style.display = 'none';
        }
        activeSettingsPage = null;
        resumeSimulationIfAllowed();
    };

    const getCurrentProviderFromModalState = () => {
        if (!notemdProviderModalState.settings || !providerNameSelect) {
            return null;
        }
        const providerName = String(providerNameSelect.value || '').trim();
        return notemdProviderModalState.settings.providers.find((provider) => provider.name === providerName) || null;
    };

    const getCurrentProviderFingerprint = () => {
        const providerName = String(providerNameSelect ? providerNameSelect.value : '').trim();
        if (!providerName) {
            return '';
        }
        return JSON.stringify({
            providerName,
            templateId: String(providerTemplateSelect ? providerTemplateSelect.value : '').trim(),
            baseUrl: String(providerBaseUrlInput ? providerBaseUrlInput.value : '').trim(),
            model: String(providerModelInput ? providerModelInput.value : '').trim(),
            apiKey: String(providerApiKeyInput ? providerApiKeyInput.value : ''),
            apiVersion: String(providerApiVersionInput ? providerApiVersionInput.value : '').trim(),
        });
    };

    const buildCurrentProviderRequestPayload = () => {
        const providerName = String(providerNameSelect ? providerNameSelect.value : '').trim();
        const persistedProvider = getCurrentProviderFromModalState();
        return {
            provider: {
                name: providerName,
                baseUrl: String(providerBaseUrlInput ? providerBaseUrlInput.value : '').trim(),
                model: String(providerModelInput ? providerModelInput.value : '').trim(),
                apiKey: String(providerApiKeyInput ? providerApiKeyInput.value : ''),
                apiVersion: String(providerApiVersionInput ? providerApiVersionInput.value : '').trim(),
                temperature: Number.isFinite(Number(persistedProvider && persistedProvider.temperature))
                    ? Number(persistedProvider.temperature)
                    : 0.5,
            },
            providerName,
        };
    };

    const syncCurrentProviderDraft = () => {
        const providerName = String(providerNameSelect ? providerNameSelect.value : '').trim();
        if (!providerName || notemdProviderModalState.applyingDraft) {
            return;
        }
        updateProviderDraft(providerName, {
            templateId: String(providerTemplateSelect ? providerTemplateSelect.value : '').trim(),
            baseUrl: String(providerBaseUrlInput ? providerBaseUrlInput.value : '').trim(),
            model: String(providerModelInput ? providerModelInput.value : '').trim(),
            apiKey: String(providerApiKeyInput ? providerApiKeyInput.value : ''),
            apiVersion: String(providerApiVersionInput ? providerApiVersionInput.value : '').trim(),
        });
    };

    const findTemplateForProvider = (providerName) => {
        const templates = Array.isArray(notemdProviderModalState.templates) ? notemdProviderModalState.templates : [];
        return templates.find((template) => template.providerName === providerName) || null;
    };

    const updateProviderApiVersionVisibility = (provider) => {
        if (!providerApiVersionRow) {
            return;
        }
        const isAzure = provider && String(provider.name || '').trim() === 'Azure OpenAI';
        providerApiVersionRow.style.display = isAzure ? '' : 'none';
        if (providerApiVersionInput) {
            providerApiVersionInput.placeholder = isAzure ? '2025-01-01-preview' : '';
        }
        if (providerApiVersionHint) {
            providerApiVersionHint.textContent = isAzure
                ? t('notemd_provider_api_version_required', 'Required for Azure OpenAI. Example: 2025-01-01-preview.')
                : t('notemd_provider_api_version_optional', 'Optional. Leave blank for standard OpenAI-compatible endpoints. This is mainly used by Azure OpenAI.');
        }
    };

    const applyProviderDraftToFields = (providerName) => {
        const draft = getProviderDraft(providerName);
        if (!draft) {
            return;
        }
        notemdProviderModalState.applyingDraft = true;
        try {
            if (providerTemplateSelect && typeof draft.templateId === 'string' && draft.templateId) {
                providerTemplateSelect.value = draft.templateId;
                renderProviderTemplateHint();
            }
            if (providerBaseUrlInput && typeof draft.baseUrl === 'string') {
                providerBaseUrlInput.value = draft.baseUrl;
            }
            if (providerModelInput && typeof draft.model === 'string') {
                providerModelInput.value = draft.model;
            }
            if (providerApiKeyInput && typeof draft.apiKey === 'string') {
                providerApiKeyInput.value = draft.apiKey;
            }
            if (providerApiVersionInput && typeof draft.apiVersion === 'string') {
                providerApiVersionInput.value = draft.apiVersion;
            }
        } finally {
            notemdProviderModalState.applyingDraft = false;
        }
    };

    const renderProviderTemplateHint = () => {
        if (!providerTemplateHint) {
            return;
        }
        const templateId = providerTemplateSelect ? String(providerTemplateSelect.value || '').trim() : '';
        const templates = Array.isArray(notemdProviderModalState.templates) ? notemdProviderModalState.templates : [];
        const template = templates.find((item) => item.id === templateId) || null;
        if (!template) {
            providerTemplateHint.textContent = '';
            return;
        }
        const noteSummary = Array.isArray(template.notes) ? template.notes.slice(0, 2).join(' ') : '';
        providerTemplateHint.textContent = `${template.label} · ${template.category} · ${template.transport}. ${template.recommendedFor} ${template.hostHint} ${noteSummary}`.trim();
    };

    const renderSelectedProviderFields = () => {
        const provider = getCurrentProviderFromModalState();
        if (!provider) {
            if (providerBaseUrlInput) providerBaseUrlInput.value = '';
            if (providerModelInput) providerModelInput.value = '';
            if (providerApiKeyInput) providerApiKeyInput.value = '';
            if (providerApiVersionInput) providerApiVersionInput.value = '';
            updateProviderApiVersionVisibility(null);
            return;
        }
        if (providerBaseUrlInput) providerBaseUrlInput.value = String(provider.baseUrl || '');
        if (providerModelInput) providerModelInput.value = String(provider.model || '');
        if (providerApiKeyInput) providerApiKeyInput.value = String(provider.apiKey || '');
        if (providerApiVersionInput) providerApiVersionInput.value = String(provider.apiVersion || '');
        updateProviderApiVersionVisibility(provider);

        const matchedTemplate = findTemplateForProvider(provider.name);
        if (providerTemplateSelect && matchedTemplate) {
            providerTemplateSelect.value = matchedTemplate.id;
            renderProviderTemplateHint();
        }
        applyProviderDraftToFields(provider.name);
    };

    const populateProviderTemplateSelect = () => {
        if (!providerTemplateSelect) {
            return;
        }
        providerTemplateSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = t('notemd_provider_template_select', 'Choose a preset template');
        providerTemplateSelect.appendChild(placeholder);
        const templates = Array.isArray(notemdProviderModalState.templates) ? notemdProviderModalState.templates : [];
        templates.forEach((template) => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = `${template.label} (${template.category})`;
            providerTemplateSelect.appendChild(option);
        });
    };

    const populateProviderSelect = () => {
        if (!providerNameSelect) {
            return;
        }
        providerNameSelect.innerHTML = '';
        const settings = notemdProviderModalState.settings;
        const providers = settings && Array.isArray(settings.providers) ? settings.providers : [];
        providers.forEach((provider) => {
            const option = document.createElement('option');
            option.value = provider.name;
            option.textContent = provider.name;
            providerNameSelect.appendChild(option);
        });
        if (settings && settings.activeProvider) {
            providerNameSelect.value = settings.activeProvider;
        }
        renderSelectedProviderFields();
    };

    const loadNotemdProviderModalState = async (options = {}) => {
        if (notemdProviderModalState.loading) {
            return;
        }
        setProviderModalBusy(true);
        setProviderModalStatus(t('notemd_provider_loading', 'Loading provider settings...'));
        try {
            const templatesPayload = await requestRuntimeJson('/api/notemd/provider-templates?persist=1');
            const settingsPayload = await requestRuntimeJson('/api/notemd/settings');
            notemdProviderModalState.templates = Array.isArray(templatesPayload.templates)
                ? cloneJson(templatesPayload.templates)
                : [];
            notemdProviderModalState.configPath = String(templatesPayload.configPath || '');
            notemdProviderModalState.settings = cloneJson(settingsPayload.settings || {});
            populateProviderTemplateSelect();
            populateProviderSelect();
            if (providerConfigPath) {
                providerConfigPath.textContent = notemdProviderModalState.configPath
                    ? `${t('notemd_provider_config_path', 'TOML path')}: ${notemdProviderModalState.configPath}`
                    : '';
            }
            notemdProviderModalState.lastSavedFingerprint = getCurrentProviderFingerprint();
            setProviderModalStatus(
                t('notemd_provider_loaded', 'Provider presets and TOML templates are ready.'),
                'success'
            );
        } catch (error) {
            setProviderModalStatus(
                t('notemd_provider_load_failed', 'Provider settings load failed: {error}', {
                    error: error && error.message ? error.message : String(error),
                }),
                'error'
            );
        } finally {
            setProviderModalBusy(false);
        }
    };

    const saveNotemdProviderModalState = async (options = {}) => {
        if (!notemdProviderModalState.settings || !providerNameSelect) {
            return;
        }
        const auto = options.auto === true;
        const nextSettings = cloneJson(notemdProviderModalState.settings);
        const providerName = String(providerNameSelect.value || '').trim();
        const nextProvider = nextSettings.providers.find((provider) => provider.name === providerName);
        if (!nextProvider) {
            throw new Error(`Unsupported provider: ${providerName}`);
        }
        nextSettings.activeProvider = providerName;
        nextProvider.baseUrl = String(providerBaseUrlInput ? providerBaseUrlInput.value : '').trim();
        nextProvider.model = String(providerModelInput ? providerModelInput.value : '').trim();
        nextProvider.apiKey = String(providerApiKeyInput ? providerApiKeyInput.value : '');
        nextProvider.apiVersion = String(providerApiVersionInput ? providerApiVersionInput.value : '').trim();
        setProviderModalBusy(true);
        setProviderModalStatus(
            auto
                ? t('notemd_provider_autosaving', 'Auto-saving provider settings...')
                : t('notemd_provider_saving', 'Saving provider settings...')
        );
        try {
            const payload = await requestRuntimeJson('/api/notemd/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: nextSettings }),
            });
            notemdProviderModalState.settings = cloneJson(payload.settings || nextSettings);
            populateProviderSelect();
            notemdProviderModalState.lastSavedFingerprint = getCurrentProviderFingerprint();
            removeProviderDraft(providerName);
            setProviderModalStatus(
                auto
                    ? t('notemd_provider_autosaved', 'Provider settings auto-saved.')
                    : t('notemd_provider_saved', 'Provider settings saved to app_config.toml.'),
                'success'
            );
        } finally {
            setProviderModalBusy(false);
        }
    };

    const scheduleProviderAutosave = () => {
        if (notemdProviderModalState.loading || notemdProviderModalState.applyingDraft) {
            return;
        }
        const providerName = String(providerNameSelect ? providerNameSelect.value : '').trim();
        if (!providerName || !notemdProviderModalState.settings) {
            return;
        }
        const nextFingerprint = getCurrentProviderFingerprint();
        if (!nextFingerprint || nextFingerprint === notemdProviderModalState.lastSavedFingerprint) {
            return;
        }
        clearProviderAutosaveTimer();
        notemdProviderModalState.autosaveTimer = setTimeout(() => {
            notemdProviderModalState.autosaveTimer = null;
            void saveNotemdProviderModalState({ auto: true }).catch((error) => {
                setProviderModalStatus(
                    t('notemd_provider_autosave_failed', 'Auto-save failed: {error}', {
                        error: error && error.message ? error.message : String(error),
                    }),
                    'error'
                );
            });
        }, NOTEMD_PROVIDER_AUTOSAVE_DEBOUNCE_MS);
    };

    const applyNotemdProviderTemplate = async () => {
        if (!providerTemplateSelect) {
            return;
        }
        const templateId = String(providerTemplateSelect.value || '').trim();
        if (!templateId) {
            setProviderModalStatus(t('notemd_provider_template_required', 'Choose a preset template first.'), 'error');
            return;
        }
        setProviderModalBusy(true);
        setProviderModalStatus(t('notemd_provider_template_applying', 'Applying provider preset...'));
        try {
            const payload = await requestRuntimeJson('/api/notemd/provider-templates/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId }),
            });
            notemdProviderModalState.settings = cloneJson(payload.settings || {});
            if (payload.configPath) {
                notemdProviderModalState.configPath = String(payload.configPath);
            }
            populateProviderSelect();
            if (providerConfigPath) {
                providerConfigPath.textContent = notemdProviderModalState.configPath
                    ? `${t('notemd_provider_config_path', 'TOML path')}: ${notemdProviderModalState.configPath}`
                    : '';
            }
            notemdProviderModalState.lastSavedFingerprint = getCurrentProviderFingerprint();
            removeProviderDraft(String(providerNameSelect ? providerNameSelect.value : '').trim());
            setProviderModalStatus(
                t('notemd_provider_template_applied', 'Preset applied and saved to app_config.toml.'),
                'success'
            );
        } finally {
            setProviderModalBusy(false);
        }
    };

    const materializeNotemdProviderTemplates = async () => {
        setProviderModalBusy(true);
        setProviderModalStatus(t('notemd_provider_templates_writing', 'Writing TOML provider templates...'));
        try {
            const payload = await requestRuntimeJson('/api/notemd/provider-templates?persist=1');
            notemdProviderModalState.templates = Array.isArray(payload.templates)
                ? cloneJson(payload.templates)
                : [];
            notemdProviderModalState.configPath = String(payload.configPath || notemdProviderModalState.configPath || '');
            populateProviderTemplateSelect();
            renderProviderTemplateHint();
            if (providerConfigPath) {
                providerConfigPath.textContent = notemdProviderModalState.configPath
                    ? `${t('notemd_provider_config_path', 'TOML path')}: ${notemdProviderModalState.configPath}`
                    : '';
            }
            setProviderModalStatus(
                payload.persisted
                    ? t('notemd_provider_templates_written', 'Provider templates were written to app_config.toml.')
                    : t('notemd_provider_templates_present', 'Provider templates are already present in app_config.toml.'),
                'success'
            );
        } finally {
            setProviderModalBusy(false);
        }
    };

    const testNotemdProviderConnection = async () => {
        const payload = buildCurrentProviderRequestPayload();
        if (!payload.providerName) {
            throw new Error('Provider name is required.');
        }

        setProviderModalBusy(true);
        setProviderModalStatus(
            t('btn_test_provider_connection', 'Test Connection') + '...',
            'muted'
        );
        try {
            const response = await requestRuntimeJson('/api/notemd/test-llm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = response.result || {};
            setProviderModalStatus(
                String(result.message || `Connected to ${payload.providerName}.`),
                result.success === false ? 'error' : 'success'
            );
        } finally {
            setProviderModalBusy(false);
        }
    };

    // Load initial values
    const updateUIFromSettings = (settings) => {
        const mode = document.querySelector('input[name="layoutMode"]:checked') ? document.querySelector('input[name="layoutMode"]:checked').value : 'force';
        const chargeVal = mode === 'dag' ? settings.physics.repulsionDAG : settings.physics.repulsionForce;
        
        // Update Label
        const repLabel = document.querySelector('label[for="set-charge"]');
        if (repLabel) {
            repLabel.innerText = mode === 'dag' ? "Repulsion (DAG)" : "Repulsion (Force)";
            const lang = document.getElementById('set-language') ? document.getElementById('set-language').value : 'en';
            if (lang === 'zh') {
                 repLabel.innerText = mode === 'dag' ? "排斥力 (DAG)" : "排斥力 (力导向)";
            }
        }

        inputs.charge.value = chargeVal;
        displays.charge.innerText = chargeVal;

        inputs.distance.value = settings.physics.linkDistance;
        displays.distance.innerText = settings.physics.linkDistance;

        inputs.collision.value = settings.physics.collisionRadius;
        displays.collision.innerText = settings.physics.collisionRadius;

        inputs.opacity.value = settings.visuals.edgeOpacity;
        displays.opacity.innerText = settings.visuals.edgeOpacity;
        
        if (settings.reading && settings.reading.mode) {
            inputReadingMode.value = settings.reading.mode;
        }

        // Performance
        if (settings.performance) {
            if (settings.performance.maxWorkers) {
                const num = settings.performance.maxWorkers;
                if (workersSlider) workersSlider.value = num;
                if (workersInput) workersInput.value = num;
            }
            if (settings.performance.enableGPU !== undefined) {
                if (gpuCheckbox) gpuCheckbox.checked = settings.performance.enableGPU;
            }
            if (settings.performance.staticMode !== undefined) {
                if (staticModeCheckbox) staticModeCheckbox.checked = settings.performance.staticMode;
            }
            if (settings.performance.gpuRendering !== undefined) {
                if (gpuRenderingCheckbox) gpuRenderingCheckbox.checked = settings.performance.gpuRendering;
            }
            if (settings.performance.memorySavingMode !== undefined) {
                if (memorySavingCheckbox) memorySavingCheckbox.checked = settings.performance.memorySavingMode;
            }
            if (settings.performance.compactMode !== undefined) {
                if (compactModeCheckbox) compactModeCheckbox.checked = settings.performance.compactMode;
            }
            if (settings.performance.deepDebug !== undefined) {
                if (deepDebugCheckbox) deepDebugCheckbox.checked = settings.performance.deepDebug;
            }
        }
    };

    updateUIFromSettings(settingsManager.settings);

    // Event Listeners for Inputs
    inputs.charge.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        const mode = document.querySelector('input[name="layoutMode"]:checked') ? document.querySelector('input[name="layoutMode"]:checked').value : 'force';
        const key = mode === 'dag' ? 'repulsionDAG' : 'repulsionForce';
        settingsManager.set('physics', key, val);
        displays.charge.innerText = val;
    });

    inputs.distance.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        settingsManager.set('physics', 'linkDistance', val);
        displays.distance.innerText = val;
    });

    inputs.collision.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        settingsManager.set('physics', 'collisionRadius', val);
        displays.collision.innerText = val;
    });

    inputs.opacity.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        settingsManager.set('visuals', 'edgeOpacity', val);
        displays.opacity.innerText = val;
    });
    
    // Performance Listeners
    if (workersSlider && workersInput) {
        workersSlider.addEventListener('input', (e) => {
            workersInput.value = e.target.value;
            settingsManager.set('performance', 'maxWorkers', parseInt(e.target.value));
        });
        workersInput.addEventListener('input', (e) => {
            workersSlider.value = e.target.value;
            settingsManager.set('performance', 'maxWorkers', parseInt(e.target.value));
        });
    }
    
    if (gpuCheckbox) {
        gpuCheckbox.addEventListener('change', (e) => {
            settingsManager.set('performance', 'enableGPU', e.target.checked);
        });
    }

    if (staticModeCheckbox) {
        staticModeCheckbox.addEventListener('change', (e) => {
            settingsManager.set('performance', 'staticMode', e.target.checked);
        });
    }

    if (gpuRenderingCheckbox) {
        gpuRenderingCheckbox.addEventListener('change', (e) => {
            settingsManager.set('performance', 'gpuRendering', e.target.checked);
            // Apply GPU Force immediately
            applyPhysics(settingsManager.settings);
        });
    }

    if (memorySavingCheckbox) {
        memorySavingCheckbox.addEventListener('change', (e) => {
            settingsManager.set('performance', 'memorySavingMode', e.target.checked);
        });
    }

    if (compactModeCheckbox) {
        compactModeCheckbox.addEventListener('change', (e) => {
            settingsManager.set('performance', 'compactMode', e.target.checked);
            // Force redraw immediately to show/hide edges
            if (typeof ticked === 'function') ticked();
        });
    }

    if (deepDebugCheckbox) {
        deepDebugCheckbox.addEventListener('change', (e) => {
            settingsManager.set('performance', 'deepDebug', e.target.checked);
        });
    }
    
    // Inbound Count (Degree Mode)
    const inputDegreeMode = document.getElementById('set-degree-mode');
    if (inputDegreeMode) {
        // Init value
        const currentMode = settingsManager.get('visuals', 'degreeMode') || 'visible';
        inputDegreeMode.value = currentMode;
        
        // Listener
        inputDegreeMode.addEventListener('change', (e) => {
            settingsManager.set('visuals', 'degreeMode', e.target.value);
        });
    }
    
    inputReadingMode.addEventListener('change', (e) => {
        settingsManager.set('reading', 'mode', e.target.value);
    });

    if (providerTemplateSelect) {
        providerTemplateSelect.addEventListener('change', () => {
            renderProviderTemplateHint();
            syncCurrentProviderDraft();
            scheduleProviderAutosave();
        });
    }

    if (providerNameSelect) {
        providerNameSelect.addEventListener('change', () => {
            renderSelectedProviderFields();
            syncCurrentProviderDraft();
            scheduleProviderAutosave();
        });
    }

    [
        providerBaseUrlInput,
        providerModelInput,
        providerApiKeyInput,
        providerApiVersionInput,
    ].forEach((input) => {
        if (!input) {
            return;
        }
        input.addEventListener('input', () => {
            syncCurrentProviderDraft();
            scheduleProviderAutosave();
        });
        input.addEventListener('change', () => {
            syncCurrentProviderDraft();
            scheduleProviderAutosave();
        });
    });

    if (applyProviderTemplateBtn) {
        applyProviderTemplateBtn.addEventListener('click', () => {
            void applyNotemdProviderTemplate().catch((error) => {
                setProviderModalStatus(
                    t('notemd_provider_template_apply_failed', 'Provider preset apply failed: {error}', {
                        error: error && error.message ? error.message : String(error),
                    }),
                    'error'
                );
            });
        });
    }

    if (testProviderBtn) {
        testProviderBtn.addEventListener('click', () => {
            void testNotemdProviderConnection().catch((error) => {
                setProviderModalStatus(
                    error && error.message ? error.message : String(error),
                    'error'
                );
            });
        });
    }

    if (saveProviderBtn) {
        saveProviderBtn.addEventListener('click', () => {
            void saveNotemdProviderModalState().catch((error) => {
                setProviderModalStatus(
                    t('notemd_provider_save_failed', 'Provider save failed: {error}', {
                        error: error && error.message ? error.message : String(error),
                    }),
                    'error'
                );
            });
        });
    }

    if (materializeProviderTemplatesBtn) {
        materializeProviderTemplatesBtn.addEventListener('click', () => {
            void materializeNotemdProviderTemplates().catch((error) => {
                setProviderModalStatus(
                    t('notemd_provider_templates_write_failed', 'Template write failed: {error}', {
                        error: error && error.message ? error.message : String(error),
                    }),
                    'error'
                );
            });
        });
    }

    // Modal Actions
    openBtn.addEventListener('click', () => {
        updateUIFromSettings(settingsManager.settings);
        showMainSettingsPage();
    });

    if (openAgentSettingsBtn) {
        openAgentSettingsBtn.addEventListener('click', () => {
            void showAgentSettingsPage().catch((error) => {
                console.warn('[Settings] Failed to open agent settings.', error);
            });
        });
    }

    if (agentSettingsBackBtn) {
        agentSettingsBackBtn.addEventListener('click', showMainSettingsPage);
    }

    if (agentSettingsBackFooterBtn) {
        agentSettingsBackFooterBtn.addEventListener('click', showMainSettingsPage);
    }

    mainCloseBtns.forEach((btn) => btn.addEventListener('click', closeAllSettingsPages));
    agentCloseBtns.forEach((btn) => btn.addEventListener('click', closeAllSettingsPages));

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAllSettingsPages();
            }
        });
    }

    if (agentModal) {
        agentModal.addEventListener('click', (e) => {
            if (e.target === agentModal) {
                closeAllSettingsPages();
            }
        });
    }

    resetBtn.addEventListener('click', () => {
        settingsManager.reset();
        updateUIFromSettings(settingsManager.settings);
    });

    // Subscribe to changes
    settingsManager.subscribe((settings) => {
        // Apply Physics
        if (!focusNode) { 
            applyPhysics(settings);
            
            // v0.9.40: Check Freeze Layout State before restarting
            const globalFreeze = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
            const isFrozen = globalFreeze || isAnySettingsPanelOpen();
            
            if (!isFrozen) {
                simulation.alpha(0.3).restart();
            }
        }

        // Apply Visuals
        g.selectAll(".link").style("stroke-opacity", settings.visuals.edgeOpacity);
    });
}

// Helper to apply physics (Worker Proxy)
function applyPhysics(settings) {
    // We Map settings to Worker params
    // GPU mode is currently ignored in Worker implementation (CPU fallback), 
    // but we respect the parameters.

    const mode = document.querySelector('input[name="layoutMode"]:checked') ? document.querySelector('input[name="layoutMode"]:checked').value : 'force';
    const chargeVal = mode === 'dag' ? settings.physics.repulsionDAG : settings.physics.repulsionForce;
    
    simulationWorker.postMessage({
        type: 'updateParams',
        payload: {
            repulsion: chargeVal,
            distance: settings.physics.linkDistance,
            collision: settings.physics.collisionRadius,
            // We can send other params if needed
        }
    });

    // Handle GPU Visual Feedback (Visuals only, not physics)
    // If user expects GPU physics, we might want a toast saying "Using Parallel CPU Physics"
}

// Initialize Settings
if (window.settingsManager) {
    initSettingsUI();
    // Apply initial settings immediately
    const s = settingsManager.settings;
    applyPhysics(s);
    g.selectAll(".link").style("stroke-opacity", s.visuals.edgeOpacity);
}

// --- Quick Actions Logic (v0.9.26) ---

// 1. Freeze Layout Quick Button
const btnQuickFreeze = document.getElementById('btn-quick-freeze');
const checkboxFreeze = document.getElementById('freeze-layout');

if (btnQuickFreeze && checkboxFreeze) {
    btnQuickFreeze.addEventListener('click', () => {
        // Toggle Checkbox
        checkboxFreeze.checked = !checkboxFreeze.checked;
        
        // Trigger Change Event for Simulation Logic
        const event = new Event('change');
        checkboxFreeze.dispatchEvent(event);
        
        // Update Button Visuals
        updateFreezeButtonState();
    });
    
    // Sync Button with Checkbox (in case checkbox is clicked directly)
    checkboxFreeze.addEventListener('change', updateFreezeButtonState);
    
    function updateFreezeButtonState() {
        if (checkboxFreeze.checked) {
            btnQuickFreeze.classList.add('active');
            // Optional: Change icon?
        } else {
            btnQuickFreeze.classList.remove('active');
        }
    }
}

// 2. Quick Start Manual
const btnHelp = document.getElementById('btn-help');
const manualModal = document.getElementById('manual-modal');
const checkboxDontShow = document.getElementById('dont-show-manual');

// Quick Start Guide is now managed by tutorial.js
// Auto-display removed - shows only when tutorial reaches quickStart step or user skips
// window.addEventListener('load', () => {
//     const seen = localStorage.getItem('nc_manual_seen');
//     if (!seen && manualModal) {
//         manualModal.style.display = 'flex';
//     }
// });

if (btnHelp && manualModal) {
    btnHelp.addEventListener('click', () => {
        manualModal.style.display = 'flex';
    });
    
    // Close Logic (using shared .modal-close class)
    const manualCloseBtns = manualModal.querySelectorAll('.modal-close');
    manualCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            manualModal.style.display = 'none';
            handleManualClose();
        });
    });
    
    manualModal.addEventListener('click', (e) => {
        if (e.target === manualModal) {
            manualModal.style.display = 'none';
            handleManualClose();
        }
    });
    
    function handleManualClose() {
        if (checkboxDontShow && checkboxDontShow.checked) {
            localStorage.setItem('nc_manual_seen', 'true');
        }
    }
}

// 3. Controls Toggle (v1.0.1)
const btnToggleControls = document.getElementById('btn-toggle-controls');
const controlsPanelToggleTarget = document.getElementById('controls');

// Toggle Controls Logic
if (controlsPanelToggleTarget) {
    const controlsPanel = document.getElementById('controls');
    
    const toggleControls = (e) => {
        // Prevent event bubbling issues
        e.stopPropagation();
        
        controlsPanel.classList.toggle('collapsed');
        
        // Update icon/pattern based on state
        const isCollapsed = controlsPanel.classList.contains('collapsed');
        // Use a specific class or check to change content if needed
        // Currently done via CSS rotation
        
        // Save state preference if needed (optional)
    };

    // The toggle button itself
    if (btnToggleControls) {
        btnToggleControls.addEventListener('click', toggleControls);
    }
    
    // Also allow clicking the main panel ONLY when collapsed
    controlsPanel.addEventListener('click', (e) => {
        if (controlsPanel.classList.contains('collapsed')) {
            toggleControls(e);
        }
    });
}

// Path Mode Integration (v1.1.0)
const btnNotemd = document.getElementById('btn-notemd');
const notemdOverlay = document.getElementById('notemd-embed-overlay');
const notemdCloseButton = document.getElementById('btn-notemd-embed-close');
const notemdIframe = document.getElementById('notemd-embed-frame');
const NOTEMD_EMBED_RPC_REQUEST = 'noteconnection:notemd-rpc-request';
const NOTEMD_EMBED_RPC_RESPONSE = 'noteconnection:notemd-rpc-response';
const NOTEMD_EMBED_REFRESH = 'noteconnection:notemd-refresh';
const NOTEMD_EMBED_ALLOWED_COMMANDS = new Set([
    'pick_notemd_file',
    'save_notemd_file',
    'pick_notemd_folder'
]);
let notemdRefreshNonce = 0;

function isNotemdIframeSource(source) {
    return !!(notemdIframe && notemdIframe.contentWindow && source === notemdIframe.contentWindow);
}

function resolveNotemdRpcTargetWindow(source) {
    if (isNotemdIframeSource(source)) {
        return source;
    }
    if (notemdIframe && notemdIframe.contentWindow) {
        return notemdIframe.contentWindow;
    }
    return null;
}

function getTauriCoreInvoke() {
    if (
        window.__TAURI__ &&
        window.__TAURI__.core &&
        typeof window.__TAURI__.core.invoke === 'function'
    ) {
        return window.__TAURI__.core.invoke;
    }
    return null;
}

function getTauriDialogApi() {
    if (window.__TAURI__ && window.__TAURI__.dialog && typeof window.__TAURI__.dialog.open === 'function') {
        return window.__TAURI__.dialog;
    }
    const invoke = getTauriCoreInvoke();
    if (invoke) {
        return {
            open(options) {
                return invoke('plugin:dialog|open', { options: options || {} });
            },
            save(options) {
                return invoke('plugin:dialog|save', { options: options || {} });
            }
        };
    }
    return null;
}

function normalizePathModeRuntimeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizePathModeLanguage(value) {
    const raw = normalizePathModeRuntimeText(value).toLowerCase();
    return raw.startsWith('zh') ? 'zh' : 'en';
}

function resolvePathModeRuntimeTarget(targetId) {
    const normalizedTargetId = normalizePathModeRuntimeText(targetId);
    if (!normalizedTargetId) {
        return null;
    }
    const node = resolveGraphViewNodeByIdOrLabel(normalizedTargetId);
    if (!node) {
        return {
            id: normalizedTargetId,
            label: normalizedTargetId,
            resolved: false,
        };
    }
    return {
        id: node.id,
        label: getGraphViewNodeLabel(node) || node.id,
        resolved: true,
    };
}

function buildGodotFuturePathRuntimeConfig(targetId, options = {}) {
    const runtimeTarget = resolvePathModeRuntimeTarget(targetId);
    if (!runtimeTarget || !runtimeTarget.id) {
        return null;
    }
    const existingConfig = options.config && typeof options.config === 'object'
        ? options.config
        : {};
    const targetIds = [];
    const seen = new Set();
    const appendTargetId = function(value) {
        const normalized = normalizePathModeRuntimeText(value);
        if (!normalized || seen.has(normalized)) {
            return;
        }
        seen.add(normalized);
        targetIds.push(normalized);
    };
    appendTargetId(runtimeTarget.id);
    if (Array.isArray(existingConfig.targetIds)) {
        existingConfig.targetIds.forEach(appendTargetId);
    }
    return {
        ...existingConfig,
        mode: 'diffusion',
        strategy: 'core',
        layout: 'orbital',
        targetId: runtimeTarget.id,
        target_id: runtimeTarget.id,
        targetIds,
        focus_mode: true,
        language: normalizePathModeLanguage(
            existingConfig.language
            || window.i18n && window.i18n.currentLanguage
            || document.documentElement && document.documentElement.lang
            || 'en'
        ),
    };
}

async function openGodotFuturePathById(targetId, options = {}) {
    const config = buildGodotFuturePathRuntimeConfig(targetId, options);
    if (!config) {
        throw new Error('Missing Godot Future Path target node.');
    }
    window.__NC_LAST_GODOT_FUTURE_PATH_REQUEST = { ...config };

    const pathApp = window.pathApp;
    if (pathApp && typeof pathApp === 'object') {
        if (!window.__NC_AGENT_GODOT_FUTURE_PATH_INITIALIZED && typeof pathApp.init === 'function') {
            pathApp.init(config.targetId);
            window.__NC_AGENT_GODOT_FUTURE_PATH_INITIALIZED = true;
        }
        if (pathApp.runtimeConfig && typeof pathApp.runtimeConfig === 'object') {
            pathApp.runtimeConfig.mode = 'diffusion';
            pathApp.runtimeConfig.strategy = 'core';
            pathApp.runtimeConfig.layout = 'orbital';
            pathApp.runtimeConfig.targetId = config.targetId;
            pathApp.runtimeConfig.targetIds = config.targetIds.slice();
        }
        pathApp.currentTargetId = config.targetId;
        pathApp.currentTargetIds = config.targetIds.slice();
        pathApp.centralNodeId = config.targetId;
        if (typeof pathApp.applyRemoteConfigure === 'function') {
            pathApp.applyRemoteConfigure(config);
        }
        if (typeof pathApp._sendBridgeMessage === 'function') {
            pathApp._sendBridgeMessage('configure', config);
        }
        if (typeof pathApp.triggerUpdate === 'function') {
            pathApp.triggerUpdate();
        }
        if (typeof pathApp.requestBridgeWindowVisibility === 'function') {
            const bridgeReady = await pathApp.requestBridgeWindowVisibility(true, {
                waitMs: 1800,
                reason: options.source || 'open-godot-future-path',
            });
            if (bridgeReady && typeof pathApp._sendBridgeMessage === 'function') {
                pathApp._sendBridgeMessage('configure', config);
            }
        }
    }

    const invoke = getTauriCoreInvoke();
    if (invoke) {
        const caps = window.__NC_RUNTIME_CAPS || {};
        if (caps.platform === 'android' && caps.supports_native_pathmode === true) {
            await invoke('open_native_pathmode', {
                request: {
                    mode: 'diffusion',
                    strategy: 'core',
                    targetId: config.targetId,
                },
            });
        } else {
            await invoke('toggle_pathmode_window', { showGodot: true });
        }
    }

    return {
        opened: true,
        targetId: config.targetId,
        targetIds: config.targetIds.slice(),
        strategy: config.strategy,
        mode: config.mode,
    };
}

window.NoteConnectionPathMode = {
    ...(window.NoteConnectionPathMode && typeof window.NoteConnectionPathMode === 'object'
        ? window.NoteConnectionPathMode
        : {}),
    buildGodotFuturePathRuntimeConfig,
    openGodotFuturePathById,
};

function normalizeNotemdPickerPayload(payload) {
    const safePayload = payload && typeof payload === 'object' ? { ...payload } : {};
    const initialPath = typeof safePayload.initialPath === 'string'
        ? safePayload.initialPath
        : (typeof safePayload.initial_path === 'string' ? safePayload.initial_path : null);
    if (typeof initialPath === 'string') {
        safePayload.initialPath = initialPath;
        safePayload.initial_path = initialPath;
    }
    return safePayload;
}

function normalizeDialogSelection(selection) {
    if (typeof selection === 'string') {
        return selection;
    }
    if (Array.isArray(selection) && selection.length > 0 && typeof selection[0] === 'string') {
        return selection[0];
    }
    return null;
}

async function invokeNotemdPickerFromHost(command, payload) {
    const safePayload = normalizeNotemdPickerPayload(payload);
    const invoke = getTauriCoreInvoke();
    if (!invoke) {
        throw new Error('Tauri host invoke API is unavailable.');
    }
    try {
        return await invoke(command, safePayload);
    } catch (err) {
        console.warn(`[NoteMD] Rust command path failed for '${command}', trying dialog fallback:`, err);
    }

    const dialog = getTauriDialogApi();
    const initialPath = typeof safePayload.initialPath === 'string' ? safePayload.initialPath : null;
    if (!dialog) {
        throw new Error('Tauri dialog API is unavailable and Rust command fallback failed.');
    }

    const defaultPath = initialPath && initialPath.trim() ? initialPath.trim() : undefined;
    const markdownFilters = [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }];

    if (command === 'pick_notemd_file') {
        const selection = await dialog.open({
            multiple: false,
            directory: false,
            defaultPath,
            filters: markdownFilters
        });
        return normalizeDialogSelection(selection);
    }

    if (command === 'save_notemd_file') {
        if (typeof dialog.save === 'function') {
            const selection = await dialog.save({
                defaultPath,
                filters: markdownFilters
            });
            return normalizeDialogSelection(selection);
        }
        throw new Error('Tauri dialog.save API is unavailable.');
    }

    if (command === 'pick_notemd_folder') {
        const selection = await dialog.open({
            multiple: false,
            directory: true,
            defaultPath
        });
        return normalizeDialogSelection(selection);
    }

    throw new Error(`Unsupported NoteMD picker command '${command}'.`);
}

window.NoteConnectionHostInvoke = async function(command, payload) {
    if (NOTEMD_EMBED_ALLOWED_COMMANDS.has(command)) {
        console.log(`[NoteMD] Host picker invoke requested: ${command}`);
        return invokeNotemdPickerFromHost(command, payload || {});
    }

    const invoke = getTauriCoreInvoke();
    if (!invoke) {
        throw new Error('Tauri host invoke API is unavailable.');
    }
    return invoke(command, payload || {});
};

function ensureNotemdIframeLoaded() {
    if (!notemdIframe) return;
    if (notemdIframe.getAttribute('src') !== 'notemd.html') {
        notemdIframe.setAttribute('src', 'notemd.html');
    }
}

function notifyNotemdIframeRefresh(context = {}) {
    if (!notemdIframe || !notemdIframe.contentWindow || typeof notemdIframe.contentWindow.postMessage !== 'function') {
        return false;
    }
    const safeContext = context && typeof context === 'object' ? context : {};
    try {
        notemdIframe.contentWindow.postMessage({
            type: NOTEMD_EMBED_REFRESH,
            requestId: `notemd-refresh-${Date.now()}-${++notemdRefreshNonce}`,
            context: safeContext
        }, '*');
        return true;
    } catch (error) {
        console.warn('[NoteMD] Failed to send refresh signal to embedded iframe:', error);
        return false;
    }
}

function showEmbeddedNoteMD(context = {}) {
    const shouldWaitForLoad = !notemdIframe || notemdIframe.getAttribute('src') !== 'notemd.html';
    ensureNotemdIframeLoaded();
    if (notemdOverlay) {
        notemdOverlay.style.display = 'flex';
    }
    const refreshContext = context && typeof context === 'object' ? context : {};
    if (shouldWaitForLoad && notemdIframe) {
        notemdIframe.addEventListener('load', () => {
            notifyNotemdIframeRefresh({
                ...refreshContext,
                source: refreshContext.source || 'iframe-load'
            });
        }, { once: true });
    } else {
        notifyNotemdIframeRefresh(refreshContext);
    }
    console.log('[NoteMD] Embedded workspace opened:', context.source || 'unknown');
}

function hideEmbeddedNoteMD() {
    if (notemdOverlay) {
        notemdOverlay.style.display = 'none';
    }
}

window.NoteConnectionEmbeddedNoteMD = {
    open: showEmbeddedNoteMD,
    close: hideEmbeddedNoteMD
};

window.addEventListener('message', async (event) => {
    const data = event && event.data;
    if (!data || data.type !== NOTEMD_EMBED_RPC_REQUEST) {
        return;
    }
    if (!data || typeof data !== 'object') {
        return;
    }

    const requestId = typeof data.requestId === 'string' ? data.requestId : '';
    const command = typeof data.command === 'string' ? data.command : '';
    if (!requestId || !command) {
        return;
    }
    if (!NOTEMD_EMBED_ALLOWED_COMMANDS.has(command)) {
        return;
    }

    console.log(`[NoteMD] RPC request received from iframe: ${command}`);

    let result = null;
    let error = null;

    try {
        result = await window.NoteConnectionHostInvoke(command, data.payload || {});
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    }

    const targetWindow = resolveNotemdRpcTargetWindow(event.source);
    try {
        if (targetWindow && typeof targetWindow.postMessage === 'function') {
            targetWindow.postMessage({
                type: NOTEMD_EMBED_RPC_RESPONSE,
                requestId,
                result,
                error
            }, '*');
        } else {
            console.warn('[NoteMD] Unable to resolve iframe target window for RPC response.');
        }
    } catch (err) {
        console.warn('[NoteMD] Failed to send RPC response back to iframe:', err);
    }
});

if (notemdCloseButton) {
    notemdCloseButton.addEventListener('click', () => {
        hideEmbeddedNoteMD();
    });
}

if (notemdOverlay) {
    notemdOverlay.addEventListener('click', (event) => {
        if (event.target === notemdOverlay) {
            hideEmbeddedNoteMD();
        }
    });
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && notemdOverlay && notemdOverlay.style.display !== 'none') {
        hideEmbeddedNoteMD();
    }
});

if (
    window.__TAURI__ &&
    window.__TAURI__.event &&
    typeof window.__TAURI__.event.listen === 'function'
) {
    window.__TAURI__.event.listen('notemd-open-request', () => {
        showEmbeddedNoteMD({ source: 'tauri-event' });
    });
    window.__TAURI__.event.listen('app-language-updated', async (event) => {
        const language = event && event.payload && typeof event.payload.language === 'string'
            ? event.payload.language
            : '';
        if (!language || !window.i18n || typeof window.i18n.setLanguage !== 'function') {
            return;
        }
        if (window.i18n.currentLanguage === language) {
            return;
        }
        try {
            await window.i18n.setLanguage(language);
        } catch (error) {
            console.warn('[i18n] Failed to apply app-language-updated event payload:', error);
        }
    });
}

if (btnNotemd) {
    btnNotemd.addEventListener('click', async () => {
        showEmbeddedNoteMD({ source: 'main-button' });
    });
}

const btnPathMode = document.getElementById('btn-path-mode');
if (btnPathMode) {
    const tryOpenAndroidNativePathMode = async (selectedNode) => {
        if (!window.__TAURI__ || !window.__TAURI__.core || typeof window.__TAURI__.core.invoke !== 'function') {
            return false;
        }

        const caps = window.__NC_RUNTIME_CAPS || {};
        if (!(caps.platform === 'android' && caps.supports_native_pathmode === true)) {
            return false;
        }

        const request = {
            mode: selectedNode ? 'diffusion' : 'domain',
            strategy: 'foundational',
            targetId: selectedNode ? selectedNode.id : null
        };

        try {
            const launchResult = await window.__TAURI__.core.invoke('open_native_pathmode', { request });
            if (launchResult && launchResult.launched === true) {
                console.log('[Path Mode] Opened native Android Godot Pathmode activity.');
                return true;
            }
            console.warn('[Path Mode] Native Android Pathmode launch was rejected:', launchResult);
        } catch (err) {
            console.error('[Path Mode] Failed to launch native Android Pathmode activity:', err);
        }

        return false;
    };

    btnPathMode.addEventListener('click', async () => {
        // v1.1.3: Robust Data Check
        // In mini/first-run scenarios `window.graphData` can be unavailable while local `nodes` is populated.
        // We check `nodes` length directly because it is the effective runtime source here.
        const hasData = (typeof nodes !== 'undefined' && nodes.length > 0);
        
        if (!hasData) {
            const msg = (window.i18n && typeof window.i18n.t === 'function')
                ? window.i18n.t('pathMode.loadKbFirst')
                : 'Please load a Knowledge Base first.';
            
            // Inline Feedback
            let feedbackEl = document.getElementById('path-mode-feedback');
            if (!feedbackEl) {
                feedbackEl = document.createElement('span');
                feedbackEl.id = 'path-mode-feedback';
                feedbackEl.style.color = '#ff6b6b';
                feedbackEl.style.fontSize = '0.8rem';
                feedbackEl.style.marginLeft = '10px';
                feedbackEl.style.transition = 'opacity 0.5s';
                btnPathMode.parentNode.appendChild(feedbackEl);
            }
            
            feedbackEl.innerText = msg;
            feedbackEl.style.opacity = '1';
            
            // Fade out after 3 seconds
            setTimeout(() => {
                feedbackEl.style.opacity = '0';
            }, 3000);
            
            return;
        }

        // Check for active selection for Diffusion Learning
        const highlightState = window.highlightManager ? window.highlightManager.getState() : null;
        const selectedNode = (highlightState && highlightState.currentNode) ? highlightState.currentNode : null;
        const multiWindowOptions = resolveRuntimeMultiWindowOptions();
        
        console.log('[Path Mode] Entering...', selectedNode ? `Target: ${selectedNode.id}` : 'Domain Mode');

        // Android Option A: prefer native full-screen Godot activity without touching desktop/web flows.
        const openedNativePathmode = await tryOpenAndroidNativePathMode(selectedNode);
        if (openedNativePathmode) {
            return;
        }
        
        // UI Switch
        document.getElementById('graph-wrapper').style.display = 'none';
        document.getElementById('path-container').style.display = 'block';
        
        // Initialize Path App
        if (window.pathApp) {
            if (selectedNode) {
                // Diffusion Learning
                const modeSelect = document.getElementById('learning-mode');
                if(modeSelect) modeSelect.value = 'diffusion';
                
                window.pathApp.init(selectedNode.id);
            } else {
                // Domain Learning
                const modeSelect = document.getElementById('learning-mode');
                if(modeSelect) modeSelect.value = 'domain';
                
                window.pathApp.init(null);
            }

            // Single-window toggle: hide Tauri, show Godot.
            // 单窗口切换：隐藏 Tauri，显示 Godot。
            if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
                try {
                    let bridgeVisibilityReady = true;
                    if (
                        multiWindowOptions.singleWindowMode &&
                        window.pathApp &&
                        typeof window.pathApp.requestBridgeWindowVisibility === 'function'
                    ) {
                        bridgeVisibilityReady = await window.pathApp.requestBridgeWindowVisibility(true, {
                            waitMs: 2500,
                            reason: 'enter-pathmode'
                        });
                    }

                    if (multiWindowOptions.singleWindowMode && !bridgeVisibilityReady) {
                        console.warn('[Path Mode] Bridge window visibility message was not delivered in time; skip hiding Tauri to avoid black-screen switch.');
                    } else {
                        // Hide the Tauri window via Rust IPC only after window-visibility intent is delivered.
                        await window.__TAURI__.core.invoke('toggle_pathmode_window', { showGodot: true });
                        console.log('[Path Mode] Single-window toggle: Tauri hidden, Godot shown.');
                    }
                } catch (err) {
                    console.warn('[Path Mode] toggle_pathmode_window failed:', err);
                }
            }
        } else {
            console.error('PathApp not loaded! Ensure libs/path_core.js and path_app.js are included.');
        }
    });
}
