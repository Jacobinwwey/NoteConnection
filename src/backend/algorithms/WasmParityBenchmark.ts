import { Graph } from '../../core/Graph';

export interface DurationSummary {
    count: number;
    minMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    maxMs: number;
    meanMs: number;
}

export interface BetweennessDiffSummary {
    comparedNodes: number;
    missingInBaseline: number;
    missingInCandidate: number;
    maxAbsDelta: number;
    meanAbsDelta: number;
    mismatchedNodeCount: number;
    tolerance: number;
    withinTolerance: boolean;
}

export interface DeterministicGraphOptions {
    nodeCount: number;
    branchStride?: number;
    jumpSpan?: number;
    meshStride?: number;
}

function interpolatePercentile(sortedSamples: number[], percentile: number): number {
    if (sortedSamples.length === 0) {
        return 0;
    }
    if (sortedSamples.length === 1) {
        return sortedSamples[0];
    }

    const clampedPercentile = Math.min(1, Math.max(0, percentile));
    const rank = (sortedSamples.length - 1) * clampedPercentile;
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    if (lower === upper) {
        return sortedSamples[lower];
    }

    const weight = rank - lower;
    return (sortedSamples[lower] * (1 - weight)) + (sortedSamples[upper] * weight);
}

export function summarizeDurations(samplesMs: number[]): DurationSummary {
    const sanitized = samplesMs
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 0)
        .sort((left, right) => left - right);

    if (sanitized.length === 0) {
        return {
            count: 0,
            minMs: 0,
            p50Ms: 0,
            p95Ms: 0,
            p99Ms: 0,
            maxMs: 0,
            meanMs: 0
        };
    }

    const sum = sanitized.reduce((acc, value) => acc + value, 0);
    return {
        count: sanitized.length,
        minMs: sanitized[0],
        p50Ms: interpolatePercentile(sanitized, 0.5),
        p95Ms: interpolatePercentile(sanitized, 0.95),
        p99Ms: interpolatePercentile(sanitized, 0.99),
        maxMs: sanitized[sanitized.length - 1],
        meanMs: sum / sanitized.length
    };
}

export function summarizeBetweennessDifference(
    baseline: Map<string, number>,
    candidate: Map<string, number>,
    tolerance = 1e-9
): BetweennessDiffSummary {
    const keys = new Set<string>([
        ...baseline.keys(),
        ...candidate.keys()
    ]);

    let missingInBaseline = 0;
    let missingInCandidate = 0;
    let maxAbsDelta = 0;
    let totalAbsDelta = 0;
    let mismatchedNodeCount = 0;

    keys.forEach((nodeId) => {
        const hasBaseline = baseline.has(nodeId);
        const hasCandidate = candidate.has(nodeId);
        if (!hasBaseline) {
            missingInBaseline += 1;
        }
        if (!hasCandidate) {
            missingInCandidate += 1;
        }

        const baselineValue = Number(hasBaseline ? baseline.get(nodeId) : 0);
        const candidateValue = Number(hasCandidate ? candidate.get(nodeId) : 0);
        const absDelta = Math.abs(baselineValue - candidateValue);
        if (absDelta > maxAbsDelta) {
            maxAbsDelta = absDelta;
        }
        totalAbsDelta += absDelta;
        if (absDelta > tolerance) {
            mismatchedNodeCount += 1;
        }
    });

    const comparedNodes = keys.size;
    return {
        comparedNodes,
        missingInBaseline,
        missingInCandidate,
        maxAbsDelta,
        meanAbsDelta: comparedNodes > 0 ? totalAbsDelta / comparedNodes : 0,
        mismatchedNodeCount,
        tolerance,
        withinTolerance: missingInBaseline === 0 && missingInCandidate === 0 && mismatchedNodeCount === 0
    };
}

export function buildDeterministicBenchmarkGraph(input: number | DeterministicGraphOptions): Graph {
    const options = typeof input === 'number'
        ? { nodeCount: input }
        : input;
    const nodeCount = Math.max(2, Math.floor(Number(options.nodeCount) || 0));
    const branchStride = Math.max(2, Math.floor(Number(options.branchStride) || 4));
    const jumpSpan = Math.max(2, Math.floor(Number(options.jumpSpan) || 7));
    const meshStride = Math.max(2, Math.floor(Number(options.meshStride) || 11));

    const graph = new Graph();
    for (let index = 0; index < nodeCount; index += 1) {
        const id = `n${index}`;
        graph.addNode({
            id,
            label: id,
            inDegree: 0,
            outDegree: 0
        });
    }

    // Primary chain maintains full graph reachability from n0.
    for (let index = 0; index < nodeCount - 1; index += 1) {
        graph.addEdge(`n${index}`, `n${index + 1}`);
    }

    // Branch edges add medium-range dependency density.
    for (let index = 0; index + jumpSpan < nodeCount; index += branchStride) {
        graph.addEdge(`n${index}`, `n${index + jumpSpan}`);
    }

    // Mesh edges add longer-range shortcuts while keeping forward-only DAG shape.
    const longJump = jumpSpan * 2;
    for (let index = 0; index + longJump < nodeCount; index += meshStride) {
        graph.addEdge(`n${index}`, `n${index + longJump}`);
    }

    return graph;
}
