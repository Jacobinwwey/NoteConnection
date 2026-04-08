const fs = require('fs');
const path = require('path');

const {
  resolveHostServerBinaryName,
  resolveHostMarkdownWorkerBinaryName,
  resolveGodotBootstrapContext,
  isNonEmptyBinary,
  isLfsPointerFile,
  isValidGodotBinary,
} = require('./tauri-sidecar-utils');
const {
  evaluateLfsAssetPolicy,
} = require('./lfs-asset-policy-utils');

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function fileReady(filePath) {
  if (!filePath) {
    return false;
  }
  if (!isNonEmptyBinary(filePath)) {
    return false;
  }
  return !isLfsPointerFile(filePath);
}

function detectReleaseWorkflowDirectUpstreamDownload(repoRoot) {
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'release-desktop-multi-os.yml');
  const workflow = readTextIfExists(workflowPath);
  if (!workflow) {
    return false;
  }
  return /github\.com\/godotengine\/godot\/releases\/download/i.test(workflow);
}

function detectReleaseWorkflowMirrorFirstDownload(repoRoot) {
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'release-desktop-multi-os.yml');
  const workflow = readTextIfExists(workflowPath);
  if (!workflow) {
    return false;
  }
  return /github\.com\/Jacobinwwey\/NoteConnection\/releases\/download\/\$\{GODOT_MIRROR_TAG\}/i.test(workflow)
    || /github\.com\/Jacobinwwey\/NoteConnection\/releases\/download\/\$env:GODOT_MIRROR_TAG/i.test(workflow);
}

function detectReleaseWorkflowArchiveDigestPinned(repoRoot) {
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'release-desktop-multi-os.yml');
  const workflow = readTextIfExists(workflowPath);
  if (!workflow) {
    return false;
  }

  const hasEnvPins = /GODOT_WINDOWS_ARCHIVE_SHA256:\s*"([a-f0-9]{64})"/i.test(workflow)
    && /GODOT_LINUX_ARCHIVE_SHA256:\s*"([a-f0-9]{64})"/i.test(workflow)
    && /GODOT_MACOS_ARCHIVE_SHA256:\s*"([a-f0-9]{64})"/i.test(workflow);
  const hasMirrorSeedingCheck = /sha256sum "\$ARCHIVE_PATH"/i.test(workflow);
  const hasWindowsCheck = /Get-FileHash -Path \$archive -Algorithm SHA256/i.test(workflow);
  const hasLinuxCheck = /sha256sum build\/godot\/godot-linux\.zip/i.test(workflow);
  const hasMacosCheck = /sha256sum build\/godot\/godot-macos\.zip/i.test(workflow);

  return hasEnvPins && hasMirrorSeedingCheck && hasWindowsCheck && hasLinuxCheck && hasMacosCheck;
}

function detectReleaseWorkflowMirrorOnlyModeAvailable(repoRoot) {
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'release-desktop-multi-os.yml');
  const workflow = readTextIfExists(workflowPath);
  if (!workflow) {
    return false;
  }

  const hasDispatchInput = /allow_godot_upstream_fallback:\s*\n(?:.*\n)*?\s+default:\s*true\s*\n(?:.*\n)*?\s+type:\s*boolean/i.test(workflow);
  const hasSharedEnvToggle = /GODOT_ALLOW_UPSTREAM_FALLBACK:\s*\$\{\{\s*github\.event_name != 'workflow_dispatch' \|\| github\.event\.inputs\.allow_godot_upstream_fallback != 'false'\s*\}\}/i.test(workflow);
  const hasWindowsGuard = /\$allowUpstreamFallback = "\$env:GODOT_ALLOW_UPSTREAM_FALLBACK"\.ToLower\(\) -eq "true"/i.test(workflow)
    && /Project mirror download failed and upstream fallback is disabled:/i.test(workflow);
  const hasUnixGuard = /if \[ "\$\{GODOT_ALLOW_UPSTREAM_FALLBACK\}" != "true" \]; then\s+echo "::error::Project mirror download failed and upstream fallback is disabled\."\s+exit 1\s+fi/i.test(workflow);

  return hasDispatchInput && hasSharedEnvToggle && hasWindowsGuard && hasUnixGuard;
}

