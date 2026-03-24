#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const mapPath = path.join(repoRoot, 'docs', 'diataxis-map.json');

function fail(message) {
  console.error(`[Diataxis Verify] FAIL ${message}`);
  process.exit(1);
}

function loadMap() {
  if (!fs.existsSync(mapPath)) {
    fail(`Mapping file not found: ${mapPath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`Unable to parse diataxis-map.json: ${detail}`);
  }
}

function assertFileExists(relPath, label) {
  const normalized = String(relPath || '').replace(/\\/g, '/').trim();
  if (!normalized) {
    fail(`${label} path is empty.`);
  }
  const absolute = path.resolve(repoRoot, normalized);
  if (!fs.existsSync(absolute)) {
    fail(`${label} path does not exist: ${normalized}`);
  }
}

function main() {
  const mapping = loadMap();
  const categories = Array.isArray(mapping.categories) ? mapping.categories : [];
  const entries = Array.isArray(mapping.entries) ? mapping.entries : [];

  if (categories.length === 0) {
    fail('categories array must be non-empty.');
  }
  if (entries.length === 0) {
    fail('entries array must be non-empty.');
  }

  const allowedCategorySet = new Set(categories.map((item) => String(item).trim()));
  const ids = new Set();
  const diataxisPathSet = new Set();
  const canonicalPathSet = new Set();
  const categoryCounters = Object.fromEntries(Array.from(allowedCategorySet).map((key) => [key, 0]));

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      fail('Each mapping entry must be an object.');
    }
    const id = String(entry.id || '').trim();
    const category = String(entry.category || '').trim();
    if (!id) {
      fail('Entry id is required.');
    }
    if (ids.has(id)) {
      fail(`Duplicate entry id detected: ${id}`);
    }
    ids.add(id);

    if (!allowedCategorySet.has(category)) {
      fail(`Entry "${id}" uses unknown category "${category}".`);
    }
    categoryCounters[category] += 1;

    for (const langKey of ['en', 'zh']) {
      const lang = entry[langKey];
      if (!lang || typeof lang !== 'object') {
        fail(`Entry "${id}" missing "${langKey}" block.`);
      }
      const canonical = Array.isArray(lang.canonical) ? lang.canonical : [];
      if (canonical.length === 0) {
        fail(`Entry "${id}" "${langKey}" canonical list must be non-empty.`);
      }
      const diataxis = String(lang.diataxis || '').trim();
      if (!diataxis) {
        fail(`Entry "${id}" "${langKey}" diataxis path is required.`);
      }
      if (!diataxis.includes(`/diataxis/${langKey}/`) && !diataxis.includes(`\\diataxis\\${langKey}\\`)) {
        fail(`Entry "${id}" "${langKey}" diataxis path must be under docs/diataxis/${langKey}/.`);
      }

      assertFileExists(diataxis, `Entry "${id}" ${langKey} diataxis`);
      diataxisPathSet.add(`${langKey}:${diataxis.replace(/\\/g, '/')}`);

      for (const sourcePath of canonical) {
        assertFileExists(sourcePath, `Entry "${id}" ${langKey} canonical`);
        canonicalPathSet.add(`${langKey}:${String(sourcePath).replace(/\\/g, '/')}`);
      }
    }
  }

  const summaryParts = Object.entries(categoryCounters).map(
    ([category, count]) => `${category}:${count}`
  );
  console.log(
    `[Diataxis Verify] PASS entries=${entries.length} categories=[${summaryParts.join(', ')}] ` +
      `diataxisPaths=${diataxisPathSet.size} canonicalRefs=${canonicalPathSet.size}`
  );
}

main();
