import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';

type ChildResult = {
    code: number | null;
    output: string;
};

function runChild(script: string, args: string[] = []): Promise<ChildResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['-e', script, ...args], {
            cwd: path.resolve(__dirname, '..'),
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });
        let output = '';
        child.stdout.on('data', (chunk) => { output += String(chunk); });
        child.stderr.on('data', (chunk) => { output += String(chunk); });
        child.once('error', reject);
        child.once('close', (code) => resolve({ code, output }));
    });
}

function waitForOutput(childScript: string, args: string[] = []): Promise<{ child: ReturnType<typeof spawn>; output: string }> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['-e', childScript, ...args], {
            cwd: path.resolve(__dirname, '..'),
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });
        let output = '';
        let timer: NodeJS.Timeout;
        const onData = (chunk: Buffer | string) => {
            output += String(chunk);
            if (output.includes('acquired')) {
                clearTimeout(timer);
                child.stdout.off('data', onData);
                resolve({ child, output });
            }
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        timer = setTimeout(() => {
            child.kill();
            reject(new Error(`Timed out waiting for child lock acquisition. Output: ${output}`));
        }, 2500);
        child.once('close', (code) => {
            if (!output.includes('acquired')) {
                clearTimeout(timer);
                reject(new Error(`Lock holder exited before acquisition (code=${String(code)}). Output: ${output}`));
            }
        });
        child.once('error', reject);
    });
}

function waitForChildClose(child: ReturnType<typeof spawn>): Promise<void> {
    if (child.exitCode !== null) {
        return Promise.resolve();
    }
    return new Promise((resolve) => child.once('close', () => resolve()));
}

describe('sidecar build lock', () => {
    test('rejects an empty lock path at the boundary', () => {
        expect(() => {
            const { acquireSidecarBuildLock } = require('../scripts/sidecar-build-lock.js');
            acquireSidecarBuildLock('');
        }).toThrow('A concrete sidecar build lock path is required.');
    });

    test('serializes independent ensure processes and releases the lock', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sidecar-lock-'));
        const lockPath = path.join(tempRoot, 'sidecar-build.lock');
        const holderScript = `
            const { acquireSidecarBuildLock } = require('./scripts/sidecar-build-lock.js');
            const lock = acquireSidecarBuildLock(process.argv[1], { timeoutMs: 3000, staleMs: 30000, pollMs: 25 });
            console.log('acquired');
            setTimeout(() => { lock.release(); process.exit(0); }, 800);
        `;
        const waiterScript = `
            const { acquireSidecarBuildLock } = require('./scripts/sidecar-build-lock.js');
            const startedAt = Date.now();
            const lock = acquireSidecarBuildLock(process.argv[1], { timeoutMs: 3000, staleMs: 30000, pollMs: 25 });
            console.log(JSON.stringify({ acquired: true, waitedMs: Date.now() - startedAt }));
            lock.release();
        `;

        try {
            const holder = await waitForOutput(holderScript, [lockPath]);
            const waiter = await runChild(waiterScript, [lockPath]);
            expect(waiter.code).toBe(0);
            expect(waiter.output).toContain('acquired');
            const parsed = JSON.parse(waiter.output.match(/\{[^\n]+\}/)?.[0] || '{}') as { waitedMs?: number };
            expect(Number(parsed.waitedMs || 0)).toBeGreaterThanOrEqual(250);
            await waitForChildClose(holder.child);
            expect(fs.existsSync(lockPath)).toBe(false);
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('reclaims an old lock whose owner process is no longer alive', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sidecar-lock-stale-'));
        const lockPath = path.join(tempRoot, 'sidecar-build.lock');
        try {
            fs.writeFileSync(lockPath, JSON.stringify({
                pid: 2147483647,
                hostname: 'stale-test',
                startedAt: '2020-01-01T00:00:00.000Z',
                token: 'stale-token',
            }), 'utf8');
            const result = await runChild(`
                const { acquireSidecarBuildLock } = require('./scripts/sidecar-build-lock.js');
                const lock = acquireSidecarBuildLock(process.argv[1], { timeoutMs: 500, staleMs: 1, pollMs: 10 });
                console.log('acquired');
                lock.release();
            `, [lockPath]);
            expect(result.code).toBe(0);
            expect(result.output).toContain('acquired');
            expect(fs.existsSync(lockPath)).toBe(false);
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('reclaims an old lock owned by a different host without trusting a reused pid', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sidecar-lock-host-'));
        const lockPath = path.join(tempRoot, 'sidecar-build.lock');
        try {
            fs.writeFileSync(lockPath, JSON.stringify({
                pid: process.pid,
                hostname: 'different-host',
                startedAt: '2020-01-01T00:00:00.000Z',
                token: 'foreign-token',
            }), 'utf8');
            const result = await runChild(`
                const { acquireSidecarBuildLock } = require('./scripts/sidecar-build-lock.js');
                const lock = acquireSidecarBuildLock(process.argv[1], { timeoutMs: 500, staleMs: 1, pollMs: 10 });
                console.log('acquired');
                lock.release();
            `, [lockPath]);
            expect(result.code).toBe(0);
            expect(result.output).toContain('acquired');
            expect(fs.existsSync(lockPath)).toBe(false);
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    test('fails closed when a live owner holds the lock past the wait budget', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sidecar-lock-timeout-'));
        const lockPath = path.join(tempRoot, 'sidecar-build.lock');
        const holderScript = `
            const { acquireSidecarBuildLock } = require('./scripts/sidecar-build-lock.js');
            const lock = acquireSidecarBuildLock(process.argv[1], { timeoutMs: 3000, staleMs: 30000, pollMs: 25 });
            console.log('acquired');
            setTimeout(() => { lock.release(); process.exit(0); }, 700);
        `;
        try {
            const holder = await waitForOutput(holderScript, [lockPath]);
            const result = await runChild(`
                const { acquireSidecarBuildLock } = require('./scripts/sidecar-build-lock.js');
                acquireSidecarBuildLock(process.argv[1], { timeoutMs: 100, staleMs: 30000, pollMs: 25 });
            `, [lockPath]);
            expect(result.code).not.toBe(0);
            expect(result.output).toContain('Timed out waiting for sidecar build lock');
            holder.child.kill();
            await waitForChildClose(holder.child);
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });
});
