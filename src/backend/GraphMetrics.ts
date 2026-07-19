import { Graph } from '../core/Graph';
import { Worker } from 'worker_threads';
import * as os from 'os';
import { config } from './config';
import { resolveWorkerRuntimePath } from './utils/WorkerRuntime';
import { WasmParityRuntime } from './algorithms/WasmParityRuntime';

export type GraphMetricsComputeMode = 'none' | 'wasm-adapter' | 'worker' | 'sequential';

export interface GraphMetricsComputeDiagnostics {
    mode: GraphMetricsComputeMode;
    nodeCount: number;
    edgeCount: number;
    durationMs: number;
    reason: string | null;
    updatedAtMs: number;
}

export interface GraphMetricsExecutionPolicy {
    asyncNodeCountThreshold: number;
    asyncWorkloadBenefitRatioThreshold: number;
}

function createDefaultComputeDiagnostics(): GraphMetricsComputeDiagnostics {
    return {
        mode: 'none',
        nodeCount: 0,
        edgeCount: 0,
        durationMs: 0,
        reason: null,
        updatedAtMs: 0
    };
}

export class GraphMetrics {
    private static readonly DEFAULT_ASYNC_NODE_COUNT_THRESHOLD = 500;
    private static readonly DEFAULT_ASYNC_WORKLOAD_BENEFIT_RATIO_THRESHOLD = 24;
    private static lastComputeDiagnostics: GraphMetricsComputeDiagnostics = createDefaultComputeDiagnostics();

    private static parsePositiveIntegerEnv(name: string): number | null {
        const raw = String(process.env[name] || '').trim();
        if (!raw) {
            return null;
        }

        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return null;
        }

