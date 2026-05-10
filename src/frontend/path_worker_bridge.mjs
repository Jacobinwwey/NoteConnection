/**
 * path_worker_bridge.mjs — Extracted Web Worker communication layer.
 * Handles worker lifecycle, message dispatch, and error recovery.
 * Formerly inline in path_app.js (lines ~200-600).
 */

const DEFAULT_WORKER_SCRIPT = 'path_worker.js';

let worker = null;
const pendingRequests = new Map();
let requestIdCounter = 0;

export function createWorkerBridge(workerScript = DEFAULT_WORKER_SCRIPT) {
    if (worker) return { worker, send, terminate };

    try {
        worker = new Worker(workerScript, { type: 'module' });
    } catch (_) {
        worker = new Worker(workerScript);
    }

    worker.onmessage = (event) => {
        const { id, type, payload, error } = event.data || {};
        if (id && pendingRequests.has(id)) {
            const { resolve, reject, timer } = pendingRequests.get(id);
            clearTimeout(timer);
            pendingRequests.delete(id);
            if (error) reject(new Error(error));
            else resolve({ type, payload });
        }
    };

    worker.onerror = (err) => {
        console.error('[PathWorkerBridge] Worker error:', err);
        for (const [id, { reject, timer }] of pendingRequests) {
            clearTimeout(timer);
            reject(new Error('Worker error'));
            pendingRequests.delete(id);
        }
    };

    return { worker, send, terminate };
}

function send(type, payload, timeoutMs = 30000) {
    if (!worker) throw new Error('Worker not initialized');
    return new Promise((resolve, reject) => {
        const id = ++requestIdCounter;
        const timer = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error(`Worker request timed out: ${type}`));
        }, timeoutMs);
        pendingRequests.set(id, { resolve, reject, timer });
        worker.postMessage({ id, type, payload });
    });
}

export function terminate() {
    if (worker) {
        worker.terminate();
        worker = null;
        pendingRequests.clear();
    }
}

export function isWorkerReady() {
    return worker !== null && worker.readyState !== undefined;
}

/**
 * Helper: compute a learning path via the worker.
 * Falls back to synchronous computation if worker is unavailable.
 */
export async function computePathViaWorker(params, fallbackFn) {
    if (!worker) {
        return fallbackFn ? fallbackFn(params) : null;
    }
    try {
        const result = await send('computePath', params);
        return result.payload;
    } catch (err) {
        console.warn('[PathWorkerBridge] Worker path compute failed, using fallback:', err);
        return fallbackFn ? fallbackFn(params) : null;
    }
}
