const BYTES_PER_MEBIBYTE = 1024 * 1024;
const MIN_OLD_SPACE_MB = 512;
const DESKTOP_DEFAULT_OLD_SPACE_MB = 4096;
const DESKTOP_MAX_OLD_SPACE_MB = 12288;
const MOBILE_DEFAULT_OLD_SPACE_MB = 1024;
const MOBILE_MAX_OLD_SPACE_MB = 4096;
const IOS_DEFAULT_OLD_SPACE_MB = 768;
const IOS_MAX_OLD_SPACE_MB = 2048;
const IOS_TIGHT_DEFAULT_OLD_SPACE_MB = 640;
const IOS_TIGHT_MAX_OLD_SPACE_MB = 1536;
const IOS_RELAXED_DEFAULT_OLD_SPACE_MB = 1024;
const IOS_RELAXED_MAX_OLD_SPACE_MB = 2560;
const LARGE_GRAPH_OLD_SPACE_MB = 8192;
const EXTREME_GRAPH_OLD_SPACE_MB = 12288;
const LARGE_GRAPH_NODE_THRESHOLD = 5000;
const EXTREME_GRAPH_NODE_THRESHOLD = 20000;
const LARGE_GRAPH_EDGE_THRESHOLD = 500000;
const EXTREME_GRAPH_EDGE_THRESHOLD = 2000000;

function parseOptionalPositiveInteger(rawValue) {
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return 0;
    }
    return Math.floor(numericValue);
}

function clampInteger(value, minValue, maxValue) {
    return Math.min(maxValue, Math.max(minValue, Math.floor(value)));
}

function normalizeGraphScale(rawValue) {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'large' || normalized === 'l') {
        return 'large';
    }
    if (normalized === 'xlarge' || normalized === 'xl') {
        return 'xlarge';
    }
    if (normalized === 'huge' || normalized === 'xxl' || normalized === 'extreme') {
        return 'huge';
    }
    return 'default';
}

