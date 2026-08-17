#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROFILES = {
  'mobile-low': {
    compressedBudgetBytes: 25 * 1024 * 1024,
    maxResidentBytes: 256 * 1024 * 1024,
  },
  'mobile-standard': {
    compressedBudgetBytes: 35 * 1024 * 1024,
    maxResidentBytes: 384 * 1024 * 1024,
  },
};

const FORBIDDEN_ENTRY_PATTERNS = [
  /(^|\/)(?:server|godot|markdown-worker)(?:[-.]|\/|$)/i,
  /(^|\/)(?:models?|weights?)(?:[-.]|\/|$)/i,
  /(^|\/)(?:libgodot|libserver|libmarkdown-worker)[^/]*\.(?:so|dll|dylib)$/i,
  /\.(?:exe|dll|dylib|gguf|onnx|pck|svg)$/i,
];

function parseOption(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || '') : '';
}

function listZipEntries(filePath) {
  const buffer = fs.readFileSync(filePath);
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const minimumEocdBytes = 22;
  const searchStart = Math.max(0, buffer.length - 0xffff - minimumEocdBytes);
  let eocdOffset = -1;
  for (let offset = buffer.length - minimumEocdBytes; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error(`Not a ZIP/APK/AAB artifact: ${filePath}`);

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (entryCount === 0xffff || centralDirectoryOffset === 0xffffffff || centralDirectorySize === 0xffffffff) {
    throw new Error(`ZIP64 artifacts are not supported by the lightweight verifier: ${filePath}`);
  }

  const entries = [];
  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== centralSignature) {
      throw new Error(`Corrupt central directory entry ${index}: ${filePath}`);
    }
    const compressedBytes = buffer.readUInt32LE(offset + 20);
    const uncompressedBytes = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);
    entries.push({ name, compressedBytes, uncompressedBytes });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  if (offset > centralDirectoryOffset + centralDirectorySize) {
    throw new Error(`Central directory bounds exceed EOCD metadata: ${filePath}`);
  }
  return entries;
}

