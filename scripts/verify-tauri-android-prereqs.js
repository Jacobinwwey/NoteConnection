const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const JAVAC_EXECUTABLE = process.platform === 'win32' ? 'javac.exe' : 'javac';
const MIN_SUPPORTED_JAVA_MAJOR = 21;

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

function isSupportedJavaMajor(major) {
  return Number.isFinite(major) && major >= MIN_SUPPORTED_JAVA_MAJOR;
}

function detectJavacVersion() {
  return detectJavacVersionByCommand('javac', {
    shell: process.platform === 'win32',
    source: 'path'
  });
}

function detectJavacVersionByCommand(command, options = {}) {
  const result = spawnSync(command, ['-version'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: Boolean(options.shell)
  });

  if (result.error) {
    return {
      available: false,
      source: options.source || 'unknown',
      message: result.error.message,
      command: command || 'javac'
    };
  }

  const output = `${String(result.stdout || '').trim()} ${String(result.stderr || '').trim()}`.trim();
  const match = output.match(/javac\s+([0-9][0-9._]*)/i);
  if (!match) {
    return {
      available: false,
      source: options.source || 'unknown',
      message: output || 'Unable to parse javac version output.',
      command: command || 'javac'
    };
  }

  const version = match[1];
  const major = parseJavaMajorVersion(version);
  if (major <= 0) {
    return {
      available: false,
      source: options.source || 'unknown',
      message: `Unable to parse JDK major version from "${version}".`,
      command: command || 'javac'
    };
  }

  return {
    available: true,
    version,
    major,
    source: options.source || 'unknown',
    command: command || 'javac',
    javaHome: options.javaHome || ''
  };
}

function dedupeStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!normalized) {
      continue;
    }
    const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function listChildDirectoriesIfExists(parentDir) {
  if (!existsDir(parentDir)) {
    return [];
  }
  try {
    return fs
      .readdirSync(parentDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(parentDir, entry.name));
  } catch {
    return [];
  }
}

function collectJavaHomeCandidates() {
  const envCandidates = [
    process.env.NOTE_CONNECTION_JAVA_HOME,
    process.env.NOTE_CONNECTION_JAVA21_HOME,
    process.env.JAVA_HOME_21_X64,
    process.env.JAVA_HOME_21,
    process.env.JDK_HOME,
    process.env.JDK21_HOME,
    process.env.JAVA_HOME
  ];

  const platformCandidates = [];
  if (process.platform === 'win32') {
    platformCandidates.push(
      'C:\\Program Files\\Java\\jdk-21',
      'C:\\Program Files\\Java\\jdk-21.0.1',
      'C:\\Program Files\\Java\\jdk-21.0.2',
      'C:\\Program Files\\Java\\jdk-21.0.3',
      'C:\\Program Files\\Java\\jdk-21.0.4',
      'C:\\Program Files\\Java\\jdk-21.0.5',
      'C:\\Program Files\\Java\\jdk-21.0.6',
      'C:\\Program Files\\Eclipse Adoptium\\jdk-21',
      'C:\\Program Files\\Android\\Android Studio\\jbr'
    );

    platformCandidates.push(
      ...listChildDirectoriesIfExists('C:\\Program Files\\Java'),
      ...listChildDirectoriesIfExists('C:\\Program Files\\Eclipse Adoptium')
    );
  } else {
    platformCandidates.push(
      '/usr/lib/jvm/java-21-openjdk',
      '/usr/lib/jvm/java-21-openjdk-amd64',
      '/usr/lib/jvm/temurin-21-jdk'
    );
    platformCandidates.push(...listChildDirectoriesIfExists('/usr/lib/jvm'));
  }

  return dedupeStrings([...envCandidates, ...platformCandidates]).filter((candidate) => existsDir(candidate));
}

function resolveJavacPath(javaHome) {
  if (!javaHome) {
    return '';
  }
  const javacPath = path.join(javaHome, 'bin', JAVAC_EXECUTABLE);
  return fs.existsSync(javacPath) ? javacPath : '';
}

function detectAvailableJavaToolchain() {
  const candidates = collectJavaHomeCandidates();
  const inspected = [];

  for (const javaHome of candidates) {
    const javacPath = resolveJavacPath(javaHome);
    if (!javacPath) {
      inspected.push({
        javaHome,
        ok: false,
        reason: 'Missing javac binary in bin directory.'
      });
      continue;
    }

    const detected = detectJavacVersionByCommand(javacPath, {
      shell: false,
      source: 'candidate',
      javaHome
    });
    if (!detected.available) {
      inspected.push({
        javaHome,
        ok: false,
        reason: detected.message
      });
      continue;
    }

    if (isSupportedJavaMajor(detected.major)) {
      return {
        found: true,
        javaHome,
        javacPath,
        version: detected.version,
        major: detected.major,
        inspected
      };
    }

    inspected.push({
      javaHome,
      ok: false,
      reason: `Detected javac ${detected.version} (major ${detected.major}), expected major >= ${MIN_SUPPORTED_JAVA_MAJOR}.`
    });
  }

  return {
    found: false,
    javaHome: '',
    javacPath: '',
    version: '',
    major: 0,
    inspected
  };
}

function mergePathWithJavaBin(existingPath, javaHome) {
  const javaBin = path.join(javaHome, 'bin');
  const separator = process.platform === 'win32' ? ';' : ':';
  if (!existingPath) {
    return javaBin;
  }
  const parts = String(existingPath)
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const hasJavaBin = parts.some((part) => {
    if (process.platform === 'win32') {
      return part.toLowerCase() === javaBin.toLowerCase();
    }
    return part === javaBin;
  });
  if (hasJavaBin) {
    return existingPath;
  }
  return [javaBin, ...parts].join(separator);
}

