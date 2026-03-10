import * as fs from 'fs';
import * as path from 'path';

export interface WasmLayoutNodeInput {
    id: string;
    inDegree?: number;
    outDegree?: number;
}

export interface WasmLayoutEdgeInput {
    source: string;
    target: string;
}

export type WasmLayoutResult = Map<string, { x: number; y: number }>;
export type WasmParityExecutionMode =
    | 'none'
    | 'json-layout'
    | 'json-betweenness'
    | 'legacy-layout'
    | 'legacy-betweenness'
    | 'fallback';

export interface WasmParityRuntimeDiagnostics {
    enabled: boolean;
    artifactPath: string | null;
    hasCachedInstancePromise: boolean;
    nextRetryAtMs: number;
    lastLoadError: string | null;
    lastExecutionMode: WasmParityExecutionMode;
}

type WasmParityExports = Record<string, unknown> & {
    wasm_parity_version?: () => number;
    compute_layout?: (...args: number[]) => number;
    compute_betweenness?: (...args: number[]) => number;
    compute_layout_json?: (inputPtr: number, inputLen: number) => number;
    compute_betweenness_json?: (inputPtr: number, inputLen: number) => number;
    get_last_result_len?: () => number;
    alloc?: (size: number) => number;
    dealloc?: (ptr: number, size: number) => void;
    memory?: WebAssembly.Memory;
};

/**
 * WASM parity runtime adapter for heavy graph/layout compute.
 *
 * This slice focuses on robust capability wiring and deterministic fallback.
 * If a production-grade wasm artifact is unavailable or incompatible, callers
 * must keep current worker/single-thread behavior unchanged.
 */
export class WasmParityRuntime {
    private static instancePromise: Promise<WebAssembly.Instance | null> | null = null;
    private static readonly textEncoder = new TextEncoder();
    private static readonly textDecoder = new TextDecoder();
    private static readonly DEFAULT_RETRY_MS = 5000;
    private static nextRetryAtMs = 0;
    private static lastLoadError: string | null = null;
    private static lastExecutionMode: WasmParityExecutionMode = 'none';

    static isEnabled(): boolean {
        const raw = String(process.env.NOTE_CONNECTION_ENABLE_WASM_PARITY || '').trim().toLowerCase();
        if (raw === '0' || raw === 'false' || raw === 'off') {
            return false;
        }
        return typeof WebAssembly !== 'undefined';
    }

    static resolveArtifactPath(): string | null {
        const envPath = String(process.env.NOTE_CONNECTION_WASM_PATH || '').trim();
        const candidates = envPath
            ? [envPath]
            : [
                path.resolve(process.cwd(), 'dist', 'src', 'backend', 'wasm', 'noteconnection_compute.wasm'),
                path.resolve(process.cwd(), 'src', 'backend', 'wasm', 'noteconnection_compute.wasm'),
                path.resolve(__dirname, '..', 'wasm', 'noteconnection_compute.wasm')
            ];

        for (const candidate of candidates) {
            if (!candidate) {
                continue;
            }
            try {
                if (fs.existsSync(candidate)) {
                    return candidate;
                }
            } catch (_err) {
                // Ignore invalid candidate path and continue.
            }
        }
        return null;
    }

    static async computeLayout(
        nodes: WasmLayoutNodeInput[],
        edges: WasmLayoutEdgeInput[],
        config: { repulsion?: number; distance?: number } = {}
    ): Promise<WasmLayoutResult | null> {
        this.lastExecutionMode = 'fallback';
        const instance = await this.getInstance();
        if (!instance) {
            return null;
        }

        const exports = instance.exports as WasmParityExports;
        const jsonResult = this.computeLayoutViaJsonAbi(exports, nodes, edges, config);
        if (jsonResult) {
            this.lastExecutionMode = 'json-layout';
            return jsonResult;
        }

        if (typeof exports.wasm_parity_version === 'function') {
            try {
                exports.wasm_parity_version();
            } catch (_err) {
                // Ignore handshake failures and continue with fallback.
                return null;
            }
        }

        if (typeof exports.compute_layout !== 'function') {
            return null;
        }

        // Current slice intentionally keeps deterministic fallback behavior.
        // Buffer/memory ABI for full layout compute is implemented in a follow-up.
        // Callers must continue worker/single-thread paths until ABI closure.
        try {
            exports.compute_layout(
                nodes.length,
                edges.length,
                Number(config.repulsion || 0),
                Number(config.distance || 0)
            );
            this.lastExecutionMode = 'legacy-layout';
        } catch (_err) {
            return null;
        }

        return null;
    }