function detectReleaseWorkflowDefaultUpstreamFallbackEnabled(repoRoot) {
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'release-desktop-multi-os.yml');
  const workflow = readTextIfExists(workflowPath);
  if (!workflow) {
    return false;
  }
  return /allow_godot_upstream_fallback:\s*\n(?:.*\n)*?\s+default:\s*true/i.test(workflow);
}

function evaluateServerArtifact(repoRoot, platform, arch) {
  const binaryName = resolveHostServerBinaryName({ platform, arch });
  const filePath = binaryName ? path.join(repoRoot, 'src-tauri', 'bin', binaryName) : '';
  return {
    binaryName,
    filePath,
    ready: fileReady(filePath),
  };
}

function evaluateMarkdownWorkerArtifact(repoRoot, platform, arch) {
  const binaryName = resolveHostMarkdownWorkerBinaryName({ platform, arch });
  const filePath = binaryName ? path.join(repoRoot, 'src-tauri', 'bin', binaryName) : '';
  return {
    binaryName,
    filePath,
    ready: fileReady(filePath),
  };
}

function evaluateGodotArtifact(repoRoot, env, platform, arch) {
  const context = resolveGodotBootstrapContext({
    repoRoot,
    env,
    platform,
    arch,
  });
  if (!context) {
    return {
      ready: false,
      networkRequiredForBootstrap: false,
      downloadConfigured: false,
      pinnedDownload: false,
      sourceKindsAvailable: [],
      targetPath: '',
      cachePath: '',
    };
  }

  const sourceKindsAvailable = [];
  const targetReady = isValidGodotBinary(context.targetPath, context.expectedSha256);
  if (targetReady) {
    sourceKindsAvailable.push('target');
  }

  const candidateReady = context.candidates.some((candidate) =>
    isValidGodotBinary(candidate, context.expectedSha256)
  );
  if (candidateReady) {
    sourceKindsAvailable.push('candidate');
  }

  const cacheReady = isValidGodotBinary(context.cachePath, context.expectedSha256);
  if (cacheReady) {
    sourceKindsAvailable.push('cache');
  }

  const downloadConfigured = Boolean(context.downloadUrl);
  if (downloadConfigured) {
    sourceKindsAvailable.push('download');
  }

  const ready = targetReady || candidateReady || cacheReady;
  const pinnedDownload = Boolean(context.expectedSha256);
  const networkRequiredForBootstrap = !ready && downloadConfigured;

  return {
    ready,
    networkRequiredForBootstrap,
    downloadConfigured,
    pinnedDownload,
    sourceKindsAvailable,
    targetPath: context.targetPath,
    cachePath: context.cachePath,
  };
}

function deriveRating({ offlineBootstrapReady, godot, ci }) {
  if (offlineBootstrapReady) {
    return 'offline-ready';
  }
  if (godot.networkRequiredForBootstrap || ci.releaseWorkflowDefaultUpstreamFallbackEnabled) {
    return 'network-dependent';
  }
  return 'partial-local';
}

