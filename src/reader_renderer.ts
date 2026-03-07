import { JSDOM } from 'jsdom';
import { MERMAID_BROWSER_BUNDLE_BASE64 } from './generated/mermaid_runtime';
import { RESVG_WASM_BASE64 } from './generated/resvg_runtime';
const MATHJAX_PACKAGE_VERSION = '3.2.1';
(globalThis as { PACKAGE_VERSION?: string }).PACKAGE_VERSION ??= MATHJAX_PACKAGE_VERSION;

const { TeX } = require('mathjax-full/js/input/tex.js');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { HandlerList } = require('mathjax-full/js/core/HandlerList.js');
const { HTMLHandler } = require('mathjax-full/js/handlers/html/HTMLHandler.js');
const { initWasm, Resvg } = require('@resvg/resvg-wasm');

const dynamicImport = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<any>;
const MATH_TEXT_COLOR = '#eef4ff';
const MERMAID_BACKGROUND = 'transparent';
const MERMAID_PADDING = 28;
const MERMAID_FONT_FAMILY = '"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI", sans-serif';
const MERMAID_FONT_WEIGHT = '500';
const MERMAID_TEXT_COLOR = '#f0f0f0';
const MERMAID_EDGE_COLOR = '#a0a0a0';
const MERMAID_NODE_BACKGROUND = '#2d2d2d';
const MERMAID_NODE_BORDER = '#61dafb';
const MERMAID_SURFACE_BACKGROUND = '#1e1e1e';
const MERMAID_CLUSTER_BACKGROUND = 'none';
const GODOT_RASTER_BACKGROUND = '#05070b';
const MERMAID_SECONDARY_BACKGROUND = '#333333';
const MERMAID_NODE_SPACING = 42;
const MERMAID_RANK_SPACING = 58;
const MERMAID_LABEL_PADDING = 22;
const MERMAID_WRAPPING_WIDTH = 240;
const MAX_GODOT_SVG_DIMENSION = 4096;
const MAX_GODOT_RASTER_DIMENSION = 4096;
const DEFAULT_MATH_MAX_WIDTH = 1040;
const DEFAULT_MATH_MAX_HEIGHT = 260;
const DEFAULT_MERMAID_MAX_WIDTH = 1180;
const DEFAULT_MERMAID_MAX_HEIGHT = 860;
const RESVG_DEFAULT_FONT_FAMILY = 'Segoe UI';
const RESVG_DEFAULT_SERIF_FAMILY = 'Times New Roman';
const RESVG_DEFAULT_MONOSPACE_FAMILY = 'Consolas';
const MERMAID_DARK_THEME_VARIABLES = {
    darkMode: true,
    background: MERMAID_SURFACE_BACKGROUND,
    mainBkg: MERMAID_SURFACE_BACKGROUND,
    primaryColor: MERMAID_NODE_BACKGROUND,
    primaryTextColor: '#ffffff',
    primaryBorderColor: MERMAID_NODE_BORDER,
    lineColor: MERMAID_EDGE_COLOR,
    secondaryColor: MERMAID_SECONDARY_BACKGROUND,
    tertiaryColor: MERMAID_NODE_BACKGROUND,
    textColor: '#ffffff',
    fontSize: '16px',
    fontFamily: MERMAID_FONT_FAMILY,
    fontWeight: MERMAID_FONT_WEIGHT,

};

type Bounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};

type Transform = {
    tx: number;
    ty: number;
    sx: number;
    sy: number;
};

type SvgRenderBoundsOptions = {
    maxWidth?: number;
    maxHeight?: number;
    renderScale?: number;
};

type MathRenderOptions = SvgRenderBoundsOptions & {
    displayMode?: boolean;
    textColor?: string;
};

type MermaidRenderOptions = SvgRenderBoundsOptions & {
    theme?: 'dark' | 'default';
};

const adaptor = liteAdaptor();
const mathHandlers = new HandlerList();
mathHandlers.register(new HTMLHandler(adaptor));
const texInput = new TeX({
    packages: AllPackages,
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
});
const svgOutput = new SVG({ fontCache: 'none' });
const mathDocument = mathHandlers.document('', {
    InputJax: texInput,
    OutputJax: svgOutput,
});

let mermaidEnvironmentPromise: Promise<MermaidEnvironment> | null = null;
let mermaidModulePromise: Promise<any> | null = null;
let mermaidRenderQueue: Promise<unknown> = Promise.resolve();
let mermaidRenderCounter = 0;
let resvgInitPromise: Promise<void> | null = null;

interface MermaidEnvironment {
    dom: JSDOM;
    window: JSDOM["window"];
    host: HTMLElement;
    mermaid: any;
}

export type RasterizedRender = {
    svg: string;
    pngBase64: string;
    width: number;
    height: number;
};

export type RasterizedMermaidRender = RasterizedRender;

export type MermaidRenderStageSnapshot = RasterizedRender & {
    stage: 'raw' | 'styles_sanitized' | 'visual_normalized' | 'labels_fitted' | 'final';
};

export async function renderMathSvg(source: string, options: MathRenderOptions = {}): Promise<string> {
    const trimmedSource = source.trim();
    if (!trimmedSource) {
        throw new Error('Cannot render an empty math expression.');
    }

    const displayMode = options.displayMode !== false;
    const textColor = (options.textColor || MATH_TEXT_COLOR).trim() || MATH_TEXT_COLOR;
    const convertedNode = mathDocument.convert(trimmedSource, { display: displayMode }) as any;
    const containerMarkup = adaptor.outerHTML(convertedNode);
    const svgMarkup = sanitizeSvgMarkup(extractSvgMarkup(containerMarkup));
    const svgDom = new JSDOM(svgMarkup, { contentType: 'image/svg+xml' });
    const svg = svgDom.window.document.querySelector('svg');
    if (!svg) {
        throw new Error('MathJax did not produce an SVG root element.');
    }

    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
    svg.setAttribute('role', 'img');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');

    const viewBox = parseViewBox(svg.getAttribute('viewBox'));
    const widthPx = convertSvgLengthToPixels(svg.getAttribute('width'), viewBox.width);
    const heightPx = convertSvgLengthToPixels(svg.getAttribute('height'), viewBox.height);
    const normalizedMathSize = clampSvgDimensions(widthPx, heightPx, {
        maxWidth: options.maxWidth ?? DEFAULT_MATH_MAX_WIDTH,
        maxHeight: options.maxHeight ?? DEFAULT_MATH_MAX_HEIGHT,
    });
    svg.setAttribute('width', `${normalizedMathSize.width}`);
    svg.setAttribute('height', `${normalizedMathSize.height}`);

    const styleValue = svg.getAttribute('style') || '';
    const sanitizedStyle = styleValue
        .split(';')
        .map((part: string) => part.trim())
        .filter((part: string) => part.length > 0 && !part.startsWith('vertical-align'));
    sanitizedStyle.push(`color: ${textColor}`);
    svg.setAttribute('style', sanitizedStyle.join('; '));
    svg.setAttribute('color', textColor);

    return svg.outerHTML;
}

