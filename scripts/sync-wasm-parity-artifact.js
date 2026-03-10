#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const artifactName = 'noteconnection_compute.wasm';
const sourceArtifact = path.join(repoRoot, 'src', 'backend', 'wasm', artifactName);
const distArtifact = path.join(repoRoot, 'dist', 'src', 'backend', 'wasm', artifactName);

function main() {
    if (!fs.existsSync(sourceArtifact)) {
        console.log('[WASM Sync] Source artifact missing. Skipping sync:', sourceArtifact);
        return;
    }
    fs.mkdirSync(path.dirname(distArtifact), { recursive: true });
    fs.copyFileSync(sourceArtifact, distArtifact);
    console.log('[WASM Sync] Artifact copied to dist:', distArtifact);
}

try {
    main();
} catch (error) {
    console.error('[WASM Sync] Failed:', error);
    process.exitCode = 1;
}
