#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MIN_SUPPORTED_JAVA_MAJOR = 21;
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const options = {
    javaMajor: 0
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--java-major' && argv[index + 1]) {
      options.javaMajor = Number.parseInt(String(argv[index + 1]), 10) || 0;
      index += 1;
    }
  }

  return options;
}

function parseJavaMajor(version) {
  const normalized = String(version || '').trim();
  if (!normalized) {
    return 0;
  }
  const tokens = normalized.split('.');
  const first = Number.parseInt(tokens[0], 10);
  if (!Number.isFinite(first)) {
    return 0;
  }
  if (first === 1 && tokens.length > 1) {
    const legacy = Number.parseInt(tokens[1], 10);
    return Number.isFinite(legacy) ? legacy : 0;
  }
  return first;
}

function detectJavaMajorFromJavac() {
  const result = spawnSync('javac', ['-version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  if (result.error) {
    return 0;
  }

  const output = `${String(result.stdout || '').trim()} ${String(result.stderr || '').trim()}`.trim();
  const match = output.match(/javac\s+([0-9][0-9._]*)/i);
  if (!match) {
    return 0;
  }

  return parseJavaMajor(match[1]);
}

function listCapacitorGradleFiles() {
  const files = [
    path.join(repoRoot, 'android', 'app', 'capacitor.build.gradle')
  ];
  const capacitorRoot = path.join(repoRoot, 'node_modules', '@capacitor');
  if (!fs.existsSync(capacitorRoot)) {
    return files;
  }

  const packages = fs
    .readdirSync(capacitorRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const packageName of packages) {
    const packageRoot = path.join(capacitorRoot, packageName);
    const candidates = [
      path.join(packageRoot, 'android', 'build.gradle'),
      path.join(packageRoot, 'capacitor', 'build.gradle')
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        files.push(candidate);
      }
    }
  }

  return Array.from(new Set(files));
}

function alignGradleFile(filePath, targetMajor) {
  if (!fs.existsSync(filePath)) {
    return { changed: false, skipped: true };
  }
  const source = fs.readFileSync(filePath, 'utf8');
  const desiredSourceLine = `sourceCompatibility JavaVersion.toVersion(${targetMajor})`;
  const desiredTargetLine = `targetCompatibility JavaVersion.toVersion(${targetMajor})`;
  let updated = source.replace(
    /sourceCompatibility\s+JavaVersion\.[^\r\n]+/g,
    desiredSourceLine
  );
  updated = updated.replace(
    /targetCompatibility\s+JavaVersion\.[^\r\n]+/g,
    desiredTargetLine
  );
  updated = updated.replace(
    /jvmToolchain\(\s*\d+\s*\)/g,
    `jvmToolchain(${targetMajor})`
  );
  updated = updated.replace(
    /jvmToolchain\(\s*JavaLanguageVersion\.of\(\s*\d+\s*\)\s*\)/g,
    `jvmToolchain(${targetMajor})`
  );

  if (updated === source) {
    return { changed: false, skipped: false };
  }

  fs.writeFileSync(filePath, updated, 'utf8');
  return { changed: true, skipped: false };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const detectedMajor = args.javaMajor > 0 ? args.javaMajor : detectJavaMajorFromJavac();
  const targetMajor = Math.max(MIN_SUPPORTED_JAVA_MAJOR, detectedMajor || MIN_SUPPORTED_JAVA_MAJOR);
  const gradleFiles = listCapacitorGradleFiles();
  const changedFiles = [];
  const inspected = [];

  for (const filePath of gradleFiles) {
    const result = alignGradleFile(filePath, targetMajor);
    if (result.skipped) {
      continue;
    }
    const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
    inspected.push(relativePath);
    if (result.changed) {
      changedFiles.push(relativePath);
    }
  }

  if (inspected.length === 0) {
    console.error('[Capacitor Java Align] No Capacitor Gradle files were discovered.');
    process.exit(1);
  }

  if (changedFiles.length === 0) {
    console.log(
      `[Capacitor Java Align] Verified Java compatibility alignment (Java ${targetMajor}) across ${inspected.length} file(s).`
    );
    return;
  }

  console.log(
    `[Capacitor Java Align] Updated Java compatibility to ${targetMajor} in ${changedFiles.length} file(s): ${changedFiles.join(', ')}`
  );
}

main();