type MermaidRenderArtifacts = {
    rawSvg: string;
    sanitizedStylesSvg: string;
    visualNormalizedSvg: string;
    labelsFittedSvg: string;
    finalSvg: string;
};

function prepareMermaidSvgRoot(svg: SVGSVGElement): void {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
    svg.setAttribute('role', 'img');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.background = MERMAID_BACKGROUND;
}

async function buildMermaidRenderArtifacts(trimmedSource: string, options: MermaidRenderOptions): Promise<MermaidRenderArtifacts> {
    const environment = await ensureMermaidEnvironment(options.theme || 'dark');
    const renderId = `godot-mermaid-${++mermaidRenderCounter}`;
    const host = environment.host;
    host.innerHTML = '';

    const result = await environment.mermaid.render(renderId, trimmedSource, host);
    const svgMarkup = sanitizeSvgMarkup(result.svg);
    const svgDom = new JSDOM(svgMarkup, { contentType: 'image/svg+xml' });
    const svg = svgDom.window.document.querySelector('svg');
    if (!svg) {
        throw new Error('Mermaid did not produce an SVG root element.');
    }

    prepareMermaidSvgRoot(svg);
    const rawSvg = svg.outerHTML;

    sanitizeMermaidGeneratedStyles(svg);
    const sanitizedStylesSvg = svg.outerHTML;

    applyMermaidVisualStyles(svg);
    const visualNormalizedSvg = svg.outerHTML;

    fitMermaidLabelShapes(svg);
    const labelsFittedSvg = svg.outerHTML;

    const computedBounds = computeSvgBounds(svg);
    const width = Math.max(48, Math.ceil(computedBounds.maxX - computedBounds.minX + MERMAID_PADDING * 2));
    const height = Math.max(48, Math.ceil(computedBounds.maxY - computedBounds.minY + MERMAID_PADDING * 2));
    const minX = Math.floor(computedBounds.minX - MERMAID_PADDING);
    const minY = Math.floor(computedBounds.minY - MERMAID_PADDING);
    svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
    const normalizedMermaidSize = clampSvgDimensions(width, height, {
        maxWidth: options.maxWidth ?? DEFAULT_MERMAID_MAX_WIDTH,
        maxHeight: options.maxHeight ?? DEFAULT_MERMAID_MAX_HEIGHT,
    });
    svg.setAttribute('width', `${normalizedMermaidSize.width}`);
    svg.setAttribute('height', `${normalizedMermaidSize.height}`);
    svg.style.maxWidth = `${normalizedMermaidSize.width}px`;

    return {
        rawSvg,
        sanitizedStylesSvg,
        visualNormalizedSvg,
        labelsFittedSvg,
        finalSvg: svg.outerHTML,
    };
}

export async function renderMermaidSvg(source: string, options: MermaidRenderOptions = {}): Promise<string> {
    const trimmedSource = source.trim();
    if (!trimmedSource) {
        throw new Error('Cannot render an empty Mermaid definition.');
    }

    return enqueueMermaidRender(async () => {
        const artifacts = await buildMermaidRenderArtifacts(trimmedSource, options);
        return artifacts.finalSvg;
    });
}

export async function collectMermaidRenderStageSnapshots(source: string, options: MermaidRenderOptions = {}): Promise<MermaidRenderStageSnapshot[]> {
    const trimmedSource = source.trim();
    if (!trimmedSource) {
        throw new Error('Cannot render an empty Mermaid definition.');
    }

    return enqueueMermaidRender(async () => {
        const artifacts = await buildMermaidRenderArtifacts(trimmedSource, options);
        const stages: Array<{ stage: MermaidRenderStageSnapshot['stage']; svg: string }> = [
            { stage: 'raw', svg: artifacts.rawSvg },
            { stage: 'styles_sanitized', svg: artifacts.sanitizedStylesSvg },
            { stage: 'visual_normalized', svg: artifacts.visualNormalizedSvg },
            { stage: 'labels_fitted', svg: artifacts.labelsFittedSvg },
            { stage: 'final', svg: artifacts.finalSvg },
        ];
        const snapshots: MermaidRenderStageSnapshot[] = [];
        for (const stage of stages) {
            const rasterized = await rasterizeSvgToPng(stage.svg, options.renderScale, 16);
            snapshots.push({
                stage: stage.stage,
                svg: stage.svg,
                pngBase64: rasterized.pngBase64,
                width: rasterized.width,
                height: rasterized.height,
            });
        }
        return snapshots;
    });
}

export async function renderMathPng(source: string, options: MathRenderOptions = {}): Promise<RasterizedRender> {
    const svg = await renderMathSvg(source, options);
    return rasterizeSvgToPng(svg, options.renderScale, 16);
}

export async function renderMermaidPng(source: string, options: MermaidRenderOptions = {}): Promise<RasterizedMermaidRender> {
    const svg = await renderMermaidSvg(source, options);
    return rasterizeSvgToPng(svg, options.renderScale, 16);
}

async function enqueueMermaidRender<T>(work: () => Promise<T>): Promise<T> {
    const nextWork = mermaidRenderQueue.then(work);
    mermaidRenderQueue = nextWork.then(() => undefined, () => undefined);
    return nextWork;
}

