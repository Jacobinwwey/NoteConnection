const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_INDEX_PATH = path.join(
    REPO_ROOT,
    'output',
    'tauri',
    'agent-workspace-evidence-index',
    'evidence-index-latest.json'
);
const DEFAULT_OUTPUT_DIR = path.dirname(DEFAULT_INDEX_PATH);
const MANIFEST_SCHEMA_PATH = path.join(
    REPO_ROOT,
    'schemas',
    'agent-workspace-tauri-evidence-manifest.schema.json'
);
const REQUIRED_ARTIFACT_IDS = [
    'evidence-index',
    'evidence-summary',
    'release-fragment',
    'rust-report',
    'window-evidence-report',
    'proxy-smoke-report',
];

function readManifestSchemaDocument(schemaPath = MANIFEST_SCHEMA_PATH) {
    if (!fs.existsSync(schemaPath)) {
        throw new Error(
            `[agent-workspace-tauri-evidence-manifest] Missing schema file: ${schemaPath}`
        );
    }

    try {
        return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    } catch (error) {
        throw new Error(
            `[agent-workspace-tauri-evidence-manifest] Failed to parse schema file (${schemaPath}): ${error.message}`
        );
    }
}

function resolveManifestSchemaIdentity(schemaDocument) {
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
            '[agent-workspace-tauri-evidence-manifest] Schema contract must define properties.schema.const as a non-empty string.'
        );
    }

    if (!Number.isInteger(versionValue) || versionValue < 1) {
        throw new Error(
            '[agent-workspace-tauri-evidence-manifest] Schema contract must define properties.version.const as a positive integer.'
        );
    }

    return {
        schema: schemaValue,
        version: versionValue,
    };
}

const MANIFEST_SCHEMA_DOCUMENT = readManifestSchemaDocument();
const MANIFEST_SCHEMA_IDENTITY = resolveManifestSchemaIdentity(MANIFEST_SCHEMA_DOCUMENT);
const MANIFEST_SCHEMA = MANIFEST_SCHEMA_IDENTITY.schema;
const MANIFEST_VERSION = MANIFEST_SCHEMA_IDENTITY.version;

function parseArgs(argv) {
    const options = {
        indexPath: DEFAULT_INDEX_PATH,
        outputDir: DEFAULT_OUTPUT_DIR,
        strict: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--index' && argv[index + 1]) {
            options.indexPath = path.resolve(REPO_ROOT, argv[index + 1]);
            index += 1;
            continue;
        }
        if (arg === '--output-dir' && argv[index + 1]) {
            options.outputDir = path.resolve(REPO_ROOT, argv[index + 1]);
            index += 1;
            continue;
        }
        if (arg === '--strict') {
            options.strict = true;
        }
    }

    return options;
}

function toFilenameTimestamp(isoText) {
    return String(isoText || '').replace(/[:.]/g, '-');
}

function tryComputeSha256(filePath) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        return {
            exists: false,
            sizeBytes: null,
            sha256: null,
        };
    }

    const content = fs.readFileSync(absolutePath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return {
        exists: true,
        sizeBytes: content.length,
        sha256: hash,
    };
}

