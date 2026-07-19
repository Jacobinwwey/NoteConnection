import { Graph } from '../../core/Graph';
import { Worker } from 'worker_threads';
import { PerformanceLogger } from '../utils/PerformanceLogger';
import { resolveWorkerRuntimePath } from '../utils/WorkerRuntime';
import { WasmParityRuntime } from './WasmParityRuntime';

export type LayoutEngineComputeMode = 'none' | 'gpu' | 'wasm-adapter' | 'worker' | 'skipped';

export interface LayoutEngineComputeDiagnostics {
    mode: LayoutEngineComputeMode;
    nodeCount: number;
    edgeCount: number;
    durationMs: number;
    reason: string | null;
    updatedAtMs: number;
}

function createDefaultComputeDiagnostics(): LayoutEngineComputeDiagnostics {
    return {
        mode: 'none',
        nodeCount: 0,
        edgeCount: 0,
        durationMs: 0,
        reason: null,
        updatedAtMs: 0
    };
}

export class LayoutEngine {
    private static lastComputeDiagnostics: LayoutEngineComputeDiagnostics = createDefaultComputeDiagnostics();

    private static markComputeMode(
        mode: LayoutEngineComputeMode,
        nodeCount: number,
        edgeCount: number,
        startedAtMs: number,
        reason: string | null = null
    ): void {
        const updatedAtMs = Date.now();
        this.lastComputeDiagnostics = {
            mode,
            nodeCount,
            edgeCount,
            durationMs: Math.max(0, updatedAtMs - startedAtMs),
            reason,
            updatedAtMs
        };
    }

    static getLastComputeDiagnostics(): LayoutEngineComputeDiagnostics {
        return { ...this.lastComputeDiagnostics };
    }

    static __resetComputeDiagnosticsForTests(): void {
        this.lastComputeDiagnostics = createDefaultComputeDiagnostics();
    }

    static async computeLayout(graph: Graph, config?: any): Promise<void> {
        const startedAtMs = Date.now();
        PerformanceLogger.start('Backend Layout Calculation');
        
        const nodes = graph.getNodes();
        const edges = graph.getEdges();
        const nodeCount = nodes.length;
        const edgeCount = edges.length;

        // If graph is too small, maybe skip? But consistency is good.

        // GPU Acceleration Check
        if (config && config.enableGPU) {
            try {
                // Try to load GPU module dynamically
                const { LayoutGPU } = require('../../../amdgpu/LayoutGPU');
                const layoutGPU = new LayoutGPU();
                
                if (layoutGPU.isAvailable()) {
                    console.log('[LayoutEngine] GPU Acceleration enabled. Using LayoutGPU.');
                    
                    // Run synchronously (blocking) or wrap in promise?
                    // Since it's GPU, it might be fast enough to block, or we can use setImmediate loop in it?
                    // For now, let's run it.
                    const positions = layoutGPU.compute(nodes, edges, config);
                    
                    positions.forEach((pos: {x: number, y: number}, id: string) => {
                        const node = graph.getNode(id);
                        if (node) {
                            node.x = pos.x;
                            node.y = pos.y;
                        }
                    });
                    
                    layoutGPU.destroy();
                    this.markComputeMode('gpu', nodeCount, edgeCount, startedAtMs, null);
                    PerformanceLogger.end('Backend Layout Calculation');
                    return Promise.resolve();
                }
            } catch (e) {
                console.warn('[LayoutEngine] GPU Layout failed or not found. Falling back to Worker.', e);
            }
        }

        // WASM parity slice: try wasm runtime before worker-thread fallback.
        // This keeps current behavior deterministic when wasm is unavailable.
        try {
            const wasmPositions = await WasmParityRuntime.computeLayout(
                nodes.map((node) => ({ id: node.id, inDegree: node.inDegree, outDegree: node.outDegree })),
                edges.map((edge) => ({
                    source: edge.source,
                    target: edge.target
                })),
                {
                    repulsion: config?.repulsion,
                    distance: config?.distance
                }
            );

            if (wasmPositions && wasmPositions.size > 0) {
                wasmPositions.forEach((pos, id) => {
                    const node = graph.getNode(id);
                    if (node) {
                        node.x = pos.x;
                        node.y = pos.y;
                    }
                });
                console.log('[LayoutEngine] Applied wasm parity layout results.');
                this.markComputeMode('wasm-adapter', nodeCount, edgeCount, startedAtMs, 'wasm-result-applied');
                PerformanceLogger.end('Backend Layout Calculation');
                return Promise.resolve();
            }
        } catch (wasmErr) {
            console.warn('[LayoutEngine] WASM parity layout failed. Falling back to Worker.', wasmErr);
        }

        const workerRuntime = resolveWorkerRuntimePath(__dirname, '../workers/layoutWorker.ts');
        const actualWorkerPath = workerRuntime.workerPath;
        const isTsNode = workerRuntime.isTsNode;

        if (!actualWorkerPath) {
            console.warn('[LayoutEngine] Layout worker not found. Skipping backend layout calculation.');
            console.warn('[LayoutEngine] Checked paths:', workerRuntime.candidates);
            this.markComputeMode('skipped', nodeCount, edgeCount, startedAtMs, 'worker-script-unavailable');
            PerformanceLogger.end('Backend Layout Calculation');
            return Promise.resolve();
        }

        console.log(`[LayoutEngine] Spawning layout worker: ${actualWorkerPath}`);

        // pkg runtime + d3-force ESM can fail inside worker_threads.
        // Skip backend layout instead of surfacing a hard runtime error.
        if ((process as any).pkg) {
            console.warn('[LayoutEngine] Skipping layout worker in pkg runtime (ESM worker limitation).');
            this.markComputeMode('skipped', nodeCount, edgeCount, startedAtMs, 'pkg-worker-esm-limitation');
            PerformanceLogger.end('Backend Layout Calculation');
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            let isFinalized = false;
            const finalize = (mode: LayoutEngineComputeMode, reason: string | null = null): void => {
                if (isFinalized) {
                    return;
                }
                isFinalized = true;
                this.markComputeMode(mode, nodeCount, edgeCount, startedAtMs, reason);
                PerformanceLogger.end('Backend Layout Calculation');
                resolve();
            };

            const worker = new Worker(actualWorkerPath, {
                workerData: {
                    nodes: nodes,
                    edges: edges,
                    config: config
                },
                execArgv: isTsNode ? ['-r', require.resolve('ts-node/register')] : undefined
            });

            worker.on('message', (positions: Map<string, {x: number, y: number}>) => {
                positions.forEach((pos, id) => {
                    const node = graph.getNode(id);
                    if (node) {
                        node.x = pos.x;
                        node.y = pos.y;
                        // Mark as fixed? Frontend handles "Static" mode.
                        // But we populate x/y so frontend can use them as initial positions.
                    }
                });
                finalize('worker', null);
            });

            worker.on('error', (err) => {
                console.error('[LayoutEngine] Worker failed:', err);
                // Don't fail the whole build, just log
                finalize('worker', 'worker-error-fallback');
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`[LayoutEngine] Worker exited with code ${code}`);
                    finalize('worker', `worker-exit-${code}`);
                }
            });
        });
    }
}