async function ensureResvgReady(): Promise<void> {
    if (!resvgInitPromise) {
        const wasmBinary = Buffer.from(RESVG_WASM_BASE64, 'base64');
        resvgInitPromise = initWasm(wasmBinary);
    }
    return resvgInitPromise!;
}

async function rasterizeSvgToPng(svg: string, requestedRenderScale: number | undefined, defaultFontSize: number): Promise<RasterizedRender> {
    await ensureResvgReady();

    const safeRenderScale = resolveSafeRasterScale(svg, requestedRenderScale);
    const fitTo = safeRenderScale > 1
        ? { mode: 'zoom' as const, value: safeRenderScale }
        : { mode: 'original' as const };

    const resvg = new Resvg(svg, {
        fitTo,
        background: GODOT_RASTER_BACKGROUND,
        languages: ['zh-CN', 'zh', 'en-US', 'en'],
        textRendering: 2,
        shapeRendering: 2,
        font: {
            loadSystemFonts: true,
            defaultFontFamily: RESVG_DEFAULT_FONT_FAMILY,
            sansSerifFamily: RESVG_DEFAULT_FONT_FAMILY,
            serifFamily: RESVG_DEFAULT_SERIF_FAMILY,
            monospaceFamily: RESVG_DEFAULT_MONOSPACE_FAMILY,
            defaultFontSize,
        },
    });
    const renderedImage = resvg.render();

    try {
        return {
            svg,
            pngBase64: Buffer.from(renderedImage.asPng()).toString('base64'),
            width: renderedImage.width,
            height: renderedImage.height,
        };
    } finally {
        renderedImage.free();
        resvg.free();
    }
}

async function ensureMermaidEnvironment(theme: 'dark' | 'default'): Promise<MermaidEnvironment> {
    if (!mermaidEnvironmentPromise) {
        mermaidEnvironmentPromise = createMermaidEnvironment(theme);
    }

    const environment = await mermaidEnvironmentPromise;
    environment.host.style.background = MERMAID_BACKGROUND;
    environment.host.style.color = MERMAID_TEXT_COLOR;
    environment.host.style.fontFamily = MERMAID_FONT_FAMILY;
    environment.mermaid.initialize(getMermaidConfig(theme));
    return environment;
}

async function createMermaidEnvironment(theme: 'dark' | 'default'): Promise<MermaidEnvironment> {
    const dom = new JSDOM('<!doctype html><html><body><div id="mermaid-host"></div></body></html>', {
        pretendToBeVisual: true,
        runScripts: 'dangerously',
        resources: 'usable',
        url: 'http://localhost/',
    });
    const window = dom.window;
    const host = window.document.getElementById('mermaid-host') as HTMLElement | null;
    if (!host) {
        throw new Error('Unable to create a Mermaid render host.');
    }

    const globalScope = globalThis as any;
    globalScope.window = window;
    globalScope.document = window.document;
    Object.defineProperty(globalScope, 'navigator', {
        value: window.navigator,
        configurable: true,
        writable: true,
    });
    globalScope.Element = window.Element;
    globalScope.HTMLElement = window.HTMLElement;
    globalScope.SVGElement = window.SVGElement;
    globalScope.Node = window.Node;
    globalScope.getComputedStyle = window.getComputedStyle.bind(window);

    installSvgMeasurementPolyfills(window);

    const mermaid = await loadMermaidModule(window);
    mermaid.initialize(getMermaidConfig(theme));

    return {
        dom,
        window,
        host,
        mermaid,
    };
}

async function loadMermaidModule(window: JSDOM['window']): Promise<any> {
    if (!(process as any).pkg) {
        if (!mermaidModulePromise) {
            mermaidModulePromise = (async () => {
                const mermaidModule = await dynamicImport('mermaid');
                return mermaidModule.default ?? mermaidModule;
            })();
        }
        return mermaidModulePromise;
    }

    const script = window.document.createElement('script');
    script.textContent = Buffer.from(MERMAID_BROWSER_BUNDLE_BASE64, 'base64').toString('utf8');
    window.document.body.appendChild(script);
    const mermaid = (window as any).mermaid;
    if (!mermaid) {
        throw new Error('Embedded Mermaid runtime failed to initialize.');
    }
    return mermaid;
}

function getMermaidConfig(theme: 'dark' | 'default') {
    return {
        startOnLoad: false,
        securityLevel: 'loose',
        theme,
        fontFamily: MERMAID_FONT_FAMILY,
        // Keep Mermaid output in pure SVG text so Godot's SVG loader can render it reliably.
        htmlLabels: false,
        markdownAutoWrap: true,
        maxTextSize: 200000,
        maxEdges: 5000,

        flowchart: {
            useMaxWidth: false,
            htmlLabels: false,
            nodeSpacing: MERMAID_NODE_SPACING,
            rankSpacing: MERMAID_RANK_SPACING,
            padding: MERMAID_LABEL_PADDING,
            wrappingWidth: MERMAID_WRAPPING_WIDTH,
        },
        themeVariables: theme === 'dark' ? MERMAID_DARK_THEME_VARIABLES : undefined,
    };
}

function sanitizeMermaidGeneratedStyles(svg: SVGSVGElement): void {
    for (const styleNode of Array.from(svg.querySelectorAll('style'))) {
        if (styleNode.id === 'noteconnection-mermaid-overrides') {
            continue;
        }
        const cssText = styleNode.textContent || '';
        styleNode.textContent = rewriteMermaidClusterRules(cssText);
    }
}

