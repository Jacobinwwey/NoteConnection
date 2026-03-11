export interface WasmParityHistoryCompactionOptions {
    maxRecords: number;
    maxAgeDays: number;
    now?: Date;
}

export interface WasmParityHistoryCompactionResult<TRecord> {
    beforeCount: number;
    afterCount: number;
    compacted: TRecord[];
}

export type WasmParityHistoryMaturityTier = 'bootstrap' | 'warming' | 'enforced';
export type WasmParityHistoryPerformanceFailMode = 'always' | 'enforced-only' | 'never';
export type WasmParityHistoryPerformanceDecisionOutcome = 'not-applied' | 'pass' | 'warn' | 'fail';

export interface WasmParityHistoryComparableRecord {
    generatedAt?: string;
    hostKey?: string;
    nodeCount?: number;
    maxWorkers?: number;
    wasmUsed?: boolean;
    equivalenceWithinTolerance?: boolean;
    performanceGuardsPass?: boolean;
}

export interface WasmParityHistoryComparableContext {
    hostKey: string;
    nodeCount: number;
    maxWorkers: number;
    historyWindow: number;
}

export interface WasmParityHistoryMaturitySummary {
    tier: WasmParityHistoryMaturityTier;
    sampleCount: number;
    minimumSamples: number;
    strictSamples: number;
}

export interface WasmParityHistoryReadinessProfileSummary {
    hostKey: string;
    nodeCount: number;
    maxWorkers: number;
    sampleCount: number;
    firstGeneratedAt: string;
    lastGeneratedAt: string;
    maturity: WasmParityHistoryMaturitySummary;
}

export interface WasmParityHistoryReadinessSummary {
    minimumSamples: number;
    strictSamples: number;
    historyWindow: number;
    comparableRecordCount: number;
    profileCount: number;
    tierCounts: Record<WasmParityHistoryMaturityTier, number>;
    profileSummaries: WasmParityHistoryReadinessProfileSummary[];
}

export interface WasmParityHistoryReadinessOptions {
    minimumSamples: number;
    strictSamples: number;
    historyWindow: number;
}

export interface WasmParityHistoryPerformanceDecisionInput {
    mode: WasmParityHistoryPerformanceFailMode;
    applied: boolean;
    pass: boolean;
    profileTier: WasmParityHistoryMaturityTier;
}

export interface WasmParityHistoryPerformanceDecision {
    mode: WasmParityHistoryPerformanceFailMode;
    applied: boolean;
    pass: boolean;
    profileTier: WasmParityHistoryMaturityTier;
    outcome: WasmParityHistoryPerformanceDecisionOutcome;
    shouldFail: boolean;
}

function toFinitePositiveInteger(value: number, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return fallback;
    }
    return Math.floor(numeric);
}

function toValidDate(value: unknown): Date | null {
    const parsed = new Date(String(value || ''));
    if (!Number.isFinite(parsed.getTime())) {
        return null;
    }
    return parsed;
}

function toFiniteNonNegativeInteger(value: unknown, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return fallback;
    }
    return Math.floor(numeric);
}

function toStrictSampleFloor(minimumSamples: number, strictSamples: number): number {
    const minimum = Math.max(1, minimumSamples);
    return Math.max(minimum, strictSamples);
}

type ComparableEntry<TRecord extends WasmParityHistoryComparableRecord> = {
    index: number;
    timestampMs: number;
    generatedAtIso: string;
    hostKey: string;
    nodeCount: number;
    maxWorkers: number;
    record: TRecord;
};

function toComparableEntries<TRecord extends WasmParityHistoryComparableRecord>(
    records: TRecord[]
): ComparableEntry<TRecord>[] {
    const source = Array.isArray(records) ? records : [];
    return source
        .map((record, index) => {
            const generatedAt = toValidDate(record?.generatedAt);
            const hostKey = String(record?.hostKey || '').trim();
            const nodeCount = Number(record?.nodeCount);
            const maxWorkers = Number(record?.maxWorkers);
            if (!generatedAt || hostKey.length === 0) {
                return null;
            }
            if (!Number.isFinite(nodeCount) || !Number.isFinite(maxWorkers)) {
                return null;
            }
            if (record?.wasmUsed !== true) {
                return null;
            }
            if (record?.equivalenceWithinTolerance !== true) {
                return null;
            }
            if (record?.performanceGuardsPass !== true) {
                return null;
            }
            return {
                index,
                timestampMs: generatedAt.getTime(),
                generatedAtIso: generatedAt.toISOString(),
                hostKey,
                nodeCount: Math.floor(nodeCount),
                maxWorkers: Math.floor(maxWorkers),
                record
            };
        })
        .filter((entry): entry is ComparableEntry<TRecord> => Boolean(entry))
        .sort((left, right) => {
            if (left.timestampMs !== right.timestampMs) {
                return left.timestampMs - right.timestampMs;
            }
            return left.index - right.index;
        });
}

