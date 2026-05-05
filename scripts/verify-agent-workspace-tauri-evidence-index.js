const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const EVIDENCE_INDEX_SCHEMA_PATH = path.join(
    REPO_ROOT,
    'schemas',
    'agent-workspace-tauri-evidence-index.schema.json'
);

function readEvidenceIndexSchemaDocument(schemaPath = EVIDENCE_INDEX_SCHEMA_PATH) {
    if (!fs.existsSync(schemaPath)) {
        throw new Error(
            `[agent-workspace-tauri-evidence-index] Missing schema file: ${schemaPath}`
        );
    }

    try {
        return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    } catch (error) {
        throw new Error(
            `[agent-workspace-tauri-evidence-index] Failed to parse schema file (${schemaPath}): ${error.message}`
        );
    }
}

function resolveEvidenceIndexSchemaIdentity(schemaDocument) {
    const schemaValue = schemaDocument
        && schemaDocument.properties
        && schemaDocument.properties.schema
        && schemaDocument.properties.schema.const;
    const versionValue = schemaDocument
        && schemaDocument.properties
        && schemaDocument.properties.version
        && schemaDocument.properties.version.const;

    if (typeof schemaValue !== 'string' || schemaValue.length === 0) {
        throw new Error(
            '[agent-workspace-tauri-evidence-index] Schema contract must define properties.schema.const as a non-empty string.'
        );
    }

    if (!Number.isInteger(versionValue) || versionValue < 1) {
        throw new Error(
            '[agent-workspace-tauri-evidence-index] Schema contract must define properties.version.const as a positive integer.'
        );
    }

    return {
        schema: schemaValue,
        version: versionValue,
    };
}

const EVIDENCE_INDEX_SCHEMA_DOCUMENT = readEvidenceIndexSchemaDocument();
const EVIDENCE_INDEX_SCHEMA_IDENTITY = resolveEvidenceIndexSchemaIdentity(
    EVIDENCE_INDEX_SCHEMA_DOCUMENT
);
const EVIDENCE_INDEX_SCHEMA = EVIDENCE_INDEX_SCHEMA_IDENTITY.schema;
const EVIDENCE_INDEX_VERSION = EVIDENCE_INDEX_SCHEMA_IDENTITY.version;

function toFilenameTimestamp(isoText) {
    return String(isoText || '').replace(/[:.]/g, '-');
}

function ensureArtifactDir() {
    const artifactDir = path.join(REPO_ROOT, 'output', 'tauri', 'agent-workspace-evidence-index');
    fs.mkdirSync(artifactDir, { recursive: true });
    return artifactDir;
}

function readLatestReport(reportDir) {
    const latestReportPath = path.join(reportDir, 'report-latest.json');
    if (fs.existsSync(latestReportPath)) {
        return {
            found: true,
            reportPath: latestReportPath,
            report: JSON.parse(fs.readFileSync(latestReportPath, 'utf8')),
            source: 'report-latest',
        };
    }

    if (!fs.existsSync(reportDir)) {
        return {
            found: false,
            reportPath: null,
            report: null,
            source: 'missing-dir',
        };
    }

    const reportFiles = fs.readdirSync(reportDir)
        .filter((fileName) => /^report-.*\.json$/i.test(fileName))
        .filter((fileName) => fileName !== 'report-latest.json')
        .map((fileName) => {
            const absolutePath = path.join(reportDir, fileName);
            const stat = fs.statSync(absolutePath);
            return {
                fileName,
                absolutePath,
                modifiedAtMs: stat.mtimeMs,
            };
        })
        .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs);

    if (reportFiles.length === 0) {
        return {
            found: false,
            reportPath: null,
            report: null,
            source: 'missing-report',
        };
    }

    const selected = reportFiles[0];
    return {
        found: true,
        reportPath: selected.absolutePath,
        report: JSON.parse(fs.readFileSync(selected.absolutePath, 'utf8')),
        source: 'latest-by-mtime',
    };
}

function normalizeRustReport(raw) {
    if (!raw || raw.found !== true) {
        return {
            found: false,
            reportPath: raw ? raw.reportPath : null,
            source: raw ? raw.source : 'missing',
            passed: false,
            skipped: false,
            strictSystemDeps: false,
            summary: null,
        };
    }

    const report = raw.report || {};
    const summary = report.summary || {};
    return {
        found: true,
        reportPath: raw.reportPath,
        source: raw.source,
        passed: summary.passed === true,
        skipped: report.skipped === true,
        strictSystemDeps: report.strictSystemDeps === true,
        summary,
    };
}