function normalizeEntryName(name) {
  return String(name || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function resolveSignatureTool(kind) {
  const explicit = kind === 'apk'
    ? process.env.APKSIGNER_PATH
    : process.env.JARSIGNER_PATH;
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }

  if (kind === 'apk') {
    const sdkRoot = process.env.ANDROID_SDK_ROOT
      || process.env.ANDROID_HOME
      || (process.platform === 'win32' && process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
        : '')
      || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Android', 'Sdk') : '');
    if (sdkRoot) {
      const buildToolsRoot = path.join(sdkRoot, 'build-tools');
      if (fs.existsSync(buildToolsRoot)) {
        const candidates = fs.readdirSync(buildToolsRoot, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
        for (const version of candidates) {
          const candidate = path.join(
            buildToolsRoot,
            version,
            process.platform === 'win32' ? 'apksigner.bat' : 'apksigner'
          );
          if (fs.existsSync(candidate)) {
            return candidate;
          }
        }
      }
    }
    return 'apksigner';
  }

  const javaHomes = [
    process.env.JAVA_HOME,
    process.env.JDK_HOME,
    process.platform === 'win32' ? path.join(process.env.ProgramFiles || '', 'Android', 'Android Studio', 'jbr') : '',
  ].filter(Boolean);
  for (const javaHome of javaHomes) {
    const candidate = path.join(javaHome, 'bin', process.platform === 'win32' ? 'jarsigner.exe' : 'jarsigner');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return process.platform === 'win32' ? 'jarsigner.exe' : 'jarsigner';
}

function verifyArtifactSignature(artifactPath, artifactKind) {
  const tool = resolveSignatureTool(artifactKind);
  const args = artifactKind === 'apk'
    ? ['verify', '--verbose', artifactPath]
    : ['-verify', '-strict', artifactPath];
  const result = spawnSync(tool, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
    shell: process.platform === 'win32' && /\.bat$/i.test(tool),
  });
  const output = `${String(result.stdout || '')}\n${String(result.stderr || '')}`.trim();
  if (result.error || result.status !== 0) {
    const detail = result.error ? result.error.message : output;
    throw new Error(
      `Mobile ${artifactKind.toUpperCase()} signature verification failed using ${tool}: ${detail || 'unsigned or invalid artifact'}`
    );
  }
  if (artifactKind === 'aab' && !/jar verified/i.test(output)) {
    throw new Error(`Mobile AAB signature verifier did not report a verified JAR: ${artifactPath}`);
  }

  const certificateDigest = (output.match(/certificate SHA-256 digest:\s*([0-9A-F:]+)/i) || [])[1] || '';
  return {
    status: 'verified',
    tool,
    certificateSha256: certificateDigest,
  };
}

function verifyMobileArtifact(options = {}) {
  const artifactPath = path.resolve(options.artifactPath || '');
  const profileId = String(options.profile || 'mobile-low');
  const profile = PROFILES[profileId];
  if (!profile) throw new Error(`Unknown mobile profile: ${profileId}`);
  if (!artifactPath || !fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
    throw new Error(`Mobile artifact does not exist: ${artifactPath}`);
  }
  if (!/\.(?:apk|aab)$/i.test(artifactPath)) {
    throw new Error(`Expected .apk or .aab artifact: ${artifactPath}`);
  }

  const entries = listZipEntries(artifactPath).map((entry) => ({
    ...entry,
    name: normalizeEntryName(entry.name),
  }));
  const forbiddenEntries = entries
    .filter((entry) => FORBIDDEN_ENTRY_PATTERNS.some((pattern) => pattern.test(entry.name)))
    .map((entry) => entry.name);
  const compressedPayloadBytes = entries.reduce((total, entry) => total + entry.compressedBytes, 0);
  if (forbiddenEntries.length > 0) {
    throw new Error(`Forbidden mobile artifact entries:\n${forbiddenEntries.map((entry) => `  - ${entry}`).join('\n')}`);
  }
  if (compressedPayloadBytes > profile.compressedBudgetBytes) {
    throw new Error(`Mobile compressed payload exceeds ${profileId} budget: ${compressedPayloadBytes}/${profile.compressedBudgetBytes} bytes.`);
  }

  const rssEvidencePath = options.rssEvidencePath ? path.resolve(options.rssEvidencePath) : '';
  const hasArm64Payload = entries.some((entry) => /(^|\/)(?:lib|jni)\/arm64-v8a\//i.test(entry.name));
  if (options.requireArm64 && !hasArm64Payload) {
    throw new Error(`Mobile artifact does not expose an arm64-v8a native payload: ${artifactPath}`);
  }
  let peakResidentBytes = null;
  if (rssEvidencePath) {
    let evidence;
    try {
      evidence = JSON.parse(fs.readFileSync(rssEvidencePath, 'utf8'));
    } catch (error) {
      throw new Error(`Mobile RSS evidence is unreadable: ${rssEvidencePath}: ${String(error.message || error)}`);
    }
    peakResidentBytes = Number(evidence && evidence.peakResidentBytes);
    if (!Number.isFinite(peakResidentBytes) || peakResidentBytes < 0) {
      throw new Error(`Mobile RSS evidence must contain a non-negative peakResidentBytes value: ${rssEvidencePath}`);
    }
    if (peakResidentBytes > profile.maxResidentBytes) {
      throw new Error(`Mobile peak RSS exceeds ${profileId} budget: ${peakResidentBytes}/${profile.maxResidentBytes} bytes.`);
    }
  } else if (options.requireRss) {
    throw new Error(`Mobile RSS evidence is required for ${profileId} release verification.`);
  }

  const artifactKind = artifactPath.toLowerCase().endsWith('.aab') ? 'aab' : 'apk';
  const signature = options.requireSigned
    ? verifyArtifactSignature(artifactPath, artifactKind)
    : { status: 'not-required', tool: '', certificateSha256: '' };

  return {
    artifactPath,
    artifactKind,
    profile: profileId,
    entryCount: entries.length,
    compressedPayloadBytes,
    compressedBudgetBytes: profile.compressedBudgetBytes,
    uncompressedPayloadBytes: entries.reduce((total, entry) => total + entry.uncompressedBytes, 0),
    maxResidentBytes: profile.maxResidentBytes,
    peakResidentBytes,
    rssStatus: peakResidentBytes === null ? 'not-measured' : 'within-budget',
    hasArm64Payload,
    signature,
    forbiddenEntries,
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/verify-mobile-artifact.js --artifact <file.apk|file.aab> [--profile mobile-low|mobile-standard] [--rss-evidence <file>] [--require-rss] [--require-arm64] [--require-signed]');
    return;
  }
  const artifactPath = parseOption(args, '--artifact') || process.env.NOTE_CONNECTION_MOBILE_ARTIFACT || '';
  const profile = parseOption(args, '--profile') || process.env.NOTE_CONNECTION_MOBILE_PROFILE || 'mobile-low';
  const rssEvidencePath = parseOption(args, '--rss-evidence') || process.env.NOTE_CONNECTION_MOBILE_RSS_EVIDENCE || '';
  try {
    const result = verifyMobileArtifact({
      artifactPath,
      profile,
      rssEvidencePath,
      requireRss: args.includes('--require-rss'),
      requireArm64: args.includes('--require-arm64'),
      requireSigned: args.includes('--require-signed'),
    });
    console.log(`[Mobile Artifact] PASS ${result.artifactKind} entries=${result.entryCount}`);
    console.log(`[Mobile Artifact] Compressed payload: ${result.compressedPayloadBytes}/${result.compressedBudgetBytes}`);
    console.log(`[Mobile Artifact] Peak RSS: ${result.peakResidentBytes === null ? 'not measured' : `${result.peakResidentBytes}/${result.maxResidentBytes}`}`);
    console.log(`[Mobile Artifact] Signature: ${result.signature.status}`);
  } catch (error) {
    console.error(`[Mobile Artifact] FAIL: ${String(error.message || error)}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  PROFILES,
  FORBIDDEN_ENTRY_PATTERNS,
  listZipEntries,
  resolveSignatureTool,
  verifyArtifactSignature,
  verifyMobileArtifact,
};
