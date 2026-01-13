const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/frontend');
const dest = path.join(__dirname, '../dist/src/frontend');

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

try {
    copyDir(src, dest);
    
    // Copy README.md for offline docs
    const readmeSrc = path.join(__dirname, '../README.md');
    const readmeDest = path.join(dest, 'README.md');
    if (fs.existsSync(readmeSrc)) {
         fs.copyFileSync(readmeSrc, readmeDest);
         console.log(`README.md copied to ${readmeDest}`);
    } else {
        console.warn('README.md not found for offline docs.');
    }

    console.log(`Assets copied from ${src} to ${dest}`);
} catch (e) {
    console.error('Error copying assets:', e);
    process.exit(1);
}
