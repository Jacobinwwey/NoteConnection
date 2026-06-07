import {
    buildRuntimeCapabilityRunbook,
    type RuntimeCapabilityMatrix,
} from '../learning';
import type { RuntimeRunbookRouteOps } from './types';

type RuntimeRunbookVerificationStatus = 'pass' | 'warn' | 'fail' | 'unknown';

type RuntimeCapabilityRunbookLike = {
    selectedCheck?: {
        checkId?: string;
        status?: string;
        priorityScore?: number;
        message?: string;
    } | null;
    topRiskCheck?: {
        checkId?: string;
        status?: string;
    } | null;
    selectionSource?: string;
    verificationTargets?: unknown[];
};

type RuntimeRunbookVerifyReplayResult = {
    resolvedCheckId?: string;
    [key: string]: unknown;
};

type RuntimeRunbookVerifyRequest = {
    checkId?: string;
    limit?: number;
    sinceMinutes?: number;
    status?: string;
    checkQuery?: string;
    focus?: string;
    focusLimit?: number;
};

type RuntimeRunbookHistoryRequest = {
    limit?: number;
    checkId?: string;
    sinceMinutes?: number;
    status?: string;
};

type RuntimeRunbookChecksRequest = {
    limit?: number;
    sinceMinutes?: number;
    status?: string;
    checkQuery?: string;
};

type RuntimeRunbookActionQueueRequest = {
    limit?: number;
    sinceMinutes?: number;
    status?: string;
    checkQuery?: string;
    queueLimit?: number;
    priority?: string;
    category?: string;
    checkId?: string;
    remediationStatus?: string;
    remediationTrend?: string;
};

type RuntimeRunbookRemediationHistoryRequest = {
    limit?: number;
    sinceMinutes?: number;
    status?: string;
    source?: string;
    checkId?: string;
};

export type RuntimeRunbookRouteOpsDependencies = {
    buildRuntimePayload: (generatedAt: string) => Promise<{
        runtimeCapabilityMatrix: RuntimeCapabilityMatrix;
    }>;
    normalizeCheckId: (value: string) => string;
    replayVerificationForCheck: (input: {
        checkId: string;
        sinceMinutes: number;
        traceLimit: number;
    }) => Promise<RuntimeRunbookVerifyReplayResult | null>;
    buildIndexSyncHealthSummary: (matrix: RuntimeCapabilityMatrix) => unknown;
    queryHistory: (request: any) => Promise<unknown> | unknown;
    parseHistoryLimit: (value: unknown) => number;
    parseHistorySinceMinutes: (value: unknown) => number;
    normalizeVerificationStatus: (value: string) => string;
    queryChecks: (request: any) => Promise<unknown> | unknown;
    parseChecksLimit: (value: unknown) => number;
    queryActionQueue: (request: any) => Promise<unknown> | unknown;
    parseActionQueueLimit: (value: unknown) => number;
    normalizeActionQueuePriorityFilter: (value: string) => string;
    normalizeActionQueueCategoryFilter: (value: string) => string;
    normalizeActionQueueRemediationStatusFilter: (value: string) => string;
    normalizeActionQueueRemediationTrendFilter: (value: string) => string;
    queryRemediationHistory: (request: any) => Promise<unknown> | unknown;
    parseRemediationLimit: (value: unknown) => number;
    normalizeRemediationStatusQuery: (value: string) => string;
    normalizeRemediationSource: (value: string) => string;
    getReplaySchedule: () => Promise<unknown> | unknown;
    normalizeRemediationEventPayload: (payload: unknown, requestId: string) => unknown;
    appendRemediationEventRecord: (record: any) => void;
    getRemediationEventCount: () => number;
    triggerReplayScheduleFromEvent: () => void;
    normalizeRemediationReplayRequestPayload: (payload: unknown) => unknown;
    replayRemediationEvents: (payload: any) => Promise<unknown> | unknown;
    updateReplaySchedule: (payload: unknown) => Promise<unknown> | unknown;
    normalizeReplayScheduleTickPayload: (payload: unknown) => {
        force: boolean;
        dryRunOverride: boolean | null;
    };
    tickReplaySchedule: (options: {
        force: boolean;
        dryRunOverride: boolean | null;
        actor: string;
    }) => Promise<unknown> | unknown;
};

