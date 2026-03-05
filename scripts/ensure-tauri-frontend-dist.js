const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const frontendDist = path.join(projectRoot, 'dist', 'src', 'frontend');

function isDirectory(targetPath) {
    try {
        return fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
    } catch {
        return false;
    }
}

function runNpmBuildMini() {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npmCommand, ['run', 'build:mini'], {
        cwd: projectRoot,
        stdio: 'inherit',
        env: process.env,
    });

    if (result.error) {
        console.error('[test:tauri] Failed to execute npm run build:mini');
        console.error(result.error.message);
        process.exit(1);
    }

    if (typeof result.status === 'number' && result.status !== 0) {
        process.exit(result.status);
    }
}

if (isDirectory(frontendDist)) {
    console.log(`[test:tauri] frontendDist found: ${frontendDist}`);
    process.exit(0);
}

console.log(
    `[test:tauri] Missing frontendDist at ${frontendDist}. Running npm run build:mini before cargo test.`,
);
runNpmBuildMini();

if (!isDirectory(frontendDist)) {
    console.error(
        `[test:tauri] frontendDist is still missing after build:mini. Expected directory: ${frontendDist}`,
    );
    process.exit(1);
}

console.log(`[test:tauri] frontendDist prepared: ${frontendDist}`);
