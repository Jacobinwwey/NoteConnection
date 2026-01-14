const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/frontend');
const dest = path.join(__dirname, '../dist/src/frontend');

// Check for --mini flag in command line arguments
const isMiniMode = process.argv.includes('--mini');

console.log(`\n📦 Build Mode: ${isMiniMode ? 'MINI (Excluding large data files)' : 'FULL (Including all files)'}\n`);

// Files to exclude ONLY in mini mode (runtime-generated data)
const MINI_EXCLUDE_FILES = [
    'data.js',                  // 169 MB - Runtime generated graph data
    'graph_data.json',          // 471 MB - Runtime generated JSON
];

// Patterns to exclude ONLY in mini mode (case-insensitive)
const MINI_EXCLUDE_PATTERNS = [
    /^data_cli_.*\.js$/,        // CLI-generated data files
    /^graph_data_cli_.*\.json$/ // CLI-generated graph files
];

function shouldExclude(filename) {
    // If not in mini mode, include everything
    if (!isMiniMode) {
        return false;
    }
    
    // In mini mode, check exclusion rules
    // Check exact matches
    if (MINI_EXCLUDE_FILES.includes(filename)) {
        return true;
    }
    
    // Check patterns
    return MINI_EXCLUDE_PATTERNS.some(pattern => pattern.test(filename));
}

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        // Skip excluded files (only in mini mode)
        if (!entry.isDirectory() && shouldExclude(entry.name)) {
            const sizeMB = (fs.statSync(srcPath).size / 1024 / 1024).toFixed(2);
            console.log(`  [Excluded] ${entry.name} (${sizeMB} MB)`);
            
            // Critical Fix: Ensure the file is removed from dist if it exists from a previous build
            if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
                console.log(`  [Cleaned] Removed existing artifact: ${entry.name}`);
            }
            continue;
        }

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

try {
    copyDir(src, dest);
    
    // Copy locale files for i18n support
    const localesSrc = path.join(src, 'locales');
    const localesDest = path.join(dest, 'locales');
    if (fs.existsSync(localesSrc)) {
        console.log('\\n📁 Copying locale files...');
        copyDir(localesSrc, localesDest);
        console.log('  ✓ Locale files copied');
    }
    
    // Copy README.md for offline docs fallback
    const readmeSrc = path.join(__dirname, '../README.md');
    const readmeDest = path.join(dest, 'README.md');
    if (fs.existsSync(readmeSrc)) {
         fs.copyFileSync(readmeSrc, readmeDest);
         console.log('  ✓ README.md copied');
    }

    // Copy User Manual (English) - PRIMARY offline documentation
    const manualSrc = path.join(src, 'User_Manual.md');
    const manualDest = path.join(dest, 'User_Manual.md');
    if (fs.existsSync(manualSrc)) {
         fs.copyFileSync(manualSrc, manualDest);
         console.log('  ✓ User_Manual.md (English) copied');
    } else {
        console.warn('  ⚠️  User_Manual.md not found in src/frontend');
        
        // Fallback: Try root directory
        const manualRootSrc = path.join(__dirname, '../User_Manual.md');
        if (fs.existsSync(manualRootSrc)) {
            fs.copyFileSync(manualRootSrc, manualDest);
            console.log('  ✓ User_Manual.md copied from root');
        }
    }
    
    // Copy User Manual (Chinese) - For Chinese language support
    const manualZhSrc = path.join(src, 'User_Manual_zh.md');
    const manualZhDest = path.join(dest, 'User_Manual_zh.md');
    if (fs.existsSync(manualZhSrc)) {
         fs.copyFileSync(manualZhSrc, manualZhDest);
         console.log('  ✓ User_Manual_zh.md (Chinese) copied');
    } else {
        console.warn('  ⚠️  User_Manual_zh.md not found');
    }

    console.log(`\\n✅ Assets copied from ${src} to ${dest}`);
    console.log(`\\n📊 Build Summary:`);
    console.log(`  - Mode: ${isMiniMode ? 'MINI' : 'FULL'}`);
    console.log(`  - i18n: Locale files included`);
    console.log(`  - Docs: User manuals (EN + ZH) included`);
    console.log(`  - Tutorial: CSS and scripts included`);
} catch (e) {
    console.error('❌ Error copying assets:', e);
    process.exit(1);
}
