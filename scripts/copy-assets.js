const fs = require('fs');
const path = require('path');

const DEFAULT_SRC = path.join(__dirname, '../src/frontend');
const DEFAULT_DEST = path.join(__dirname, '../dist/src/frontend');
const REPO_ROOT = path.join(__dirname, '..');
const LFS_POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1';

const GENERATED_GRAPH_FILES = [
    'data.js',
    'graph_data.json'
];

const GENERATED_GRAPH_PATTERNS = [
    /^data_cli_.*\.js$/i,
    /^graph_data_cli_.*\.json$/i
];

function isGeneratedGraphAsset(filename) {
    return GENERATED_GRAPH_FILES.includes(filename)
        || GENERATED_GRAPH_PATTERNS.some((pattern) => pattern.test(filename));
}

function isLfsPointerContent(content) {
    if (typeof content !== 'string') {
        return false;
    }

    return content.startsWith(LFS_POINTER_PREFIX)
        && content.includes('\noid sha256:')
        && content.includes('\nsize ');
}

function isLfsPointerFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return false;
    }

    const stats = fs.statSync(filePath);
    if (!stats.isFile() || stats.size > 1024) {
        return false;
    }

    return isLfsPointerContent(fs.readFileSync(filePath, 'utf8'));
}

function resolveCopyMode(args = process.argv.slice(2)) {
    const includeGeneratedGraphAssets = args.includes('--include-generated-graph-assets');
    const usesLegacyMiniAlias = args.includes('--mini');

    return {
        includeGeneratedGraphAssets,
        usesLegacyMiniAlias
    };
}

function ensureDirectory(targetPath) {
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
}

function removeExistingFileIfPresent(targetPath, logger) {
    if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
        logger.log(`  [Cleaned] Removed existing artifact: ${path.basename(targetPath)}`);
    }
}

function describeGraphAssetSkip(srcPath, entryName, logger, reason) {
    const sizeMB = (fs.statSync(srcPath).size / 1024 / 1024).toFixed(2);
    logger.log(`  [Excluded] ${entryName} (${sizeMB} MB) (${reason})`);
}

function shouldSkipFile(srcPath, entryName, includeGeneratedGraphAssets) {
    if (!isGeneratedGraphAsset(entryName)) {
        return {
            skip: false,
            reason: null
        };
    }

    if (!includeGeneratedGraphAssets) {
        return {
            skip: true,
            reason: 'runtime-generated graph asset'
        };
    }

    if (isLfsPointerFile(srcPath)) {
        return {
            skip: true,
            reason: 'git-lfs pointer placeholder'
        };
    }

    return {
        skip: false,
        reason: null
    };
}

function copyDir(src, dest, options) {
    const {
        includeGeneratedGraphAssets,
        logger
    } = options;

    ensureDirectory(dest);

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath, options);
            continue;
        }

        const skipDecision = shouldSkipFile(srcPath, entry.name, includeGeneratedGraphAssets);
        if (skipDecision.skip) {
            describeGraphAssetSkip(srcPath, entry.name, logger, skipDecision.reason);
            removeExistingFileIfPresent(destPath, logger);
            continue;
        }

        fs.copyFileSync(srcPath, destPath);
    }
}

function copyProjectAssets(options = {}) {
    const {
        src = DEFAULT_SRC,
        dest = DEFAULT_DEST,
        includeGeneratedGraphAssets = false,
        logger = console
    } = options;

    copyDir(src, dest, {
        includeGeneratedGraphAssets,
        logger
    });

    const localesSrc = path.join(src, 'locales');
    const localesDest = path.join(dest, 'locales');
    if (fs.existsSync(localesSrc)) {
        logger.log('\n📁 Copying locale files...');
        copyDir(localesSrc, localesDest, {
            includeGeneratedGraphAssets,
            logger
        });
        logger.log('  ✓ Locale files copied');
    }

    const readmeSrc = path.join(REPO_ROOT, 'README.md');
    const readmeDest = path.join(dest, 'README.md');
    if (fs.existsSync(readmeSrc)) {
         fs.copyFileSync(readmeSrc, readmeDest);
         logger.log('  ✓ README.md copied');
    }

    const manualSrc = path.join(src, 'User_Manual.md');
    const manualDest = path.join(dest, 'User_Manual.md');
    if (fs.existsSync(manualSrc)) {
         fs.copyFileSync(manualSrc, manualDest);
         logger.log('  ✓ User_Manual.md (English) copied');
    } else {
        logger.warn('  ⚠️  User_Manual.md not found in src/frontend');

        const manualRootSrc = path.join(REPO_ROOT, 'User_Manual.md');
        if (fs.existsSync(manualRootSrc)) {
            fs.copyFileSync(manualRootSrc, manualDest);
            logger.log('  ✓ User_Manual.md copied from root');
        }
    }

    const manualZhSrc = path.join(src, 'User_Manual_zh.md');
    const manualZhDest = path.join(dest, 'User_Manual_zh.md');
    if (fs.existsSync(manualZhSrc)) {
         fs.copyFileSync(manualZhSrc, manualZhDest);
         logger.log('  ✓ User_Manual_zh.md (Chinese) copied');
    } else {
        logger.warn('  ⚠️  User_Manual_zh.md not found');
    }

    logger.log(`\n✅ Assets copied from ${src} to ${dest}`);
    logger.log('\n📊 Build Summary:');
    logger.log(`  - Mode: ${includeGeneratedGraphAssets ? 'FULL_GRAPH_ASSETS' : 'RUNTIME_FIRST'}`);
    logger.log('  - i18n: Locale files included');
    logger.log('  - Docs: User manuals (EN + ZH) included');
    logger.log('  - Tutorial: CSS and scripts included');
}

function main() {
    const {
        includeGeneratedGraphAssets,
        usesLegacyMiniAlias
    } = resolveCopyMode();

    console.log(
        `\n📦 Build Mode: ${
            includeGeneratedGraphAssets
                ? 'FULL (Including generated graph assets when real files exist)'
                : 'RUNTIME-FIRST (Excluding runtime-generated graph assets)'
        }\n`
    );

    if (usesLegacyMiniAlias) {
        console.log('  [Info] --mini is now a legacy alias for the default runtime-first mode.');
    }

    try {
        copyProjectAssets({
            includeGeneratedGraphAssets
        });
    } catch (e) {
        console.error('❌ Error copying assets:', e);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    copyProjectAssets,
    isGeneratedGraphAsset,
    isLfsPointerContent,
    isLfsPointerFile,
    resolveCopyMode
};
