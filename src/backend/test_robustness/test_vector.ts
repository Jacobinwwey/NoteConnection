import * as path from 'path';
import { FileLoader } from '../FileLoader';
import { VectorSpace } from '../algorithms/VectorSpace';

async function run() {
    const root = path.resolve(__dirname, '../../../testconcept');
    console.log(`Loading files from: ${root}`);
    
    const files = await FileLoader.loadFiles(root);
    console.log(`Loaded ${files.length} files.`);

    const vectorSpace = new VectorSpace(files);
    console.log('Vector Space built.');

    // Test a specific file
    const testFile = files[0].filename; // e.g. "Absorption"
    console.log(`Finding similarities for: [${testFile}]`);
    
    const similar = vectorSpace.getSimilar(testFile, 5);
    similar.forEach(res => {
        console.log(` -> [${res.id}] Score: ${res.score.toFixed(4)}`);
    });
}

run().catch(e => console.error(e));