function parseBooleanFlag(rawValue) {
    const normalized = String(rawValue || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizeIosJetsamTier(rawValue) {
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized === 'tight' || normalized === 'strict' || normalized === 'low') {
        return 'tight';
    }
    if (normalized === 'relaxed' || normalized === 'high' || normalized === 'highmem') {
        return 'relaxed';
    }
    return 'balanced';
}

function detectRuntimePlatform(env) {
    const runtimeProfile = String(env.NOTE_CONNECTION_RUNTIME_PROFILE || '').trim().toLowerCase();
    if (runtimeProfile === 'android') {
        return 'android';
    }
    if (runtimeProfile === 'ios') {
        return 'ios';
    }
    if (runtimeProfile === 'mobile') {
        return 'mobile';
    }
    if (runtimeProfile === 'desktop' || runtimeProfile === 'server') {
        return 'desktop';
    }

    const explicitRuntimePlatform = String(env.NOTE_CONNECTION_RUNTIME_PLATFORM || '').trim().toLowerCase();
    if (explicitRuntimePlatform === 'android' || explicitRuntimePlatform === 'ios') {
        return explicitRuntimePlatform;
    }
    if (explicitRuntimePlatform === 'mobile') {
        return 'mobile';
    }
    if (explicitRuntimePlatform === 'desktop') {
        return 'desktop';
    }

    const capacitorPlatform = String(env.CAPACITOR_PLATFORM || '').trim().toLowerCase();
    if (capacitorPlatform === 'android') {
        return 'android';
    }
    if (capacitorPlatform === 'ios') {
        return 'ios';
    }

    const tauriPlatform = String(env.TAURI_ENV_PLATFORM || '').trim().toLowerCase();
    if (tauriPlatform.includes('android')) {
        return 'android';
    }
    if (tauriPlatform.includes('ios')) {
        return 'ios';
    }

    if (parseBooleanFlag(env.NOTE_CONNECTION_MOBILE)) {
        return 'mobile';
    }

    return 'desktop';
}

function detectRuntimeClass(env) {
    const runtimePlatform = detectRuntimePlatform(env);
    return runtimePlatform === 'desktop' ? 'desktop' : 'mobile';
}

function resolveRuntimeBounds(runtimePlatform, env) {
    if (runtimePlatform === 'ios') {
        const iosJetsamTier = normalizeIosJetsamTier(env.NOTE_CONNECTION_IOS_JETSAM_TIER);
        if (iosJetsamTier === 'tight') {
            return {
                runtimeDefaultMb: IOS_TIGHT_DEFAULT_OLD_SPACE_MB,
                runtimeMaxMb: IOS_TIGHT_MAX_OLD_SPACE_MB,
                iosJetsamTier,
            };
        }
        if (iosJetsamTier === 'relaxed') {
            return {
                runtimeDefaultMb: IOS_RELAXED_DEFAULT_OLD_SPACE_MB,
                runtimeMaxMb: IOS_RELAXED_MAX_OLD_SPACE_MB,
                iosJetsamTier,
            };
        }
        return {
            runtimeDefaultMb: IOS_DEFAULT_OLD_SPACE_MB,
            runtimeMaxMb: IOS_MAX_OLD_SPACE_MB,
            iosJetsamTier,
        };
    }

    if (runtimePlatform === 'android' || runtimePlatform === 'mobile') {
        return {
            runtimeDefaultMb: MOBILE_DEFAULT_OLD_SPACE_MB,
            runtimeMaxMb: MOBILE_MAX_OLD_SPACE_MB,
            iosJetsamTier: null,
        };
    }

    return {
        runtimeDefaultMb: DESKTOP_DEFAULT_OLD_SPACE_MB,
        runtimeMaxMb: DESKTOP_MAX_OLD_SPACE_MB,
        iosJetsamTier: null,
    };
}

function resolveWorkloadHint(env) {
    const expectedNodeCount = parseOptionalPositiveInteger(env.NOTE_CONNECTION_EXPECTED_NODE_COUNT);
    const expectedEdgeCount = parseOptionalPositiveInteger(env.NOTE_CONNECTION_EXPECTED_EDGE_COUNT);
    const graphScale = normalizeGraphScale(env.NOTE_CONNECTION_GRAPH_SCALE);
    return {
        expectedNodeCount,
        expectedEdgeCount,
        graphScale,
    };
}

function resolveWorkloadTargetOldSpaceMb(workloadHint) {
    let targetMb = 0;

    if (workloadHint.graphScale === 'large') {
        targetMb = Math.max(targetMb, LARGE_GRAPH_OLD_SPACE_MB);
    } else if (workloadHint.graphScale === 'xlarge') {
        targetMb = Math.max(targetMb, LARGE_GRAPH_OLD_SPACE_MB);
    } else if (workloadHint.graphScale === 'huge') {
        targetMb = Math.max(targetMb, EXTREME_GRAPH_OLD_SPACE_MB);
    }

    if (
        workloadHint.expectedNodeCount >= LARGE_GRAPH_NODE_THRESHOLD ||
        workloadHint.expectedEdgeCount >= LARGE_GRAPH_EDGE_THRESHOLD
    ) {
        targetMb = Math.max(targetMb, LARGE_GRAPH_OLD_SPACE_MB);
    }

    if (
        workloadHint.expectedNodeCount >= EXTREME_GRAPH_NODE_THRESHOLD ||
        workloadHint.expectedEdgeCount >= EXTREME_GRAPH_EDGE_THRESHOLD
    ) {
        targetMb = Math.max(targetMb, EXTREME_GRAPH_OLD_SPACE_MB);
    }

    return targetMb;
}

function resolveRuntimeHeapPolicy(env, totalSystemMemoryMb) {
    const runtimePlatform = detectRuntimePlatform(env);
    const runtimeClass = runtimePlatform === 'desktop' ? 'desktop' : 'mobile';
    const runtimeBounds = resolveRuntimeBounds(runtimePlatform, env);
    const runtimeDefaultMb = runtimeBounds.runtimeDefaultMb;
    const runtimeMaxMb = runtimeBounds.runtimeMaxMb;
    const workloadHint = resolveWorkloadHint(env);
    const workloadTargetMb = resolveWorkloadTargetOldSpaceMb(workloadHint);
    const recommendedOldSpaceMb = clampInteger(
        Math.max(runtimeDefaultMb, workloadTargetMb),
        MIN_OLD_SPACE_MB,
        runtimeMaxMb
    );

    const explicitOverrideMb = parseOptionalPositiveInteger(env.NOTE_CONNECTION_MAX_OLD_SPACE_SIZE_MB);
    const allowOverrideBeyondHostBudget = parseBooleanFlag(env.NOTE_CONNECTION_ALLOW_HOST_MEMORY_OVERRIDE);
    const warnings = [];

    let hostBudgetMb = 0;
    const normalizedHostMemoryMb = parseOptionalPositiveInteger(totalSystemMemoryMb);
    if (normalizedHostMemoryMb > 0) {
        const reserveMb = runtimeClass === 'mobile' ? 512 : 1024;
        hostBudgetMb = Math.max(
            MIN_OLD_SPACE_MB,
            Math.floor(normalizedHostMemoryMb * 0.75) - reserveMb
        );
    }

    const effectiveMaxMb = hostBudgetMb > 0 && !allowOverrideBeyondHostBudget
        ? Math.min(runtimeMaxMb, hostBudgetMb)
        : runtimeMaxMb;

    let source = 'default';
    let selectedOldSpaceMb = recommendedOldSpaceMb;
    if (workloadTargetMb > 0) {
        source = 'workload-hint';
    }

    if (explicitOverrideMb > 0) {
        source = 'env-override';
        selectedOldSpaceMb = explicitOverrideMb;
    }

    const clampedSelectedOldSpaceMb = clampInteger(selectedOldSpaceMb, MIN_OLD_SPACE_MB, effectiveMaxMb);
    if (clampedSelectedOldSpaceMb !== selectedOldSpaceMb) {
        if (explicitOverrideMb > 0) {
            warnings.push(
                `NOTE_CONNECTION_MAX_OLD_SPACE_SIZE_MB=${explicitOverrideMb} was clamped to ${clampedSelectedOldSpaceMb} MiB.`
            );
        } else if (hostBudgetMb > 0 && recommendedOldSpaceMb > effectiveMaxMb) {
            warnings.push(
                `Host memory budget constrained old-space to ${clampedSelectedOldSpaceMb} MiB (recommended ${recommendedOldSpaceMb} MiB).`
            );
        }
    }

    const sanitizedRecommendedOldSpaceMb = clampInteger(
        recommendedOldSpaceMb,
        MIN_OLD_SPACE_MB,
        effectiveMaxMb
    );

    if (runtimePlatform === 'ios' && workloadTargetMb > runtimeMaxMb) {
        const jetsamTierText = runtimeBounds.iosJetsamTier || 'balanced';
        warnings.push(
            `iOS Jetsam ceiling (${jetsamTierText}) constrained old-space to ${clampedSelectedOldSpaceMb} MiB ` +
            `for workload target ${workloadTargetMb} MiB.`
        );
    }

    return {
        runtimeClass,
        runtimePlatform,
        iosJetsamTier: runtimeBounds.iosJetsamTier,
        source,
        selectedOldSpaceMb: clampedSelectedOldSpaceMb,
        recommendedOldSpaceMb: sanitizedRecommendedOldSpaceMb,
        workloadHint,
        explicitOverrideMb,
        hostBudgetMb,
        effectiveMaxMb,
        warnings,
    };
}

function stripMaxOldSpaceFromNodeOptions(nodeOptions) {
    const normalized = String(nodeOptions || '').trim();
    if (!normalized) {
        return '';
    }

    return normalized
        .split(/\s+/)
        .filter((token) => !token.startsWith('--max-old-space-size'))
        .join(' ')
        .trim();
}

module.exports = {
    BYTES_PER_MEBIBYTE,
    MIN_OLD_SPACE_MB,
    DESKTOP_MAX_OLD_SPACE_MB,
    MOBILE_MAX_OLD_SPACE_MB,
    IOS_MAX_OLD_SPACE_MB,
    IOS_TIGHT_MAX_OLD_SPACE_MB,
    IOS_RELAXED_MAX_OLD_SPACE_MB,
    detectRuntimeClass,
    detectRuntimePlatform,
    resolveRuntimeHeapPolicy,
    stripMaxOldSpaceFromNodeOptions,
};
