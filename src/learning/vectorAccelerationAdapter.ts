import type {
    LocalVectorAccelerationAdapter,
    LocalVectorAccelerationAdapterHealth,
    LocalVectorAccelerationSelectionInput,
    LocalVectorAccelerationSelectionOutput,
} from './queryBackend';

export type VectorAccelerationAdapterProvider = 'local' | 'external_stub' | 'external_http';

export type VectorAccelerationExternalHttpConfig = {
    endpoint?: string;
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    circuitFailureThreshold?: number;
    circuitCooldownMs?: number;
};

export type VectorAccelerationAdapterFactoryOptions = {
    externalHttp?: VectorAccelerationExternalHttpConfig;
};

const EXTERNAL_STUB_ADAPTER_ID = 'external-stub-vector-acceleration-v1';
const EXTERNAL_HTTP_ADAPTER_ID = 'external-http-vector-acceleration-v1';
const EXTERNAL_STUB_TOP_TOKENS = 6;
const EXTERNAL_STUB_MIN_ATOMS = 48;
const EXTERNAL_STUB_CANDIDATE_MULTIPLIER = 20;
const EXTERNAL_STUB_CANDIDATE_MIN_FLOOR = 32;
const EXTERNAL_HTTP_TIMEOUT_MS_DEFAULT = 1200;
const EXTERNAL_HTTP_TIMEOUT_MS_MIN = 100;
const EXTERNAL_HTTP_TIMEOUT_MS_MAX = 10000;
const EXTERNAL_HTTP_MAX_RETRIES_DEFAULT = 1;
const EXTERNAL_HTTP_MAX_RETRIES_MIN = 0;
const EXTERNAL_HTTP_MAX_RETRIES_MAX = 5;
const EXTERNAL_HTTP_RETRY_DELAY_MS_DEFAULT = 120;
const EXTERNAL_HTTP_RETRY_DELAY_MS_MIN = 0;
const EXTERNAL_HTTP_RETRY_DELAY_MS_MAX = 2000;
const EXTERNAL_HTTP_RETRY_AFTER_MS_MAX = 60000;
const EXTERNAL_HTTP_RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const EXTERNAL_HTTP_CIRCUIT_FAILURE_THRESHOLD_DEFAULT = 3;
const EXTERNAL_HTTP_CIRCUIT_FAILURE_THRESHOLD_MIN = 1;
const EXTERNAL_HTTP_CIRCUIT_FAILURE_THRESHOLD_MAX = 20;
const EXTERNAL_HTTP_CIRCUIT_COOLDOWN_MS_DEFAULT = 8000;
const EXTERNAL_HTTP_CIRCUIT_COOLDOWN_MS_MIN = 100;
const EXTERNAL_HTTP_CIRCUIT_COOLDOWN_MS_MAX = 600000;
const EXTERNAL_HTTP_CANDIDATE_MULTIPLIER = 32;
const EXTERNAL_HTTP_CANDIDATE_MIN_FLOOR = 64;
const EXTERNAL_HTTP_CANDIDATE_MAX_CAP = 4096;
const EXTERNAL_STUB_REPRESENTATION_VERSION = 'external-stub-vector-acceleration-v1';
const EXTERNAL_STUB_EMBEDDING_MODEL_ID = 'external-stub-token-prefilter-v1';
const EXTERNAL_HTTP_REQUEST_ID_PREFIX = 'nc-vector-accel';
let EXTERNAL_HTTP_REQUEST_ID_SEQUENCE = 0;

function uniqueTokens(tokens: string[]): string[] {
    const seen = new Set<string>();
    const unique: string[] = [];
    tokens.forEach((token) => {
        const normalized = String(token || '').trim().toLowerCase();
        if (!normalized || seen.has(normalized)) {
            return;
        }
        seen.add(normalized);
        unique.push(normalized);
    });
    return unique;
}

function buildKnownAtomIdSet(input: LocalVectorAccelerationSelectionInput): Set<string> {
    const knownAtomIds = new Set<string>();
    for (const atomIds of input.tokenToAtomIds.values()) {
        for (const atomId of atomIds) {
            const normalized = String(atomId || '').trim();
            if (normalized) knownAtomIds.add(normalized);
        }
    }
    for (const atomIds of input.signatureBuckets.values()) {
        for (const atomId of atomIds) {
            const normalized = String(atomId || '').trim();
            if (normalized) knownAtomIds.add(normalized);
        }
    }
    return knownAtomIds;
}

