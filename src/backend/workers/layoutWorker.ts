import { parentPort, workerData } from 'worker_threads';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

// Data types
interface SimulationNode {
    id: string;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    inDegree?: number;
    outDegree?: number;
}

interface SimulationLink {
    source: string | SimulationNode;
    target: string | SimulationNode;
}

const runSimulation = () => {
    try {
        const { nodes, edges, config } = workerData;
        
        console.log(`[LayoutWorker] Starting simulation for ${nodes.length} nodes and ${edges.length} edges...`);

        // Create simulation objects (d3 mutates them)
        // We need to map edges to use references or IDs? 
        // d3-force requires references or id access.
        
        const simNodes: SimulationNode[] = nodes.map((n: any) => ({
            id: n.id,
            x: Math.random() * 800, // Initial random position
            y: Math.random() * 600,
            inDegree: n.inDegree,
            outDegree: n.outDegree
        }));
        
        const nodeMap = new Map(simNodes.map(n => [n.id, n]));
        
        const simLinks = edges.map((e: any) => ({
            source: nodeMap.get(e.source),
            target: nodeMap.get(e.target)
        })).filter((l: any) => l.source && l.target);

        // Configure Simulation
        // Default Settings matching Frontend
        const repulsion = config?.repulsion || -550;
        const distance = config?.distance || 100;
        
        const simulation = forceSimulation(simNodes)
            .force("link", forceLink(simLinks).id((d: any) => d.id).distance(distance))
            .force("charge", forceManyBody().strength(repulsion))
            .force("center", forceCenter(400, 300)) // Assuming 800x600 canvas base
            .force("collide", forceCollide().radius((d: any) => {
                 // Simple size approximation based on degree
                 const deg = (d.inDegree || 0) + (d.outDegree || 0);
                 return Math.min(12, Math.max(5, Math.sqrt(deg) * 3)) + 5;
            }))
            .stop();

        // Run Simulation
        // We run a fixed number of ticks or until alpha is low
        const ticks = 300;
        for (let i = 0; i < ticks; ++i) {
            simulation.tick();
        }

        // Extract positions
        const positions = new Map<string, {x: number, y: number}>();
        simNodes.forEach(n => {
            positions.set(n.id, { x: n.x || 0, y: n.y || 0 });
        });

        console.log(`[LayoutWorker] Simulation complete.`);
        
        if (parentPort) {
            parentPort.postMessage(positions);
        }

    } catch (error) {
        console.error('[LayoutWorker] Error:', error);
        if (parentPort) parentPort.postMessage(new Map());
    }
};

runSimulation();
