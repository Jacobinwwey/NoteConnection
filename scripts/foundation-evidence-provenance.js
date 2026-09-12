const fs = require('fs');
const path = require('path');
const os = require('os');
const { createHash, randomUUID } = require('crypto');
const { spawnSync } = require('child_process');
const { computeSidecarInputFingerprint, computeSidecarSourceFingerprint, isSidecarBuildManifestCurrent, sha256File } = require('./sidecar-build-fingerprint');

function foundationWorkloadHash(report) {
    const profiles = (report.profileRuns || []).map(run => run.workloadProfile).sort((a, b) => a.profileId.localeCompare(b.profileId));
    return createHash('sha256').update(JSON.stringify({
        suiteKind: report.suiteKind,
        soakCycles: report.soakCycles,
        releaseGatesEnabled: report.releaseGatesEnabled,
        releaseThresholds: report.releaseThresholds,
        profiles,
    })).digest('hex');
}

function readFoundationRuntimeIdentity(repoRoot, sidecarPath) {
    const inputs = computeSidecarInputFingerprint(repoRoot);
    return {
        sourceTreeHash: computeSidecarSourceFingerprint(repoRoot).digest,
        artifacts: {
            dist_node_runtime: {
                kind: 'sidecar_inputs', path: 'dist/src', sha256: inputs.digest,
                sizeBytes: inputs.files.reduce((sum, file) => sum + file.size, 0),
            },
            packaged_sidecar: {
                kind: 'file', path: path.relative(repoRoot, sidecarPath).replace(/\\/g, '/'),
                sha256: sha256File(sidecarPath), sizeBytes: fs.statSync(sidecarPath).size,
            },
        },
    };
}

/** Qualify one immutable input set; editing source or artifacts during a run invalidates it. */
async function qualifyFoundationRun({ repoRoot, sidecarPath }, run) {
    if (!isSidecarBuildManifestCurrent(repoRoot)) throw new Error('Foundation evidence requires a sidecar built from current source and dist inputs.');
    const sourceRevision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8', windowsHide: true });
    if (sourceRevision.status !== 0 || !/^[a-f0-9]{40,64}$/i.test(sourceRevision.stdout.trim())) throw new Error('Cannot bind foundation evidence to a source revision.');
    const before = readFoundationRuntimeIdentity(repoRoot, sidecarPath);
    const report = await run();
    const after = readFoundationRuntimeIdentity(repoRoot, sidecarPath);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Foundation evidence inputs changed during verification.');
    return {
        ...report,
        host: {
            ...report.host, nodeVersion: process.version,
            evidenceHostId: createHash('sha256').update(`${os.hostname()}\0${process.platform}\0${process.arch}`).digest('hex').slice(0, 24),
        },
        provenance: {
            schemaVersion: 1, runId: randomUUID(), sourceRevision: sourceRevision.stdout.trim(),
            ...before, workloadHash: foundationWorkloadHash(report),
        },
    };
}

function validateFoundationProvenance(component, report, options, errors) {
    const provenance = report && report.provenance;
    if (!provenance || provenance.schemaVersion !== 1) {
        errors.push(`${component} release evidence is missing source/artifact provenance.`);
        return;
    }
    if (typeof provenance.runId !== 'string' || !provenance.runId.trim()) errors.push(`${component} provenance runId is missing.`);
    if (!/^[a-f0-9]{40,64}$/i.test(provenance.sourceRevision || '')) errors.push(`${component} provenance sourceRevision is invalid.`);
    if (provenance.sourceTreeHash !== options.sourceTreeHash) errors.push(`${component} release evidence belongs to different source inputs.`);
    if (provenance.workloadHash !== foundationWorkloadHash(report)) errors.push(`${component} workload binding does not match the report.`);
    if (!report.host?.evidenceHostId || !report.host?.platform || !report.host?.arch || !report.host?.nodeVersion) errors.push(`${component} host/runtime identity is incomplete.`);
    for (const mode of ['dist_node_runtime', 'packaged_sidecar']) {
        const artifact = provenance.artifacts && provenance.artifacts[mode];
        if (!artifact || !/^[a-f0-9]{64}$/.test(artifact.sha256 || '') || !(artifact.sizeBytes > 0)) {
            errors.push(`${component} ${mode} artifact identity is missing or invalid.`);
            continue;
        }
        try {
            if (mode === 'dist_node_runtime' && (artifact.kind !== 'sidecar_inputs' || artifact.path !== 'dist/src')) throw new Error('Unexpected dist artifact contract');
            if (mode === 'packaged_sidecar' && artifact.kind !== 'file') throw new Error('Expected a sidecar binary');
            const candidate = path.resolve(options.artifactRoot, artifact.path || '');
            const relative = path.relative(options.artifactRoot, fs.realpathSync(candidate));
            if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Artifact path escapes the selected artifact root');
            const key = `${mode}\0${candidate}`;
            if (!options.artifactIdentities.has(key)) {
                if (mode === 'dist_node_runtime') {
                    if (artifact.kind !== 'sidecar_inputs' || artifact.path !== 'dist/src') throw new Error('Unexpected dist artifact contract');
                    const inputs = computeSidecarInputFingerprint(options.artifactRoot);
                    options.artifactIdentities.set(key, { sha256: inputs.digest, sizeBytes: inputs.files.reduce((sum, file) => sum + file.size, 0) });
                } else {
                    if (artifact.kind !== 'file' || !fs.statSync(candidate).isFile()) throw new Error('Expected a sidecar binary');
                    options.artifactIdentities.set(key, { sha256: sha256File(candidate), sizeBytes: fs.statSync(candidate).size });
                }
            }
            const actual = options.artifactIdentities.get(key);
            if (actual.sha256 !== artifact.sha256 || actual.sizeBytes !== artifact.sizeBytes) throw new Error('Artifact bytes differ from the qualified artifact');
        } catch (error) { errors.push(`${component} ${mode} artifact binding failed: ${error.message}`); }
    }
}

module.exports = { foundationWorkloadHash, readFoundationRuntimeIdentity, qualifyFoundationRun, validateFoundationProvenance };