function buildArtifactRecord(id, targetPath) {
    const resolvedPath = targetPath ? path.resolve(targetPath) : '';
    const digest = resolvedPath ? tryComputeSha256(resolvedPath) : {
        exists: false,
        sizeBytes: null,
        sha256: null,
    };
    return {
        id,
        path: resolvedPath || null,
        exists: digest.exists,
        sizeBytes: digest.sizeBytes,
        sha256: digest.sha256,
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

function validateManifestReport(report, schemaDocument = MANIFEST_SCHEMA_DOCUMENT) {
    const errors = validateJsonAgainstSchema(report, schemaDocument, '$', []);
    if (errors.length > 0) {
        const maxRenderedErrors = 12;
        const renderedErrors = errors.slice(0, maxRenderedErrors).join('; ');
        const suffix = errors.length > maxRenderedErrors
            ? `; ... (+${errors.length - maxRenderedErrors} more)`
            : '';
        throw new Error(
            `[agent-workspace-tauri-evidence-manifest] Manifest schema validation failed: ${renderedErrors}${suffix}`
        );
    }
}

function collectStrictValidationReasons(manifest, indexReport) {
    const reasons = [];

    if (!isPlainObject(indexReport)) {
        reasons.push('source-index-invalid');
        return reasons;
    }

    if (indexReport.strict !== true) {
        reasons.push('source-index-not-strict');
    }
    if (!indexReport.summary || indexReport.summary.passed !== true) {
        reasons.push('source-index-summary-not-passed');
    }

    const ids = manifest.artifacts.map((artifact) => artifact.id);
    const idSet = new Set(ids);
    if (idSet.size !== ids.length) {
        reasons.push('duplicate-artifact-ids');
    }

    REQUIRED_ARTIFACT_IDS.forEach((artifactId) => {
        if (!idSet.has(artifactId)) {
            reasons.push(`missing-artifact-slot:${artifactId}`);
        }
    });

    manifest.artifacts.forEach((artifact) => {
        if (artifact.exists !== true) {
            reasons.push(`missing-artifact:${artifact.id}`);
            return;
        }
        if (typeof artifact.path !== 'string' || artifact.path.length === 0) {
            reasons.push(`artifact-path-invalid:${artifact.id}`);
        }
        if (!Number.isInteger(artifact.sizeBytes) || artifact.sizeBytes < 0) {
            reasons.push(`artifact-size-invalid:${artifact.id}`);
        }
        if (typeof artifact.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
            reasons.push(`artifact-sha256-invalid:${artifact.id}`);
        }
    });

    return Array.from(new Set(reasons));
}

function renderAgentWorkspaceTauriEvidenceManifest(options = {}) {
    const indexPath = options.indexPath || DEFAULT_INDEX_PATH;
    const outputDir = options.outputDir || DEFAULT_OUTPUT_DIR;
    const strict = options.strict === true;
    if (!fs.existsSync(indexPath)) {
        throw new Error(`[agent-workspace-tauri-evidence-manifest] Missing evidence index: ${indexPath}`);
    }

    const generatedAt = new Date().toISOString();
    const fileTimestamp = toFilenameTimestamp(generatedAt);
    const indexReport = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const reports = indexReport.reports || {};
    const outputDirectory = path.resolve(outputDir);
    const manifestPath = path.join(outputDirectory, `evidence-manifest-${fileTimestamp}.json`);
    const latestManifestPath = path.join(outputDirectory, 'evidence-manifest-latest.json');

    const summaryPath = path.join(path.dirname(indexPath), 'evidence-summary-latest.md');
    const releaseFragmentPath = path.join(path.dirname(indexPath), 'release-fragment-latest.md');

    const artifacts = [
        buildArtifactRecord('evidence-index', indexPath),
        buildArtifactRecord('evidence-summary', summaryPath),
        buildArtifactRecord('release-fragment', releaseFragmentPath),
        buildArtifactRecord('rust-report', reports.rust ? reports.rust.reportPath : null),
        buildArtifactRecord(
            'window-evidence-report',
            reports.windowEvidence ? reports.windowEvidence.reportPath : null
        ),
        buildArtifactRecord('proxy-smoke-report', reports.proxySmoke ? reports.proxySmoke.reportPath : null),
    ];

    const presentArtifactCount = artifacts.filter((artifact) => artifact.exists).length;
    const missingArtifactCount = artifacts.length - presentArtifactCount;

    const manifest = {
        generatedAt,
        schema: MANIFEST_SCHEMA,
        version: MANIFEST_VERSION,
        evidenceSetId: indexReport.evidenceSetId || `${process.env.GITHUB_RUN_ID || 'local'}-${fileTimestamp}`,
        strict: indexReport.strict === true,
        sourceIndexPath: path.resolve(indexPath),
        artifacts,
        summary: {
            totalArtifactCount: artifacts.length,
            presentArtifactCount,
            missingArtifactCount,
        },
        strictValidation: {
            passed: true,
            reasons: [],
        },
    };

    const strictValidationReasons = collectStrictValidationReasons(manifest, indexReport);
    manifest.strictValidation = {
        passed: strictValidationReasons.length === 0,
        reasons: strictValidationReasons,
    };

    validateManifestReport(manifest, MANIFEST_SCHEMA_DOCUMENT);

    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(latestManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    if (strict && manifest.strictValidation.passed !== true) {
        throw new Error(
            '[agent-workspace-tauri-evidence-manifest] Strict manifest validation failed: ' +
            manifest.strictValidation.reasons.join(', ')
        );
    }

    return {
        manifestPath,
        latestManifestPath,
        manifest,
    };
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    try {
        const result = renderAgentWorkspaceTauriEvidenceManifest(options);
        console.log('[agent-workspace-tauri-evidence-manifest] PASS', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('[agent-workspace-tauri-evidence-manifest] FAIL', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    renderAgentWorkspaceTauriEvidenceManifest,
    readManifestSchemaDocument,
    validateManifestReport,
    MANIFEST_SCHEMA_PATH,
    MANIFEST_SCHEMA,
    MANIFEST_VERSION,
};