function toProfileKey(hostKey: string, nodeCount: number, maxWorkers: number): string {
    return `${hostKey}|${nodeCount}|${maxWorkers}`;
}

/**
 * Compacts history entries by removing malformed/timestamp-less records,
 * enforcing max-age retention, and bounding total record count.
 */
export function compactWasmParityHistoryRecords<TRecord extends { generatedAt?: string }>(
    records: TRecord[],
    options: WasmParityHistoryCompactionOptions
): WasmParityHistoryCompactionResult<TRecord> {
    const source = Array.isArray(records) ? records : [];
    const beforeCount = source.length;
    const now = options.now instanceof Date ? options.now : new Date();
    const maxRecords = toFinitePositiveInteger(options.maxRecords, 2000);
    const maxAgeDays = toFinitePositiveInteger(options.maxAgeDays, 90);
    const minTimestampMs = now.getTime() - (maxAgeDays * 24 * 60 * 60 * 1000);

    const withTimestamps = source
        .map((record, index) => {
            const generatedAt = toValidDate(record?.generatedAt);
            if (!generatedAt) {
                return null;
            }
            return {
                index,
                timestampMs: generatedAt.getTime(),
                record
            };
        })
        .filter((entry): entry is { index: number; timestampMs: number; record: TRecord } => Boolean(entry));

    const retainedByAge = withTimestamps
        .filter((entry) => entry.timestampMs >= minTimestampMs && entry.timestampMs <= now.getTime())
        .sort((left, right) => {
            if (left.timestampMs !== right.timestampMs) {
                return left.timestampMs - right.timestampMs;
            }
            return left.index - right.index;
        })
        .map((entry) => entry.record);

    const compacted = retainedByAge.length <= maxRecords
        ? retainedByAge
        : retainedByAge.slice(retainedByAge.length - maxRecords);

    return {
        beforeCount,
        afterCount: compacted.length,
        compacted
    };
}

export function classifyWasmParityHistoryMaturity(
    sampleCount: number,
    minimumSamples: number,
    strictSamples: number
): WasmParityHistoryMaturitySummary {
    const effectiveSampleCount = toFiniteNonNegativeInteger(sampleCount, 0);
    const effectiveMinimumSamples = toFinitePositiveInteger(minimumSamples, 1);
    const effectiveStrictSamples = toStrictSampleFloor(
        effectiveMinimumSamples,
        toFinitePositiveInteger(strictSamples, effectiveMinimumSamples)
    );

    let tier: WasmParityHistoryMaturityTier = 'enforced';
    if (effectiveSampleCount < effectiveMinimumSamples) {
        tier = 'bootstrap';
    } else if (effectiveSampleCount < effectiveStrictSamples) {
        tier = 'warming';
    }

    return {
        tier,
        sampleCount: effectiveSampleCount,
        minimumSamples: effectiveMinimumSamples,
        strictSamples: effectiveStrictSamples
    };
}

export function selectComparableWasmParityHistoryRecords<TRecord extends WasmParityHistoryComparableRecord>(
    records: TRecord[],
    context: WasmParityHistoryComparableContext
): TRecord[] {
    const source = toComparableEntries(records);
    const historyWindow = toFinitePositiveInteger(context.historyWindow, 20);
    const hostKey = String(context.hostKey || '').trim();
    const nodeCount = toFiniteNonNegativeInteger(context.nodeCount, -1);
    const maxWorkers = toFiniteNonNegativeInteger(context.maxWorkers, -1);
    if (hostKey.length === 0 || nodeCount < 0 || maxWorkers < 0) {
        return [];
    }

    const comparable = source.filter((entry) => (
        entry.hostKey === hostKey &&
        entry.nodeCount === nodeCount &&
        entry.maxWorkers === maxWorkers
    ));
    const startIndex = Math.max(0, comparable.length - historyWindow);
    return comparable.slice(startIndex).map((entry) => entry.record);
}

