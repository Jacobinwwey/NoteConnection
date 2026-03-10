#!/usr/bin/env node
'use strict';

require('ts-node/register/transpile-only');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');

const { config } = require('../src/backend/config');
const { GraphMetrics } = require('../src/backend/GraphMetrics');
const {
    buildDeterministicBenchmarkGraph,
    summarizeBetweennessDifference,
    summarizeDurations
} = require('../src/backend/algorithms/WasmParityBenchmark');

function parseArgs(argv) {
    const parsed = {
        _positionals: []
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token) {
            continue;
        }
        if (!token.startsWith('--')) {
            parsed._positionals.push(token);
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

function parsePositiveInt(rawValue, fallback, minimum, maximum) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    const rounded = Math.floor(parsed);
    return Math.max(minimum, Math.min(maximum, rounded));
}

function roundTo(value, digits = 4) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    const base = 10 ** Math.max(0, digits);
    return Math.round(value * base) / base;
}

function incrementModeCount(modeCounts, mode) {
    const key = String(mode || 'none');
    modeCounts[key] = (modeCounts[key] || 0) + 1;
}

function createProfiles() {
    return [
        {
            profile: 'n300_sparse',
            nodeCount: 300,
            branchStride: 140,
            jumpSpan: 220,
            meshStride: 260
        },
        {
            profile: 'n500_sparse',
            nodeCount: 500,
            branchStride: 180,
            jumpSpan: 260,
            meshStride: 320
        },
        {
            profile: 'n500_balanced',
            nodeCount: 500,
            branchStride: 4,
            jumpSpan: 7,
            meshStride: 11
        },
        {
            profile: 'n500_dense',
            nodeCount: 500,
            branchStride: 2,
            jumpSpan: 4,
            meshStride: 3
        },
        {
            profile: 'n800_balanced',
            nodeCount: 800,
            branchStride: 4,
            jumpSpan: 7,
            meshStride: 11
        }
    ];
}

function estimateWorkloadRatio(nodeCount, edgeCount, workerCount) {
    const normalizedNodeCount = Math.max(0, Math.floor(Number(nodeCount) || 0));
    const normalizedEdgeCount = Math.max(0, Math.floor(Number(edgeCount) || 0));
    const normalizedWorkers = Math.max(1, Math.floor(Number(workerCount) || 1));
    const estimatedWorkUnits = normalizedNodeCount * normalizedEdgeCount;
    const estimatedWorkerOverheadUnits = normalizedWorkers * (normalizedNodeCount + normalizedEdgeCount);
    return {
        estimatedWorkUnits,
        estimatedWorkerOverheadUnits,
        estimatedBenefitRatio: estimatedWorkUnits / Math.max(1, estimatedWorkerOverheadUnits)
    };
}

function aggregateEquivalence(iterationDiffs) {
    if (!Array.isArray(iterationDiffs) || iterationDiffs.length === 0) {
        return {
            iterations: 0,
            withinTolerance: true,
            maxAbsDelta: 0,
            meanAbsDelta: 0,
            maxMismatchedNodeCount: 0
        };
    }

    let withinTolerance = true;
    let maxAbsDelta = 0;
    let totalMeanAbsDelta = 0;
    let maxMismatchedNodeCount = 0;

    iterationDiffs.forEach((diff) => {
        withinTolerance = withinTolerance && Boolean(diff.withinTolerance);
        maxAbsDelta = Math.max(maxAbsDelta, Number(diff.maxAbsDelta || 0));
        totalMeanAbsDelta += Number(diff.meanAbsDelta || 0);
        maxMismatchedNodeCount = Math.max(maxMismatchedNodeCount, Number(diff.mismatchedNodeCount || 0));
    });

    return {
        iterations: iterationDiffs.length,
        withinTolerance,
        maxAbsDelta,
        meanAbsDelta: totalMeanAbsDelta / iterationDiffs.length,
        maxMismatchedNodeCount
    };
}