function normalizeVerificationStatus(value: string): RuntimeRunbookVerificationStatus {
    const normalized = String(value || '').trim().toLowerCase();
    return (
        normalized === 'pass'
        || normalized === 'warn'
        || normalized === 'fail'
    )
        ? normalized
        : 'unknown';
}

function buildRuntimeRunbookVerifyFallbackResult(input: {
    generatedAt: string;
    requestedCheckId: string;
    runbook: RuntimeCapabilityRunbookLike;
    runtimeCapabilityMatrix: RuntimeCapabilityMatrix;
    buildIndexSyncHealthSummary: (matrix: RuntimeCapabilityMatrix) => unknown;
}): Record<string, unknown> {
    return {
        generatedAt: input.generatedAt,
        requestedCheckId: input.requestedCheckId,
        selectedCheckId: '',
        effectiveCheckId: '',
        selectedCheckStatus: 'unknown',
        selectedCheckEscalation: 'normal',
        selectedCheckPriorityScore: 0,
        selectedCheckMessage: 'No verification history available yet.',
        verificationTargets: Array.isArray(input.runbook.verificationTargets)
            ? input.runbook.verificationTargets
            : [],
        selectedCheckEscalationActions: [],
        traceSummary: {
            returnedRecords: 0,
            errorRequests: 0,
            errorRatioPct: 0,
            p95DurationMs: 0,
        },
        selectedCheckHistory: {
            returnedRecords: 0,
            activeRiskStreak: 0,
            activeFailStreak: 0,
            trendStatus: 'insufficient_data',
        },
        selectedCheckRemediation: {
            latestStatus: '',
            trendStatus: 'insufficient_data',
            riskRatioPct: 0,
        },
        queryVectorAccelerationIndexSyncHealth: input.buildIndexSyncHealthSummary(
            input.runtimeCapabilityMatrix
        ),
    };
}

