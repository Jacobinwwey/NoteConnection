const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function existsDir(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function detectAndroidSdkRoot() {
  const explicit = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (explicit) {
    return explicit;
  }

  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
  }

  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    return path.join(home, 'Android', 'Sdk');
  }

  return '';
}

function sdkManagerCandidates(sdkRoot) {
  if (process.platform === 'win32') {
    return [
      path.join(sdkRoot, 'cmdline-tools', 'latest', 'bin', 'sdkmanager.bat'),
      path.join(sdkRoot, 'cmdline-tools', 'bin', 'sdkmanager.bat')
    ];
  }

  return [
    path.join(sdkRoot, 'cmdline-tools', 'latest', 'bin', 'sdkmanager'),
    path.join(sdkRoot, 'cmdline-tools', 'bin', 'sdkmanager')
  ];
}

function detectInstalledNdk(sdkRoot) {
  const ndkRoot = path.join(sdkRoot, 'ndk');
  if (!existsDir(ndkRoot)) {
    return '';
  }

  const entries = fs
    .readdirSync(ndkRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (entries.length === 0) {
    return '';
  }

  return path.join(ndkRoot, entries[entries.length - 1]);
}

function firstExistingFile(paths) {
  return paths.find((target) => {
    try {
      return fs.existsSync(target) && fs.statSync(target).isFile();
    } catch {
      return false;
    }
  });
}

function fail(messageLines) {
  messageLines.forEach((line) => console.error(line));
  process.exit(1);
}

function parseJavaMajorVersion(versionString) {
  if (!versionString) {
    return 0;
  }

  const tokens = String(versionString).trim().split('.');
  if (tokens.length === 0) {
    return 0;
  }

  const first = Number.parseInt(tokens[0], 10);
  if (!Number.isFinite(first)) {
    return 0;
  }

  if (first === 1 && tokens.length > 1) {
    const legacyMajor = Number.parseInt(tokens[1], 10);
    return Number.isFinite(legacyMajor) ? legacyMajor : 0;
  }

  return first;
}

function detectJavacVersion() {
  const result = spawnSync('javac', ['-version'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  if (result.error) {
    return {
      available: false,
      message: result.error.message
    };
  }

  const output = `${String(result.stdout || '').trim()} ${String(result.stderr || '').trim()}`.trim();
  const match = output.match(/javac\s+([0-9][0-9._]*)/i);
  if (!match) {
    return {
      available: false,
      message: output || 'Unable to parse javac version output.'
    };
  }

  const version = match[1];
  const major = parseJavaMajorVersion(version);
  if (major <= 0) {
    return {
      available: false,
      message: `Unable to parse JDK major version from "${version}".`
    };
  }

  return {
    available: true,
    version,
    major
  };
}

const javac = detectJavacVersion();
if (!javac.available) {
  fail([
    '[Android Env] Java compiler (javac) not available on PATH.',
    `[Android Env] Details: ${javac.message}`,
    '[Android Env] Install JDK 21+ and ensure JAVA_HOME/bin is available in PATH.'
  ]);
}

if (javac.major < 21) {
  fail([
    `[Android Env] Unsupported JDK detected: ${javac.version} (major ${javac.major}).`,
    '[Android Env] Tauri Android and Gradle toolchain in this project require JDK 21+.',
    '[Android Env] Install JDK 21+ and point JAVA_HOME to that installation before retrying.'
  ]);
}

const sdkRoot = detectAndroidSdkRoot();
if (!sdkRoot) {
  fail([
    '[Android Env] Unable to detect Android SDK root.',
    '[Android Env] Set ANDROID_HOME or ANDROID_SDK_ROOT before running Tauri Android commands.'
  ]);
}

if (!existsDir(sdkRoot)) {
  fail([
    `[Android Env] Android SDK root not found: ${sdkRoot}`,
    '[Android Env] Install Android SDK via Android Studio and set ANDROID_HOME/ANDROID_SDK_ROOT.'
  ]);
}

const sdkManager = firstExistingFile(sdkManagerCandidates(sdkRoot));
if (!sdkManager) {
  fail([
    `[Android Env] Missing Android SDK command-line tools under: ${sdkRoot}`,
    '[Android Env] Expected path: cmdline-tools/latest/bin/sdkmanager(.bat)',
    '[Android Env] Fix:',
    '  1) Android Studio -> SDK Manager -> SDK Tools -> Android SDK Command-line Tools (latest).',
    '  2) Or install command-line tools manually and place them under cmdline-tools/latest.'
  ]);
}

const platformToolsDir = path.join(sdkRoot, 'platform-tools');
if (!existsDir(platformToolsDir)) {
  fail([
    `[Android Env] Missing platform-tools directory: ${platformToolsDir}`,
    '[Android Env] Install Android SDK Platform-Tools from Android Studio SDK Manager.'
  ]);
}

const envNdk = process.env.NDK_HOME || process.env.ANDROID_NDK_HOME;
let ndkPath = '';
if (envNdk) {
  ndkPath = envNdk;
  if (!existsDir(ndkPath)) {
    fail([
      `[Android Env] NDK_HOME points to a missing directory: ${ndkPath}`,
      '[Android Env] Fix NDK_HOME/ANDROID_NDK_HOME or install an Android NDK under <SDK>/ndk/<version>.'
    ]);
  }
} else {
  ndkPath = detectInstalledNdk(sdkRoot);
  if (!ndkPath) {
    fail([
      `[Android Env] Missing Android NDK under: ${path.join(sdkRoot, 'ndk')}`,
      '[Android Env] Install an NDK package, e.g. sdkmanager "ndk;27.2.12479018",',
      'then set NDK_HOME to that directory (or rely on auto-detection scripts).'
    ]);
  }
}

console.log(`[Android Env] SDK root: ${sdkRoot}`);
console.log(`[Android Env] sdkmanager: ${sdkManager}`);
console.log(`[Android Env] NDK: ${ndkPath}`);
console.log(`[Android Env] JDK: ${javac.version} (major ${javac.major})`);
console.log('[Android Env] Prerequisite check passed.');
