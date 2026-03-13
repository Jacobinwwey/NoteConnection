#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const defaultSbomPath = path.join(repoRoot, 'build', 'sbom', 'noteconnection-sbom.cdx.json');
const defaultPackageJsonPath = path.join(repoRoot, 'package.json');
const defaultMaxAgeHours = 168;

function parseBoolean(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseInteger(value, fallback) {
  const number = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function parseArgs(argv) {
  const options = {
    sbomPath: defaultSbomPath,
    packageJsonPath: defaultPackageJsonPath,
    contractOnly: false,
    strict: parseBoolean(process.env.NOTE_CONNECTION_REQUIRE_SBOM_POLICY),
    allowMissing: parseBoolean(process.env.NOTE_CONNECTION_ALLOW_MISSING_SBOM),
    requireDevDependencies: parseBoolean(process.env.NOTE_CONNECTION_SBOM_REQUIRE_DEV_DEPS),
    maxAgeHours: parseInteger(process.env.NOTE_CONNECTION_SBOM_MAX_AGE_HOURS, defaultMaxAgeHours),
    minComponentCount: parseInteger(process.env.NOTE_CONNECTION_SBOM_MIN_COMPONENTS, 1)
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = String(argv[index] || '').trim();
    if (!arg) {
      continue;
    }

    if (arg === '--sbom' && index + 1 < argv.length) {
      options.sbomPath = path.resolve(repoRoot, String(argv[index + 1]));
      index += 1;
      continue;
    }

    if (arg === '--package' && index + 1 < argv.length) {
      options.packageJsonPath = path.resolve(repoRoot, String(argv[index + 1]));
      index += 1;
      continue;
    }

    if (arg === '--strict' && index + 1 < argv.length) {
      options.strict = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--allow-missing' && index + 1 < argv.length) {
      options.allowMissing = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--require-dev-dependencies' && index + 1 < argv.length) {
      options.requireDevDependencies = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--max-age-hours' && index + 1 < argv.length) {
      options.maxAgeHours = parseInteger(argv[index + 1], options.maxAgeHours);
      index += 1;
      continue;
    }

    if (arg === '--min-components' && index + 1 < argv.length) {
      options.minComponentCount = parseInteger(argv[index + 1], options.minComponentCount);
      index += 1;
      continue;
    }

    if (arg === '--contract-only') {
      options.contractOnly = true;
      continue;
    }
  }

  return options;
}

function toRelativePath(targetPath) {
  return path.relative(repoRoot, targetPath).replace(/\\/g, '/');
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${label} (${toRelativePath(filePath)}): ${message}`);
  }
}

function collectComponentNames(sbom) {
  const components = Array.isArray(sbom.components) ? sbom.components : [];
  const componentNames = new Set();
  components.forEach((component) => {
    if (!component || typeof component !== 'object') {
      return;
    }
    const name = typeof component.name === 'string' ? component.name.trim() : '';
    if (!name) {
      return;
    }
    componentNames.add(name);
  });
  return componentNames;
}

function validateSbomStructure(sbom, pkg, options, failures) {
  if (!sbom || typeof sbom !== 'object') {
    failures.push('SBOM JSON root must be an object.');
    return;
  }

  if (sbom.bomFormat !== 'CycloneDX') {
    failures.push(`Expected sbom.bomFormat to be "CycloneDX", received "${sbom.bomFormat}".`);
  }

  if (typeof sbom.specVersion !== 'string' || sbom.specVersion.trim().length === 0) {
    failures.push('SBOM specVersion must be a non-empty string.');
  }

  if (typeof sbom.serialNumber !== 'string' || !sbom.serialNumber.startsWith('urn:uuid:')) {
    failures.push('SBOM serialNumber must be a valid "urn:uuid:*" string.');
  }

  const metadata = sbom.metadata && typeof sbom.metadata === 'object' ? sbom.metadata : null;
  if (!metadata || typeof metadata.component !== 'object') {
    failures.push('SBOM metadata.component is required.');
  } else {
    const metadataName = String(metadata.component.name || '');
    const metadataVersion = String(metadata.component.version || '');
    if (metadataName !== String(pkg.name || '')) {
      failures.push(
        `SBOM metadata.component.name mismatch. Expected "${pkg.name}", received "${metadataName}".`
      );
    }
    if (metadataVersion !== String(pkg.version || '')) {
      failures.push(
        `SBOM metadata.component.version mismatch. Expected "${pkg.version}", received "${metadataVersion}".`
      );
    }
  }

  const components = Array.isArray(sbom.components) ? sbom.components : [];
  if (components.length < options.minComponentCount) {
    failures.push(
      `SBOM component count ${components.length} is below minimum required ${options.minComponentCount}.`
    );
  }

  const seenBomRefs = new Set();
  components.forEach((component, index) => {
    if (!component || typeof component !== 'object') {
      failures.push(`Component at index ${index} must be an object.`);
      return;
    }

    const name = typeof component.name === 'string' ? component.name.trim() : '';
    const version = typeof component.version === 'string' ? component.version.trim() : '';
    const bomRef = typeof component['bom-ref'] === 'string' ? component['bom-ref'].trim() : '';
    const purl = typeof component.purl === 'string' ? component.purl.trim() : '';

    if (!name) {
      failures.push(`Component at index ${index} is missing a non-empty name.`);
    }
    if (!version) {
      failures.push(`Component "${name || index}" is missing a non-empty version.`);
    }
    if (!bomRef) {
      failures.push(`Component "${name || index}" is missing a non-empty bom-ref.`);
    }
    if (!purl.startsWith('pkg:npm/')) {
      failures.push(`Component "${name || index}" has invalid purl "${purl}".`);
    }
    if (bomRef) {
      if (seenBomRefs.has(bomRef)) {
        failures.push(`Duplicate component bom-ref detected: ${bomRef}`);
      } else {
        seenBomRefs.add(bomRef);
      }
    }
  });

  const dependencyEntries = Array.isArray(sbom.dependencies) ? sbom.dependencies : [];
  if (dependencyEntries.length === 0) {
    failures.push('SBOM dependencies array must include at least the root dependency entry.');
  }
}

function validateDependencyCoverage(sbom, pkg, options, failures) {
  const componentNames = collectComponentNames(sbom);
  const requiredProductionDependencies = Object.keys(pkg.dependencies || {}).sort();
  const requiredDevelopmentDependencies = Object.keys(pkg.devDependencies || {}).sort();

  const missingProductionDependencies = requiredProductionDependencies.filter(
    (dependencyName) => !componentNames.has(dependencyName)
  );
  if (missingProductionDependencies.length > 0) {
    failures.push(
      `SBOM is missing production dependency components: ${missingProductionDependencies.join(', ')}`
    );
  }

  if (options.requireDevDependencies) {
    const missingDevelopmentDependencies = requiredDevelopmentDependencies.filter(
      (dependencyName) => !componentNames.has(dependencyName)
    );
    if (missingDevelopmentDependencies.length > 0) {
      failures.push(
        `SBOM is missing development dependency components: ${missingDevelopmentDependencies.join(', ')}`
      );
    }
  }
}

function validateSbomFreshness(sbomPath, maxAgeHours, failures) {
  if (maxAgeHours <= 0) {
    return;
  }
  const stats = fs.statSync(sbomPath);
  const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
  if (ageHours > maxAgeHours) {
    failures.push(
      `SBOM artifact is stale (${ageHours.toFixed(2)}h old), exceeding max age ${maxAgeHours}h.`
    );
  }
}

function main() {
  const options = parseArgs(process.argv);

  if (options.contractOnly) {
    console.log('[SBOM Verify] Contract-only mode passed.');
    console.log(`[SBOM Verify] sbomPath=${toRelativePath(options.sbomPath)}`);
    console.log(`[SBOM Verify] strict=${options.strict}`);
    console.log(`[SBOM Verify] maxAgeHours=${options.maxAgeHours}`);
    return;
  }

  if (!fs.existsSync(options.packageJsonPath)) {
    console.error(`[SBOM Verify] package.json not found: ${options.packageJsonPath}`);
    process.exit(1);
    return;
  }

  if (!fs.existsSync(options.sbomPath)) {
    if (!options.strict && options.allowMissing) {
      console.warn(
        `[SBOM Verify] SBOM missing at ${toRelativePath(options.sbomPath)} but allowed in non-strict mode.`
      );
      return;
    }
    console.error(
      `[SBOM Verify] SBOM not found at ${toRelativePath(options.sbomPath)}. Run "npm run generate:sbom" first.`
    );
    process.exit(1);
    return;
  }

  const pkg = readJson(options.packageJsonPath, 'package.json');
  const sbom = readJson(options.sbomPath, 'SBOM');
  const failures = [];
  validateSbomStructure(sbom, pkg, options, failures);
  validateDependencyCoverage(sbom, pkg, options, failures);
  validateSbomFreshness(options.sbomPath, options.maxAgeHours, failures);

  if (failures.length > 0) {
    failures.forEach((failure) => {
      console.error(`[SBOM Verify] FAIL ${failure}`);
    });
    process.exit(1);
    return;
  }

  const componentCount = Array.isArray(sbom.components) ? sbom.components.length : 0;
  console.log(
    `[SBOM Verify] PASS ${toRelativePath(options.sbomPath)} (components=${componentCount}, strict=${options.strict})`
  );
}

main();
