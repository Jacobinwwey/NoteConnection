const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const options = {
    file: '',
    block: 1,
    outDir: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || '');
    if (arg === '--file' && argv[index + 1]) {
      options.file = String(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--block' && argv[index + 1]) {
      options.block = Math.max(1, Number(argv[index + 1]) || 1);
      index += 1;
      continue;
    }
    if (arg === '--out-dir' && argv[index + 1]) {
      options.outDir = String(argv[index + 1]);
      index += 1;
    }
  }

  return options;
}

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
  return targetPath;
}

function extractMermaidBlocks(markdown) {
  return [...String(markdown || '').matchAll(/```mermaid\s*([\s\S]*?)```/g)].map((match) => String(match[1] || '').trim());
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const { collectMermaidRenderStageSnapshots, normalizeMermaidDefinition, renderMermaidPng } = require(path.join(repoRoot, 'dist', 'src', 'reader_renderer.js'));
  const options = parseArgs(process.argv.slice(2));

  if (!options.file) {
    throw new Error('Missing required --file argument.');
  }

  const inputPath = path.resolve(repoRoot, options.file);
  const markdown = fs.readFileSync(inputPath, 'utf8');
  const blocks = extractMermaidBlocks(markdown);
  const blockIndex = options.block - 1;
  if (blockIndex < 0 || blockIndex >= blocks.length) {
    throw new Error(`Mermaid block index ${options.block} is out of range. File contains ${blocks.length} Mermaid block(s).`);
  }

  const source = blocks[blockIndex];
  const normalizedSource = normalizeMermaidDefinition(source);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = ensureDirectory(
    options.outDir
      ? path.resolve(repoRoot, options.outDir)
      : path.join(repoRoot, 'output', 'mermaid-stages', `${path.basename(inputPath, path.extname(inputPath))}-block${options.block}-${timestamp}`)
  );

  const metadata = {
    inputPath,
    block: options.block,
    mermaidBlockCount: blocks.length,
    outputDir,
    normalizedSourcePath: path.join(outputDir, 'normalized-source.mmd'),
    finalPngPath: path.join(outputDir, 'final.png'),
    stageFiles: [],
  };

  fs.writeFileSync(metadata.normalizedSourcePath, normalizedSource, 'utf8');

  try {
    const finalRender = await renderMermaidPng(source, { theme: 'dark', renderScale: 1.0 });
    fs.writeFileSync(metadata.finalPngPath, Buffer.from(finalRender.pngBase64, 'base64'));

    const stages = await collectMermaidRenderStageSnapshots(source, { theme: 'dark', renderScale: 1.0 });
    metadata.stageFiles = stages.map((stage, index) => {
      const filename = `${String(index + 1).padStart(2, '0')}-${stage.stage}.png`;
      const absolutePath = path.join(outputDir, filename);
      fs.writeFileSync(absolutePath, Buffer.from(stage.pngBase64, 'base64'));
      return {
        stage: stage.stage,
        path: absolutePath,
        width: stage.width,
        height: stage.height,
      };
    });

    metadata.final = {
      width: finalRender.width,
      height: finalRender.height,
    };
    metadata.ok = true;
  } catch (error) {
    metadata.ok = false;
    metadata.error = String(error && error.message ? error.message : error);
  }

  const metadataPath = path.join(outputDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  process.stdout.write(`${metadataPath}\n`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
