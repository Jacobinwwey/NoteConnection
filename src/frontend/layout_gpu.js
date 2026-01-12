/**
 * GPU Accelerated Many-Body Force for D3.js
 * Uses gpu.js to calculate N-body repulsion in parallel.
 */
class GPUManyBodyForce {
    constructor() {
        this.gpu = null;
        this.kernel = null;
        this.nodes = [];
        this.strengthVal = -300;
        this.distanceMin2 = 1;
        this.distanceMax2 = Infinity;
        this.theta2 = 0.81;
        
        // Check availability
        try {
            if (typeof GPU === 'undefined') {
                console.warn("[GPU Force] GPU.js not loaded.");
                this.available = false;
            } else {
                this.gpu = new GPU();
                this.available = true;
            }
        } catch (e) {
            console.error("[GPU Force] Error initializing GPU:", e);
            this.available = false;
        }
    }

    initialize(nodes) {
        this.nodes = nodes;
        if (!this.available) return;

        const n = nodes.length;
        console.log(`[GPU Force] Initializing for ${n} nodes.`);

        // Destroy old kernel if exists
        if (this.kernel) {
            this.kernel.destroy();
        }

        // Create Kernel
        // Calculates force on Node I from all Nodes J
        this.kernel = this.gpu.createKernel(function(posX, posY, strength, n) {
            let fx = 0;
            let fy = 0;
            const i = this.thread.x;
            const px = posX[i];
            const py = posY[i];
            
            for (let j = 0; j < n; j++) {
                if (i !== j) {
                    const dx = posX[j] - px; // vector to other
                    const dy = posY[j] - py;
                    const distSq = dx * dx + dy * dy;
                    
                    // Simple Repulsion: strength / distSq
                    // Limit distance to avoid infinity
                    const d2 = distSq < 1 ? 1 : distSq; 
                    
                    // Force Magnitude
                    // D3 manybody uses: strength * alpha / distSq
                    // We apply alpha outside or pass it in. 
                    // Let's assume strength is pre-multiplied by alpha or we multiply output.
                    const f = strength / d2;
                    
                    const dist = Math.sqrt(d2);
                    fx += f * (dx / dist); // x component
                    fy += f * (dy / dist); // y component
                }
            }
            return [fx, fy];
        })
        .setConstants({ size: n }) // If we could use constants, but n varies? 
        // Actually map n as argument is safer if node count changes (filter).
        // But for dynamic sizes, output size needs to change.
        .setOutput([n])
        .setPipeline(false) // Read back result
        .setTactic('precision'); // Use high precision
    }

    force(alpha) {
        if (!this.available || this.nodes.length === 0) return;

        // Prepare data
        // Extract x/y arrays. Float32Array is faster.
        const n = this.nodes.length;
        const posX = new Float32Array(n);
        const posY = new Float32Array(n);
        
        for (let i = 0; i < n; i++) {
            posX[i] = this.nodes[i].x;
            posY[i] = this.nodes[i].y;
        }

        // Strength modulated by alpha (standard D3 behavior)
        // D3: node.vx += force * alpha
        const s = this.strengthVal * alpha;

        // Execute Kernel
        // Re-initialize if size changed drastically? 
        // gpu.js output size is fixed at creation. 
        // We need to re-create kernel if N changes.
        if (this.kernel.output[0] !== n) {
            this.initialize(this.nodes);
        }

        const results = this.kernel(posX, posY, s, n);

        // Apply results back to velocity
        for (let i = 0; i < n; i++) {
            this.nodes[i].vx += results[i][0]; // Kernel returns force, we add to velocity
            this.nodes[i].vy += results[i][1];
        }
    }

    strength(x) {
        if (arguments.length) {
            this.strengthVal = typeof x === "function" ? x() : x; // Only support constant for now
            return this;
        }
        return this.strengthVal;
    }
}

// Expose factory
window.gpuManyBody = function() {
    const force = new GPUManyBodyForce();
    
    function impl(alpha) {
        force.force(alpha);
    }

    impl.initialize = function(nodes) {
        force.initialize(nodes);
    };

    impl.strength = function(x) {
        return force.strength(x);
    };

    return impl;
};
