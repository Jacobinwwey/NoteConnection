import { WasmParityRuntime } from './backend/algorithms/WasmParityRuntime';

type JsonAbiFixtureOptions = {
    layoutResponse?: string;
    betweennessResponse?: string;
    includeMemory?: boolean;
    includeAlloc?: boolean;
};

function createJsonAbiFixture(options: JsonAbiFixtureOptions): WebAssembly.Instance {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let heapTop = 64;
    let lastResultLen = 0;

    const ensureCapacity = (requiredEnd: number): void => {
        while (requiredEnd > memory.buffer.byteLength) {
            memory.grow(1);
        }
    };

    const alloc = jest.fn((size: number): number => {
        const safeSize = Math.max(0, Math.floor(Number(size) || 0));
        const ptr = heapTop;
        const next = ptr + safeSize + 1;
        ensureCapacity(next);
        heapTop = next;
        return ptr;
    });

    const dealloc = jest.fn((_ptr: number, _size: number): void => {
        // No-op for fixture memory lifecycle.
    });

    const writeResult = (rawText: string): number => {
        const out = encoder.encode(rawText);
        const outPtr = alloc(out.length);
        ensureCapacity(outPtr + out.length);
        new Uint8Array(memory.buffer, outPtr, out.length).set(out);
        lastResultLen = out.length;
        return outPtr;
    };

    const exports: Record<string, unknown> = {
        get_last_result_len: jest.fn(() => lastResultLen),
        dealloc
    };

    if (options.includeMemory !== false) {
        exports.memory = memory;
    }
    if (options.includeAlloc !== false) {
        exports.alloc = alloc;
    }

    if (typeof options.layoutResponse === 'string') {
        exports.compute_layout_json = jest.fn((inputPtr: number, inputLen: number) => {
            const input = decoder.decode(new Uint8Array(memory.buffer, inputPtr, inputLen));
            const payload = JSON.parse(input) as { nodes?: unknown[]; edges?: unknown[] };
            expect(Array.isArray(payload.nodes)).toBe(true);
            expect(Array.isArray(payload.edges)).toBe(true);
            return writeResult(options.layoutResponse as string);
        });
    }

    if (typeof options.betweennessResponse === 'string') {
        exports.compute_betweenness_json = jest.fn((inputPtr: number, inputLen: number) => {
            const input = decoder.decode(new Uint8Array(memory.buffer, inputPtr, inputLen));
            const payload = JSON.parse(input) as { nodeIds?: unknown[]; adjacency?: unknown };
            expect(Array.isArray(payload.nodeIds)).toBe(true);
            expect(payload.adjacency && typeof payload.adjacency === 'object').toBe(true);
            return writeResult(options.betweennessResponse as string);
        });
    }

    return { exports } as unknown as WebAssembly.Instance;
}

function setRuntimeInstance(instance: WebAssembly.Instance | null): void {
    (WasmParityRuntime as any).instancePromise = Promise.resolve(instance);
}

function clearRuntimeInstance(): void {
    (WasmParityRuntime as any).instancePromise = null;
}

describe('wasm parity runtime functional JSON ABI', () => {
    beforeEach(() => {
        delete process.env.NOTE_CONNECTION_ENABLE_WASM_PARITY;
        delete process.env.NOTE_CONNECTION_WASM_RETRY_MS;
        WasmParityRuntime.__resetForTests();
        clearRuntimeInstance();
    });

    afterEach(() => {
        WasmParityRuntime.__resetForTests();
        clearRuntimeInstance();
        jest.restoreAllMocks();
    });

    test('computeLayout returns node positions when JSON ABI exports are available', async () => {
        const fixture = createJsonAbiFixture({
            layoutResponse: JSON.stringify({
                nodes: [
                    { id: 'A', x: 12.5, y: -4 },
                    { id: 'B', x: 0, y: 9.25 }
                ]
            })
        });

        setRuntimeInstance(fixture);
        const result = await WasmParityRuntime.computeLayout(
            [{ id: 'A', inDegree: 1, outDegree: 2 }, { id: 'B', inDegree: 3, outDegree: 1 }],
            [{ source: 'A', target: 'B' }],
            { repulsion: 260, distance: 110 }
        );

        expect(result).not.toBeNull();
        expect(result?.get('A')).toEqual({ x: 12.5, y: -4 });
        expect(result?.get('B')).toEqual({ x: 0, y: 9.25 });
    });

    test('computeBetweenness returns score map when JSON ABI exports are available', async () => {
        const fixture = createJsonAbiFixture({
            betweennessResponse: JSON.stringify({
                values: {
                    A: 0.5,
                    B: 3.75,
                    C: 1
                }
            })
        });

        setRuntimeInstance(fixture);
        const result = await WasmParityRuntime.computeBetweenness(
            ['A', 'B', 'C'],
            {
                A: ['B'],
                B: ['C'],
                C: []
            }
        );

        expect(result).not.toBeNull();
        expect(result?.get('A')).toBe(0.5);
        expect(result?.get('B')).toBe(3.75);
        expect(result?.get('C')).toBe(1);
    });

    test('returns null when JSON ABI exports are incomplete', async () => {
        const fixture = createJsonAbiFixture({
            layoutResponse: JSON.stringify({
                nodes: [{ id: 'A', x: 1, y: 1 }]
            }),
            includeAlloc: false
        });

        setRuntimeInstance(fixture);
        const result = await WasmParityRuntime.computeLayout(
            [{ id: 'A' }],
            [],
            {}
        );

        expect(result).toBeNull();
    });

    test('returns null when JSON ABI output is invalid JSON', async () => {
        const fixture = createJsonAbiFixture({
            betweennessResponse: '{not-valid-json}'
        });

        setRuntimeInstance(fixture);
        const result = await WasmParityRuntime.computeBetweenness(
            ['A'],
            { A: [] }
        );

        expect(result).toBeNull();
    });

    test('exposes diagnostics with execution mode after JSON ABI success', async () => {
        const fixture = createJsonAbiFixture({
            layoutResponse: JSON.stringify({
                nodes: [{ id: 'A', x: 1, y: 2 }]
            })
        });
        setRuntimeInstance(fixture);

        await WasmParityRuntime.computeLayout([{ id: 'A' }], [], {});

        const diagnostics = WasmParityRuntime.getDiagnostics();
        expect(diagnostics.lastExecutionMode).toBe('json-layout');
        expect(diagnostics.hasCachedInstancePromise).toBe(true);
        expect(diagnostics.lastLoadError).toBeNull();
    });

    test('retries wasm loading only after retry interval when artifact is unavailable', async () => {
        process.env.NOTE_CONNECTION_WASM_RETRY_MS = '60000';
        WasmParityRuntime.__resetForTests();

        let now = 1000;
        const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
        const loadSpy = jest.spyOn(WasmParityRuntime as any, 'loadInstance').mockResolvedValue(null);

        const first = await WasmParityRuntime.computeLayout([{ id: 'A' }], [], {});
        const second = await WasmParityRuntime.computeLayout([{ id: 'A' }], [], {});
        now += 60001;
        const third = await WasmParityRuntime.computeLayout([{ id: 'A' }], [], {});

        expect(first).toBeNull();
        expect(second).toBeNull();
        expect(third).toBeNull();
        expect(loadSpy).toHaveBeenCalledTimes(2);

        const diagnostics = WasmParityRuntime.getDiagnostics();
        expect(diagnostics.nextRetryAtMs).toBeGreaterThan(now);
        expect(diagnostics.lastExecutionMode).toBe('fallback');

        nowSpy.mockRestore();
    });
});
