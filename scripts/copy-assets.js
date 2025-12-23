const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/frontend');
const dest = path.join(__dirname, '../dist/frontend');

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
    console.log(`Assets copied from ${src} to ${dest}`);
} catch (e) {
    console.error('Error copying assets:', e);
    process.exit(1);
}