function buildRecommendations({ server, markdownWorker, godot, ci, legacyLfsProtectedPaths }) {
  const recommendations = [];

  if (!ci.releaseWorkflowMirrorFirstDownload && ci.releaseWorkflowDirectUpstreamDownload) {
    recommendations.push(
      'Mirror and pin Godot release assets instead of relying on direct third-party downloads in CI.'
    );
  }

  if (ci.releaseWorkflowMirrorFirstDownload && ci.releaseWorkflowDirectUpstreamDownload) {
    recommendations.push(
      ci.releaseWorkflowArchiveDigestPinned && ci.releaseWorkflowMirrorOnlyModeAvailable
        ? 'Keep the release workflow mirror-first, keep archive digest pinning enforced, exercise mirror-only smoke runs regularly, and remove default upstream fallback reliance before strict no-LFS mode.'
        : ci.releaseWorkflowArchiveDigestPinned
        ? 'Keep the release workflow mirror-first, keep archive digest pinning enforced, and reduce direct upstream fallback reliance before strict no-LFS mode.'
        : 'Keep the release workflow mirror-first, but add digest pinning and reduce direct upstream fallback reliance before strict no-LFS mode.'
    );
  }

  if (!server.ready && legacyLfsProtectedPaths.some((filePath) => filePath.includes('/server-'))) {
    recommendations.push(
      'Keep remaining server LFS residues only as a temporary bridge; replace them with reproducible local-build or mirrored artifact materialization before strict no-LFS mode.'
    );
  }

  if (!markdownWorker.ready) {
    recommendations.push(
      'Keep markdown-worker on a local-build path or add mirrored artifacts later; it is a desktop dependency but not a current LFS blocker.'
    );
  }

  if (!godot.ready && !godot.downloadConfigured) {
    recommendations.push(
      'Seed a local Godot binary or cache path for desktop bootstrap before removing the last Godot LFS residue.'
    );
  }

  if (godot.downloadConfigured && !godot.pinnedDownload) {
    recommendations.push(
      'Do not use unpinned Godot download fallbacks for supply migration; require SHA256 pinning.'
    );
  }

  recommendations.push(
    'Prefer cache-first, mirror-second, local-build-third, manual-seed-fourth ordering for desktop sidecar supply.'
  );

  return recommendations;
}

function evaluateSidecarSupplyReadiness(options = {}) {
  const repoRoot = options.repoRoot || path.resolve(__dirname, '..');
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;

  const server = evaluateServerArtifact(repoRoot, platform, arch);
  const markdownWorker = evaluateMarkdownWorkerArtifact(repoRoot, platform, arch);
  const godot = evaluateGodotArtifact(repoRoot, env, platform, arch);
  const offlineBootstrapReady = server.ready && markdownWorker.ready && godot.ready;

  const ci = {
    releaseWorkflowMirrorFirstDownload: detectReleaseWorkflowMirrorFirstDownload(repoRoot),
    releaseWorkflowDirectUpstreamDownload: detectReleaseWorkflowDirectUpstreamDownload(repoRoot),
    releaseWorkflowArchiveDigestPinned: detectReleaseWorkflowArchiveDigestPinned(repoRoot),
    releaseWorkflowMirrorOnlyModeAvailable: detectReleaseWorkflowMirrorOnlyModeAvailable(repoRoot),
    releaseWorkflowDefaultUpstreamFallbackEnabled: detectReleaseWorkflowDefaultUpstreamFallbackEnabled(repoRoot),
  };

  const gitattributesText = readTextIfExists(path.join(repoRoot, '.gitattributes'));
  const lfsPolicy = evaluateLfsAssetPolicy({
    gitattributesText,
    mode: 'unexpected-only',
  });

  const result = {
    platform,
    arch,
    offlineBootstrapReady,
    rating: 'partial-local',
    artifacts: {
      server,
      markdownWorker,
      godot,
    },
    ci,
    legacyLfsProtectedPaths: lfsPolicy.legacyProtectedPaths,
    unexpectedLfsProtectedPaths: lfsPolicy.unexpectedProtectedPaths,
    recommendations: [],
  };

  result.rating = deriveRating({
    offlineBootstrapReady,
    godot,
    ci,
  });
  result.recommendations = buildRecommendations({
    server,
    markdownWorker,
    godot,
    ci,
    legacyLfsProtectedPaths: result.legacyLfsProtectedPaths,
  });

  return result;
}

module.exports = {
  evaluateSidecarSupplyReadiness,
};