    static async computeBetweenness(
        nodeIds: string[],
        adjacency: Record<string, string[]>
    ): Promise<Map<string, number> | null> {
        this.lastExecutionMode = 'fallback';
        const instance = await this.getInstance();
        if (!instance) {
            return null;
        }

        const exports = instance.exports as WasmParityExports;
        const jsonResult = this.computeBetweennessViaJsonAbi(exports, nodeIds, adjacency);
        if (jsonResult) {
            this.lastExecutionMode = 'json-betweenness';
            return jsonResult;
        }

        if (typeof exports.compute_betweenness !== 'function') {
            return null;
        }

        try {
            exports.compute_betweenness(
                nodeIds.length,
                Object.keys(adjacency || {}).length
            );
            this.lastExecutionMode = 'legacy-betweenness';
        } catch (_err) {
            return null;
        }

        return null;
    }

    private static computeLayoutViaJsonAbi(
        exports: WasmParityExports,
        nodes: WasmLayoutNodeInput[],
        edges: WasmLayoutEdgeInput[],
        config: { repulsion?: number; distance?: number }
    ): WasmLayoutResult | null {
        if (
            typeof exports.compute_layout_json !== 'function' ||
            typeof exports.get_last_result_len !== 'function' ||
            typeof exports.alloc !== 'function' ||
            !exports.memory
        ) {
            return null;
        }

        const payload = JSON.stringify({
            nodes,
            edges,
            config: {
                repulsion: Number(config.repulsion || 0),
                distance: Number(config.distance || 0)
            }
        });

        const resultText = this.invokeJsonAbiCall(exports, payload, exports.compute_layout_json);
        if (!resultText) {
            return null;
        }

        let decoded: unknown;
        try {
            decoded = JSON.parse(resultText);
        } catch (_parseErr) {
            return null;
        }

        return this.toLayoutResult(decoded);
    }

    private static computeBetweennessViaJsonAbi(
        exports: WasmParityExports,
        nodeIds: string[],
        adjacency: Record<string, string[]>
    ): Map<string, number> | null {
        if (
            typeof exports.compute_betweenness_json !== 'function' ||
            typeof exports.get_last_result_len !== 'function' ||
            typeof exports.alloc !== 'function' ||
            !exports.memory
        ) {
            return null;
        }

        const payload = JSON.stringify({
            nodeIds,
            adjacency
        });

        const resultText = this.invokeJsonAbiCall(exports, payload, exports.compute_betweenness_json);
        if (!resultText) {
            return null;
        }

        let decoded: unknown;
        try {
            decoded = JSON.parse(resultText);
        } catch (_parseErr) {
            return null;
        }

        return this.toBetweennessResult(decoded);
    }

    private static invokeJsonAbiCall(
        exports: WasmParityExports,
        jsonPayload: string,
        invoker: (inputPtr: number, inputLen: number) => number
    ): string | null {
        const memory = exports.memory;
        const alloc = exports.alloc;
        const dealloc = exports.dealloc;
        const getLen = exports.get_last_result_len;
        if (!memory || !alloc || !getLen) {
            return null;
        }

        const inputBytes = this.textEncoder.encode(jsonPayload);
        let inputPtr: number;
        try {
            inputPtr = alloc(inputBytes.length);
        } catch (_allocErr) {
            return null;
        }
        if (!Number.isFinite(inputPtr) || inputPtr < 0) {
            return null;
        }

        try {
            const view = new Uint8Array(memory.buffer, inputPtr, inputBytes.length);
            view.set(inputBytes);

            const outputPtr = invoker(inputPtr, inputBytes.length);
            const outputLen = getLen();
            if (!Number.isFinite(outputPtr) || !Number.isFinite(outputLen) || outputPtr < 0 || outputLen < 0) {
                return null;
            }
            if (outputLen === 0) {
                return '';
            }

            const outputBytes = new Uint8Array(memory.buffer, outputPtr, outputLen);
            const result = this.textDecoder.decode(outputBytes);
            if (typeof dealloc === 'function') {
                try {
                    dealloc(outputPtr, outputLen);
                } catch (_outputFreeErr) {
                    // Ignore dealloc failures to keep fallback deterministic.
                }
            }
            return result;
        } catch (_err) {
            return null;
        } finally {
            if (typeof dealloc === 'function') {
                try {
                    dealloc(inputPtr, inputBytes.length);
                } catch (_inputFreeErr) {
                    // Ignore dealloc failures to keep fallback deterministic.
                }
            }
        }
    }

