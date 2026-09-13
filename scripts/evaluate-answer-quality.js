#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createHash } = require('crypto');
const { performance } = require('perf_hooks');
const { spawnSync } = require('child_process');
const { computeSidecarSourceFingerprint } = require('./sidecar-build-fingerprint');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORPUS_PATH = path.join(REPO_ROOT, 'fixtures', 'answer-quality', 'v2.json');

function distribution(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const percentile = q => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * q) - 1)] : null;
    return { count: sorted.length, min: sorted[0] ?? null, p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: sorted.at(-1) ?? null };
}

async function evaluateAnswerQuality({ repeats = 3, corpusPath = CORPUS_PATH, evaluationRole = 'regression', outputRoot = path.join(REPO_ROOT, 'output', 'verification', 'answer-quality') } = {}) {
    if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new Error('repeats must be an integer from 1 to 20');
    if (!['regression', 'confirmation'].includes(evaluationRole)) throw new Error('evaluationRole must be regression or confirmation');
    const { KnowledgeLearningPlatform } = require('../dist/src/learning/KnowledgeLearningPlatform');
    const { ANSWER_QUALITY_MEASUREMENT_PROTOCOL, parseAnswerQualityCorpus, measureAnswerQuality, summarizeAnswerQuality } = require('../dist/src/learning/AnswerQualityEvaluation');
    const { serializeAgentConversationResponse } = require('../dist/src/learning/agentConversationSerialization');
    const corpusBytes = fs.readFileSync(path.resolve(REPO_ROOT, corpusPath));
    const corpus = parseAnswerQualityCorpus(JSON.parse(corpusBytes.toString('utf8')));
    const rows = [];
    const timings = [];
    for (const entry of corpus.cases) {
        for (const responseMode of ['slim', 'full']) {
            const platform = new KnowledgeLearningPlatform({ autoPersist: false, nowProvider: () => new Date('2026-09-12T00:00:00.000Z') });
            await platform.ingestKnowledge({ documents: entry.documents, relationRecomputeMode: 'none' });
            const hashes = new Set();
            let first;
            for (let iteration = 0; iteration < repeats; iteration++) {
                const memoryBefore = process.memoryUsage();
                const startedAt = performance.now();
                try {
                    const response = serializeAgentConversationResponse(await platform.agentConversation({
                        userId: 'quality-evaluation', sessionId: `evaluation-${entry.id}-${responseMode}`,
                        message: entry.query, answerLanguage: entry.language, responseMode, persistMemory: false,
                        scope: { documentIds: entry.documents.map(document => document.documentId) },
                    })).result;
                    const elapsedMs = performance.now() - startedAt;
                    const memoryAfter = process.memoryUsage();
                    const measurement = measureAnswerQuality(entry, response);
                    const released = { answer: response.answer, citations: response.citations.map(citation => ({ documentId: citation.documentId, snippet: citation.snippet, sourcePath: citation.sourcePath })) };
                    hashes.add(createHash('sha256').update(JSON.stringify(released)).digest('hex'));
                    if (!first) first = { ...measurement, responseMode, answer: response.answer, citations: released.citations,
                        declaredReleaseDecision: response.answerReleaseReview?.decision,
                        responseTruncated: response.summary.responseTruncated === true };
                    timings.push({ caseId: entry.id, split: entry.split, language: entry.language, responseMode,
                        iteration, cache: iteration === 0 ? 'cold_instance' : 'hot_instance', elapsedMs,
                        heapUsedBefore: memoryBefore.heapUsed, heapUsedAfter: memoryAfter.heapUsed,
                        rssBefore: memoryBefore.rss, rssAfter: memoryAfter.rss });
                } catch (error) {
                    rows.push({ caseId: entry.id, split: entry.split, responseMode, error: error.message });
                    break;
                }
            }
            if (first) rows.push({ ...first, releasedAnswerStableAcrossRepeats: hashes.size === 1 });
        }
    }
    const groups = [];
    for (const split of ['calibration', 'evaluation']) for (const responseMode of ['slim', 'full']) {
        const samples = rows.filter(row => row.split === split && row.responseMode === responseMode && !row.error);
        const durations = timings.filter(row => row.split === split && row.responseMode === responseMode);
        groups.push({ split, responseMode, quality: summarizeAnswerQuality(samples),
            coldLatencyMs: distribution(durations.filter(row => row.cache === 'cold_instance').map(row => row.elapsedMs)),
            hotLatencyMs: distribution(durations.filter(row => row.cache === 'hot_instance').map(row => row.elapsedMs)) });
    }
    const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8', windowsHide: true });
    if (revision.status !== 0) throw new Error('Cannot record evaluation source revision');
    const report = {
        evaluatedAt: new Date().toISOString(), measurementProtocol: ANSWER_QUALITY_MEASUREMENT_PROTOCOL,
        corpusVersion: corpus.version, corpusRole: corpus.usageRole, evaluationRole,
        corpusSha256: createHash('sha256').update(corpusBytes).digest('hex'), sourceRevision: revision.stdout.trim(),
        sourceTreeHash: computeSidecarSourceFingerprint(REPO_ROOT).digest,
        executionCompleted: !rows.some(row => row.error) && rows.length === corpus.cases.length * 2,
        conditions: { backend: corpus.backend, responseModes: ['slim', 'full'], repeats,
            clock: 'fixed knowledge timestamp; real monotonic execution timers', node: process.version,
            platform: process.platform, arch: process.arch, logicalCpus: os.cpus().length,
            totalMemoryBytes: os.totalmem(), peakProcessRssBytes: process.resourceUsage().maxRSS * 1024,
            coldDefinition: 'First query on a new ingested platform instance; process/JIT is shared.',
            hotDefinition: 'Subsequent queries on the same platform instance; memory persistence disabled.' },
        measurementLimits: [
            'Reference acceptance and fact coverage use pre-authored patterns, not the runtime sufficiency judge.',
            'Unsupported assertion probes detect labelled counterfactuals only. They are not an exhaustive hallucination rate.',
            'Conflict and abstention are public-surface signals. Abstention includes a grounded absence of measurements, independently of the runtime release label; paraphrase and negation errors require manual adjudication.',
            'Correctness denominators count each case/mode once, not its timing repetitions. Bilingual pairs are correlated.',
            'Memory samples are before/after values; peakProcessRssBytes is a process-wide high-water mark, not per-turn peak heap.',
            'No learning-outcome data or participant observations were collected.',
        ],
        learningOutcomesQualified: false, groups, rows, timings,
    };
    fs.mkdirSync(outputRoot, { recursive: true });
    const datedPath = path.join(outputRoot, `answer-quality-report-${report.evaluatedAt.replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(datedPath, JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(path.join(outputRoot, 'answer-quality-report-latest.json'), JSON.stringify(report, null, 2) + '\n');
    return { report, datedPath };
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    const names = { '--repeats': 'repeats', '--corpus': 'corpusPath', '--output-root': 'outputRoot', '--evaluation-role': 'evaluationRole' };
    for (let index = 0; index < args.length; index += 2) {
        const name = names[args[index]];
        const value = args[index + 1];
        if (!name || !value || value.startsWith('--') || Object.hasOwn(options, name)) {
            throw new Error('Usage: node scripts/evaluate-answer-quality.js [--repeats 1..20] [--corpus path] [--output-root path] [--evaluation-role regression|confirmation]');
        }
        options[name] = name === 'repeats' ? Number(value) : value;
    }
    evaluateAnswerQuality(options).then(({ report, datedPath }) => {
        console.log(JSON.stringify({ report: datedPath, executionCompleted: report.executionCompleted, groups: report.groups }, null, 2));
        if (!report.executionCompleted) process.exitCode = 1;
    }).catch(error => { console.error(error); process.exitCode = 1; });
}

module.exports = { distribution, evaluateAnswerQuality };
