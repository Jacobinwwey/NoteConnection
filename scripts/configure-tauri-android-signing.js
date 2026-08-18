#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const androidGradlePath = path.join(
  repoRoot,
  'src-tauri',
  'gen',
  'android',
  'app',
  'build.gradle.kts'
);
const signingMarkerStart = '// NOTE_CONNECTION_ANDROID_SIGNING_START';
const signingMarkerEnd = '// NOTE_CONNECTION_ANDROID_SIGNING_END';

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

function isSigningConfigured() {
  return [
    'NOTE_CONNECTION_ANDROID_KEYSTORE_FILE',
    'NOTE_CONNECTION_ANDROID_KEYSTORE_PASSWORD',
    'NOTE_CONNECTION_ANDROID_KEY_ALIAS',
    'NOTE_CONNECTION_ANDROID_KEY_PASSWORD',
  ].some((name) => readEnv(name).length > 0);
}

function requireSigningConfiguration() {
  const required = [
    'NOTE_CONNECTION_ANDROID_KEYSTORE_FILE',
    'NOTE_CONNECTION_ANDROID_KEYSTORE_PASSWORD',
    'NOTE_CONNECTION_ANDROID_KEY_ALIAS',
    'NOTE_CONNECTION_ANDROID_KEY_PASSWORD',
  ];
  const missing = required.filter((name) => readEnv(name).length === 0);
  if (missing.length > 0) {
    throw new Error(
      `Android release signing is required but configuration is incomplete: ${missing.join(', ')}`
    );
  }
}

function resolveKeystorePath() {
  const configured = path.resolve(readEnv('NOTE_CONNECTION_ANDROID_KEYSTORE_FILE'));
  if (!fs.existsSync(configured) || !fs.statSync(configured).isFile()) {
    throw new Error(`Android signing keystore does not exist: ${configured}`);
  }
  return configured;
}

function removeExistingBlock(source) {
  const start = source.indexOf(signingMarkerStart);
  const end = source.indexOf(signingMarkerEnd);
  if (start < 0 && end < 0) {
    return source;
  }
  if (start < 0 || end < start) {
    throw new Error('Android Gradle signing markers are malformed.');
  }
  const endOffset = end + signingMarkerEnd.length;
  return `${source.slice(0, start)}${source.slice(endOffset)}`.replace(/\n{3,}/g, '\n\n');
}

function renderSigningBlock() {
  return `${signingMarkerStart}
    val noteConnectionKeystoreFile = System.getenv("NOTE_CONNECTION_ANDROID_KEYSTORE_FILE")?.trim().orEmpty()
    val noteConnectionKeystorePassword = System.getenv("NOTE_CONNECTION_ANDROID_KEYSTORE_PASSWORD")?.trim().orEmpty()
    val noteConnectionKeyAlias = System.getenv("NOTE_CONNECTION_ANDROID_KEY_ALIAS")?.trim().orEmpty()
    val noteConnectionKeyPassword = System.getenv("NOTE_CONNECTION_ANDROID_KEY_PASSWORD")?.trim().orEmpty()
    val noteConnectionReleaseSigningConfig = if (noteConnectionKeystoreFile.isNotEmpty()) {
        signingConfigs.create("noteConnectionRelease") {
            storeFile = file(noteConnectionKeystoreFile)
            storePassword = noteConnectionKeystorePassword
            keyAlias = noteConnectionKeyAlias
            keyPassword = noteConnectionKeyPassword
        }
    } else {
        null
    }
${signingMarkerEnd}`;
}

function addSigningConfig(source) {
  const androidIndex = source.indexOf('\nandroid {');
  if (androidIndex < 0) {
    throw new Error(`Android Gradle file does not contain an android block: ${androidGradlePath}`);
  }
  const androidBodyStart = androidIndex + '\nandroid {'.length;
  const block = renderSigningBlock();
  const withBlock = `${source.slice(0, androidBodyStart)}\n${block}${source.slice(androidBodyStart)}`;
  const releaseBuildType = 'getByName("release") {';
  const releaseIndex = withBlock.indexOf(releaseBuildType, androidBodyStart);
  if (releaseIndex < 0) {
    throw new Error(`Android Gradle file does not contain a release build type: ${androidGradlePath}`);
  }
  const releaseBodyStart = releaseIndex + releaseBuildType.length;
  return `${withBlock.slice(0, releaseBodyStart)}\n            signingConfig = noteConnectionReleaseSigningConfig${withBlock.slice(releaseBodyStart)}`;
}

function configureSigning() {
  const requireSigning = readEnv('NOTE_CONNECTION_ANDROID_REQUIRE_SIGNING') === '1';
  const configured = isSigningConfigured();
  if (requireSigning) {
    requireSigningConfiguration();
  }
  if (!fs.existsSync(androidGradlePath)) {
    if (configured || requireSigning) {
      throw new Error(`Generated Android Gradle file is missing: ${androidGradlePath}`);
    }
    return { status: 'skipped', reason: 'android-scaffold-missing' };
  }

  let source = fs.readFileSync(androidGradlePath, 'utf8');
  source = removeExistingBlock(source);
  source = source.replace(
    /\n\s*signingConfig\s*=\s*noteConnectionReleaseSigningConfig\s*/g,
    '\n'
  );

  if (configured) {
    requireSigningConfiguration();
    resolveKeystorePath();
    source = addSigningConfig(source);
  }

  fs.writeFileSync(androidGradlePath, source, 'utf8');
  return { status: configured ? 'configured' : 'unsigned-default' };
}

function main() {
  try {
    const result = configureSigning();
    console.log(`[Tauri Android Signing] ${result.status}${result.reason ? ` (${result.reason})` : ''}.`);
  } catch (error) {
    console.error(`[Tauri Android Signing] FAIL: ${String(error.message || error)}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  addSigningConfig,
  configureSigning,
  isSigningConfigured,
  removeExistingBlock,
  renderSigningBlock,
  signingMarkerEnd,
  signingMarkerStart,
};
