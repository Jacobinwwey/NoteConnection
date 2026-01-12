/**
 * GPU Accelerated Forces for D3.js
 * Uses gpu.js to calculate forces in parallel.
 * Includes:
 * 1. GPUManyBodyForce: N-body repulsion
 * 2. GPULinkForce: Link attraction
 */

// Shared GPU Context Manager to avoid 16 context limit
const SharedGPU = {
    instance: null,
    
    getInstance() {
        if (this.instance) return this.instance;
        
        try {
            if (typeof GPU === 'undefined') {
                console.warn("[SharedGPU] GPU.js not loaded.");
                return null;
            }

            let GPUConstructor = null;
            if (typeof GPU === 'function') {
                GPUConstructor = GPU;
            } else if (typeof GPU === 'object' && GPU !== null && typeof GPU.GPU === 'function') {
                GPUConstructor = GPU.GPU;
            }

            if (!GPUConstructor) throw new Error("GPU constructor not found.");

            this.instance = new GPUConstructor();
            console.log("[SharedGPU] Initialized new GPU context.");
            return this.instance;
        } catch (e) {
            console.error("[SharedGPU] Failed to initialize:", e);
            return null;
        }
    }
};

class GPUManyBodyForce {
    constructor() {
        this.gpu = SharedGPU.getInstance();
        this.kernel = null;
        this.nodes = [];
        this.strengthVal = -300;
        this.available = !!this.gpu;
    }

    initialize(nodes) {
        this.nodes = nodes;
        if (!this.available) return;

        const n = nodes.length;
        console.log(`[GPUManyBody] Initializing for ${n} nodes.`);

        if (this.kernel) this.kernel.destroy();

        // Kernel: Calculate force on Node I from all Nodes J
        this.kernel = this.gpu.createKernel(function(posX, posY, strength, n) {
            let fx = 0;
            let fy = 0;
            const i = this.thread.x;
            const px = posX[i];
            const py = posY[i];
            
            for (let j = 0; j < n; j++) {
                if (i !== j) {
                    const dx = posX[j] - px;
                    const dy = posY[j] - py;
                    const distSq = dx * dx + dy * dy;
                    
                    // Simple Repulsion limit
                    const d2 = distSq < 1 ? 1 : distSq; 
                    
                    const f = strength / d2;
                    const dist = Math.sqrt(d2);
                    
                    fx += f * (dx / dist);
                    fy += f * (dy / dist);
                }
            }
            return [fx, fy];
        })
        .setOutput([n])
        .setPipeline(false)
        .setTactic('precision');
    }

    force(alpha) {
        if (!this.available || this.nodes.length === 0) return;

        const n = this.nodes.length;
        
        // Prepare arrays (reuse if possible in future optimization)
        const posX = new Float32Array(n);
        const posY = new Float32Array(n);
        
        for (let i = 0; i < n; i++) {
            posX[i] = this.nodes[i].x || 0;
            posY[i] = this.nodes[i].y || 0;
        }

        const s = this.strengthVal * alpha;

        // Re-init if size matched
        if (!this.kernel || this.kernel.output[0] !== n) {
            this.initialize(this.nodes);
        }

        const results = this.kernel(posX, posY, s, n);

        for (let i = 0; i < n; i++) {
            this.nodes[i].vx += results[i][0];
            this.nodes[i].vy += results[i][1];
        }
    }

    strength(x) {
        if (arguments.length) {
            this.strengthVal = typeof x === "function" ? x() : x; 
            return this;
        }
        return this.strengthVal;
    }
}

/**
 * GPU Link Force
 * Uses "Gather" approach: Each thread (Node) iterates its neighbor list to calculate spring forces.
 */
class GPULinkForce {
    constructor(links) {
        this.gpu = SharedGPU.getInstance();
        this._links = links || [];
        this.nodes = [];
        this.kernel = null;
        
        // Settings mimic D3
        this.distanceVal = 30; 
        this.strengthVal = null; // Default derived from degree usually
        this.iterationsVal = 1;
        
        this.available = !!this.gpu;
        
        // Adjacency Structures for GPU
        this.adjHead = [];
        this.adjCount = [];
        this.flatIndices = []; // Neighbors
        this.flatDistances = []; // Desired distances
        this.flatBias = []; // Bias for asymmetric links
    }

