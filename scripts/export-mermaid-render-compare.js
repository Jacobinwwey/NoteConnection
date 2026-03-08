const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

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

function normalizeInlineText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function estimateGlyphWidthUnits(char) {
  if (!char) {
    return 0;
  }
  if (/\s/.test(char)) {
    return 0.35;
  }
  if (/[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}]/u.test(char)) {
    return 1.02;
  }
  if (/[.,;:!'`|]/.test(char)) {
    return 0.32;
  }
  if (/[(){}\[\]<>]/.test(char)) {
    return 0.46;
  }
  if (/[\\/_-]/.test(char)) {
    return 0.5;
  }
  if (/[0-9]/.test(char)) {
    return 0.62;
  }
  if (/[A-Z]/.test(char)) {
    return 0.72;
  }
  if (/[a-z]/.test(char)) {
    return 0.64;
  }
  return 0.7;
}

function estimateTextLineWidth(text, fontSize) {
  let units = 0;
  for (const char of Array.from(String(text || ''))) {
    units += estimateGlyphWidthUnits(char);
  }
  return Math.max(fontSize * 0.75, units * fontSize + Math.max(2, fontSize * 0.12));
}

function resolveFontSize(textNode) {
  const attrSize = Number.parseFloat(String(textNode.getAttribute('font-size') || ''));
  if (Number.isFinite(attrSize) && attrSize > 0) {
    return attrSize;
  }
  const styleValue = String(textNode.getAttribute('style') || '');
  const match = styleValue.match(/font-size\s*:\s*([0-9.]+)px/i);
  if (match) {
    const parsed = Number.parseFloat(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 16;
}

function extractTextLines(textNode) {
  const directLines = Array.from(textNode.children)
    .filter((child) => String(child.tagName || '').toLowerCase() === 'tspan')
    .map((lineNode) => normalizeInlineText(lineNode.textContent || ''))
    .filter(Boolean);
  if (directLines.length > 0) {
    return directLines;
  }

  const leafLines = Array.from(textNode.querySelectorAll('tspan'))
    .filter((lineNode) => !lineNode.querySelector('tspan'))
    .map((lineNode) => normalizeInlineText(lineNode.textContent || ''))
    .filter(Boolean);
  if (leafLines.length > 0) {
    return leafLines;
  }

  const fallback = normalizeInlineText(textNode.textContent || '');
  return fallback ? [fallback] : [];
}

function resolveNodeRectWidth(nodeElement) {
  const preferred = nodeElement.querySelector('rect.basic.label-container, rect.label-container');
  if (preferred) {
    const width = Number.parseFloat(String(preferred.getAttribute('width') || '0'));
    if (Number.isFinite(width) && width > 0) {
      return width;
    }
  }

  let bestWidth = 0;
  let bestArea = 0;
  Array.from(nodeElement.querySelectorAll('rect')).forEach((rectNode) => {
    const width = Number.parseFloat(String(rectNode.getAttribute('width') || '0'));
    const height = Number.parseFloat(String(rectNode.getAttribute('height') || '0'));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }
    const area = width * height;
    if (area > bestArea) {
      bestArea = area;
      bestWidth = width;
    }
  });
  return bestWidth;
}

function collectSvgMetrics(svgMarkup) {
  if (!svgMarkup || typeof svgMarkup !== 'string') {
    return null;
  }

  const doc = new JSDOM(svgMarkup, { contentType: 'image/svg+xml' }).window.document;
  const nodeRectWidths = Array.from(doc.querySelectorAll('.node rect'))
    .map((rect) => Number(rect.getAttribute('width') || '0'))
    .filter((value) => Number.isFinite(value) && value > 0);
  const maxNodeRectWidth = nodeRectWidths.length > 0 ? Math.max(...nodeRectWidths) : 0;

  const nodes = Array.from(doc.querySelectorAll('.node'));
  let overflowNodeCount = 0;
  for (const node of nodes) {
    const textNode = node.querySelector('text');
    if (!textNode) {
      continue;
    }
    const rectWidth = resolveNodeRectWidth(node);
    if (!Number.isFinite(rectWidth) || rectWidth <= 0) {
      continue;
    }
    const fontSize = resolveFontSize(textNode);
    const lines = extractTextLines(textNode);
    const estimatedLineWidth = lines.reduce((maxWidth, line) => Math.max(maxWidth, estimateTextLineWidth(line, fontSize)), 0);
    const availableWidth = Math.max(1, rectWidth - 30);
    if (estimatedLineWidth > availableWidth + 2) {
      overflowNodeCount += 1;
    }
  }

  const widthMatch = svgMarkup.match(/\bwidth="([0-9.]+)"/);
  const heightMatch = svgMarkup.match(/\bheight="([0-9.]+)"/);
  return {
    finalSvgWidth: widthMatch ? Number(widthMatch[1]) : undefined,
    finalSvgHeight: heightMatch ? Number(heightMatch[1]) : undefined,
    maxNodeRectWidth,
    overflowNodeCount,
    nodeCount: nodes.length,
  };
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
    const localFinalSnapshot = localSnapshots.find((snapshot) => snapshot.stage === 'final');
    const localFinalMetrics = localFinalSnapshot ? collectSvgMetrics(localFinalSnapshot.svg) : null;

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
    const frontendFinalMetrics = collectSvgMetrics(typeof frontendResponse.svg === 'string' ? frontendResponse.svg : '');
    fs.writeFileSync(path.join(frontendDir, 'response.summary.json'), JSON.stringify(frontendSummary, null, 2), 'utf8');

    manifest.blocks.push({
      index: index + 1,
      blockDir,
      sourcePreview: blockSource.split(/\r?\n/).slice(0, 3).join(' | '),
      local: {
        stageCount: localStages.length,
        stages: localStages,
        finalMetrics: localFinalMetrics,
      },
      frontendBridge: {
        renderer: frontendSummary.renderer,
        width: frontendSummary.width,
        height: frontendSummary.height,
        stageCount: frontendSummary.stageCount,
        stages: frontendStages,
        finalSvgPath: path.join(frontendDir, 'final.svg'),
        finalPngPath: path.join(frontendDir, 'final.png'),
        finalMetrics: frontendFinalMetrics,
      },
    });

    const localOverflow = localFinalMetrics ? `${localFinalMetrics.overflowNodeCount}/${localFinalMetrics.nodeCount}` : '?/?';
    const frontendOverflow = frontendFinalMetrics ? `${frontendFinalMetrics.overflowNodeCount}/${frontendFinalMetrics.nodeCount}` : '?/?';
    const localRect = localFinalMetrics ? localFinalMetrics.maxNodeRectWidth.toFixed(2) : '?';
    const frontendRect = frontendFinalMetrics ? frontendFinalMetrics.maxNodeRectWidth.toFixed(2) : '?';
    console.log(`[mermaid-compare] Block ${index + 1}: local overflow=${localOverflow} maxRect=${localRect} | frontend overflow=${frontendOverflow} maxRect=${frontendRect}`);
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
