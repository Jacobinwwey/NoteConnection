#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SQLITE_LATEST_REPORT_PATH = path.join(
    REPO_ROOT,
    'output',
    'verification',
    'foundation-sqlite-runtime',
    'foundation-sqlite-runtime-report-latest.json'
);
const ANN_LATEST_REPORT_PATH = path.join(
    REPO_ROOT,
    'output',
    'verification',
    'foundation-ann-runtime',
    'foundation-ann-runtime-report-latest.json'
);
const OUTPUT_ROOT = path.join(REPO_ROOT, 'output', 'verification', 'foundation-release-evidence');
const LATEST_REPORT_FILENAME = 'foundation-release-evidence-report-latest.json';
const MAX_AGE_HOURS_RANGE = Object.freeze({
    min: 1,
    max: 24 * 30,
    default: 24 * 7,
});
const FUTURE_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
const REQUIRED_RUNTIME_MODES = Object.freeze(['dist_node_runtime', 'packaged_sidecar']);
const REQUIRED_SQLITE_PROFILES = Object.freeze(['heavy']);
const REQUIRED_ANN_PROFILES = Object.freeze(['smoke', 'medium', 'heavy']);
const EVIDENCE_COMMANDS = Object.freeze({
    sqlite: 'npm run verify:foundation:sqlite-runtime:release',
    ann: 'npm run verify:foundation:ann-runtime:release',
});

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function toFilenameTimestamp(isoText) {
    return String(isoText || '').replace(/[:.]/g, '-');
}

function normalizeRepoPath(filePath) {
    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/');
    return relativePath && !relativePath.startsWith('..') ? relativePath : absolutePath.replace(/\\/g, '/');
}

function parseBoundedInteger(rawValue, range) {
    const parsed = Number(String(rawValue || '').trim());
    if (!Number.isFinite(parsed)) {
        return range.default;
    }
    const normalized = Math.floor(parsed);
    if (normalized < range.min) {
        return range.min;
    }
    if (normalized > range.max) {
        return range.max;
    }
    return normalized;
}

function parseCliOptions(argv) {
    const options = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--max-age-hours' && argv[index + 1]) {
            options.maxAgeHours = parseBoundedInteger(argv[index + 1], MAX_AGE_HOURS_RANGE);
            index += 1;
            continue;
        }
        if (arg === '--sqlite-report' && argv[index + 1]) {
            options.sqliteReportPath = path.resolve(REPO_ROOT, argv[index + 1]);
            index += 1;
            continue;
        }
        if (arg === '--ann-report' && argv[index + 1]) {
            options.annReportPath = path.resolve(REPO_ROOT, argv[index + 1]);
            index += 1;
        }
    }
    return options;
}

function resolveReportPath(optionPath, envName, fallbackPath) {
    if (optionPath) {
        return path.resolve(String(optionPath));
    }
    const envPath = String(process.env[envName] || '').trim();
    return envPath ? path.resolve(REPO_ROOT, envPath) : fallbackPath;
}

function readJsonReport(reportPath, componentId, errors) {
    if (!fs.existsSync(reportPath)) {
        errors.push(
            `${componentId} latest release evidence report is missing: ${normalizeRepoPath(reportPath)}. ` +
            `Run ${EVIDENCE_COMMANDS[componentId]} first.`
        );
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (error) {
        errors.push(
            `${componentId} latest release evidence report is not valid JSON: ${normalizeRepoPath(reportPath)}. ` +
            `${String(error && error.message ? error.message : error)}`
        );
        return null;
    }
}

function roundMetric(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Number(numeric.toFixed(4));
}

function validateFreshnessWindow(componentId, report, reportPath, options, errors, warnings) {
    const verifiedAtText = String(report && report.verifiedAt || '').trim();
    const verifiedAt = new Date(verifiedAtText);
    if (!Number.isFinite(verifiedAt.getTime())) {
        errors.push(`${componentId} release evidence verifiedAt is missing or invalid in ${normalizeRepoPath(reportPath)}.`);
        return {
            verifiedAt: verifiedAtText,
            ageHours: null,
            maxAgeHours: options.maxAgeHours,
        };
    }

    const ageMs = options.now.getTime() - verifiedAt.getTime();
    const ageHours = roundMetric(ageMs / (60 * 60 * 1000));
    if (ageMs > options.maxAgeHours * 60 * 60 * 1000) {
        errors.push(
            `${componentId} release evidence is stale (${ageHours} hours old > allowed ${options.maxAgeHours} hours). ` +
            `Run ${EVIDENCE_COMMANDS[componentId]} first.`
        );
    } else if (ageMs < -FUTURE_CLOCK_TOLERANCE_MS) {
        warnings.push(`${componentId} release evidence timestamp is in the future relative to verifier clock.`);
    }

    return {
        verifiedAt: verifiedAt.toISOString(),
        ageHours,
        maxAgeHours: options.maxAgeHours,
    };
}

function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
}