function rewriteMermaidClusterRules(cssText: string): string {
    return cssText.replace(/(\.cluster\s+(?:rect|polygon)\s*\{)[^}]*(\})/g, (_match, start, end) => {
        return `${start}fill:${MERMAID_CLUSTER_BACKGROUND};stroke:${MERMAID_NODE_BORDER};stroke-width:1px;${end}`;
    });
}
function applyMermaidVisualStyles(svg: SVGSVGElement): void {
    svg.style.background = MERMAID_BACKGROUND;
    svg.querySelectorAll('foreignObject').forEach((node) => node.remove());

    applySvgAttributes(
        svg.querySelectorAll('text, tspan, .nodeLabel, .edgeLabel, .messageText, .loopText, .noteText'),
        {
            fill: MERMAID_TEXT_COLOR,
            'text-rendering': 'geometricPrecision',
        },
    );

    applySvgAttributes(
        svg.querySelectorAll('.node rect, .node circle, .node ellipse, .node polygon, .node path'),
        {
            fill: MERMAID_NODE_BACKGROUND,
            stroke: MERMAID_NODE_BORDER,
        },
    );

    applySvgAttributes(
        svg.querySelectorAll('.cluster rect, .cluster polygon'),
        {
            fill: MERMAID_CLUSTER_BACKGROUND,
            stroke: MERMAID_NODE_BORDER,
        },
    );

    applySvgAttributes(
        svg.querySelectorAll('.labelBkg, .edgeLabel rect, .edgeLabel polygon, .cluster-label rect, .cluster-label polygon, .note rect'),
        {
            fill: MERMAID_SURFACE_BACKGROUND,
            stroke: MERMAID_SURFACE_BACKGROUND,
        },
    );

    applySvgAttributes(
        svg.querySelectorAll('.edgePaths path, .flowchart-link, .relationshipLine, .messageLine0, .messageLine1'),
        {
            stroke: MERMAID_EDGE_COLOR,
            fill: 'none',
        },
    );

    applySvgAttributes(
        svg.querySelectorAll('marker path, .marker, .arrowheadPath'),
        {
            stroke: MERMAID_EDGE_COLOR,
            fill: MERMAID_EDGE_COLOR,
        },
    );

    upsertMermaidOverrideStyle(svg);
}

type SvgBoxBounds = { x: number; y: number; width: number; height: number };

function fitMermaidLabelShapes(svg: SVGSVGElement): void {
    const groupSelectors = ['.node', '.edgeLabel'];
    for (const selector of groupSelectors) {
        const paddingX = selector === '.edgeLabel' ? 12 : 18;
        const paddingY = selector === '.edgeLabel' ? 10 : 14;
        for (const group of Array.from(svg.querySelectorAll(selector))) {
            const labelBounds = collectMermaidLabelBounds(group, selector === '.edgeLabel');
            if (!labelBounds) {
                continue;
            }
            const shape = findMermaidShapeNode(group);
            if (!shape) {
                continue;
            }
            let shapeBounds: SvgBoxBounds | null = null;
            try {
                const rawShapeBounds = (shape as any).getBBox();
                if (!isFiniteSvgBoxBounds(rawShapeBounds)) {
                    continue;
                }
                shapeBounds = rawShapeBounds;
            } catch {
                continue;
            }
            const targetWidth = Math.max(shapeBounds.width, labelBounds.width + paddingX * 2);
            const targetHeight = Math.max(shapeBounds.height, labelBounds.height + paddingY * 2);
            if (targetWidth <= shapeBounds.width + 1 && targetHeight <= shapeBounds.height + 1) {
                continue;
            }
            fitMermaidShapeToBounds(shape, shapeBounds, targetWidth, targetHeight);
        }
    }
}

function collectMermaidLabelBounds(group: Element, includePlainTextNodes = false): SvgBoxBounds | null {
    let combinedBounds: SvgBoxBounds | null = null;
    const labelCandidates: Element[] = [];
    const primaryLabel = group.querySelector('.nodeLabel, .edgeLabel, .label, .label text');
    if (primaryLabel) {
        labelCandidates.push(primaryLabel);
    }
    if (labelCandidates.length === 0 || includePlainTextNodes) {
        labelCandidates.push(...Array.from(group.querySelectorAll(includePlainTextNodes ? 'text, tspan' : '.nodeLabel, .label, text')));
    }
    for (const node of labelCandidates) {
        if (!(node.textContent || '').trim()) {
            continue;
        }
        try {
            const nextBounds = (node as any).getBBox();
            if (!isFiniteSvgBoxBounds(nextBounds)) {
                continue;
            }
            combinedBounds = unionSvgBoxBounds(combinedBounds, nextBounds);
        } catch {
            continue;
        }
    }
    return combinedBounds;
}

function unionSvgBoxBounds(currentBounds: SvgBoxBounds | null, nextBounds: SvgBoxBounds): SvgBoxBounds {
    if (!currentBounds) {
        return { x: nextBounds.x, y: nextBounds.y, width: nextBounds.width, height: nextBounds.height };
    }
    const minX = Math.min(currentBounds.x, nextBounds.x);
    const minY = Math.min(currentBounds.y, nextBounds.y);
    const maxX = Math.max(currentBounds.x + currentBounds.width, nextBounds.x + nextBounds.width);
    const maxY = Math.max(currentBounds.y + currentBounds.height, nextBounds.y + nextBounds.height);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function isFiniteSvgBoxBounds(bounds: Partial<SvgBoxBounds> | null | undefined): bounds is SvgBoxBounds {
    const width = Number(bounds?.width);
    const height = Number(bounds?.height);
    return !!bounds
        && Number.isFinite(bounds.x)
        && Number.isFinite(bounds.y)
        && Number.isFinite(width)
        && Number.isFinite(height)
        && width > 0
        && height > 0;
}

function findMermaidShapeNode(group: Element): Element | null {
    for (const child of Array.from(group.children)) {
        const tagName = child.tagName.toLowerCase();
        if (tagName === 'rect' || tagName === 'polygon' || tagName === 'ellipse' || tagName === 'circle') {
            return child;
        }
    }
    return group.querySelector('rect, polygon, ellipse, circle');
}

function fitMermaidShapeToBounds(shape: Element, shapeBounds: SvgBoxBounds, targetWidth: number, targetHeight: number): void {
    const centerX = shapeBounds.x + shapeBounds.width / 2;
    const centerY = shapeBounds.y + shapeBounds.height / 2;
    const tagName = shape.tagName.toLowerCase();
    if (tagName === 'rect') {
        shape.setAttribute('x', `${centerX - targetWidth / 2}`);
        shape.setAttribute('y', `${centerY - targetHeight / 2}`);
        shape.setAttribute('width', `${targetWidth}`);
        shape.setAttribute('height', `${targetHeight}`);
        return;
    }
    if (tagName === 'ellipse') {
        shape.setAttribute('cx', `${centerX}`);
        shape.setAttribute('cy', `${centerY}`);
        shape.setAttribute('rx', `${targetWidth / 2}`);
        shape.setAttribute('ry', `${targetHeight / 2}`);
        return;
    }
    if (tagName === 'circle') {
        shape.setAttribute('cx', `${centerX}`);
        shape.setAttribute('cy', `${centerY}`);
        shape.setAttribute('r', `${Math.max(targetWidth, targetHeight) / 2}`);
        return;
    }
    if (tagName === 'polygon') {
        const scaleX = shapeBounds.width > 0 ? targetWidth / shapeBounds.width : 1;
        const scaleY = shapeBounds.height > 0 ? targetHeight / shapeBounds.height : 1;
        if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
            return;
        }
        const scaledPoints = scaleSvgPolygonPoints(shape.getAttribute('points'), centerX, centerY, scaleX, scaleY);
        if (scaledPoints) {
            shape.setAttribute('points', scaledPoints);
        }
    }
}