export function createRuntimeRunbookRouteOps(
    deps: RuntimeRunbookRouteOpsDependencies
): RuntimeRunbookRouteOps {
    return {
        getRunbook: async (request: { checkId?: string } = {}) => {
            const generatedAt = new Date().toISOString();
            const runtimePayload = await deps.buildRuntimePayload(generatedAt);
            return buildRuntimeCapabilityRunbook(
                runtimePayload.runtimeCapabilityMatrix,
                String(request.checkId || '').trim()
            );
        },
        verify: async (request: RuntimeRunbookVerifyRequest = {}) => {
            const requestedCheckId = deps.normalizeCheckId(request.checkId || '');
            const sinceMinutes = Math.max(0, Math.floor(Number(request.sinceMinutes || 1440)));
            const traceLimit = Math.max(1, Math.floor(Number(request.limit || 20)));
            const generatedAt = new Date().toISOString();
            const runtimePayload = await deps.buildRuntimePayload(generatedAt);
            const runbook = buildRuntimeCapabilityRunbook(
                runtimePayload.runtimeCapabilityMatrix,
                requestedCheckId
            );
            const selectedCheckId = deps.normalizeCheckId(
                String(runbook.selectedCheck?.checkId || requestedCheckId)
            );
            if (selectedCheckId) {
                const replayResult = await deps.replayVerificationForCheck({
                    checkId: selectedCheckId,
                    sinceMinutes,
                    traceLimit,
                });
                if (replayResult) {
                    const resolvedCheckId = deps.normalizeCheckId(
                        String(replayResult.resolvedCheckId || selectedCheckId)
                    );
                    return {
                        ...replayResult,
                        selectedCheckId: resolvedCheckId || selectedCheckId,
                        effectiveCheckId: resolvedCheckId || selectedCheckId,
                    };
                }
            }
            return buildRuntimeRunbookVerifyFallbackResult({
                generatedAt,
                requestedCheckId,
                runbook,
                runtimeCapabilityMatrix: runtimePayload.runtimeCapabilityMatrix,
                buildIndexSyncHealthSummary: deps.buildIndexSyncHealthSummary,
            });
        },
        getHistory: async (request: RuntimeRunbookHistoryRequest = {}) => deps.queryHistory({
            limit: deps.parseHistoryLimit(request.limit),
            checkId: deps.normalizeCheckId(request.checkId || ''),
            sinceMinutes: deps.parseHistorySinceMinutes(request.sinceMinutes),
            status: deps.normalizeVerificationStatus(request.status || ''),
        }),
        getChecks: async (request: RuntimeRunbookChecksRequest = {}) => deps.queryChecks({
            limit: deps.parseChecksLimit(request.limit),
            sinceMinutes: deps.parseHistorySinceMinutes(request.sinceMinutes),
            status: deps.normalizeVerificationStatus(request.status || ''),
            checkQuery: String(request.checkQuery || '').trim(),
        }),
        getActionQueue: async (request: RuntimeRunbookActionQueueRequest = {}) => deps.queryActionQueue({
            checksQuery: {
                limit: deps.parseChecksLimit(request.limit),
                sinceMinutes: deps.parseHistorySinceMinutes(request.sinceMinutes),
                status: deps.normalizeVerificationStatus(request.status || ''),
                checkQuery: String(request.checkQuery || '').trim(),
            },
            queueLimit: deps.parseActionQueueLimit(request.queueLimit),
            priorityFilter: deps.normalizeActionQueuePriorityFilter(request.priority || ''),
            categoryFilter: deps.normalizeActionQueueCategoryFilter(request.category || ''),
            checkIdFilter: deps.normalizeCheckId(request.checkId || ''),
            remediationStatusFilter: deps.normalizeActionQueueRemediationStatusFilter(
                request.remediationStatus || ''
            ),
            remediationTrendFilter: deps.normalizeActionQueueRemediationTrendFilter(
                request.remediationTrend || ''
            ),
        }),
        getRemediationHistory: async (
            request: RuntimeRunbookRemediationHistoryRequest = {}
        ) => deps.queryRemediationHistory({
            limit: deps.parseRemediationLimit(request.limit),
            sinceMinutes: deps.parseHistorySinceMinutes(request.sinceMinutes),
            status: deps.normalizeRemediationStatusQuery(request.status || ''),
            source: deps.normalizeRemediationSource(request.source || ''),
            checkId: deps.normalizeCheckId(request.checkId || ''),
        }),
        getReplaySchedule: async () => deps.getReplaySchedule(),
        recordRemediationEvent: async (payload: unknown, requestId = '') => {
            const record = deps.normalizeRemediationEventPayload(payload, requestId);
            deps.appendRemediationEventRecord(record);
            deps.triggerReplayScheduleFromEvent();
            return {
                record,
                summary: {
                    totalRecords: Math.max(0, Math.floor(Number(deps.getRemediationEventCount() || 0))),
                },
            };
        },
        replayRemediationEvent: async (payload: unknown) => {
            const replayOptions = deps.normalizeRemediationReplayRequestPayload(payload);
            return deps.replayRemediationEvents(replayOptions);
        },
        updateReplaySchedule: async (payload: unknown) => deps.updateReplaySchedule(payload),
        tickReplaySchedule: async (payload: unknown = {}) => {
            const tickOptions = deps.normalizeReplayScheduleTickPayload(payload);
            return deps.tickReplaySchedule({
                force: tickOptions.force,
                dryRunOverride: tickOptions.dryRunOverride,
                actor: 'modular_route',
            });
        },
    };
}

export const __runtimeRunbookRouteOpsTestUtils = {
    buildRuntimeRunbookVerifyFallbackResult,
    normalizeVerificationStatus,
};
