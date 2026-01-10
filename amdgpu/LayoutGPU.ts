import { RawFile } from '../src/backend/FileLoader';
import { PerformanceLogger } from '../src/backend/utils/PerformanceLogger';
import { NoteNode, NoteEdge } from '../src/core/types';

export class LayoutGPU {
    private gpu: any;

    constructor() {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { GPU } = require('gpu.js');
            this.gpu = new GPU();
        } catch (e) {
            console.warn('[LayoutGPU] GPU.js not available. Falling back to CPU.');
            this.gpu = null;
        }
    }

    public isAvailable(): boolean {
        return !!this.gpu;
    }

    /**
     * Compute layout positions using GPU for Repulsion (N^2)
     * Attraction is done on CPU for simplicity (O(E) is fast).
     */
    public compute(nodes: NoteNode[], edges: NoteEdge[], options: any = {}): Map<string, {x: number, y: number}> {
        if (!this.gpu) throw new Error("GPU not available");

        const numNodes = nodes.length;
        const width = options.width || 800;
        const height = options.height || 600;
        const iterations = options.iterations || 300;
        const repulsionStrength = options.repulsion || -550;
        const linkDistance = options.distance || 100;
        const gravity = 0.1;

        console.log(`[LayoutGPU] Starting Layout Calculation for ${numNodes} nodes on GPU...`);
        PerformanceLogger.start('GPU Layout Calculation');

        // 1. Initialize positions (Random)
        let positionsX = new Float32Array(numNodes);
        let positionsY = new Float32Array(numNodes);
        
        // Map ID to Index
        const idToIndex = new Map<string, number>();
        nodes.forEach((n, i) => {
            idToIndex.set(n.id, i);
            positionsX[i] = n.x || (Math.random() * width);
            positionsY[i] = n.y || (Math.random() * height);
        });

        // 2. Compile Repulsion Kernel (O(N^2))
        // Calculates force on Node I from all Nodes J
        const repulsionKernel = this.gpu.createKernel(function(this: { thread: { x: number }, constants: { size: number } }, posX: number[], posY: number[], strength: number, k: number) {
            let fx = 0;
            let fy = 0;
            const px = posX[this.thread.x];
            const py = posY[this.thread.x];
            
            for (let j = 0; j < this.constants.size; j++) {
                if (j !== this.thread.x) {
                    const dx = px - posX[j];
                    const dy = py - posY[j];
                    const distSq = dx * dx + dy * dy;
                    // Avoid zero division and extreme forces
                    const dist = Math.sqrt(distSq) + 0.1;
                    
                    // Force = strength / distSq (Coulomb-like)
                    // Or D3 style: strength * alpha / distSq?
                    // Simplified: strength / dist
                    // D3 manyBody: strength * weight / distSq
                    // We assume weight=1
                    const f = strength / (distSq + 1); // +1 to dampen
                    
                    fx += f * dx / dist;
                    fy += f * dy / dist;
                }
            }
            return [fx, fy];
        })
        .setConstants({ size: numNodes })
        .setOutput([numNodes]);

        // 3. Pre-process edges for CPU attraction
        const linkIndices = edges.map(e => {
            return {
                source: idToIndex.get(e.source)!,
                target: idToIndex.get(e.target)!
            };
        }).filter(l => l.source !== undefined && l.target !== undefined);

        // 4. Simulation Loop
        // Velocity damping
        const velocityDecay = 0.6;
        let velocitiesX = new Float32Array(numNodes).fill(0);
        let velocitiesY = new Float32Array(numNodes).fill(0);

        for (let i = 0; i < iterations; i++) {
            // Alpha decay (Temperature)
            const alpha = 1 - (i / iterations);
            if (alpha < 0.01) break;

            // A. GPU Repulsion
            // Input: Current positions
            // Output: Array of [fx, fy]
            // Note: gpu.js input needs to be JS array or Float32Array? 
            // gpu.js usually accepts Array-like.
            // Converting Float32Array to Array might be slow. GPU.js supports Float32Array input in some modes.
            // For safety, let's cast if needed or rely on GPU.js support.
            // Using Array.from is slow. Let's try passing TypedArray directly.
            
            // To avoid texture overhead every frame, we might pipeline? 
            // For now, simple readback.
            const repulsionForces = repulsionKernel(
                // @ts-ignore
                positionsX, positionsY, repulsionStrength, alpha
            ) as [number, number][];

            // B. CPU Attraction + Update
            for (let n = 0; n < numNodes; n++) {
                let fx = repulsionForces[n][0] * alpha;
                let fy = repulsionForces[n][1] * alpha;

                // Center Gravity
                fx += (width / 2 - positionsX[n]) * gravity * alpha;
                fy += (height / 2 - positionsY[n]) * gravity * alpha;

                // Store in temp vars to not mutate inplace while iterating edges? 
                // Actually we sum forces first.
                velocitiesX[n] += fx;
                velocitiesY[n] += fy;
            }

            // Attraction (Edges)
            // Hooke's Law: k * (dist - targetDist)
            // Or D3 forceLink: bias * (dist - targetDist)
            for (const l of linkIndices) {
                const s = l.source;
                const t = l.target;
                const dx = positionsX[t] - positionsX[s];
                const dy = positionsY[t] - positionsY[s];
                const dist = Math.sqrt(dx*dx + dy*dy) + 0.1;
                
                const diff = (dist - linkDistance) / dist * alpha * 0.5; // Strength 0.5
                
                const fx = dx * diff;
                const fy = dy * diff;

                velocitiesX[s] += fx;
                velocitiesY[s] += fy;
                velocitiesX[t] -= fx;
                velocitiesY[t] -= fy;
            }

            // Update Positions
            for (let n = 0; n < numNodes; n++) {
                velocitiesX[n] *= velocityDecay;
                velocitiesY[n] *= velocityDecay;
                
                positionsX[n] += velocitiesX[n];
                positionsY[n] += velocitiesY[n];
            }
        }

        PerformanceLogger.end('GPU Layout Calculation');
        repulsionKernel.destroy();

        // Map back to result
        const result = new Map<string, {x: number, y: number}>();
        nodes.forEach((n, i) => {
            result.set(n.id, { x: positionsX[i], y: positionsY[i] });
        });

        return result;
    }
    
    public destroy() {
        if (this.gpu) this.gpu.destroy();
    }
}
