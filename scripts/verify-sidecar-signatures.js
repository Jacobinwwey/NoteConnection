#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const defaultArtifactRoot = path.join(repoRoot, 'src-tauri', 'bin');

function parseBoolean(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseOptions(argv) {
  const options = {
    artifactRoot: defaultArtifactRoot,
    requireSigned: parseBoolean(process.env.NOTE_CONNECTION_REQUIRE_SIGNED_SIDECAR),
    contractOnly: false,
    allowEmpty: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = String(argv[index] || '').trim();
    if (!arg) {
      continue;
    }

    if (arg === '--contract-only') {
      options.contractOnly = true;
      continue;
    }
    if (arg === '--allow-empty') {
      options.allowEmpty = true;
      continue;
    }
    if (arg === '--require-signed' && index + 1 < argv.length) {
      options.requireSigned = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--artifact-root' && index + 1 < argv.length) {
      options.artifactRoot = path.resolve(repoRoot, String(argv[index + 1]));
      index += 1;
      continue;
    }
  }

  return options;
}

function findSidecarArtifacts(artifactRoot) {
  if (!fs.existsSync(artifactRoot)) {
    return [];
  }
  return fs
    .readdirSync(artifactRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^(server|godot)-/i.test(name))
    .map((name) => path.join(artifactRoot, name));
}

function verifyWindowsAuthenticode(targetPath) {
  const escaped = targetPath.replace(/'/g, "''");
  const script = [
    `$sig = Get-AuthenticodeSignature -FilePath '${escaped}'`,
    'if ($null -eq $sig) { Write-Output "Unknown"; exit 0 }',
    'Write-Output $sig.Status',
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    return {
      ok: false,
      reason: result.error ? String(result.error.message || result.error) : String(result.stderr || '').trim(),
    };
  }

  const status = String(result.stdout || '').trim();
  return {
    ok: status === 'Valid',
    reason: status || 'Unknown',
  };
}

function verifyMacCodesign(targetPath) {
  const result = spawnSync('codesign', ['--verify', '--deep', '--strict', targetPath], {
    encoding: 'utf8',
  });
  if (result.error || result.status !== 0) {
    return {
      ok: false,
      reason: result.error ? String(result.error.message || result.error) : String(result.stderr || '').trim(),
    };
  }
  return { ok: true, reason: 'Valid' };
}

function verifyArtifactSignature(targetPath, requireSigned) {
  if (process.platform === 'win32') {
    const result = verifyWindowsAuthenticode(targetPath);
    if (requireSigned || result.ok) {
      return result;
    }
    return {
      ok: true,
      reason: `Unsigned/non-valid Authenticode status (${result.reason}) accepted in non-strict mode.`,
    };
  }
  if (process.platform === 'darwin') {
    const result = verifyMacCodesign(targetPath);
    if (requireSigned || result.ok) {
      return result;
    }
    return {
      ok: true,
      reason: `codesign verification failed (${result.reason}) accepted in non-strict mode.`,
    };
  }

  if (requireSigned) {
    return {
      ok: false,
      reason: `Signature verification is not implemented for platform ${process.platform}.`,
    };
  }
  return {
    ok: true,
    reason: `Skipped signature verification on ${process.platform} (non-strict mode).`,
  };
}

function main() {
  const options = parseOptions(process.argv);
  const artifacts = findSidecarArtifacts(options.artifactRoot);

  if (options.contractOnly) {
    console.log('[Sidecar Signature Verify] Contract-only mode passed.');
    console.log(`[Sidecar Signature Verify] artifactRoot=${path.relative(repoRoot, options.artifactRoot).replace(/\\/g, '/') || '.'}`);
    console.log(`[Sidecar Signature Verify] requireSigned=${options.requireSigned}`);
    return;
  }

  if (artifacts.length === 0) {
    const message = `No sidecar artifacts found under ${options.artifactRoot}.`;
    if (options.requireSigned && !options.allowEmpty) {
      console.error(`[Sidecar Signature Verify] ${message}`);
      process.exit(1);
      return;
    }
    console.warn(`[Sidecar Signature Verify] ${message}`);
    console.warn('[Sidecar Signature Verify] Skipping signature verification because strict mode is disabled or empty artifacts are allowed.');
    return;
  }

  const failures = [];
  artifacts.forEach((artifactPath) => {
    const result = verifyArtifactSignature(artifactPath, options.requireSigned);
    const relative = path.relative(repoRoot, artifactPath).replace(/\\/g, '/');
    if (result.ok) {
      console.log(`[Sidecar Signature Verify] PASS ${relative} (${result.reason})`);
      return;
    }
    failures.push(`${relative}: ${result.reason}`);
  });

  if (failures.length > 0) {
    failures.forEach((failure) => {
      console.error(`[Sidecar Signature Verify] FAIL ${failure}`);
    });
    process.exit(1);
    return;
  }

  console.log(`[Sidecar Signature Verify] Verified ${artifacts.length} sidecar artifact(s).`);
}

main();
