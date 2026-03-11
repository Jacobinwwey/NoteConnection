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
    evaluateWasmParityHistoricalPerformanceGuards,
    evaluateWasmParityPerformanceGuards
} = require('../src/backend/algorithms/WasmParityBenchmarkGuards');
const {
    classifyWasmParityHistoryMaturity,
    compactWasmParityHistoryRecords,
    selectComparableWasmParityHistoryRecords,
    summarizeWasmParityHistoryReadiness
} = require('../src/backend/algorithms/WasmParityHistory');

const HISTORY_MATURITY_TIER_ORDER = {
    bootstrap: 0,
    warming: 1,
    enforced: 2
};

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

function parseHistoryMaturityTier(rawValue, fallbackTier, options = {}) {
    const { allowNone = false } = options;
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (allowNone && normalized === 'none') {
        return 'none';
    }
    if (normalized === 'bootstrap' || normalized === 'warming' || normalized === 'enforced') {
        return normalized;
    }
    return fallbackTier;
}

function compareHistoryMaturityTier(leftTier, rightTier) {
    const leftOrder = HISTORY_MATURITY_TIER_ORDER[String(leftTier || '').toLowerCase()] ?? -1;
    const rightOrder = HISTORY_MATURITY_TIER_ORDER[String(rightTier || '').toLowerCase()] ?? -1;
    if (leftOrder === rightOrder) {
        return 0;
    }
    return leftOrder > rightOrder ? 1 : -1;
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

function toFiniteNonNegative(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return 0;
    }
    return numeric;
}

function toHostKey(host) {
    const nodeVersion = String(host.nodeVersion || '');
    const nodeMajor = Number.parseInt(nodeVersion.replace(/^v/i, '').split('.')[0] || '0', 10);
    return [
        String(host.platform || 'unknown'),
        String(host.arch || 'unknown'),
        String(Number.isFinite(host.cpuCount) ? host.cpuCount : 0),
        Number.isFinite(nodeMajor) ? `node${nodeMajor}` : 'node0'
    ].join(':');
}

function loadHistoryRecords(historyFile) {
    if (!historyFile || !fs.existsSync(historyFile)) {
        return [];
    }
    const raw = fs.readFileSync(historyFile, 'utf8');
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    const records = [];
    lines.forEach((line, index) => {
        try {
            const parsed = JSON.parse(line);
            records.push(parsed);
        } catch (error) {
            console.warn('[WASM Benchmark] Ignoring malformed history line:', index + 1, 'file:', historyFile, 'error:', error.message);
        }
    });
    return records;
}

function writeHistoryRecords(historyFile, records) {
    if (!historyFile) {
        return;
    }
    fs.mkdirSync(path.dirname(historyFile), { recursive: true });
    const lines = Array.isArray(records)
        ? records.map((record) => JSON.stringify(record))
        : [];
    const payload = lines.length > 0 ? `${lines.join('\n')}\n` : '';
    fs.writeFileSync(historyFile, payload, 'utf8');
}

function toHistoryMetricSamples(records, metricKey) {
    return records
        .map((record) => ({
            p95: toFiniteNonNegative(record?.[metricKey]?.candidateP95Ms),
            p99: toFiniteNonNegative(record?.[metricKey]?.candidateP99Ms)
        }))
        .filter((entry) => entry.p95 > 0 && entry.p99 > 0);
}

