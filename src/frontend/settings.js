/**
 * Settings Manager Module
 * Unified frontend settings persistence:
 * 1) local snapshot for immediate startup/fallback
 * 2) app_config.toml via sidecar API for cross-window consistency
 */

const SETTINGS_STORAGE_KEY = "nc_settings";
const FRONTEND_SETTINGS_ENDPOINT = "/api/frontend/settings";
const RUNTIME_READY_TIMEOUT_MS = 2000;
const REMOTE_SYNC_DEBOUNCE_MS = 200;
const RUNTIME_REQUEST_RETRY_DELAY_MS = 180;

const defaultSettings = {
    physics: {
        repulsionForce: -550,
        repulsionDAG: -850,
        linkDistance: 250,
        collisionRadius: 25
    },
    visuals: {
        edgeOpacity: 0.6,
        baseNodeSize: 5,
        degreeMode: "visible"
    },
    performance: {
        maxWorkers: 4,
        enableGPU: true,
        gpuRendering: true,
        memorySavingMode: false,
        compactMode: false,
        staticMode: false,
        deepDebug: false
    },
    reading: {
        mode: "window",
        markdownEngine: "auto",
        chunkBlockSize: 36,
        prefetchBlocks: 8,
        indexCacheTtlSec: 1800,
        maxDocBytes: 100663296
    }
};

function isObjectLike(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function clampNumber(value, minValue, maxValue, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.max(minValue, Math.min(maxValue, numeric));
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDegreeMode(value) {
    return String(value || "").trim().toLowerCase() === "total" ? "total" : "visible";
}

function normalizeReadingMode(value) {
    return String(value || "").trim().toLowerCase() === "fullscreen" ? "fullscreen" : "window";
}

function normalizeMarkdownEngine(value) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "legacy") return "legacy";
    if (text === "pulldown") return "pulldown";
    return "auto";
}

function deepMerge(baseValue, incomingValue) {
    if (!isObjectLike(baseValue)) {
        return incomingValue;
    }
    if (!isObjectLike(incomingValue)) {
        return deepClone(baseValue);
    }

    const result = { ...baseValue };
    Object.keys(incomingValue).forEach((key) => {
        const incomingField = incomingValue[key];
        const baseField = baseValue[key];
        if (isObjectLike(baseField) && isObjectLike(incomingField)) {
            result[key] = deepMerge(baseField, incomingField);
            return;
        }
        result[key] = incomingField;
    });
    return result;
}

function normalizeSettings(candidate) {
    const merged = deepMerge(defaultSettings, isObjectLike(candidate) ? candidate : {});

    merged.physics.repulsionForce = clampNumber(
        merged.physics.repulsionForce,
        -10000,
        -1,
        defaultSettings.physics.repulsionForce
    );
    merged.physics.repulsionDAG = clampNumber(
        merged.physics.repulsionDAG,
        -10000,
        -1,
        defaultSettings.physics.repulsionDAG
    );
    merged.physics.linkDistance = Math.round(
        clampNumber(merged.physics.linkDistance, 20, 2000, defaultSettings.physics.linkDistance)
    );
    merged.physics.collisionRadius = Math.round(
        clampNumber(merged.physics.collisionRadius, 1, 300, defaultSettings.physics.collisionRadius)
    );

    merged.visuals.edgeOpacity = clampNumber(
        merged.visuals.edgeOpacity,
        0,
        1,
        defaultSettings.visuals.edgeOpacity
    );
    merged.visuals.baseNodeSize = clampNumber(
        merged.visuals.baseNodeSize,
        1,
        100,
        defaultSettings.visuals.baseNodeSize
    );
    merged.visuals.degreeMode = normalizeDegreeMode(merged.visuals.degreeMode);

    merged.performance.maxWorkers = Math.round(
        clampNumber(merged.performance.maxWorkers, 1, 64, defaultSettings.performance.maxWorkers)
    );
    merged.performance.enableGPU = merged.performance.enableGPU !== false;
    merged.performance.gpuRendering = merged.performance.gpuRendering !== false;
    merged.performance.memorySavingMode = merged.performance.memorySavingMode === true;
    merged.performance.compactMode = merged.performance.compactMode === true;
    merged.performance.staticMode = merged.performance.staticMode === true;
    merged.performance.deepDebug = merged.performance.deepDebug === true;

    merged.reading.mode = normalizeReadingMode(merged.reading.mode);
    merged.reading.markdownEngine = normalizeMarkdownEngine(
        merged.reading.markdownEngine || merged.reading.markdown_engine
    );
    merged.reading.chunkBlockSize = Math.round(
        clampNumber(
            merged.reading.chunkBlockSize ?? merged.reading.chunk_block_size,
            1,
            4096,
            defaultSettings.reading.chunkBlockSize
        )
    );
    merged.reading.prefetchBlocks = Math.round(
        clampNumber(
            merged.reading.prefetchBlocks ?? merged.reading.prefetch_blocks,
            0,
            1024,
            defaultSettings.reading.prefetchBlocks
        )
    );
    merged.reading.indexCacheTtlSec = Math.round(
        clampNumber(
            merged.reading.indexCacheTtlSec ?? merged.reading.index_cache_ttl_sec,
            5,
            86400,
            defaultSettings.reading.indexCacheTtlSec
        )
    );
    merged.reading.maxDocBytes = Math.round(
        clampNumber(
            merged.reading.maxDocBytes ?? merged.reading.max_doc_bytes,
            256 * 1024,
            2 * 1024 * 1024 * 1024,
            defaultSettings.reading.maxDocBytes
        )
    );
    return merged;
}

