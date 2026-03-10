#!/usr/bin/env node
'use strict';

require('ts-node/register/transpile-only');

const fs = require('fs');
const path = require('path');
const {
    probeWasmParityArtifact
} = require('../src/backend/algorithms/WasmParityArtifactProbe');

function parseArgs(argv) {
    const parsed = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token || !token.startsWith('--')) {
            continue;
        }
        const key = token.slice(2);
        const next = argv[index + 1];
        if (!next || next.startsWith('--')) {
            parsed[key] = 'true';
            continue;
        }
        parsed[key] = next;
        index += 1;
    }
    return parsed;
}

function parseBoolean(rawValue) {
    const normalized = String(rawValue || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const wasmPath = typeof args['wasm-path'] === 'string' ? args['wasm-path'].trim() : '';
    const strict = parseBoolean(args.strict);
    const out = typeof args.out === 'string' ? path.resolve(args.out) : '';

    const result = await probeWasmParityArtifact(wasmPath || null);
    const payload = {
        generatedAt: new Date().toISOString(),
        strict,
        probe: result
    };

    if (out) {
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');
    }

    console.log(JSON.stringify(payload, null, 2));

    if (strict && !result.ready) {
        process.exitCode = 1;
        console.error('[WASM Verify] Artifact probe failed strict mode.');
    }
}

main().catch((error) => {
    console.error('[WASM Verify] Failed:', error);
    process.exitCode = 1;
});