function calculateRecommendation(profileRows, currentPolicy) {
    const workerRows = profileRows.filter((row) => row.primaryAsyncMode === 'worker');
    if (workerRows.length === 0) {
        return {
            currentPolicy,
            recommendedPolicy: { ...currentPolicy },
            notes: [
                'No worker-mode rows observed; recommendation kept at current policy.'
            ]
        };
    }

    const fasterRows = workerRows.filter(
        (row) => row.asyncStats.p95Ms > 0 && row.sequentialStats.p95Ms > 0 && row.asyncStats.p95Ms < row.sequentialStats.p95Ms
    );
    const slowerRows = workerRows.filter(
        (row) => row.asyncStats.p95Ms >= row.sequentialStats.p95Ms
    );

    let recommendedRatio = currentPolicy.asyncWorkloadBenefitRatioThreshold;
    if (fasterRows.length > 0 && slowerRows.length > 0) {
        const minFasterRatio = Math.min(...fasterRows.map((row) => row.workload.estimatedBenefitRatio));
        const maxSlowerRatio = Math.max(...slowerRows.map((row) => row.workload.estimatedBenefitRatio));
        recommendedRatio = minFasterRatio > maxSlowerRatio
            ? (minFasterRatio + maxSlowerRatio) / 2
            : Math.max(minFasterRatio, maxSlowerRatio);
    } else if (fasterRows.length > 0) {
        recommendedRatio = Math.min(...fasterRows.map((row) => row.workload.estimatedBenefitRatio));
    } else if (slowerRows.length > 0) {
        recommendedRatio = Math.max(...slowerRows.map((row) => row.workload.estimatedBenefitRatio)) + 1;
    }

    const recommendedNodeThreshold = fasterRows.length > 0
        ? Math.min(...fasterRows.map((row) => row.nodeCount))
        : currentPolicy.asyncNodeCountThreshold;

    const notes = [];
    notes.push(`workerRows=${workerRows.length}, fasterRows=${fasterRows.length}, slowerRows=${slowerRows.length}`);
    if (fasterRows.length === 0) {
        notes.push('No worker-win profile observed; node threshold kept at current policy.');
    }

    return {
        currentPolicy,
        recommendedPolicy: {
            asyncNodeCountThreshold: Math.max(1, Math.floor(recommendedNodeThreshold)),
            asyncWorkloadBenefitRatioThreshold: roundTo(Math.max(0.1, recommendedRatio), 4)
        },
        notes
    };
}