    initialize(nodes) {
        this.nodes = nodes;
        if (!this.available) return;
        
        const n = nodes.length;
        const nLinks = this._links.length;
        console.log(`[GPULink] Initializing for ${n} nodes, ${nLinks} links.`);
        
        if (n === 0) return;

        // Build Adjacency List (Source <-> Target)
        // D3 Link Force is symmetric: force acts on both ends.
        // We will process each link twice (once for source, once for target).
        // Or "Gather": Node A looks at all links connected to it.
        
        const adj = new Array(n).fill(0).map(() => []);
        const nodeIndex = new Map(nodes.map((d, i) => [d.id, i]));

        // Calculate degrees for default strength
        const count = new Array(n).fill(0);
        
        this._links.forEach(link => {
            // Unpack object references or string IDs
            const sourceId = (typeof link.source === 'object') ? link.source.id : link.source;
            const targetId = (typeof link.target === 'object') ? link.target.id : link.target;
            
            const u = nodeIndex.get(sourceId);
            const v = nodeIndex.get(targetId);
            
                if (u !== undefined && v !== undefined && u < n && v < n) {
                    count[u]++;
                    count[v]++;
                    // Ensure indices are numbers
                    adj[u].push({ neighbor: Number(v), index: Number(u) }); 
                    adj[v].push({ neighbor: Number(u), index: Number(v) });
                }
        });

        // Flatten
        this.adjHead = new Float32Array(n);
        this.adjCount = new Float32Array(n);
        
        const flatIndicesList = [];
        // Since we assume uniform distance for now (or per-link), we'll simplify.
        // For per-link customization, we'd need to store link-specific props.
        // Assuming global distance for performance v1.
        
        let cursor = 0;
        for (let i = 0; i < n; i++) {
            this.adjHead[i] = cursor;
            this.adjCount[i] = adj[i].length;
            
            for (let k = 0; k < adj[i].length; k++) {
                flatIndicesList.push(adj[i][k].neighbor);
            }
            cursor += adj[i].length;
        }
        
        this.flatIndices = new Float32Array(flatIndicesList);
        
        // Debug Adjacency
        if (n > 0) {
            console.log(`[GPULink] Adjacency Sample (Node 0): Head=${this.adjHead[0]}, Count=${this.adjCount[0]}`);
            if (this.adjCount[0] > 0) {
                 console.log(`[GPULink] Node 0 Neighbors:`, flatIndicesList.slice(this.adjHead[0], this.adjHead[0] + this.adjCount[0]));
            }
        }
        
        // Limit max neighbors width for texture if needed? 
        // gpu.js handles 1D arrays well.
        
        if (this.kernel) this.kernel.destroy();

        // ---------------------------------------------------------
        // KERNEL
        // ---------------------------------------------------------
        this.kernel = this.gpu.createKernel(function(posX, posY, adjHead, adjCount, flatIndices, targetDist, alpha, strengthConfig) {
            const i = this.thread.x;
            
            const start = adjHead[i];
            const count = adjCount[i];
            
            if (count === 0) return [0, 0];
            
            const px = posX[i];
            const py = posY[i];
            
            let fx = 0;
            let fy = 0;
            
            // Standard D3 bias logic is complicated to port fully (1 / degree).
            // We use simplified uniform strength for optimization.
            // force = (dist - targetDist) * strength * alpha
            
            // Iterate Neighbors
            for (let k = 0; k < count; k++) {
                // gpu.js limitation: Array access needs constant or loop var
                // We use flat array trick
                // flatIndices[start + k]
                
                // Explicit integer casting for texture lookups
                const idxRef = start + k;
                const nIdx = flatIndices[idxRef];
                
                const nx = posX[nIdx];
                const ny = posY[nIdx];
                
                let dx = nx - px + 0.0001; // Avoid divide by zero
                let dy = ny - py + 0.0001; 
                
                // If zero length
                // if (dx === 0 && dy === 0) { dx = (Math.random() - 0.5) * 1e-6; }
                
                const l = Math.sqrt(dx * dx + dy * dy);
                // Extra check for l > 0 just in case
                const safeL = l < 0.0001 ? 0.0001 : l;
                
                const l2 = (safeL - targetDist) / safeL * alpha * strengthConfig;
                
                const x = dx * l2;
                const y = dy * l2;
                
                // ...
                fx += x;
                fy += y;
            }
            
            // Bias: In D3, each end gets weighted by degree.
            // Here each node gathers, so we effectively apply 100% of the calculated force from its perspective.
            // For correct "bias", we'd need to weight by 1 / degree?
            // D3 default bias = 1 / (count[u] + count[v]).
            // Simplifying to 1/degree(u) usually approximates it fast.
            // Or just use a lower global strength.
            
            // We'll normalize by count to stabilize? 
            // D3 Link Strength default is: 1 / Math.min(count[u], count[v])
            
            return [fx, fy];
        })
        .setOutput([n])
        .setTactic('precision');
    }

