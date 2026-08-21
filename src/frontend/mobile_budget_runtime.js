(function attachMobileBudgetRuntime(root) {
    'use strict';

    // This is the intentionally tiny browser projection of config/mobile-budget.v1.json.
    // The Node/Rust contract remains the source of truth; contract tests reject drift.
    if (!root || root.NoteConnectionMobileBudget) {
        return;
    }

    root.NoteConnectionMobileBudget = Object.freeze({
        schemaVersion: 1,
        profiles: Object.freeze({
            'mobile-low': Object.freeze({
                artifactCompressedBytes: 25 * 1024 * 1024,
                maxResidentBytes: 256 * 1024 * 1024,
                maxDeviceRamBytes: 4 * 1024 * 1024 * 1024
            }),
            'mobile-standard': Object.freeze({
                artifactCompressedBytes: 35 * 1024 * 1024,
                maxResidentBytes: 384 * 1024 * 1024,
                maxDeviceRamBytes: 8 * 1024 * 1024 * 1024
            })
        }),
        runtime: Object.freeze({
            maxDocuments: 5000,
            maxDocumentBytes: 16 * 1024 * 1024,
            maxTotalInputBytes: 64 * 1024 * 1024,
            maxEdges: 250000,
            maxDepth: 64,
            maxProjectionBytes: 48 * 1024 * 1024
        })
    });
}(typeof globalThis !== 'undefined' ? globalThis : this));
