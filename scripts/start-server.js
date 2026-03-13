#!/usr/bin/env node

const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const {
    BYTES_PER_MEBIBYTE,
    resolveRuntimeHeapPolicy,
    stripMaxOldSpaceFromNodeOptions,
} = require('./lib/runtime-memory-policy');

function buildChildEnvironment(baseEnvironment) {
    const env = { ...baseEnvironment };
    const sanitizedNodeOptions = stripMaxOldSpaceFromNodeOptions(baseEnvironment.NODE_OPTIONS || '');
    if (sanitizedNodeOptions) {
        env.NODE_OPTIONS = sanitizedNodeOptions;
    } else {
        delete env.NODE_OPTIONS;
    }
    return env;
}

function describeWorkloadHint(workloadHint) {
    const parts = [];
    if (workloadHint.expectedNodeCount > 0) {
        parts.push(`nodes=${workloadHint.expectedNodeCount}`);
    }
    if (workloadHint.expectedEdgeCount > 0) {
        parts.push(`edges=${workloadHint.expectedEdgeCount}`);
    }
    if (workloadHint.graphScale !== 'default') {
        parts.push(`scale=${workloadHint.graphScale}`);
    }
    return parts.length > 0 ? parts.join(', ') : 'none';
}

function start() {
    const totalSystemMemoryMb = Math.floor(os.totalmem() / BYTES_PER_MEBIBYTE);
    const heapPolicy = resolveRuntimeHeapPolicy(process.env, totalSystemMemoryMb);
    const childArgs = [
        `--max-old-space-size=${heapPolicy.selectedOldSpaceMb}`,
        '-r',
        'ts-node/register',
        'src/server.ts',
        ...process.argv.slice(2),
    ];
    const childEnv = buildChildEnvironment(process.env);
    const projectRoot = path.resolve(__dirname, '..');

    const runtimeSummary = [
        `[start-server] Runtime=${heapPolicy.runtimeClass}`,
        `platform=${heapPolicy.runtimePlatform || heapPolicy.runtimeClass}`,
        `iosJetsamTier=${heapPolicy.iosJetsamTier || 'n/a'}`,
        `source=${heapPolicy.source}`,
        `selected=${heapPolicy.selectedOldSpaceMb}MiB`,
        `recommended=${heapPolicy.recommendedOldSpaceMb}MiB`,
        `hostBudget=${heapPolicy.hostBudgetMb > 0 ? `${heapPolicy.hostBudgetMb}MiB` : 'unknown'}`,
        `workloadHint=${describeWorkloadHint(heapPolicy.workloadHint)}`,
    ].join(' ');
    console.log(runtimeSummary);
    heapPolicy.warnings.forEach((warning) => {
        console.warn(`[start-server] ${warning}`);
    });

    const child = spawn(process.execPath, childArgs, {
        cwd: projectRoot,
        env: childEnv,
        stdio: 'inherit',
    });

    child.on('exit', (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
            return;
        }
        process.exit(code || 0);
    });

    child.on('error', (error) => {
        console.error('[start-server] Failed to spawn server process:', error);
        process.exit(1);
    });
}

start();