    private static toLayoutResult(decoded: unknown): WasmLayoutResult | null {
        if (!decoded || typeof decoded !== 'object') {
            return null;
        }
        const nodes = (decoded as { nodes?: unknown }).nodes;
        if (!Array.isArray(nodes)) {
            return null;
        }

        const result: WasmLayoutResult = new Map();
        nodes.forEach((entry) => {
            if (!entry || typeof entry !== 'object') {
                return;
            }
            const row = entry as { id?: unknown; x?: unknown; y?: unknown };
            if (typeof row.id !== 'string') {
                return;
            }
            const x = Number(row.x);
            const y = Number(row.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                return;
            }
            result.set(row.id, { x, y });
        });

        return result.size > 0 ? result : null;
    }

    private static toBetweennessResult(decoded: unknown): Map<string, number> | null {
        if (!decoded || typeof decoded !== 'object') {
            return null;
        }

        const values = (decoded as { values?: unknown }).values;
        if (!values || typeof values !== 'object') {
            return null;
        }

        const result = new Map<string, number>();
        Object.entries(values as Record<string, unknown>).forEach(([id, rawValue]) => {
            const value = Number(rawValue);
            if (!Number.isFinite(value)) {
                return;
            }
            result.set(id, value);
        });

        return result.size > 0 ? result : null;
    }

    private static async getInstance(): Promise<WebAssembly.Instance | null> {
        if (!this.isEnabled()) {
            return null;
        }

        const now = Date.now();
        if (this.instancePromise) {
            const cached = await this.instancePromise;
            if (cached) {
                return cached;
            }
            if (now < this.nextRetryAtMs) {
                return null;
            }
        }

        if (!this.instancePromise || now >= this.nextRetryAtMs) {
            this.instancePromise = this.loadInstance();
        }

        const loaded = await this.instancePromise;
        if (!loaded) {
            this.nextRetryAtMs = Date.now() + this.getRetryIntervalMs();
        } else {
            this.nextRetryAtMs = 0;
        }
        return loaded;
    }

    private static async loadInstance(): Promise<WebAssembly.Instance | null> {
        const artifactPath = this.resolveArtifactPath();
        if (!artifactPath) {
            this.lastLoadError = 'artifact-not-found';
            return null;
        }

        try {
            const bytes = await fs.promises.readFile(artifactPath);
            const result = await WebAssembly.instantiate(bytes, {});
            this.lastLoadError = null;
            return result.instance;
        } catch (err) {
            this.lastLoadError = err instanceof Error ? err.message : String(err);
            console.warn('[WasmParityRuntime] Failed to load wasm artifact. Falling back to existing runtime.', err);
            return null;
        }
    }

    private static getRetryIntervalMs(): number {
        const raw = Number(String(process.env.NOTE_CONNECTION_WASM_RETRY_MS || '').trim());
        if (Number.isFinite(raw) && raw > 0) {
            return Math.floor(raw);
        }
        return this.DEFAULT_RETRY_MS;
    }

    static getDiagnostics(): WasmParityRuntimeDiagnostics {
        return {
            enabled: this.isEnabled(),
            artifactPath: this.resolveArtifactPath(),
            hasCachedInstancePromise: this.instancePromise !== null,
            nextRetryAtMs: this.nextRetryAtMs,
            lastLoadError: this.lastLoadError,
            lastExecutionMode: this.lastExecutionMode
        };
    }

    static __resetForTests(): void {
        this.instancePromise = null;
        this.nextRetryAtMs = 0;
        this.lastLoadError = null;
        this.lastExecutionMode = 'none';
    }
}