async function runProfile(profileConfig, iterations) {
    const nodeCount = profileConfig.nodeCount;
    const sequentialDurations = [];
    const asyncDurations = [];
    const modeCounts = {};
    const equivalenceDiffs = [];

    let edgeCount = 0;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const sequentialGraph = buildDeterministicBenchmarkGraph(profileConfig);
        edgeCount = sequentialGraph.getEdges().length;

        const sequentialStart = performance.now();
        const sequentialResult = GraphMetrics.calculateBetweenness(sequentialGraph);
        const sequentialEnd = performance.now();
        sequentialDurations.push(Math.max(0, sequentialEnd - sequentialStart));

        const asyncGraph = buildDeterministicBenchmarkGraph(profileConfig);
        GraphMetrics.__resetComputeDiagnosticsForTests();
        const asyncResult = await GraphMetrics.calculateBetweennessAsync(asyncGraph);
        const diagnostics = GraphMetrics.getLastComputeDiagnostics();
        asyncDurations.push(Math.max(0, Number(diagnostics.durationMs) || 0));
        incrementModeCount(modeCounts, diagnostics.mode);

        const diff = summarizeBetweennessDifference(sequentialResult, asyncResult, 1e-9);
        equivalenceDiffs.push(diff);
    }

    const sortedModes = Object.entries(modeCounts).sort((left, right) => right[1] - left[1]);
    const primaryAsyncMode = sortedModes.length > 0 ? sortedModes[0][0] : 'none';

    return {
        profile: profileConfig.profile,
        nodeCount,
        edgeCount,
        graphConfig: {
            branchStride: profileConfig.branchStride,
            jumpSpan: profileConfig.jumpSpan,
            meshStride: profileConfig.meshStride
        },
        sequentialStats: summarizeDurations(sequentialDurations),
        asyncStats: summarizeDurations(asyncDurations),
        asyncModeCounts: modeCounts,
        primaryAsyncMode,
        equivalence: aggregateEquivalence(equivalenceDiffs)
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const iterations = parsePositiveInt(
        args.iterations || args._positionals[0],
        2,
        1,
        10
    );
    const positionalMaxWorkers = Array.isArray(args._positionals) ? args._positionals[1] : undefined;
    const positionalOut = Array.isArray(args._positionals) ? args._positionals[2] : undefined;
    const defaultWorkers = Math.max(1, Math.min(4, os.cpus().length - 1));
    const maxWorkers = parsePositiveInt(args['max-workers'] || positionalMaxWorkers, defaultWorkers, 1, 64);
    const outDir = path.resolve(args.out || positionalOut || path.join(process.cwd(), 'tmp', 'graphmetrics-tiering-calibration'));

    const originalMemorySavingMode = config.memorySavingMode;
    const originalMaxWorkers = config.maxWorkers;
    const originalWasmEnabled = process.env.NOTE_CONNECTION_ENABLE_WASM_PARITY;
    const originalNodeThreshold = process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD;
    const originalWorkloadThreshold = process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD;
    const baselinePolicy = GraphMetrics.getExecutionPolicy();

    try {
        config.memorySavingMode = false;
        config.maxWorkers = maxWorkers;
        process.env.NOTE_CONNECTION_ENABLE_WASM_PARITY = '0';
        // Force async path for calibration candidate run.
        process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD = '1';
        process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD = '0.0001';

        const profiles = createProfiles();
        const rows = [];
        for (const profileConfig of profiles) {
            const row = await runProfile(profileConfig, iterations);
            const workload = estimateWorkloadRatio(row.nodeCount, row.edgeCount, maxWorkers);
            const ratio = row.sequentialStats.p95Ms > 0
                ? row.asyncStats.p95Ms / row.sequentialStats.p95Ms
                : null;
            rows.push({
                ...row,
                workload: {
                    estimatedWorkUnits: workload.estimatedWorkUnits,
                    estimatedWorkerOverheadUnits: workload.estimatedWorkerOverheadUnits,
                    estimatedBenefitRatio: roundTo(workload.estimatedBenefitRatio, 6)
                },
                asyncToSequentialP95Ratio: ratio === null ? null : roundTo(ratio, 6)
            });
        }

        const recommendation = calculateRecommendation(rows, baselinePolicy);

        const report = {
            generatedAt: new Date().toISOString(),
            host: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                cpuCount: os.cpus().length
            },
            benchmarkConfig: {
                iterations,
                maxWorkers
            },
            profiles: rows,
            recommendation
        };

        fs.mkdirSync(outDir, { recursive: true });
        const timestamp = report.generatedAt.replace(/[:.]/g, '-');
        const reportFile = path.join(outDir, `graphmetrics-tiering-calibration-${timestamp}.json`);
        const latestFile = path.join(outDir, 'latest.json');
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
        fs.writeFileSync(latestFile, JSON.stringify(report, null, 2), 'utf8');

        console.log('[GraphMetrics Tiering Calibration] Report written:', reportFile);
        console.log('[GraphMetrics Tiering Calibration] Latest report:', latestFile);
        console.log('[GraphMetrics Tiering Calibration] Recommended policy:', recommendation.recommendedPolicy);
    } finally {
        config.memorySavingMode = originalMemorySavingMode;
        config.maxWorkers = originalMaxWorkers;

        if (typeof originalWasmEnabled === 'undefined') {
            delete process.env.NOTE_CONNECTION_ENABLE_WASM_PARITY;
        } else {
            process.env.NOTE_CONNECTION_ENABLE_WASM_PARITY = originalWasmEnabled;
        }

        if (typeof originalNodeThreshold === 'undefined') {
            delete process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD;
        } else {
            process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD = originalNodeThreshold;
        }

        if (typeof originalWorkloadThreshold === 'undefined') {
            delete process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD;
        } else {
            process.env.NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD = originalWorkloadThreshold;
        }
    }
}

main().catch((error) => {
    console.error('[GraphMetrics Tiering Calibration] Failed:', error);
    process.exitCode = 1;
});