function buildHistoryReadinessMarkdown(readinessReport) {
    const lines = [];
    const profileRows = Array.isArray(readinessReport?.summary?.profileSummaries)
        ? readinessReport.summary.profileSummaries
        : [];
    lines.push('# WASM Parity History Readiness');
    lines.push('');
    lines.push(`Generated At: ${readinessReport.generatedAt}`);
    lines.push(`History File: ${readinessReport.historyFile}`);
    lines.push(`Current Profile: ${readinessReport.currentProfile.hostKey} / nodes=${readinessReport.currentProfile.nodeCount} / workers=${readinessReport.currentProfile.maxWorkers}`);
    lines.push('');
    lines.push('## Current Profile');
    lines.push('');
    lines.push(`- Before Run: ${readinessReport.currentProfile.beforeRun.sampleCount} samples (${readinessReport.currentProfile.beforeRun.tier})`);
    lines.push(`- After Run: ${readinessReport.currentProfile.afterRun.sampleCount} samples (${readinessReport.currentProfile.afterRun.tier})`);
    lines.push(`- Minimum Samples: ${readinessReport.currentProfile.afterRun.minimumSamples}`);
    lines.push(`- Strict Samples: ${readinessReport.currentProfile.afterRun.strictSamples}`);
    lines.push(`- Bootstrap Active This Run: ${readinessReport.currentProfile.historyGuardBootstrapActive ? 'yes' : 'no'}`);
    lines.push('');
    lines.push('## Fleet Summary');
    lines.push('');
    lines.push(`- Comparable Records: ${readinessReport.summary.comparableRecordCount}`);
    lines.push(`- Profiles: ${readinessReport.summary.profileCount}`);
    lines.push(`- Tier Counts: bootstrap=${readinessReport.summary.tierCounts.bootstrap}, warming=${readinessReport.summary.tierCounts.warming}, enforced=${readinessReport.summary.tierCounts.enforced}`);
    lines.push('');
    lines.push('## Profiles');
    lines.push('');
    lines.push('| Host Key | Nodes | Workers | Samples | Tier | First Seen | Last Seen |');
    lines.push('| --- | ---: | ---: | ---: | --- | --- | --- |');
    profileRows.forEach((profile) => {
        lines.push(`| ${profile.hostKey} | ${profile.nodeCount} | ${profile.maxWorkers} | ${profile.sampleCount} | ${profile.maturity.tier} | ${profile.firstGeneratedAt} | ${profile.lastGeneratedAt} |`);
    });
    if (profileRows.length === 0) {
        lines.push('| n/a | 0 | 0 | 0 | bootstrap | n/a | n/a |');
    }
    lines.push('');
    return lines.join('\n');
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
    const historyWindow = parsePositiveInt(args['history-window'], 20, 1, 500);
    const minimumHistorySamples = parsePositiveInt(args['minimum-history-samples'], 5, 1, 200);
    const historyStrictSamples = parsePositiveInt(
        args['history-strict-samples'],
        Math.max(minimumHistorySamples * 2, minimumHistorySamples),
        minimumHistorySamples,
        1000
    );
    const historyFile = path.resolve(args['history-file'] || path.join(outDir, 'history.jsonl'));
    const historyMaxRecords = parsePositiveInt(args['history-max-records'], 2000, 100, 200000);
    const historyMaxAgeDays = parsePositiveInt(args['history-max-age-days'], 90, 1, 3650);
    const maxCandidateToHistoryGraphP95Ratio = parseOptionalPositiveNumber(args['max-candidate-to-history-graph-p95-ratio']);
    const maxCandidateToHistoryLayoutP95Ratio = parseOptionalPositiveNumber(args['max-candidate-to-history-layout-p95-ratio']);
    const maxCandidateToHistoryGraphP99Ratio = parseOptionalPositiveNumber(args['max-candidate-to-history-graph-p99-ratio']);
    const maxCandidateToHistoryLayoutP99Ratio = parseOptionalPositiveNumber(args['max-candidate-to-history-layout-p99-ratio']);
    const bootstrapHistoryGuard = parseBooleanFlag(args['bootstrap-history-guard']);
    const historyMaturityWarnTier = parseHistoryMaturityTier(
        args['history-maturity-warn-tier'],
        'warming',
        { allowNone: true }
    );
    const historyMaturityFailTier = parseHistoryMaturityTier(
        args['history-maturity-fail-tier'],
        'none',
        { allowNone: true }
    );

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

        const host = {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            cpuCount: os.cpus().length
        };
        const hostKey = toHostKey(host);
        const historyRecords = loadHistoryRecords(historyFile);
        const comparableHistoryRecords = selectComparableWasmParityHistoryRecords(historyRecords, {
            hostKey,
            nodeCount,
            maxWorkers,
            historyWindow
        });
        const historyGuardBootstrapActive = bootstrapHistoryGuard && comparableHistoryRecords.length < minimumHistorySamples;
        const historyMaturityBeforeRun = classifyWasmParityHistoryMaturity(
            comparableHistoryRecords.length,
            minimumHistorySamples,
            historyStrictSamples
        );
        const graphHistorySamples = toHistoryMetricSamples(comparableHistoryRecords, 'graphMetrics');
        const layoutHistorySamples = toHistoryMetricSamples(comparableHistoryRecords, 'layoutEngine');
        const historyPerformanceGuards = evaluateWasmParityHistoricalPerformanceGuards({
            minimumHistorySamples,
            graphMetrics: {
                metric: 'graphMetrics',
                candidateP95Ms: candidate.graphMetrics.durationStatsMs.p95Ms,
                candidateP99Ms: candidate.graphMetrics.durationStatsMs.p99Ms,
                historyBaselineP95SamplesMs: graphHistorySamples.map((sample) => sample.p95),
                historyBaselineP99SamplesMs: graphHistorySamples.map((sample) => sample.p99),
                config: {
                    maxCandidateToBaselineP95Ratio: historyGuardBootstrapActive ? null : maxCandidateToHistoryGraphP95Ratio,
                    maxCandidateToBaselineP99Ratio: historyGuardBootstrapActive ? null : maxCandidateToHistoryGraphP99Ratio
                }
            },
            layoutEngine: {
                metric: 'layoutEngine',
                candidateP95Ms: candidate.layoutEngine.durationStatsMs.p95Ms,
                candidateP99Ms: candidate.layoutEngine.durationStatsMs.p99Ms,
                historyBaselineP95SamplesMs: layoutHistorySamples.map((sample) => sample.p95),
                historyBaselineP99SamplesMs: layoutHistorySamples.map((sample) => sample.p99),
                config: {
                    maxCandidateToBaselineP95Ratio: historyGuardBootstrapActive ? null : maxCandidateToHistoryLayoutP95Ratio,
                    maxCandidateToBaselineP99Ratio: historyGuardBootstrapActive ? null : maxCandidateToHistoryLayoutP99Ratio
                }
            }
        });

        const candidateMode = candidate.graphMetrics.lastDiagnostics.mode;
        const wasmUsed = candidateMode === 'wasm-adapter' || candidate.layoutEngine.lastDiagnostics.mode === 'wasm-adapter';
        const performanceGuardsPass = !performanceGuards.applied || performanceGuards.pass;

        const report = {
            generatedAt: new Date().toISOString(),
            host,
            benchmarkConfig: {
                nodeCount,
                iterations,
                maxWorkers,
                repulsion,
                distance,
                wasmPath: wasmPath || null,
                history: {
                    historyFile,
                    historyWindow,
                    minimumHistorySamples,
                    historyStrictSamples,
                    bootstrapHistoryGuard,
                    historyGuardBootstrapActive,
                    comparableHistorySamples: comparableHistoryRecords.length,
                    historyMaxRecords,
                    historyMaxAgeDays,
                    maxCandidateToHistoryGraphP95Ratio,
                    maxCandidateToHistoryLayoutP95Ratio,
                    maxCandidateToHistoryGraphP99Ratio,
                    maxCandidateToHistoryLayoutP99Ratio,
                    historyMaturityWarnTier,
                    historyMaturityFailTier,
                    historyMaturityBeforeRun
                },
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
                performanceGuards,
                historyPerformanceGuards
            }
        };

        const historyRecord = {
            generatedAt: report.generatedAt,
            hostKey,
            nodeCount,
            iterations,
            maxWorkers,
            wasmUsed,
            equivalenceWithinTolerance: betweennessDiff.withinTolerance,
            performanceGuardsPass,
            graphMetrics: {
                candidateP95Ms: candidate.graphMetrics.durationStatsMs.p95Ms,
                candidateP99Ms: candidate.graphMetrics.durationStatsMs.p99Ms,
                mode: candidate.graphMetrics.lastDiagnostics.mode
            },
            layoutEngine: {
                candidateP95Ms: candidate.layoutEngine.durationStatsMs.p95Ms,
                candidateP99Ms: candidate.layoutEngine.durationStatsMs.p99Ms,
                mode: candidate.layoutEngine.lastDiagnostics.mode
            }
        };
        const compaction = compactWasmParityHistoryRecords(
            [...historyRecords, historyRecord],
            {
                maxRecords: historyMaxRecords,
                maxAgeDays: historyMaxAgeDays,
                now: new Date(report.generatedAt)
            }
        );
        writeHistoryRecords(historyFile, compaction.compacted);
        report.benchmarkConfig.history.compaction = {
            beforeCount: compaction.beforeCount,
            afterCount: compaction.afterCount
        };
        const comparableHistoryRecordsAfterRun = selectComparableWasmParityHistoryRecords(compaction.compacted, {
            hostKey,
            nodeCount,
            maxWorkers,
            historyWindow
        });
        const historyMaturityAfterRun = classifyWasmParityHistoryMaturity(
            comparableHistoryRecordsAfterRun.length,
            minimumHistorySamples,
            historyStrictSamples
        );
        const historyReadinessSummary = summarizeWasmParityHistoryReadiness(compaction.compacted, {
            minimumSamples: minimumHistorySamples,
            strictSamples: historyStrictSamples,
            historyWindow
        });
        const historyReadinessReport = {
            generatedAt: report.generatedAt,
            historyFile,
            currentProfile: {
                hostKey,
                nodeCount,
                maxWorkers,
                historyGuardBootstrapActive,
                beforeRun: historyMaturityBeforeRun,
                afterRun: historyMaturityAfterRun
            },
            policy: {
                warnTier: historyMaturityWarnTier,
                failTier: historyMaturityFailTier
            },
            summary: historyReadinessSummary
        };
        report.benchmarkConfig.history.historyMaturityAfterRun = historyMaturityAfterRun;
        report.benchmarkConfig.history.historyReadinessSummary = {
            comparableRecordCount: historyReadinessSummary.comparableRecordCount,
            profileCount: historyReadinessSummary.profileCount,
            tierCounts: historyReadinessSummary.tierCounts
        };

        fs.mkdirSync(outDir, { recursive: true });
        const timestamp = report.generatedAt.replace(/[:.]/g, '-');
        const reportFile = path.join(outDir, `wasm-parity-benchmark-${timestamp}.json`);
        const latestFile = path.join(outDir, 'latest.json');
        const readinessFile = path.join(outDir, `history-readiness-${timestamp}.json`);
        const readinessLatestFile = path.join(outDir, 'history-readiness-latest.json');
        const readinessMarkdownFile = path.join(outDir, `history-readiness-${timestamp}.md`);
        const readinessMarkdownLatestFile = path.join(outDir, 'history-readiness-latest.md');
        const readinessMarkdown = buildHistoryReadinessMarkdown(historyReadinessReport);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
        fs.writeFileSync(latestFile, JSON.stringify(report, null, 2), 'utf8');
        fs.writeFileSync(readinessFile, JSON.stringify(historyReadinessReport, null, 2), 'utf8');
        fs.writeFileSync(readinessLatestFile, JSON.stringify(historyReadinessReport, null, 2), 'utf8');
        fs.writeFileSync(readinessMarkdownFile, readinessMarkdown, 'utf8');
        fs.writeFileSync(readinessMarkdownLatestFile, readinessMarkdown, 'utf8');

        console.log('[WASM Benchmark] Report written:', reportFile);
        console.log('[WASM Benchmark] Latest report:', latestFile);
        console.log('[WASM Benchmark] History readiness report:', readinessFile);
        console.log('[WASM Benchmark] History readiness latest report:', readinessLatestFile);
        console.log('[WASM Benchmark] History readiness markdown:', readinessMarkdownLatestFile);
        console.log('[WASM Benchmark] History file:', historyFile);
        console.log('[WASM Benchmark] History compaction:', `${compaction.beforeCount} -> ${compaction.afterCount}`);
        console.log('[WASM Benchmark] Comparable history samples:', comparableHistoryRecords.length);
        console.log(
            '[WASM Benchmark] History maturity tier:',
            `${historyMaturityBeforeRun.tier} -> ${historyMaturityAfterRun.tier}`,
            `(samples ${historyMaturityBeforeRun.sampleCount} -> ${historyMaturityAfterRun.sampleCount})`
        );
        if (historyGuardBootstrapActive) {
            console.warn(
                '[WASM Benchmark] History guard bootstrap mode is active:',
                `samples=${comparableHistoryRecords.length} < minimum=${minimumHistorySamples}.`,
                'History ratio thresholds are temporarily skipped for this run.'
            );
        }
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
        if (historyPerformanceGuards.applied) {
            console.log('[WASM Benchmark] History guards pass:', historyPerformanceGuards.pass);
            historyPerformanceGuards.metrics.forEach((metric) => {
                console.log(
                    '[WASM Benchmark] History guard metric:',
                    metric.metric,
                    'sampleCount:',
                    metric.historySampleCount,
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
        if (
            historyMaturityWarnTier !== 'none' &&
            compareHistoryMaturityTier(historyMaturityAfterRun.tier, historyMaturityWarnTier) < 0
        ) {
            console.warn(
                '[WASM Benchmark] History maturity tier is below warning policy:',
                `current=${historyMaturityAfterRun.tier}`,
                `warnTier=${historyMaturityWarnTier}`,
                `(samples=${historyMaturityAfterRun.sampleCount}, strict=${historyMaturityAfterRun.strictSamples}).`
            );
        }
        if (
            historyMaturityFailTier !== 'none' &&
            compareHistoryMaturityTier(historyMaturityAfterRun.tier, historyMaturityFailTier) < 0
        ) {
            throw new Error(
                '[WASM Benchmark] History maturity tier requirement is not met: ' +
                `current=${historyMaturityAfterRun.tier}, required=${historyMaturityFailTier}.`
            );
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
        if (historyPerformanceGuards.applied && !historyPerformanceGuards.pass) {
            throw new Error('[WASM Benchmark] Historical performance guard thresholds were exceeded.');
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
