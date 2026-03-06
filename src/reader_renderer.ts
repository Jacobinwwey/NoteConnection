import { JSDOM } from 'jsdom';
import { MERMAID_BROWSER_BUNDLE_BASE64 } from './generated/mermaid_runtime';
const MATHJAX_PACKAGE_VERSION = '3.2.1';
(globalThis as { PACKAGE_VERSION?: string }).PACKAGE_VERSION ??= MATHJAX_PACKAGE_VERSION;

const { TeX } = require('mathjax-full/js/input/tex.js');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { HandlerList } = require('mathjax-full/js/core/HandlerList.js');
const { HTMLHandler } = require('mathjax-full/js/handlers/html/HTMLHandler.js');

const dynamicImport = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<any>;
const MATH_TEXT_COLOR = '#eef4ff';
const MERMAID_BACKGROUND = 'transparent';
const MERMAID_PADDING = 28;
const MERMAID_FONT_FAMILY = 'Segoe UI, sans-serif';
const MERMAID_TEXT_COLOR = '#f0f0f0';
const MERMAID_EDGE_COLOR = '#a0a0a0';
const MERMAID_NODE_BACKGROUND = '#2d2d2d';
const MERMAID_NODE_BORDER = '#61dafb';
const MERMAID_SURFACE_BACKGROUND = '#1e1e1e';
const MERMAID_SECONDARY_BACKGROUND = '#333333';
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

type MathRenderOptions = {
    displayMode?: boolean;
    textColor?: string;
};

type MermaidRenderOptions = {
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

interface MermaidEnvironment {
    dom: JSDOM;
    window: JSDOM["window"];
    host: HTMLElement;
    mermaid: any;
}

export async function renderMathSvg(source: string, options: MathRenderOptions = {}): Promise<string> {
    const trimmedSource = source.trim();
    if (!trimmedSource) {
        throw new Error('Cannot render an empty math expression.');
    }

    const displayMode = options.displayMode !== false;
    const textColor = (options.textColor || MATH_TEXT_COLOR).trim() || MATH_TEXT_COLOR;
    const convertedNode = mathDocument.convert(trimmedSource, { display: displayMode }) as any;
    const containerMarkup = adaptor.outerHTML(convertedNode);
    const svgMarkup = extractSvgMarkup(containerMarkup);
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
    svg.setAttribute('width', `${Math.max(1, Math.ceil(widthPx))}`);
    svg.setAttribute('height', `${Math.max(1, Math.ceil(heightPx))}`);

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

export async function renderMermaidSvg(source: string, options: MermaidRenderOptions = {}): Promise<string> {
    const trimmedSource = source.trim();
    if (!trimmedSource) {
        throw new Error('Cannot render an empty Mermaid definition.');
    }

    return enqueueMermaidRender(async () => {
        const environment = await ensureMermaidEnvironment(options.theme || 'dark');
        const renderId = `godot-mermaid-${++mermaidRenderCounter}`;
        const host = environment.host;
        host.innerHTML = '';

        const result = await environment.mermaid.render(renderId, trimmedSource, host);
        const svgDom = new JSDOM(result.svg, { contentType: 'image/svg+xml' });
        const svg = svgDom.window.document.querySelector('svg');
        if (!svg) {
            throw new Error('Mermaid did not produce an SVG root element.');
        }

        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
        svg.setAttribute('role', 'img');
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.background = MERMAID_BACKGROUND;

        const computedBounds = computeSvgBounds(svg);
        const width = Math.max(48, Math.ceil(computedBounds.maxX - computedBounds.minX + MERMAID_PADDING * 2));
        const height = Math.max(48, Math.ceil(computedBounds.maxY - computedBounds.minY + MERMAID_PADDING * 2));
        const minX = Math.floor(computedBounds.minX - MERMAID_PADDING);
        const minY = Math.floor(computedBounds.minY - MERMAID_PADDING);
        svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
        svg.setAttribute('width', `${width}`);
        svg.setAttribute('height', `${height}`);
        svg.style.maxWidth = `${width}px`;
        applyMermaidVisualStyles(svg);

        return svg.outerHTML;
    });
}

async function enqueueMermaidRender<T>(work: () => Promise<T>): Promise<T> {
    const nextWork = mermaidRenderQueue.then(work);
    mermaidRenderQueue = nextWork.then(() => undefined, () => undefined);
    return nextWork;
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
        // Keep Mermaid output in pure SVG text so Godot's SVG loader can render it reliably.
        htmlLabels: false,
        maxTextSize: 200000,
        maxEdges: 5000,

        flowchart: {
            useMaxWidth: false,
            htmlLabels: false,
        },
        themeVariables: theme === 'dark' ? MERMAID_DARK_THEME_VARIABLES : undefined,
    };
}

function applyMermaidVisualStyles(svg: SVGSVGElement): void {
    svg.style.background = MERMAID_BACKGROUND;
    svg.querySelectorAll('foreignObject').forEach((node) => node.remove());

    applySvgAttributes(
        svg.querySelectorAll('text, tspan, .nodeLabel, .edgeLabel, .messageText, .loopText, .noteText'),
        {
            fill: MERMAID_TEXT_COLOR,
            'font-family': MERMAID_FONT_FAMILY,
            'font-weight': '600',
        },
    );

    applySvgAttributes(
        svg.querySelectorAll('.node rect, .node circle, .node ellipse, .node polygon, .node path, .cluster rect, .cluster polygon'),
        {
            fill: MERMAID_NODE_BACKGROUND,
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
        svg.querySelectorAll('.edgePaths path, .flowchart-link, .relationshipLine, .messageLine0, .messageLine1, marker path, .marker'),
        {
            stroke: MERMAID_EDGE_COLOR,
            fill: MERMAID_EDGE_COLOR,
        },
    );
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
            const text = String((this as Element).textContent || '').trim();
            return estimateTextBounds(text).width;
        };
    }
}

function extractSvgMarkup(containerMarkup: string): string {
    const svgMatch = containerMarkup.match(/<svg[\s\S]*?<\/svg>/i);
    if (!svgMatch) {
        throw new Error('Expected MathJax to return SVG markup.');
    }
    return svgMatch[0];
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
            const textBounds = estimateTextBounds(element.textContent || '');
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
                const textBounds = estimateTextBounds(element.textContent || '');
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

function estimateTextBounds(text: string): { width: number; height: number } {
    const lines = String(text)
        .replace(/\s+/g, ' ')
        .split(/\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const lineCount = Math.max(1, lines.length || 1);
    return {
        width: Math.max(18, longestLine * 8.2 + 18),
        height: Math.max(18, lineCount * 18 + 6),
    };
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






