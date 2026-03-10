#!/usr/bin/env node
'use strict';

require('ts-node/register/transpile-only');

const fs = require('fs');
const os = require('os');
const path = require('path');

const { config } = require('../src/backend/config');
const { GraphMetrics } = require('../src/backend/GraphMetrics');
const { LayoutEngine } = require('../src/backend/algorithms/LayoutEngine');
const { WasmParityRuntime } = require('../src/backend/algorithms/WasmParityRuntime');
const {
    buildDeterministicBenchmarkGraph,
    summarizeBetweennessDifference,
    summarizeDurations
} = require('../src/backend/algorithms/WasmParityBenchmark');
const {
    evaluateWasmParityPerformanceGuards
} = require('../src/backend/algorithms/WasmParityBenchmarkGuards');

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
    return Math.min(maximum, Math.max(minimum, rounded));
}

function parseBooleanFlag(rawValue) {
    const normalized = String(rawValue || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseOptionalPositiveNumber(rawValue) {
    if (rawValue === null || typeof rawValue === 'undefined' || rawValue === '') {
        return null;
    }
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

function toTopBetweennessRows(values, limit = 5) {
    return Array.from(values.entries())
        .sort((left, right) => {
            if (right[1] !== left[1]) {
                return right[1] - left[1];
            }
            return left[0].localeCompare(right[0]);
        })
        .slice(0, limit)
        .map(([nodeId, score]) => ({
            nodeId,
            score
        }));
}

function mergeModeCounts(modeCounts, mode) {
    const key = String(mode || 'none');
    modeCounts[key] = (modeCounts[key] || 0) + 1;
}

function collectFiniteLayoutCoverage(graph) {
    const nodes = graph.getNodes();
    const finiteNodes = nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
    return {
        totalNodes: nodes.length,
        finiteNodes: finiteNodes.length,
        coverageRatio: nodes.length > 0 ? finiteNodes.length / nodes.length : 0
    };
}

async function runScenario(options) {
    const {
        scenarioName,
        wasmEnabled,
        wasmPath,
        iterations,
        nodeCount,
        repulsion,
        distance
    } = options;

    const previousEnable = process.env.NOTE_CONNECTION_ENABLE_WASM_PARITY;
    const previousPath = process.env.NOTE_CONNECTION_WASM_PATH;

    const metricsDurations = [];
    const layoutDurations = [];
    const graphMetricsModeCounts = {};
    const layoutModeCounts = {};
    const layoutCoverage = [];
    let lastBetweenness = new Map();
    let lastWasmDiagnostics = null;

    try {
        process.env.NOTE_CONNECTION_ENABLE_WASM_PARITY = wasmEnabled ? '1' : '0';
        if (wasmPath) {
            process.env.NOTE_CONNECTION_WASM_PATH = wasmPath;
        } else {
            delete process.env.NOTE_CONNECTION_WASM_PATH;
        }

        WasmParityRuntime.__resetForTests();

        for (let iteration = 0; iteration < iterations; iteration += 1) {
            const graph = buildDeterministicBenchmarkGraph({ nodeCount });

            GraphMetrics.__resetComputeDiagnosticsForTests();
            LayoutEngine.__resetComputeDiagnosticsForTests();

            const betweenness = await GraphMetrics.calculateBetweennessAsync(graph);
            const metricsDiagnostics = GraphMetrics.getLastComputeDiagnostics();
            mergeModeCounts(graphMetricsModeCounts, metricsDiagnostics.mode);
            metricsDurations.push(metricsDiagnostics.durationMs);

            await LayoutEngine.computeLayout(graph, {
                repulsion,
                distance,
                enableGPU: false
            });
            const layoutDiagnostics = LayoutEngine.getLastComputeDiagnostics();
            mergeModeCounts(layoutModeCounts, layoutDiagnostics.mode);
            layoutDurations.push(layoutDiagnostics.durationMs);
            layoutCoverage.push(collectFiniteLayoutCoverage(graph));

            lastBetweenness = betweenness;
            lastWasmDiagnostics = WasmParityRuntime.getDiagnostics();
        }

        const lastGraphMetricsDiagnostics = GraphMetrics.getLastComputeDiagnostics();
        const lastLayoutDiagnostics = LayoutEngine.getLastComputeDiagnostics();

        return {
            scenarioName,
            wasmEnabled,
            iterations,
            nodeCount,
            graphMetrics: {
                modeCounts: graphMetricsModeCounts,
                durationStatsMs: summarizeDurations(metricsDurations),
                lastDiagnostics: lastGraphMetricsDiagnostics,
                topBetweenness: toTopBetweennessRows(lastBetweenness)
            },
            layoutEngine: {
                modeCounts: layoutModeCounts,
                durationStatsMs: summarizeDurations(layoutDurations),
                lastDiagnostics: lastLayoutDiagnostics,
                lastCoverage: layoutCoverage[layoutCoverage.length - 1] || {
                    totalNodes: nodeCount,
                    finiteNodes: 0,
                    coverageRatio: 0
                }
            },
            wasmParityDiagnostics: lastWasmDiagnostics,
            _betweenness: lastBetweenness
        };
    } finally {
        if (typeof previousEnable === 'undefined') {
            delete process.env.NOTE_CONNECTION_ENABLE_WASM_PARITY;
        } else {
            process.env.NOTE_CONNECTION_ENABLE_WASM_PARITY = previousEnable;
        }

        if (typeof previousPath === 'undefined') {
            delete process.env.NOTE_CONNECTION_WASM_PATH;
        } else {
            process.env.NOTE_CONNECTION_WASM_PATH = previousPath;
        }
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const positionalIterations = Array.isArray(args._positionals) ? args._positionals[0] : undefined;
    const positionalNodes = Array.isArray(args._positionals) ? args._positionals[1] : undefined;
    const nodeCount = parsePositiveInt(args.nodes || positionalNodes, 500, 100, 4000);
    const iterations = parsePositiveInt(args.iterations || positionalIterations, 2, 1, 20);
    const defaultWorkers = Math.max(1, Math.min(4, os.cpus().length - 1));
    const maxWorkers = parsePositiveInt(args['max-workers'], defaultWorkers, 1, 64);
    const repulsion = -550;
    const distance = 100;
    const outDir = path.resolve(args.out || path.join(process.cwd(), 'tmp', 'wasm-parity-benchmark'));
    const wasmPath = typeof args['wasm-path'] === 'string' ? args['wasm-path'].trim() : '';
    const requireWasmAdapter = parseBooleanFlag(args['require-wasm-adapter']);
    const maxCandidateToBaselineGraphP95Ratio = parseOptionalPositiveNumber(args['max-candidate-to-baseline-graph-p95-ratio']);
    const maxCandidateToBaselineLayoutP95Ratio = parseOptionalPositiveNumber(args['max-candidate-to-baseline-layout-p95-ratio']);
    const maxCandidateGraphP95Ms = parseOptionalPositiveNumber(args['max-candidate-graph-p95-ms']);
    const maxCandidateLayoutP95Ms = parseOptionalPositiveNumber(args['max-candidate-layout-p95-ms']);
    const maxCandidateToBaselineGraphP99Ratio = parseOptionalPositiveNumber(args['max-candidate-to-baseline-graph-p99-ratio']);
    const maxCandidateToBaselineLayoutP99Ratio = parseOptionalPositiveNumber(args['max-candidate-to-baseline-layout-p99-ratio']);
    const maxCandidateGraphP99Ms = parseOptionalPositiveNumber(args['max-candidate-graph-p99-ms']);
    const maxCandidateLayoutP99Ms = parseOptionalPositiveNumber(args['max-candidate-layout-p99-ms']);

    const originalMemorySavingMode = config.memorySavingMode;
    const originalMaxWorkers = config.maxWorkers;

    try {
        config.memorySavingMode = false;
        config.maxWorkers = maxWorkers;

        const baseline = await runScenario({
            scenarioName: 'baseline-no-wasm',
            wasmEnabled: false,
            wasmPath: '',
            iterations,
            nodeCount,
            repulsion,
            distance
        });

        const candidate = await runScenario({
            scenarioName: 'candidate-wasm-enabled',
            wasmEnabled: true,
            wasmPath,
            iterations,
            nodeCount,
            repulsion,
            distance
        });

        const betweennessDiff = summarizeBetweennessDifference(
            baseline._betweenness,
            candidate._betweenness,
            1e-9
        );
        const performanceGuards = evaluateWasmParityPerformanceGuards({
            graphMetrics: {
                metric: 'graphMetrics',
                baselineP95Ms: baseline.graphMetrics.durationStatsMs.p95Ms,
                candidateP95Ms: candidate.graphMetrics.durationStatsMs.p95Ms,
                baselineP99Ms: baseline.graphMetrics.durationStatsMs.p99Ms,
                candidateP99Ms: candidate.graphMetrics.durationStatsMs.p99Ms,
                config: {
                    maxCandidateToBaselineP95Ratio: maxCandidateToBaselineGraphP95Ratio,
                    maxCandidateP95Ms: maxCandidateGraphP95Ms,
                    maxCandidateToBaselineP99Ratio: maxCandidateToBaselineGraphP99Ratio,
                    maxCandidateP99Ms: maxCandidateGraphP99Ms
                }
            },
            layoutEngine: {
                metric: 'layoutEngine',
                baselineP95Ms: baseline.layoutEngine.durationStatsMs.p95Ms,
                candidateP95Ms: candidate.layoutEngine.durationStatsMs.p95Ms,
                baselineP99Ms: baseline.layoutEngine.durationStatsMs.p99Ms,
                candidateP99Ms: candidate.layoutEngine.durationStatsMs.p99Ms,
                config: {
                    maxCandidateToBaselineP95Ratio: maxCandidateToBaselineLayoutP95Ratio,
                    maxCandidateP95Ms: maxCandidateLayoutP95Ms,
                    maxCandidateToBaselineP99Ratio: maxCandidateToBaselineLayoutP99Ratio,
                    maxCandidateP99Ms: maxCandidateLayoutP99Ms
                }
            }
        });

        const report = {
            generatedAt: new Date().toISOString(),
            host: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                cpuCount: os.cpus().length
            },
            benchmarkConfig: {
                nodeCount,
                iterations,
                maxWorkers,
                repulsion,
                distance,
                wasmPath: wasmPath || null,
                guards: {
                    maxCandidateToBaselineGraphP95Ratio,
                    maxCandidateToBaselineLayoutP95Ratio,
                    maxCandidateGraphP95Ms,
                    maxCandidateLayoutP95Ms,
                    maxCandidateToBaselineGraphP99Ratio,
                    maxCandidateToBaselineLayoutP99Ratio,
                    maxCandidateGraphP99Ms,
                    maxCandidateLayoutP99Ms
                }
            },
            scenarios: [
                {
                    scenarioName: baseline.scenarioName,
                    wasmEnabled: baseline.wasmEnabled,
                    iterations: baseline.iterations,
                    nodeCount: baseline.nodeCount,
                    graphMetrics: baseline.graphMetrics,
                    layoutEngine: baseline.layoutEngine,
                    wasmParityDiagnostics: baseline.wasmParityDiagnostics
                },
                {
                    scenarioName: candidate.scenarioName,
                    wasmEnabled: candidate.wasmEnabled,
                    iterations: candidate.iterations,
                    nodeCount: candidate.nodeCount,
                    graphMetrics: candidate.graphMetrics,
                    layoutEngine: candidate.layoutEngine,
                    wasmParityDiagnostics: candidate.wasmParityDiagnostics
                }
            ],
            equivalence: {
                betweenness: betweennessDiff,
                layoutCoverage: {
                    baseline: baseline.layoutEngine.lastCoverage,
                    candidate: candidate.layoutEngine.lastCoverage
                },
                performanceGuards
            }
        };

        fs.mkdirSync(outDir, { recursive: true });
        const timestamp = report.generatedAt.replace(/[:.]/g, '-');
        const reportFile = path.join(outDir, `wasm-parity-benchmark-${timestamp}.json`);
        const latestFile = path.join(outDir, 'latest.json');
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
        fs.writeFileSync(latestFile, JSON.stringify(report, null, 2), 'utf8');

        const candidateMode = candidate.graphMetrics.lastDiagnostics.mode;
        const wasmUsed = candidateMode === 'wasm-adapter' || candidate.layoutEngine.lastDiagnostics.mode === 'wasm-adapter';

        console.log('[WASM Benchmark] Report written:', reportFile);
        console.log('[WASM Benchmark] Latest report:', latestFile);
        console.log('[WASM Benchmark] GraphMetrics baseline mode:', baseline.graphMetrics.lastDiagnostics.mode);
        console.log('[WASM Benchmark] GraphMetrics candidate mode:', candidate.graphMetrics.lastDiagnostics.mode);
        console.log('[WASM Benchmark] Layout baseline mode:', baseline.layoutEngine.lastDiagnostics.mode);
        console.log('[WASM Benchmark] Layout candidate mode:', candidate.layoutEngine.lastDiagnostics.mode);
        console.log('[WASM Benchmark] Betweenness within tolerance:', betweennessDiff.withinTolerance);
        if (performanceGuards.applied) {
            console.log('[WASM Benchmark] Performance guards pass:', performanceGuards.pass);
            performanceGuards.metrics.forEach((metric) => {
                console.log(
                    '[WASM Benchmark] Guard metric:',
                    metric.metric,
                    'baselineP95Ms:',
                    metric.baselineP95Ms,
                    'candidateP95Ms:',
                    metric.candidateP95Ms,
                    'p95Ratio:',
                    metric.candidateToBaselineP95Ratio,
                    'baselineP99Ms:',
                    metric.baselineP99Ms,
                    'candidateP99Ms:',
                    metric.candidateP99Ms,
                    'p99Ratio:',
                    metric.candidateToBaselineP99Ratio,
                    'failures:',
                    metric.failures
                );
            });
        }
        if (!wasmUsed) {
            const warning = '[WASM Benchmark] Candidate scenario did not execute wasm-adapter path. Check wasm artifact availability/path.';
            if (requireWasmAdapter) {
                throw new Error(`${warning} Strict mode is enabled via --require-wasm-adapter.`);
            }
            console.warn(warning);
        }
        if (performanceGuards.applied && !performanceGuards.pass) {
            throw new Error('[WASM Benchmark] Performance guard thresholds were exceeded.');
        }
    } finally {
        config.memorySavingMode = originalMemorySavingMode;
        config.maxWorkers = originalMaxWorkers;
    }
}

main().catch((error) => {
    console.error('[WASM Benchmark] Failed:', error);
    process.exitCode = 1;
});
