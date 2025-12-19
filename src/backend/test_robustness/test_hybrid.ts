import * as path from 'path';
import { FileLoader } from '../FileLoader';
import { StatisticalAnalyzer } from '../algorithms/StatisticalAnalyzer';
import { VectorSpace } from '../algorithms/VectorSpace';
import { HybridEngine } from '../algorithms/HybridEngine';

async function run() {
    const root = path.resolve(__dirname, '../../../testconcept');
    console.log(`Loading files from: ${root}`);
    
    const files = await FileLoader.loadFiles(root);
    console.log(`Loaded ${files.length} files.`);
    const terms = files.map(f => f.filename);

    console.log('Building Statistical Matrix...');
    const matrix = StatisticalAnalyzer.analyze(files, terms);

    console.log('Building Vector Space...');
    const vectorSpace = new VectorSpace(files);

    console.log('Running Hybrid Inference...');
    const edges = HybridEngine.infer(matrix, vectorSpace, 0.2, 0.1);

    console.log(`Inferred ${edges.length} hybrid edges.`);
    console.log('Top 20 Suggestions:');
    edges.slice(0, 20).forEach(d => {
        console.log(`[${d.source}] -> [${d.target}] (Conf: ${d.confidence.toFixed(2)}, Weight: ${d.weight.toFixed(2)})`);
        console.log(`   Reason: ${d.reason}`);
    });
}

run().catch(e => console.error(e));