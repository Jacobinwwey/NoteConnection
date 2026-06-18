import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    createGraphQueryBackend,
    normalizeLocalVectorAccelerationFailureMode,
    normalizeGraphQueryBackendType,
} from './queryBackend';
import type { KnowledgeAtom, RelationEdge } from './types';

function makeAtom(id: string, title: string, content: string, keywords: string[], language = 'en'): KnowledgeAtom {
    return {
        id,
        stableKey: id,
        documentId: `${id}_doc`,
        sourcePath: `Knowledge_Base/${id}.md`,
        title,
        content,
        representationType: 'text',
        keywords,
        evidenceSpanIds: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        metadata: {
            sectionPath: [title],
            version: 1,
            sourceHash: 'hash',
            language,
        },
    };
}

describe('query backend factory', () => {
    test('normalizes query backend aliases', () => {
        expect(normalizeGraphQueryBackendType('keyword')).toBe('keyword_only');
        expect(normalizeGraphQueryBackendType('keyword-only')).toBe('keyword_only');
        expect(normalizeGraphQueryBackendType('vector')).toBe('local_vector');
        expect(normalizeGraphQueryBackendType('semantic-vector')).toBe('local_vector');
        expect(normalizeGraphQueryBackendType('local_hybrid')).toBe('local_hybrid');
        expect(normalizeGraphQueryBackendType('unknown')).toBe('local_hybrid');
    });

    test('normalizes local vector acceleration failure mode aliases', () => {
        expect(normalizeLocalVectorAccelerationFailureMode('fail_open')).toBe('fail_open');
        expect(normalizeLocalVectorAccelerationFailureMode('fail-closed')).toBe('fail_closed');
        expect(normalizeLocalVectorAccelerationFailureMode('strict')).toBe('fail_closed');
        expect(normalizeLocalVectorAccelerationFailureMode('unknown')).toBe('fail_open');
    });

    test('keyword-only backend returns keyword/temporal retrieval modes', async () => {
        const backend = createGraphQueryBackend({ backend: 'keyword_only' });
        const atoms: KnowledgeAtom[] = [
            makeAtom('atom_a', 'Alpha Topic', 'alpha retrieval baseline', ['alpha', 'retrieval']),
            makeAtom('atom_b', 'Beta Topic', 'beta unrelated', ['beta']),
        ];
        const activeEdges: RelationEdge[] = [];
        const result = await backend.query({
            request: {
                query: 'alpha retrieval',
                topK: 3,
            },
            query: 'alpha retrieval',
            queryTokens: ['alpha', 'retrieval'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 3,
            atoms,
            activeEdges,
        });

        expect(backend.id).toBe('keyword-only-v1');
        expect(result.candidates.length).toBeGreaterThan(0);
        expect(result.trace?.retrievalModes).toContain('keyword');
        expect(result.trace?.retrievalModes).toContain('temporal_filter');
        expect(result.trace?.retrievalModes).not.toContain('semantic_similarity');
    });

    test('local hybrid backend includes semantic similarity mode', async () => {
        const backend = createGraphQueryBackend({ backend: 'local_hybrid' });
        const atoms: KnowledgeAtom[] = [
            makeAtom('atom_a', 'Alpha Topic', 'alpha retrieval baseline', ['alpha', 'retrieval']),
            makeAtom('atom_b', 'Beta Topic', 'beta unrelated', ['beta']),
        ];
        const activeEdges: RelationEdge[] = [
            {
                id: 'edge_ab',
                sourceAtomId: 'atom_a',
                targetAtomId: 'atom_b',
                relationKind: 'reference',
                provenance: 'fact',
                confidence: 0.8,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-01-01T00:00:00.000Z',
                },
            },
        ];
        const result = await backend.query({
            request: {
                query: 'alpha retrieval',
                topK: 3,
            },
            query: 'alpha retrieval',
            queryTokens: ['alpha', 'retrieval'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 3,
            atoms,
            activeEdges,
        });

        expect(backend.id).toBe('local-hybrid-v1');
        expect(result.candidates.length).toBeGreaterThan(0);
        expect(result.trace?.retrievalModes).toContain('semantic_similarity');
        expect(result.trace?.modeWeights?.semantic).toBeGreaterThan(0);
    });

    test('local vector backend includes vector similarity mode', async () => {
        const backend = createGraphQueryBackend({ backend: 'local_vector' });
        const atoms: KnowledgeAtom[] = [
            makeAtom('atom_a', 'Retrieval Vector Topic', 'vector embeddings and semantic index', ['vector', 'semantic']),
            makeAtom('atom_b', 'Keyword Topic', 'keyword baseline only', ['keyword']),
        ];
        const activeEdges: RelationEdge[] = [
            {
                id: 'edge_ab',
                sourceAtomId: 'atom_a',
                targetAtomId: 'atom_b',
                relationKind: 'reference',
                provenance: 'fact',
                confidence: 0.8,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-01-01T00:00:00.000Z',
                },
            },
        ];
        const result = await backend.query({
            request: {
                query: 'semantic vector retrieval',
                topK: 3,
            },
            query: 'semantic vector retrieval',
            queryTokens: ['semantic', 'vector', 'retrieval'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 3,
            atoms,
            activeEdges,
        });

        expect(backend.id).toBe('local-vector-v1');
        expect(result.candidates.length).toBeGreaterThan(0);
        expect(result.trace?.retrievalModes).toContain('vector_similarity');
        expect(result.trace?.modeWeights?.vector).toBeGreaterThan(0);
        expect(result.trace?.vectorAcceleration?.representationVersion).toBe('local-vector-representation-v2');
        expect(result.trace?.vectorAcceleration?.embeddingModelId).toBe('local-semantic-tfidf-unicode-v2');
        expect(result.trace?.vectorAcceleration?.representationStatus).toBe('aligned');
        expect(typeof result.trace?.vectorAcceleration?.embeddingDimension).toBe('number');
    });

    test('local vector backend matches Chinese semantic overlap without ASCII-only token loss', async () => {
        const backend = createGraphQueryBackend({ backend: 'local_vector' });
        const atoms: KnowledgeAtom[] = [
            makeAtom(
                'atom_cn',
                '吸收系数',
                '材料的吸收系数决定光在介质中的衰减与穿透深度。',
                ['吸收', '系数', '光学'],
                'zh'
            ),
            makeAtom(
                'atom_other',
                '散射机制',
                '散射描述光线偏离原始传播方向的过程。',
                ['散射'],
                'zh'
            ),
        ];
        const result = await backend.query({
            request: {
                query: '吸收系数 光学',
                topK: 3,
            },
            query: '吸收系数 光学',
            queryTokens: ['吸收系数', '光学'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 3,
            atoms,
            activeEdges: [],
        });

        expect(result.candidates.length).toBeGreaterThan(0);
        expect(result.candidates[0]?.atomId).toBe('atom_cn');
        expect(result.trace?.retrievalModes).toContain('vector_similarity');
    });

    test('local vector backend persists and reuses vector index snapshot', async () => {
        const tempDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'query-vector-index-'));
        const indexPath = path.join(tempDir, 'local_vector_index.v1.json');
        try {
            const atoms: KnowledgeAtom[] = [
                makeAtom('atom_a', 'Semantic Retrieval', 'semantic vector retrieval coverage', ['semantic', 'retrieval']),
                makeAtom('atom_b', 'Temporal Alignment', 'temporal validity and trace checks', ['temporal', 'trace']),
            ];
            const activeEdges: RelationEdge[] = [];
            const context = {
                request: {
                    query: 'semantic retrieval',
                    topK: 3,
                },
                query: 'semantic retrieval',
                queryTokens: ['semantic', 'retrieval'],
                asOf: '2026-01-01T00:00:00.000Z',
                topK: 3,
                atoms,
                activeEdges,
            };

            const firstBackend = createGraphQueryBackend({
                backend: 'local_vector',
                localVectorIndexPath: indexPath,
            });
            const firstResult = await firstBackend.query(context);
            expect(firstResult.trace?.retrievalModes).toContain('vector_similarity');
            expect(fs.existsSync(indexPath)).toBe(true);
            const firstDiagnostics = firstBackend.getDiagnostics?.();
            expect(firstDiagnostics?.vectorIndex?.status).toBe('ready');
            expect(firstDiagnostics?.vectorIndex?.persisted).toBe(true);
            expect(firstDiagnostics?.vectorIndex?.loadedFromDisk).toBe(false);
            expect(firstDiagnostics?.vectorIndex?.acceleration?.representationStatus).toBe('aligned');
            expect(firstDiagnostics?.vectorIndex?.acceleration?.representationVersion).toBe(
                'local-vector-representation-v2'
            );
            const signature = firstDiagnostics?.vectorIndex?.signature;

            const secondBackend = createGraphQueryBackend({
                backend: 'local_vector',
                localVectorIndexPath: indexPath,
            });
            const secondResult = await secondBackend.query(context);
            expect(secondResult.trace?.retrievalModes).toContain('vector_similarity');
            const secondDiagnostics = secondBackend.getDiagnostics?.();
            expect(secondDiagnostics?.vectorIndex?.status).toBe('ready');
            expect(secondDiagnostics?.vectorIndex?.loadedFromDisk).toBe(true);
            expect(secondDiagnostics?.vectorIndex?.persisted).toBe(true);
            expect(secondDiagnostics?.vectorIndex?.signature).toBe(signature);
            expect(secondDiagnostics?.vectorIndex?.location).toBe(path.resolve(indexPath));
            expect(secondDiagnostics?.vectorIndex?.acceleration?.representationStatus).toBe('aligned');
            expect(secondDiagnostics?.vectorIndex?.acceleration?.embeddingModelId).toBe(
                'local-semantic-tfidf-unicode-v2'
            );
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('local vector backend diagnostics move stale->ready after explicit invalidation and refresh', async () => {
        const backend = createGraphQueryBackend({ backend: 'local_vector' });
        const atoms: KnowledgeAtom[] = [
            makeAtom('atom_a', 'Retention Loop', 'retention and retrieval stability', ['retention', 'retrieval']),
            makeAtom('atom_b', 'Spacing Loop', 'spacing and review cadence', ['spacing', 'review']),
        ];
        const activeEdges: RelationEdge[] = [];
        const context = {
            request: {
                query: 'retrieval retention',
                topK: 3,
            },
            query: 'retrieval retention',
            queryTokens: ['retrieval', 'retention'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 3,
            atoms,
            activeEdges,
        };

        await backend.query(context);
        const readyDiagnostics = backend.getDiagnostics?.();
        expect(readyDiagnostics?.vectorIndex?.status).toBe('ready');

        backend.invalidate?.('unit_test_ingest_refresh');
        const staleDiagnostics = backend.getDiagnostics?.();
        expect(staleDiagnostics?.vectorIndex?.status).toBe('stale');

        await backend.query(context);
        const recoveredDiagnostics = backend.getDiagnostics?.();
        expect(recoveredDiagnostics?.vectorIndex?.status).toBe('ready');
    });

    test('local hybrid backend matches lexical variants through semantic stemming', async () => {
        const localBackend = createGraphQueryBackend({ backend: 'local_hybrid' });
        const keywordBackend = createGraphQueryBackend({ backend: 'keyword_only' });
        const atoms: KnowledgeAtom[] = [
            makeAtom(
                'atom_retest',
                'Retesting Cadence',
                'Use periodic retesting windows to stabilize mastery after diagnostics.',
                ['cadence', 'mastery']
            ),
            makeAtom('atom_other', 'Baseline Topic', 'baseline note unrelated to retest loop', ['baseline']),
        ];
        const activeEdges: RelationEdge[] = [];
        const context = {
            request: {
                query: 'retests',
                topK: 3,
            },
            query: 'retests',
            queryTokens: ['retests'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 3,
            atoms,
            activeEdges,
        };

        const keywordResult = await keywordBackend.query(context);
        const localResult = await localBackend.query(context);

        expect(keywordResult.candidates.some((candidate) => candidate.atomId === 'atom_retest')).toBe(false);
        expect(localResult.candidates.some((candidate) => candidate.atomId === 'atom_retest')).toBe(true);
        expect(localResult.trace?.retrievalModes).toContain('semantic_similarity');
    });

    test('local hybrid ranking favors anchor-connected prerequisite structure over an unrelated high-degree hub', async () => {
        const backend = createGraphQueryBackend({ backend: 'local_hybrid' });
        const atoms: KnowledgeAtom[] = [
            makeAtom('atom_anchor', 'Ground State', 'ground state calibration target for the optics workflow', ['ground', 'state', 'calibration']),
            makeAtom('atom_prerequisite', 'Foundation Step', 'foundation prerequisite for calibration and setup', ['foundation', 'calibration', 'setup']),
            makeAtom('atom_hub', 'Optics Index', 'broad optics index with calibration overview references', ['optics', 'calibration', 'overview']),
            makeAtom('atom_extra_a', 'Reference A', 'generic optics reference', ['reference']),
            makeAtom('atom_extra_b', 'Reference B', 'generic optics reference', ['reference']),
            makeAtom('atom_extra_c', 'Reference C', 'generic optics reference', ['reference']),
            makeAtom('atom_extra_d', 'Reference D', 'generic optics reference', ['reference']),
        ];
        const activeEdges: RelationEdge[] = [
            {
                id: 'edge_prerequisite_anchor',
                sourceAtomId: 'atom_prerequisite',
                targetAtomId: 'atom_anchor',
                relationKind: 'prerequisite',
                provenance: 'fact',
                confidence: 0.94,
                evidenceSpanIds: [],
                temporal: { validFrom: '2026-01-01T00:00:00.000Z' },
            },
            {
                id: 'edge_hub_a',
                sourceAtomId: 'atom_hub',
                targetAtomId: 'atom_extra_a',
                relationKind: 'reference',
                provenance: 'fact',
                confidence: 0.81,
                evidenceSpanIds: [],
                temporal: { validFrom: '2026-01-01T00:00:00.000Z' },
            },
            {
                id: 'edge_hub_b',
                sourceAtomId: 'atom_hub',
                targetAtomId: 'atom_extra_b',
                relationKind: 'reference',
                provenance: 'fact',
                confidence: 0.81,
                evidenceSpanIds: [],
                temporal: { validFrom: '2026-01-01T00:00:00.000Z' },
            },
            {
                id: 'edge_hub_c',
                sourceAtomId: 'atom_hub',
                targetAtomId: 'atom_extra_c',
                relationKind: 'reference',
                provenance: 'fact',
                confidence: 0.81,
                evidenceSpanIds: [],
                temporal: { validFrom: '2026-01-01T00:00:00.000Z' },
            },
            {
                id: 'edge_hub_d',
                sourceAtomId: 'atom_hub',
                targetAtomId: 'atom_extra_d',
                relationKind: 'reference',
                provenance: 'fact',
                confidence: 0.81,
                evidenceSpanIds: [],
                temporal: { validFrom: '2026-01-01T00:00:00.000Z' },
            },
        ];
        const result = await backend.query({
            request: {
                query: 'how to calibrate ground state',
                topK: 4,
            },
            query: 'how to calibrate ground state',
            queryTokens: ['how', 'to', 'calibrate', 'ground', 'state'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 4,
            atoms,
            activeEdges,
        });

        const rankedAtomIds = result.candidates.map((candidate) => candidate.atomId);
        expect(rankedAtomIds.indexOf('atom_anchor')).toBeGreaterThanOrEqual(0);
        expect(rankedAtomIds.indexOf('atom_prerequisite')).toBeGreaterThanOrEqual(0);
        expect(rankedAtomIds.slice(0, 2)).toEqual(expect.arrayContaining(['atom_anchor', 'atom_prerequisite']));
        if (rankedAtomIds.includes('atom_hub')) {
            expect(rankedAtomIds.indexOf('atom_anchor')).toBeLessThan(rankedAtomIds.indexOf('atom_hub'));
            expect(rankedAtomIds.indexOf('atom_prerequisite')).toBeLessThan(rankedAtomIds.indexOf('atom_hub'));
        }
        expect(result.trace?.retrievalModes).toEqual(expect.arrayContaining([
            'graph_anchor_distance',
            'graph_path_confidence',
            'graph_intent_match',
        ]));
    });

    test('local hybrid ranking uses Chinese compare intent to favor contrast structure over a lexically stronger reference note', async () => {
        const backend = createGraphQueryBackend({ backend: 'local_hybrid' });
        const atoms: KnowledgeAtom[] = [
            makeAtom('atom_anchor_cn', '反射', '反射描述光线返回原介质的现象。', ['反射'], 'zh'),
            makeAtom('atom_contrast_cn', '吸收', '吸收表示光能被材料消耗。', ['吸收'], 'zh'),
            makeAtom('atom_reference_cn', '光学概览', '反射 概览 与 现象 说明。', ['概览'], 'zh'),
        ];
        const activeEdges: RelationEdge[] = [
            {
                id: 'edge_contrast_cn',
                sourceAtomId: 'atom_contrast_cn',
                targetAtomId: 'atom_anchor_cn',
                relationKind: 'contrast',
                provenance: 'fact',
                confidence: 0.96,
                evidenceSpanIds: [],
                temporal: { validFrom: '2026-01-01T00:00:00.000Z' },
            },
            {
                id: 'edge_reference_cn',
                sourceAtomId: 'atom_reference_cn',
                targetAtomId: 'atom_anchor_cn',
                relationKind: 'reference',
                provenance: 'fact',
                confidence: 0.88,
                evidenceSpanIds: [],
                temporal: { validFrom: '2026-01-01T00:00:00.000Z' },
            },
        ];

        const result = await backend.query({
            request: {
                query: '对比反射现象',
                topK: 3,
            },
            query: '对比反射现象',
            queryTokens: ['对比', '反射', '现象'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 3,
            atoms,
            activeEdges,
        });

        const rankedAtomIds = result.candidates.map((candidate) => candidate.atomId);
        expect(rankedAtomIds.indexOf('atom_anchor_cn')).toBeGreaterThanOrEqual(0);
        expect(rankedAtomIds.indexOf('atom_contrast_cn')).toBeGreaterThanOrEqual(0);
        expect(rankedAtomIds.indexOf('atom_reference_cn')).toBeGreaterThanOrEqual(0);
        expect(rankedAtomIds.indexOf('atom_contrast_cn')).toBeLessThan(rankedAtomIds.indexOf('atom_reference_cn'));
    });

    test('local vector ranking penalizes a temporally invalid candidate even when semantic overlap is strong', async () => {
        const backend = createGraphQueryBackend({ backend: 'local_vector' });
        const atoms: KnowledgeAtom[] = [
            makeAtom('atom_fresh', 'Ground State', 'ground state calibration target with verified optics semantics', ['ground', 'state', 'calibration']),
            makeAtom('atom_stale', 'Ground State Draft', 'ground state calibration target with verified optics semantics', ['ground', 'state', 'calibration']),
        ];
        const result = await backend.query({
            request: {
                query: 'ground state calibration',
                topK: 3,
            },
            query: 'ground state calibration',
            queryTokens: ['ground', 'state', 'calibration'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 3,
            atoms,
            activeEdges: [],
            atomTemporalValidity: {
                atom_fresh: {
                    isValid: true,
                    reasonCount: 1,
                    supersedesCount: 1,
                },
                atom_stale: {
                    isValid: false,
                    reasonCount: 2,
                    supersedesCount: 0,
                },
            },
        });

        expect(result.candidates[0]?.atomId).toBe('atom_fresh');
        expect(result.candidates.map((candidate) => candidate.atomId)).toContain('atom_stale');
        expect(result.trace?.retrievalModes).toEqual(expect.arrayContaining([
            'graph_anchor_distance',
            'graph_path_confidence',
            'graph_intent_match',
            'temporal_filter',
        ]));
    });

    test('local vector backend enables ann prefilter on large corpora', async () => {
        const backend = createGraphQueryBackend({ backend: 'local_vector' });
        const atoms: KnowledgeAtom[] = [];
        for (let index = 0; index < 160; index += 1) {
            const bucket = index < 72 ? 'retrieval' : 'baseline';
            atoms.push(
                makeAtom(
                    `atom_${index}`,
                    `${bucket} topic ${index}`,
                    `${bucket} mastery flow diagnostics coverage ${index}`,
                    [bucket, 'mastery', 'diagnostics']
                )
            );
        }
        const context = {
            request: {
                query: 'retrieval mastery diagnostics',
                topK: 4,
            },
            query: 'retrieval mastery diagnostics',
            queryTokens: ['retrieval', 'mastery', 'diagnostics'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 4,
            atoms,
            activeEdges: [] as RelationEdge[],
        };

        const result = await backend.query(context);
        expect(result.candidates.length).toBeGreaterThan(0);
        expect(result.trace?.retrievalModes).toContain('vector_similarity');
        expect(result.trace?.retrievalModes).toContain('ann_prefilter');
        expect(result.trace?.vectorAcceleration?.mode).toBe('ann_prefilter');
        expect(['token_prefilter', 'token_signature_prefilter']).toContain(
            String(result.trace?.vectorAcceleration?.selectionMode || '')
        );
        expect(Number(result.trace?.vectorAcceleration?.candidateCount || 0)).toBeGreaterThan(0);
        expect(typeof result.trace?.vectorAcceleration?.adapterId).toBe('string');
    });

    test('local vector backend falls back to full scan when ann candidate pool is too small', async () => {
        const backend = createGraphQueryBackend({ backend: 'local_vector' });
        const atoms: KnowledgeAtom[] = [];
        for (let index = 0; index < 120; index += 1) {
            atoms.push(
                makeAtom(
                    `atom_${index}`,
                    `baseline topic ${index}`,
                    `baseline mastery diagnostics coverage ${index}`,
                    ['baseline', 'mastery', 'diagnostics']
                )
            );
        }
        atoms.push(
            makeAtom(
                'atom_rare',
                'ultrarare diagnostics',
                'ultrarare retrieval branch',
                ['ultrarare', 'retrieval']
            )
        );
        const context = {
            request: {
                query: 'ultrarare retrieval',
                topK: 3,
            },
            query: 'ultrarare retrieval',
            queryTokens: ['ultrarare', 'retrieval'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 3,
            atoms,
            activeEdges: [] as RelationEdge[],
        };

        const result = await backend.query(context);
        expect(result.candidates.some((candidate) => candidate.atomId === 'atom_rare')).toBe(true);
        expect(result.trace?.retrievalModes).toContain('vector_similarity');
        expect(result.trace?.retrievalModes).not.toContain('ann_prefilter');
        expect(result.trace?.vectorAcceleration?.mode).toBe('full_scan');
        expect(result.trace?.vectorAcceleration?.selectionMode).toBe('full_scan');
    });

    test('local vector backend can disable ann prefilter via factory option and exposes diagnostics mode', async () => {
        const backend = createGraphQueryBackend({
            backend: 'local_vector',
            localVectorAnnPrefilterEnabled: false,
        });
        const atoms: KnowledgeAtom[] = [];
        for (let index = 0; index < 160; index += 1) {
            atoms.push(
                makeAtom(
                    `atom_${index}`,
                    `retrieval topic ${index}`,
                    `retrieval mastery diagnostics coverage ${index}`,
                    ['retrieval', 'mastery', 'diagnostics']
                )
            );
        }
        const result = await backend.query({
            request: {
                query: 'retrieval mastery diagnostics',
                topK: 4,
            },
            query: 'retrieval mastery diagnostics',
            queryTokens: ['retrieval', 'mastery', 'diagnostics'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 4,
            atoms,
            activeEdges: [] as RelationEdge[],
        });

        expect(result.trace?.retrievalModes).toContain('vector_similarity');
        expect(result.trace?.retrievalModes).not.toContain('ann_prefilter');
        const diagnostics = backend.getDiagnostics?.();
        expect(diagnostics?.vectorIndex?.acceleration?.enabled).toBe(false);
        expect(diagnostics?.vectorIndex?.acceleration?.mode).toBe('full_scan');
    });

    test('local vector backend supports pluggable acceleration adapter contract', async () => {
        const backend = createGraphQueryBackend({
            backend: 'local_vector',
            localVectorAccelerationAdapter: {
                id: 'unit-adapter-v1',
                selectCandidates: () => ({
                    used: true,
                    candidateAtomIds: ['atom_focus'],
                    mode: 'token_prefilter',
                }),
            },
        });
        const atoms: KnowledgeAtom[] = [];
        for (let index = 0; index < 160; index += 1) {
            atoms.push(
                makeAtom(
                    `atom_${index}`,
                    `baseline topic ${index}`,
                    `baseline mastery diagnostics coverage ${index}`,
                    ['baseline', 'mastery']
                )
            );
        }
        atoms.push(
            makeAtom(
                'atom_focus',
                'retrieval focus',
                'retrieval mastery diagnostics critical note',
                ['retrieval', 'mastery', 'diagnostics']
            )
        );
        const result = await backend.query({
            request: {
                query: 'retrieval mastery diagnostics',
                topK: 4,
            },
            query: 'retrieval mastery diagnostics',
            queryTokens: ['retrieval', 'mastery', 'diagnostics'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 4,
            atoms,
            activeEdges: [] as RelationEdge[],
        });

        expect(result.candidates.some((candidate) => candidate.atomId === 'atom_focus')).toBe(true);
        expect(result.trace?.retrievalModes).toContain('ann_prefilter');
        expect(result.trace?.vectorAcceleration?.adapterId).toBe('unit-adapter-v1');
        expect(result.trace?.vectorAcceleration?.mode).toBe('ann_prefilter');
        const diagnostics = backend.getDiagnostics?.();
        expect(diagnostics?.vectorIndex?.acceleration?.adapterId).toBe('unit-adapter-v1');
        expect(diagnostics?.vectorIndex?.acceleration?.mode).toBe('ann_prefilter');
    });

    test('local vector backend syncs acceleration adapter index before candidate selection', async () => {
        const callSequence: string[] = [];
        const syncedIndexSignatures: string[] = [];
        const backend = createGraphQueryBackend({
            backend: 'local_vector',
            localVectorAccelerationAdapter: {
                id: 'sync-aware-adapter-v1',
                syncIndex: (input) => {
                    callSequence.push('sync');
                    syncedIndexSignatures.push(String(input.indexSignature || ''));
                    return {
                        synced: true,
                        atomCount: input.atomCount,
                        indexSignature: String(input.indexSignature || ''),
                        representation: {
                            version: String(input.representationVersion || ''),
                            embeddingModelId: String(input.embeddingModelId || ''),
                            embeddingDimension: Number(input.embeddingDimension || 0),
                            indexSignature: String(input.indexSignature || ''),
                            validated: true,
                        },
                    };
                },
                selectCandidates: () => {
                    callSequence.push('select');
                    return {
                        used: true,
                        candidateAtomIds: ['atom_focus'],
                        mode: 'token_prefilter',
                    };
                },
                getHealth: () => ({
                    status: 'ready',
                    indexSyncStatus: 'ready',
                    syncRequestCount: 1,
                    syncSuccessCount: 1,
                    syncedIndexSignature: syncedIndexSignatures[0] || '',
                    syncedAtomCount: 161,
            representationVersion: 'local-vector-representation-v2',
            embeddingModelId: 'local-semantic-tfidf-unicode-v2',
                    embeddingDimension: 3,
                    indexSignature: syncedIndexSignatures[0] || '',
                    representationStatus: 'aligned',
                }),
            },
        });
        const atoms: KnowledgeAtom[] = [];
        for (let index = 0; index < 160; index += 1) {
            atoms.push(
                makeAtom(
                    `atom_${index}`,
                    `baseline topic ${index}`,
                    `baseline mastery diagnostics coverage ${index}`,
                    ['baseline', 'mastery']
                )
            );
        }
        atoms.push(
            makeAtom(
                'atom_focus',
                'retrieval focus',
                'retrieval mastery diagnostics critical note',
                ['retrieval', 'mastery', 'diagnostics']
            )
        );

        const result = await backend.query({
            request: {
                query: 'retrieval mastery diagnostics',
                topK: 4,
            },
            query: 'retrieval mastery diagnostics',
            queryTokens: ['retrieval', 'mastery', 'diagnostics'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 4,
            atoms,
            activeEdges: [] as RelationEdge[],
        });

        expect(result.candidates.some((candidate) => candidate.atomId === 'atom_focus')).toBe(true);
        expect(callSequence[0]).toBe('sync');
        expect(callSequence[1]).toBe('select');
        expect(String(syncedIndexSignatures[0] || '')).not.toBe('');

        const diagnostics = backend.getDiagnostics?.();
        expect(diagnostics?.vectorIndex?.acceleration?.indexSyncStatus).toBe('ready');
        expect(diagnostics?.vectorIndex?.acceleration?.syncRequestCount).toBe(1);
        expect(diagnostics?.vectorIndex?.acceleration?.syncSuccessCount).toBe(1);
        expect(String(diagnostics?.vectorIndex?.acceleration?.syncedIndexSignature || '')).toBe(
            String(syncedIndexSignatures[0] || '')
        );
    });

    test('local vector backend exposes adapter health telemetry in query trace vectorAcceleration', async () => {
        const backend = createGraphQueryBackend({
            backend: 'local_vector',
            localVectorAccelerationAdapter: {
                id: 'telemetry-adapter-v1',
                selectCandidates: () => ({
                    used: true,
                    candidateAtomIds: ['atom_focus'],
                    mode: 'token_prefilter',
                }),
                getHealth: () => ({
                    status: 'degraded',
                    circuitState: 'open',
                    lastRequestId: 'connector-req-42',
                    lastErrorCode: 'upstream_503',
                    lastRetryAfterMs: 1200,
                    representationVersion: 'remote-representation-v2',
                    embeddingModelId: 'remote-embedding-v2',
                    embeddingDimension: 64,
                    indexSignature: 'remote_sig_v2',
                }),
            },
        });
        const atoms: KnowledgeAtom[] = [];
        for (let index = 0; index < 160; index += 1) {
            atoms.push(
                makeAtom(
                    `atom_${index}`,
                    `baseline topic ${index}`,
                    `baseline mastery diagnostics coverage ${index}`,
                    ['baseline', 'mastery']
                )
            );
        }
        atoms.push(
            makeAtom(
                'atom_focus',
                'retrieval focus',
                'retrieval mastery diagnostics critical note',
                ['retrieval', 'mastery', 'diagnostics']
            )
        );

        const result = await backend.query({
            request: {
                query: 'retrieval mastery diagnostics',
                topK: 4,
            },
            query: 'retrieval mastery diagnostics',
            queryTokens: ['retrieval', 'mastery', 'diagnostics'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 4,
            atoms,
            activeEdges: [] as RelationEdge[],
        });

        expect(result.trace?.vectorAcceleration?.adapterId).toBe('telemetry-adapter-v1');
        expect(result.trace?.vectorAcceleration?.healthStatus).toBe('degraded');
        expect(result.trace?.vectorAcceleration?.circuitState).toBe('open');
        expect(result.trace?.vectorAcceleration?.lastRequestId).toBe('connector-req-42');
        expect(result.trace?.vectorAcceleration?.lastErrorCode).toBe('upstream_503');
        expect(result.trace?.vectorAcceleration?.lastRetryAfterMs).toBe(1200);
        expect(result.trace?.vectorAcceleration?.representationVersion).toBe('remote-representation-v2');
        expect(result.trace?.vectorAcceleration?.embeddingModelId).toBe('remote-embedding-v2');
        expect(result.trace?.vectorAcceleration?.representationStatus).toBe('mismatch');
        expect(String(result.trace?.vectorAcceleration?.representationStatusReason || '')).toContain(
            'representation_version'
        );

        const diagnostics = backend.getDiagnostics?.();
        expect(diagnostics?.vectorIndex?.acceleration?.representationVersion).toBe('remote-representation-v2');
        expect(diagnostics?.vectorIndex?.acceleration?.representationStatus).toBe('mismatch');
    });

    test('local vector backend fails when representation mismatch is detected in strict mode', async () => {
        const backend = createGraphQueryBackend({
            backend: 'local_vector',
            localVectorAccelerationRepresentationStrict: true,
            localVectorAccelerationAdapter: {
                id: 'strict-representation-adapter-v1',
                selectCandidates: () => ({
                    used: true,
                    candidateAtomIds: ['atom_focus'],
                    mode: 'token_prefilter',
                }),
                getHealth: () => ({
                    status: 'ready',
                    circuitState: 'closed',
                    representationVersion: 'remote-representation-v2',
                    embeddingModelId: 'remote-embedding-v2',
                    embeddingDimension: 64,
                    indexSignature: 'remote_sig_v2',
                }),
            },
        });
        const atoms: KnowledgeAtom[] = [];
        for (let index = 0; index < 160; index += 1) {
            atoms.push(
                makeAtom(
                    `atom_${index}`,
                    `baseline topic ${index}`,
                    `baseline mastery diagnostics coverage ${index}`,
                    ['baseline', 'mastery']
                )
            );
        }
        atoms.push(
            makeAtom(
                'atom_focus',
                'retrieval focus',
                'retrieval mastery diagnostics critical note',
                ['retrieval', 'mastery', 'diagnostics']
            )
        );

        await expect(backend.query({
            request: {
                query: 'retrieval mastery diagnostics',
                topK: 4,
            },
            query: 'retrieval mastery diagnostics',
            queryTokens: ['retrieval', 'mastery', 'diagnostics'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 4,
            atoms,
            activeEdges: [] as RelationEdge[],
        })).rejects.toThrow('vector_acceleration_representation_mismatch');

        const diagnostics = backend.getDiagnostics?.();
        expect(diagnostics?.vectorIndex?.acceleration?.representationStrictMode).toBe(true);
        expect(diagnostics?.vectorIndex?.acceleration?.representationStatus).toBe('mismatch');
        expect(String(diagnostics?.vectorIndex?.acceleration?.adapterError || '')).toContain(
            'vector_acceleration_representation_mismatch'
        );
    });

    test('local vector backend falls back to full scan when acceleration adapter throws', async () => {
        const backend = createGraphQueryBackend({
            backend: 'local_vector',
            localVectorAccelerationAdapter: {
                id: 'unit-adapter-throw',
                selectCandidates: () => {
                    throw new Error('adapter_crash');
                },
            },
        });
        const atoms: KnowledgeAtom[] = [];
        for (let index = 0; index < 160; index += 1) {
            atoms.push(
                makeAtom(
                    `atom_${index}`,
                    `retrieval topic ${index}`,
                    `retrieval mastery diagnostics coverage ${index}`,
                    ['retrieval', 'mastery', 'diagnostics']
                )
            );
        }
        const result = await backend.query({
            request: {
                query: 'retrieval mastery diagnostics',
                topK: 4,
            },
            query: 'retrieval mastery diagnostics',
            queryTokens: ['retrieval', 'mastery', 'diagnostics'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 4,
            atoms,
            activeEdges: [] as RelationEdge[],
        });

        expect(result.candidates.length).toBeGreaterThan(0);
        expect(result.trace?.retrievalModes).not.toContain('ann_prefilter');
        const diagnostics = backend.getDiagnostics?.();
        expect(diagnostics?.vectorIndex?.acceleration?.adapterId).toBe('unit-adapter-throw');
        expect(diagnostics?.vectorIndex?.acceleration?.mode).toBe('full_scan');
        expect(String(diagnostics?.vectorIndex?.acceleration?.adapterError || '')).toContain('adapter_crash');
    });

    test('local vector backend can fail closed when acceleration adapter throws', async () => {
        const backend = createGraphQueryBackend({
            backend: 'local_vector',
            localVectorAccelerationFailureMode: 'fail_closed',
            localVectorAccelerationAdapter: {
                id: 'unit-adapter-fail-closed',
                selectCandidates: () => {
                    throw new Error('adapter_crash_fail_closed');
                },
            },
        });
        const atoms: KnowledgeAtom[] = [];
        for (let index = 0; index < 160; index += 1) {
            atoms.push(
                makeAtom(
                    `atom_${index}`,
                    `retrieval topic ${index}`,
                    `retrieval mastery diagnostics coverage ${index}`,
                    ['retrieval', 'mastery', 'diagnostics']
                )
            );
        }

        await expect(backend.query({
            request: {
                query: 'retrieval mastery diagnostics',
                topK: 4,
            },
            query: 'retrieval mastery diagnostics',
            queryTokens: ['retrieval', 'mastery', 'diagnostics'],
            asOf: '2026-01-01T00:00:00.000Z',
            topK: 4,
            atoms,
            activeEdges: [] as RelationEdge[],
        })).rejects.toThrow('vector_acceleration_adapter_failure');

        const diagnostics = backend.getDiagnostics?.();
        expect(diagnostics?.vectorIndex?.acceleration?.failureMode).toBe('fail_closed');
        expect(String(diagnostics?.lastError || '')).toContain('vector_acceleration_adapter_failure');
    });
});
