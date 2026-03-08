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

function collectTextOverflowMetrics(doc) {
  const nodes = Array.from(doc.querySelectorAll('.node'));
  let overflowNodeCount = 0;
  let maxEstimatedTextWidth = 0;
  let minAvailableNodeWidth = Number.POSITIVE_INFINITY;

  nodes.forEach((node) => {
    const textNode = node.querySelector('text');
    if (!textNode) {
      return;
    }
    const rectWidth = resolveNodeRectWidth(node);
    if (!Number.isFinite(rectWidth) || rectWidth <= 0) {
      return;
    }
    const availableWidth = Math.max(1, rectWidth - 30);
    minAvailableNodeWidth = Math.min(minAvailableNodeWidth, availableWidth);
    const fontSize = resolveFontSize(textNode);
    const lines = extractTextLines(textNode);
    const estimatedLineWidth = lines.reduce((maxWidth, line) => Math.max(maxWidth, estimateTextLineWidth(line, fontSize)), 0);
    maxEstimatedTextWidth = Math.max(maxEstimatedTextWidth, estimatedLineWidth);
    if (estimatedLineWidth > availableWidth + 2) {
      overflowNodeCount += 1;
    }
  });

  return {
    nodeCount: nodes.length,
    overflowNodeCount,
    maxEstimatedTextWidth,
    minAvailableNodeWidth: Number.isFinite(minAvailableNodeWidth) ? minAvailableNodeWidth : 0,
  };
}

function collectFinalSvgMetrics(svgMarkup) {
  if (!svgMarkup || typeof svgMarkup !== 'string') {
    return null;
  }

  const dom = new JSDOM(svgMarkup, { contentType: 'image/svg+xml' });
  const doc = dom.window.document;

  const nodeRectWidths = Array.from(doc.querySelectorAll('.node rect'))
    .map((rect) => Number(rect.getAttribute('width') || '0'))
    .filter((value) => Number.isFinite(value) && value > 0);
  const maxNodeRectWidth = nodeRectWidths.length > 0 ? Math.max(...nodeRectWidths) : 0;

  let hasAggregateFirstLine = false;
  const nodeTextNodes = Array.from(doc.querySelectorAll('.node text'));
  for (const textNode of nodeTextNodes) {
    const lines = Array.from(textNode.children)
      .filter((child) => child.tagName && child.tagName.toLowerCase() === 'tspan')
      .map((lineNode) => String(lineNode.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (lines.length <= 1) {
      continue;
    }
    if (lines[0] === lines.slice(1).join(' ')) {
      hasAggregateFirstLine = true;
      break;
    }
  }

  const widthMatch = svgMarkup.match(/\bwidth="([0-9.]+)"/);
  const heightMatch = svgMarkup.match(/\bheight="([0-9.]+)"/);
  const overflowMetrics = collectTextOverflowMetrics(doc);

  return {
    finalSvgWidth: widthMatch ? Number(widthMatch[1]) : undefined,
    finalSvgHeight: heightMatch ? Number(heightMatch[1]) : undefined,
    maxNodeRectWidth,
    hasAggregateFirstLine,
    overflowNodeCount: overflowMetrics.overflowNodeCount,
    nodeCount: overflowMetrics.nodeCount,
    maxEstimatedTextWidth: overflowMetrics.maxEstimatedTextWidth,
    minAvailableNodeWidth: overflowMetrics.minAvailableNodeWidth,
  };
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

    const finalSnapshot = snapshots.find((snapshot) => snapshot.stage === 'final');
    const finalMetrics = finalSnapshot ? collectFinalSvgMetrics(finalSnapshot.svg) : null;
    manifest.blocks.push({
      index: index + 1,
      blockDir,
      sourcePreview: blockSource.split(/\r?\n/).slice(0, 3).join(' | '),
      stages,
      finalMetrics,
    });

    if (finalMetrics) {
      console.log(
        `[mermaid-debug] Block ${index + 1}: final=${String(finalMetrics.finalSvgWidth || '?')}x${String(finalMetrics.finalSvgHeight || '?')}, ` +
        `maxNodeRect=${finalMetrics.maxNodeRectWidth.toFixed(2)}, aggregateFirstLine=${finalMetrics.hasAggregateFirstLine}, ` +
        `overflowNodes=${finalMetrics.overflowNodeCount}/${finalMetrics.nodeCount}`
      );
    }
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
