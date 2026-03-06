import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function copyPngToClipboard(pngBuffer: Buffer): Promise<void> {
    if (!Buffer.isBuffer(pngBuffer) || pngBuffer.length === 0) {
        throw new Error('Clipboard copy requires a non-empty PNG payload.');
    }

    const tempDir = path.join(os.tmpdir(), 'NoteConnection', 'clipboard');
    fs.mkdirSync(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, `reader-copy-${process.pid}-${Date.now()}.png`);
    fs.writeFileSync(tempPath, pngBuffer);

    try {
        if (process.platform === 'win32') {
            await copyPngToClipboardWindows(tempPath);
            return;
        }
        if (process.platform === 'darwin') {
            await copyPngToClipboardMac(tempPath);
            return;
        }
        if (process.platform === 'linux') {
            await copyPngToClipboardLinux(tempPath);
            return;
        }
        throw new Error(`Image clipboard copy is not supported on ${process.platform}.`);
    } finally {
        fs.rmSync(tempPath, { force: true });
    }
}

async function copyPngToClipboardWindows(tempPath: string): Promise<void> {
    const escapedPath = tempPath.replace(/'/g, "''");
    const script = [
        'Add-Type -AssemblyName System.Windows.Forms',
        'Add-Type -AssemblyName System.Drawing',
        `$path = '${escapedPath}'`,
        '$stream = [System.IO.File]::OpenRead($path)',
        '$image = $null',
        'try {',
        '  $image = [System.Drawing.Image]::FromStream($stream)',
        '  [System.Windows.Forms.Clipboard]::SetImage($image)',
        '} finally {',
        '  if ($image -ne $null) { $image.Dispose() }',
        '  $stream.Dispose()',
        '}',
    ].join('; ');

    await execFileAsync('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: true });
}

async function copyPngToClipboardMac(tempPath: string): Promise<void> {
    const escapedPath = tempPath.split('\\').join('\\\\').split('\"').join('\\"');
    const script = 'set the clipboard to (read (POSIX file "' + escapedPath + '") as PNG picture)';

    try {
        await execFileAsync('osascript', ['-e', script]);
    } catch (error) {
        throw new Error(`macOS clipboard copy failed: ${String(error)}`);
    }
}

async function copyPngToClipboardLinux(tempPath: string): Promise<void> {
    const command = 'if command -v wl-copy >/dev/null 2>&1; then wl-copy --type image/png < "$1"; exit 0; fi; if command -v xclip >/dev/null 2>&1; then xclip -selection clipboard -t image/png -i "$1"; exit 0; fi; exit 127';
    try {
        await execFileAsync('/bin/sh', ['-lc', command, 'sh', tempPath]);
    } catch (error) {
        throw new Error('Linux image clipboard copy requires wl-copy or xclip.');
    }
}
