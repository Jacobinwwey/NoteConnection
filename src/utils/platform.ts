import * as os from 'os';
import * as path from 'path';

export type PlatformOs = 'linux' | 'macos' | 'windows' | 'android' | 'unknown';
export type PlatformArch = 'x64' | 'arm64' | 'unknown';

export interface PlatformInfo {
    os: PlatformOs;
    arch: PlatformArch;
    triplet: string;
    exeSuffix: string;
    isWayland: boolean;
}

const cachedPlatform: PlatformInfo = detectPlatform();

function detectPlatform(): PlatformInfo {
    const rawOs = process.platform;
    const rawArch = process.arch;

    let osName: PlatformOs;
    if (rawOs === 'linux') osName = 'linux';
    else if (rawOs === 'darwin') osName = 'macos';
    else if (rawOs === 'win32') osName = 'windows';
    else if (rawOs === 'android') osName = 'android';
    else osName = 'unknown';

    let archName: PlatformArch;
    if (rawArch === 'x64') archName = 'x64';
    else if (rawArch === 'arm64') archName = 'arm64';
    else archName = 'unknown';

    const triplet = buildTargetTriple(osName, archName);
    const exeSuffix = osName === 'windows' ? '.exe' : '';
    const isWayland = osName === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland';

    return { os: osName, arch: archName, triplet, exeSuffix, isWayland };
}

function buildTargetTriple(osName: PlatformOs, archName: PlatformArch): string {
    switch (osName) {
        case 'linux':
            return `x86_64-unknown-linux-gnu`;
        case 'macos':
            return archName === 'arm64'
                ? 'aarch64-apple-darwin'
                : 'x86_64-apple-darwin';
        case 'windows':
            return 'x86_64-pc-windows-msvc';
        default:
            return `${process.arch}-unknown-${process.platform}`;
    }
}

export function getPlatform(): PlatformInfo {
    return cachedPlatform;
}

export function getAppDataDir(): string {
    const home = os.homedir();
    const platform = cachedPlatform.os;

    switch (platform) {
        case 'macos':
            return path.join(home, 'Library', 'Application Support', 'NoteConnection');
        case 'linux': {
            const xdgData = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
            return path.join(xdgData, 'NoteConnection');
        }
        case 'windows': {
            const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
            return path.join(localAppData, 'NoteConnection');
        }
        default:
            return path.join(home, '.noteconnection');
    }
}

export function getConfigDir(): string {
    const home = os.homedir();
    const platform = cachedPlatform.os;

    switch (platform) {
        case 'macos':
            return path.join(home, 'Library', 'Preferences', 'NoteConnection');
        case 'linux': {
            const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
            return path.join(xdgConfig, 'NoteConnection');
        }
        case 'windows': {
            const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
            return path.join(appData, 'NoteConnection');
        }
        default:
            return path.join(home, '.config', 'noteconnection');
    }
}

export function getCacheDir(): string {
    const home = os.homedir();
    const platform = cachedPlatform.os;

    switch (platform) {
        case 'macos':
            return path.join(home, 'Library', 'Caches', 'NoteConnection');
        case 'linux': {
            const xdgCache = process.env.XDG_CACHE_HOME || path.join(home, '.cache');
            return path.join(xdgCache, 'NoteConnection');
        }
        case 'windows': {
            const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
            return path.join(localAppData, 'NoteConnection', 'Cache');
        }
        default:
            return path.join(home, '.cache', 'noteconnection');
    }
}

export function getSidecarName(baseName: string): string {
    return `${baseName}-${cachedPlatform.triplet}${cachedPlatform.exeSuffix}`;
}

export function getGodotEnv(): Record<string, string> {
    if (cachedPlatform.isWayland) {
        return {
            GDK_BACKEND: 'x11',
            WEBKIT_DISABLE_DMABUF_RENDERER: '1',
        };
    }
    return {};
}