function normalizeExternalHttpCandidateIds(
    rawCandidateAtomIds: unknown,
    input: LocalVectorAccelerationSelectionInput
): {
    candidateAtomIds: string[];
    rejectedCount: number;
    totalAtomsInScope: number;
    prefilterRatio: number;
} {
    const knownAtomIds = buildKnownAtomIdSet(input);
    const totalAtomsInScope = Math.max(
        1,
        knownAtomIds.size > 0 ? knownAtomIds.size : Math.max(0, Math.floor(Number(input.atomCount || 0)))
    );

    const rawCandidateIds = Array.isArray(rawCandidateAtomIds)
        ? rawCandidateAtomIds
            .map((item: unknown) => String(item || '').trim())
            .filter(Boolean)
        : [];

    const seen = new Set<string>();
    const normalizedCandidates: string[] = [];
    for (const candidateId of rawCandidateIds) {
        if (knownAtomIds.size > 0 && !knownAtomIds.has(candidateId)) {
            continue;
        }
        if (seen.has(candidateId)) {
            continue;
        }
        seen.add(candidateId);
        normalizedCandidates.push(candidateId);
    }

    const maxCandidateCount = Math.max(
        EXTERNAL_HTTP_CANDIDATE_MIN_FLOOR,
        Math.min(
            EXTERNAL_HTTP_CANDIDATE_MAX_CAP,
            Math.max(1, Math.floor(Number(input.topK || 0))) * EXTERNAL_HTTP_CANDIDATE_MULTIPLIER
        )
    );
    const candidateAtomIds = normalizedCandidates.slice(0, maxCandidateCount);
    const rejectedCount = Math.max(0, rawCandidateIds.length - candidateAtomIds.length);
    const prefilterRatio = candidateAtomIds.length / totalAtomsInScope;
    return {
        candidateAtomIds,
        rejectedCount,
        totalAtomsInScope,
        prefilterRatio,
    };
}

export function normalizeVectorAccelerationAdapterProvider(rawValue: unknown): VectorAccelerationAdapterProvider {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'external_stub' || normalized === 'external-stub' || normalized === 'stub') {
        return 'external_stub';
    }
    if (normalized === 'external_http' || normalized === 'external-http' || normalized === 'http') {
        return 'external_http';
    }
    return 'local';
}

function normalizeEndpoint(rawValue: unknown): string {
    return String(rawValue || '').trim().replace(/\/+$/g, '');
}

function normalizeTimeoutMs(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return EXTERNAL_HTTP_TIMEOUT_MS_DEFAULT;
    }
    const floored = Math.floor(numeric);
    if (floored < EXTERNAL_HTTP_TIMEOUT_MS_MIN) {
        return EXTERNAL_HTTP_TIMEOUT_MS_MIN;
    }
    if (floored > EXTERNAL_HTTP_TIMEOUT_MS_MAX) {
        return EXTERNAL_HTTP_TIMEOUT_MS_MAX;
    }
    return floored;
}

function normalizeMaxRetries(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return EXTERNAL_HTTP_MAX_RETRIES_DEFAULT;
    }
    const floored = Math.floor(numeric);
    if (floored < EXTERNAL_HTTP_MAX_RETRIES_MIN) {
        return EXTERNAL_HTTP_MAX_RETRIES_MIN;
    }
    if (floored > EXTERNAL_HTTP_MAX_RETRIES_MAX) {
        return EXTERNAL_HTTP_MAX_RETRIES_MAX;
    }
    return floored;
}

function normalizeRetryDelayMs(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return EXTERNAL_HTTP_RETRY_DELAY_MS_DEFAULT;
    }
    const floored = Math.floor(numeric);
    if (floored < EXTERNAL_HTTP_RETRY_DELAY_MS_MIN) {
        return EXTERNAL_HTTP_RETRY_DELAY_MS_MIN;
    }
    if (floored > EXTERNAL_HTTP_RETRY_DELAY_MS_MAX) {
        return EXTERNAL_HTTP_RETRY_DELAY_MS_MAX;
    }
    return floored;
}

function normalizeCircuitFailureThreshold(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return EXTERNAL_HTTP_CIRCUIT_FAILURE_THRESHOLD_DEFAULT;
    }
    const floored = Math.floor(numeric);
    if (floored < EXTERNAL_HTTP_CIRCUIT_FAILURE_THRESHOLD_MIN) {
        return EXTERNAL_HTTP_CIRCUIT_FAILURE_THRESHOLD_MIN;
    }
    if (floored > EXTERNAL_HTTP_CIRCUIT_FAILURE_THRESHOLD_MAX) {
        return EXTERNAL_HTTP_CIRCUIT_FAILURE_THRESHOLD_MAX;
    }
    return floored;
}

