import * as path from 'path';
import { FileLoader } from '../FileLoader';
import { StatisticalAnalyzer } from '../algorithms/StatisticalAnalyzer';

async function run() {
    const root = path.resolve(__dirname, '../../../testconcept');
    console.log(`Loading files from: ${root}`);
    
    const files = await FileLoader.loadFiles(root);
    console.log(`Loaded ${files.length} files.`);

    const terms = files.map(f => f.filename);
    console.log(`Analyzing ${terms.length} terms...`);

    const matrix = StatisticalAnalyzer.analyze(files, terms);
    
    // Low thresholds for demonstration on small dataset
    const minSupport = 0.05; 
    const asymmetry = 0.1;

    console.log(`Inferring dependencies (Min Support: ${minSupport}, Asymmetry: ${asymmetry})...`);
    const deps = StatisticalAnalyzer.inferDependencies(matrix, minSupport, asymmetry);

    console.log(`Inferred ${deps.length} dependencies.`);
    console.log('Top 20 Suggestions:');
    deps.slice(0, 20).forEach(d => {
        console.log(`[${d.source}] -> [${d.target}] (Conf: ${d.confidence.toFixed(2)}, Jaccard: ${d.weight.toFixed(2)})`);
    });
}

run().catch(e => console.error(e));