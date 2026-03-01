import { Graph } from '../../core/Graph';
import { Worker } from 'worker_threads';
import { PerformanceLogger } from '../utils/PerformanceLogger';
import { resolveWorkerRuntimePath } from '../utils/WorkerRuntime';

export class LayoutEngine {
    static async computeLayout(graph: Graph, config?: any): Promise<void> {
        PerformanceLogger.start('Backend Layout Calculation');
        
        const nodes = graph.getNodes();
        const edges = graph.getEdges();

        // If graph is too small, maybe skip? But consistency is good.
        
        const workerRuntime = resolveWorkerRuntimePath(__dirname, '../workers/layoutWorker.ts');
        const actualWorkerPath = workerRuntime.workerPath;
        const isTsNode = workerRuntime.isTsNode;

        if (!actualWorkerPath) {
            console.warn('[LayoutEngine] Layout worker not found. Skipping backend layout calculation.');
            console.warn('[LayoutEngine] Checked paths:', workerRuntime.candidates);
            PerformanceLogger.end('Backend Layout Calculation');
            return Promise.resolve();
        }
        
        console.log(`[LayoutEngine] Spawning layout worker: ${actualWorkerPath}`);

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
                    PerformanceLogger.end('Backend Layout Calculation');
                    return Promise.resolve();
                }
            } catch (e) {
                console.warn('[LayoutEngine] GPU Layout failed or not found. Falling back to Worker.', e);
            }
        }

        // pkg runtime + d3-force ESM can fail inside worker_threads.
        // Skip backend layout instead of surfacing a hard runtime error.
        if ((process as any).pkg) {
            console.warn('[LayoutEngine] Skipping layout worker in pkg runtime (ESM worker limitation).');
            PerformanceLogger.end('Backend Layout Calculation');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const worker = new Worker(actualWorkerPath, {
                workerData: {
                    nodes: nodes,
                    edges: edges,
                    config: config
                },
                execArgv: isTsNode ? ['-r', require.resolve('ts-node/register')] : undefined
            });

            worker.on('message', (positions: Map<string, {x: number, y: number}>) => {
                // Update graph nodes with computed positions
                positions.forEach((pos, id) => {
                    const node = graph.getNode(id);
                    if (node) {
                        node.x = pos.x;
                        node.y = pos.y;
                        // Mark as fixed? Frontend handles "Static" mode.
                        // But we populate x/y so frontend can use them as initial positions.
                    }
                });
                PerformanceLogger.end('Backend Layout Calculation');
                resolve();
            });

            worker.on('error', (err) => {
                console.error('[LayoutEngine] Worker failed:', err);
                PerformanceLogger.end('Backend Layout Calculation');
                // Don't fail the whole build, just log
                resolve(); 
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`[LayoutEngine] Worker exited with code ${code}`);
                    resolve();
                }
            });
        });
    }
}
