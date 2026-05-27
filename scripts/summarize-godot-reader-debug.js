#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEBUG_DIR = path.join(REPO_ROOT, 'tmp', 'godot-reader-debug');

function parseArgs(argv) {
  const result = {
    dir: DEBUG_DIR,
    needle: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    if (token === '--dir' && argv[index + 1]) {
      result.dir = path.resolve(REPO_ROOT, argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === '--needle' && argv[index + 1]) {
      result.needle = String(argv[index + 1]).trim().toLowerCase();
      index += 1;
    }
  }
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.dir)) {
    throw new Error(`Godot reader debug directory does not exist: ${args.dir}`);
  }

  const entries = fs.readdirSync(args.dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const absolutePath = path.join(args.dir, name);
      const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
      return {
        file: absolutePath,
        kind: parsed.kind || '',
        title: parsed.title || '',
        filePath: parsed.filePath || '',
        blockId: parsed.blockId,
        textureWidth: parsed.textureWidth,
        textureHeight: parsed.textureHeight,
        imagePath: parsed.imagePath || '',
        sourcePath: parsed.sourcePath || '',
      };
    });

  const filtered = args.needle
    ? entries.filter((entry) => JSON.stringify(entry).toLowerCase().includes(args.needle))
    : entries;

  console.log(JSON.stringify({
    dir: args.dir,
    count: filtered.length,
    entries: filtered,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error('[summarize-godot-reader-debug] FAIL:', error && error.stack ? error.stack : String(error));
  process.exit(1);
}
