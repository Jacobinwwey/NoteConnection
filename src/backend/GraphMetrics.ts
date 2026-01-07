import { Graph } from '../core/Graph';
import { NoteNode } from '../core/types';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';
import { config } from './config';

export class GraphMetrics {
    /**
     * Calculates Betweenness Centrality for all nodes (Parallel Version).
     * Uses Worker threads to distribute the Brandes Algorithm.
     * 计算所有节点的介数中心性（并行版本）。
     * 使用 Worker 线程分发 Brandes 算法。
     */
    static async calculateBetweennessAsync(graph: Graph): Promise<Map<string, number>> {
        const nodes = graph.toJSON().nodes;
        const allNodeIds = nodes.map(n => n.id);
        const nodeCount = nodes.length;

        // Create a lightweight adjacency list for workers
        // 为 Workers 创建轻量级邻接表
        const adj: Record<string, string[]> = {};
        nodes.forEach(n => {
            adj[n.id] = graph.getOutgoingEdges(n.id).map(e => e.target);
        });

        // Determine worker count
        const numCPUs = os.cpus().length;
        const workerCount = config.maxWorkers ?? Math.max(1, numCPUs - 1);
        
        // Threshold for parallelization
        // 并行化阈值
        if (nodeCount < 500) {
            return this.calculateBetweenness(graph);
        }

        console.log(`[GraphMetrics] Starting Parallel Betweenness Centrality with ${workerCount} workers...`);

        const chunkSize = Math.ceil(nodeCount / workerCount);
        const workerPromises: Promise<Record<string, number>>[] = [];
        
        // Resolve worker path
        const workerPath = path.join(__dirname, 'workers', 'betweennessWorker.ts');
        const isTsNode = path.extname(__filename) === '.ts';
        const actualWorkerPath = isTsNode 
            ? workerPath 
            : workerPath.replace('.ts', '.js');

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
            
            // Merge results
            // 合并结果
            const totalCB = new Map<string, number>();
            nodes.forEach(n => totalCB.set(n.id, 0));

            results.forEach(partial => {
                for (const [id, val] of Object.entries(partial)) {
                    totalCB.set(id, (totalCB.get(id) || 0) + val);
                }
            });

            return totalCB;
        } catch (err) {
            console.error('[GraphMetrics] Parallel calculation failed, falling back to sequential.', err);
            return this.calculateBetweenness(graph);
        }
    }

    /**
     * Calculates Betweenness Centrality for all nodes.
     * Brandes Algorithm (Unweighted).
     */
    static calculateBetweenness(graph: Graph): Map<string, number> {
        const nodes = graph.toJSON().nodes;
        const cb = new Map<string, number>();
        
        // Initialize
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
