const fs = require('fs');
const path = require('path');

const DIST_CORE = path.join(__dirname, '../dist/src/core');
const DEFAULT_DEST = path.join(__dirname, '../src/frontend/libs/path_core.js');

function cleanContent(content) {
    let cleaner = content.replace(/const \w+ = require\(.*\);/g, '');
    cleaner = cleaner.replace(/Object\.defineProperty\(exports, "__esModule"[\s\S]*?\);/g, '');
    cleaner = cleaner.replace(/exports\.\w+ = void 0;/g, '');
    cleaner = cleaner.replace(/exports\.(\w+) = \1;/g, '$1 = $1;');
    return cleaner;
}

function bundlePathCore(options = {}) {
    const distCoreDir = options.distCoreDir || DIST_CORE;
    const dest = options.destOverride || DEFAULT_DEST;
    const graphFile = path.join(distCoreDir, 'Graph.js');
    const engineFile = path.join(distCoreDir, 'PathEngine.js');
    const orbitalStateFile = path.join(distCoreDir, 'OrbitalState.js');

    console.log('📦 Bundling Path Core...');

    if (!fs.existsSync(graphFile) || !fs.existsSync(engineFile) || !fs.existsSync(orbitalStateFile)) {
        console.error('❌ Build artifacts not found. Run "tsc" first.');
        process.exitCode = 1;
        return null;
    }

    const shim = `
var exports = {};
var module = { exports: exports };
// Global scope exposure
// var Graph, PathEngine;
`;

    const graphContent = fs.readFileSync(graphFile, 'utf8');
    const engineContent = fs.readFileSync(engineFile, 'utf8');
    const orbitalStateContent = fs.readFileSync(orbitalStateFile, 'utf8');
    const graphClean = cleanContent(graphContent);
    const engineClean = cleanContent(engineContent);
    const orbitalStateClean = cleanContent(orbitalStateContent);

    const bundle = `
/* Auto-bundled Path Core */
(function() {
    ${shim}

    /* Graph.js */
    ${graphClean}
    self.Graph = Graph;

    /* PathEngine.js */
    ${engineClean}
    self.PathEngine = PathEngine;

    /* OrbitalState.js */
    ${orbitalStateClean}
    self.OrbitalState = OrbitalState;
})();
`;

    fs.writeFileSync(dest, bundle);
    console.log(`✅ Bundled to ${dest}`);
    return dest;
}

if (require.main === module) {
    const result = bundlePathCore();
    if (!result) {
        process.exit(1);
    }
}

module.exports = {
    bundlePathCore,
};
