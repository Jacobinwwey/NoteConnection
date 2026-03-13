#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');
const defaultOutputPath = path.join(repoRoot, 'build', 'sbom', 'noteconnection-sbom.cdx.json');
const defaultPackageJsonPath = path.join(repoRoot, 'package.json');
const defaultLockfilePath = path.join(repoRoot, 'package-lock.json');

const INTEGRITY_ALGO_MAP = {
  sha512: 'SHA-512',
  sha384: 'SHA-384',
  sha256: 'SHA-256',
  sha1: 'SHA-1',
  md5: 'MD5'
};

function parseBoolean(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseArgs(argv) {
  const options = {
    outputPath: defaultOutputPath,
    packageJsonPath: defaultPackageJsonPath,
    lockfilePath: defaultLockfilePath,
    includeDevDependencies: parseBoolean(
      process.env.NOTE_CONNECTION_SBOM_INCLUDE_DEV === undefined
        ? '1'
        : process.env.NOTE_CONNECTION_SBOM_INCLUDE_DEV
    ),
    serialNumber: null
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = String(argv[index] || '').trim();
    if (!arg) {
      continue;
    }

    if (arg === '--output' && index + 1 < argv.length) {
      options.outputPath = path.resolve(repoRoot, String(argv[index + 1]));
      index += 1;
      continue;
    }

    if (arg === '--package' && index + 1 < argv.length) {
      options.packageJsonPath = path.resolve(repoRoot, String(argv[index + 1]));
      index += 1;
      continue;
    }

    if (arg === '--lockfile' && index + 1 < argv.length) {
      options.lockfilePath = path.resolve(repoRoot, String(argv[index + 1]));
      index += 1;
      continue;
    }

    if (arg === '--include-dev' && index + 1 < argv.length) {
      options.includeDevDependencies = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--serial-number' && index + 1 < argv.length) {
      options.serialNumber = String(argv[index + 1]).trim() || null;
      index += 1;
      continue;
    }
  }

  return options;
}

function ensureFileExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found: ${targetPath}`);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toCycloneDxHash(integrity) {
  const value = String(integrity || '').trim();
  if (!value || !value.includes('-')) {
    return null;
  }

  const separatorIndex = value.indexOf('-');
  const algorithm = value.slice(0, separatorIndex).toLowerCase();
  const encodedDigest = value.slice(separatorIndex + 1);
  const cycloneDxAlgorithm = INTEGRITY_ALGO_MAP[algorithm];
  if (!cycloneDxAlgorithm || !encodedDigest) {
    return null;
  }

  try {
    const digestHex = Buffer.from(encodedDigest, 'base64').toString('hex');
    if (!digestHex) {
      return null;
    }
    return {
      alg: cycloneDxAlgorithm,
      content: digestHex
    };
  } catch (_error) {
    return null;
  }
}

function normalizePackageName(packagePath, packageInfo) {
  if (packageInfo && typeof packageInfo.name === 'string' && packageInfo.name.trim().length > 0) {
    return packageInfo.name.trim();
  }

  const normalizedPath = String(packagePath || '').replace(/\\/g, '/');
  const marker = 'node_modules/';
  const markerIndex = normalizedPath.lastIndexOf(marker);
  if (markerIndex < 0) {
    return '';
  }
  return normalizedPath.slice(markerIndex + marker.length);
}

function makePurl(name, version) {
  if (name.startsWith('@')) {
    const parts = name.slice(1).split('/');
    if (parts.length === 2) {
      return `pkg:npm/%40${encodeURIComponent(parts[0])}%2F${encodeURIComponent(parts[1])}@${encodeURIComponent(version)}`;
    }
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function makeSerialNumber(overrideSerialNumber) {
  if (overrideSerialNumber) {
    return overrideSerialNumber;
  }
  if (typeof crypto.randomUUID === 'function') {
    return `urn:uuid:${crypto.randomUUID()}`;
  }
  const fallback = crypto.randomBytes(16).toString('hex');
  return `urn:uuid:${fallback}`;
}

function buildComponents(lockfile, packageJson, includeDevDependencies) {
  const componentsByBomRef = new Map();
  const bomRefByInstallPath = new Map();
  const lockPackages =
    lockfile && lockfile.packages && typeof lockfile.packages === 'object'
      ? lockfile.packages
      : {};
  const rootDependencies = new Set(Object.keys(packageJson.dependencies || {}));
  const rootDevDependencies = new Set(Object.keys(packageJson.devDependencies || {}));

  const sortedEntries = Object.entries(lockPackages).sort(([left], [right]) => left.localeCompare(right));
  for (const [installPath, packageInfo] of sortedEntries) {
    if (!installPath || installPath === '.') {
      continue;
    }

    if (!packageInfo || typeof packageInfo !== 'object') {
      continue;
    }

    if (!includeDevDependencies && Boolean(packageInfo.dev)) {
      continue;
    }

    const name = normalizePackageName(installPath, packageInfo);
    const version = typeof packageInfo.version === 'string' ? packageInfo.version.trim() : '';
    if (!name || !version) {
      continue;
    }

    const purl = makePurl(name, version);
    const bomRef = purl;
    bomRefByInstallPath.set(installPath, bomRef);

    if (componentsByBomRef.has(bomRef)) {
      continue;
    }

    const component = {
      type: 'library',
      name,
      version,
      'bom-ref': bomRef,
      purl,
      properties: [
        {
          name: 'noteconnection:source',
          value: 'package-lock.json'
        },
        {
          name: 'noteconnection:devDependency',
          value: String(Boolean(packageInfo.dev))
        }
      ]
    };

    if (rootDependencies.has(name)) {
      component.properties.push({
        name: 'noteconnection:rootDependency',
        value: 'dependencies'
      });
    }
    if (rootDevDependencies.has(name)) {
      component.properties.push({
        name: 'noteconnection:rootDependency',
        value: 'devDependencies'
      });
    }

    const hash = toCycloneDxHash(packageInfo.integrity);
    if (hash) {
      component.hashes = [hash];
    }

    componentsByBomRef.set(bomRef, component);
  }

  const components = Array.from(componentsByBomRef.values()).sort((left, right) => {
    if (left.name !== right.name) {
      return left.name.localeCompare(right.name);
    }
    return left.version.localeCompare(right.version);
  });

  return {
    components,
    bomRefByInstallPath
  };
}

function buildRootDependencyRefs(packageJson, bomRefByInstallPath, includeDevDependencies) {
  const dependencyNames = new Set(Object.keys(packageJson.dependencies || {}));
  if (includeDevDependencies) {
    for (const devDependencyName of Object.keys(packageJson.devDependencies || {})) {
      dependencyNames.add(devDependencyName);
    }
  }

  const rootRefs = [];
  for (const dependencyName of Array.from(dependencyNames).sort()) {
    const directInstallPath = `node_modules/${dependencyName}`;
    const bomRef = bomRefByInstallPath.get(directInstallPath);
    if (bomRef) {
      rootRefs.push(bomRef);
    }
  }

  return rootRefs;
}

function createSbomDocument(packageJson, components, rootDependencyRefs, serialNumber) {
  const rootName = String(packageJson.name || 'noteconnection');
  const rootVersion = String(packageJson.version || '0.0.0');
  const rootPurl = makePurl(rootName, rootVersion);

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'NoteConnection',
          name: 'generate-sbom.js',
          version: '1.0.0'
        }
      ],
      component: {
        type: 'application',
        name: rootName,
        version: rootVersion,
        'bom-ref': rootPurl,
        purl: rootPurl
      }
    },
    components,
    dependencies: [
      {
        ref: rootPurl,
        dependsOn: rootDependencyRefs
      }
    ]
  };
}

function main() {
  const options = parseArgs(process.argv);
  ensureFileExists(options.packageJsonPath, 'package.json');
  ensureFileExists(options.lockfilePath, 'package-lock.json');

  const packageJson = readJson(options.packageJsonPath);
  const lockfile = readJson(options.lockfilePath);
  const serialNumber = makeSerialNumber(options.serialNumber);

  const { components, bomRefByInstallPath } = buildComponents(
    lockfile,
    packageJson,
    options.includeDevDependencies
  );
  const rootDependencyRefs = buildRootDependencyRefs(
    packageJson,
    bomRefByInstallPath,
    options.includeDevDependencies
  );
  const sbom = createSbomDocument(packageJson, components, rootDependencyRefs, serialNumber);

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');

  const relativeOutputPath = path.relative(repoRoot, options.outputPath).replace(/\\/g, '/');
  console.log(
    `[SBOM Generate] Wrote ${relativeOutputPath} (components=${components.length}, includeDevDependencies=${options.includeDevDependencies})`
  );
}

main();