function normalizeCircuitCooldownMs(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return EXTERNAL_HTTP_CIRCUIT_COOLDOWN_MS_DEFAULT;
    }
    const floored = Math.floor(numeric);
    if (floored < EXTERNAL_HTTP_CIRCUIT_COOLDOWN_MS_MIN) {
        return EXTERNAL_HTTP_CIRCUIT_COOLDOWN_MS_MIN;
    }
    if (floored > EXTERNAL_HTTP_CIRCUIT_COOLDOWN_MS_MAX) {
        return EXTERNAL_HTTP_CIRCUIT_COOLDOWN_MS_MAX;
    }
    return floored;
}

function normalizeRepresentationVersion(rawValue: unknown): string {
    return String(rawValue || '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 160);
}

function normalizeEmbeddingModelId(rawValue: unknown): string {
    return String(rawValue || '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 160);
}

function normalizeEmbeddingDimension(rawValue: unknown): number {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Math.max(0, Math.floor(numeric));
}

function normalizeIndexSignature(rawValue: unknown): string {
    return String(rawValue || '')
        .trim()
        .replace(/[^a-zA-Z0-9:_-]+/g, '')
        .slice(0, 200);
}

function normalizeRepresentationStatus(
    rawValue: unknown
): 'aligned' | 'mismatch' | 'unknown' {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'aligned' || normalized === 'mismatch' || normalized === 'unknown') {
        return normalized;
    }
    return 'unknown';
}

function parseExternalHttpStatusCode(error: unknown): number {
    const message = String((error as Error)?.message || error || '').trim().toLowerCase();
    const matched = message.match(/external_http_status_(\d{3})/);
    if (!matched) {
        return 0;
    }
    const numeric = Number(matched[1]);
    return Number.isFinite(numeric) ? Math.floor(numeric) : 0;
}

function isExternalHttpTransientFailure(error: unknown): boolean {
    const name = String((error as Error)?.name || '').trim().toLowerCase();
    if (name === 'aborterror' || name === 'timeout') {
        return true;
    }
    const statusCode = parseExternalHttpStatusCode(error);
    if (statusCode > 0) {
        return EXTERNAL_HTTP_RETRYABLE_STATUSES.has(statusCode);
    }
    const message = String((error as Error)?.message || error || '').trim().toLowerCase();
    return [
        'fetch failed',
        'networkerror',
        'socket_hang_up',
        'econnreset',
        'econnrefused',
        'etimedout',
        'timed out',
        'timeout',
        'eai_again',
    ].some((token) => message.includes(token));
}

function truncateMessage(rawValue: unknown, maxLength = 200): string {
    return String(rawValue || '').trim().slice(0, maxLength);
}

function normalizeExternalHttpErrorCode(rawValue: unknown, fallback = ''): string {
    const normalized = String(rawValue || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 96);
    return normalized || fallback;
}

function normalizeExternalHttpRequestId(rawValue: unknown, fallback = ''): string {
    const normalized = String(rawValue || '')
        .trim()
        .replace(/[^a-zA-Z0-9._:-]+/g, '')
        .slice(0, 96);
    return normalized || fallback;
}

function nextExternalHttpRequestId(nowMs = Date.now()): string {
    EXTERNAL_HTTP_REQUEST_ID_SEQUENCE = (EXTERNAL_HTTP_REQUEST_ID_SEQUENCE + 1) % 1000000;
    const timestampToken = Math.max(0, Math.floor(nowMs)).toString(36);
    const sequenceToken = EXTERNAL_HTTP_REQUEST_ID_SEQUENCE.toString(36).padStart(4, '0');
    return `${EXTERNAL_HTTP_REQUEST_ID_PREFIX}-${timestampToken}-${sequenceToken}`;
}

function parseExternalHttpRetryAfterMs(rawValue: unknown, nowMs = Date.now()): number {
    const value = String(rawValue || '').trim();
    if (!value) {
        return 0;
    }
    const numericSeconds = Number(value);
    if (Number.isFinite(numericSeconds)) {
        const numericMs = Math.round(Math.max(0, numericSeconds) * 1000);
        return Math.min(EXTERNAL_HTTP_RETRY_AFTER_MS_MAX, numericMs);
    }
    const parsedAtMs = Date.parse(value);
    if (!Number.isFinite(parsedAtMs)) {
        return 0;
    }
    const deltaMs = parsedAtMs - nowMs;
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
        return 0;
    }
    return Math.min(EXTERNAL_HTTP_RETRY_AFTER_MS_MAX, Math.floor(deltaMs));
}