function scaleSvgPolygonPoints(pointsValue: string | null, centerX: number, centerY: number, scaleX: number, scaleY: number): string | null {
    if (!pointsValue) {
        return null;
    }
    const scaledPoints: string[] = [];
    for (const pair of pointsValue.trim().split(/\s+/)) {
        const [rawX, rawY] = pair.split(',');
        const pointX = Number.parseFloat(rawX || '');
        const pointY = Number.parseFloat(rawY || '');
        if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) {
            return null;
        }
        const nextX = centerX + (pointX - centerX) * scaleX;
        const nextY = centerY + (pointY - centerY) * scaleY;
        scaledPoints.push(`${nextX},${nextY}`);
    }
    return scaledPoints.join(' ');
}

function upsertMermaidOverrideStyle(svg: SVGSVGElement): void {
    const styleId = 'noteconnection-mermaid-overrides';
    let styleNode = svg.querySelector('#' + styleId) as SVGStyleElement | null;
    if (!styleNode) {
        styleNode = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'style') as SVGStyleElement;
        styleNode.setAttribute('id', styleId);
        svg.appendChild(styleNode);
    }
    styleNode.textContent = [
        'text, tspan, .nodeLabel, .edgeLabel, .messageText, .loopText, .noteText { fill: ' + MERMAID_TEXT_COLOR + ' !important; text-rendering: geometricPrecision !important; }',
        '.node rect, .node circle, .node ellipse, .node polygon, .node path, .basic.label-container, .label-container { fill: ' + MERMAID_NODE_BACKGROUND + ' !important; stroke: ' + MERMAID_NODE_BORDER + ' !important; }',
        '.cluster rect, .cluster polygon { fill: ' + MERMAID_CLUSTER_BACKGROUND + ' !important; stroke: ' + MERMAID_NODE_BORDER + ' !important; }',
        '.labelBkg, .edgeLabel rect, .edgeLabel polygon, .cluster-label rect, .cluster-label polygon, .note rect { fill: ' + MERMAID_SURFACE_BACKGROUND + ' !important; stroke: ' + MERMAID_SURFACE_BACKGROUND + ' !important; }',
        '.edgePaths path, .flowchart-link, .relationshipLine, .messageLine0, .messageLine1 { stroke: ' + MERMAID_EDGE_COLOR + ' !important; fill: none !important; }',
        'marker path, .marker, .arrowheadPath { stroke: ' + MERMAID_EDGE_COLOR + ' !important; fill: ' + MERMAID_EDGE_COLOR + ' !important; }',
    ].join('\n');
}

function applySvgAttributes(nodes: Iterable<Element>, attributes: Record<string, string>): void {
    for (const node of nodes) {
        for (const [key, value] of Object.entries(attributes)) {
            node.setAttribute(key, value);
        }
    }
}

function installSvgMeasurementPolyfills(window: JSDOM["window"]): void {
    const prototype = (window.SVGElement as any).prototype;
    if (typeof prototype.getBBox !== 'function') {
        prototype.getBBox = function getBBoxShim(): DOMRect {
            const bounds = computeElementBounds(this, { tx: 0, ty: 0, sx: 1, sy: 1 });
            return {
                x: bounds.minX,
                y: bounds.minY,
                width: bounds.maxX - bounds.minX,
                height: bounds.maxY - bounds.minY,
            } as DOMRect;
        };
    }

    if (typeof prototype.getComputedTextLength !== 'function') {
        prototype.getComputedTextLength = function getComputedTextLengthShim(): number {
            return estimateTextBoundsForElement(this as Element).width;
        };
    }
}

function extractSvgMarkup(containerMarkup: string): string {
    const htmlDom = new JSDOM(`<!doctype html><html><body>${containerMarkup}</body></html>`);
    const svg = htmlDom.window.document.querySelector('svg');
    if (!svg) {
        throw new Error('Expected MathJax to return SVG markup.');
    }
    return svg.outerHTML;
}

function convertSvgLengthToPixels(lengthValue: string | null, fallback: number): number {
    if (!lengthValue) {
        return Math.max(1, fallback / 42.0);
    }

    const numeric = Number.parseFloat(lengthValue);
    if (!Number.isFinite(numeric)) {
        return Math.max(1, fallback / 42.0);
    }

    if (lengthValue.endsWith('ex')) {
        return numeric * 8.0;
    }
    if (lengthValue.endsWith('em')) {
        return numeric * 16.0;
    }
    return numeric;
}

function parseViewBox(viewBoxValue: string | null): { x: number; y: number; width: number; height: number } {
    const fallback = { x: 0, y: 0, width: 256, height: 64 };
    if (!viewBoxValue) {
        return fallback;
    }

    const parts = viewBoxValue
        .trim()
        .split(/\s+/)
        .map(part => Number.parseFloat(part))
        .filter(value => Number.isFinite(value));
    if (parts.length !== 4) {
        return fallback;
    }

    return {
        x: parts[0],
        y: parts[1],
        width: parts[2],
        height: parts[3],
    };
}

