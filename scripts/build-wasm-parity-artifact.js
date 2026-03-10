#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const crateRoot = path.resolve(repoRoot, 'src', 'backend', 'wasm');
const manifestPath = path.join(crateRoot, 'Cargo.toml');
const targetTriple = 'wasm32-unknown-unknown';
const artifactName = 'noteconnection_compute.wasm';
const cargoArtifact = path.join(
    crateRoot,
    'target',
    targetTriple,
    'release',
    artifactName
);
const sourceArtifact = path.join(crateRoot, artifactName);
const distArtifact = path.join(repoRoot, 'dist', 'src', 'backend', 'wasm', artifactName);

function runCommand(command, args) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: false
    });
    if (result.status !== 0) {
        throw new Error(`[WASM Build] Command failed: ${command} ${args.join(' ')}`);
    }
}

function copyArtifact(from, to) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
}

function main() {
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`[WASM Build] Missing manifest: ${manifestPath}`);
    }

    console.log('[WASM Build] Building parity artifact via cargo...');
    runCommand('cargo', [
        'build',
        '--manifest-path',
        manifestPath,
        '--target',
        targetTriple,
        '--release'
    ]);

    if (!fs.existsSync(cargoArtifact)) {
        throw new Error(`[WASM Build] Expected artifact not found: ${cargoArtifact}`);
    }

    copyArtifact(cargoArtifact, sourceArtifact);
    console.log('[WASM Build] Source artifact provisioned:', sourceArtifact);

    if (fs.existsSync(path.dirname(distArtifact))) {
        copyArtifact(cargoArtifact, distArtifact);
        console.log('[WASM Build] Dist artifact synchronized:', distArtifact);
    } else {
        console.log('[WASM Build] Dist folder not found. Skipped dist sync.');
    }
}

try {
    main();
} catch (error) {
    console.error('[WASM Build] Failed:', error);
    process.exitCode = 1;
}
