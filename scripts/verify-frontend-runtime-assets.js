const fs = require('fs');
const path = require('path');

const DEFAULT_FRONTEND_DIR = path.join(__dirname, '..', 'dist', 'src', 'frontend');

function isExternalAssetSource(value) {
    return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(value);
}

function collectLocalRuntimeAssetSources(indexHtml) {
    const sources = [];
    const patterns = [
        { pattern: /<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/giu, sourceGroup: 2 },
        { pattern: /<link\b[^>]*\brel\s*=\s*(["'])(?:stylesheet|modulepreload)\1[^>]*\bhref\s*=\s*(["'])(.*?)\2[^>]*>/giu, sourceGroup: 3 },
        { pattern: /<link\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*\brel\s*=\s*(["'])(?:stylesheet|modulepreload)\3[^>]*>/giu, sourceGroup: 2 },
    ];
    patterns.forEach(({ pattern, sourceGroup }) => {
        let match;
        while ((match = pattern.exec(indexHtml)) !== null) {
            const source = String(match[sourceGroup] || '').trim();
            if (!source || isExternalAssetSource(source)) {
                continue;
            }
            sources.push(source);
        }
    });
    return Array.from(new Set(sources));
}

function resolveLocalScriptPath(frontendDir, source) {
    const pathname = String(source || '').split(/[?#]/u, 1)[0].replace(/\\/gu, '/');
    if (!pathname || pathname.startsWith('/')) {
        throw new Error(`Unsupported local script source: ${source}`);
    }
    const root = path.resolve(frontendDir);
    const target = path.resolve(root, pathname);
    const relative = path.relative(root, target);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Local script source escapes the frontend root: ${source}`);
    }
    return target;
}

function verifyFrontendRuntimeAssets(frontendDir = DEFAULT_FRONTEND_DIR) {
    const root = path.resolve(frontendDir);
    const indexPath = path.join(root, 'index.html');
    if (!fs.existsSync(indexPath)) {
        throw new Error(`Missing frontend index: ${indexPath}`);
    }
    const sources = collectLocalRuntimeAssetSources(fs.readFileSync(indexPath, 'utf8'));
    const missingSources = sources.filter((source) => !fs.existsSync(resolveLocalScriptPath(root, source)));
    if (missingSources.length > 0) {
        throw new Error(`Missing frontend runtime asset(s): ${missingSources.join(', ')}`);
    }
    return {
        frontendDir: root,
        localRuntimeAssetCount: sources.length,
        localRuntimeAssetSources: sources,
    };
}

if (require.main === module) {
    const report = verifyFrontendRuntimeAssets();
    console.log(`[frontend-runtime-assets] PASS ${report.localRuntimeAssetCount} local runtime asset(s) under ${report.frontendDir}`);
}

module.exports = {
    collectLocalRuntimeAssetSources,
    verifyFrontendRuntimeAssets,
};