function readProfileId(profileRun) {
    return String(
        profileRun && profileRun.workloadProfile && profileRun.workloadProfile.profileId
        || profileRun && profileRun.profileId
        || ''
    ).trim();
}

function readModeId(modeRun) {
    return String(modeRun && modeRun.mode || '').trim();
}

function collectProfileRunsById(report) {
    const profileRunsById = new Map();
    normalizeArray(report && report.profileRuns).forEach((profileRun) => {
        const profileId = readProfileId(profileRun);
        if (profileId) {
            profileRunsById.set(profileId, profileRun);
        }
    });
    return profileRunsById;
}

function collectModesById(profileRun) {
    const modesById = new Map();
    normalizeArray(profileRun && profileRun.modes).forEach((modeRun) => {
        const modeId = readModeId(modeRun);
        if (modeId) {
            modesById.set(modeId, modeRun);
        }
    });
    return modesById;
}

function appendMissingModeErrors(componentId, profileId, modesById, errors) {
    REQUIRED_RUNTIME_MODES.forEach((modeId) => {
        if (!modesById.has(modeId)) {
            errors.push(`${componentId} profile ${profileId} is missing runtime mode ${modeId}.`);
        }
    });
}

function validateGateArray(componentId, profileId, modeId, gateContainer, gatePropertyName, errors) {
    if (!gateContainer || typeof gateContainer !== 'object') {
        errors.push(`${componentId} profile ${profileId} mode ${modeId} is missing ${gatePropertyName}.`);
        return {
            gateCount: 0,
            failedGateIds: [],
        };
    }
    if (gateContainer.pass !== true) {
        errors.push(`${componentId} profile ${profileId} mode ${modeId} ${gatePropertyName}.pass is not true.`);
    }
    const gates = normalizeArray(gateContainer.gates);
    if (gates.length <= 0) {
        errors.push(`${componentId} profile ${profileId} mode ${modeId} ${gatePropertyName}.gates is empty.`);
    }
    const failedGateIds = gates
        .filter((gate) => !gate || gate.passed !== true)
        .map((gate) => String(gate && gate.gateId || 'unknown'));
    if (failedGateIds.length > 0) {
        errors.push(`${componentId} profile ${profileId} mode ${modeId} failed gates: ${failedGateIds.join(', ')}.`);
    }
    return {
        gateCount: gates.length,
        failedGateIds,
    };
}

function validateQuerySamples(componentId, profileId, modeId, modeRun, errors) {
    const queryCount = Number(
        modeRun
        && modeRun.performance
        && modeRun.performance.queryDurationMs
        && modeRun.performance.queryDurationMs.count
        || 0
    );
    if (!Number.isFinite(queryCount) || queryCount <= 0) {
        errors.push(`${componentId} profile ${profileId} mode ${modeId} has no query duration samples.`);
    }
    return Math.max(0, Math.floor(Number.isFinite(queryCount) ? queryCount : 0));
}

