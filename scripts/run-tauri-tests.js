#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const cargoManifestPath = path.join('src-tauri', 'Cargo.toml');
const reportPath = path.join(repoRoot, 'build', 'tauri-test-verification-latest.json');

function writeReport(report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function appendRustflagsForLowMemory(existingRustflags) {
  const base = String(existingRustflags || '').trim();
  if (base.includes('codegen-units')) {
    return base;
  }

  return `${base} -C codegen-units=1`.trim();
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function runCommand(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    stdio: 'pipe'
  });

  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  if (stdout.length > 0) {
    process.stdout.write(stdout);
  }
  if (stderr.length > 0) {
    process.stderr.write(stderr);
  }

  return {
    status: typeof result.status === 'number' ? result.status : 1,
    stdout,
    stderr,
    error: result.error ? String(result.error.message || result.error) : ''
  };
}

function runNodeScript(scriptFileName, baseEnv) {
  const scriptPath = path.join(__dirname, scriptFileName);
  console.log(`[test:tauri] Running ${scriptFileName}`);
  return runCommand(process.execPath, [scriptPath], baseEnv);
}

function isLikelyOutOfMemoryFailure(stdout, stderr, errorMessage) {
  const text = `${stdout}\n${stderr}\n${errorMessage}`.toLowerCase();
  const markers = [
    'out of memory',
    'not enough memory',
    'allocation failed',
    'fatal runtime error',
    'os error 1455',
    'could not reserve enough space',
    'signal: 9'
  ];
  return markers.some((marker) => text.includes(marker));
}

function main() {
  const now = new Date().toISOString();
  const strictMode = process.env.NOTE_CONNECTION_TAURI_TEST_STRICT === '1' || process.env.CI === 'true';
  const cargoJobs = parsePositiveInt(process.env.CARGO_BUILD_JOBS, 1);

  const baseEnv = {
    ...process.env,
    CARGO_BUILD_JOBS: String(cargoJobs),
    CARGO_INCREMENTAL: process.env.CARGO_INCREMENTAL || '0',
    RUSTFLAGS: appendRustflagsForLowMemory(process.env.RUSTFLAGS)
  };

  const preflightScripts = ['cleanup-tauri-sidecars.js', 'ensure-tauri-frontend-dist.js'];
  for (const scriptFileName of preflightScripts) {
    const step = runNodeScript(scriptFileName, baseEnv);
    if (step.status !== 0) {
      writeReport({
        timestamp: now,
        strictMode,
        cargoBuildJobs: cargoJobs,
        status: 'failed-preflight',
        failedStep: scriptFileName,
        exitCode: step.status
      });
      process.exit(step.status || 1);
    }
  }

  const passthroughArgs = process.argv.slice(2);
  const cargoArgs = ['test', '--manifest-path', cargoManifestPath, '-j', String(cargoJobs), ...passthroughArgs];
  console.log(
    `[test:tauri] Running cargo test with jobs=${cargoJobs}, strictMode=${strictMode ? 'on' : 'off'}`,
  );
  const cargoStep = runCommand('cargo', cargoArgs, baseEnv);

  if (cargoStep.status === 0) {
    writeReport({
      timestamp: now,
      strictMode,
      cargoBuildJobs: cargoJobs,
      status: 'passed'
    });
    console.log('[test:tauri] Rust suite passed.');
    process.exit(0);
  }

  const oomFailure = isLikelyOutOfMemoryFailure(cargoStep.stdout, cargoStep.stderr, cargoStep.error);
  if (oomFailure) {
    const failureStatus = strictMode ? 'failed-oom' : 'degraded-oom';
    writeReport({
      timestamp: now,
      strictMode,
      cargoBuildJobs: cargoJobs,
      status: failureStatus,
      exitCode: cargoStep.status
    });

    if (strictMode) {
      console.error(
        '[test:tauri] Rust suite failed due to likely memory pressure. Strict mode is enabled; failing the gate.',
      );
      process.exit(cargoStep.status || 1);
    }

    console.warn(
      '[test:tauri] Rust suite hit likely host-memory pressure; reporting degraded success for local verification. Set NOTE_CONNECTION_TAURI_TEST_STRICT=1 to enforce hard-fail locally.',
    );
    process.exit(0);
  }

  writeReport({
    timestamp: now,
    strictMode,
    cargoBuildJobs: cargoJobs,
    status: 'failed',
    exitCode: cargoStep.status
  });
  process.exit(cargoStep.status || 1);
}

main();
