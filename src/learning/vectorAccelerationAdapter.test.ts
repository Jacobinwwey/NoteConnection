import {
    createVectorAccelerationAdapter,
    normalizeVectorAccelerationAdapterProvider,
} from './vectorAccelerationAdapter';

describe('vector acceleration adapter', () => {
    const originalFetch = globalThis.fetch;

    const baseSelectionInput = {
        atomCount: 180,
        queryTokens: ['retrieval', 'mastery'],
        queryWeights: new Map<string, number>([
            ['retrieval', 1.2],
            ['mastery', 0.8],
        ]),
        topK: 4,
        tokenToAtomIds: new Map<string, string[]>([
            ['retrieval', Array.from({ length: 60 }, (_v, index) => `atom_${index}`)],
            ['mastery', Array.from({ length: 40 }, (_v, index) => `atom_${index + 20}`)],
        ]),
        signatureBuckets: new Map<string, string[]>(),
        annPrefilterEnabled: true,
        representationVersion: 'local-vector-representation-v1',
        embeddingModelId: 'local-semantic-tfidf-v1',
        embeddingDimension: 512,
        indexSignature: 'idx_sig_abc123',
    };

    afterEach(() => {
        globalThis.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    test('normalizes acceleration adapter provider aliases', () => {
        expect(normalizeVectorAccelerationAdapterProvider('local')).toBe('local');
        expect(normalizeVectorAccelerationAdapterProvider('external_stub')).toBe('external_stub');
        expect(normalizeVectorAccelerationAdapterProvider('external-stub')).toBe('external_stub');
        expect(normalizeVectorAccelerationAdapterProvider('stub')).toBe('external_stub');
        expect(normalizeVectorAccelerationAdapterProvider('external_http')).toBe('external_http');
        expect(normalizeVectorAccelerationAdapterProvider('external-http')).toBe('external_http');
        expect(normalizeVectorAccelerationAdapterProvider('http')).toBe('external_http');
        expect(normalizeVectorAccelerationAdapterProvider('unknown')).toBe('local');
    });

    test('returns undefined adapter for local provider', () => {
        const adapter = createVectorAccelerationAdapter('local');
        expect(adapter).toBeUndefined();
    });

    test('external stub adapter selects token-based candidates for large corpus', async () => {
        const adapter = createVectorAccelerationAdapter('external_stub');
        expect(adapter).toBeDefined();
        expect(adapter?.id).toBe('external-stub-vector-acceleration-v1');

        const selection = await adapter?.selectCandidates(baseSelectionInput);

        expect(selection?.used).toBe(true);
        expect(selection?.mode).toBe('token_prefilter');
        expect((selection?.candidateAtomIds || []).length).toBeGreaterThan(0);
    });

    test('external stub adapter returns full scan when prefilter is disabled', async () => {
        const adapter = createVectorAccelerationAdapter('external_stub');
        const selection = await adapter?.selectCandidates({
            ...baseSelectionInput,
            queryTokens: ['retrieval'],
            queryWeights: new Map<string, number>([['retrieval', 1.0]]),
            tokenToAtomIds: new Map<string, string[]>([['retrieval', ['atom_a', 'atom_b']]]),
            annPrefilterEnabled: false,
        });

        expect(selection?.used).toBe(false);
        expect(selection?.mode).toBe('full_scan');
        expect(selection?.candidateAtomIds).toEqual([]);
    });

    test('external http adapter throws endpoint-missing error when endpoint is not configured', async () => {
        const adapter = createVectorAccelerationAdapter('external_http');
        await expect(adapter?.selectCandidates(baseSelectionInput)).rejects.toThrow('external_http_endpoint_missing');
        expect(adapter?.getHealth?.().status).toBe('unavailable');
        expect(String(adapter?.getHealth?.().message || '')).toContain('external_http_endpoint_missing');
        expect(Number(adapter?.getHealth?.().failureCount || 0)).toBeGreaterThanOrEqual(1);
        expect(adapter?.getHealth?.().representationVersion).toBe('local-vector-representation-v1');
        expect(adapter?.getHealth?.().embeddingModelId).toBe('local-semantic-tfidf-v1');
        expect(adapter?.getHealth?.().representationStatus).toBe('unknown');
    });

    test('external http adapter forwards selection request and normalizes connector response', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                used: true,
                mode: 'token_prefilter',
                candidateAtomIds: ['atom_10', 'atom_21'],
                representationVersion: 'local-vector-representation-v1',
                embeddingModelId: 'local-semantic-tfidf-v1',
                embeddingDimension: 512,
                indexSignature: 'idx_sig_abc123',
                representationStatus: 'aligned',
            }),
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const adapter = createVectorAccelerationAdapter('external_http', {
            externalHttp: {
                endpoint: 'http://127.0.0.1:18080',
                timeoutMs: 450,
            },
        });
        const selection = await adapter?.selectCandidates(baseSelectionInput);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0]?.[0] || '')).toContain('/select-candidates');
        const requestOptions = fetchMock.mock.calls[0]?.[1] as { headers?: Record<string, string> } | undefined;
        const requestHeaders = requestOptions?.headers || {};
        const requestBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as { body?: string } | undefined)?.body || '{}'));
        expect(String(requestHeaders['x-request-id'] || '')).toContain('nc-vector-accel-');
        expect(String(requestHeaders['x-correlation-id'] || '')).toBe(String(requestHeaders['x-request-id'] || ''));
        expect(String(requestBody.representationVersion || '')).toBe('local-vector-representation-v1');
        expect(String(requestBody.embeddingModelId || '')).toBe('local-semantic-tfidf-v1');
        expect(Number(requestBody.embeddingDimension || 0)).toBe(512);
        expect(String(requestBody.indexSignature || '')).toBe('idx_sig_abc123');
        expect(selection?.used).toBe(true);
        expect(selection?.mode).toBe('token_prefilter');
        expect(selection?.candidateAtomIds).toEqual(['atom_10', 'atom_21']);
        expect(selection?.representation?.validated).toBe(true);
        expect(selection?.prefilterMetrics?.candidatesReturned).toBe(2);
        expect(Number(selection?.prefilterMetrics?.totalAtomsInScope || 0)).toBeGreaterThan(0);
        expect(adapter?.getHealth?.().status).toBe('ready');
        expect(String(adapter?.getHealth?.().lastRequestId || '')).toContain('nc-vector-accel-');
        expect(adapter?.getHealth?.().representationStatus).toBe('aligned');
        expect(adapter?.getHealth?.().representationVersion).toBe('local-vector-representation-v1');
        expect(adapter?.getHealth?.().embeddingModelId).toBe('local-semantic-tfidf-v1');
        expect(Number(adapter?.getHealth?.().embeddingDimension || 0)).toBe(512);
    });

    test('external http adapter syncs remote index and caches matching signatures', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: {
                get: (name: string) => {
                    if (String(name || '').toLowerCase() === 'x-request-id') {
                        return 'connector-sync-success';
                    }
                    return '';
                },
            },
            json: async () => ({
                synced: true,
                atomCount: 180,
                indexSignature: 'idx_sig_abc123',
                representationVersion: 'local-vector-representation-v1',
                embeddingModelId: 'local-semantic-tfidf-v1',
                embeddingDimension: 512,
                representationStatus: 'aligned',
            }),
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const adapter = createVectorAccelerationAdapter('external_http', {
            externalHttp: {
                endpoint: 'http://127.0.0.1:18080',
            },
        });

        const syncResult = await adapter?.syncIndex?.(baseSelectionInput);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0]?.[0] || '')).toContain('/sync-index');
        const requestBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as { body?: string } | undefined)?.body || '{}'));
        expect(Number(requestBody.atomCount || 0)).toBe(180);
        expect(String(requestBody.indexSignature || '')).toBe('idx_sig_abc123');
        expect(Array.isArray(requestBody.tokenToAtomIds)).toBe(true);
        expect(Array.isArray(requestBody.signatureBuckets)).toBe(true);
        expect(syncResult?.synced).toBe(true);
        expect(syncResult?.indexSignature).toBe('idx_sig_abc123');

        const healthAfterSync = adapter?.getHealth?.();
        expect(healthAfterSync?.status).toBe('ready');
        expect(healthAfterSync?.indexSyncStatus).toBe('ready');
        expect(healthAfterSync?.syncRequestCount).toBe(1);
        expect(healthAfterSync?.syncSuccessCount).toBe(1);
        expect(healthAfterSync?.syncFailureCount).toBe(0);
        expect(healthAfterSync?.syncedIndexSignature).toBe('idx_sig_abc123');
        expect(healthAfterSync?.syncedAtomCount).toBe(180);

        const cachedSyncResult = await adapter?.syncIndex?.(baseSelectionInput);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(cachedSyncResult?.synced).toBe(true);
        expect(adapter?.getHealth?.().indexSyncStatus).toBe('ready');
    });

    test('external http adapter filters out-of-scope candidate ids and keeps only valid ids', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                used: true,
                mode: 'token_prefilter',
                candidateAtomIds: ['atom_999', 'atom_10', 'atom_10'],
            }),
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const adapter = createVectorAccelerationAdapter('external_http', {
            externalHttp: {
                endpoint: 'http://127.0.0.1:18080',
            },
        });
        const selection = await adapter?.selectCandidates(baseSelectionInput);

        expect(selection?.used).toBe(true);
        expect(selection?.candidateAtomIds).toEqual(['atom_10']);
        expect(selection?.prefilterMetrics?.candidatesReturned).toBe(1);
        expect(selection?.prefilterMetrics?.prefilterRatio).toBeGreaterThan(0);
        expect(String(adapter?.getHealth?.().representationStatusReason || '')).toContain('candidate_ids_out_of_scope');
    });

    test('external http adapter infers representation mismatch when connector metadata drifts', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                used: true,
                mode: 'token_prefilter',
                candidateAtomIds: ['atom_10'],
                representationVersion: 'remote-vector-representation-v2',
                embeddingModelId: 'local-semantic-tfidf-v1',
                embeddingDimension: 512,
                indexSignature: 'idx_sig_abc123',
            }),
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const adapter = createVectorAccelerationAdapter('external_http', {
            externalHttp: {
                endpoint: 'http://127.0.0.1:18080',
            },
        });
        const selection = await adapter?.selectCandidates(baseSelectionInput);
        expect(selection?.used).toBe(true);
        expect(adapter?.getHealth?.().representationStatus).toBe('mismatch');
        expect(String(adapter?.getHealth?.().representationStatusReason || '')).toContain('representation_version');
    });

    test('external http adapter retries transient status failures and recovers', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 503,
                headers: {
                    get: (name: string) => {
                        const normalized = String(name || '').toLowerCase();
                        if (normalized === 'retry-after') {
                            return '0.03';
                        }
                        if (normalized === 'x-request-id') {
                            return 'connector-retry-503';
                        }
                        return '';
                    },
                },
                json: async () => ({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: {
                    get: (name: string) => {
                        if (String(name || '').toLowerCase() === 'x-request-id') {
                            return 'connector-retry-success';
                        }
                        return '';
                    },
                },
                json: async () => ({
                    used: true,
                    mode: 'token_prefilter',
                    candidateAtomIds: ['atom_22'],
                }),
            });
        globalThis.fetch = fetchMock as unknown as typeof fetch;
        const originalSetTimeout = global.setTimeout;
        const recordedTimeoutDelays: number[] = [];
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(
            ((handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]) => {
                recordedTimeoutDelays.push(Math.floor(Number(timeout || 0)));
                return (originalSetTimeout as any)(handler, timeout, ...args);
            }) as any
        );

        const adapter = createVectorAccelerationAdapter('external_http', {
            externalHttp: {
                endpoint: 'http://127.0.0.1:18080',
                maxRetries: 2,
                retryDelayMs: 0,
            },
        });
        const selection = await adapter?.selectCandidates(baseSelectionInput);

        setTimeoutSpy.mockRestore();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(selection?.used).toBe(true);
        expect(selection?.candidateAtomIds).toEqual(['atom_22']);
        expect(adapter?.getHealth?.().status).toBe('ready');
        expect(recordedTimeoutDelays.some((delay) => delay >= 30)).toBe(true);
        expect(String(adapter?.getHealth?.().lastRequestId || '')).toBe('connector-retry-success');
        expect(String(adapter?.getHealth?.().lastErrorCode || '')).toBe('');
        expect(Number(adapter?.getHealth?.().lastRetryAfterMs || 0)).toBe(30);
    });

    test('external http adapter does not retry non-transient status failures', async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({}),
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const adapter = createVectorAccelerationAdapter('external_http', {
            externalHttp: {
                endpoint: 'http://127.0.0.1:18080',
                maxRetries: 3,
                retryDelayMs: 0,
            },
        });

        await expect(adapter?.selectCandidates(baseSelectionInput)).rejects.toThrow('external_http_status_400');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(adapter?.getHealth?.().status).toBe('unavailable');
    });

    test('external http adapter retries transient network failures up to max retries', async () => {
        const fetchMock = jest.fn().mockRejectedValue(new Error('socket_hang_up'));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const adapter = createVectorAccelerationAdapter('external_http', {
            externalHttp: {
                endpoint: 'http://127.0.0.1:18080',
                maxRetries: 2,
                retryDelayMs: 0,
            },
        });

        await expect(adapter?.selectCandidates(baseSelectionInput)).rejects.toThrow('socket_hang_up');
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(adapter?.getHealth?.().status).toBe('degraded');
    });

    test('external http adapter propagates connector failures and marks degraded health', async () => {
        const fetchMock = jest.fn().mockRejectedValue(new Error('socket_hang_up'));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const adapter = createVectorAccelerationAdapter('external_http', {
            externalHttp: {
                endpoint: 'http://127.0.0.1:18080',
            },
        });

        await expect(adapter?.selectCandidates(baseSelectionInput)).rejects.toThrow('socket_hang_up');
        expect(adapter?.getHealth?.().status).toBe('degraded');
        expect(String(adapter?.getHealth?.().message || '')).toContain('socket_hang_up');
    });

    test('external http adapter opens circuit after consecutive failures and short-circuits requests', async () => {
        const fetchMock = jest.fn().mockRejectedValue(new Error('socket_hang_up'));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const adapter = createVectorAccelerationAdapter('external_http', {
            externalHttp: {
                endpoint: 'http://127.0.0.1:18080',
                maxRetries: 0,
                retryDelayMs: 0,
                circuitFailureThreshold: 2,
                circuitCooldownMs: 10000,
            },
        });

        await expect(adapter?.selectCandidates(baseSelectionInput)).rejects.toThrow('socket_hang_up');
        await expect(adapter?.selectCandidates(baseSelectionInput)).rejects.toThrow('socket_hang_up');
        await expect(adapter?.selectCandidates(baseSelectionInput)).rejects.toThrow('external_http_circuit_open');
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(adapter?.getHealth?.().status).toBe('unavailable');
        expect(String(adapter?.getHealth?.().message || '')).toContain('external_http_circuit_open');
    });

    test('external http adapter enters half-open after cooldown and closes on successful probe', async () => {
        const fetchMock = jest
            .fn()
            .mockRejectedValueOnce(new Error('socket_hang_up'))
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    used: true,
                    mode: 'token_prefilter',
                    candidateAtomIds: ['atom_23'],
                }),
            });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        let nowMs = 1000;
        jest.spyOn(Date, 'now').mockImplementation(() => nowMs);

        const adapter = createVectorAccelerationAdapter('external_http', {
            externalHttp: {
                endpoint: 'http://127.0.0.1:18080',
                maxRetries: 0,
                retryDelayMs: 0,
                circuitFailureThreshold: 1,
                circuitCooldownMs: 500,
            },
        });

        await expect(adapter?.selectCandidates(baseSelectionInput)).rejects.toThrow('socket_hang_up');
        await expect(adapter?.selectCandidates(baseSelectionInput)).rejects.toThrow('external_http_circuit_open');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        nowMs += 600;
        const recovered = await adapter?.selectCandidates(baseSelectionInput);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(recovered?.used).toBe(true);
        expect(recovered?.candidateAtomIds).toEqual(['atom_23']);
        expect(adapter?.getHealth?.().status).toBe('ready');
        expect(String(adapter?.getHealth?.().message || '')).toContain('circuit=closed');
    });
});
