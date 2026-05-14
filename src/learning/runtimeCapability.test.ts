import {
    buildRuntimeCapabilityRunbook,
    buildRuntimeCapabilityMatrix,
    normalizeRuntimeCapabilityThresholds,
    resolveRuntimeCapabilityThresholdsFromEnv,
} from './runtimeCapability';
import type { KnowledgeGraphStoreDiagnostics } from './store';
import type { KnowledgeQueryBackendDiagnostics } from './types';

function createStoreDiagnostics(
    overrides: Partial<KnowledgeGraphStoreDiagnostics> = {}
): KnowledgeGraphStoreDiagnostics {
    return {
        storeType: 'file',
        exists: true,
        loaded: true,
        ...overrides,
    };
}

function createQueryDiagnostics(
    overrides: Partial<KnowledgeQueryBackendDiagnostics> = {}
): KnowledgeQueryBackendDiagnostics {
    return {
        backendId: 'local-hybrid-v1',
        fallbackCount: 0,
        ...overrides,
    };
}

describe('runtime capability matrix', () => {
    test('normalizes runtime thresholds and enforces fail>=warn invariant', () => {
        const thresholds = normalizeRuntimeCapabilityThresholds({
            minQuerySampleSize: 0,
            queryFallbackWarnRatioPct: 35,
            queryFallbackFailRatioPct: 20,
            queryEvidenceCoverageWarnRatioPct: 82,
            queryEvidenceCoverageFailRatioPct: 93,
            queryTemporalValidityWarnRatioPct: 88,
            queryTemporalValidityFailRatioPct: 95,
            queryBackendExplainabilityGapWarnRatioPct: 32,
            queryBackendExplainabilityGapFailRatioPct: 20,
            queryBackendTrendWarnConfidenceRatioPct: 65,
            queryBackendTrendFailConfidenceRatioPct: 55,
            sessionPlanQualityWarnFailureStreak: 3,
            sessionPlanQualityFailFailureStreak: 1,
            apiInvalidRequestMinErrorSample: 0,
            apiInvalidRequestWarnRatioPct: 45,
            apiInvalidRequestFailRatioPct: 20,
            apiInvalidRequestHotspotWarnCount: 9,
            apiInvalidRequestHotspotFailCount: 4,
            apiServerErrorMinRequestSample: 0,
            apiServerErrorWarnRatioPct: 11,
            apiServerErrorFailRatioPct: 5,
            apiServerErrorHotspotWarnCount: 7,
            apiServerErrorHotspotFailCount: 3,
            apiTransientErrorMinRequestSample: 0,
            apiTransientErrorWarnRatioPct: 19,
            apiTransientErrorFailRatioPct: 11,
            apiTransientErrorHotspotWarnCount: 6,
            apiTransientErrorHotspotFailCount: 3,
            apiLatencyMinRequestSample: 0,
            apiLatencyP95WarnMs: 1400,
            apiLatencyP95FailMs: 900,
            apiLatencyHotspotWarnMs: 2100,
            apiLatencyHotspotFailMs: 1700,
            queryVectorAccelerationShortCircuitWarnCount: 9,
            queryVectorAccelerationShortCircuitFailCount: 4,
            queryVectorAccelerationShortCircuitWarnRatioPct: 30,
            queryVectorAccelerationShortCircuitFailRatioPct: 20,
            queryVectorAccelerationConsecutiveFailuresWarnCount: 5,
            queryVectorAccelerationConsecutiveFailuresFailCount: 3,
            queryVectorAccelerationHalfOpenSuccessWarnRatioPct: 75,
            queryVectorAccelerationHalfOpenSuccessFailRatioPct: 95,
            queryVectorAccelerationPrefilterMinRequestSample: 0,
            queryVectorAccelerationPrefilterWarnCandidateRatioPct: 97,
            queryVectorAccelerationPrefilterFailCandidateRatioPct: 90,
            storeGraphDbConnectorMinRequestSample: 0,
            storeGraphDbConnectorFailureWarnRatioPct: 32,
            storeGraphDbConnectorFailureFailRatioPct: 11,
            storeGraphDbConnectorShortCircuitWarnRatioPct: 18,
            storeGraphDbConnectorShortCircuitFailRatioPct: 7,
            storeGraphDbConnectorConsecutiveFailuresWarnCount: 5,
            storeGraphDbConnectorConsecutiveFailuresFailCount: 2,
        });

        expect(thresholds.minQuerySampleSize).toBe(1);
        expect(thresholds.queryFallbackWarnRatioPct).toBe(35);
        expect(thresholds.queryFallbackFailRatioPct).toBe(35);
        expect(thresholds.queryEvidenceCoverageWarnRatioPct).toBe(82);
        expect(thresholds.queryEvidenceCoverageFailRatioPct).toBe(82);
        expect(thresholds.queryTemporalValidityWarnRatioPct).toBe(88);
        expect(thresholds.queryTemporalValidityFailRatioPct).toBe(88);
        expect(thresholds.queryBackendExplainabilityGapWarnRatioPct).toBe(32);
        expect(thresholds.queryBackendExplainabilityGapFailRatioPct).toBe(32);
        expect(thresholds.queryBackendTrendWarnConfidenceRatioPct).toBe(65);
        expect(thresholds.queryBackendTrendFailConfidenceRatioPct).toBe(65);
        expect(thresholds.sessionPlanQualityWarnFailureStreak).toBe(3);
        expect(thresholds.sessionPlanQualityFailFailureStreak).toBe(3);
        expect(thresholds.apiInvalidRequestMinErrorSample).toBe(1);
        expect(thresholds.apiInvalidRequestWarnRatioPct).toBe(45);
        expect(thresholds.apiInvalidRequestFailRatioPct).toBe(45);
        expect(thresholds.apiInvalidRequestHotspotWarnCount).toBe(9);
        expect(thresholds.apiInvalidRequestHotspotFailCount).toBe(9);
        expect(thresholds.apiServerErrorMinRequestSample).toBe(1);
        expect(thresholds.apiServerErrorWarnRatioPct).toBe(11);
        expect(thresholds.apiServerErrorFailRatioPct).toBe(11);
        expect(thresholds.apiServerErrorHotspotWarnCount).toBe(7);
        expect(thresholds.apiServerErrorHotspotFailCount).toBe(7);
        expect(thresholds.apiTransientErrorMinRequestSample).toBe(1);
        expect(thresholds.apiTransientErrorWarnRatioPct).toBe(19);
        expect(thresholds.apiTransientErrorFailRatioPct).toBe(19);
        expect(thresholds.apiTransientErrorHotspotWarnCount).toBe(6);
        expect(thresholds.apiTransientErrorHotspotFailCount).toBe(6);
        expect(thresholds.apiLatencyMinRequestSample).toBe(1);
        expect(thresholds.apiLatencyP95WarnMs).toBe(1400);
        expect(thresholds.apiLatencyP95FailMs).toBe(1400);
        expect(thresholds.apiLatencyHotspotWarnMs).toBe(2100);
        expect(thresholds.apiLatencyHotspotFailMs).toBe(2100);
        expect(thresholds.queryVectorAccelerationShortCircuitWarnCount).toBe(9);
        expect(thresholds.queryVectorAccelerationShortCircuitFailCount).toBe(9);
        expect(thresholds.queryVectorAccelerationShortCircuitWarnRatioPct).toBe(30);
        expect(thresholds.queryVectorAccelerationShortCircuitFailRatioPct).toBe(30);
        expect(thresholds.queryVectorAccelerationConsecutiveFailuresWarnCount).toBe(5);
        expect(thresholds.queryVectorAccelerationConsecutiveFailuresFailCount).toBe(5);
        expect(thresholds.queryVectorAccelerationHalfOpenSuccessWarnRatioPct).toBe(75);
        expect(thresholds.queryVectorAccelerationHalfOpenSuccessFailRatioPct).toBe(75);
        expect(thresholds.queryVectorAccelerationPrefilterMinRequestSample).toBe(1);
        expect(thresholds.queryVectorAccelerationPrefilterWarnCandidateRatioPct).toBe(97);
        expect(thresholds.queryVectorAccelerationPrefilterFailCandidateRatioPct).toBe(97);
        expect(thresholds.storeGraphDbConnectorMinRequestSample).toBe(1);
        expect(thresholds.storeGraphDbConnectorFailureWarnRatioPct).toBe(32);
        expect(thresholds.storeGraphDbConnectorFailureFailRatioPct).toBe(32);
        expect(thresholds.storeGraphDbConnectorShortCircuitWarnRatioPct).toBe(18);
        expect(thresholds.storeGraphDbConnectorShortCircuitFailRatioPct).toBe(18);
        expect(thresholds.storeGraphDbConnectorConsecutiveFailuresWarnCount).toBe(5);
        expect(thresholds.storeGraphDbConnectorConsecutiveFailuresFailCount).toBe(5);
    });

    test('resolves runtime thresholds from env', () => {
        const thresholds = resolveRuntimeCapabilityThresholdsFromEnv({
            NOTE_CONNECTION_RUNTIME_QUERY_MIN_SAMPLE: '12',
            NOTE_CONNECTION_RUNTIME_QUERY_FALLBACK_WARN_RATIO_PCT: '7.5',
            NOTE_CONNECTION_RUNTIME_QUERY_FALLBACK_FAIL_RATIO_PCT: '18.2',
            NOTE_CONNECTION_RUNTIME_QUERY_EVIDENCE_COVERAGE_WARN_RATIO_PCT: '91.1',
            NOTE_CONNECTION_RUNTIME_QUERY_EVIDENCE_COVERAGE_FAIL_RATIO_PCT: '78.2',
            NOTE_CONNECTION_RUNTIME_QUERY_TEMPORAL_VALIDITY_WARN_RATIO_PCT: '92.5',
            NOTE_CONNECTION_RUNTIME_QUERY_TEMPORAL_VALIDITY_FAIL_RATIO_PCT: '81.4',
            NOTE_CONNECTION_RUNTIME_QUERY_BACKEND_EXPLAINABILITY_GAP_WARN_RATIO_PCT: '18.5',
            NOTE_CONNECTION_RUNTIME_QUERY_BACKEND_EXPLAINABILITY_GAP_FAIL_RATIO_PCT: '33.2',
            NOTE_CONNECTION_RUNTIME_QUERY_BACKEND_TREND_WARN_CONFIDENCE_PCT: '42.5',
            NOTE_CONNECTION_RUNTIME_QUERY_BACKEND_TREND_FAIL_CONFIDENCE_PCT: '73.1',
            NOTE_CONNECTION_RUNTIME_SESSION_PLAN_QUALITY_WARN_FAILURE_STREAK: '2',
            NOTE_CONNECTION_RUNTIME_SESSION_PLAN_QUALITY_FAIL_FAILURE_STREAK: '4',
            NOTE_CONNECTION_RUNTIME_API_INVALID_REQUEST_MIN_ERROR_SAMPLE: '6',
            NOTE_CONNECTION_RUNTIME_API_INVALID_REQUEST_WARN_RATIO_PCT: '25',
            NOTE_CONNECTION_RUNTIME_API_INVALID_REQUEST_FAIL_RATIO_PCT: '55',
            NOTE_CONNECTION_RUNTIME_API_INVALID_REQUEST_HOTSPOT_WARN_COUNT: '5',
            NOTE_CONNECTION_RUNTIME_API_INVALID_REQUEST_HOTSPOT_FAIL_COUNT: '12',
            NOTE_CONNECTION_RUNTIME_API_SERVER_ERROR_MIN_REQUEST_SAMPLE: '9',
            NOTE_CONNECTION_RUNTIME_API_SERVER_ERROR_WARN_RATIO_PCT: '6.5',
            NOTE_CONNECTION_RUNTIME_API_SERVER_ERROR_FAIL_RATIO_PCT: '14.2',
            NOTE_CONNECTION_RUNTIME_API_SERVER_ERROR_HOTSPOT_WARN_COUNT: '4',
            NOTE_CONNECTION_RUNTIME_API_SERVER_ERROR_HOTSPOT_FAIL_COUNT: '10',
            NOTE_CONNECTION_RUNTIME_API_TRANSIENT_ERROR_MIN_REQUEST_SAMPLE: '11',
            NOTE_CONNECTION_RUNTIME_API_TRANSIENT_ERROR_WARN_RATIO_PCT: '9.25',
            NOTE_CONNECTION_RUNTIME_API_TRANSIENT_ERROR_FAIL_RATIO_PCT: '18.75',
            NOTE_CONNECTION_RUNTIME_API_TRANSIENT_ERROR_HOTSPOT_WARN_COUNT: '2',
            NOTE_CONNECTION_RUNTIME_API_TRANSIENT_ERROR_HOTSPOT_FAIL_COUNT: '9',
            NOTE_CONNECTION_RUNTIME_API_LATENCY_MIN_REQUEST_SAMPLE: '12',
            NOTE_CONNECTION_RUNTIME_API_LATENCY_P95_WARN_MS: '950',
            NOTE_CONNECTION_RUNTIME_API_LATENCY_P95_FAIL_MS: '2350',
            NOTE_CONNECTION_RUNTIME_API_LATENCY_HOTSPOT_WARN_MS: '1450',
            NOTE_CONNECTION_RUNTIME_API_LATENCY_HOTSPOT_FAIL_MS: '3250',
            NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_SHORT_CIRCUIT_WARN_COUNT: '2',
            NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_SHORT_CIRCUIT_FAIL_COUNT: '6',
            NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_SHORT_CIRCUIT_WARN_RATIO_PCT: '7.5',
            NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_SHORT_CIRCUIT_FAIL_RATIO_PCT: '21.5',
            NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_CONSECUTIVE_FAILURES_WARN_COUNT: '1',
            NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_CONSECUTIVE_FAILURES_FAIL_COUNT: '3',
            NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_HALF_OPEN_SUCCESS_WARN_RATIO_PCT: '83',
            NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_HALF_OPEN_SUCCESS_FAIL_RATIO_PCT: '55',
            NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_PREFILTER_MIN_REQUEST_SAMPLE: '9',
            NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_PREFILTER_WARN_CANDIDATE_RATIO_PCT: '88.5',
            NOTE_CONNECTION_RUNTIME_QUERY_VECTOR_ACCELERATION_PREFILTER_FAIL_CANDIDATE_RATIO_PCT: '96.2',
            NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_MIN_REQUEST_SAMPLE: '11',
            NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_FAILURE_WARN_RATIO_PCT: '19.5',
            NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_FAILURE_FAIL_RATIO_PCT: '33.3',
            NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_SHORT_CIRCUIT_WARN_RATIO_PCT: '7.2',
            NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_SHORT_CIRCUIT_FAIL_RATIO_PCT: '16.4',
            NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_CONSECUTIVE_FAILURES_WARN_COUNT: '2',
            NOTE_CONNECTION_RUNTIME_STORE_GRAPHDB_CONNECTOR_CONSECUTIVE_FAILURES_FAIL_COUNT: '6',
        } as NodeJS.ProcessEnv);

        expect(thresholds.minQuerySampleSize).toBe(12);
        expect(thresholds.queryFallbackWarnRatioPct).toBe(7.5);
        expect(thresholds.queryFallbackFailRatioPct).toBe(18.2);
        expect(thresholds.queryEvidenceCoverageWarnRatioPct).toBe(91.1);
        expect(thresholds.queryEvidenceCoverageFailRatioPct).toBe(78.2);
        expect(thresholds.queryTemporalValidityWarnRatioPct).toBe(92.5);
        expect(thresholds.queryTemporalValidityFailRatioPct).toBe(81.4);
        expect(thresholds.queryBackendExplainabilityGapWarnRatioPct).toBe(18.5);
        expect(thresholds.queryBackendExplainabilityGapFailRatioPct).toBe(33.2);
        expect(thresholds.queryBackendTrendWarnConfidenceRatioPct).toBe(42.5);
        expect(thresholds.queryBackendTrendFailConfidenceRatioPct).toBe(73.1);
        expect(thresholds.sessionPlanQualityWarnFailureStreak).toBe(2);
        expect(thresholds.sessionPlanQualityFailFailureStreak).toBe(4);
        expect(thresholds.apiInvalidRequestMinErrorSample).toBe(6);
        expect(thresholds.apiInvalidRequestWarnRatioPct).toBe(25);
        expect(thresholds.apiInvalidRequestFailRatioPct).toBe(55);
        expect(thresholds.apiInvalidRequestHotspotWarnCount).toBe(5);
        expect(thresholds.apiInvalidRequestHotspotFailCount).toBe(12);
        expect(thresholds.apiServerErrorMinRequestSample).toBe(9);
        expect(thresholds.apiServerErrorWarnRatioPct).toBe(6.5);
        expect(thresholds.apiServerErrorFailRatioPct).toBe(14.2);
        expect(thresholds.apiServerErrorHotspotWarnCount).toBe(4);
        expect(thresholds.apiServerErrorHotspotFailCount).toBe(10);
        expect(thresholds.apiTransientErrorMinRequestSample).toBe(11);
        expect(thresholds.apiTransientErrorWarnRatioPct).toBe(9.25);
        expect(thresholds.apiTransientErrorFailRatioPct).toBe(18.75);
        expect(thresholds.apiTransientErrorHotspotWarnCount).toBe(2);
        expect(thresholds.apiTransientErrorHotspotFailCount).toBe(9);
        expect(thresholds.apiLatencyMinRequestSample).toBe(12);
        expect(thresholds.apiLatencyP95WarnMs).toBe(950);
        expect(thresholds.apiLatencyP95FailMs).toBe(2350);
        expect(thresholds.apiLatencyHotspotWarnMs).toBe(1450);
        expect(thresholds.apiLatencyHotspotFailMs).toBe(3250);
        expect(thresholds.queryVectorAccelerationShortCircuitWarnCount).toBe(2);
        expect(thresholds.queryVectorAccelerationShortCircuitFailCount).toBe(6);
        expect(thresholds.queryVectorAccelerationShortCircuitWarnRatioPct).toBe(7.5);
        expect(thresholds.queryVectorAccelerationShortCircuitFailRatioPct).toBe(21.5);
        expect(thresholds.queryVectorAccelerationConsecutiveFailuresWarnCount).toBe(1);
        expect(thresholds.queryVectorAccelerationConsecutiveFailuresFailCount).toBe(3);
        expect(thresholds.queryVectorAccelerationHalfOpenSuccessWarnRatioPct).toBe(83);
        expect(thresholds.queryVectorAccelerationHalfOpenSuccessFailRatioPct).toBe(55);
        expect(thresholds.queryVectorAccelerationPrefilterMinRequestSample).toBe(9);
        expect(thresholds.queryVectorAccelerationPrefilterWarnCandidateRatioPct).toBe(88.5);
        expect(thresholds.queryVectorAccelerationPrefilterFailCandidateRatioPct).toBe(96.2);
        expect(thresholds.storeGraphDbConnectorMinRequestSample).toBe(11);
        expect(thresholds.storeGraphDbConnectorFailureWarnRatioPct).toBe(19.5);
        expect(thresholds.storeGraphDbConnectorFailureFailRatioPct).toBe(33.3);
        expect(thresholds.storeGraphDbConnectorShortCircuitWarnRatioPct).toBe(7.2);
        expect(thresholds.storeGraphDbConnectorShortCircuitFailRatioPct).toBe(16.4);
        expect(thresholds.storeGraphDbConnectorConsecutiveFailuresWarnCount).toBe(2);
        expect(thresholds.storeGraphDbConnectorConsecutiveFailuresFailCount).toBe(6);
    });

    test('returns warn when sample size is below threshold', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 2 }),
            queryCount: 3,
            thresholds: {
                minQuerySampleSize: 5,
                queryFallbackWarnRatioPct: 10,
                queryFallbackFailRatioPct: 20,
            },
        });

        const fallbackCheck = matrix.checks.find((check) => check.checkId === 'query_fallback_ratio');
        expect(fallbackCheck?.status).toBe('warn');
        expect(fallbackCheck?.expected).toBe('queryCount>=5');
        expect(fallbackCheck?.debugTraceHint).toEqual({
            pathPrefix: '/api/knowledge/query',
            statusAtLeast: 400,
            method: '',
            errorCode: '',
        });
        expect(Number(fallbackCheck?.priorityScore || 0)).toBeGreaterThan(0);
        expect(matrix.overallStatus).toBe('degraded');
    });

    test('returns fail when fallback ratio exceeds fail threshold', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 9 }),
            queryCount: 20,
            thresholds: {
                minQuerySampleSize: 5,
                queryFallbackWarnRatioPct: 10,
                queryFallbackFailRatioPct: 30,
            },
        });

        const fallbackCheck = matrix.checks.find((check) => check.checkId === 'query_fallback_ratio');
        expect(fallbackCheck?.status).toBe('fail');
        expect(fallbackCheck?.expected).toBe('fallbackRatio<=30%');
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns pass for local_vector runtime when vector index is ready and persisted', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        atomCount: 24,
                        location: '/tmp/knowledge_query_vector_index.v1.json',
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            lastSelectionMode: 'token_signature_prefilter',
                            lastCandidateCount: 12,
                            adapterId: 'local-vector-acceleration-ann-v1',
                            healthStatus: 'ready',
                            healthMessage: 'local_ann_prefilter_active',
                            representationVersion: 'local-vector-representation-v1',
                            embeddingModelId: 'local-semantic-tfidf-v1',
                            embeddingDimension: 24,
                            indexSignature: 'idx_sig_24',
                            representationStatus: 'aligned',
                            representationStatusReason: 'local_adapter_representation_aligned',
                            representationStrictMode: true,
                            lastRequestId: 'connector-req-001',
                            lastErrorCode: '',
                            lastRetryAfterMs: 0,
                            circuitState: 'closed',
                            consecutiveFailures: 0,
                            requestCount: 18,
                            retryCount: 2,
                            shortCircuitCount: 0,
                            successCount: 16,
                            failureCount: 2,
                            halfOpenProbeSuccessCount: 1,
                            halfOpenProbeFailureCount: 0,
                        },
                    },
                },
            }),
            queryCount: 10,
        });

        const runtimeHealthCheck = matrix.checks.find((check) => check.checkId === 'query_backend_runtime_health');
        const vectorStatusCheck = matrix.checks.find((check) => check.checkId === 'query_vector_index_status');
        const vectorPersistenceCheck = matrix.checks.find((check) => check.checkId === 'query_vector_index_persistence');
        const vectorAccelerationCheck = matrix.checks.find((check) => check.checkId === 'query_vector_acceleration_mode');
        const vectorAccelerationRepresentationCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_representation_consistency'
        );
        const vectorAccelerationPrefilterCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_prefilter_effectiveness'
        );
        const vectorAccelerationCalibrationReadinessCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_calibration_readiness'
        );
        const vectorAccelerationHealthCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_health'
        );
        const vectorAccelerationIndexSyncCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_index_sync_health'
        );
        const vectorAccelerationTraceabilityCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_traceability'
        );
        const vectorAccelerationCircuitCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_circuit_state'
        );
        expect(runtimeHealthCheck?.status).toBe('pass');
        expect(vectorStatusCheck?.status).toBe('pass');
        expect(vectorPersistenceCheck?.status).toBe('pass');
        expect(vectorAccelerationCheck?.status).toBe('pass');
        expect(vectorAccelerationRepresentationCheck?.status).toBe('pass');
        expect(vectorAccelerationPrefilterCheck?.status).toBe('pass');
        expect(vectorAccelerationCalibrationReadinessCheck?.status).toBe('pass');
        expect(vectorAccelerationHealthCheck?.status).toBe('pass');
        expect(vectorAccelerationIndexSyncCheck?.status).toBe('pass');
        expect(vectorAccelerationTraceabilityCheck?.status).toBe('pass');
        expect(vectorAccelerationCircuitCheck?.status).toBe('pass');
        expect(matrix.signals.queryBackendRuntimeReady).toBe(true);
        expect(matrix.signals.queryVectorIndexStatus).toBe('ready');
        expect(matrix.signals.queryVectorIndexPersisted).toBe(true);
        expect(matrix.signals.queryVectorIndexLoadedFromDisk).toBe(true);
        expect(matrix.signals.queryVectorIndexAtomCount).toBe(24);
        expect(matrix.signals.queryVectorIndexAccelerationEnabled).toBe(true);
        expect(matrix.signals.queryVectorIndexAccelerationMode).toBe('ann_prefilter');
        expect(matrix.signals.queryVectorIndexAccelerationLastSelectionMode).toBe('token_signature_prefilter');
        expect(matrix.signals.queryVectorIndexAccelerationLastCandidateCount).toBe(12);
        expect(matrix.signals.queryVectorIndexAccelerationAdapterId).toBe('local-vector-acceleration-ann-v1');
        expect(matrix.signals.queryVectorIndexAccelerationHealthStatus).toBe('ready');
        expect(matrix.signals.queryVectorIndexAccelerationHealthMessage).toBe('local_ann_prefilter_active');
        expect(matrix.signals.queryVectorIndexAccelerationIndexSyncStatus).toBe('unknown');
        expect(matrix.signals.queryVectorIndexAccelerationIndexSyncMessage).toBe('');
        expect(matrix.signals.queryVectorIndexAccelerationLastSyncAt).toBe('');
        expect(matrix.signals.queryVectorIndexAccelerationSyncRequestCount).toBe(0);
        expect(matrix.signals.queryVectorIndexAccelerationSyncSuccessCount).toBe(0);
        expect(matrix.signals.queryVectorIndexAccelerationSyncFailureCount).toBe(0);
        expect(matrix.signals.queryVectorIndexAccelerationSyncedIndexSignature).toBe('');
        expect(matrix.signals.queryVectorIndexAccelerationSyncedAtomCount).toBe(0);
        expect(matrix.signals.queryVectorIndexAccelerationRepresentationVersion).toBe(
            'local-vector-representation-v1'
        );
        expect(matrix.signals.queryVectorIndexAccelerationEmbeddingModelId).toBe('local-semantic-tfidf-v1');
        expect(matrix.signals.queryVectorIndexAccelerationEmbeddingDimension).toBe(24);
        expect(matrix.signals.queryVectorIndexAccelerationIndexSignature).toBe('idx_sig_24');
        expect(matrix.signals.queryVectorIndexAccelerationRepresentationStatus).toBe('aligned');
        expect(matrix.signals.queryVectorIndexAccelerationRepresentationStatusReason).toBe(
            'local_adapter_representation_aligned'
        );
        expect(matrix.signals.queryVectorIndexAccelerationRepresentationStrictMode).toBe(true);
        expect(matrix.signals.queryVectorIndexAccelerationLastRequestId).toBe('connector-req-001');
        expect(matrix.signals.queryVectorIndexAccelerationLastErrorCode).toBe('');
        expect(matrix.signals.queryVectorIndexAccelerationLastRetryAfterMs).toBe(0);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitState).toBe('closed');
        expect(matrix.signals.queryVectorIndexAccelerationConsecutiveFailures).toBe(0);
        expect(matrix.signals.queryVectorIndexAccelerationRequestCount).toBe(18);
        expect(matrix.signals.queryVectorIndexAccelerationRetryCount).toBe(2);
        expect(matrix.signals.queryVectorIndexAccelerationShortCircuitCount).toBe(0);
        expect(matrix.signals.queryVectorIndexAccelerationShortCircuitRatioPct).toBe(0);
        expect(matrix.signals.queryVectorIndexAccelerationSuccessCount).toBe(16);
        expect(matrix.signals.queryVectorIndexAccelerationFailureCount).toBe(2);
        expect(matrix.signals.queryVectorIndexAccelerationHalfOpenProbeCount).toBe(1);
        expect(matrix.signals.queryVectorIndexAccelerationHalfOpenSuccessRatePct).toBe(100);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitWarnBudgetExceeded).toBe(false);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitFailBudgetExceeded).toBe(false);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitBudgetStatus).toBe('ok');
    });

    test('returns fail when vector acceleration representation status is mismatch under strict mode', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        atomCount: 128,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            lastSelectionMode: 'token_prefilter',
                            lastCandidateCount: 32,
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'ready',
                            healthMessage: 'external_http_ready',
                            representationVersion: 'remote-representation-v2',
                            embeddingModelId: 'remote-embedding-v2',
                            embeddingDimension: 64,
                            indexSignature: 'remote_sig_v2',
                            representationStatus: 'mismatch',
                            representationStatusReason: 'representation_version_mismatch',
                            representationStrictMode: true,
                            circuitState: 'closed',
                            requestCount: 22,
                            retryCount: 1,
                            shortCircuitCount: 0,
                            successCount: 21,
                            failureCount: 1,
                        },
                    },
                },
            }),
            queryCount: 22,
        });

        const vectorAccelerationRepresentationCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_representation_consistency'
        );
        expect(vectorAccelerationRepresentationCheck?.status).toBe('fail');
        expect(String(vectorAccelerationRepresentationCheck?.message || '')).toContain('strict mode');
        expect(String(vectorAccelerationRepresentationCheck?.observed || '')).toContain('representationStatus=mismatch');
        expect(matrix.signals.queryVectorIndexAccelerationRepresentationStatus).toBe('mismatch');
        expect(matrix.signals.queryVectorIndexAccelerationRepresentationStrictMode).toBe(true);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns fail when query backend runtime reports not-ready for local_vector', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: false,
                    vectorIndex: {
                        enabled: true,
                        status: 'unavailable',
                        persisted: false,
                    },
                },
            }),
            queryCount: 8,
        });

        const runtimeHealthCheck = matrix.checks.find((check) => check.checkId === 'query_backend_runtime_health');
        const vectorStatusCheck = matrix.checks.find((check) => check.checkId === 'query_vector_index_status');
        expect(runtimeHealthCheck?.status).toBe('fail');
        expect(vectorStatusCheck?.status).toBe('fail');
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns warn when local_vector index is stale or non-persistent', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'stale',
                        persisted: false,
                        loadedFromDisk: false,
                        atomCount: 0,
                    },
                },
            }),
            queryCount: 8,
        });

        const vectorStatusCheck = matrix.checks.find((check) => check.checkId === 'query_vector_index_status');
        const vectorPersistenceCheck = matrix.checks.find((check) => check.checkId === 'query_vector_index_persistence');
        const vectorAccelerationCheck = matrix.checks.find((check) => check.checkId === 'query_vector_acceleration_mode');
        const vectorAccelerationPrefilterCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_prefilter_effectiveness'
        );
        const vectorAccelerationCalibrationReadinessCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_calibration_readiness'
        );
        const vectorAccelerationHealthCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_health'
        );
        const vectorAccelerationTraceabilityCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_traceability'
        );
        const vectorAccelerationCircuitCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_circuit_state'
        );
        expect(vectorStatusCheck?.status).toBe('warn');
        expect(vectorPersistenceCheck?.status).toBe('warn');
        expect(vectorAccelerationCheck?.status).toBe('warn');
        expect(vectorAccelerationPrefilterCheck?.status).toBe('warn');
        expect(vectorAccelerationCalibrationReadinessCheck?.status).toBe('warn');
        expect(vectorAccelerationHealthCheck?.status).toBe('warn');
        expect(vectorAccelerationTraceabilityCheck?.status).toBe('warn');
        expect(vectorAccelerationCircuitCheck?.status).toBe('warn');
        expect(matrix.signals.queryVectorIndexAccelerationCircuitWarnBudgetExceeded).toBe(false);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitFailBudgetExceeded).toBe(false);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitBudgetStatus).toBe('ok');
        expect(vectorStatusCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('/api/knowledge/query-backend-diagnostics'),
            ])
        );
    });

    test('returns fail when vector acceleration health is unavailable while acceleration is enabled', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        atomCount: 128,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'unavailable',
                            healthMessage: 'external_http_endpoint_missing',
                        },
                    },
                },
            }),
            queryCount: 14,
        });

        const vectorAccelerationModeCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_mode'
        );
        const vectorAccelerationHealthCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_health'
        );
        const vectorAccelerationIndexSyncCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_index_sync_health'
        );
        const vectorAccelerationCalibrationReadinessCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_calibration_readiness'
        );
        const vectorAccelerationTraceabilityCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_traceability'
        );
        expect(vectorAccelerationModeCheck?.status).toBe('pass');
        expect(vectorAccelerationHealthCheck?.status).toBe('fail');
        expect(vectorAccelerationIndexSyncCheck?.status).toBe('warn');
        expect(vectorAccelerationCalibrationReadinessCheck?.status).toBe('fail');
        expect(vectorAccelerationTraceabilityCheck?.status).toBe('fail');
        expect(String(vectorAccelerationHealthCheck?.observed || '')).toContain('healthStatus=unavailable');
        expect(String(vectorAccelerationIndexSyncCheck?.observed || '')).toContain('indexSyncStatus=unknown');
        expect(String(vectorAccelerationTraceabilityCheck?.observed || '')).toContain('externalConnector=true');
        expect(matrix.signals.queryVectorIndexAccelerationHealthStatus).toBe('unavailable');
        expect(matrix.signals.queryVectorIndexAccelerationHealthMessage).toBe('external_http_endpoint_missing');
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns fail when ann prefilter remains full_scan under stable connector conditions', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        atomCount: 256,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            lastSelectionMode: 'full_scan',
                            lastCandidateCount: 256,
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'ready',
                            circuitState: 'closed',
                            requestCount: 20,
                            retryCount: 1,
                            successCount: 19,
                            failureCount: 1,
                        },
                    },
                },
            }),
            queryCount: 20,
        });

        const vectorAccelerationPrefilterCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_prefilter_effectiveness'
        );
        expect(vectorAccelerationPrefilterCheck?.status).toBe('fail');
        expect(String(vectorAccelerationPrefilterCheck?.observed || '')).toContain('lastSelectionMode=full_scan');
        expect(String(vectorAccelerationPrefilterCheck?.expected || '')).toContain(
            'lastSelectionMode=token_prefilter|token_signature_prefilter'
        );
        expect(matrix.signals.queryVectorIndexAccelerationMode).toBe('ann_prefilter');
        expect(matrix.signals.queryVectorIndexAccelerationLastSelectionMode).toBe('full_scan');
        expect(matrix.signals.queryVectorIndexAccelerationLastCandidateCount).toBe(256);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns pass when ann prefilter full_scan sample is below dedicated prefilter minimum', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        atomCount: 256,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            lastSelectionMode: 'full_scan',
                            lastCandidateCount: 256,
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'ready',
                            circuitState: 'closed',
                            requestCount: 6,
                            retryCount: 1,
                            successCount: 5,
                            failureCount: 1,
                        },
                    },
                },
            }),
            queryCount: 20,
            thresholds: {
                queryVectorAccelerationPrefilterMinRequestSample: 10,
            },
        });

        const vectorAccelerationPrefilterCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_prefilter_effectiveness'
        );
        const vectorAccelerationCalibrationReadinessCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_calibration_readiness'
        );
        expect(vectorAccelerationPrefilterCheck?.status).toBe('pass');
        expect(vectorAccelerationCalibrationReadinessCheck?.status).toBe('warn');
        expect(String(vectorAccelerationPrefilterCheck?.message || '')).toContain('deferred');
        expect(String(vectorAccelerationCalibrationReadinessCheck?.message || '')).toContain('not closed yet');
        expect(matrix.signals.queryVectorIndexAccelerationLastSelectionMode).toBe('full_scan');
    });

    test('returns fail when ann prefilter candidate ratio breaches configured fail threshold', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        atomCount: 100,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            lastSelectionMode: 'token_prefilter',
                            lastCandidateCount: 99,
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'ready',
                            circuitState: 'closed',
                            requestCount: 20,
                            retryCount: 1,
                            successCount: 19,
                            failureCount: 1,
                        },
                    },
                },
            }),
            queryCount: 20,
            thresholds: {
                queryVectorAccelerationPrefilterWarnCandidateRatioPct: 80,
                queryVectorAccelerationPrefilterFailCandidateRatioPct: 95,
            },
        });

        const vectorAccelerationPrefilterCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_prefilter_effectiveness'
        );
        expect(vectorAccelerationPrefilterCheck?.status).toBe('fail');
        expect(String(vectorAccelerationPrefilterCheck?.observed || '')).toContain('candidateRatio=99%');
        expect(String(vectorAccelerationPrefilterCheck?.expected || '')).toContain('candidateRatio<95%');
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns fail when vector acceleration circuit state is open', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'degraded',
                            healthMessage: 'external_http_circuit_open',
                            circuitState: 'open',
                            consecutiveFailures: 4,
                            shortCircuitCount: 9,
                            requestCount: 20,
                            retryCount: 6,
                            successCount: 10,
                            failureCount: 10,
                            halfOpenProbeSuccessCount: 1,
                            halfOpenProbeFailureCount: 2,
                        },
                    },
                },
            }),
            queryCount: 14,
        });

        const vectorAccelerationCircuitCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_circuit_state'
        );
        const vectorAccelerationTraceabilityCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_traceability'
        );
        expect(vectorAccelerationCircuitCheck?.status).toBe('fail');
        expect(vectorAccelerationTraceabilityCheck?.status).toBe('fail');
        expect(String(vectorAccelerationCircuitCheck?.observed || '')).toContain('circuitState=open');
        expect(String(vectorAccelerationTraceabilityCheck?.expected || '')).toContain(
            'lastRequestId|lastErrorCode|lastRetryAfterMs'
        );
        expect(matrix.signals.queryVectorIndexAccelerationCircuitState).toBe('open');
        expect(matrix.signals.queryVectorIndexAccelerationShortCircuitCount).toBe(9);
        expect(matrix.signals.queryVectorIndexAccelerationShortCircuitRatioPct).toBe(45);
        expect(matrix.signals.queryVectorIndexAccelerationHalfOpenProbeCount).toBe(3);
        expect(matrix.signals.queryVectorIndexAccelerationHalfOpenSuccessRatePct).toBeCloseTo(33.3333, 3);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitWarnBudgetExceeded).toBe(true);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitFailBudgetExceeded).toBe(true);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitBudgetStatus).toBe('fail');
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns warn when closed circuit exceeds warn budgets', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'ready',
                            circuitState: 'closed',
                            consecutiveFailures: 1,
                            shortCircuitCount: 2,
                            requestCount: 50,
                            retryCount: 3,
                            successCount: 45,
                            failureCount: 5,
                        },
                    },
                },
            }),
            queryCount: 14,
            thresholds: {
                queryVectorAccelerationShortCircuitWarnCount: 2,
                queryVectorAccelerationShortCircuitFailCount: 5,
                queryVectorAccelerationShortCircuitWarnRatioPct: 10,
                queryVectorAccelerationShortCircuitFailRatioPct: 30,
                queryVectorAccelerationConsecutiveFailuresWarnCount: 1,
                queryVectorAccelerationConsecutiveFailuresFailCount: 3,
                queryVectorAccelerationHalfOpenSuccessWarnRatioPct: 80,
                queryVectorAccelerationHalfOpenSuccessFailRatioPct: 50,
            },
        });

        const vectorAccelerationCircuitCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_circuit_state'
        );
        expect(vectorAccelerationCircuitCheck?.status).toBe('warn');
        expect(String(vectorAccelerationCircuitCheck?.observed || '')).toContain('circuitState=closed');
        expect(String(vectorAccelerationCircuitCheck?.expected || '')).toContain('shortCircuitCount<2');
        expect(matrix.signals.queryVectorIndexAccelerationShortCircuitRatioPct).toBe(4);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitWarnBudgetExceeded).toBe(true);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitFailBudgetExceeded).toBe(false);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitBudgetStatus).toBe('warn');
        expect(matrix.overallStatus).toBe('degraded');
    });

    test('returns fail when closed circuit exceeds fail budgets', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'degraded',
                            circuitState: 'closed',
                            consecutiveFailures: 3,
                            shortCircuitCount: 4,
                            requestCount: 10,
                            retryCount: 6,
                            successCount: 4,
                            failureCount: 6,
                            halfOpenProbeSuccessCount: 1,
                            halfOpenProbeFailureCount: 2,
                        },
                    },
                },
            }),
            queryCount: 14,
            thresholds: {
                queryVectorAccelerationShortCircuitWarnCount: 1,
                queryVectorAccelerationShortCircuitFailCount: 4,
                queryVectorAccelerationShortCircuitWarnRatioPct: 5,
                queryVectorAccelerationShortCircuitFailRatioPct: 25,
                queryVectorAccelerationConsecutiveFailuresWarnCount: 1,
                queryVectorAccelerationConsecutiveFailuresFailCount: 3,
                queryVectorAccelerationHalfOpenSuccessWarnRatioPct: 80,
                queryVectorAccelerationHalfOpenSuccessFailRatioPct: 50,
            },
        });

        const vectorAccelerationCircuitCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_circuit_state'
        );
        expect(vectorAccelerationCircuitCheck?.status).toBe('fail');
        expect(String(vectorAccelerationCircuitCheck?.observed || '')).toContain('shortCircuitRatio=40%');
        expect(String(vectorAccelerationCircuitCheck?.expected || '')).toContain('shortCircuitRatio<25%');
        expect(matrix.signals.queryVectorIndexAccelerationShortCircuitRatioPct).toBe(40);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitWarnBudgetExceeded).toBe(true);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitFailBudgetExceeded).toBe(true);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitBudgetStatus).toBe('fail');
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns fail when half-open circuit recovery success rate is below fail floor', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'degraded',
                            circuitState: 'half_open',
                            consecutiveFailures: 1,
                            shortCircuitCount: 1,
                            requestCount: 10,
                            retryCount: 5,
                            successCount: 4,
                            failureCount: 6,
                            halfOpenProbeSuccessCount: 1,
                            halfOpenProbeFailureCount: 4,
                        },
                    },
                },
            }),
            queryCount: 14,
            thresholds: {
                queryVectorAccelerationShortCircuitWarnCount: 1,
                queryVectorAccelerationShortCircuitFailCount: 5,
                queryVectorAccelerationShortCircuitWarnRatioPct: 5,
                queryVectorAccelerationShortCircuitFailRatioPct: 40,
                queryVectorAccelerationConsecutiveFailuresWarnCount: 1,
                queryVectorAccelerationConsecutiveFailuresFailCount: 4,
                queryVectorAccelerationHalfOpenSuccessWarnRatioPct: 80,
                queryVectorAccelerationHalfOpenSuccessFailRatioPct: 50,
            },
        });

        const vectorAccelerationCircuitCheck = matrix.checks.find(
            (check) => check.checkId === 'query_vector_acceleration_circuit_state'
        );
        expect(vectorAccelerationCircuitCheck?.status).toBe('fail');
        expect(String(vectorAccelerationCircuitCheck?.observed || '')).toContain('circuitState=half_open');
        expect(String(vectorAccelerationCircuitCheck?.observed || '')).toContain('halfOpenSuccessRate=20%');
        expect(String(vectorAccelerationCircuitCheck?.expected || '')).toContain('halfOpenSuccessRate>=50%');
        expect(matrix.signals.queryVectorIndexAccelerationShortCircuitRatioPct).toBe(10);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitWarnBudgetExceeded).toBe(true);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitFailBudgetExceeded).toBe(true);
        expect(matrix.signals.queryVectorIndexAccelerationCircuitBudgetStatus).toBe('fail');
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns fail when query explainability evidence/temporal ratios drop below hard floors', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            queryExplainabilityTelemetry: {
                sampleCount: 20,
                evidenceCoverageRatioPct: 68,
                relationPathCoverageRatioPct: 55,
                temporalValidityPassRatioPct: 70,
                averageEvidenceSpanCount: 1.4,
                averageRelationPathLength: 0.8,
            },
            thresholds: {
                minQuerySampleSize: 5,
                queryEvidenceCoverageWarnRatioPct: 90,
                queryEvidenceCoverageFailRatioPct: 75,
                queryTemporalValidityWarnRatioPct: 92,
                queryTemporalValidityFailRatioPct: 80,
            },
        });

        const evidenceCheck = matrix.checks.find((check) => check.checkId === 'query_evidence_coverage_ratio');
        const temporalCheck = matrix.checks.find((check) => check.checkId === 'query_temporal_validity_ratio');
        expect(evidenceCheck?.status).toBe('fail');
        expect(temporalCheck?.status).toBe('fail');
        expect(evidenceCheck?.expected).toBe('evidenceCoverage>=75%');
        expect(temporalCheck?.expected).toBe('temporalValidity>=80%');
        expect(matrix.signals.queryExplainabilitySampleCount).toBe(20);
        expect(matrix.signals.queryEvidenceCoverageRatioPct).toBe(68);
        expect(matrix.signals.queryRelationPathCoverageRatioPct).toBe(55);
        expect(matrix.signals.queryTemporalValidityPassRatioPct).toBe(70);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns warn when explainability sample count is insufficient', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            queryExplainabilityTelemetry: {
                sampleCount: 2,
                evidenceCoverageRatioPct: 95,
                temporalValidityPassRatioPct: 96,
            },
            thresholds: {
                minQuerySampleSize: 5,
            },
        });

        const evidenceCheck = matrix.checks.find((check) => check.checkId === 'query_evidence_coverage_ratio');
        const temporalCheck = matrix.checks.find((check) => check.checkId === 'query_temporal_validity_ratio');
        expect(evidenceCheck?.status).toBe('warn');
        expect(temporalCheck?.status).toBe('warn');
        expect(evidenceCheck?.expected).toBe('sampleCount>=5');
        expect(temporalCheck?.expected).toBe('sampleCount>=5');
    });

    test('returns fail when cross-backend explainability gap exceeds hard consistency ceiling', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 24,
            queryBackendComparisonTelemetry: {
                summary: {
                    returnedRecords: 12,
                    averageLeftEvidenceCoverageRatio: 0.94,
                    averageRightEvidenceCoverageRatio: 0.58,
                    averageLeftRelationPathCoverageRatio: 0.81,
                    averageRightRelationPathCoverageRatio: 0.62,
                    averageLeftTemporalValidityPassRatio: 0.97,
                    averageRightTemporalValidityPassRatio: 0.63,
                },
            },
            thresholds: {
                minQuerySampleSize: 5,
                queryBackendExplainabilityGapWarnRatioPct: 18,
                queryBackendExplainabilityGapFailRatioPct: 30,
            },
        });

        const comparisonGapCheck = matrix.checks.find((check) => check.checkId === 'query_backend_explainability_gap');
        expect(comparisonGapCheck?.status).toBe('fail');
        expect(comparisonGapCheck?.expected).toBe('maxGap<=30%');
        expect(comparisonGapCheck?.debugTraceHint).toEqual({
            pathPrefix: '/api/knowledge/query/compare-backends',
            statusAtLeast: 400,
            method: '',
            errorCode: '',
        });
        expect(matrix.signals.queryBackendComparisonSampleCount).toBe(12);
        expect(matrix.signals.queryBackendComparisonEvidenceGapRatioPct).toBe(36);
        expect(matrix.signals.queryBackendComparisonRelationGapRatioPct).toBe(19);
        expect(matrix.signals.queryBackendComparisonTemporalGapRatioPct).toBe(34);
        expect(matrix.signals.queryBackendComparisonMaxExplainabilityGapRatioPct).toBe(36);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns warn when backend comparison sample size is insufficient', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 24,
            queryBackendComparisonTelemetry: {
                summary: {
                    returnedRecords: 2,
                    averageLeftEvidenceCoverageRatio: 0.9,
                    averageRightEvidenceCoverageRatio: 0.89,
                    averageLeftRelationPathCoverageRatio: 0.72,
                    averageRightRelationPathCoverageRatio: 0.7,
                    averageLeftTemporalValidityPassRatio: 0.96,
                    averageRightTemporalValidityPassRatio: 0.95,
                },
            },
            thresholds: {
                minQuerySampleSize: 5,
                queryBackendExplainabilityGapWarnRatioPct: 15,
                queryBackendExplainabilityGapFailRatioPct: 25,
            },
        });

        const comparisonGapCheck = matrix.checks.find((check) => check.checkId === 'query_backend_explainability_gap');
        expect(comparisonGapCheck?.status).toBe('warn');
        expect(comparisonGapCheck?.expected).toBe('sampleCount>=5');
        expect(matrix.signals.queryBackendComparisonSampleCount).toBe(2);
        expect(matrix.overallStatus).toBe('degraded');
    });

    test('returns fail when backend comparison trend is regressing with high confidence', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 24,
            queryBackendComparisonTrend: {
                status: 'regressing',
                score: -4.4,
                confidence: 0.81,
                summary: {
                    reason: 'Recent comparison windows diverged in explainability quality.',
                },
            },
            thresholds: {
                queryBackendTrendWarnConfidenceRatioPct: 40,
                queryBackendTrendFailConfidenceRatioPct: 70,
            },
        });

        const trendCheck = matrix.checks.find((check) => check.checkId === 'query_backend_comparison_trend');
        expect(trendCheck?.status).toBe('fail');
        expect(trendCheck?.debugTraceHint).toEqual({
            pathPrefix: '/api/knowledge/query/compare-backends/trend',
            statusAtLeast: 400,
            method: '',
            errorCode: '',
        });
        expect(matrix.signals.queryBackendComparisonTrendStatus).toBe('regressing');
        expect(matrix.signals.queryBackendComparisonTrendScore).toBe(-4.4);
        expect(matrix.signals.queryBackendComparisonTrendConfidence).toBe(0.81);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns warn/pass based on backend comparison trend status and confidence', () => {
        const warnMatrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 24,
            queryBackendComparisonTrend: {
                status: 'regressing',
                score: -2.6,
                confidence: 0.21,
                summary: {
                    reason: 'Regression signal detected but confidence remains limited.',
                },
            },
            thresholds: {
                queryBackendTrendWarnConfidenceRatioPct: 40,
                queryBackendTrendFailConfidenceRatioPct: 70,
            },
        });
        const warnTrendCheck = warnMatrix.checks.find((check) => check.checkId === 'query_backend_comparison_trend');
        expect(warnTrendCheck?.status).toBe('warn');
        expect(warnMatrix.overallStatus).toBe('degraded');

        const passMatrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 24,
            queryBackendComparisonTrend: {
                status: 'stable',
                score: 0.3,
                confidence: 0.62,
                summary: {
                    reason: 'Trend window remains within explainability guardrails.',
                },
            },
        });
        const passTrendCheck = passMatrix.checks.find((check) => check.checkId === 'query_backend_comparison_trend');
        expect(passTrendCheck?.status).toBe('pass');
        expect(passMatrix.signals.queryBackendComparisonTrendStatus).toBe('stable');
        expect(passMatrix.signals.queryBackendComparisonTrendScore).toBe(0.3);
        expect(passMatrix.signals.queryBackendComparisonTrendConfidence).toBe(0.62);
    });

    test('returns fail when backend comparison trend config cannot satisfy dual-window minimum records', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 24,
            queryBackendComparisonTelemetry: {
                summary: {
                    returnedRecords: 10,
                },
            },
            queryBackendComparisonTrendConfig: {
                limit: 2,
                windowSize: 2,
                minSamples: 2,
            },
        });

        const configCheck = matrix.checks.find((check) => check.checkId === 'query_backend_trend_config');
        expect(configCheck?.status).toBe('fail');
        expect(configCheck?.expected).toBe('limit>=4');
        expect(configCheck?.debugTraceHint).toEqual({
            pathPrefix: '/api/knowledge/query/compare-backends/trend',
            statusAtLeast: 400,
            method: '',
            errorCode: '',
        });
        expect(matrix.signals.queryBackendComparisonTrendLimit).toBe(2);
        expect(matrix.signals.queryBackendComparisonTrendWindowSize).toBe(2);
        expect(matrix.signals.queryBackendComparisonTrendMinSamples).toBe(2);
        expect(matrix.signals.queryBackendComparisonTrendRequiredRecords).toBe(4);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns warn when trend config is valid but current comparison sample budget is insufficient', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 24,
            queryBackendComparisonTelemetry: {
                summary: {
                    returnedRecords: 2,
                },
            },
            queryBackendComparisonTrendConfig: {
                limit: 8,
                windowSize: 3,
                minSamples: 2,
            },
        });

        const configCheck = matrix.checks.find((check) => check.checkId === 'query_backend_trend_config');
        expect(configCheck?.status).toBe('warn');
        expect(configCheck?.expected).toBe('sampleCount>=5');
        expect(matrix.signals.queryBackendComparisonTrendLimit).toBe(8);
        expect(matrix.signals.queryBackendComparisonTrendWindowSize).toBe(3);
        expect(matrix.signals.queryBackendComparisonTrendMinSamples).toBe(2);
        expect(matrix.signals.queryBackendComparisonTrendRequiredRecords).toBe(5);
        expect(matrix.overallStatus).toBe('degraded');
    });

    test('returns pass when trend config and sample budget are aligned', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 24,
            queryBackendComparisonTelemetry: {
                summary: {
                    returnedRecords: 6,
                },
            },
            queryBackendComparisonTrendConfig: {
                limit: 10,
                windowSize: 2,
                minSamples: 1,
            },
        });

        const configCheck = matrix.checks.find((check) => check.checkId === 'query_backend_trend_config');
        expect(configCheck?.status).toBe('pass');
        expect(configCheck?.expected).toBe('limit>=3');
        expect(matrix.signals.queryBackendComparisonTrendLimit).toBe(10);
        expect(matrix.signals.queryBackendComparisonTrendWindowSize).toBe(2);
        expect(matrix.signals.queryBackendComparisonTrendMinSamples).toBe(1);
        expect(matrix.signals.queryBackendComparisonTrendRequiredRecords).toBe(3);
    });

    test('returns fail when invalid-request ratio exceeds fail threshold', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            apiRequestErrorTelemetry: {
                totalRequests: 40,
                errorRequests: 20,
                invalidRequestErrors: 16,
                scopePathPrefix: '/api/knowledge',
                scopeMethod: 'post',
                invalidRequestTopPaths: [
                    { path: 'POST /api/knowledge/query', count: 9 },
                    { path: 'POST /api/knowledge/mastery/diagnose', count: 7 },
                ],
            },
            thresholds: {
                apiInvalidRequestMinErrorSample: 5,
                apiInvalidRequestWarnRatioPct: 35,
                apiInvalidRequestFailRatioPct: 60,
                apiInvalidRequestHotspotWarnCount: 4,
                apiInvalidRequestHotspotFailCount: 8,
            },
        });

        const apiInvalidRequestCheck = matrix.checks.find((check) => check.checkId === 'api_invalid_request_ratio');
        const apiHotspotCheck = matrix.checks.find((check) => check.checkId === 'api_invalid_request_hotspots');
        const checkOrder = matrix.checks.map((check) => String(check?.checkId || ''));
        expect(apiInvalidRequestCheck?.status).toBe('fail');
        expect(apiHotspotCheck?.status).toBe('fail');
        expect(apiInvalidRequestCheck?.expected).toBe('invalid/error<=60%');
        expect(apiHotspotCheck?.expected).toBe('topPathInvalidCount<8');
        expect(apiInvalidRequestCheck?.debugTraceHint).toEqual({
            pathPrefix: '/api/knowledge',
            statusAtLeast: 400,
            method: 'POST',
            errorCode: 'invalid_request',
        });
        expect(apiInvalidRequestCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('errorCode=invalid_request'),
            ])
        );
        expect(apiHotspotCheck?.debugTraceHint).toEqual({
            pathPrefix: '/api/knowledge/query',
            statusAtLeast: 400,
            method: 'POST',
            errorCode: 'invalid_request',
        });
        expect(apiHotspotCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('POST /api/knowledge/query'),
            ])
        );
        expect(Number(apiInvalidRequestCheck?.priorityScore || 0)).toBeGreaterThan(0);
        expect(Number(apiHotspotCheck?.priorityScore || 0)).toBeGreaterThan(
            Number(apiInvalidRequestCheck?.priorityScore || 0)
        );
        expect(checkOrder.indexOf('api_invalid_request_hotspots')).toBeGreaterThanOrEqual(0);
        expect(checkOrder.indexOf('api_invalid_request_ratio')).toBeGreaterThanOrEqual(0);
        expect(checkOrder.indexOf('api_invalid_request_hotspots')).toBeLessThan(
            checkOrder.indexOf('api_invalid_request_ratio')
        );
        expect(matrix.signals.apiTraceWindowRequests).toBe(40);
        expect(matrix.signals.apiTraceWindowErrors).toBe(20);
        expect(matrix.signals.apiTraceWindowInvalidRequests).toBe(16);
        expect(matrix.signals.apiTraceWindowInvalidRequestRatioPct).toBe(80);
        expect(matrix.signals.apiTraceWindowInvalidRequestToTotalRatioPct).toBe(40);
        expect(matrix.signals.apiTraceScopePathPrefix).toBe('/api/knowledge');
        expect(matrix.signals.apiTraceScopeMethod).toBe('POST');
        expect(matrix.signals.apiTraceWindowInvalidRequestTopPaths.length).toBeGreaterThan(0);
        expect(matrix.signals.apiTraceWindowInvalidRequestTopPaths[0]?.path).toBe('POST /api/knowledge/query');
        expect(matrix.signals.apiTraceWindowInvalidRequestTopPaths[0]?.count).toBe(9);
        expect(matrix.signals.topRiskCheckId).toBe('api_invalid_request_hotspots');
        expect(matrix.signals.topRiskStatus).toBe('fail');
        expect(matrix.signals.topRiskPriorityScore).toBeGreaterThan(0);
        expect(matrix.signals.topRiskRecommendedActions.length).toBeGreaterThan(0);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns fail when server-error ratio exceeds fail threshold', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            apiRequestErrorTelemetry: {
                totalRequests: 50,
                errorRequests: 11,
                invalidRequestErrors: 3,
                serverErrorRequests: 9,
                scopePathPrefix: '/api/knowledge',
                scopeMethod: 'post',
                serverErrorTopPaths: [
                    { path: 'POST /api/knowledge/query', count: 7 },
                    { path: 'POST /api/knowledge/session/execute', count: 2 },
                ],
            },
            thresholds: {
                apiServerErrorMinRequestSample: 8,
                apiServerErrorWarnRatioPct: 6,
                apiServerErrorFailRatioPct: 15,
            },
        });

        const serverErrorCheck = matrix.checks.find((check) => check.checkId === 'api_server_error_ratio');
        const serverErrorHotspotCheck = matrix.checks.find((check) => check.checkId === 'api_server_error_hotspots');
        const checkOrder = matrix.checks.map((check) => String(check?.checkId || ''));
        expect(serverErrorCheck?.status).toBe('fail');
        expect(serverErrorCheck?.expected).toBe('server/total<=15%');
        expect(serverErrorHotspotCheck?.status).toBe('fail');
        expect(serverErrorHotspotCheck?.expected).toBe('topPathServerErrorCount<5');
        expect(serverErrorCheck?.debugTraceHint).toEqual({
            pathPrefix: '/api/knowledge/query',
            statusAtLeast: 500,
            method: 'POST',
            errorCode: '',
        });
        expect(serverErrorHotspotCheck?.debugTraceHint).toEqual({
            pathPrefix: '/api/knowledge/query',
            statusAtLeast: 500,
            method: 'POST',
            errorCode: '',
        });
        expect(serverErrorCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('status>=500'),
            ])
        );
        expect(Number(serverErrorCheck?.priorityScore || 0)).toBeGreaterThan(0);
        expect(Number(serverErrorHotspotCheck?.priorityScore || 0)).toBeGreaterThan(
            Number(serverErrorCheck?.priorityScore || 0)
        );
        expect(checkOrder.indexOf('api_server_error_hotspots')).toBeGreaterThanOrEqual(0);
        expect(checkOrder.indexOf('api_server_error_ratio')).toBeGreaterThanOrEqual(0);
        expect(checkOrder.indexOf('api_server_error_hotspots')).toBeLessThan(
            checkOrder.indexOf('api_server_error_ratio')
        );
        expect(matrix.signals.apiTraceWindowServerErrors).toBe(9);
        expect(matrix.signals.apiTraceWindowServerErrorRatioPct).toBe(18);
        expect(matrix.signals.apiTraceWindowServerErrorTopPaths.length).toBe(2);
        expect(matrix.signals.apiTraceWindowServerErrorTopPaths[0]?.path).toBe('POST /api/knowledge/query');
        expect(matrix.signals.apiTraceWindowServerErrorTopPaths[0]?.count).toBe(7);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns fail when transient-error ratio and hotspot concentration exceed thresholds', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            apiRequestErrorTelemetry: {
                totalRequests: 40,
                errorRequests: 14,
                invalidRequestErrors: 1,
                serverErrorRequests: 3,
                transientErrorRequests: 10,
                scopePathPrefix: '/api/knowledge',
                scopeMethod: 'GET',
                transientErrorTopPaths: [
                    { path: 'GET /api/knowledge/state', count: 7 },
                    { path: 'GET /api/runtime-request-trace', count: 3 },
                ],
            },
            thresholds: {
                apiTransientErrorMinRequestSample: 5,
                apiTransientErrorWarnRatioPct: 8,
                apiTransientErrorFailRatioPct: 20,
                apiTransientErrorHotspotWarnCount: 3,
                apiTransientErrorHotspotFailCount: 6,
            },
        });

        const transientRatioCheck = matrix.checks.find((check) => check.checkId === 'api_transient_error_ratio');
        const transientHotspotCheck = matrix.checks.find((check) => check.checkId === 'api_transient_error_hotspots');
        expect(transientRatioCheck?.status).toBe('fail');
        expect(transientHotspotCheck?.status).toBe('fail');
        expect(transientRatioCheck?.expected).toBe('transient/total<=20%');
        expect(transientHotspotCheck?.expected).toBe('topPathTransientErrorCount<6');
        expect(transientRatioCheck?.debugTraceHint).toEqual({
            pathPrefix: '/api/knowledge/state',
            statusAtLeast: 400,
            method: 'GET',
            errorCode: '',
        });
        expect(transientHotspotCheck?.debugTraceHint).toEqual({
            pathPrefix: '/api/knowledge/state',
            statusAtLeast: 400,
            method: 'GET',
            errorCode: '',
        });
        expect(transientHotspotCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('408/425/429/502/503/504'),
            ])
        );
        expect(matrix.signals.apiTraceWindowTransientErrors).toBe(10);
        expect(matrix.signals.apiTraceWindowTransientErrorRatioPct).toBe(25);
        expect(matrix.signals.apiTraceWindowTransientErrorTopPaths.length).toBe(2);
        expect(matrix.signals.apiTraceWindowTransientErrorTopPaths[0]?.path).toBe('GET /api/knowledge/state');
        expect(matrix.signals.apiTraceWindowTransientErrorTopPaths[0]?.count).toBe(7);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns fail when api p95 latency and slow-route hotspot exceed thresholds', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 30,
            apiRequestErrorTelemetry: {
                totalRequests: 30,
                errorRequests: 6,
                invalidRequestErrors: 1,
                serverErrorRequests: 2,
                transientErrorRequests: 3,
                averageDurationMs: 820,
                p95DurationMs: 2800,
                scopePathPrefix: '/api/knowledge',
                scopeMethod: 'post',
                slowTopPaths: [
                    { path: 'POST /api/knowledge/session/execute', count: 5, p95DurationMs: 3600 },
                    { path: 'POST /api/knowledge/ingest', count: 3, p95DurationMs: 2400 },
                ],
            },
            thresholds: {
                apiLatencyMinRequestSample: 10,
                apiLatencyP95WarnMs: 900,
                apiLatencyP95FailMs: 2400,
                apiLatencyHotspotWarnMs: 1500,
                apiLatencyHotspotFailMs: 3200,
            },
        });

        const latencyP95Check = matrix.checks.find((check) => check.checkId === 'api_latency_p95');
        const latencyHotspotCheck = matrix.checks.find((check) => check.checkId === 'api_latency_hotspots');
        expect(latencyP95Check?.status).toBe('fail');
        expect(latencyHotspotCheck?.status).toBe('fail');
        expect(latencyP95Check?.expected).toBe('p95<=2400ms');
        expect(latencyHotspotCheck?.expected).toBe('topPathP95<=3200ms');
        expect(latencyP95Check?.debugTraceHint).toEqual({
            pathPrefix: '/api/knowledge/session/execute',
            statusAtLeast: 0,
            method: 'POST',
            errorCode: '',
        });
        expect(latencyHotspotCheck?.debugTraceHint).toEqual({
            pathPrefix: '/api/knowledge/session/execute',
            statusAtLeast: 0,
            method: 'POST',
            errorCode: '',
        });
        expect(latencyP95Check?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('Current p95=2800ms'),
            ])
        );
        expect(latencyHotspotCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('hotspot p95=3600ms'),
            ])
        );
        expect(matrix.signals.apiTraceAverageDurationMs).toBe(820);
        expect(matrix.signals.apiTraceP95DurationMs).toBe(2800);
        expect(matrix.signals.apiTraceSlowTopPaths.length).toBe(2);
        expect(matrix.signals.apiTraceSlowTopPaths[0]?.path).toBe('POST /api/knowledge/session/execute');
        expect(matrix.signals.apiTraceSlowTopPaths[0]?.count).toBe(5);
        expect(matrix.signals.apiTraceSlowTopPaths[0]?.p95DurationMs).toBe(3600);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns pass when current trace window has no API validation errors', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            apiRequestErrorTelemetry: {
                totalRequests: 24,
                errorRequests: 0,
                invalidRequestErrors: 0,
                scopePathPrefix: '/api/knowledge',
                scopeMethod: 'GET',
            },
            learningQualityTrend: {
                status: 'stable',
                score: 0.24,
                confidence: 0.7,
            },
            sessionPlanQualityHistory: {
                summary: {
                    totalRecords: 4,
                    overallPassRatePct: 75,
                    consecutiveFailureCount: 0,
                    commonFailedGates: [],
                },
            },
            sessionPlanQualityTrend: {
                status: 'stable',
                score: 0.11,
                confidence: 0.64,
            },
            memoryPolicyDiagnostics: {
                summary: {
                    totalEntries: 18,
                    expiredEntries: 0,
                    staleEntries: 1,
                    lowConfidenceEntries: 1,
                    healthScore: 92,
                    status: 'healthy',
                },
            },
            memoryPolicyTrend: {
                status: 'stable',
                score: 0.08,
                confidence: 0.54,
            },
        });

        const apiInvalidRequestCheck = matrix.checks.find((check) => check.checkId === 'api_invalid_request_ratio');
        const apiServerErrorCheck = matrix.checks.find((check) => check.checkId === 'api_server_error_ratio');
        const apiServerErrorHotspotCheck = matrix.checks.find((check) => check.checkId === 'api_server_error_hotspots');
        expect(apiInvalidRequestCheck?.status).toBe('pass');
        expect(apiServerErrorCheck?.status).toBe('pass');
        expect(apiServerErrorHotspotCheck?.status).toBe('pass');
        expect(matrix.signals.apiTraceWindowRequests).toBe(24);
        expect(matrix.signals.apiTraceWindowErrors).toBe(0);
        expect(matrix.signals.apiTraceWindowInvalidRequests).toBe(0);
        expect(matrix.signals.apiTraceWindowInvalidRequestRatioPct).toBe(0);
        expect(matrix.signals.apiTraceWindowInvalidRequestToTotalRatioPct).toBe(0);
        expect(matrix.signals.apiTraceWindowServerErrors).toBe(0);
        expect(matrix.signals.apiTraceWindowServerErrorRatioPct).toBe(0);
        expect(matrix.signals.apiTraceWindowServerErrorTopPaths).toEqual([]);
        expect(matrix.signals.apiTraceScopePathPrefix).toBe('/api/knowledge');
        expect(matrix.signals.apiTraceScopeMethod).toBe('GET');
    });

    test('returns warn for keyword-only backend and graphdb fallback', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'graphdb',
            configuredQueryBackend: 'keyword_only',
            store: createStoreDiagnostics({
                storeType: 'graphdb',
                usingFallback: true,
                fallbackStoreType: 'file',
                backendReady: true,
            }),
            queryDiagnostics: createQueryDiagnostics({
                fallbackCount: 1,
                lastError: 'backend transient error',
            }),
            queryCount: 12,
        });

        const checkById = new Map(matrix.checks.map((check) => [check.checkId, check]));
        expect(checkById.get('store_graphdb_fallback')?.status).toBe('warn');
        expect(checkById.get('query_graph_retrieval_capability')?.status).toBe('warn');
        expect(checkById.get('query_backend_last_error')?.status).toBe('warn');
        expect(checkById.get('query_backend_last_error')?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('/api/knowledge/query'),
            ])
        );
        expect(matrix.overallStatus).toBe('degraded');
    });

    test('returns fail when graphdb connector health is unavailable in strict runtime path', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'graphdb',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics({
                storeType: 'graphdb',
                usingFallback: false,
                backendReady: true,
                adapterId: 'external-http-graphdb',
                connector: {
                    healthStatus: 'unavailable',
                    circuitState: 'open',
                    requestCount: 9,
                    retryCount: 3,
                    shortCircuitCount: 2,
                    successCount: 1,
                    failureCount: 8,
                    consecutiveFailures: 4,
                    lastRequestId: 'graphdb-req-009',
                    lastErrorCode: 'circuit_open',
                    lastStatusCode: 503,
                    lastRetryAfterMs: 4200,
                },
            }),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 12,
        });

        const checkById = new Map(matrix.checks.map((check) => [check.checkId, check]));
        expect(checkById.get('store_graphdb_connector_health')?.status).toBe('fail');
        expect(checkById.get('store_graphdb_connector_budget')?.status).toBe('fail');
        expect(matrix.signals.graphDbConnectorHealthStatus).toBe('unavailable');
        expect(matrix.signals.graphDbConnectorCircuitState).toBe('open');
        expect(matrix.signals.graphDbConnectorFailureRatioPct).toBeCloseTo(88.8889, 4);
        expect(matrix.signals.graphDbConnectorShortCircuitRatioPct).toBeCloseTo(22.2222, 4);
        expect(matrix.signals.graphDbConnectorFailBudgetExceeded).toBe(true);
        expect(matrix.signals.graphDbConnectorBudgetStatus).toBe('fail');
        expect(matrix.signals.graphDbConnectorLastErrorCode).toBe('circuit_open');
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns warn when graphdb connector budget approaches threshold under strict runtime path', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'graphdb',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics({
                storeType: 'graphdb',
                usingFallback: false,
                backendReady: true,
                adapterId: 'external-http-graphdb',
                connector: {
                    healthStatus: 'ready',
                    circuitState: 'closed',
                    requestCount: 20,
                    retryCount: 2,
                    shortCircuitCount: 2,
                    successCount: 16,
                    failureCount: 4,
                    consecutiveFailures: 1,
                    lastRequestId: 'graphdb-req-020',
                },
            }),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 12,
            thresholds: {
                storeGraphDbConnectorMinRequestSample: 5,
                storeGraphDbConnectorFailureWarnRatioPct: 15,
                storeGraphDbConnectorFailureFailRatioPct: 30,
                storeGraphDbConnectorShortCircuitWarnRatioPct: 5,
                storeGraphDbConnectorShortCircuitFailRatioPct: 20,
                storeGraphDbConnectorConsecutiveFailuresWarnCount: 1,
                storeGraphDbConnectorConsecutiveFailuresFailCount: 3,
            },
        });

        const checkById = new Map(matrix.checks.map((check) => [check.checkId, check]));
        expect(checkById.get('store_graphdb_connector_health')?.status).toBe('warn');
        expect(checkById.get('store_graphdb_connector_budget')?.status).toBe('warn');
        expect(matrix.signals.graphDbConnectorFailureRatioPct).toBe(20);
        expect(matrix.signals.graphDbConnectorShortCircuitRatioPct).toBe(10);
        expect(matrix.signals.graphDbConnectorWarnBudgetExceeded).toBe(true);
        expect(matrix.signals.graphDbConnectorFailBudgetExceeded).toBe(false);
        expect(matrix.signals.graphDbConnectorBudgetStatus).toBe('warn');
        expect(matrix.overallStatus).toBe('degraded');
    });

    test('returns pass when graphdb connector health telemetry is stable', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'graphdb',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics({
                storeType: 'graphdb',
                usingFallback: false,
                backendReady: true,
                adapterId: 'external-http-graphdb',
                connector: {
                    healthStatus: 'ready',
                    healthMessage: 'graphdb_http_ok',
                    circuitState: 'closed',
                    requestCount: 16,
                    retryCount: 1,
                    shortCircuitCount: 0,
                    successCount: 15,
                    failureCount: 1,
                    consecutiveFailures: 0,
                    lastRequestId: 'graphdb-req-016',
                    lastErrorCode: '',
                    lastStatusCode: 200,
                    lastRetryAfterMs: 0,
                },
            }),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 12,
        });

        const checkById = new Map(matrix.checks.map((check) => [check.checkId, check]));
        expect(checkById.get('store_graphdb_connector_health')?.status).toBe('pass');
        expect(checkById.get('store_graphdb_connector_budget')?.status).toBe('pass');
        expect(matrix.signals.graphDbConnectorHealthStatus).toBe('ready');
        expect(matrix.signals.graphDbConnectorCircuitState).toBe('closed');
        expect(matrix.signals.graphDbConnectorRequestCount).toBe(16);
        expect(matrix.signals.graphDbConnectorFailureRatioPct).toBe(6.25);
        expect(matrix.signals.graphDbConnectorShortCircuitRatioPct).toBe(0);
        expect(matrix.signals.graphDbConnectorBudgetStatus).toBe('ok');
    });

    test('returns pass when quality trend is improving', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 12,
            learningQualityTrend: {
                status: 'improving',
                score: 3.72,
                confidence: 0.84,
                reason: 'Recent quality snapshots improved across key signals.',
            },
            sessionPlanQualityHistory: {
                summary: {
                    totalRecords: 6,
                    overallPassRatePct: 83.33,
                    consecutiveFailureCount: 0,
                    commonFailedGates: [],
                },
            },
            sessionPlanQualityTrend: {
                status: 'improving',
                score: 3.4,
                confidence: 0.82,
                reason: 'Recent plan quality windows improved.',
            },
            memoryPolicyDiagnostics: {
                summary: {
                    totalEntries: 48,
                    expiredEntries: 0,
                    staleEntries: 6,
                    lowConfidenceEntries: 4,
                    healthScore: 92.4,
                    status: 'healthy',
                    reason: 'Memory policy signals are within expected bounds.',
                },
            },
            memoryPolicyTrend: {
                status: 'improving',
                score: 4.1,
                confidence: 0.78,
                reason: 'Recent memory diagnostics windows improved.',
            },
        });

        const trendCheck = matrix.checks.find((check) => check.checkId === 'quality_trend_direction');
        const planQualityCheck = matrix.checks.find((check) => check.checkId === 'session_plan_quality_gate');
        const planQualityTrendCheck = matrix.checks.find((check) => check.checkId === 'session_plan_quality_trend');
        const memoryPolicyCheck = matrix.checks.find((check) => check.checkId === 'memory_policy_health');
        const memoryPolicyTrendCheck = matrix.checks.find((check) => check.checkId === 'memory_policy_trend');
        expect(trendCheck?.status).toBe('pass');
        expect(trendCheck?.expected).toBe('status in {stable, improving}');
        expect(planQualityCheck?.status).toBe('pass');
        expect(planQualityTrendCheck?.status).toBe('pass');
        expect(memoryPolicyCheck?.status).toBe('pass');
        expect(memoryPolicyTrendCheck?.status).toBe('pass');
        expect(matrix.signals.qualityTrendStatus).toBe('improving');
        expect(matrix.signals.qualityTrendScore).toBe(3.72);
        expect(matrix.signals.qualityTrendConfidence).toBe(0.84);
        expect(matrix.signals.sessionPlanQualityRecords).toBe(6);
        expect(matrix.signals.sessionPlanQualityPassRatePct).toBe(83.33);
        expect(matrix.signals.sessionPlanQualityFailureStreak).toBe(0);
        expect(matrix.signals.sessionPlanQualityTrendStatus).toBe('improving');
        expect(matrix.signals.sessionPlanQualityTrendScore).toBe(3.4);
        expect(matrix.signals.sessionPlanQualityTrendConfidence).toBe(0.82);
        expect(matrix.signals.memoryPolicyStatus).toBe('healthy');
        expect(matrix.signals.memoryPolicyHealthScore).toBe(92.4);
        expect(matrix.signals.memoryPolicyTotalEntries).toBe(48);
        expect(matrix.signals.memoryPolicyExpiredEntries).toBe(0);
        expect(matrix.signals.memoryPolicyStaleEntries).toBe(6);
        expect(matrix.signals.memoryPolicyLowConfidenceEntries).toBe(4);
        expect(matrix.signals.memoryPolicyTrendStatus).toBe('improving');
        expect(matrix.signals.memoryPolicyTrendScore).toBe(4.1);
        expect(matrix.signals.memoryPolicyTrendConfidence).toBe(0.78);
        expect(matrix.signals.topRiskCheckId).toBe('');
        expect(matrix.signals.topRiskStatus).toBe('none');
        expect(matrix.signals.topRiskPriorityScore).toBe(0);
        expect(matrix.signals.topRiskRecommendedActions).toEqual([]);
        expect(matrix.overallStatus).toBe('ready');
    });

    test('returns fail when quality trend is regressing', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 12,
            learningQualityTrend: {
                status: 'regressing',
                score: -4.11,
                confidence: 0.91,
                reason: 'Recent quality snapshots regressed.',
            },
        });

        const trendCheck = matrix.checks.find((check) => check.checkId === 'quality_trend_direction');
        expect(trendCheck?.status).toBe('fail');
        expect(trendCheck?.expected).toBe('status in {stable, improving}');
        expect(trendCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('Trend status=regressing'),
            ])
        );
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns warn when quality trend has insufficient data', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 12,
            learningQualityTrend: {
                status: 'insufficient_data',
                score: 0,
                confidence: 0,
                reason: 'Not enough quality snapshots to compare windows.',
            },
        });

        const trendCheck = matrix.checks.find((check) => check.checkId === 'quality_trend_direction');
        expect(trendCheck?.status).toBe('warn');
        expect(trendCheck?.expected).toBe('status in {stable, improving}');
        expect(matrix.overallStatus).toBe('degraded');
    });

    test('returns warn when session plan quality history is missing', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 16,
            learningQualityTrend: {
                status: 'stable',
                score: 0.12,
                confidence: 0.64,
            },
        });

        const sessionQualityCheck = matrix.checks.find((check) => check.checkId === 'session_plan_quality_gate');
        expect(sessionQualityCheck?.status).toBe('warn');
        expect(sessionQualityCheck?.expected).toBe('records>=1');
        expect(matrix.overallStatus).toBe('degraded');
    });

    test('returns fail when session plan quality gate has repeated failures', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 16,
            learningQualityTrend: {
                status: 'stable',
                score: 0.11,
                confidence: 0.7,
            },
            sessionPlanQualityHistory: {
                summary: {
                    totalRecords: 8,
                    overallPassRatePct: 37.5,
                    consecutiveFailureCount: 3,
                    commonFailedGates: [
                        { gateId: 'policy_budget_alignment', count: 4 },
                        { gateId: 'evidence_coverage_ratio', count: 3 },
                    ],
                },
            },
            sessionPlanQualityTrend: {
                status: 'regressing',
                score: -4.6,
                confidence: 0.88,
                reason: 'Repeated gate failures increased in recent window.',
            },
            thresholds: {
                sessionPlanQualityWarnFailureStreak: 1,
                sessionPlanQualityFailFailureStreak: 2,
            },
        });

        const sessionQualityCheck = matrix.checks.find((check) => check.checkId === 'session_plan_quality_gate');
        const sessionQualityTrendCheck = matrix.checks.find((check) => check.checkId === 'session_plan_quality_trend');
        expect(sessionQualityCheck?.status).toBe('fail');
        expect(sessionQualityTrendCheck?.status).toBe('fail');
        expect(sessionQualityCheck?.expected).toBe('failureStreak<2');
        expect(sessionQualityCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('failureStreak=3'),
            ])
        );
        expect(String(sessionQualityCheck?.observed || '')).toContain('failedGates=policy_budget_alignment:4|evidence_coverage_ratio:3');
        expect(matrix.signals.sessionPlanQualityFailureStreak).toBe(3);
        expect(matrix.signals.sessionPlanQualityTrendStatus).toBe('regressing');
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('passes orchestration path-strategy alignment when trend-driven selections improve mastery', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 16,
            learningQualityTrend: {
                status: 'stable',
                score: 0.25,
                confidence: 0.72,
            },
            sessionPlanQualityHistory: {
                summary: {
                    totalRecords: 6,
                    overallPassRatePct: 84,
                    consecutiveFailureCount: 0,
                    commonFailedGates: [],
                },
            },
            sessionPlanQualityTrend: {
                status: 'stable',
                score: 0.19,
                confidence: 0.63,
            },
            memoryPolicyDiagnostics: {
                summary: {
                    totalEntries: 18,
                    expiredEntries: 0,
                    staleEntries: 2,
                    lowConfidenceEntries: 1,
                    healthScore: 91,
                    status: 'healthy',
                },
            },
            memoryPolicyTrend: {
                status: 'stable',
                score: 0.12,
                confidence: 0.58,
            },
            sessionStrategyTelemetry: {
                totalRecords: 12,
                strategyRecords: 10,
                trendAutoSelectionSharePct: 60,
                trendAutoAverageMasteryDeltaPct: 6.4,
                trendAutoNegativeRatioPct: 20,
                modeFallbackSelectionSharePct: 30,
                selectionSourceCounts: {
                    explicit_request: 2,
                    strategy_trend: 6,
                    mode_fallback: 3,
                    unknown: 1,
                },
                strategyBreakdown: [
                    {
                        strategy: 'balanced',
                        executions: 4,
                        averageMasteryDeltaPct: 2.3,
                        positiveRatioPct: 75,
                        negativeRatioPct: 25,
                    },
                    {
                        strategy: 'mastery_recovery',
                        executions: 5,
                        averageMasteryDeltaPct: 6.8,
                        positiveRatioPct: 80,
                        negativeRatioPct: 20,
                    },
                    {
                        strategy: 'exploration_boost',
                        executions: 1,
                        averageMasteryDeltaPct: -1.2,
                        positiveRatioPct: 0,
                        negativeRatioPct: 100,
                    },
                ],
            },
        });

        const alignmentCheck = matrix.checks.find((check) => check.checkId === 'orchestration_path_strategy_alignment');
        expect(alignmentCheck?.status).toBe('pass');
        expect(String(alignmentCheck?.expected || '')).toContain('trendAutoAvgDelta>=0%');
        expect(Number(matrix.signals.sessionStrategyTrendAutoSelectionSharePct || 0)).toBeCloseTo(60, 4);
        expect(Number(matrix.signals.sessionStrategyTrendAutoAverageMasteryDeltaPct || 0)).toBeCloseTo(6.4, 4);
        expect(Number(matrix.signals.sessionStrategyTrendAutoNegativeRatioPct || 0)).toBeCloseTo(20, 4);
        expect(String(matrix.signals.sessionStrategyTopAverageStrategy || '')).toBe('mastery_recovery');
    });

    test('fails orchestration path-strategy alignment when trend-driven selections regress', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 16,
            learningQualityTrend: {
                status: 'stable',
                score: 0.16,
                confidence: 0.68,
            },
            sessionPlanQualityHistory: {
                summary: {
                    totalRecords: 5,
                    overallPassRatePct: 72,
                    consecutiveFailureCount: 0,
                    commonFailedGates: [],
                },
            },
            sessionPlanQualityTrend: {
                status: 'stable',
                score: 0.11,
                confidence: 0.61,
            },
            memoryPolicyDiagnostics: {
                summary: {
                    totalEntries: 22,
                    expiredEntries: 1,
                    staleEntries: 3,
                    lowConfidenceEntries: 2,
                    healthScore: 87,
                    status: 'healthy',
                },
            },
            memoryPolicyTrend: {
                status: 'stable',
                score: 0.09,
                confidence: 0.55,
            },
            sessionStrategyTelemetry: {
                totalRecords: 9,
                strategyRecords: 9,
                trendAutoSelectionSharePct: 66.6667,
                trendAutoAverageMasteryDeltaPct: -5.2,
                trendAutoNegativeRatioPct: 66.6667,
                modeFallbackSelectionSharePct: 22.2222,
                selectionSourceCounts: {
                    explicit_request: 1,
                    strategy_trend: 6,
                    mode_fallback: 2,
                    unknown: 0,
                },
                strategyBreakdown: [
                    {
                        strategy: 'balanced',
                        executions: 3,
                        averageMasteryDeltaPct: -3.1,
                        positiveRatioPct: 33.3333,
                        negativeRatioPct: 66.6667,
                    },
                    {
                        strategy: 'mastery_recovery',
                        executions: 4,
                        averageMasteryDeltaPct: -6.2,
                        positiveRatioPct: 25,
                        negativeRatioPct: 75,
                    },
                    {
                        strategy: 'exploration_boost',
                        executions: 2,
                        averageMasteryDeltaPct: -1.8,
                        positiveRatioPct: 0,
                        negativeRatioPct: 100,
                    },
                ],
            },
        });

        const alignmentCheck = matrix.checks.find((check) => check.checkId === 'orchestration_path_strategy_alignment');
        expect(alignmentCheck?.status).toBe('fail');
        expect(String(alignmentCheck?.observed || '')).toContain('trendAutoAvgDelta=-5.2%');
        expect(String(alignmentCheck?.observed || '')).toContain('trendAutoNegative=66.6667%');
        expect(alignmentCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('/api/knowledge/session/history'),
            ])
        );
    });

    test('returns fail when memory policy diagnostics report risk status', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 16,
            learningQualityTrend: {
                status: 'stable',
                score: 0.08,
                confidence: 0.64,
            },
            sessionPlanQualityHistory: {
                summary: {
                    totalRecords: 4,
                    overallPassRatePct: 75,
                    consecutiveFailureCount: 0,
                    commonFailedGates: [],
                },
            },
            sessionPlanQualityTrend: {
                status: 'stable',
                score: 0.22,
                confidence: 0.56,
            },
            memoryPolicyDiagnostics: {
                summary: {
                    totalEntries: 120,
                    expiredEntries: 34,
                    staleEntries: 70,
                    lowConfidenceEntries: 82,
                    healthScore: 28.7,
                    status: 'risk',
                    reason: 'Memory policy risk detected.',
                },
            },
            memoryPolicyTrend: {
                status: 'regressing',
                score: -5.2,
                confidence: 0.82,
                reason: 'Recent windows regressed with rising expired/stale ratios.',
            },
        });

        const memoryPolicyCheck = matrix.checks.find((check) => check.checkId === 'memory_policy_health');
        const memoryPolicyTrendCheck = matrix.checks.find((check) => check.checkId === 'memory_policy_trend');
        expect(memoryPolicyCheck?.status).toBe('fail');
        expect(memoryPolicyTrendCheck?.status).toBe('fail');
        expect(memoryPolicyCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('Memory status=risk'),
            ])
        );
        expect(matrix.signals.memoryPolicyStatus).toBe('risk');
        expect(matrix.signals.memoryPolicyExpiredEntries).toBe(34);
        expect(matrix.signals.memoryPolicyStaleEntries).toBe(70);
        expect(matrix.signals.memoryPolicyLowConfidenceEntries).toBe(82);
        expect(matrix.signals.memoryPolicyTrendStatus).toBe('regressing');
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns pass when knowledge staleness diagnostics are healthy', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 16,
            knowledgeStalenessDiagnostics: {
                summary: {
                    totalDocuments: 12,
                    evaluatedDocuments: 12,
                    returnedRecords: 6,
                    upToDateDocuments: 12,
                    hashMismatchDocuments: 0,
                    missingSourceDocuments: 0,
                    readErrorDocuments: 0,
                    staleDocuments: 0,
                    freshnessRatioPct: 100,
                    staleRatioPct: 0,
                    reason: 'All documents are up-to-date.',
                },
            },
        });

        const dataCheck = matrix.checks.find((check) => check.checkId === 'knowledge_staleness_data');
        const healthCheck = matrix.checks.find((check) => check.checkId === 'knowledge_staleness_health');
        expect(dataCheck?.status).toBe('pass');
        expect(healthCheck?.status).toBe('pass');
        expect(matrix.signals.knowledgeStalenessStaleDocuments).toBe(0);
        expect(matrix.signals.knowledgeStalenessFreshnessRatioPct).toBe(100);
        expect(matrix.signals.knowledgeStalenessHashMismatchDocuments).toBe(0);
        expect(matrix.signals.knowledgeStalenessMissingSourceDocuments).toBe(0);
        expect(matrix.signals.knowledgeStalenessReadErrorDocuments).toBe(0);
    });

    test('returns warn when knowledge staleness diagnostics include non-severe stale documents', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 16,
            knowledgeStalenessDiagnostics: {
                summary: {
                    totalDocuments: 10,
                    evaluatedDocuments: 10,
                    returnedRecords: 6,
                    upToDateDocuments: 8,
                    hashMismatchDocuments: 2,
                    missingSourceDocuments: 0,
                    readErrorDocuments: 0,
                    staleDocuments: 2,
                    freshnessRatioPct: 80,
                    staleRatioPct: 20,
                    reason: 'Two documents require refresh.',
                },
            },
        });

        const healthCheck = matrix.checks.find((check) => check.checkId === 'knowledge_staleness_health');
        expect(healthCheck?.status).toBe('warn');
        expect(matrix.signals.knowledgeStalenessStaleDocuments).toBe(2);
        expect(matrix.signals.knowledgeStalenessHashMismatchDocuments).toBe(2);
        expect(matrix.overallStatus).toBe('degraded');
    });

    test('returns fail when knowledge staleness diagnostics report read errors', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 16,
            knowledgeStalenessDiagnostics: {
                summary: {
                    totalDocuments: 10,
                    evaluatedDocuments: 10,
                    returnedRecords: 6,
                    upToDateDocuments: 5,
                    hashMismatchDocuments: 3,
                    missingSourceDocuments: 1,
                    readErrorDocuments: 1,
                    staleDocuments: 5,
                    freshnessRatioPct: 50,
                    staleRatioPct: 50,
                    reason: 'Read errors detected for source probes.',
                },
            },
        });

        const healthCheck = matrix.checks.find((check) => check.checkId === 'knowledge_staleness_health');
        expect(healthCheck?.status).toBe('fail');
        expect(healthCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('readError=1'),
            ])
        );
        expect(matrix.signals.knowledgeStalenessReadErrorDocuments).toBe(1);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns pass when tutor routing telemetry is within configured health budgets', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 16,
            learningQualityTrend: {
                status: 'stable',
                score: 0.41,
                confidence: 0.72,
            },
            sessionPlanQualityHistory: {
                summary: {
                    totalRecords: 6,
                    overallPassRatePct: 83.3,
                    consecutiveFailureCount: 0,
                    commonFailedGates: [],
                },
            },
            sessionPlanQualityTrend: {
                status: 'stable',
                score: 0.26,
                confidence: 0.68,
            },
            memoryPolicyDiagnostics: {
                summary: {
                    totalEntries: 28,
                    expiredEntries: 1,
                    staleEntries: 3,
                    lowConfidenceEntries: 2,
                    healthScore: 90.2,
                    status: 'healthy',
                },
            },
            memoryPolicyTrend: {
                status: 'stable',
                score: 0.19,
                confidence: 0.61,
            },
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 2,
                    totalRequests: 24,
                    successfulResponses: 23,
                    acceptedResponses: 19,
                    downgradedResponses: 4,
                    failedResponses: 1,
                    providerFallbackResponses: 5,
                    providerFallbackRatioPct: 20.8333,
                    averageProviderAttemptCount: 1.22,
                    averageConfidence: 0.84,
                    lastRoutingStrategy: 'adaptive_health_routing',
                    lastRoutingReason: 'Adaptive routing selected cloud-adapter based on healthier telemetry score.',
                    lastRoutingScore: 0.93,
                    lastRoutingDynamicPreferredMode: 'cloud',
                    lastRoutingDynamicModeReason: 'prefer cloud due to local trend penalty=0.140 and cloud penalty=0.000',
                },
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 6,
                maxFailedRatioPct: 20,
                maxDowngradedRatioPct: 35,
                minAverageConfidence: 0.7,
                preferredMode: 'cloud',
                adapterTimeoutMs: 18000,
            },
        });

        const inventoryCheck = matrix.checks.find((check) => check.checkId === 'tutor_adapter_inventory');
        const timeoutBudgetCheck = matrix.checks.find((check) => check.checkId === 'tutor_adapter_timeout_budget');
        const budgetCheck = matrix.checks.find((check) => check.checkId === 'tutor_routing_health_budget');
        const traceabilityCheck = matrix.checks.find((check) => check.checkId === 'tutor_routing_traceability');
        const dynamicAlignmentCheck = matrix.checks.find((check) => check.checkId === 'tutor_routing_dynamic_mode_alignment');
        expect(inventoryCheck?.status).toBe('pass');
        expect(timeoutBudgetCheck?.status).toBe('pass');
        expect(budgetCheck?.status).toBe('pass');
        expect(traceabilityCheck?.status).toBe('pass');
        expect(dynamicAlignmentCheck?.status).toBe('pass');
        expect(matrix.signals.tutorAdaptersTotal).toBe(2);
        expect(matrix.signals.tutorAdaptersActive).toBe(2);
        expect(matrix.signals.tutorRequests).toBe(24);
        expect(matrix.signals.tutorFailedRatioPct).toBeCloseTo(4.1667, 3);
        expect(matrix.signals.tutorDowngradedRatioPct).toBeCloseTo(16.6667, 3);
        expect(matrix.signals.tutorProviderFallbackResponses).toBe(5);
        expect(matrix.signals.tutorProviderFallbackRatioPct).toBeCloseTo(20.8333, 3);
        expect(matrix.signals.tutorAverageProviderAttemptCount).toBe(1.22);
        expect(matrix.signals.tutorAverageConfidence).toBe(0.84);
        expect(matrix.signals.tutorRoutingEnabled).toBe(true);
        expect(matrix.signals.tutorRoutingPreferredMode).toBe('cloud');
        expect(matrix.signals.tutorRoutingAdapterTimeoutMs).toBe(18000);
        expect(matrix.signals.tutorLastRoutingStrategy).toBe('adaptive_health_routing');
        expect(matrix.signals.tutorLastRoutingReason).toContain('cloud-adapter');
        expect(matrix.signals.tutorLastRoutingScore).toBe(0.93);
        expect(matrix.signals.tutorRoutingDynamicPreferredMode).toBe('cloud');
        expect(matrix.signals.tutorRoutingDynamicModeSuggestionActive).toBe(true);
        expect(matrix.signals.tutorRoutingDynamicModeReason).toContain(
            'prefer cloud due to local trend penalty=0.140'
        );
        expect(matrix.overallStatus).toBe('ready');
    });

    test('warns when dynamic mode suggestion conflicts with pinned preferred mode', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 18,
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 2,
                    totalRequests: 18,
                    successfulResponses: 17,
                    acceptedResponses: 14,
                    downgradedResponses: 3,
                    failedResponses: 1,
                    providerFallbackResponses: 2,
                    providerFallbackRatioPct: 11.11,
                    averageProviderAttemptCount: 1.2,
                    averageConfidence: 0.83,
                    lastRoutingStrategy: 'adaptive_health_routing',
                    lastRoutingReason: 'Adaptive routing selected cloud-adapter.',
                    lastRoutingScore: 0.87,
                    lastRoutingDynamicPreferredMode: 'cloud',
                    lastRoutingDynamicModeReason: 'prefer cloud due to local trend penalty=0.180 and cloud penalty=0.000',
                },
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 6,
                maxFailedRatioPct: 20,
                maxDowngradedRatioPct: 35,
                minAverageConfidence: 0.7,
                preferredMode: 'local',
                adapterTimeoutMs: 18000,
            },
        });

        const dynamicAlignmentCheck = matrix.checks.find((check) => check.checkId === 'tutor_routing_dynamic_mode_alignment');
        expect(dynamicAlignmentCheck?.status).toBe('warn');
        expect(String(dynamicAlignmentCheck?.observed || '')).toContain('preferredMode=local');
        expect(String(dynamicAlignmentCheck?.observed || '')).toContain('dynamicMode=cloud');
        expect(String(dynamicAlignmentCheck?.expected || '')).toContain('preferredMode=auto or preferredMode=cloud');
    });

    test('fails when dynamic mode suggestion conflicts with pinned preferred mode under severe degradation', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 18,
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 2,
                    totalRequests: 20,
                    successfulResponses: 8,
                    acceptedResponses: 5,
                    downgradedResponses: 3,
                    failedResponses: 12,
                    providerFallbackResponses: 17,
                    providerFallbackRatioPct: 85,
                    averageProviderAttemptCount: 3.7,
                    averageConfidence: 0.42,
                    lastRoutingStrategy: 'adaptive_health_routing',
                    lastRoutingReason: 'Adaptive routing remained pinned to local mode despite cloud suggestion.',
                    lastRoutingScore: 0.24,
                    lastRoutingDynamicPreferredMode: 'cloud',
                    lastRoutingDynamicModeReason: 'prefer cloud due to local trend penalty=0.250 and cloud penalty=0.000',
                },
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 6,
                maxFailedRatioPct: 25,
                maxDowngradedRatioPct: 35,
                minAverageConfidence: 0.7,
                preferredMode: 'local',
                adapterTimeoutMs: 18000,
            },
        });

        const dynamicAlignmentCheck = matrix.checks.find((check) => check.checkId === 'tutor_routing_dynamic_mode_alignment');
        expect(dynamicAlignmentCheck?.status).toBe('fail');
        expect(String(dynamicAlignmentCheck?.observed || '')).toContain('preferredMode=local');
        expect(String(dynamicAlignmentCheck?.observed || '')).toContain('dynamicMode=cloud');
        expect(String(dynamicAlignmentCheck?.expected || '')).toContain('preferredMode=auto or preferredMode=cloud');
        expect(dynamicAlignmentCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('dynamicMode=cloud'),
            ])
        );
    });

    test('returns fail when tutor routing telemetry exceeds hard budgets', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 16,
            learningQualityTrend: {
                status: 'stable',
                score: 0.21,
                confidence: 0.67,
            },
            sessionPlanQualityHistory: {
                summary: {
                    totalRecords: 4,
                    overallPassRatePct: 75,
                    consecutiveFailureCount: 0,
                    commonFailedGates: [],
                },
            },
            sessionPlanQualityTrend: {
                status: 'stable',
                score: 0.18,
                confidence: 0.62,
            },
            memoryPolicyDiagnostics: {
                summary: {
                    totalEntries: 12,
                    expiredEntries: 0,
                    staleEntries: 1,
                    lowConfidenceEntries: 1,
                    healthScore: 94,
                    status: 'healthy',
                },
            },
            memoryPolicyTrend: {
                status: 'stable',
                score: 0.11,
                confidence: 0.57,
            },
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 1,
                    totalRequests: 20,
                    successfulResponses: 12,
                    acceptedResponses: 4,
                    downgradedResponses: 8,
                    failedResponses: 8,
                    averageConfidence: 0.43,
                },
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 6,
                maxFailedRatioPct: 30,
                maxDowngradedRatioPct: 35,
                minAverageConfidence: 0.7,
                preferredMode: 'auto',
                adapterTimeoutMs: 18000,
            },
        });

        const budgetCheck = matrix.checks.find((check) => check.checkId === 'tutor_routing_health_budget');
        expect(budgetCheck?.status).toBe('fail');
        expect(String(budgetCheck?.expected || '')).toContain('failedRatio<=30%');
        expect(String(budgetCheck?.expected || '')).toContain('downgradedRatio<=35%');
        expect(String(budgetCheck?.expected || '')).toContain('avgConfidence>=0.5');
        expect(budgetCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('fail=40%'),
            ])
        );
        expect(matrix.signals.tutorFailedRatioPct).toBe(40);
        expect(matrix.signals.tutorDowngradedRatioPct).toBe(40);
        expect(matrix.signals.tutorAverageConfidence).toBe(0.43);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns warn when tutor fallback traffic is concentrated on a single provider', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 2,
                    totalRequests: 30,
                    successfulResponses: 28,
                    acceptedResponses: 22,
                    downgradedResponses: 6,
                    failedResponses: 2,
                    providerFallbackResponses: 12,
                    providerFallbackRatioPct: 40,
                    averageProviderAttemptCount: 1.7,
                    averageConfidence: 0.81,
                    lastRoutingStrategy: 'adaptive_health_routing',
                    lastRoutingScore: 0.79,
                },
            },
            tutorTraceDiagnostics: {
                summary: {
                    matchedTraces: 30,
                    llmAdapterTraces: 30,
                    fallbackTraces: 12,
                    fallbackRatioPct: 40,
                    averageProviderAttemptCount: 1.7,
                },
                providerBreakdown: [
                    {
                        providerName: 'LMStudio',
                        traces: 18,
                        fallbackTraces: 11,
                        failedTraces: 1,
                        averageConfidence: 0.84,
                        averageProviderAttemptCount: 1.8,
                    },
                    {
                        providerName: 'DeepSeek',
                        traces: 12,
                        fallbackTraces: 1,
                        failedTraces: 1,
                        averageConfidence: 0.76,
                        averageProviderAttemptCount: 1.5,
                    },
                ],
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 6,
                maxFailedRatioPct: 30,
                maxDowngradedRatioPct: 40,
                minAverageConfidence: 0.7,
                preferredMode: 'auto',
                adapterTimeoutMs: 18000,
            },
        });

        const concentrationCheck = matrix.checks.find((check) => check.checkId === 'tutor_provider_concentration');
        expect(concentrationCheck?.status).toBe('warn');
        expect(String(concentrationCheck?.expected || '')).toContain('dominantFallbackProviderShare<80%');
        expect(matrix.signals.tutorProviderCount).toBe(2);
        expect(matrix.signals.tutorDominantProviderName).toBe('LMStudio');
        expect(matrix.signals.tutorDominantProviderSharePct).toBe(60);
        expect(matrix.signals.tutorDominantFallbackProviderName).toBe('LMStudio');
        expect(matrix.signals.tutorDominantFallbackProviderSharePct).toBeCloseTo(91.6667, 3);
        expect(matrix.overallStatus).toBe('degraded');
    });

    test('returns fail when tutor provider trend diagnostics detect high-confidence regression', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 22,
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 2,
                    totalRequests: 24,
                    successfulResponses: 21,
                    acceptedResponses: 17,
                    downgradedResponses: 4,
                    failedResponses: 3,
                    providerFallbackResponses: 12,
                    providerFallbackRatioPct: 50,
                    averageProviderAttemptCount: 1.9,
                    averageConfidence: 0.71,
                    lastRoutingStrategy: 'adaptive_health_routing',
                    lastRoutingScore: 0.66,
                },
            },
            tutorTraceDiagnostics: {
                summary: {
                    matchedTraces: 24,
                    llmAdapterTraces: 24,
                    fallbackTraces: 12,
                    fallbackRatioPct: 50,
                    averageProviderAttemptCount: 1.9,
                },
                providerBreakdown: [
                    {
                        providerName: 'LMStudio',
                        traces: 14,
                        fallbackTraces: 9,
                        failedTraces: 2,
                    },
                    {
                        providerName: 'DeepSeek',
                        traces: 10,
                        fallbackTraces: 3,
                        failedTraces: 1,
                    },
                ],
            },
            tutorProviderTrendDiagnostics: {
                summary: {
                    totalProviders: 2,
                    evaluatedProviders: 2,
                    returnedProviders: 2,
                    regressingProviders: 1,
                    stableProviders: 1,
                    improvingProviders: 0,
                    insufficientDataProviders: 0,
                    recommendedFocusProviderName: 'LMStudio',
                    recommendedFocusReason: 'regressing_trend_score_36.50',
                },
                providers: [
                    {
                        providerName: 'LMStudio',
                        trendStatus: 'regressing',
                        trendScore: 36.5,
                        trendConfidence: 78,
                        fallbackRatioPct: 72,
                        failedRatioPct: 28,
                    },
                    {
                        providerName: 'DeepSeek',
                        trendStatus: 'stable',
                        trendScore: 6.2,
                        trendConfidence: 52,
                        fallbackRatioPct: 33,
                        failedRatioPct: 10,
                    },
                ],
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 6,
                maxFailedRatioPct: 30,
                maxDowngradedRatioPct: 40,
                minAverageConfidence: 0.7,
                preferredMode: 'auto',
                adapterTimeoutMs: 18000,
            },
        });

        const trendCheck = matrix.checks.find((check) => check.checkId === 'tutor_provider_trend_regression');
        expect(trendCheck?.status).toBe('fail');
        expect(String(trendCheck?.expected || '')).toContain('regressingProviders=0');
        expect(matrix.signals.tutorProviderTrendRegressingCount).toBe(1);
        expect(matrix.signals.tutorProviderTrendTopRegressingProvider).toBe('LMStudio');
        expect(matrix.signals.tutorProviderTrendTopRegressingScore).toBe(36.5);
        expect(matrix.signals.tutorProviderTrendTopRegressingConfidence).toBe(78);
        expect(matrix.signals.tutorProviderTrendRecommendedFocusProviderName).toBe('LMStudio');
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns fail when tutor provider trend history shows persistent regression windows', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 24,
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 2,
                    totalRequests: 24,
                    successfulResponses: 21,
                    acceptedResponses: 18,
                    downgradedResponses: 3,
                    failedResponses: 3,
                    providerFallbackResponses: 10,
                    providerFallbackRatioPct: 41.67,
                    averageProviderAttemptCount: 1.8,
                    averageConfidence: 0.78,
                    lastRoutingStrategy: 'adaptive_health_routing',
                    lastRoutingScore: 0.7,
                },
            },
            tutorProviderTrendDiagnostics: {
                summary: {
                    totalProviders: 2,
                    evaluatedProviders: 2,
                    returnedProviders: 2,
                    regressingProviders: 0,
                    stableProviders: 2,
                    improvingProviders: 0,
                    insufficientDataProviders: 0,
                    recommendedFocusProviderName: 'LMStudio',
                },
                providers: [
                    { providerName: 'LMStudio', trendStatus: 'stable', trendScore: 8, trendConfidence: 55 },
                    { providerName: 'DeepSeek', trendStatus: 'stable', trendScore: 4, trendConfidence: 50 },
                ],
            },
            tutorProviderTrendHistory: {
                summary: {
                    totalProviders: 2,
                    evaluatedProviders: 2,
                    totalRecords: 6,
                    returnedRecords: 6,
                    regressingRecords: 3,
                    stableRecords: 2,
                    improvingRecords: 1,
                    insufficientDataRecords: 0,
                    recommendedFocusProviderName: 'LMStudio',
                },
                records: [
                    { providerName: 'LMStudio', windowIndex: 0, trendStatus: 'regressing', trendScore: 28, trendConfidence: 72 },
                    { providerName: 'LMStudio', windowIndex: 1, trendStatus: 'regressing', trendScore: 22, trendConfidence: 68 },
                    { providerName: 'LMStudio', windowIndex: 2, trendStatus: 'regressing', trendScore: 19, trendConfidence: 60 },
                    { providerName: 'DeepSeek', windowIndex: 0, trendStatus: 'stable', trendScore: 7, trendConfidence: 49 },
                    { providerName: 'DeepSeek', windowIndex: 1, trendStatus: 'stable', trendScore: 4, trendConfidence: 43 },
                    { providerName: 'DeepSeek', windowIndex: 2, trendStatus: 'improving', trendScore: -15, trendConfidence: 61 },
                ],
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 6,
                maxFailedRatioPct: 30,
                maxDowngradedRatioPct: 40,
                minAverageConfidence: 0.7,
                preferredMode: 'auto',
                adapterTimeoutMs: 18000,
            },
        });

        const trendCheck = matrix.checks.find((check) => check.checkId === 'tutor_provider_trend_regression');
        expect(trendCheck?.status).toBe('fail');
        expect(String(trendCheck?.observed || '')).toContain('historyRegressing=3');
        expect(matrix.signals.tutorProviderTrendHistoryRecords).toBe(6);
        expect(matrix.signals.tutorProviderTrendHistoryRegressingRecords).toBe(3);
        expect(matrix.signals.tutorProviderTrendHistoryStableRecords).toBe(2);
        expect(matrix.signals.tutorProviderTrendHistoryImprovingRecords).toBe(1);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('returns warn when tutor provider fallback ratio stays high despite low hard-failure ratios', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 16,
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 2,
                    totalRequests: 20,
                    successfulResponses: 19,
                    acceptedResponses: 17,
                    downgradedResponses: 2,
                    failedResponses: 1,
                    providerFallbackResponses: 15,
                    providerFallbackRatioPct: 75,
                    averageProviderAttemptCount: 2.3,
                    averageConfidence: 0.85,
                    lastRoutingStrategy: 'adaptive_health_routing',
                    lastRoutingReason: 'Adaptive routing kept cloud-adapter primary; frequent provider fallback still observed.',
                    lastRoutingScore: 0.82,
                },
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 6,
                maxFailedRatioPct: 30,
                maxDowngradedRatioPct: 40,
                minAverageConfidence: 0.7,
                preferredMode: 'auto',
                adapterTimeoutMs: 18000,
            },
        });

        const budgetCheck = matrix.checks.find((check) => check.checkId === 'tutor_routing_health_budget');
        expect(budgetCheck?.status).toBe('warn');
        expect(String(budgetCheck?.expected || '')).toContain('fallbackRatio<=60%');
        expect(String(budgetCheck?.expected || '')).toContain('avgProviderAttempts<2');
        expect(matrix.signals.tutorProviderFallbackResponses).toBe(15);
        expect(matrix.signals.tutorProviderFallbackRatioPct).toBe(75);
        expect(matrix.signals.tutorAverageProviderAttemptCount).toBe(2.3);
        expect(matrix.overallStatus).toBe('degraded');
    });

    test('normalizes tutor routing decision signals from telemetry summary', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 16,
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 1,
                    activeAdapters: 1,
                    totalRequests: 1,
                    successfulResponses: 1,
                    acceptedResponses: 1,
                    downgradedResponses: 0,
                    failedResponses: 0,
                    averageConfidence: 0.9,
                    lastRoutingStrategy: 'unknown_strategy',
                    lastRoutingReason: 'x'.repeat(320),
                    lastRoutingScore: 2.4,
                },
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 1,
                maxFailedRatioPct: 30,
                maxDowngradedRatioPct: 40,
                minAverageConfidence: 0.6,
                preferredMode: 'auto',
                adapterTimeoutMs: 18000,
            },
        });

        expect(matrix.signals.tutorLastRoutingStrategy).toBe('unknown');
        expect(matrix.signals.tutorLastRoutingReason.length).toBeLessThanOrEqual(160);
        expect(matrix.signals.tutorLastRoutingScore).toBe(1);
        expect(matrix.signals.tutorRoutingDynamicPreferredMode).toBe('auto');
        expect(matrix.signals.tutorRoutingDynamicModeSuggestionActive).toBe(false);
        expect(matrix.signals.tutorRoutingDynamicModeReason).toBe('');
        const traceabilityCheck = matrix.checks.find((check) => check.checkId === 'tutor_routing_traceability');
        expect(traceabilityCheck?.status).toBe('warn');
        expect(String(traceabilityCheck?.expected || '')).toContain('strategy in');
        expect(traceabilityCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('Last routing strategy=unknown'),
            ])
        );
    });

    test('extracts dynamic preferred mode from legacy routing reason payload when structured fields are missing', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 16,
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 2,
                    totalRequests: 10,
                    successfulResponses: 9,
                    acceptedResponses: 8,
                    downgradedResponses: 1,
                    failedResponses: 1,
                    averageConfidence: 0.83,
                    lastRoutingStrategy: 'adaptive_health_routing',
                    lastRoutingReason:
                        'Adaptive routing selected cloud-adapter, score=0.8100, dynamicPreferredMode=cloud, dynamicModeReason=prefer cloud due to local trend penalty=0.200 and cloud penalty=0.000, modeTrend(local:regressing=2/2,penalty=0.200,top=LMStudio@25.00/55.00)',
                    lastRoutingScore: 0.81,
                },
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 4,
                maxFailedRatioPct: 30,
                maxDowngradedRatioPct: 40,
                minAverageConfidence: 0.7,
                preferredMode: 'auto',
                adapterTimeoutMs: 18000,
            },
        });

        expect(matrix.signals.tutorRoutingDynamicPreferredMode).toBe('cloud');
        expect(matrix.signals.tutorRoutingDynamicModeSuggestionActive).toBe(true);
        expect(matrix.signals.tutorRoutingDynamicModeReason).toBe(
            'prefer cloud due to local trend penalty=0.200 and cloud penalty=0.000'
        );
    });

    test('warns when routing remains on fallback strategy under active adaptive routing', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 2,
                    totalRequests: 18,
                    successfulResponses: 17,
                    acceptedResponses: 14,
                    downgradedResponses: 3,
                    failedResponses: 1,
                    averageConfidence: 0.82,
                    lastRoutingStrategy: 'fallback_default',
                    lastRoutingReason: 'requested adapterId=missing-adapter was not found. Selected local-adapter as default fallback adapter.',
                    lastRoutingScore: 0,
                },
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 6,
                maxFailedRatioPct: 30,
                maxDowngradedRatioPct: 40,
                minAverageConfidence: 0.7,
                preferredMode: 'auto',
                adapterTimeoutMs: 18000,
            },
        });

        const budgetCheck = matrix.checks.find((check) => check.checkId === 'tutor_routing_health_budget');
        const traceabilityCheck = matrix.checks.find((check) => check.checkId === 'tutor_routing_traceability');
        expect(budgetCheck?.status).toBe('pass');
        expect(traceabilityCheck?.status).toBe('warn');
        expect(String(traceabilityCheck?.expected || '')).toContain('strategy!=fallback_default');
        expect(matrix.overallStatus).toBe('degraded');
    });

    test('warns when tutor adapter timeout leaves recommended governance window', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 2,
                    totalRequests: 16,
                    successfulResponses: 15,
                    acceptedResponses: 13,
                    downgradedResponses: 2,
                    failedResponses: 1,
                    averageConfidence: 0.83,
                    lastRoutingStrategy: 'adaptive_health_routing',
                    lastRoutingScore: 0.88,
                },
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 6,
                maxFailedRatioPct: 30,
                maxDowngradedRatioPct: 40,
                minAverageConfidence: 0.7,
                preferredMode: 'auto',
                adapterTimeoutMs: 700,
            },
        });

        const timeoutBudgetCheck = matrix.checks.find((check) => check.checkId === 'tutor_adapter_timeout_budget');
        expect(timeoutBudgetCheck?.status).toBe('warn');
        expect(String(timeoutBudgetCheck?.expected || '')).toBe('1000<=adapterTimeoutMs<=30000');
        expect(matrix.signals.tutorRoutingAdapterTimeoutMs).toBe(700);
        expect(matrix.overallStatus).toBe('degraded');
    });

    test('fails when tutor adapter timeout breaches hard governance budget', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 2,
                    totalRequests: 16,
                    successfulResponses: 15,
                    acceptedResponses: 13,
                    downgradedResponses: 2,
                    failedResponses: 1,
                    averageConfidence: 0.83,
                    lastRoutingStrategy: 'adaptive_health_routing',
                    lastRoutingScore: 0.88,
                },
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 6,
                maxFailedRatioPct: 30,
                maxDowngradedRatioPct: 40,
                minAverageConfidence: 0.7,
                preferredMode: 'auto',
                adapterTimeoutMs: 70000,
            },
        });

        const timeoutBudgetCheck = matrix.checks.find((check) => check.checkId === 'tutor_adapter_timeout_budget');
        expect(timeoutBudgetCheck?.status).toBe('fail');
        expect(String(timeoutBudgetCheck?.expected || '')).toBe('300<=adapterTimeoutMs<=60000');
        expect(matrix.signals.tutorRoutingAdapterTimeoutMs).toBe(70000);
        expect(matrix.overallStatus).toBe('blocked');
    });

    test('passes when session memory promotion coverage is healthy', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            learningQualityTrend: {
                status: 'stable',
                score: 0.3,
                confidence: 0.7,
            },
            sessionPlanQualityHistory: {
                summary: {
                    totalRecords: 5,
                    overallPassRatePct: 80,
                    consecutiveFailureCount: 0,
                    commonFailedGates: [],
                },
            },
            sessionPlanQualityTrend: {
                status: 'stable',
                score: 0.2,
                confidence: 0.6,
            },
            memoryPolicyDiagnostics: {
                summary: {
                    totalEntries: 20,
                    expiredEntries: 1,
                    staleEntries: 2,
                    lowConfidenceEntries: 1,
                    healthScore: 90,
                    status: 'healthy',
                },
            },
            memoryPolicyTrend: {
                status: 'stable',
                score: 0.1,
                confidence: 0.55,
            },
            sessionActionTelemetry: {
                executionCount: 10,
                memoryPersistedCount: 8,
                memoryPromotionAppliedCount: 3,
                memoryPromotionCount: 11,
            },
        });

        const sessionPromotionCheck = matrix.checks.find(
            (check) => check.checkId === 'session_memory_promotion_coverage'
        );
        expect(sessionPromotionCheck?.status).toBe('pass');
        expect(matrix.signals.sessionActionExecutionCount).toBe(10);
        expect(matrix.signals.sessionMemoryPersistedCount).toBe(8);
        expect(matrix.signals.sessionMemoryPromotionAppliedCount).toBe(3);
        expect(matrix.signals.sessionMemoryPromotionCount).toBe(11);
        expect(matrix.signals.sessionMemoryPromotionCoveragePct).toBe(37.5);
    });

    test('warns when session memory promotion coverage has no promoted actions', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            learningQualityTrend: {
                status: 'stable',
                score: 0.25,
                confidence: 0.66,
            },
            sessionPlanQualityHistory: {
                summary: {
                    totalRecords: 5,
                    overallPassRatePct: 80,
                    consecutiveFailureCount: 0,
                    commonFailedGates: [],
                },
            },
            sessionPlanQualityTrend: {
                status: 'stable',
                score: 0.2,
                confidence: 0.61,
            },
            memoryPolicyDiagnostics: {
                summary: {
                    totalEntries: 20,
                    expiredEntries: 1,
                    staleEntries: 2,
                    lowConfidenceEntries: 1,
                    healthScore: 90,
                    status: 'healthy',
                },
            },
            memoryPolicyTrend: {
                status: 'stable',
                score: 0.1,
                confidence: 0.55,
            },
            sessionActionTelemetry: {
                executionCount: 8,
                memoryPersistedCount: 6,
                memoryPromotionAppliedCount: 0,
                memoryPromotionCount: 0,
            },
        });

        const sessionPromotionCheck = matrix.checks.find(
            (check) => check.checkId === 'session_memory_promotion_coverage'
        );
        expect(sessionPromotionCheck?.status).toBe('warn');
        expect(String(sessionPromotionCheck?.expected || '')).toContain('promotedActions>=1');
        expect(sessionPromotionCheck?.recommendedActions).toEqual(
            expect.arrayContaining([
                expect.stringContaining('coverage is 0%'),
            ])
        );
        expect(matrix.signals.sessionMemoryPromotionCoveragePct).toBe(0);
    });

    test('builds runtime runbook for explicit check with trace filter and verification targets', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 30,
            apiRequestErrorTelemetry: {
                totalRequests: 30,
                errorRequests: 5,
                invalidRequestErrors: 1,
                serverErrorRequests: 2,
                transientErrorRequests: 1,
                averageDurationMs: 780,
                p95DurationMs: 2900,
                scopePathPrefix: '/api/knowledge',
                scopeMethod: 'post',
                slowTopPaths: [
                    { path: 'POST /api/knowledge/session/execute', count: 4, p95DurationMs: 3600 },
                ],
            },
            thresholds: {
                apiLatencyMinRequestSample: 10,
                apiLatencyP95WarnMs: 1000,
                apiLatencyP95FailMs: 2400,
                apiLatencyHotspotWarnMs: 1500,
                apiLatencyHotspotFailMs: 3200,
            },
        });

        const runbook = buildRuntimeCapabilityRunbook(matrix, 'api_latency_p95');
        expect(runbook.requestedCheckId).toBe('api_latency_p95');
        expect(runbook.selectionSource).toBe('requested');
        expect(runbook.selectedCheck?.checkId).toBe('api_latency_p95');
        expect(runbook.selectedCheck?.status).toBe('fail');
        expect(runbook.traceFilter.pathPrefix).toBe('/api/knowledge/session/execute');
        expect(runbook.traceFilter.statusAtLeast).toBe(0);
        expect(runbook.traceFilter.method).toBe('POST');
        expect(runbook.verificationTargets.length).toBeGreaterThan(0);
        expect(String(runbook.verificationTargets[0] || '')).toContain('Satisfy check expectation');
    });

    test('runtime runbook for vector index status includes diagnostics verification targets', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'stale',
                        persisted: false,
                        loadedFromDisk: false,
                    },
                },
            }),
            queryCount: 12,
        });

        const runbook = buildRuntimeCapabilityRunbook(matrix, 'query_vector_index_status');
        expect(runbook.selectedCheck?.checkId).toBe('query_vector_index_status');
        expect(runbook.traceFilter.pathPrefix).toBe('/api/knowledge/query-backend-diagnostics');
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('/api/knowledge/query-backend-diagnostics')
            )
        ).toBe(true);
    });

    test('runtime runbook for vector acceleration mode includes acceleration verification target', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        acceleration: {
                            enabled: false,
                            mode: 'full_scan',
                            adapterId: 'local-vector-acceleration-ann-v1',
                        },
                    },
                },
            }),
            queryCount: 20,
        });

        const runbook = buildRuntimeCapabilityRunbook(matrix, 'query_vector_acceleration_mode');
        expect(runbook.selectedCheck?.checkId).toBe('query_vector_acceleration_mode');
        expect(runbook.traceFilter.pathPrefix).toBe('/api/knowledge/query-backend-diagnostics');
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('vectorIndex.acceleration')
            )
        ).toBe(true);
    });

    test('runtime runbook for vector acceleration representation consistency includes metadata verification targets', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        atomCount: 128,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            lastSelectionMode: 'token_prefilter',
                            lastCandidateCount: 48,
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'ready',
                            representationVersion: 'remote-representation-v2',
                            embeddingModelId: 'remote-embedding-v2',
                            embeddingDimension: 64,
                            indexSignature: 'remote_sig_v2',
                            representationStatus: 'mismatch',
                            representationStatusReason: 'embedding_model_id_mismatch',
                            representationStrictMode: true,
                            requestCount: 28,
                            circuitState: 'closed',
                        },
                    },
                },
            }),
            queryCount: 28,
        });

        const runbook = buildRuntimeCapabilityRunbook(
            matrix,
            'query_vector_acceleration_representation_consistency'
        );
        expect(runbook.selectedCheck?.checkId).toBe('query_vector_acceleration_representation_consistency');
        expect(runbook.traceFilter.pathPrefix).toBe('/api/knowledge/query-backend-diagnostics');
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('representationStatus is aligned')
            )
        ).toBe(true);
    });

    test('runtime runbook for vector acceleration health includes health verification target', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'degraded',
                            healthMessage: 'external_http_status_503',
                        },
                    },
                },
            }),
            queryCount: 20,
        });

        const runbook = buildRuntimeCapabilityRunbook(matrix, 'query_vector_acceleration_health');
        expect(runbook.selectedCheck?.checkId).toBe('query_vector_acceleration_health');
        expect(runbook.traceFilter.pathPrefix).toBe('/api/knowledge/query-backend-diagnostics');
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('acceleration.healthStatus')
            )
        ).toBe(true);
    });

    test('runtime runbook for vector acceleration prefilter effectiveness includes selection telemetry target', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        atomCount: 256,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            lastSelectionMode: 'full_scan',
                            lastCandidateCount: 256,
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'ready',
                            circuitState: 'closed',
                            requestCount: 20,
                        },
                    },
                },
            }),
            queryCount: 20,
        });

        const runbook = buildRuntimeCapabilityRunbook(matrix, 'query_vector_acceleration_prefilter_effectiveness');
        expect(runbook.selectedCheck?.checkId).toBe('query_vector_acceleration_prefilter_effectiveness');
        expect(runbook.traceFilter.pathPrefix).toBe('/api/knowledge/query-backend-diagnostics');
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('lastSelectionMode')
            )
        ).toBe(true);
    });

    test('runtime runbook for vector acceleration calibration readiness includes calibration verification targets', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        atomCount: 256,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            lastSelectionMode: 'token_signature_prefilter',
                            lastCandidateCount: 64,
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'ready',
                            circuitState: 'closed',
                            requestCount: 20,
                            syncRequestCount: 3,
                            syncSuccessCount: 3,
                            syncedIndexSignature: 'idx_sync_ok',
                            syncedAtomCount: 128,
                            lastRequestId: 'connector-req-42',
                        },
                    },
                },
            }),
            queryCount: 20,
        });

        const runbook = buildRuntimeCapabilityRunbook(matrix, 'query_vector_acceleration_calibration_readiness');
        expect(runbook.selectedCheck?.checkId).toBe('query_vector_acceleration_calibration_readiness');
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('sync telemetry ready')
            )
        ).toBe(true);
    });

    test('runtime runbook for vector acceleration circuit state includes circuit verification target', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'degraded',
                            healthMessage: 'external_http_circuit_open',
                            circuitState: 'open',
                            shortCircuitCount: 6,
                            consecutiveFailures: 3,
                        },
                    },
                },
            }),
            queryCount: 20,
        });

        const runbook = buildRuntimeCapabilityRunbook(matrix, 'query_vector_acceleration_circuit_state');
        expect(runbook.selectedCheck?.checkId).toBe('query_vector_acceleration_circuit_state');
        expect(runbook.traceFilter.pathPrefix).toBe('/api/knowledge/query-backend-diagnostics');
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('query-backend-diagnostics')
                && String(item || '').includes('vectorIndex')
            )
        ).toBe(true);
    });

    test('runtime runbook for vector acceleration index sync health includes sync telemetry verification target', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'ready',
                            indexSyncStatus: 'ready',
                            syncRequestCount: 3,
                            syncSuccessCount: 3,
                            syncFailureCount: 0,
                            syncedIndexSignature: 'idx_sync_ok',
                            syncedAtomCount: 128,
                            lastSyncAt: '2026-04-01T12:00:00.000Z',
                            circuitState: 'closed',
                            requestCount: 12,
                            successCount: 12,
                            failureCount: 0,
                        },
                    },
                },
            }),
            queryCount: 20,
        });

        const runbook = buildRuntimeCapabilityRunbook(matrix, 'query_vector_acceleration_index_sync_health');
        expect(runbook.selectedCheck?.checkId).toBe('query_vector_acceleration_index_sync_health');
        expect(runbook.traceFilter.pathPrefix).toBe('/api/knowledge/query-backend-diagnostics');
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('indexSyncStatus/indexSyncMessage/lastSyncAt')
            )
        ).toBe(true);
    });

    test('runtime runbook for vector acceleration traceability includes connector correlation verification target', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_vector',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({
                backendId: 'local-vector-v1',
                runtime: {
                    backendId: 'local-vector-v1',
                    ready: true,
                    vectorIndex: {
                        enabled: true,
                        status: 'ready',
                        persisted: true,
                        loadedFromDisk: true,
                        acceleration: {
                            enabled: true,
                            mode: 'ann_prefilter',
                            adapterId: 'external-http-vector-acceleration-v1',
                            healthStatus: 'degraded',
                            healthMessage: 'external_http_status_503',
                        },
                    },
                },
            }),
            queryCount: 20,
        });

        const runbook = buildRuntimeCapabilityRunbook(matrix, 'query_vector_acceleration_traceability');
        expect(runbook.selectedCheck?.checkId).toBe('query_vector_acceleration_traceability');
        expect(runbook.traceFilter.pathPrefix).toBe('/api/knowledge/query-backend-diagnostics');
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('diagnostics.runtime.vectorIndex.acceleration.healthStatus is ready|unknown')
            )
        ).toBe(true);
    });

    test('runtime runbook for tutor provider trend regression includes provider diagnostics targets', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 2,
                    totalRequests: 20,
                    successfulResponses: 18,
                    acceptedResponses: 14,
                    downgradedResponses: 4,
                    failedResponses: 2,
                    providerFallbackResponses: 8,
                    providerFallbackRatioPct: 40,
                    averageProviderAttemptCount: 1.8,
                    averageConfidence: 0.76,
                    lastRoutingStrategy: 'adaptive_health_routing',
                    lastRoutingScore: 0.72,
                },
            },
            tutorProviderTrendDiagnostics: {
                summary: {
                    totalProviders: 2,
                    evaluatedProviders: 2,
                    returnedProviders: 2,
                    regressingProviders: 1,
                    stableProviders: 1,
                    improvingProviders: 0,
                    insufficientDataProviders: 0,
                    recommendedFocusProviderName: 'LMStudio',
                },
                providers: [
                    {
                        providerName: 'LMStudio',
                        trendStatus: 'regressing',
                        trendScore: 31,
                        trendConfidence: 74,
                    },
                    {
                        providerName: 'DeepSeek',
                        trendStatus: 'stable',
                        trendScore: 4,
                        trendConfidence: 46,
                    },
                ],
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 6,
                maxFailedRatioPct: 30,
                maxDowngradedRatioPct: 40,
                minAverageConfidence: 0.7,
                preferredMode: 'auto',
                adapterTimeoutMs: 18000,
            },
        });

        const runbook = buildRuntimeCapabilityRunbook(matrix, 'tutor_provider_trend_regression');
        expect(runbook.selectedCheck?.checkId).toBe('tutor_provider_trend_regression');
        expect(runbook.selectedCheck?.status).toBe('fail');
        expect(runbook.traceFilter.pathPrefix).toBe('/api/knowledge/tutor/trace-diagnostics/providers');
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('/api/knowledge/tutor/trace-diagnostics/providers/history')
            )
        ).toBe(true);
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('/api/knowledge/tutor/trace-diagnostics/providers?source=llm-adapter')
            )
        ).toBe(true);
    });

    test('runtime runbook for tutor routing dynamic mode alignment includes mode reconciliation targets', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            tutorAdapterTelemetry: {
                summary: {
                    totalAdapters: 2,
                    activeAdapters: 2,
                    totalRequests: 20,
                    successfulResponses: 16,
                    acceptedResponses: 12,
                    downgradedResponses: 4,
                    failedResponses: 4,
                    providerFallbackResponses: 12,
                    providerFallbackRatioPct: 60,
                    averageProviderAttemptCount: 2.4,
                    averageConfidence: 0.63,
                    lastRoutingStrategy: 'adaptive_health_routing',
                    lastRoutingScore: 0.55,
                    lastRoutingDynamicPreferredMode: 'cloud',
                    lastRoutingDynamicModeReason: 'prefer cloud due to local trend penalty=0.250 and cloud penalty=0.000',
                },
            },
            tutorRoutingConfig: {
                enabled: true,
                minSamples: 6,
                maxFailedRatioPct: 25,
                maxDowngradedRatioPct: 35,
                minAverageConfidence: 0.7,
                preferredMode: 'local',
                adapterTimeoutMs: 18000,
            },
        });

        const runbook = buildRuntimeCapabilityRunbook(matrix, 'tutor_routing_dynamic_mode_alignment');
        expect(runbook.selectedCheck?.checkId).toBe('tutor_routing_dynamic_mode_alignment');
        expect(['warn', 'fail']).toContain(String(runbook.selectedCheck?.status || ''));
        expect(runbook.traceFilter.pathPrefix).toBe('/api/knowledge/tutor/trace-diagnostics/providers/history');
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('/api/knowledge/session/orchestration/config')
            )
        ).toBe(true);
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('/api/knowledge/tutor/trace-diagnostics/providers/history')
            )
        ).toBe(true);
    });

    test('runtime runbook for orchestration path strategy alignment includes outcome verification targets', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 0 }),
            queryCount: 20,
            sessionStrategyTelemetry: {
                totalRecords: 9,
                strategyRecords: 9,
                trendAutoSelectionSharePct: 66.6667,
                trendAutoAverageMasteryDeltaPct: -4.2,
                trendAutoNegativeRatioPct: 66.6667,
                modeFallbackSelectionSharePct: 22.2222,
                selectionSourceCounts: {
                    explicit_request: 1,
                    strategy_trend: 6,
                    mode_fallback: 2,
                    unknown: 0,
                },
                strategyBreakdown: [
                    {
                        strategy: 'balanced',
                        executions: 3,
                        averageMasteryDeltaPct: -2.5,
                        positiveRatioPct: 33.3333,
                        negativeRatioPct: 66.6667,
                    },
                    {
                        strategy: 'mastery_recovery',
                        executions: 4,
                        averageMasteryDeltaPct: -4.8,
                        positiveRatioPct: 25,
                        negativeRatioPct: 75,
                    },
                    {
                        strategy: 'exploration_boost',
                        executions: 2,
                        averageMasteryDeltaPct: -1.4,
                        positiveRatioPct: 0,
                        negativeRatioPct: 100,
                    },
                ],
            },
        });

        const runbook = buildRuntimeCapabilityRunbook(matrix, 'orchestration_path_strategy_alignment');
        expect(runbook.selectedCheck?.checkId).toBe('orchestration_path_strategy_alignment');
        expect(['warn', 'fail']).toContain(String(runbook.selectedCheck?.status || ''));
        expect(runbook.traceFilter.pathPrefix).toBe('/api/knowledge/session/history');
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('/api/knowledge/session/history')
            )
        ).toBe(true);
        expect(
            runbook.verificationTargets.some((item) =>
                String(item || '').includes('/api/knowledge/quality/trend')
            )
        ).toBe(true);
    });

    test('builds runtime runbook using top-risk fallback when requested check is unavailable', () => {
        const matrix = buildRuntimeCapabilityMatrix({
            generatedAt: '2026-04-01T12:00:00.000Z',
            configuredStoreBackend: 'file',
            configuredQueryBackend: 'local_hybrid',
            store: createStoreDiagnostics(),
            queryDiagnostics: createQueryDiagnostics({ fallbackCount: 9 }),
            queryCount: 20,
            thresholds: {
                minQuerySampleSize: 5,
                queryFallbackWarnRatioPct: 10,
                queryFallbackFailRatioPct: 30,
            },
        });

        const runbook = buildRuntimeCapabilityRunbook(matrix, 'missing_check_id');
        expect(runbook.requestedCheckId).toBe('missing_check_id');
        expect(runbook.selectionSource).toBe('top_risk_fallback');
        expect(runbook.selectedCheck).toBeDefined();
        expect(runbook.selectedCheck?.checkId).toBe('query_fallback_ratio');
        expect(['warn', 'fail']).toContain(String(runbook.selectedCheck?.status || ''));
        expect(runbook.topRiskCheck?.checkId).toBe('query_fallback_ratio');
    });
});
