#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { performance } = require('perf_hooks');
const { distribution } = require('./evaluate-answer-quality');
const { computeSidecarSourceFingerprint } = require('./sidecar-build-fingerprint');

async function main() {
    if (typeof global.gc !== 'function') throw new Error('Run with node --expose-gc for reproducible heap sampling.');
    const repoRoot = path.resolve(__dirname, '..');
    const outputRoot = path.join(repoRoot, 'output', 'verification', 'convergence-runtime');
    fs.mkdirSync(outputRoot, { recursive: true });
    const fixtureRoot = fs.mkdtempSync(path.join(outputRoot, 'fixture-'));
    if (!fixtureRoot.startsWith(outputRoot + path.sep)) throw new Error('Unexpected measurement fixture path');
    const { KnowledgeLearningPlatform } = require('../dist/src/learning/KnowledgeLearningPlatform');
    const { createFileBackedKnowledgeGraphStore } = require('../dist/src/learning/store');
    const { AgentConversationExecution, DEFAULT_AGENT_CONVERSATION_EXECUTION_POLICY } = require('../dist/src/learning/agentConversationExecution');
    const { resolveAgentResponseBudget } = require('../dist/src/learning/agentResponseBudget');
    const snapshots = [];
    try {
        for (const documentCount of [10, 500, 2000]) {
            global.gc();
            const snapshotPath = path.join(fixtureRoot, `snapshot-${documentCount}.json`);
            const platform = new KnowledgeLearningPlatform({ store: createFileBackedKnowledgeGraphStore({ filePath: snapshotPath }) });
            const documents = Array.from({ length: documentCount }, (_, index) => ({
                documentId: `scale-${index}`, sourcePath: `scale/document-${index}.md`,
                content: `# Scale Document ${index}\n\nThe document records independent evidence for numbered fixture ${index}. 中文内容用于验证 UTF-8 状态快照。`,
            }));
            await platform.ingestKnowledge({ documents, relationRecomputeMode: 'none' });
            const samples = [];
            for (let iteration = 0; iteration < 5; iteration++) {
                global.gc();
                const before = process.memoryUsage();
                const start = performance.now();
                const result = await platform.addConversationMemory({ userId: 'allocation-calibration', content: `Acknowledged memory ${iteration}.` });
                if (!result.added) throw new Error('State commit did not acknowledge the calibration write.');
                const after = process.memoryUsage();
                samples.push({ elapsedMs: performance.now() - start, heapGrowthBytes: after.heapUsed - before.heapUsed, rssGrowthBytes: after.rss - before.rss, rssAfterBytes: after.rss });
            }
            snapshots.push({ documentCount, snapshotBytes: fs.statSync(snapshotPath).size,
                completeMutationLatencyMs: distribution(samples.map(sample => sample.elapsedMs)),
                observedHeapGrowthBytes: distribution(samples.map(sample => sample.heapGrowthBytes)), samples });
        }

        const oversizedSource = path.join(fixtureRoot, 'oversized.md');
        fs.writeFileSync(oversizedSource, Buffer.alloc(DEFAULT_AGENT_CONVERSATION_EXECUTION_POLICY.maxSourceBytes + 1, 65));
        const sourceStart = performance.now();
        let sourceAdmission;
        await AgentConversationExecution.run({ budget: resolveAgentResponseBudget(), policy: DEFAULT_AGENT_CONVERSATION_EXECUTION_POLICY }, async execution => {
            try { await execution.readSourceFile(oversizedSource); throw new Error('Oversized source was admitted.'); }
            catch (error) {
                if (error.code !== 'runtime_source_bytes_limit') throw error;
                sourceAdmission = { rejection: error.code, elapsedMs: performance.now() - sourceStart, ...execution.diagnostics() };
            }
        });

        const cancellationSamples = [];
        for (let iteration = 0; iteration < 5; iteration++) {
            let entered;
            const started = new Promise(resolve => { entered = resolve; });
            const controller = new AbortController();
            const platform = new KnowledgeLearningPlatform({ autoPersist: false, graphQueryBackend: {
                id: 'cooperative-cancellation-calibration',
                query: context => new Promise((_resolve, reject) => {
                    context.signal.addEventListener('abort', () => reject(context.signal.reason), { once: true });
                    entered();
                }),
            } });
            const turn = platform.agentConversation({ message: 'Cancel this admitted query', persistMemory: true }, controller.signal).catch(error => error);
            await started;
            const start = performance.now();
            controller.abort();
            const error = await turn;
            if (error.code !== 'runtime_cancelled') throw new Error('Cancellation failed to stop the calibration turn.');
            cancellationSamples.push(performance.now() - start);
        }

        let release;
        const held = new Promise(resolve => { release = resolve; });
        const admitted = new KnowledgeLearningPlatform({ autoPersist: false, graphQueryBackend: { id: 'admission-calibration', query: async () => { await held; return { candidates: [] }; } } });
        const turns = Array.from({ length: 12 }, (_, index) => admitted.agentConversation({ message: `Turn ${index}`, persistMemory: false }));
        const outcomes = Promise.allSettled(turns);
        release();
        const settled = await outcomes;
        const turnAdmission = { requested: turns.length, completed: settled.filter(turn => turn.status === 'fulfilled').length,
            capacityRejected: settled.filter(turn => turn.status === 'rejected' && turn.reason.code === 'runtime_turn_capacity').length };
        if (turnAdmission.completed !== 8 || turnAdmission.capacityRejected !== 4) throw new Error('Turn admission contract drifted.');

        const { GraphBuilder } = require('../dist/src/backend/GraphBuilder');
        const { config } = require('../dist/src/backend/config');
        const matching = require('../dist/src/backend/utils/stringUtils');
        const checkMatch = matching.checkMatch;
        const matchingMeasurements = [];
        const originalConfig = { ...config };
        try {
            Object.assign(config, { enableTags: false, enableStatisticalInference: false, enableVectorSimilarity: false,
                enableHybridInference: false, enableGPU: false, enableGPULayout: false, maxWorkers: 1, clusteringStrategy: 'folder' });
            const files = Array.from({ length: 150 }, (_, index) => ({ filename: `Term${index}`, filepath: path.join(fixtureRoot, `Term${index}.md`), content: `Term${(index + 1) % 150} is connected to Term${(index + 2) % 150}.` }));
            for (const strategy of ['exact-phrase', 'fuzzy']) {
                config.matchingStrategy = strategy;
                let comparisons = 0;
                matching.checkMatch = (...args) => { comparisons++; return checkMatch(...args); };
                const durations = [];
                let edges = 0;
                for (let iteration = 0; iteration < 5; iteration++) {
                    const start = performance.now();
                    const graph = await GraphBuilder.build(files);
                    durations.push(performance.now() - start);
                    edges = graph.getEdges().filter(edge => edge.type === 'keyword-match').length;
                }
                matchingMeasurements.push({ strategy, documentCount: files.length, comparisonsPerBuild: comparisons / 5, keywordEdges: edges, latencyMs: distribution(durations) });
            }
        } finally { matching.checkMatch = checkMatch; Object.assign(config, originalConfig); }

        const report = {
            measuredAt: new Date().toISOString(), sourceTreeHash: computeSidecarSourceFingerprint(repoRoot).digest,
            host: { platform: process.platform, arch: process.arch, node: process.version, totalMemoryBytes: os.totalmem(), logicalCpus: os.cpus().length },
            policy: DEFAULT_AGENT_CONVERSATION_EXECUTION_POLICY, snapshots, sourceAdmission, turnAdmission,
            cooperativeCancellationLatencyMs: distribution(cancellationSamples), matching: matchingMeasurements,
            peakProcessRssBytes: process.resourceUsage().maxRSS * 1024,
            limitations: [
                'Synthetic scale calibration; not a claim about every user knowledge base.',
                'Mutation latency includes snapshot preparation, rollback preimage cloning and durable file persistence.',
                'Heap growth samples do not capture every transient allocation. RSS is a process-wide high-water mark.',
                'Cancellation samples use a cooperative backend. A provider ignoring AbortSignal remains leased until quiescent.',
                'Fuzzy matching retains complete candidate scans; worst-case matching remains quadratic.',
            ],
        };
        const reportPath = path.join(outputRoot, `convergence-runtime-${report.measuredAt.replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
        fs.writeFileSync(path.join(outputRoot, 'convergence-runtime-latest.json'), JSON.stringify(report, null, 2) + '\n');
        console.log(JSON.stringify({ report: reportPath, snapshots, cooperativeCancellationLatencyMs: report.cooperativeCancellationLatencyMs, turnAdmission, matching: matchingMeasurements }, null, 2));
    } finally { fs.rmSync(fixtureRoot, { recursive: true, force: true }); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
