const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const targetDir = path.join(projectRoot, 'src', 'generated');
const mermaidSourceFile = path.join(projectRoot, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
const mermaidPackageJsonPath = path.join(projectRoot, 'node_modules', 'mermaid', 'package.json');
const mermaidTargetFile = path.join(targetDir, 'mermaid_runtime.ts');
const resvgSourceFile = path.join(projectRoot, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm');
const resvgPackageJsonPath = path.join(projectRoot, 'node_modules', '@resvg', 'resvg-wasm', 'package.json');
const resvgTargetFile = path.join(targetDir, 'resvg_runtime.ts');

function assertExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found at ${filePath}`);
  }
}

function readPackageVersion(packageJsonPath) {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;
}

function embedBase64Module(targetFile, exportsMap) {
  const lines = Object.entries(exportsMap).map(([name, value]) => `export const ${name} = ${JSON.stringify(value)};`);
  fs.writeFileSync(targetFile, [...lines, ''].join('\n'), 'utf8');
}

assertExists(mermaidSourceFile, 'Mermaid browser bundle');
assertExists(mermaidPackageJsonPath, 'Mermaid package metadata');
assertExists(resvgSourceFile, 'Resvg WASM bundle');
assertExists(resvgPackageJsonPath, 'Resvg package metadata');

const mermaidVersion = readPackageVersion(mermaidPackageJsonPath);
const mermaidBase64 = fs.readFileSync(mermaidSourceFile).toString('base64');
const resvgVersion = readPackageVersion(resvgPackageJsonPath);
const resvgBase64 = fs.readFileSync(resvgSourceFile).toString('base64');

fs.mkdirSync(targetDir, { recursive: true });
embedBase64Module(mermaidTargetFile, {
  MERMAID_RUNTIME_VERSION: mermaidVersion,
  MERMAID_BROWSER_BUNDLE_BASE64: mermaidBase64,
});
embedBase64Module(resvgTargetFile, {
  RESVG_RUNTIME_VERSION: resvgVersion,
  RESVG_WASM_BASE64: resvgBase64,
});

console.log(`[reader-runtime] Mermaid browser bundle embedded at ${mermaidTargetFile}`);
console.log(`[reader-runtime] Resvg WASM embedded at ${resvgTargetFile}`);
