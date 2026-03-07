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

function loadRuntimeManifest() {
  const manifestPath = path.resolve(process.cwd(), 'tmp', 'active-sidecar-runtime.json');
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return {
      manifestPath,
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl.trim() : '',
      authToken: typeof parsed.authToken === 'string' ? parsed.authToken.trim() : '',
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : '',
      pid: typeof parsed.pid === 'number' ? parsed.pid : null,
    };
  } catch (_error) {
    return null;
  }
}

function writeStageSnapshots(outputDir, snapshots) {
  const stages = [];
  for (const snapshot of snapshots) {
    const svgPath = path.join(outputDir, `${snapshot.stage}.svg`);
    const pngPath = path.join(outputDir, `${snapshot.stage}.png`);
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
  return stages;
}

async function postJson(url, payload, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['X-NoteConnection-Token'] = token;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let parsed = {};
  if (text.trim()) {
    try {
      parsed = JSON.parse(text);
    } catch (_error) {
      throw new Error(`Failed to parse JSON from ${url}: ${text}`);
    }
  }
  if (!response.ok) {
    const errorMessage = parsed && typeof parsed.error === 'string' ? parsed.error : `${response.status} ${response.statusText}`;
    throw new Error(`Request to ${url} failed: ${errorMessage}`);
  }
  return parsed;
}

async function main() {
  const noteArg = process.argv[2] || 'Knowledge_Base/financial/Annuity Plan.md';
  const endpointArg = process.argv[3] || process.env.NOTE_CONNECTION_RUNTIME_ENDPOINT || '';
  const runtimeManifest = loadRuntimeManifest();
  const notePath = path.resolve(process.cwd(), noteArg);
  const noteSlug = slugify(path.basename(notePath, path.extname(notePath)));
  const outputArg = process.argv[4] || path.join('tmp', 'mermaid-render-compare', noteSlug);
  const outputDir = path.resolve(process.cwd(), outputArg);
  const envAuthToken = String(process.env.NOTE_CONNECTION_AUTH_TOKEN || '').trim();
  const endpoint = String(endpointArg || (runtimeManifest && runtimeManifest.baseUrl) || '').trim();
  const authToken = envAuthToken || (runtimeManifest && runtimeManifest.authToken) || '';

  if (!endpoint) {
    throw new Error('Missing runtime endpoint. Pass it as the second argument, for example http://127.0.0.1:3037, or restart the app so tmp/active-sidecar-runtime.json is written.');
  }
  if (!authToken) {
    throw new Error('Missing sidecar auth token. Restart the app so tmp/active-sidecar-runtime.json is written, or set NOTE_CONNECTION_AUTH_TOKEN in this shell.');
  }
  if (runtimeManifest && endpointArg && runtimeManifest.baseUrl && runtimeManifest.baseUrl !== endpointArg) {
    throw new Error(`Runtime manifest endpoint ${runtimeManifest.baseUrl} does not match requested endpoint ${endpointArg}. Restart the app and rerun the exporter.`);
  }
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
    endpoint,
    runtimeManifestPath: runtimeManifest ? runtimeManifest.manifestPath : null,
    generatedAt: new Date().toISOString(),
    rendererPath,
    blockCount: mermaidBlocks.length,
    blocks: [],
  };

  for (let index = 0; index < mermaidBlocks.length; index += 1) {
    const blockSource = mermaidBlocks[index];
    const blockDir = path.join(outputDir, `block-${String(index + 1).padStart(2, '0')}`);
    const localDir = path.join(blockDir, 'local');
    const frontendDir = path.join(blockDir, 'frontend_bridge');
    fs.mkdirSync(localDir, { recursive: true });
    fs.mkdirSync(frontendDir, { recursive: true });

    fs.writeFileSync(path.join(blockDir, 'source.mmd'), blockSource, 'utf8');

    const localSnapshots = await collectMermaidRenderStageSnapshots(blockSource, {
      theme: 'dark',
      maxWidth: 1180,
      maxHeight: 860,
      renderScale: 2,
    });
    const localStages = writeStageSnapshots(localDir, localSnapshots);

    const frontendResponse = await postJson(`${endpoint.replace(/\/$/, '')}/api/render/mermaid`, {
      source: blockSource,
      maxWidth: 1180,
      maxHeight: 860,
      renderScale: 2,
      renderer: 'frontend',
      includeStages: true,
    }, authToken);

    const frontendStages = [];
    if (Array.isArray(frontendResponse.stages)) {
      for (const stage of frontendResponse.stages) {
        if (!stage || typeof stage.stage !== 'string' || typeof stage.svg !== 'string') {
          continue;
        }
        const svgPath = path.join(frontendDir, `${stage.stage}.svg`);
        fs.writeFileSync(svgPath, stage.svg, 'utf8');
        frontendStages.push({
          stage: stage.stage,
          width: Number(stage.width) || undefined,
          height: Number(stage.height) || undefined,
          svgPath,
        });
      }
    }

    if (typeof frontendResponse.svg === 'string' && frontendResponse.svg.trim()) {
      fs.writeFileSync(path.join(frontendDir, 'final.svg'), frontendResponse.svg, 'utf8');
    }
    if (typeof frontendResponse.pngBase64 === 'string' && frontendResponse.pngBase64.trim()) {
      fs.writeFileSync(path.join(frontendDir, 'final.png'), Buffer.from(frontendResponse.pngBase64, 'base64'));
    }

    const frontendSummary = {
      renderer: frontendResponse.renderer || 'frontend-bridge',
      width: Number(frontendResponse.width) || undefined,
      height: Number(frontendResponse.height) || undefined,
      stageCount: frontendStages.length,
    };
    fs.writeFileSync(path.join(frontendDir, 'response.summary.json'), JSON.stringify(frontendSummary, null, 2), 'utf8');

    manifest.blocks.push({
      index: index + 1,
      blockDir,
      sourcePreview: blockSource.split(/\r?\n/).slice(0, 3).join(' | '),
      local: {
        stageCount: localStages.length,
        stages: localStages,
      },
      frontendBridge: {
        renderer: frontendSummary.renderer,
        width: frontendSummary.width,
        height: frontendSummary.height,
        stageCount: frontendSummary.stageCount,
        stages: frontendStages,
        finalSvgPath: path.join(frontendDir, 'final.svg'),
        finalPngPath: path.join(frontendDir, 'final.png'),
      },
    });
  }

  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('[mermaid-compare] Note:', notePath);
  console.log('[mermaid-compare] Endpoint:', endpoint);
  if (runtimeManifest) {
    console.log('[mermaid-compare] Runtime Manifest:', runtimeManifest.manifestPath);
  }
  console.log('[mermaid-compare] Blocks:', mermaidBlocks.length);
  console.log('[mermaid-compare] Output:', outputDir);
  console.log('[mermaid-compare] Manifest:', manifestPath);
}

main().catch((error) => {
  console.error('[mermaid-compare] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