function validateSqliteMode(profileId, modeId, modeRun, soakCycles, errors) {
    const soakSummary = modeRun && typeof modeRun.soak === 'object' ? modeRun.soak : null;
    const gateSummary = validateGateArray('sqlite', profileId, modeId, soakSummary, 'soak', errors);
    const restartCycleCount = Number(modeRun && modeRun.restartCycleCount || 0);
    if (!Number.isFinite(restartCycleCount) || restartCycleCount < soakCycles) {
        errors.push(
            `sqlite profile ${profileId} mode ${modeId} restartCycleCount (${restartCycleCount || 0}) ` +
            `is below soakCycles (${soakCycles}).`
        );
    }
    const querySampleCount = validateQuerySamples('sqlite', profileId, modeId, modeRun, errors);
    return {
        mode: modeId,
        gateCount: gateSummary.gateCount,
        failedGateIds: gateSummary.failedGateIds,
        restartCycleCount: Math.max(0, Math.floor(Number.isFinite(restartCycleCount) ? restartCycleCount : 0)),
        querySampleCount,
    };
}

function validateSqliteReleaseReport(report, errors) {
    const suiteKind = String(report && report.suiteKind || '').trim();
    if (!(suiteKind === 'soak')) {
        errors.push(`sqlite release evidence suiteKind must be soak, received: ${suiteKind || 'missing'}.`);
    }
    const soakCycles = Math.max(0, Math.floor(Number(report && report.soakCycles || 0)));
    if (soakCycles <= 0) {
        errors.push('sqlite release evidence soakCycles must be a positive integer.');
    }

    const profileRunsById = collectProfileRunsById(report);
    const profileSummaries = [];
    REQUIRED_SQLITE_PROFILES.forEach((profileId) => {
        const profileRun = profileRunsById.get(profileId);
        if (!profileRun) {
            errors.push(`sqlite release evidence is missing required profile ${profileId}.`);
            return;
        }
        const modesById = collectModesById(profileRun);
        appendMissingModeErrors('sqlite', profileId, modesById, errors);
        const modeSummaries = REQUIRED_RUNTIME_MODES
            .filter((modeId) => modesById.has(modeId))
            .map((modeId) => validateSqliteMode(profileId, modeId, modesById.get(modeId), soakCycles || 1, errors));
        profileSummaries.push({
            profileId,
            modes: modeSummaries,
        });
    });

    return {
        suiteKind,
        soakCycles,
        requiredProfiles: [...REQUIRED_SQLITE_PROFILES],
        profileRuns: profileSummaries,
    };
}

function readExpectedRecall(modeRun) {
    const releaseGates = modeRun && modeRun.releaseGates && typeof modeRun.releaseGates === 'object'
        ? modeRun.releaseGates
        : {};
    if (releaseGates.expectedRecall && typeof releaseGates.expectedRecall === 'object') {
        return releaseGates.expectedRecall;
    }
    if (modeRun && modeRun.expectedRecall && typeof modeRun.expectedRecall === 'object') {
        return modeRun.expectedRecall;
    }
    return {};
}

function validateExpectedRecall(profileId, modeId, modeRun, minExpectedRecall, errors) {
    const expectedRecall = readExpectedRecall(modeRun);
    const expectedQueryCount = Math.max(0, Math.floor(Number(expectedRecall.expectedQueryCount || 0)));
    const matchedQueryCount = Math.max(0, Math.floor(Number(expectedRecall.matchedQueryCount || 0)));
    const ratio = Number(expectedRecall.ratio || 0);
    if (expectedQueryCount <= 0) {
        errors.push(`ann profile ${profileId} mode ${modeId} expectedRecall.expectedQueryCount must be positive.`);
    }
    if (!Number.isFinite(ratio) || ratio < minExpectedRecall) {
        errors.push(
            `ann profile ${profileId} mode ${modeId} expectedRecall ratio (${Number.isFinite(ratio) ? ratio : 0}) ` +
            `is below required ${minExpectedRecall}.`
        );
    }
    return {
        expectedQueryCount,
        matchedQueryCount,
        ratio: roundMetric(Number.isFinite(ratio) ? ratio : 0),
    };
}

