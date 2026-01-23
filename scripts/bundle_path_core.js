const fs = require('fs');
const path = require('path');

const DIST_CORE = path.join(__dirname, '../dist/src/core');
const DEST = path.join(__dirname, '../src/frontend/libs/path_core.js');

console.log('📦 Bundling Path Core...');

// We need the compiled JS files from dist
const graphFile = path.join(DIST_CORE, 'Graph.js');
const engineFile = path.join(DIST_CORE, 'PathEngine.js');

if (!fs.existsSync(graphFile) || !fs.existsSync(engineFile)) {
    console.error('❌ Build artifacts not found. Run "tsc" first.');
    process.exit(1);
}

// Simple concatenator that strips "require" and "exports" to make it Worker-friendly
// Ideally we shim them.

const shim = `
var exports = {};
var module = { exports: exports };
// Global scope exposure
// var Graph, PathEngine; // Removed to avoid syntax error with class declaration
`;

// Read files
let graphContent = fs.readFileSync(graphFile, 'utf8');
let engineContent = fs.readFileSync(engineFile, 'utf8');

// Function to clean CommonJS artifacts for global scope usage
function cleanContent(content, className) {
    // Remove imports/requires (we assume they are available via concatenation)
    // Remove "Object.defineProperty(exports, ...)"
    // Expose class globally
    
    // Very basic regex cleaning - assumes standard TSC output
    // 1. Remove "require" lines
    let cleaner = content.replace(/const \w+ = require\(.*\);/g, '');
    cleaner = cleaner.replace(/Object\.defineProperty\(exports, "__esModule"[\s\S]*?\);/g, '');
    cleaner = cleaner.replace(/exports\.\w+ = void 0;/g, '');
    
    // Capture the class/function export and assign to global
    // "exports.Graph = Graph;" -> "Graph = Graph;" (implicitly global if declared var above)
    cleaner = cleaner.replace(/exports\.(\w+) = \1;/g, '$1 = $1;');
    
    return cleaner;
}

const graphClean = cleanContent(graphContent, 'Graph');
const engineClean = cleanContent(engineContent, 'PathEngine');

const bundle = `
/* Auto-bundled Path Core */
(function() {
    ${shim}
    
    /* Graph.js */
    ${graphClean}
    // Explicitly expose
    self.Graph = Graph;
    
    /* PathEngine.js */
    ${engineClean}
    // Explicitly expose
    self.PathEngine = PathEngine;
    
})();
`;

fs.writeFileSync(DEST, bundle);
console.log(`✅ Bundled to ${DEST}`);
