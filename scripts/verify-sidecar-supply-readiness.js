#!/usr/bin/env node

const { evaluateSidecarSupplyReadiness } = require('./sidecar-supply-readiness-utils');

function printHumanReport(result) {
  console.log(`[Sidecar Supply] Host: ${result.platform}/${result.arch}`);
  console.log(`[Sidecar Supply] Rating: ${result.rating}`);
  console.log(`[Sidecar Supply] Offline bootstrap ready: ${result.offlineBootstrapReady ? 'yes' : 'no'}`);
  console.log(
    `[Sidecar Supply] Server ready: ${result.artifacts.server.ready ? 'yes' : 'no'} ${result.artifacts.server.binaryName || '(unsupported host)'}`
  );
  console.log(
    `[Sidecar Supply] Markdown worker ready: ${result.artifacts.markdownWorker.ready ? 'yes' : 'no'} ${result.artifacts.markdownWorker.binaryName || '(unsupported host)'}`
  );
  console.log(
    `[Sidecar Supply] Godot ready: ${result.artifacts.godot.ready ? 'yes' : 'no'} sources=${result.artifacts.godot.sourceKindsAvailable.join(',') || 'none'}`
  );
  console.log(
    `[Sidecar Supply] Godot download configured: ${result.artifacts.godot.downloadConfigured ? 'yes' : 'no'}`
  );
  console.log(
    `[Sidecar Supply] Godot download pinned: ${result.artifacts.godot.pinnedDownload ? 'yes' : 'no'}`
  );
  console.log(
    `[Sidecar Supply] Release workflow mirror-first download: ${result.ci.releaseWorkflowMirrorFirstDownload ? 'yes' : 'no'}`
  );
  console.log(
    `[Sidecar Supply] Release workflow direct upstream download: ${result.ci.releaseWorkflowDirectUpstreamDownload ? 'yes' : 'no'}`
  );
  console.log(
    `[Sidecar Supply] Legacy protected LFS paths: ${result.legacyLfsProtectedPaths.length}`
  );
  result.legacyLfsProtectedPaths.forEach((entry) => {
    console.log(`  - ${entry}`);
  });
  if (result.unexpectedLfsProtectedPaths.length > 0) {
    console.log('[Sidecar Supply] Unexpected protected LFS paths:');
    result.unexpectedLfsProtectedPaths.forEach((entry) => {
      console.log(`  - ${entry}`);
    });
  }
  console.log('[Sidecar Supply] Recommendations:');
  result.recommendations.forEach((entry) => {
    console.log(`  - ${entry}`);
  });
}

function main() {
  const args = new Set(process.argv.slice(2));
  const result = evaluateSidecarSupplyReadiness({
    repoRoot: process.cwd(),
    env: process.env,
    platform: process.platform,
    arch: process.arch,
  });

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  printHumanReport(result);

  if (args.has('--strict-offline') && !result.offlineBootstrapReady) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
}