function resolveSafeRasterScale(svgMarkup: string, requestedRenderScale: number | undefined): number {
    const numericScale = Number.isFinite(requestedRenderScale) ? Number(requestedRenderScale) : 1;
    const desiredScale = Math.max(1, numericScale);
    if (desiredScale <= 1) {
        return 1;
    }

    const svgDom = new JSDOM(svgMarkup, { contentType: 'image/svg+xml' });
    const svg = svgDom.window.document.querySelector('svg');
    if (!svg) {
        return 1;
    }

    const viewBox = parseViewBox(svg.getAttribute('viewBox'));
    const width = convertSvgLengthToPixels(svg.getAttribute('width'), viewBox.width);
    const height = convertSvgLengthToPixels(svg.getAttribute('height'), viewBox.height);
    if (width <= 0 || height <= 0) {
        return 1;
    }

    const safeScale = Math.min(
        desiredScale,
        MAX_GODOT_RASTER_DIMENSION / width,
        MAX_GODOT_RASTER_DIMENSION / height,
    );
    return Math.max(1, safeScale);
}

function clampSvgDimensions(width: number, height: number, options: SvgRenderBoundsOptions = {}): { width: number; height: number } {
    const safeWidth = Math.max(1, Math.ceil(width));
    const safeHeight = Math.max(1, Math.ceil(height));
    const requestedMaxWidth = Number.isFinite(options.maxWidth) ? Number(options.maxWidth) : MAX_GODOT_SVG_DIMENSION;
    const requestedMaxHeight = Number.isFinite(options.maxHeight) ? Number(options.maxHeight) : MAX_GODOT_SVG_DIMENSION;
    const maxWidth = Math.max(1, Math.min(MAX_GODOT_SVG_DIMENSION, Math.floor(requestedMaxWidth)));
    const maxHeight = Math.max(1, Math.min(MAX_GODOT_SVG_DIMENSION, Math.floor(requestedMaxHeight)));
    const scale = Math.min(1, maxWidth / safeWidth, maxHeight / safeHeight, MAX_GODOT_SVG_DIMENSION / safeWidth, MAX_GODOT_SVG_DIMENSION / safeHeight);

    if (!Number.isFinite(scale) || scale >= 1) {
        return { width: safeWidth, height: safeHeight };
    }

    return {
        width: Math.max(1, Math.floor(safeWidth * scale)),
        height: Math.max(1, Math.floor(safeHeight * scale)),
    };
}

function sanitizeSvgMarkup(svgMarkup: string): string {
    return svgMarkup
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&(?!#\d+;|#x[\dA-Fa-f]+;|[A-Za-z][\w.-]*;)/g, '&amp;');
}

function computeSvgBounds(svg: Element): Bounds {
    const bounds = computeElementBounds(svg, { tx: 0, ty: 0, sx: 1, sy: 1 });
    if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.maxY)) {
        return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    }
    if (bounds.maxX - bounds.minX < 1 || bounds.maxY - bounds.minY < 1) {
        return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    }
    return bounds;
}

function computeElementBounds(element: Element, parentTransform: Transform): Bounds {
    const currentTransform = combineTransforms(parentTransform, parseTransform(element.getAttribute('transform')));
    const tagName = element.tagName.toLowerCase();

    switch (tagName) {
        case 'svg':
        case 'g':
        case 'a':
            return unionBounds(Array.from(element.children).map(child => computeElementBounds(child, currentTransform)));
        case 'style':
        case 'defs':
        case 'title':
        case 'desc':
        case 'metadata':
        case 'script':
        case 'clipPath':
        case 'mask':
        case 'pattern':
            return emptyBounds();
        case 'rect':
        case 'image': {
            const x = currentTransform.tx + parseNumericAttribute(element, 'x') * currentTransform.sx;
            const y = currentTransform.ty + parseNumericAttribute(element, 'y') * currentTransform.sy;
            const width = parseNumericAttribute(element, 'width') * currentTransform.sx;
            const height = parseNumericAttribute(element, 'height') * currentTransform.sy;
            return boundsFromBox(x, y, width, height);
        }
        case 'circle': {
            const cx = currentTransform.tx + parseNumericAttribute(element, 'cx') * currentTransform.sx;
            const cy = currentTransform.ty + parseNumericAttribute(element, 'cy') * currentTransform.sy;
            const r = parseNumericAttribute(element, 'r') * Math.max(currentTransform.sx, currentTransform.sy);
            return boundsFromBox(cx - r, cy - r, r * 2, r * 2);
        }
        case 'ellipse': {
            const cx = currentTransform.tx + parseNumericAttribute(element, 'cx') * currentTransform.sx;
            const cy = currentTransform.ty + parseNumericAttribute(element, 'cy') * currentTransform.sy;
            const rx = parseNumericAttribute(element, 'rx') * currentTransform.sx;
            const ry = parseNumericAttribute(element, 'ry') * currentTransform.sy;
            return boundsFromBox(cx - rx, cy - ry, rx * 2, ry * 2);
        }
        case 'line': {
            const x1 = currentTransform.tx + parseNumericAttribute(element, 'x1') * currentTransform.sx;
            const y1 = currentTransform.ty + parseNumericAttribute(element, 'y1') * currentTransform.sy;
            const x2 = currentTransform.tx + parseNumericAttribute(element, 'x2') * currentTransform.sx;
            const y2 = currentTransform.ty + parseNumericAttribute(element, 'y2') * currentTransform.sy;
            return boundsFromPoints([{ x: x1, y: y1 }, { x: x2, y: y2 }]);
        }
        case 'polyline':
        case 'polygon': {
            return boundsFromPoints(parsePointList(element.getAttribute('points')).map(point => ({
                x: currentTransform.tx + point.x * currentTransform.sx,
                y: currentTransform.ty + point.y * currentTransform.sy,
            })));
        }
        case 'path': {
            return boundsFromPoints(parsePathPoints(element.getAttribute('d')).map(point => ({
                x: currentTransform.tx + point.x * currentTransform.sx,
                y: currentTransform.ty + point.y * currentTransform.sy,
            })));
        }
        case 'text': {
            const textBounds = estimateTextBoundsForElement(element);
            const x = currentTransform.tx + parseNumericAttribute(element, 'x') * currentTransform.sx;
            const y = currentTransform.ty + parseNumericAttribute(element, 'y') * currentTransform.sy;
            const anchor = (element.getAttribute('text-anchor') || '').trim().toLowerCase();
            let left = x;
            if (anchor === 'middle') {
                left -= textBounds.width / 2.0;
            } else if (anchor === 'end') {
                left -= textBounds.width;
            }
            const top = y - textBounds.height * 0.82;
            return boundsFromBox(left, top, textBounds.width, textBounds.height);
        }
        default: {
            if (element.children.length > 0) {
                return unionBounds(Array.from(element.children).map(child => computeElementBounds(child, currentTransform)));
            }
            if ((element.textContent || '').trim().length > 0) {
                const textBounds = estimateTextBoundsForElement(element);
                return boundsFromBox(currentTransform.tx, currentTransform.ty, textBounds.width, textBounds.height);
            }
            return emptyBounds();
        }
    }
}