async function waitForRetryDelay(ms: number): Promise<void> {
    if (!Number.isFinite(ms) || ms <= 0) {
        return;
    }
    await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}

function selectCandidatesFromExternalStub(
    input: LocalVectorAccelerationSelectionInput
): LocalVectorAccelerationSelectionOutput {
    if (!input.annPrefilterEnabled || input.atomCount < EXTERNAL_STUB_MIN_ATOMS) {
        return {
            used: false,
            candidateAtomIds: [],
            mode: 'full_scan',
        };
    }

    const prioritizedTokens = uniqueTokens([
        ...Array.from(input.queryWeights.entries())
            .filter((entry) => Number(entry[1]) > 0)
            .sort((left, right) => Number(right[1]) - Number(left[1]))
            .map((entry) => String(entry[0] || '')),
        ...input.queryTokens,
    ]).slice(0, EXTERNAL_STUB_TOP_TOKENS);

    if (prioritizedTokens.length <= 0) {
        return {
            used: false,
            candidateAtomIds: [],
            mode: 'full_scan',
        };
    }

    const targetCandidateCount = Math.min(
        input.atomCount,
        Math.max(EXTERNAL_STUB_CANDIDATE_MIN_FLOOR, Math.max(1, input.topK) * EXTERNAL_STUB_CANDIDATE_MULTIPLIER)
    );
    const minimumCandidateCount = Math.min(input.atomCount, Math.max(1, input.topK) * 2);
    const candidateSet = new Set<string>();
    let tokenMatched = false;

    prioritizedTokens.forEach((token) => {
        if (candidateSet.size >= targetCandidateCount) {
            return;
        }
        const postingList = input.tokenToAtomIds.get(token);
        if (!postingList || postingList.length <= 0) {
            return;
        }
        tokenMatched = true;
        postingList.forEach((atomId) => {
            if (candidateSet.size >= targetCandidateCount) {
                return;
            }
            const normalizedId = String(atomId || '').trim();
            if (normalizedId) {
                candidateSet.add(normalizedId);
            }
        });
    });

    if (!tokenMatched || candidateSet.size < minimumCandidateCount) {
        return {
            used: false,
            candidateAtomIds: [],
            mode: 'full_scan',
        };
    }

    return {
        used: true,
        candidateAtomIds: Array.from(candidateSet),
        mode: 'token_prefilter',
    };
}