class SettingsManager {
    constructor() {
        this.listeners = [];
        this.remoteSyncTimer = null;
        this.remoteSyncInFlight = null;
        this.remoteSyncPending = false;
        this.remoteSyncDeferred = false;
        this.isHydrationComplete = false;
        this.preHydrationPatches = [];
        this.settings = this.loadLocalSnapshot();
        this.hydrateFromRuntime().catch((error) => {
            console.warn("[Settings] Runtime settings hydration failed; using local snapshot.", error);
        }).finally(() => {
            this.isHydrationComplete = true;
            if (this.remoteSyncDeferred) {
                this.remoteSyncDeferred = false;
                this.scheduleRuntimePersist();
            }
        });
    }

    loadLocalSnapshot() {
        const fallback = normalizeSettings(defaultSettings);
        try {
            const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (!saved) {
                return fallback;
            }
            const parsed = JSON.parse(saved);
            return normalizeSettings(parsed);
        } catch (error) {
            console.warn("[Settings] Failed to parse local settings snapshot.", error);
            return fallback;
        }
    }

    writeLocalSnapshot() {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
        } catch (error) {
            console.warn("[Settings] Failed to save local settings snapshot.", error);
        }
    }

    getBaseUrl() {
        if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.getBaseUrl === "function") {
            return window.NoteConnectionRuntime.getBaseUrl();
        }
        return `${window.location.protocol}//${window.location.host}`;
    }

    buildUrl(resourcePath) {
        if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.buildUrl === "function") {
            return window.NoteConnectionRuntime.buildUrl(resourcePath.replace(/^\/+/, ""));
        }
        return new URL(resourcePath, `${this.getBaseUrl()}/`).toString();
    }

    buildFetchOptions(init) {
        if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.buildFetchOptions === "function") {
            return window.NoteConnectionRuntime.buildFetchOptions(init);
        }
        return init;
    }

    async ensureRuntimeReady() {
        if (!window.NoteConnectionRuntime || typeof window.NoteConnectionRuntime.whenReady !== "function") {
            return;
        }
        await new Promise((resolve) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve();
            }, RUNTIME_READY_TIMEOUT_MS);

            Promise.resolve(window.NoteConnectionRuntime.whenReady())
                .then(() => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    clearTimeout(timeout);
                    resolve();
                })
                .catch(() => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    clearTimeout(timeout);
                    resolve();
                });
        });
    }

    async requestRuntimeSettings(method, settingsPayload) {
        const requestInit = {
            method,
            headers: {
                "Content-Type": "application/json"
            }
        };
        if (method !== "GET") {
            requestInit.body = JSON.stringify({
                settings: settingsPayload
            });
        }

        const maxAttempts = (window.__TAURI__ && method === "GET") ? 12 : ((window.__TAURI__ && method === "POST") ? 8 : 1);
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                const response = await fetch(
                    this.buildUrl(FRONTEND_SETTINGS_ENDPOINT),
                    this.buildFetchOptions(requestInit)
                );
                if (!response.ok) {
                    const message = await response.text().catch(() => "");
                    const error = new Error(message || `Frontend settings request failed (${method} ${response.status}).`);
                    error.status = response.status;
                    throw error;
                }

                const payload = await response.json().catch(() => null);
                if (!payload || payload.success !== true || !isObjectLike(payload.settings)) {
                    throw new Error("Invalid frontend settings API response.");
                }
                return normalizeSettings(payload.settings);
            } catch (error) {
                lastError = error;
                const status = Number(error && error.status);
                const shouldRetry = Boolean(
                    window.__TAURI__
                    && attempt < maxAttempts
                    && (
                        !Number.isFinite(status)
                        || status === 404
                        || status === 502
                        || status === 503
                        || status === 504
                    )
                );
                if (!shouldRetry) {
                    throw error;
                }
                await sleep(Math.min(1000, RUNTIME_REQUEST_RETRY_DELAY_MS * attempt));
            }
        }

        throw lastError || new Error("Frontend settings request failed.");
    }

    async hydrateFromRuntime() {
        await this.ensureRuntimeReady();
        const runtimeSettings = await this.requestRuntimeSettings("GET");
        this.settings = this.applyPreHydrationPatches(runtimeSettings);
        this.writeLocalSnapshot();
        this.notify();
    }

    applyPreHydrationPatches(baseSettings) {
        const patched = normalizeSettings(baseSettings);
        if (!Array.isArray(this.preHydrationPatches) || this.preHydrationPatches.length === 0) {
            return patched;
        }

        this.preHydrationPatches.forEach((patch) => {
            if (!patch || typeof patch.category !== "string" || typeof patch.key !== "string") {
                return;
            }
            if (!isObjectLike(patched[patch.category])) {
                patched[patch.category] = {};
            }
            patched[patch.category][patch.key] = patch.value;
        });
        this.preHydrationPatches = [];
        return normalizeSettings(patched);
    }

    get(category, key) {
        if (!this.settings || !isObjectLike(this.settings[category])) {
            return undefined;
        }
        return this.settings[category][key];
    }

    set(category, key, value) {
        if (!isObjectLike(this.settings[category])) {
            this.settings[category] = {};
        }
        this.settings[category][key] = value;
        if (!this.isHydrationComplete) {
            this.preHydrationPatches.push({ category, key, value });
        }
        this.settings = normalizeSettings(this.settings);
        this.save();
    }

    save() {
        this.writeLocalSnapshot();
        this.notify();
        this.scheduleRuntimePersist();
    }

    scheduleRuntimePersist() {
        if (!this.isHydrationComplete) {
            this.remoteSyncDeferred = true;
            return;
        }
        if (this.remoteSyncTimer) {
            clearTimeout(this.remoteSyncTimer);
        }
        this.remoteSyncTimer = setTimeout(() => {
            this.remoteSyncTimer = null;
            this.persistToRuntime().catch((error) => {
                console.warn("[Settings] Runtime persistence failed; local snapshot remains active.", error);
            });
        }, REMOTE_SYNC_DEBOUNCE_MS);
    }

    async persistToRuntime() {
        if (this.remoteSyncInFlight) {
            this.remoteSyncPending = true;
            return;
        }

        const snapshot = normalizeSettings(this.settings);
        this.remoteSyncInFlight = this.requestRuntimeSettings("POST", snapshot)
            .then((persistedSettings) => {
                this.settings = persistedSettings;
                this.writeLocalSnapshot();
                this.notify();
            })
            .finally(() => {
                this.remoteSyncInFlight = null;
            });

        try {
            await this.remoteSyncInFlight;
        } finally {
            if (this.remoteSyncPending) {
                this.remoteSyncPending = false;
                await this.persistToRuntime();
            }
        }
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notify() {
        this.listeners.forEach((cb) => cb(this.settings));
    }

    reset() {
        this.settings = normalizeSettings(defaultSettings);
        this.save();
    }
}

const settingsManager = new SettingsManager();
window.settingsManager = settingsManager;
