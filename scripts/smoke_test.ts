
import { NoteConnection } from '../src/core/NoteConnection';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function runSmokeTest() {
    console.log('--- Starting NoteConnection v1.0.0 Smoke Test ---');

    // 1. Setup Mock Data
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-smoke-test-'));
    console.log(`[Setup] Created temp dir: ${tmpDir}`);

    try {
        const fileA = path.join(tmpDir, 'Concept A.md');
        const fileB = path.join(tmpDir, 'Concept B.md');
        const fileC = path.join(tmpDir, 'Concept C.md');

        // A -> B (Explicit)
        // B -> C (Keyword)
        fs.writeFileSync(fileA, '---\nnext: [[Concept B]]\n---\n# Concept A\nThis is the start.');
        fs.writeFileSync(fileB, '# Concept B\nThis refers to Concept C in text.');
        fs.writeFileSync(fileC, '# Concept C\nEnd of chain.');

        // 2. Run Build
        console.log('[Action] Building Graph...');
        const result = await NoteConnection.build({
            targetPath: tmpDir,
            maxWorkers: 2,
            enableGPU: false,
            projectRoot: process.cwd()
        });

        // 3. Verification
        console.log('[Verification] Checking results...');
        const { graph, stats } = result;

        console.log(`- Nodes: ${stats.nodeCount} (Expected: 3)`);
        console.log(`- Edges: ${stats.edgeCount} (Expected: >= 2)`);

        if (stats.nodeCount !== 3) throw new Error(`Node count mismatch. Got ${stats.nodeCount}`);
        
        // Verify Edge A -> B (Explicit Next)
        const hasNextB = graph.getOutgoingEdges('Concept A').some(e => e.target === 'Concept B');
        console.log(`- Edge A->B (Explicit Next): ${hasNextB ? 'PASS' : 'FAIL'}`);
        if (!hasNextB) throw new Error('Missing explicit edge A->B');

        // Verify Edge C -> B (Keyword Match: Concept C is mentioned in Concept B, so C -> B)
        const hasKeywordC = graph.getOutgoingEdges('Concept C').some(e => e.target === 'Concept B');
        console.log(`- Edge C->B (Keyword Match): ${hasKeywordC ? 'PASS' : 'FAIL'}`);
        if (!hasKeywordC) throw new Error('Missing keyword edge C->B (Expectation: Referenced -> Referencer)');

        console.log('--- Smoke Test Passed Successfully ---');
        process.exit(0);

    } catch (err) {
        console.error('--- Smoke Test FAILED ---');
        console.error(err);
        process.exit(1);
    } finally {
        // Cleanup
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
            console.log(`[Cleanup] Removed temp dir.`);
        } catch (e) {
            console.error('[Cleanup] Failed to remove temp dir');
        }
    }
}

runSmokeTest();
