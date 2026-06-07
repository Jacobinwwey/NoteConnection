import { createRuntimeRunbookRouteOps } from './runtimeRunbookRouteOps';

function createRuntimeCapabilityMatrix(overrides: Record<string, unknown> = {}): any {
    return {
        generatedAt: '2026-06-06T10:00:00.000Z',
        overallStatus: 'degraded',
        summary: {
            passCount: 0,
            warnCount: 0,
            failCount: 1,
        },
        checks: [
            {
                checkId: 'alpha_check',
                status: 'fail',
                message: 'alpha failed',
                observed: 'observed',
                priorityScore: 12,
                recommendedActions: ['Inspect alpha'],
            },
        ],
        signals: {
            topRiskCheckId: 'alpha_check',
        },
        ...overrides,
    };
}

function createDependencies(overrides: Record<string, unknown> = {}): any {
    return {
        buildRuntimePayload: jest.fn(async (generatedAt: string) => ({
            runtimeCapabilityMatrix: createRuntimeCapabilityMatrix({
                generatedAt,
            }),
        })),
        normalizeCheckId: jest.fn((value: string) => String(value || '').trim().toLowerCase()),
        replayVerificationForCheck: jest.fn(async () => null),
        buildIndexSyncHealthSummary: jest.fn(() => ({ health: 'index-sync-ok' })),
        queryHistory: jest.fn(async (request: unknown) => request),
        parseHistoryLimit: jest.fn((value: unknown) => Number(value || 20)),
        parseHistorySinceMinutes: jest.fn((value: unknown) => Number(value || 1440)),
        normalizeVerificationStatus: jest.fn((value: string) => String(value || '').trim().toLowerCase()),
        queryChecks: jest.fn(async (request: unknown) => request),
        parseChecksLimit: jest.fn((value: unknown) => Number(value || 8)),
        queryActionQueue: jest.fn(async (request: unknown) => request),
        parseActionQueueLimit: jest.fn((value: unknown) => Number(value || 12)),
        normalizeActionQueuePriorityFilter: jest.fn((value: string) => String(value || '').trim().toLowerCase()),
        normalizeActionQueueCategoryFilter: jest.fn((value: string) => String(value || '').trim().toLowerCase()),
        normalizeActionQueueRemediationStatusFilter: jest.fn((value: string) => String(value || '').trim().toLowerCase()),
        normalizeActionQueueRemediationTrendFilter: jest.fn((value: string) => String(value || '').trim().toLowerCase()),
        queryRemediationHistory: jest.fn(async (request: unknown) => request),
        parseRemediationLimit: jest.fn((value: unknown) => Number(value || 20)),
        normalizeRemediationStatusQuery: jest.fn((value: string) => String(value || '').trim().toLowerCase()),
        normalizeRemediationSource: jest.fn((value: string) => String(value || '').trim().toLowerCase()),
        getReplaySchedule: jest.fn(async () => ({ enabled: true })),
        normalizeRemediationEventPayload: jest.fn((payload: unknown, requestId: string) => ({
            payload,
            requestId,
        })),
        appendRemediationEventRecord: jest.fn(),
        getRemediationEventCount: jest.fn(() => 3),
        triggerReplayScheduleFromEvent: jest.fn(),
        normalizeRemediationReplayRequestPayload: jest.fn((payload: unknown) => ({
            normalizedReplayPayload: payload,
        })),
        replayRemediationEvents: jest.fn(async (payload: unknown) => payload),
        updateReplaySchedule: jest.fn(async (payload: unknown) => ({
            updated: payload,
        })),
        normalizeReplayScheduleTickPayload: jest.fn((payload: any) => ({
            force: Boolean(payload?.force),
            dryRunOverride: payload?.dryRunOverride,
        })),
        tickReplaySchedule: jest.fn(async (options: unknown) => options),
        ...overrides,
    };
}

describe('runtimeRunbookRouteOps', () => {
    test('verify reuses replay result and resolves selected/effective check ids', async () => {
        const deps = createDependencies({
            replayVerificationForCheck: jest.fn(async () => ({
                resolvedCheckId: 'alpha_check_resolved',
                replayedAt: '2026-06-06T10:01:00.000Z',
                selectedCheckStatus: 'fail',
            })),
        });
        const ops = createRuntimeRunbookRouteOps(deps);

        const result = await ops.verify?.({
            checkId: 'alpha_check',
            sinceMinutes: 60,
            limit: 15,
        });

        expect(deps.replayVerificationForCheck).toHaveBeenCalledWith({
            checkId: 'alpha_check',
            sinceMinutes: 60,
            traceLimit: 15,
        });
        expect(result).toMatchObject({
            resolvedCheckId: 'alpha_check_resolved',
            selectedCheckId: 'alpha_check_resolved',
            effectiveCheckId: 'alpha_check_resolved',
            selectedCheckStatus: 'fail',
        });
    });

    test('verify returns stable fallback result when no verification history is available', async () => {
        const deps = createDependencies();
        const ops = createRuntimeRunbookRouteOps(deps);

        const result = await ops.verify?.({
            checkId: 'alpha_check',
        });

        expect(result).toMatchObject({
            requestedCheckId: 'alpha_check',
            selectedCheckId: '',
            effectiveCheckId: '',
            selectedCheckStatus: 'unknown',
            selectedCheckEscalation: 'normal',
            selectedCheckMessage: 'No verification history available yet.',
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
            queryVectorAccelerationIndexSyncHealth: {
                health: 'index-sync-ok',
            },
        });
        expect(Array.isArray((result as any).verificationTargets)).toBe(true);
        expect((result as any).verificationTargets.length).toBeGreaterThan(0);
    });

    test('getActionQueue delegates normalized filters to the query owner', async () => {
        const deps = createDependencies();
        const ops = createRuntimeRunbookRouteOps(deps);

        await ops.getActionQueue?.({
            limit: 9,
            sinceMinutes: 33,
            status: 'WARN',
            checkQuery: 'alpha',
            queueLimit: 7,
            priority: 'P1',
            category: 'trend',
            checkId: 'ALPHA_CHECK',
            remediationStatus: 'SUCCESS',
            remediationTrend: 'REGRESSING',
        });

        expect(deps.queryActionQueue).toHaveBeenCalledWith({
            checksQuery: {
                limit: 9,
                sinceMinutes: 33,
                status: 'warn',
                checkQuery: 'alpha',
            },
            queueLimit: 7,
            priorityFilter: 'p1',
            categoryFilter: 'trend',
            checkIdFilter: 'alpha_check',
            remediationStatusFilter: 'success',
            remediationTrendFilter: 'regressing',
        });
    });

    test('recordRemediationEvent appends the normalized record and returns count summary', async () => {
        const deps = createDependencies();
        const ops = createRuntimeRunbookRouteOps(deps);

        const result = await ops.recordRemediationEvent?.({
            action: 'retry',
        }, 'req-123');

        expect(deps.normalizeRemediationEventPayload).toHaveBeenCalledWith({
            action: 'retry',
        }, 'req-123');
        expect(deps.appendRemediationEventRecord).toHaveBeenCalledWith({
            payload: {
                action: 'retry',
            },
            requestId: 'req-123',
        });
        expect(deps.triggerReplayScheduleFromEvent).toHaveBeenCalled();
        expect(result).toEqual({
            record: {
                payload: {
                    action: 'retry',
                },
                requestId: 'req-123',
            },
            summary: {
                totalRecords: 3,
            },
        });
    });
});