        return Math.floor(parsed);
    }

    private static parsePositiveNumberEnv(name: string): number | null {
        const raw = String(process.env[name] || '').trim();
        if (!raw) {
            return null;
        }

        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return null;
        }

        return parsed;
    }

    private static resolveExecutionPolicy(): GraphMetricsExecutionPolicy {
        const asyncNodeCountThreshold = this.parsePositiveIntegerEnv('NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD');
        const asyncWorkloadBenefitRatioThreshold = this.parsePositiveNumberEnv(
            'NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD'
        );

        return {
            asyncNodeCountThreshold: asyncNodeCountThreshold ?? this.DEFAULT_ASYNC_NODE_COUNT_THRESHOLD,
            asyncWorkloadBenefitRatioThreshold:
                asyncWorkloadBenefitRatioThreshold ?? this.DEFAULT_ASYNC_WORKLOAD_BENEFIT_RATIO_THRESHOLD
        };
    }

    static getExecutionPolicy(): GraphMetricsExecutionPolicy {
        return this.resolveExecutionPolicy();
    }

    private static resolveExecutionDecision(
        nodeCount: number,
        edgeCount: number,
        workerCount: number,
        memorySavingMode: boolean,
        policy: GraphMetricsExecutionPolicy
    ): {
        useAsyncPath: boolean;
        reason: string;
        estimatedBenefitRatio: number | null;
        estimatedWorkUnits: number;
        estimatedWorkerOverheadUnits: number;
    } {
        if (memorySavingMode) {
            return {
                useAsyncPath: false,
                reason: 'memory-saving-mode',
                estimatedBenefitRatio: null,
                estimatedWorkUnits: 0,
                estimatedWorkerOverheadUnits: 0
            };
        }

        if (nodeCount < policy.asyncNodeCountThreshold) {
            return {
                useAsyncPath: false,
                reason: 'small-graph-threshold',
                estimatedBenefitRatio: null,
                estimatedWorkUnits: 0,
                estimatedWorkerOverheadUnits: 0
            };
        }

        const normalizedWorkerCount = Math.max(1, Math.floor(Number(workerCount) || 1));
        const normalizedNodeCount = Math.max(0, Math.floor(Number(nodeCount) || 0));
        const normalizedEdgeCount = Math.max(0, Math.floor(Number(edgeCount) || 0));
        const estimatedWorkUnits = normalizedNodeCount * normalizedEdgeCount;
        const estimatedWorkerOverheadUnits = normalizedWorkerCount * (normalizedNodeCount + normalizedEdgeCount);
        const estimatedBenefitRatio = estimatedWorkUnits / Math.max(1, estimatedWorkerOverheadUnits);

        if (estimatedBenefitRatio < policy.asyncWorkloadBenefitRatioThreshold) {
            return {
                useAsyncPath: false,
                reason: 'sparse-workload-threshold',
                estimatedBenefitRatio,
                estimatedWorkUnits,
                estimatedWorkerOverheadUnits
            };
        }

        return {
            useAsyncPath: true,
            reason: 'workload-tier-async',
            estimatedBenefitRatio,
            estimatedWorkUnits,
            estimatedWorkerOverheadUnits
        };
    }

    private static markComputeMode(
        mode: GraphMetricsComputeMode,
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

    static getLastComputeDiagnostics(): GraphMetricsComputeDiagnostics {
        return { ...this.lastComputeDiagnostics };
    }

    static __resetComputeDiagnosticsForTests(): void {
        this.lastComputeDiagnostics = createDefaultComputeDiagnostics();
    }

    /**
     * Calculates Betweenness Centrality for all nodes (Parallel Version).
     * Uses Worker threads to distribute the Brandes Algorithm.
     * 计算所有节点的介数中心性（并行版本）。
     * 使用 Worker 线程分发 Brandes 算法。
     */
    static async calculateBetweennessAsync(graph: Graph): Promise<Map<string, number>> {
        const startedAtMs = Date.now();
        const nodes = graph.toJSON().nodes;
        const allNodeIds = nodes.map(n => n.id);
        const nodeCount = nodes.length;
        const edgeCount = graph.getEdges().length;
        const numCPUs = os.cpus().length;
        const workerCount = Math.max(1, config.maxWorkers ?? Math.max(1, numCPUs - 1));
        const executionPolicy = this.resolveExecutionPolicy();
        const executionDecision = this.resolveExecutionDecision(
            nodeCount,
            edgeCount,
            workerCount,
            config.memorySavingMode,
            executionPolicy
        );

        // Create a lightweight adjacency list for workers
        // 为 Workers 创建轻量级邻接表
        const adj: Record<string, string[]> = {};
        nodes.forEach(n => {
            adj[n.id] = graph.getOutgoingEdges(n.id).map(e => e.target);
        });

        if (!executionDecision.useAsyncPath) {
            const estimatedBenefitRatio = executionDecision.estimatedBenefitRatio;
            const ratioPart = typeof estimatedBenefitRatio === 'number' && Number.isFinite(estimatedBenefitRatio)
                ? `, workloadRatio=${estimatedBenefitRatio.toFixed(4)}`
                : '';
            console.log(
                `[GraphMetrics] Using Single-Core calculation (${executionDecision.reason}, Nodes: ${nodeCount}, Edges: ${edgeCount}${ratioPart})`
            );
            const sequentialResult = this.calculateBetweenness(graph);
            this.markComputeMode('sequential', nodeCount, edgeCount, startedAtMs, executionDecision.reason);
            return sequentialResult;
        }

        // WASM parity slice: try wasm runtime before parallel worker fan-out.
        // If wasm path is unavailable/incomplete, preserve existing behavior.
        if (!config.memorySavingMode) {
            try {
                const wasmResult = await WasmParityRuntime.computeBetweenness(allNodeIds, adj);
                if (wasmResult && wasmResult.size > 0) {
                    console.log('[GraphMetrics] Using WASM parity betweenness runtime.');
                    this.markComputeMode('wasm-adapter', nodeCount, edgeCount, startedAtMs, 'wasm-result-applied');
                    return wasmResult;
                }
            } catch (wasmErr) {
                console.warn('[GraphMetrics] WASM parity betweenness failed. Falling back to worker/sequential.', wasmErr);
            }
        }

        console.log(`[GraphMetrics] Starting Parallel Betweenness Centrality with ${workerCount} workers...`);

        const chunkSize = Math.ceil(nodeCount / workerCount);
        const workerPromises: Promise<Record<string, number>>[] = [];
        
        const workerRuntime = resolveWorkerRuntimePath(__dirname, 'workers/betweennessWorker.ts');
        const actualWorkerPath = workerRuntime.workerPath;
        const isTsNode = workerRuntime.isTsNode;

        if (!actualWorkerPath) {
            console.warn('[GraphMetrics] Worker script not found. Falling back to sequential calculation.');
            console.warn('[GraphMetrics] Checked paths:', workerRuntime.candidates);
            const sequentialResult = this.calculateBetweenness(graph);
            this.markComputeMode('sequential', nodeCount, edgeCount, startedAtMs, 'worker-script-unavailable');
            return sequentialResult;
        }

        for (let i = 0; i < workerCount; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, nodeCount);
            if (start >= nodeCount) break;

            const startNodeIds = allNodeIds.slice(start, end);

            const p = new Promise<Record<string, number>>((resolve, reject) => {
                const execArgv = isTsNode ? ['-r', require.resolve('ts-node/register')] : undefined;
                const worker = new Worker(actualWorkerPath, {
                    workerData: {
                        startNodeIds,
                        allNodeIds,
                        adj
                    },
                    execArgv
                });

                worker.on('message', (partialCB: Record<string, number>) => {
                    resolve(partialCB);
                });

                worker.on('error', (err) => {
                    console.error(`[GraphMetrics] Worker error:`, err);
                    reject(err);
                });

                worker.on('exit', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Worker stopped with exit code ${code}`));
                    }
                });
            });
            workerPromises.push(p);
        }

        try {
            const results = await Promise.all(workerPromises);
            
            const totalCB = new Map<string, number>();
            nodes.forEach(n => totalCB.set(n.id, 0));

            results.forEach(partial => {
                for (const [id, val] of Object.entries(partial)) {
                    totalCB.set(id, (totalCB.get(id) || 0) + val);
                }
            });

            this.markComputeMode('worker', nodeCount, edgeCount, startedAtMs, null);
            return totalCB;
        } catch (err) {
            console.error('[GraphMetrics] Parallel calculation failed, falling back to sequential.', err);
            const sequentialResult = this.calculateBetweenness(graph);
            this.markComputeMode('sequential', nodeCount, edgeCount, startedAtMs, 'worker-failure-fallback');
            return sequentialResult;
        }
    }

    /**
     * Calculates Betweenness Centrality for all nodes.
     * Brandes Algorithm (Unweighted).
     */
    static calculateBetweenness(graph: Graph): Map<string, number> {
        const nodes = graph.toJSON().nodes;
        const cb = new Map<string, number>();
        
        nodes.forEach(n => cb.set(n.id, 0));

        // For each node s, calculate dependencies
        nodes.forEach(sNode => {
            const s = sNode.id;
            const stack: string[] = [];
            const P = new Map<string, string[]>(); // Predecessors
            const sigma = new Map<string, number>(); // Number of shortest paths
            const d = new Map<string, number>(); // Distance

            // Init
            nodes.forEach(n => {
                P.set(n.id, []);
                sigma.set(n.id, 0);
                d.set(n.id, -1);
            });

            sigma.set(s, 1);
            d.set(s, 0);

            const Q: string[] = [s];

            while (Q.length > 0) {
                const v = Q.shift()!;
                stack.push(v);

                // Neighbors (Outgoing edges for directed graph?)
                // Betweenness usually considers flow. If directed, use outgoing.
                // However, knowledge graphs can be traversed both ways conceptually.
                // Let's stick to Directed for strict dependency.
                const neighbors = graph.getOutgoingEdges(v).map(e => e.target);

                for (const w of neighbors) {
                    // Path discovery
                    if (d.get(w) === -1) {
                        d.set(w, d.get(v)! + 1);
                        Q.push(w);
                    }
                    // Path counting
                    if (d.get(w) === d.get(v)! + 1) {
                        sigma.set(w, sigma.get(w)! + sigma.get(v)!);
                        P.get(w)!.push(v);
                    }
                }
            }

            const delta = new Map<string, number>();
            nodes.forEach(n => delta.set(n.id, 0));

            // Accumulation
            while (stack.length > 0) {
                const w = stack.pop()!;
                for (const v of P.get(w)!) {
                    delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
                }
                if (w !== s) {
                    cb.set(w, cb.get(w)! + delta.get(w)!);
                }
            }
        });

        // Normalize?
        // Standard betweenness is usually roughly O(N^2), so values can be large.
        // We will leave them raw, visualization can scale them.
        return cb;
    }
}