function normalizeWindowReport(raw) {
    if (!raw || raw.found !== true) {
        return {
            found: false,
            reportPath: raw ? raw.reportPath : null,
            source: raw ? raw.source : 'missing',
            passed: false,
            status: 'missing',
            strictWindowEvidence: false,
            summary: null,
        };
    }

    const report = raw.report || {};
    const summary = report.summary || {};
    const status = String(summary.status || 'unknown');
    return {
        found: true,
        reportPath: raw.reportPath,
        source: raw.source,
        passed: summary.passed === true,
        status,
        strictWindowEvidence: report.strictWindowEvidence === true,
        summary,
    };
}

function normalizeSmokeReport(raw) {
    if (!raw || raw.found !== true) {
        return {
            found: false,
            reportPath: raw ? raw.reportPath : null,
            source: raw ? raw.source : 'missing',
            passed: false,
            lifecyclePassed: false,
        };
    }

    const report = raw.report || {};
    const lifecycleChecks = report.lifecycleChecks || {};
    return {
        found: true,
        reportPath: raw.reportPath,
        source: raw.source,
        passed: lifecycleChecks.passed === true,
        lifecyclePassed: lifecycleChecks.passed === true,
    };
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function schemaTypeMatches(value, expectedType) {
    switch (expectedType) {
    case 'null':
        return value === null;
    case 'array':
        return Array.isArray(value);
    case 'object':
        return isPlainObject(value);
    case 'string':
        return typeof value === 'string';
    case 'number':
        return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
        return Number.isInteger(value);
    case 'boolean':
        return typeof value === 'boolean';
    default:
        return false;
    }
}

function describeValueType(value) {
    if (value === null) {
        return 'null';
    }
    if (Array.isArray(value)) {
        return 'array';
    }
    return typeof value;
}

function jsonValuesEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function validateJsonAgainstSchema(value, schema, location = '$', errors = []) {
    if (!isPlainObject(schema)) {
        return errors;
    }

    const expectedTypes = Array.isArray(schema.type)
        ? schema.type
        : (typeof schema.type === 'string' ? [schema.type] : []);

    if (expectedTypes.length > 0) {
        const typeMatched = expectedTypes.some((expectedType) => schemaTypeMatches(value, expectedType));
        if (!typeMatched) {
            errors.push(
                `${location}: expected type ${expectedTypes.join('|')}, got ${describeValueType(value)}`
            );
            return errors;
        }
    }

    if (Object.prototype.hasOwnProperty.call(schema, 'const')) {
        if (!jsonValuesEqual(value, schema.const)) {
            errors.push(`${location}: expected const ${JSON.stringify(schema.const)}`);
            return errors;
        }
    }

    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
        const enumMatched = schema.enum.some((candidate) => jsonValuesEqual(candidate, value));
        if (!enumMatched) {
            errors.push(`${location}: value is not in enum ${JSON.stringify(schema.enum)}`);
        }
    }

    if (typeof value === 'string') {
        if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
            errors.push(`${location}: string length ${value.length} < minLength ${schema.minLength}`);
        }
        if (typeof schema.pattern === 'string') {
            const pattern = new RegExp(schema.pattern);
            if (!pattern.test(value)) {
                errors.push(`${location}: string does not match pattern ${schema.pattern}`);
            }
        }
    }

    if (Array.isArray(value)) {
        if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
            errors.push(`${location}: array length ${value.length} < minItems ${schema.minItems}`);
        }
        if (schema.items) {
            value.forEach((item, index) => {
                validateJsonAgainstSchema(item, schema.items, `${location}[${index}]`, errors);
            });
        }
    }

    if (isPlainObject(value)) {
        const required = Array.isArray(schema.required) ? schema.required : [];
        required.forEach((propertyName) => {
            if (!Object.prototype.hasOwnProperty.call(value, propertyName)) {
                errors.push(`${location}: missing required property "${propertyName}"`);
            }
        });

        const properties = isPlainObject(schema.properties) ? schema.properties : {};
        const additionalProperties = schema.additionalProperties;

        if (additionalProperties === false) {
            Object.keys(value).forEach((propertyName) => {
                if (!Object.prototype.hasOwnProperty.call(properties, propertyName)) {
                    errors.push(`${location}: unsupported property "${propertyName}"`);
                }
            });
        }

        Object.keys(properties).forEach((propertyName) => {
            if (!Object.prototype.hasOwnProperty.call(value, propertyName)) {
                return;
            }
            validateJsonAgainstSchema(
                value[propertyName],
                properties[propertyName],
                `${location}.${propertyName}`,
                errors
            );
        });
    }

    return errors;
}