function combineTransforms(parent: Transform, local: Transform): Transform {
    return {
        tx: parent.tx + local.tx * parent.sx,
        ty: parent.ty + local.ty * parent.sy,
        sx: parent.sx * local.sx,
        sy: parent.sy * local.sy,
    };
}

function parseTransform(transformValue: string | null): Transform {
    const initial: Transform = { tx: 0, ty: 0, sx: 1, sy: 1 };
    if (!transformValue) {
        return initial;
    }

    const transformRegex = /(translate|scale)\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    let transform = initial;
    while ((match = transformRegex.exec(transformValue)) !== null) {
        const command = match[1];
        const values = match[2]
            .split(/[ ,]+/)
            .map(value => Number.parseFloat(value))
            .filter(value => Number.isFinite(value));
        if (command === 'translate') {
            transform = combineTransforms(transform, {
                tx: values[0] || 0,
                ty: values.length > 1 ? values[1] : 0,
                sx: 1,
                sy: 1,
            });
        } else if (command === 'scale') {
            const sx = values[0] || 1;
            const sy = values.length > 1 ? values[1] : sx;
            transform = combineTransforms(transform, {
                tx: 0,
                ty: 0,
                sx,
                sy,
            });
        }
    }
    return transform;
}

function parseNumericAttribute(element: Element, name: string, fallback = 0): number {
    const rawValue = element.getAttribute(name);
    if (!rawValue) {
        return fallback;
    }
    const numeric = Number.parseFloat(rawValue);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function parsePointList(pointsValue: string | null): Array<{ x: number; y: number }> {
    if (!pointsValue) {
        return [];
    }
    const numbers = pointsValue
        .trim()
        .split(/[ ,]+/)
        .map(part => Number.parseFloat(part))
        .filter(value => Number.isFinite(value));
    const points: Array<{ x: number; y: number }> = [];
    for (let index = 0; index + 1 < numbers.length; index += 2) {
        points.push({ x: numbers[index], y: numbers[index + 1] });
    }
    return points;
}

function parsePathPoints(pathValue: string | null): Array<{ x: number; y: number }> {
    if (!pathValue) {
        return [];
    }
    const commands = pathValue.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    const points: Array<{ x: number; y: number }> = [];
    let cursorX = 0;
    let cursorY = 0;
    for (const commandChunk of commands) {
        const command = commandChunk[0];
        const numbers = (commandChunk.slice(1).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [])
            .map(value => Number.parseFloat(value))
            .filter(value => Number.isFinite(value));
        const absolute = command === command.toUpperCase();
        switch (command.toUpperCase()) {
            case 'M':
            case 'L':
            case 'T':
                for (let index = 0; index + 1 < numbers.length; index += 2) {
                    cursorX = absolute ? numbers[index] : cursorX + numbers[index];
                    cursorY = absolute ? numbers[index + 1] : cursorY + numbers[index + 1];
                    points.push({ x: cursorX, y: cursorY });
                }
                break;
            case 'H':
                for (const value of numbers) {
                    cursorX = absolute ? value : cursorX + value;
                    points.push({ x: cursorX, y: cursorY });
                }
                break;
            case 'V':
                for (const value of numbers) {
                    cursorY = absolute ? value : cursorY + value;
                    points.push({ x: cursorX, y: cursorY });
                }
                break;
            case 'C':
                for (let index = 0; index + 5 < numbers.length; index += 6) {
                    const endX = absolute ? numbers[index + 4] : cursorX + numbers[index + 4];
                    const endY = absolute ? numbers[index + 5] : cursorY + numbers[index + 5];
                    const controlOneX = absolute ? numbers[index] : cursorX + numbers[index];
                    const controlOneY = absolute ? numbers[index + 1] : cursorY + numbers[index + 1];
                    const controlTwoX = absolute ? numbers[index + 2] : cursorX + numbers[index + 2];
                    const controlTwoY = absolute ? numbers[index + 3] : cursorY + numbers[index + 3];
                    points.push(
                        { x: controlOneX, y: controlOneY },
                        { x: controlTwoX, y: controlTwoY },
                        { x: endX, y: endY },
                    );
                    cursorX = endX;
                    cursorY = endY;
                }
                break;
            case 'S':
            case 'Q':
                for (let index = 0; index + 3 < numbers.length; index += 4) {
                    const controlX = absolute ? numbers[index] : cursorX + numbers[index];
                    const controlY = absolute ? numbers[index + 1] : cursorY + numbers[index + 1];
                    const endX = absolute ? numbers[index + 2] : cursorX + numbers[index + 2];
                    const endY = absolute ? numbers[index + 3] : cursorY + numbers[index + 3];
                    points.push({ x: controlX, y: controlY }, { x: endX, y: endY });
                    cursorX = endX;
                    cursorY = endY;
                }
                break;
            case 'A':
                for (let index = 0; index + 6 < numbers.length; index += 7) {
                    const endX = absolute ? numbers[index + 5] : cursorX + numbers[index + 5];
                    const endY = absolute ? numbers[index + 6] : cursorY + numbers[index + 6];
                    points.push({ x: endX, y: endY });
                    cursorX = endX;
                    cursorY = endY;
                }
                break;
            case 'Z':
                break;
            default:
                break;
        }
    }
    return points;
}

function estimateTextBounds(text: string, fontSize = 16, lineHeight = 0): { width: number; height: number } {
    const resolvedFontSize = Math.max(10, fontSize || 16);
    const resolvedLineHeight = Math.max(resolvedFontSize * 1.18, lineHeight || resolvedFontSize + 4);
    const lines = normalizeMeasurementLines(text);
    const longestLineWidth = lines.reduce((max, line) => Math.max(max, estimateTextLineWidth(line, resolvedFontSize)), 0);
    return {
        width: Math.max(resolvedFontSize * 0.75, longestLineWidth),
        height: Math.max(resolvedLineHeight, lines.length * resolvedLineHeight),
    };
}

function estimateTextBoundsForElement(element: Element): { width: number; height: number } {
    const fontSize = resolveSvgFontSize(element);
    const lineHeight = resolveSvgLineHeight(element, fontSize);
    const lines = extractElementMeasurementLines(element);
    const longestLineWidth = lines.reduce((max, line) => Math.max(max, estimateTextLineWidth(line, fontSize)), 0);
    return {
        width: Math.max(fontSize * 0.75, longestLineWidth),
        height: Math.max(lineHeight, lines.length * lineHeight),
    };
}

function extractElementMeasurementLines(element: Element): string[] {
    const directTextChildren = Array.from(element.children)
        .filter((child) => child.tagName.toLowerCase() === 'tspan')
        .map((child) => normalizeInlineMeasurementText(child.textContent || ''))
        .filter((line) => line.length > 0);
    if (directTextChildren.length > 0) {
        return directTextChildren;
    }
    return normalizeMeasurementLines(element.textContent || '');
}

function normalizeMeasurementLines(text: string): string[] {
    const normalized = String(text)
        .split(/\r?\n/)
        .map((line) => normalizeInlineMeasurementText(line))
        .filter((line) => line.length > 0);
    return normalized.length > 0 ? normalized : [''];
}

function normalizeInlineMeasurementText(text: string): string {
    return String(text)
        .replace(/\s+/g, ' ')
        .trim();
}

function estimateTextLineWidth(text: string, fontSize: number): number {
    let units = 0;
    for (const char of Array.from(text)) {
        units += estimateGlyphWidthUnits(char);
    }
    return Math.max(fontSize * 0.75, units * fontSize + Math.max(2, fontSize * 0.12));
}

function estimateGlyphWidthUnits(char: string): number {
    if (!char) {
        return 0;
    }
    if (/\s/.test(char)) {
        return 0.35;
    }
    if (isWideGlyph(char)) {
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

function isWideGlyph(char: string): boolean {
    return /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}]/u.test(char);
}

function resolveSvgFontSize(element: Element): number {
    const resolvedValue = resolveSvgTextProperty(element, 'font-size');
    const parsed = parseSvgCssLength(resolvedValue, 16);
    return parsed > 0 ? parsed : 16;
}

function resolveSvgLineHeight(element: Element, fontSize: number): number {
    const resolvedValue = resolveSvgTextProperty(element, 'line-height');
    const parsed = parseSvgCssLength(resolvedValue, fontSize);
    return parsed > 0 ? parsed : Math.max(fontSize * 1.18, fontSize + 4);
}

function resolveSvgTextProperty(element: Element, propertyName: string): string | null {
    let current: Element | null = element;
    while (current) {
        const attributeValue = current.getAttribute(propertyName);
        if (attributeValue && attributeValue.trim().length > 0) {
            return attributeValue.trim();
        }
        const styleValue = extractInlineStyleValue(current.getAttribute('style'), propertyName);
        if (styleValue) {
            return styleValue;
        }
        current = current.parentElement;
    }

    const ownerWindow = element.ownerDocument?.defaultView;
    if (ownerWindow && typeof ownerWindow.getComputedStyle === 'function') {
        const computedValue = ownerWindow.getComputedStyle(element as any).getPropertyValue(propertyName);
        if (computedValue && computedValue.trim().length > 0) {
            return computedValue.trim();
        }
    }

    return null;
}

function extractInlineStyleValue(styleValue: string | null, propertyName: string): string | null {
    if (!styleValue) {
        return null;
    }
    const pattern = new RegExp(`(?:^|;)\\s*${propertyName}\\s*:\\s*([^;]+)`, 'i');
    const match = styleValue.match(pattern);
    return match?.[1]?.trim() || null;
}

function parseSvgCssLength(lengthValue: string | null, baseFontSize: number): number {
    if (!lengthValue) {
        return 0;
    }
    const normalized = lengthValue.trim().toLowerCase();
    if (!normalized || normalized === 'normal') {
        return 0;
    }
    const numeric = Number.parseFloat(normalized);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return 0;
    }
    if (normalized.endsWith('em') || normalized.endsWith('rem')) {
        return numeric * Math.max(10, baseFontSize || 16);
    }
    if (normalized.endsWith('%')) {
        return (numeric / 100) * Math.max(10, baseFontSize || 16);
    }
    return numeric;
}