    force(alpha) {
        if (!this.available || this.nodes.length === 0) return;
        
        const n = this.nodes.length;
        const posX = new Float32Array(n);
        const posY = new Float32Array(n);
        
        for (let i = 0; i < n; i++) {
            posX[i] = this.nodes[i].x || 0;
            posY[i] = this.nodes[i].y || 0;
        }
        
        // Re-init check
        if (!this.kernel || this.kernel.output[0] !== n) {
            this.initialize(this.nodes);
        }
        
        // Run Kernel
        // strength param: we pass global strength. 
        // D3 strength is usually function. We approximate with constant.
        const strength = this.strengthVal ? (typeof this.strengthVal === 'function' ? 0.3 : this.strengthVal) : 0.3; 
        
        const results = this.kernel(
            posX, 
            posY, 
            this.adjHead, 
            this.adjCount, 
            this.flatIndices, 
            Number(this.distanceVal), 
            Number(alpha),
            Number(strength)
        );
        
        // Default Bias approximation: 0.5 (Assume symmetric contribution)
        // Or weight by degree. Since we summed forces, we just add them.
        const k = 0.5; 
        
        // Debug first result occasionally
        if (Math.random() < 0.01) {
            console.log(`[GPULink] Sample Force Node 0: [${results[0][0]}, ${results[0][1]}]`);
        }

        const MAX_VELOCITY = 100; // Cap velocity to prevent explosion

        for (let i = 0; i < n; i++) {
            const res = results[i];
            if (!res) continue;

            const rx = res[0];
            const ry = res[1];
            
            // Critical NaN Guard & Velocity Clamping
            if (isFinite(rx) && isFinite(ry)) {
                // Add GPU force
                this.nodes[i].vx += rx * k;
                this.nodes[i].vy += ry * k;
                
                // Clamp absolute velocity to prevent "disappearing" to infinity
                // (Simple separate axis clamp or magnitude clamp)
                if (this.nodes[i].vx > MAX_VELOCITY) this.nodes[i].vx = MAX_VELOCITY;
                else if (this.nodes[i].vx < -MAX_VELOCITY) this.nodes[i].vx = -MAX_VELOCITY;
                
                if (this.nodes[i].vy > MAX_VELOCITY) this.nodes[i].vy = MAX_VELOCITY;
                else if (this.nodes[i].vy < -MAX_VELOCITY) this.nodes[i].vy = -MAX_VELOCITY;
            }
        }
    }
    
    // D3 API Shims
    links(l) {
        if (!arguments.length) return this._links;
        this._links = l;
        return this;
    }
    
    id(f) {
        // id accessor, assumed default
        return this;
    }
    
    distance(d) {
        if (!arguments.length) return this.distanceVal;
        this.distanceVal = typeof d === 'function' ? 100 : d; // Simplified
        return this;
    }
    
    strength(s) {
        if (!arguments.length) return this.strengthVal;
        this.strengthVal = s;
        return this;
    }
}

// ------------------------------------------------
// Exports
// ------------------------------------------------

let _gpuManyBodyInstance = null;
window.gpuManyBody = function() {
    if (_gpuManyBodyInstance) return _gpuManyBodyInstance;

    const force = new GPUManyBodyForce();
    
    function impl(alpha) {
        force.force(alpha);
    }
    impl.initialize = function(nodes) { force.initialize(nodes); };
    impl.strength = function(x) { 
        if (!arguments.length) return force.strength();
        force.strength(x); 
        return impl; 
    };
    impl.isAvailable = function() { return force.available; };

    _gpuManyBodyInstance = impl;
    return impl;
};

let _gpuLinkInstance = null;
window.gpuLink = function(links) {
    // If instance exists, we might want to update links?
    // D3 creates new forces. We should act like a factory but maybe reuse internals?
    // For now, new instance to match D3 pattern, but reuse GPU context.
    
    const force = new GPULinkForce(links);
    
    function impl(alpha) {
        force.force(alpha);
    }
    
    impl.initialize = function(nodes) { force.initialize(nodes); };
    impl.links = function(l) { 
        if (!arguments.length) return force.links();
        force.links(l); 
        return impl; 
    };
    impl.id = function(f) { return impl; }; // No-op
    impl.distance = function(d) {
        if (!arguments.length) return force.distance();
        force.distance(d);
        return impl;
    };
    impl.strength = function(s) {
        if (!arguments.length) return force.strength();
        force.strength(s);
        return impl;
    };
    impl.isAvailable = function() { return force.available; };
    
    return impl;
};