export function createVectorAccelerationAdapter(
    provider: VectorAccelerationAdapterProvider,
    options: VectorAccelerationAdapterFactoryOptions = {}
): LocalVectorAccelerationAdapter | undefined {
    if (provider === 'external_stub') {
        return {
            id: EXTERNAL_STUB_ADAPTER_ID,
            selectCandidates: selectCandidatesFromExternalStub,
            getHealth: () => ({
                status: 'ready',
                message: 'external_stub_adapter_ready',
                checkedAt: new Date().toISOString(),
                representationVersion: EXTERNAL_STUB_REPRESENTATION_VERSION,
                embeddingModelId: EXTERNAL_STUB_EMBEDDING_MODEL_ID,
                representationStatus: 'unknown',
                representationStatusReason: 'external_stub_representation_unverified',
            }),
        };
    }
    if (provider !== 'external_http') {
        return undefined;
    }
    const endpoint = normalizeEndpoint(options.externalHttp?.endpoint);
    const timeoutMs = normalizeTimeoutMs(options.externalHttp?.timeoutMs);
    const maxRetries = normalizeMaxRetries(options.externalHttp?.maxRetries);
    const retryDelayMs = normalizeRetryDelayMs(options.externalHttp?.retryDelayMs);
    const circuitFailureThreshold = normalizeCircuitFailureThreshold(options.externalHttp?.circuitFailureThreshold);
    const circuitCooldownMs = normalizeCircuitCooldownMs(options.externalHttp?.circuitCooldownMs);
    let circuitState: 'closed' | 'open' | 'half_open' = 'closed';
    let circuitOpenedAtMs = 0;
    let circuitOpenedAt = '';
    let consecutiveFailures = 0;
    let selectionRequestCount = 0;
    let retryCount = 0;
    let shortCircuitCount = 0;
    let successCount = 0;
    let failureCount = 0;
    let halfOpenProbeSuccessCount = 0;
    let halfOpenProbeFailureCount = 0;
    let lastSuccessAt = '';
    let lastFailureAt = '';
    let lastRequestId = '';
    let lastErrorCode = '';
    let lastRetryAfterMs = 0;
    let representationVersion = '';
    let embeddingModelId = '';
    let embeddingDimension = 0;
    let indexSignature = '';
    let representationStatus: 'aligned' | 'mismatch' | 'unknown' = 'unknown';
    let representationStatusReason = '';
    /** M10.6: Prefilter effectiveness tracking. */
    let prefilterEffectivenessRatio = 1;
    let lastTotalAtomsInScope = 0;
    const buildHealthTelemetryFields = (): Omit<
        LocalVectorAccelerationAdapterHealth,
        'status' | 'message' | 'checkedAt'
    > => ({
        circuitState,
        consecutiveFailures,
        requestCount: selectionRequestCount,
        retryCount,
        shortCircuitCount,
        successCount,
        failureCount,
        halfOpenProbeSuccessCount,
        halfOpenProbeFailureCount,
        lastSuccessAt: lastSuccessAt || undefined,
        lastFailureAt: lastFailureAt || undefined,
        circuitOpenedAt: circuitOpenedAt || undefined,
        lastRequestId: lastRequestId || undefined,
        lastErrorCode: lastErrorCode || undefined,
        lastRetryAfterMs: lastRetryAfterMs > 0 ? lastRetryAfterMs : undefined,
        representationVersion: representationVersion || undefined,
        embeddingModelId: embeddingModelId || undefined,
        embeddingDimension: embeddingDimension > 0 ? embeddingDimension : undefined,
        indexSignature: indexSignature || undefined,
        representationStatus,
        representationStatusReason: representationStatusReason || undefined,
        prefilterEffectivenessRatio: prefilterEffectivenessRatio || undefined,
        lastTotalAtomsInScope: lastTotalAtomsInScope > 0 ? lastTotalAtomsInScope : undefined,
    });
    let lastHealth: LocalVectorAccelerationAdapterHealth = endpoint
        ? {
            status: 'degraded',
            message: (
                `external_http_endpoint_configured:${endpoint}:retries=${maxRetries}:`
                + `breaker=${circuitFailureThreshold}/${circuitCooldownMs}`
            ),
            checkedAt: new Date().toISOString(),
            ...buildHealthTelemetryFields(),
        }
        : {
            status: 'unavailable',
            message: 'external_http_endpoint_missing',
            checkedAt: new Date().toISOString(),
            ...buildHealthTelemetryFields(),
        };

    const updateHealth = (next: LocalVectorAccelerationAdapterHealth): void => {
        lastHealth = {
            ...buildHealthTelemetryFields(),
            status: next.status,
            message: String(next.message || '').trim() || undefined,
            checkedAt: String(next.checkedAt || '').trim() || new Date().toISOString(),
        };
    };

    return {
        id: EXTERNAL_HTTP_ADAPTER_ID,
        async selectCandidates(input: LocalVectorAccelerationSelectionInput): Promise<LocalVectorAccelerationSelectionOutput> {
            selectionRequestCount += 1;
            const requestedRepresentationVersion = normalizeRepresentationVersion(input.representationVersion);
            const requestedEmbeddingModelId = normalizeEmbeddingModelId(input.embeddingModelId);
            const requestedEmbeddingDimension = normalizeEmbeddingDimension(input.embeddingDimension);
            const requestedIndexSignature = normalizeIndexSignature(input.indexSignature);
            if (requestedRepresentationVersion) {
                representationVersion = requestedRepresentationVersion;
            }
            if (requestedEmbeddingModelId) {
                embeddingModelId = requestedEmbeddingModelId;
            }
            if (requestedEmbeddingDimension > 0) {
                embeddingDimension = requestedEmbeddingDimension;
            }
            if (requestedIndexSignature) {
                indexSignature = requestedIndexSignature;
            }
            if (!endpoint) {
                const endpointMissingError = new Error('external_http_endpoint_missing');
                lastErrorCode = 'endpoint_missing';
                lastRetryAfterMs = 0;
                consecutiveFailures += 1;
                failureCount += 1;
                lastFailureAt = new Date().toISOString();
                representationStatus = 'unknown';
                representationStatusReason = 'external_http_endpoint_missing';
                updateHealth({
                    status: 'unavailable',
                    message: 'external_http_endpoint_missing',
                    checkedAt: new Date().toISOString(),
                });
                throw endpointMissingError;
            }
            const nowMs = Date.now();
            if (circuitState === 'open') {
                const elapsedMs = Math.max(0, nowMs - circuitOpenedAtMs);
                if (elapsedMs < circuitCooldownMs) {
                    const remainingMs = Math.max(0, circuitCooldownMs - elapsedMs);
                    const shortCircuitError = new Error(`external_http_circuit_open:${remainingMs}`);
                    lastErrorCode = 'circuit_open';
                    lastRetryAfterMs = remainingMs;
                    shortCircuitCount += 1;
                    failureCount += 1;
                    lastFailureAt = new Date().toISOString();
                    updateHealth({
                        status: 'unavailable',
                        message: `external_http_circuit_open:${remainingMs}`,
                        checkedAt: new Date().toISOString(),
                    });
                    throw shortCircuitError;
                }
                circuitState = 'half_open';
                updateHealth({
                    status: 'degraded',
                    message: 'external_http_circuit_half_open',
                    checkedAt: new Date().toISOString(),
                });
            }
            const halfOpenProbeActive = circuitState === 'half_open';
            const totalAttempts = Math.max(1, maxRetries + 1);
            let lastError: unknown = null;
            for (let attemptIndex = 0; attemptIndex < totalAttempts; attemptIndex += 1) {
                const currentAttempt = attemptIndex + 1;
                const clientRequestId = nextExternalHttpRequestId();
                let connectorRequestId = '';
                let connectorErrorCode = '';
                let responseRetryAfterMs = 0;
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    const response = await fetch(`${endpoint}/select-candidates`, {
                        method: 'POST',
                        headers: {
                            'content-type': 'application/json',
                            'x-request-id': clientRequestId,
                            'x-correlation-id': clientRequestId,
                        },
                        body: JSON.stringify({
                            atomCount: input.atomCount,
                            queryTokens: input.queryTokens,
                            queryWeights: Array.from(input.queryWeights.entries()),
                            topK: input.topK,
                            annPrefilterEnabled: input.annPrefilterEnabled,
                            representationVersion: requestedRepresentationVersion || undefined,
                            embeddingModelId: requestedEmbeddingModelId || undefined,
                            embeddingDimension: requestedEmbeddingDimension > 0
                                ? requestedEmbeddingDimension
                                : undefined,
                            indexSignature: requestedIndexSignature || undefined,
                        }),
                        signal: controller.signal,
                    });
                    connectorRequestId = normalizeExternalHttpRequestId(
                        response?.headers?.get?.('x-request-id'),
                        clientRequestId
                    );
                    if (connectorRequestId) {
                        lastRequestId = connectorRequestId;
                    }
                    connectorErrorCode = normalizeExternalHttpErrorCode(
                        response?.headers?.get?.('x-error-code'),
                        ''
                    );
                    if (connectorErrorCode) {
                        lastErrorCode = connectorErrorCode;
                    }
                    responseRetryAfterMs = parseExternalHttpRetryAfterMs(
                        response?.headers?.get?.('retry-after')
                    );
                    if (responseRetryAfterMs > 0) {
                        lastRetryAfterMs = responseRetryAfterMs;
                    }
                    if (!response.ok) {
                        const statusCode = Math.max(0, Math.floor(Number(response.status || 0)));
                        const statusErrorCode = normalizeExternalHttpErrorCode(
                            connectorErrorCode,
                            statusCode > 0 ? `http_${statusCode}` : 'http_error'
                        );
                        connectorErrorCode = statusErrorCode;
                        lastErrorCode = statusErrorCode;
                        const retryAfterSegment = responseRetryAfterMs > 0
                            ? `:retryAfterMs=${responseRetryAfterMs}`
                            : '';
                        throw new Error(
                            `external_http_status_${statusCode}:errorCode=${statusErrorCode}${retryAfterSegment}:requestId=${connectorRequestId || clientRequestId}`
                        );
                    }
                    const payload = await response.json();
                    const mode = String(payload?.mode || '').trim().toLowerCase();
                    const normalizedMode: LocalVectorAccelerationSelectionOutput['mode'] = (
                        mode === 'token_prefilter'
                        || mode === 'token_signature_prefilter'
                    ) ? mode : 'full_scan';
                    const responseRepresentationVersion = normalizeRepresentationVersion(payload?.representationVersion);
                    const responseEmbeddingModelId = normalizeEmbeddingModelId(payload?.embeddingModelId);
                    const responseEmbeddingDimension = normalizeEmbeddingDimension(payload?.embeddingDimension);
                    const responseIndexSignature = normalizeIndexSignature(payload?.indexSignature);
                    if (responseRepresentationVersion) {
                        representationVersion = responseRepresentationVersion;
                    }
                    if (responseEmbeddingModelId) {
                        embeddingModelId = responseEmbeddingModelId;
                    }
                    if (responseEmbeddingDimension > 0) {
                        embeddingDimension = responseEmbeddingDimension;
                    }
                    if (responseIndexSignature) {
                        indexSignature = responseIndexSignature;
                    }
                    const responseRepresentationStatus = normalizeRepresentationStatus(payload?.representationStatus);
                    const responseRepresentationStatusReason = truncateMessage(
                        payload?.representationStatusReason,
                        240
                    );
                    const representationMismatchReasons: string[] = [];
                    if (responseRepresentationVersion && requestedRepresentationVersion
                        && responseRepresentationVersion !== requestedRepresentationVersion) {
                        representationMismatchReasons.push('representation_version');
                    }
                    if (responseEmbeddingModelId && requestedEmbeddingModelId
                        && responseEmbeddingModelId !== requestedEmbeddingModelId) {
                        representationMismatchReasons.push('embedding_model_id');
                    }
                    if (responseEmbeddingDimension > 0 && requestedEmbeddingDimension > 0
                        && responseEmbeddingDimension !== requestedEmbeddingDimension) {
                        representationMismatchReasons.push('embedding_dimension');
                    }
                    if (responseIndexSignature && requestedIndexSignature
                        && responseIndexSignature !== requestedIndexSignature) {
                        representationMismatchReasons.push('index_signature');
                    }
                    const responseRepresentationMetadataProvided = (
                        Boolean(responseRepresentationVersion)
                        || Boolean(responseEmbeddingModelId)
                        || responseEmbeddingDimension > 0
                        || Boolean(responseIndexSignature)
                    );
                    const requestRepresentationMetadataProvided = (
                        Boolean(requestedRepresentationVersion)
                        || Boolean(requestedEmbeddingModelId)
                        || requestedEmbeddingDimension > 0
                        || Boolean(requestedIndexSignature)
                    );
                    if (responseRepresentationStatus !== 'unknown') {
                        representationStatus = responseRepresentationStatus;
                        representationStatusReason = responseRepresentationStatusReason
                            || (responseRepresentationStatus === 'aligned'
                                ? 'external_http_representation_aligned'
                                : 'external_http_representation_mismatch');
                    } else if (representationMismatchReasons.length > 0) {
                        representationStatus = 'mismatch';
                        representationStatusReason = `mismatch:${representationMismatchReasons.join(',')}`;
                    } else if (responseRepresentationMetadataProvided) {
                        representationStatus = 'aligned';
                        representationStatusReason = responseRepresentationStatusReason
                            || 'external_http_representation_metadata_aligned';
                    } else if (requestRepresentationMetadataProvided) {
                        representationStatus = 'unknown';
                        representationStatusReason = 'external_http_response_representation_metadata_missing';
                    } else {
                        representationStatus = 'unknown';
                        representationStatusReason = 'representation_metadata_unavailable';
                    }
                    const candidateNormalization = normalizeExternalHttpCandidateIds(
                        payload?.candidateAtomIds,
                        input
                    );
                    const candidateAtomIds = candidateNormalization.candidateAtomIds;
                    if (candidateNormalization.rejectedCount > 0) {
                        const rejectedReason = `candidate_ids_out_of_scope:${candidateNormalization.rejectedCount}`;
                        representationStatusReason = representationStatusReason
                            ? `${representationStatusReason}|${rejectedReason}`
                            : rejectedReason;
                    }
                    const used = payload?.used === true
                        && normalizedMode !== 'full_scan'
                        && candidateAtomIds.length > 0;
                    prefilterEffectivenessRatio = used ? candidateNormalization.prefilterRatio : 1;
                    lastTotalAtomsInScope = used
                        ? candidateNormalization.totalAtomsInScope
                        : Math.max(1, Math.floor(Number(input.atomCount || 0)));
                    consecutiveFailures = 0;
                    circuitState = 'closed';
                    lastErrorCode = '';
                    successCount += 1;
                    lastSuccessAt = new Date().toISOString();
                    if (halfOpenProbeActive) {
                        halfOpenProbeSuccessCount += 1;
                    }
                    updateHealth({
                        status: 'ready',
                        message: (
                            `external_http_ok:${endpoint}:attempt=${currentAttempt}:`
                            + `requestId=${connectorRequestId || clientRequestId}:circuit=${circuitState}`
                        ),
                        checkedAt: new Date().toISOString(),
                    });
                    return {
                        used,
                        candidateAtomIds: used ? candidateAtomIds : [],
                        mode: used ? normalizedMode : 'full_scan',
                        representation: {
                            version: representationVersion || undefined,
                            embeddingModelId: embeddingModelId || undefined,
                            embeddingDimension: embeddingDimension > 0 ? embeddingDimension : undefined,
                            indexSignature: indexSignature || undefined,
                            validated: representationStatus !== 'mismatch',
                        },
                        prefilterMetrics: {
                            candidatesReturned: used ? candidateAtomIds.length : 0,
                            totalAtomsInScope: candidateNormalization.totalAtomsInScope,
                            prefilterRatio: used ? candidateNormalization.prefilterRatio : 1,
                            signatureMatch: !representationMismatchReasons.includes('index_signature'),
                        },
                    };
                } catch (error) {
                    lastError = error;
                    const transient = isExternalHttpTransientFailure(error);
                    const finalAttempt = currentAttempt >= totalAttempts;
                    if (!connectorRequestId) {
                        const requestIdMatch = String((error as Error)?.message || '').match(/requestId=([A-Za-z0-9._:-]+)/i);
                        connectorRequestId = normalizeExternalHttpRequestId(
                            requestIdMatch?.[1],
                            clientRequestId
                        );
                    }
                    if (connectorRequestId) {
                        lastRequestId = connectorRequestId;
                    }
                    if (!connectorErrorCode) {
                        const errorCodeMatch = String((error as Error)?.message || '').match(/errorCode=([a-z0-9:_-]+)/i);
                        connectorErrorCode = normalizeExternalHttpErrorCode(errorCodeMatch?.[1], '');
                    }
                    if (connectorErrorCode) {
                        lastErrorCode = connectorErrorCode;
                    }
                    if (responseRetryAfterMs <= 0) {
                        const retryAfterMatch = String((error as Error)?.message || '').match(/retryAfterMs=(\d+)/i);
                        const retryAfterCandidate = Number(retryAfterMatch?.[1] || 0);
                        if (Number.isFinite(retryAfterCandidate) && retryAfterCandidate > 0) {
                            responseRetryAfterMs = Math.min(
                                EXTERNAL_HTTP_RETRY_AFTER_MS_MAX,
                                Math.floor(retryAfterCandidate)
                            );
                        }
                    }
                    if (responseRetryAfterMs > 0) {
                        lastRetryAfterMs = responseRetryAfterMs;
                    }
                    const errorMessage = truncateMessage((error as Error)?.message || error, 200);
                    if (!finalAttempt && transient) {
                        retryCount += 1;
                        const defaultBackoffDelay = Math.min(
                            EXTERNAL_HTTP_RETRY_AFTER_MS_MAX,
                            retryDelayMs * Math.max(1, 2 ** attemptIndex)
                        );
                        const effectiveBackoffDelay = Math.max(defaultBackoffDelay, responseRetryAfterMs);
                        updateHealth({
                            status: 'degraded',
                            message: (
                                `external_http_retrying:${currentAttempt}/${totalAttempts}:${errorMessage}:`
                                + `backoffMs=${effectiveBackoffDelay}:retryAfterMs=${responseRetryAfterMs}:`
                                + `requestId=${connectorRequestId || clientRequestId}`
                            ),
                            checkedAt: new Date().toISOString(),
                        });
                        await waitForRetryDelay(effectiveBackoffDelay);
                        continue;
                    }
                    consecutiveFailures += 1;
                    if (consecutiveFailures >= circuitFailureThreshold) {
                        circuitState = 'open';
                        circuitOpenedAtMs = Date.now();
                        circuitOpenedAt = new Date().toISOString();
                    } else if (circuitState === 'half_open') {
                        circuitState = 'open';
                        circuitOpenedAtMs = Date.now();
                        circuitOpenedAt = new Date().toISOString();
                    }
                    if (halfOpenProbeActive) {
                        halfOpenProbeFailureCount += 1;
                    }
                    failureCount += 1;
                    lastFailureAt = new Date().toISOString();
                    updateHealth({
                        status: circuitState === 'open' ? 'unavailable' : (transient ? 'degraded' : 'unavailable'),
                        message: (
                            `external_http_failed:${currentAttempt}/${totalAttempts}:${errorMessage}:`
                            + `failures=${consecutiveFailures}:circuit=${circuitState}:`
                            + `errorCode=${connectorErrorCode || 'none'}:retryAfterMs=${responseRetryAfterMs}:`
                            + `requestId=${connectorRequestId || clientRequestId}`
                        ),
                        checkedAt: new Date().toISOString(),
                    });
                    throw error;
                } finally {
                    clearTimeout(timer);
                }
            }
            throw (lastError || new Error('external_http_unknown_failure'));
        },
        getHealth(): LocalVectorAccelerationAdapterHealth {
            return {
                ...lastHealth,
                checkedAt: String(lastHealth.checkedAt || '').trim() || new Date().toISOString(),
            };
        },
    };
}
