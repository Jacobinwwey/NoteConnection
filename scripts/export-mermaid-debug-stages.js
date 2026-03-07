const fs = require('fs');
const path = require('path');

function extractMermaidBlocks(markdown) {
  const blocks = [];
  const pattern = /```mermaid\r?\n([\s\S]*?)```/g;
  let match = null;
  while ((match = pattern.exec(markdown)) !== null) {
    const source = String(match[1] || '').trim();
    if (source) {
      blocks.push(source);
    }
  }
  return blocks;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'note';
}

async function main() {
  const noteArg = process.argv[2] || 'Knowledge_Base/financial/Annuity Plan.md';
  const notePath = path.resolve(process.cwd(), noteArg);
  const outputArg = process.argv[3] || path.join('tmp', 'mermaid-stage-dumps', slugify(path.basename(notePath, path.extname(notePath))));
  const outputDir = path.resolve(process.cwd(), outputArg);

  if (!fs.existsSync(notePath)) {
    throw new Error('Note file not found: ' + notePath);
  }

  const rendererPath = path.resolve(process.cwd(), 'dist', 'src', 'reader_renderer.js');
  if (!fs.existsSync(rendererPath)) {
    throw new Error('Built renderer not found. Run `npx tsc --pretty false` first.');
  }

  const { collectMermaidRenderStageSnapshots } = require(rendererPath);
  const markdown = fs.readFileSync(notePath, 'utf8');
  const mermaidBlocks = extractMermaidBlocks(markdown);
  if (mermaidBlocks.length === 0) {
    throw new Error('No Mermaid blocks found in: ' + notePath);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const manifest = {
    notePath,
    generatedAt: new Date().toISOString(),
    rendererPath,
    blockCount: mermaidBlocks.length,
    blocks: [],
  };

  for (let index = 0; index < mermaidBlocks.length; index += 1) {
    const blockSource = mermaidBlocks[index];
    const blockDir = path.join(outputDir, `block-${String(index + 1).padStart(2, '0')}`);
    fs.mkdirSync(blockDir, { recursive: true });
    fs.writeFileSync(path.join(blockDir, 'source.mmd'), blockSource, 'utf8');

    const snapshots = await collectMermaidRenderStageSnapshots(blockSource, {
      theme: 'dark',
      maxWidth: 1180,
      maxHeight: 860,
      renderScale: 2,
    });

    const stages = [];
    for (const snapshot of snapshots) {
      const svgPath = path.join(blockDir, `${snapshot.stage}.svg`);
      const pngPath = path.join(blockDir, `${snapshot.stage}.png`);
      fs.writeFileSync(svgPath, snapshot.svg, 'utf8');
      fs.writeFileSync(pngPath, Buffer.from(snapshot.pngBase64, 'base64'));
      stages.push({
        stage: snapshot.stage,
        width: snapshot.width,
        height: snapshot.height,
        svgPath,
        pngPath,
      });
    }

    manifest.blocks.push({
      index: index + 1,
      blockDir,
      sourcePreview: blockSource.split(/\r?\n/).slice(0, 3).join(' | '),
      stages,
    });
  }

  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('[mermaid-debug] Note:', notePath);
  console.log('[mermaid-debug] Blocks:', mermaidBlocks.length);
  console.log('[mermaid-debug] Output:', outputDir);
  console.log('[mermaid-debug] Manifest:', manifestPath);
}

main().catch((error) => {
  console.error('[mermaid-debug] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