function unionBounds(boundsList: Bounds[]): Bounds {
    const validBounds = boundsList.filter(bounds => isFiniteBounds(bounds));
    if (validBounds.length === 0) {
        return emptyBounds();
    }
    return validBounds.reduce((combined, current) => ({
        minX: Math.min(combined.minX, current.minX),
        minY: Math.min(combined.minY, current.minY),
        maxX: Math.max(combined.maxX, current.maxX),
        maxY: Math.max(combined.maxY, current.maxY),
    }));
}

function boundsFromPoints(points: Array<{ x: number; y: number }>): Bounds {
    if (points.length === 0) {
        return emptyBounds();
    }
    return {
        minX: Math.min(...points.map(point => point.x)),
        minY: Math.min(...points.map(point => point.y)),
        maxX: Math.max(...points.map(point => point.x)),
        maxY: Math.max(...points.map(point => point.y)),
    };
}

function boundsFromBox(x: number, y: number, width: number, height: number): Bounds {
    return {
        minX: x,
        minY: y,
        maxX: x + width,
        maxY: y + height,
    };
}

function emptyBounds(): Bounds {
    return {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
    };
}

function isFiniteBounds(bounds: Bounds): boolean {
    return Number.isFinite(bounds.minX)
        && Number.isFinite(bounds.minY)
        && Number.isFinite(bounds.maxX)
        && Number.isFinite(bounds.maxY)
        && bounds.maxX >= bounds.minX
        && bounds.maxY >= bounds.minY;
}