function validateEvidenceIndexReport(report, schemaDocument = EVIDENCE_INDEX_SCHEMA_DOCUMENT) {
    const errors = validateJsonAgainstSchema(report, schemaDocument, '$', []);
    if (errors.length > 0) {
        const maxRenderedErrors = 12;
        const renderedErrors = errors.slice(0, maxRenderedErrors).join('; ');
        const suffix = errors.length > maxRenderedErrors
            ? `; ... (+${errors.length - maxRenderedErrors} more)`
            : '';
        throw new Error(
            `[agent-workspace-tauri-evidence-index] Evidence index schema validation failed: ${renderedErrors}${suffix}`
        );
    }
}

function verifyAgentWorkspaceTauriEvidenceIndex(options = {}) {
    const generatedAt = new Date().toISOString();
    const fileTimestamp = toFilenameTimestamp(generatedAt);
    const artifactDir = ensureArtifactDir();
    const indexPath = path.join(artifactDir, `evidence-index-${fileTimestamp}.json`);
    const latestIndexPath = path.join(artifactDir, 'evidence-index-latest.json');
    const strict = options.strict === true;

    const rustRaw = readLatestReport(path.join(REPO_ROOT, 'output', 'tauri', 'agent-workspace-rust-tests'));
    const windowRaw = readLatestReport(path.join(REPO_ROOT, 'output', 'tauri', 'agent-workspace-window-evidence'));
    const smokeRaw = readLatestReport(path.join(REPO_ROOT, 'output', 'tauri', 'agent-workspace-smoke'));

    const rust = normalizeRustReport(rustRaw);
    const windowEvidence = normalizeWindowReport(windowRaw);
    const smoke = normalizeSmokeReport(smokeRaw);

    const missing = [];
    const reasons = [];

    if (!rust.found) {
        missing.push('rust-report');
    }
    if (!windowEvidence.found) {
        missing.push('window-evidence-report');
    }
    if (!smoke.found) {
        missing.push('proxy-smoke-report');
    }

    if (strict) {
        if (!rust.found || rust.passed !== true) {
            reasons.push('rust-strict-report-not-passed');
        }
        if (rust.strictSystemDeps !== true) {
            reasons.push('rust-strict-system-deps-flag-missing');
        }
        if (rust.skipped) {
            reasons.push('rust-strict-report-skipped');
        }
        if (!windowEvidence.found || windowEvidence.passed !== true || windowEvidence.status !== 'passed') {
            reasons.push('window-evidence-strict-report-not-passed');
        }
        if (windowEvidence.strictWindowEvidence !== true) {
            reasons.push('window-evidence-strict-flag-missing');
        }
        if (!smoke.found || smoke.passed !== true) {
            reasons.push('proxy-smoke-report-not-passed');
        }
    }

    const summary = {
        status: strict && reasons.length > 0 ? 'failed' : 'passed',
        passed: !(strict && reasons.length > 0),
        missing,
        reasons,
    };

    const report = {
        generatedAt,
        schema: EVIDENCE_INDEX_SCHEMA,
        version: EVIDENCE_INDEX_VERSION,
        evidenceSetId: `${process.env.GITHUB_RUN_ID || 'local'}-${fileTimestamp}`,
        strict,
        artifacts: {
            artifactDir,
            indexPath,
            latestIndexPath,
        },
        ci: {
            runId: process.env.GITHUB_RUN_ID || null,
            runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
            workflow: process.env.GITHUB_WORKFLOW || null,
            job: process.env.GITHUB_JOB || null,
            sha: process.env.GITHUB_SHA || null,
            ref: process.env.GITHUB_REF || null,
            eventName: process.env.GITHUB_EVENT_NAME || null,
        },
        reports: {
            rust,
            windowEvidence,
            proxySmoke: smoke,
        },
        summary,
    };

    validateEvidenceIndexReport(report, EVIDENCE_INDEX_SCHEMA_DOCUMENT);

    fs.writeFileSync(indexPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(latestIndexPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    if (strict && summary.passed !== true) {
        throw new Error(
            '[agent-workspace-tauri-evidence-index] Strict evidence index validation failed: ' +
            summary.reasons.join(', ')
        );
    }

    return report;
}

function main() {
    const strict = process.argv.includes('--strict');
    try {
        const report = verifyAgentWorkspaceTauriEvidenceIndex({
            strict,
        });
        console.log('[agent-workspace-tauri-evidence-index] PASS', JSON.stringify(report, null, 2));
    } catch (error) {
        console.error('[agent-workspace-tauri-evidence-index] FAIL', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    verifyAgentWorkspaceTauriEvidenceIndex,
    readLatestReport,
    readEvidenceIndexSchemaDocument,
    validateEvidenceIndexReport,
    EVIDENCE_INDEX_SCHEMA_PATH,
    EVIDENCE_INDEX_SCHEMA,
    EVIDENCE_INDEX_VERSION,
};