function validateAnnMode(profileId, modeId, modeRun, minExpectedRecall, errors) {
    const releaseGates = modeRun && typeof modeRun.releaseGates === 'object' ? modeRun.releaseGates : null;
    const gateSummary = validateGateArray('ann', profileId, modeId, releaseGates, 'releaseGates', errors);
    const expectedRecall = validateExpectedRecall(profileId, modeId, modeRun, minExpectedRecall, errors);
    const querySampleCount = validateQuerySamples('ann', profileId, modeId, modeRun, errors);
    return {
        mode: modeId,
        gateCount: gateSummary.gateCount,
        failedGateIds: gateSummary.failedGateIds,
        expectedRecall,
        querySampleCount,
    };
}

function validateAnnReleaseReport(report, errors) {
    const suiteKind = String(report && report.suiteKind || '').trim();
    if (!(suiteKind === 'matrix')) {
        errors.push(`ann release evidence suiteKind must be matrix, received: ${suiteKind || 'missing'}.`);
    }
    if (!report || report.releaseGatesEnabled !== true) {
        errors.push('ann release evidence releaseGatesEnabled must be true.');
    }
    const releaseThresholds = report && report.releaseThresholds && typeof report.releaseThresholds === 'object'
        ? report.releaseThresholds
        : {};
    const minExpectedRecall = Number.isFinite(Number(releaseThresholds.minExpectedRecall))
        ? Number(releaseThresholds.minExpectedRecall)
        : 1;

    const profileRunsById = collectProfileRunsById(report);
    const profileSummaries = [];
    REQUIRED_ANN_PROFILES.forEach((profileId) => {
        const profileRun = profileRunsById.get(profileId);
        if (!profileRun) {
            errors.push(`ann release evidence is missing required profile ${profileId}.`);
            return;
        }
        const modesById = collectModesById(profileRun);
        appendMissingModeErrors('ann', profileId, modesById, errors);
        const modeSummaries = REQUIRED_RUNTIME_MODES
            .filter((modeId) => modesById.has(modeId))
            .map((modeId) => validateAnnMode(profileId, modeId, modesById.get(modeId), minExpectedRecall, errors));
        profileSummaries.push({
            profileId,
            modes: modeSummaries,
        });
    });

    return {
        suiteKind,
        releaseGatesEnabled: Boolean(report && report.releaseGatesEnabled),
        minExpectedRecall,
        requiredProfiles: [...REQUIRED_ANN_PROFILES],
        profileRuns: profileSummaries,
    };
}

function resolveVerifierOptions(options = {}) {
    const now = options.now instanceof Date && Number.isFinite(options.now.getTime())
        ? options.now
        : new Date();
    const maxAgeHours = Number.isFinite(Number(options.maxAgeHours))
        ? parseBoundedInteger(options.maxAgeHours, MAX_AGE_HOURS_RANGE)
        : parseBoundedInteger(
            process.env.NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MAX_AGE_HOURS,
            MAX_AGE_HOURS_RANGE
        );
    return {
        now,
        maxAgeHours,
        sqliteReportPath: resolveReportPath(
            options.sqliteReportPath,
            'NOTE_CONNECTION_FOUNDATION_SQLITE_RELEASE_REPORT_PATH',
            SQLITE_LATEST_REPORT_PATH
        ),
        annReportPath: resolveReportPath(
            options.annReportPath,
            'NOTE_CONNECTION_FOUNDATION_ANN_RELEASE_REPORT_PATH',
            ANN_LATEST_REPORT_PATH
        ),
    };
}