export function summarizeWasmParityHistoryReadiness<TRecord extends WasmParityHistoryComparableRecord>(
    records: TRecord[],
    options: WasmParityHistoryReadinessOptions
): WasmParityHistoryReadinessSummary {
    const minimumSamples = toFinitePositiveInteger(options.minimumSamples, 5);
    const strictSamples = toStrictSampleFloor(
        minimumSamples,
        toFinitePositiveInteger(options.strictSamples, minimumSamples)
    );
    const historyWindow = toFinitePositiveInteger(options.historyWindow, 20);
    const entries = toComparableEntries(records);

    const grouped = new Map<string, ComparableEntry<TRecord>[]>();
    entries.forEach((entry) => {
        const profileKey = toProfileKey(entry.hostKey, entry.nodeCount, entry.maxWorkers);
        const existing = grouped.get(profileKey);
        if (existing) {
            existing.push(entry);
        } else {
            grouped.set(profileKey, [entry]);
        }
    });

    const profileSummaries = Array.from(grouped.values())
        .map((profileEntries) => {
            const startIndex = Math.max(0, profileEntries.length - historyWindow);
            const retained = profileEntries.slice(startIndex);
            if (retained.length === 0) {
                return null;
            }
            const first = retained[0];
            const last = retained[retained.length - 1];
            return {
                hostKey: first.hostKey,
                nodeCount: first.nodeCount,
                maxWorkers: first.maxWorkers,
                sampleCount: retained.length,
                firstGeneratedAt: first.generatedAtIso,
                lastGeneratedAt: last.generatedAtIso,
                maturity: classifyWasmParityHistoryMaturity(
                    retained.length,
                    minimumSamples,
                    strictSamples
                )
            } satisfies WasmParityHistoryReadinessProfileSummary;
        })
        .filter((profile): profile is WasmParityHistoryReadinessProfileSummary => Boolean(profile))
        .sort((left, right) => {
            if (right.sampleCount !== left.sampleCount) {
                return right.sampleCount - left.sampleCount;
            }
            return right.lastGeneratedAt.localeCompare(left.lastGeneratedAt);
        });

    const tierCounts: Record<WasmParityHistoryMaturityTier, number> = {
        bootstrap: 0,
        warming: 0,
        enforced: 0
    };
    profileSummaries.forEach((profile) => {
        tierCounts[profile.maturity.tier] += 1;
    });

    return {
        minimumSamples,
        strictSamples,
        historyWindow,
        comparableRecordCount: entries.length,
        profileCount: profileSummaries.length,
        tierCounts,
        profileSummaries
    };
}

export function decideWasmParityHistoryPerformanceGuardOutcome(
    input: WasmParityHistoryPerformanceDecisionInput
): WasmParityHistoryPerformanceDecision {
    if (!input.applied) {
        return {
            mode: input.mode,
            applied: input.applied,
            pass: input.pass,
            profileTier: input.profileTier,
            outcome: 'not-applied',
            shouldFail: false
        };
    }

    if (input.pass) {
        return {
            mode: input.mode,
            applied: input.applied,
            pass: input.pass,
            profileTier: input.profileTier,
            outcome: 'pass',
            shouldFail: false
        };
    }

    if (input.mode === 'never') {
        return {
            mode: input.mode,
            applied: input.applied,
            pass: input.pass,
            profileTier: input.profileTier,
            outcome: 'warn',
            shouldFail: false
        };
    }

    if (input.mode === 'enforced-only') {
        const enforcedProfile = input.profileTier === 'enforced';
        return {
            mode: input.mode,
            applied: input.applied,
            pass: input.pass,
            profileTier: input.profileTier,
            outcome: enforcedProfile ? 'fail' : 'warn',
            shouldFail: enforcedProfile
        };
    }

    return {
        mode: input.mode,
        applied: input.applied,
        pass: input.pass,
        profileTier: input.profileTier,
        outcome: 'fail',
        shouldFail: true
    };
}
