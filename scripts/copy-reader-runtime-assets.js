const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const sourceFile = path.join(projectRoot, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
const packageJsonPath = path.join(projectRoot, 'node_modules', 'mermaid', 'package.json');
const targetDir = path.join(projectRoot, 'src', 'generated');
const targetFile = path.join(targetDir, 'mermaid_runtime.ts');

if (!fs.existsSync(sourceFile)) {
  throw new Error(`Mermaid browser bundle not found at ${sourceFile}`);
}

const mermaidPackage = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const base64 = fs.readFileSync(sourceFile).toString('base64');
fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(
  targetFile,
  [
    `export const MERMAID_RUNTIME_VERSION = '${mermaidPackage.version}';`,
    `export const MERMAID_BROWSER_BUNDLE_BASE64 = '${base64}';`,
    '',
  ].join('\n'),
  'utf8'
);
console.log(`[reader-runtime] Mermaid browser bundle embedded at ${targetFile}`);