function buildEnvWithJavaHome(baseEnv, javaHome) {
  if (!javaHome) {
    return baseEnv;
  }
  return {
    ...baseEnv,
    JAVA_HOME: javaHome,
    PATH: mergePathWithJavaBin(baseEnv.PATH || baseEnv.Path || '', javaHome)
  };
}

function probeGradleJavaToolchain(repoRoot, env) {
  const androidRoot = path.join(repoRoot, 'android');
  const gradlewName = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
  const gradlewPath = path.join(androidRoot, gradlewName);

  if (!fs.existsSync(gradlewPath)) {
    return {
      checked: false,
      available: false,
      reason: `Missing Gradle wrapper: ${gradlewPath}`
    };
  }

  const result = spawnSync(gradlewPath, ['-q', 'javaToolchains'], {
    cwd: androidRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: env || process.env
  });

  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  const output = `${stdout}\n${stderr}`;

  if (result.error) {
    return {
      checked: false,
      available: false,
      reason: result.error.message
    };
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    return {
      checked: false,
      available: false,
      detectedMajors: [],
      reason: output.trim() || `gradle javaToolchains probe exited with code ${result.status}`
    };
  }

  const detectedMajors = Array.from(
    new Set(
      [...output.matchAll(/Language Version:\s*([0-9]+)\b/gi)]
        .map((match) => Number.parseInt(match[1], 10))
        .filter((major) => Number.isFinite(major) && major > 0)
        .sort((left, right) => left - right)
    )
  );

  const available = detectedMajors.some((major) => isSupportedJavaMajor(major));

  return {
    checked: true,
    available,
    detectedMajors,
    reason: ''
  };
}

const repoRoot = path.resolve(__dirname, '..');
const javac = detectJavacVersion();
const javaToolchain = detectAvailableJavaToolchain();
const defaultProbe = probeGradleJavaToolchain(repoRoot, process.env);
const preferredProbe = javaToolchain.found
  ? probeGradleJavaToolchain(repoRoot, buildEnvWithJavaHome(process.env, javaToolchain.javaHome))
  : { checked: false, available: false, reason: '' };

if (!javac.available && !javaToolchain.found) {
  fail([
    '[Android Env] Java compiler (javac) not available on PATH.',
    `[Android Env] Details: ${javac.message || 'No javac binary detected.'}`,
    `[Android Env] Java ${MIN_SUPPORTED_JAVA_MAJOR}+ toolchain discovery also failed.`,
    `[Android Env] Install JDK ${MIN_SUPPORTED_JAVA_MAJOR}+ and configure one of NOTE_CONNECTION_JAVA_HOME/NOTE_CONNECTION_JAVA21_HOME/JAVA_HOME.`
  ]);
}

if (javac.available && !isSupportedJavaMajor(javac.major) && !javaToolchain.found) {
  fail([
    `[Android Env] Unsupported JDK detected: ${javac.version} (major ${javac.major}).`,
    `[Android Env] Tauri Android and Gradle toolchain in this project require Java ${MIN_SUPPORTED_JAVA_MAJOR} or newer.`,
    `[Android Env] Install JDK ${MIN_SUPPORTED_JAVA_MAJOR}+ and point JAVA_HOME/NOTE_CONNECTION_JAVA_HOME to that installation before retrying.`
  ]);
}

const gradleToolchain = preferredProbe.available ? preferredProbe : defaultProbe;

const activeJdkSupported = javac.available && isSupportedJavaMajor(javac.major);
const discoveredJdkAvailable = javaToolchain.found;
if (!activeJdkSupported && !discoveredJdkAvailable && !gradleToolchain.available) {
  const details = gradleToolchain.checked
    ? `Gradle wrapper probe did not find a Java ${MIN_SUPPORTED_JAVA_MAJOR}+ toolchain. Detected toolchains: ${gradleToolchain.detectedMajors && gradleToolchain.detectedMajors.length > 0 ? gradleToolchain.detectedMajors.join(', ') : 'none'}.`
    : `Gradle wrapper probe failed: ${gradleToolchain.reason}`;

  fail([
    `[Android Env] Active javac version is ${javac.available ? javac.version : 'unavailable'} (major ${javac.major || 0}), but this project needs Java ${MIN_SUPPORTED_JAVA_MAJOR}+ toolchain availability.`,
    `[Android Env] ${details}`,
    `[Android Env] Install JDK ${MIN_SUPPORTED_JAVA_MAJOR}+ and set JAVA_HOME (or NOTE_CONNECTION_JAVA_HOME) before running Android builds.`
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
console.log(`[Android Env] Active JDK: ${javac.available ? `${javac.version} (major ${javac.major})` : 'not-detected'}`);
if (javaToolchain.found) {
  console.log(
    `[Android Env] Java ${MIN_SUPPORTED_JAVA_MAJOR}+ candidate: ${javaToolchain.version} @ ${javaToolchain.javaHome}`
  );
}
console.log(`[Android Env] Java ${MIN_SUPPORTED_JAVA_MAJOR}+ Toolchain: ${activeJdkSupported || discoveredJdkAvailable || gradleToolchain.available ? 'available' : 'not-detected'}`);
console.log('[Android Env] Prerequisite check passed.');
