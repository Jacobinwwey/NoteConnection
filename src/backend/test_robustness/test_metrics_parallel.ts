import * as path from 'path';
import { FileLoader } from '../FileLoader';
import { GraphBuilder } from '../GraphBuilder';
import { PerformanceLogger } from '../utils/PerformanceLogger';
import { config } from '../config';

async function run() {
    const root = path.resolve(__dirname, '../../../Knowledge_Base/testconcept');
    console.log(`Loading files from: ${root}`);
    
    const files = await FileLoader.loadFiles(root);
    console.log(`Loaded ${files.length} files.`);
    
    // Ensure parallelization is triggered
    config.maxWorkers = 4;
    console.log(`Forced maxWorkers to ${config.maxWorkers}`);

    console.log('Building Graph (Full Pipeline)...');
    PerformanceLogger.start('Total Build');
    const graph = await GraphBuilder.build(files);
    PerformanceLogger.end('Total Build');
    
    const nodes = graph.getNodes();
    console.log(`Graph built: ${nodes.length} nodes.`);
    
    // Check if centrality is populated
    const sampleNodes = nodes.slice(0, 5);
    sampleNodes.forEach(node => {
        console.log(`Node [${node.id}] Centrality: ${node.centrality}`);
        if (node.centrality === undefined) {
            throw new Error(`Centrality for node ${node.id} was not calculated!`);
        }
    });

    console.log('Test Passed: Graph Metrics calculated successfully.');
}

run().catch(e => {
    console.error('Test Failed:', e);
    process.exit(1);
});