function verifyFoundationReleaseEvidence(options = {}) {
    const resolvedOptions = resolveVerifierOptions(options);
    const errors = [];
    const warnings = [];
    const sqliteReport = readJsonReport(resolvedOptions.sqliteReportPath, 'sqlite', errors);
    const annReport = readJsonReport(resolvedOptions.annReportPath, 'ann', errors);
    const checkedAt = resolvedOptions.now.toISOString();

    const sqliteFreshness = sqliteReport
        ? validateFreshnessWindow(
            'sqlite',
            sqliteReport,
            resolvedOptions.sqliteReportPath,
            resolvedOptions,
            errors,
            warnings
        )
        : {
            verifiedAt: '',
            ageHours: null,
            maxAgeHours: resolvedOptions.maxAgeHours,
        };
    const annFreshness = annReport
        ? validateFreshnessWindow(
            'ann',
            annReport,
            resolvedOptions.annReportPath,
            resolvedOptions,
            errors,
            warnings
        )
        : {
            verifiedAt: '',
            ageHours: null,
            maxAgeHours: resolvedOptions.maxAgeHours,
        };

    const sqliteSummary = sqliteReport ? validateSqliteReleaseReport(sqliteReport, errors) : {
        suiteKind: '',
        soakCycles: 0,
        requiredProfiles: [...REQUIRED_SQLITE_PROFILES],
        profileRuns: [],
    };
    const annSummary = annReport ? validateAnnReleaseReport(annReport, errors) : {
        suiteKind: '',
        releaseGatesEnabled: false,
        minExpectedRecall: 1,
        requiredProfiles: [...REQUIRED_ANN_PROFILES],
        profileRuns: [],
    };

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        summary: {
            checkedAt,
            maxAgeHours: resolvedOptions.maxAgeHours,
            sqlite: {
                reportPath: normalizeRepoPath(resolvedOptions.sqliteReportPath),
                evidenceCommand: EVIDENCE_COMMANDS.sqlite,
                ...sqliteFreshness,
                ...sqliteSummary,
            },
            ann: {
                reportPath: normalizeRepoPath(resolvedOptions.annReportPath),
                evidenceCommand: EVIDENCE_COMMANDS.ann,
                ...annFreshness,
                ...annSummary,
            },
        },
    };
}

function writeFoundationReleaseEvidenceReport(verification) {
    ensureDir(OUTPUT_ROOT);
    const checkedAt = verification && verification.summary && verification.summary.checkedAt
        ? verification.summary.checkedAt
        : new Date().toISOString();
    const latestPath = path.join(OUTPUT_ROOT, LATEST_REPORT_FILENAME);
    const datedPath = path.join(OUTPUT_ROOT, `foundation-release-evidence-report-${toFilenameTimestamp(checkedAt)}.json`);
    const report = {
        ...verification.summary,
        ok: verification.ok,
        errors: verification.errors,
        warnings: verification.warnings,
    };
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    fs.writeFileSync(latestPath, serialized, 'utf8');
    fs.writeFileSync(datedPath, serialized, 'utf8');
    return {
        latestPath,
        datedPath,
    };
}

function printVerification(verification, reportPaths = null) {
    const prefix = '[foundation-release-evidence]';
    if (verification.ok) {
        console.log(`${prefix} PASS`);
        console.log(`${prefix} sqlite: ${verification.summary.sqlite.reportPath}`);
        console.log(`${prefix} ann: ${verification.summary.ann.reportPath}`);
        if (reportPaths) {
            console.log(`${prefix} Report written: ${normalizeRepoPath(reportPaths.latestPath)}`);
        }
    } else {
        console.error(`${prefix} FAIL`);
    }
    verification.warnings.forEach((warning) => {
        console.warn(`${prefix} Warning: ${warning}`);
    });
    verification.errors.forEach((error) => {
        console.error(`${prefix} Error: ${error}`);
    });
}

function main() {
    const verification = verifyFoundationReleaseEvidence(parseCliOptions(process.argv.slice(2)));
    const reportPaths = verification.ok ? writeFoundationReleaseEvidenceReport(verification) : null;
    printVerification(verification, reportPaths);
    if (!verification.ok) {
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    MAX_AGE_HOURS_RANGE,
    ANN_LATEST_REPORT_PATH,
    SQLITE_LATEST_REPORT_PATH,
    parseBoundedInteger,
    validateAnnReleaseReport,
    validateSqliteReleaseReport,
    verifyFoundationReleaseEvidence,
    writeFoundationReleaseEvidenceReport,
};
