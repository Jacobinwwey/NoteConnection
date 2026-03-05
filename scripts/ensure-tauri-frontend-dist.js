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

function runAttempt(command, args, opts = {}) {
    return spawnSync(command, args, {
        cwd: projectRoot,
        stdio: 'inherit',
        env: process.env,
        ...opts,
    });
}

function runNpmBuildMini() {
    const attempts = [];
    const npmExecPath = process.env.npm_execpath;

    // Most reliable path inside npm-runner contexts (GitHub Actions included).
    if (npmExecPath) {
        attempts.push({
            label: `node ${npmExecPath} run build:mini`,
            command: process.execPath,
            args: [npmExecPath, 'run', 'build:mini'],
        });
    }

    // Platform fallback in case npm_execpath is unavailable.
    attempts.push(
        process.platform === 'win32'
            ? {
                  label: 'npm.cmd run build:mini',
                  command: 'npm.cmd',
                  args: ['run', 'build:mini'],
                  opts: { shell: true },
              }
            : {
                  label: 'npm run build:mini',
                  command: 'npm',
                  args: ['run', 'build:mini'],
              },
    );

    const errors = [];
    for (const attempt of attempts) {
        console.log(`[test:tauri] Executing: ${attempt.label}`);
        const result = runAttempt(attempt.command, attempt.args, attempt.opts);

        if (result.error) {
            errors.push(`${attempt.label}: ${result.error.message}`);
            continue;
        }

        if (typeof result.status === 'number' && result.status === 0) {
            return;
        }

        process.exit(typeof result.status === 'number' ? result.status : 1);
    }

    console.error('[test:tauri] Failed to execute npm run build:mini');
    for (const error of errors) {
        console.error(`[test:tauri] ${error}`);
    }
    process.exit(1);
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
