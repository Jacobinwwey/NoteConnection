(function () {
    function getNow() {
        if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    function cloneDiagnostics(source) {
        if (!source || typeof source !== 'object') {
            return null;
        }
        return JSON.parse(JSON.stringify(source));
    }

    function createRuntimeCacheManager(options) {
        const createRuntime = options && typeof options.createRuntime === 'function'
            ? options.createRuntime
            : null;
        const buildSignature = options && typeof options.buildSignature === 'function'
            ? options.buildSignature
            : null;
        const readStats = options && typeof options.readStats === 'function'
            ? options.readStats
            : null;
        const label = options && typeof options.label === 'string'
            ? options.label.trim()
            : 'hosted-future-path-runtime';
        let cacheEntry = null;
        let lastDiagnostics = null;
        const aggregate = {
            cacheHitCount: 0,
            cacheMissCount: 0,
            runtimeBuildCount: 0,
            lastCacheState: 'empty',
            lastSignature: '',
            lastResolveMs: 0,
            lastBuildMs: 0,
        };

        function buildDiagnosticsBase(sourceData, signature) {
            const stats = readStats ? readStats(sourceData) : {};
            return {
                cacheLabel: label,
                signature: String(signature || ''),
                sourceNodeCount: Number.isFinite(Number(stats && stats.nodeCount))
                    ? Number(stats.nodeCount)
                    : 0,
                sourceEdgeCount: Number.isFinite(Number(stats && stats.edgeCount))
                    ? Number(stats.edgeCount)
                    : 0,
                cacheHit: false,
                cacheMiss: false,
                cacheState: cacheEntry ? 'warm' : 'cold',
                runtimeBuildCount: Number(aggregate.runtimeBuildCount || 0),
                cacheHitCount: Number(aggregate.cacheHitCount || 0),
                cacheMissCount: Number(aggregate.cacheMissCount || 0),
                resolveMs: 0,
                buildMs: 0,
                reason: '',
            };
        }

        return {
            resolve: function (sourceData) {
                const resolveStartedAt = getNow();
                const signature = buildSignature ? buildSignature(sourceData) : '';
                const diagnostics = buildDiagnosticsBase(sourceData, signature);
                if (
                    cacheEntry
                    && cacheEntry.sourceData === sourceData
                    && cacheEntry.signature === signature
                ) {
                    aggregate.cacheHitCount += 1;
                    aggregate.lastCacheState = 'hit';
                    diagnostics.cacheHit = true;
                    diagnostics.cacheState = 'hit';
                    diagnostics.cacheHitCount = Number(aggregate.cacheHitCount || 0);
                    diagnostics.cacheMissCount = Number(aggregate.cacheMissCount || 0);
                    diagnostics.runtimeBuildCount = Number(aggregate.runtimeBuildCount || 0);
                    diagnostics.resolveMs = Number((getNow() - resolveStartedAt).toFixed(3));
                    diagnostics.buildMs = 0;
                    diagnostics.reason = 'runtime_reused';
                    aggregate.lastResolveMs = diagnostics.resolveMs;
                    aggregate.lastBuildMs = 0;
                    aggregate.lastSignature = diagnostics.signature;
                    lastDiagnostics = diagnostics;
                    return {
                        runtime: cacheEntry.runtime,
                        diagnostics: cloneDiagnostics(diagnostics),
                    };
                }

                aggregate.cacheMissCount += 1;
                aggregate.lastCacheState = cacheEntry ? 'miss_rebuild' : 'miss_cold';
                diagnostics.cacheMiss = true;
                diagnostics.cacheState = cacheEntry ? 'miss_rebuild' : 'miss_cold';
                diagnostics.cacheHitCount = Number(aggregate.cacheHitCount || 0);
                diagnostics.cacheMissCount = Number(aggregate.cacheMissCount || 0);

                const buildStartedAt = getNow();
                const runtime = createRuntime ? createRuntime(sourceData) : null;
                diagnostics.buildMs = Number((getNow() - buildStartedAt).toFixed(3));
                diagnostics.resolveMs = Number((getNow() - resolveStartedAt).toFixed(3));
                aggregate.lastResolveMs = diagnostics.resolveMs;
                aggregate.lastBuildMs = diagnostics.buildMs;
                aggregate.lastSignature = diagnostics.signature;
                if (runtime) {
                    aggregate.runtimeBuildCount += 1;
                    diagnostics.runtimeBuildCount = Number(aggregate.runtimeBuildCount || 0);
                    cacheEntry = {
                        sourceData,
                        signature,
                        runtime,
                    };
                    diagnostics.reason = cacheEntry && cacheEntry.runtime ? 'runtime_ready' : '';
                } else {
                    diagnostics.runtimeBuildCount = Number(aggregate.runtimeBuildCount || 0);
                    diagnostics.reason = 'runtime_unavailable';
                    cacheEntry = null;
                }
                lastDiagnostics = diagnostics;
                return {
                    runtime,
                    diagnostics: cloneDiagnostics(diagnostics),
                };
            },
            clear: function () {
                cacheEntry = null;
                aggregate.lastCacheState = 'cleared';
                aggregate.lastSignature = '';
                aggregate.lastResolveMs = 0;
                aggregate.lastBuildMs = 0;
                lastDiagnostics = null;
            },
            getDiagnostics: function () {
                return cloneDiagnostics(lastDiagnostics);
            },
            getAggregateSnapshot: function () {
                return cloneDiagnostics({
                    cacheLabel: label,
                    cacheHitCount: Number(aggregate.cacheHitCount || 0),
                    cacheMissCount: Number(aggregate.cacheMissCount || 0),
                    runtimeBuildCount: Number(aggregate.runtimeBuildCount || 0),
                    lastCacheState: String(aggregate.lastCacheState || ''),
                    lastSignature: String(aggregate.lastSignature || ''),
                    lastResolveMs: Number(aggregate.lastResolveMs || 0),
                    lastBuildMs: Number(aggregate.lastBuildMs || 0),
                });
            },
        };
    }

    window.NoteConnectionHostedFuturePathRuntime = {
        createRuntimeCacheManager,
    };
}());
