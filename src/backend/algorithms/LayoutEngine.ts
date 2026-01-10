import { Graph } from '../../core/Graph';
import { Worker } from 'worker_threads';
import * as path from 'path';
import { PerformanceLogger } from '../utils/PerformanceLogger';

export class LayoutEngine {
    static async computeLayout(graph: Graph, config?: any): Promise<void> {
        PerformanceLogger.start('Backend Layout Calculation');
        
        const nodes = graph.getNodes();
        const edges = graph.getEdges();

        // If graph is too small, maybe skip? But consistency is good.
        
        const workerPath = path.join(__dirname, '..', 'workers', 'layoutWorker.ts');
        const isTsNode = path.extname(__filename) === '.ts';
        const actualWorkerPath = isTsNode 
            ? workerPath 
            : workerPath.replace('.ts', '.js');
        
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
