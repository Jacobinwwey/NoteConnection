const https = require('https');
const fs = require('fs');
const path = require('path');

const D3_URL = 'https://d3js.org/d3.v7.min.js';
const DEST_DIR = path.join(__dirname, '../src/frontend/libs');
const DEST_FILE = path.join(DEST_DIR, 'd3.v7.min.js');

console.log('📥 Downloading D3.js v7 for offline use...');
console.log(`   Source: ${D3_URL}`);
console.log(`   Destination: ${DEST_FILE}`);

// Ensure destination directory exists
if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
}

const file = fs.createWriteStream(DEST_FILE);

https.get(D3_URL, (response) => {
    if (response.statusCode !== 200) {
        console.error(`❌ Failed to download: HTTP ${response.statusCode}`);
        process.exit(1);
    }

    response.pipe(file);

    file.on('finish', () => {
        file.close();
        const stats = fs.statSync(DEST_FILE);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`✅ Downloaded successfully! (${sizeMB} MB)`);
        console.log('');
        console.log('🔧 Next step: Update index.html to use local D3:');
        console.log('   Change: <script src="https://d3js.org/d3.v7.min.js"></script>');
        console.log('   To:     <script src="libs/d3.v7.min.js"></script>');
        console.log('');
        console.log('🔒 And remove https://d3js.org from CSP policy.');
    });
}).on('error', (err) => {
    fs.unlink(DEST_FILE, () => {}); // Delete the file on error
    console.error(`❌ Download error: ${err.message}`);
    process.exit(1);
});
