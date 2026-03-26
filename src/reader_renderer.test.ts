import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const projectRoot = path.resolve(__dirname, '..');
const distRendererPath = path.join(projectRoot, 'dist', 'src', 'reader_renderer.js');
const tscScriptPath = path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc');

function runRenderer(functionName: 'renderMathSvg' | 'renderMermaidSvg', source: string, options: Record<string, unknown> = {}): string {
    const script = [
        "const { %FN% } = require(%PATH%);",
        "(async () => {",
        "  const svg = await %FN%(%SOURCE%, %OPTIONS%);",
        "  process.stdout.write(svg);",
        "})().catch((error) => {",
        "  console.error(error && error.stack ? error.stack : error);",
        "  process.exit(1);",
        "});",
    ]
        .join('\n')
        .replace(/%FN%/g, functionName)
        .replace('%PATH%', JSON.stringify(distRendererPath))
        .replace('%SOURCE%', JSON.stringify(source))
        .replace('%OPTIONS%', JSON.stringify(options));

    return execFileSync(process.execPath, ['-e', script], {
        cwd: projectRoot,
        encoding: 'utf8',
    });
}

function runRendererJson<T>(functionName: 'renderMathPng' | 'renderMermaidPng', source: string, options: Record<string, unknown> = {}): T {
    const script = [
        "const { %FN% } = require(%PATH%);",
        "(async () => {",
        "  const result = await %FN%(%SOURCE%, %OPTIONS%);",
        "  process.stdout.write(JSON.stringify(result));",
        "})().catch((error) => {",
        "  console.error(error && error.stack ? error.stack : error);",
        "  process.exit(1);",
        "});",
    ]
        .join('\n')
        .replace(/%FN%/g, functionName)
        .replace('%PATH%', JSON.stringify(distRendererPath))
        .replace('%SOURCE%', JSON.stringify(source))
        .replace('%OPTIONS%', JSON.stringify(options));

    return JSON.parse(execFileSync(process.execPath, ['-e', script], {
        cwd: projectRoot,
        encoding: 'utf8',
    })) as T;
}

function runRendererScopeProbe(source: string, options: Record<string, unknown> = {}): {
    beforeWindow: boolean;
    beforeDocument: boolean;
    afterWindow: boolean;
    afterDocument: boolean;
} {
    const script = [
        "const { renderMermaidSvg } = require(%PATH%);",
        "(async () => {",
        "  const beforeWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');",
        "  const beforeDocument = Object.prototype.hasOwnProperty.call(globalThis, 'document');",
        "  await renderMermaidSvg(%SOURCE%, %OPTIONS%);",
        "  const afterWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');",
        "  const afterDocument = Object.prototype.hasOwnProperty.call(globalThis, 'document');",
        "  process.stdout.write(JSON.stringify({ beforeWindow, beforeDocument, afterWindow, afterDocument }));",
        "})().catch((error) => {",
        "  console.error(error && error.stack ? error.stack : error);",
        "  process.exit(1);",
        "});",
    ]
        .join('\n')
        .replace('%PATH%', JSON.stringify(distRendererPath))
        .replace('%SOURCE%', JSON.stringify(source))
        .replace('%OPTIONS%', JSON.stringify(options));

    return JSON.parse(execFileSync(process.execPath, ['-e', script], {
        cwd: projectRoot,
        encoding: 'utf8',
    })) as {
        beforeWindow: boolean;
        beforeDocument: boolean;
        afterWindow: boolean;
        afterDocument: boolean;
    };
}

describe('reader_renderer', () => {
    beforeAll(() => {
        execFileSync(process.execPath, [tscScriptPath, '--pretty', 'false'], {
            cwd: projectRoot,
            stdio: 'inherit',
        });
    }, 120000);

    it('keeps the compiled Mermaid loader on the embedded browser runtime path instead of requiring the ESM package directly', () => {
        const compiledRenderer = fs.readFileSync(distRendererPath, 'utf8');

        expect(compiledRenderer).not.toContain("require('mermaid')");
        expect(compiledRenderer).toContain('MERMAID_BROWSER_BUNDLE_BASE64');
        expect(compiledRenderer).toContain("createElement('script')");
    });

    it('renders display math to svg', () => {
        const svg = runRenderer('renderMathSvg', 'E = mc^2', { displayMode: true });

        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('viewBox');
        expect(svg).toContain('preserveAspectRatio');
    });

    it('renders complex math with nested svg output safely and honours requested bounds', () => {
        const svg = runRenderer(
            'renderMathSvg',
            String.raw`\frac{d}{dt}
\begin{pmatrix} M_{zA}(t) \\ M_{zB}(t) \end{pmatrix}
=
\underbrace{
\begin{pmatrix} -R_{1A} - k_A & k_B \\ k_A & -R_{1B} - k_B \end{pmatrix}
}_{\mathbf{K}}
\begin{pmatrix} M_{zA}(t) \\ M_{zB}(t) \end{pmatrix}
+
\begin{pmatrix} R_{1A} M_{zA}^0 \\ R_{1B} M_{zB}^0 \end{pmatrix}`,
            { displayMode: true, maxWidth: 320, maxHeight: 220 },
        );

        const widthMatch = svg.match(/width="(\d+)"/);
        const heightMatch = svg.match(/height="(\d+)"/);
        expect(svg.startsWith('<svg')).toBe(true);
        expect(widthMatch).not.toBeNull();
        expect(heightMatch).not.toBeNull();
        expect(Number(widthMatch && widthMatch[1])).toBeLessThanOrEqual(320);
        expect(Number(heightMatch && heightMatch[1])).toBeLessThanOrEqual(220);
    });

    it('renders display math to a PNG for Godot without relying on SVG decoding', () => {
        const rendered = runRendererJson<{ pngBase64: string; width: number; height: number; svg: string }>(
            'renderMathPng',
            String.raw`\mathrm{CVA} = (1 - R) \int_0^T EE(t) \cdot dPD(t)`,
            { displayMode: true, maxWidth: 640, maxHeight: 260, renderScale: 2.4 },
        );

        expect(rendered.width).toBeGreaterThan(640);
        expect(rendered.height).toBeGreaterThan(0);
        expect(rendered.width).toBeLessThanOrEqual(4096);
        expect(rendered.height).toBeLessThanOrEqual(4096);
        expect(rendered.pngBase64.startsWith('iVBOR')).toBe(true);
        expect(rendered.svg.startsWith('<svg')).toBe(true);
    });

    it('renders mermaid diagrams to svg', () => {
        const svg = runRenderer(
            'renderMermaidSvg',
            ['flowchart TD', 'A[Start] --> B{Check}', 'B -->|Yes| C[Done]', 'B -->|No| D[Retry]'].join('\n'),
            { theme: 'dark' },
        );

        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('viewBox');
        expect(svg).toContain('Start');
        expect(svg).toContain('Segoe UI');
    });

    it('does not leak JSDOM globals onto Node global scope after Mermaid rendering', () => {
        const scopeProbe = runRendererScopeProbe(
            ['flowchart TD', 'A[Start] --> B{Check}', 'B -->|Yes| C[Done]', 'B -->|No| D[Retry]'].join('\n'),
            { theme: 'dark' },
        );

        expect(scopeProbe.afterWindow).toBe(scopeProbe.beforeWindow);
        expect(scopeProbe.afterDocument).toBe(scopeProbe.beforeDocument);
    });

    it('keeps normal mermaid diagrams close to their content width instead of inflating to the hard cap', () => {
        const svg = runRenderer(
            'renderMermaidSvg',
            ['flowchart TD', 'A[Start] --> B{Check}', 'B -->|Yes| C[Done]', 'B -->|No| D[Retry]'].join('\n'),
            { theme: 'dark' },
        );

        const widthMatch = svg.match(/width="(\d+)"/);
        expect(widthMatch).not.toBeNull();
        expect(Number(widthMatch && widthMatch[1])).toBeLessThan(600);
    });

    it('renders mermaid diagrams to a PNG that preserves browser-style labels for Godot', () => {
        const rendered = runRendererJson<{ pngBase64: string; width: number; height: number; svg: string }>(
            'renderMermaidPng',
            ['flowchart TD', 'A[Start] --> B{Check}', 'B -->|Yes| C[Done]', 'B -->|No| D[Retry]'].join('\n'),
            { theme: 'dark', maxWidth: 640, maxHeight: 420 },
        );

        expect(rendered.width).toBeGreaterThan(0);
        expect(rendered.height).toBeGreaterThan(0);
        expect(rendered.width).toBeLessThanOrEqual(640);
        expect(rendered.height).toBeLessThanOrEqual(420);
        expect(rendered.pngBase64.startsWith('iVBOR')).toBe(true);
        expect(rendered.svg.startsWith('<svg')).toBe(true);
    });

    it('honours requested mermaid bounds for page-width rendering', () => {
        const longLabel = 'Flow-Node '.repeat(120);
        const svg = runRenderer(
            'renderMermaidSvg',
            ['flowchart TD', `A["${longLabel}"] --> B["Done"]`].join('\n'),
            { theme: 'dark', maxWidth: 640, maxHeight: 420 },
        );

        const widthMatch = svg.match(/width="(\d+)"/);
        const heightMatch = svg.match(/height="(\d+)"/);
        expect(widthMatch).not.toBeNull();
        expect(heightMatch).not.toBeNull();
        expect(Number(widthMatch && widthMatch[1])).toBeLessThanOrEqual(640);
        expect(Number(heightMatch && heightMatch[1])).toBeLessThanOrEqual(420);
    });

    it('wraps oversized Mermaid labels into multiple lines so text stays within node borders', () => {
        const longUnbrokenLabel = '跨境资产负债管理与流动性压力测试'.repeat(8);
        const svg = runRenderer(
            'renderMermaidSvg',
            ['flowchart TD', `A["${longUnbrokenLabel}"] --> B["Done"]`].join('\n'),
            { theme: 'dark', maxWidth: 640, maxHeight: 480 },
        );

        const widthMatch = svg.match(/width="(\d+)"/);
        const dom = new JSDOM(svg, { contentType: 'image/svg+xml' });
        const textNodes = Array.from(dom.window.document.querySelectorAll('.node text'));
        const wrappedNode = textNodes.find((node) => (node.textContent || '').includes('跨境资产'));
        const wrappedLineCount = wrappedNode ? wrappedNode.querySelectorAll('tspan').length : 0;

        expect(widthMatch).not.toBeNull();
        expect(Number(widthMatch && widthMatch[1])).toBeLessThanOrEqual(640);
        expect(wrappedLineCount).toBeGreaterThan(1);
    });

    it('removes Mermaid aggregate tspans so node bounds follow wrapped text instead of stale full-line labels', () => {
        const longEnglishLabel = 'This is a very very very very very very very long English label that should wrap instead of overflowing outside the node border';
        const svg = runRenderer(
            'renderMermaidSvg',
            ['flowchart TD', `A["${longEnglishLabel}"] --> B["Done"]`].join('\n'),
            { theme: 'dark', maxWidth: 640, maxHeight: 480 },
        );

        const dom = new JSDOM(svg, { contentType: 'image/svg+xml' });
        const allNodeRects = Array.from(dom.window.document.querySelectorAll('.node rect'))
            .map((rect) => Number(rect.getAttribute('width') || '0'))
            .filter((value) => Number.isFinite(value) && value > 0);
        const wrappedText = Array.from(dom.window.document.querySelectorAll('.node text'))
            .find((textNode) => (textNode.textContent || '').includes('very very'));
        const wrappedLines = wrappedText
            ? Array.from(wrappedText.querySelectorAll('tspan'))
                .map((line) => (line.textContent || '').replace(/\s+/g, ' ').trim())
                .filter((line) => line.length > 0)
            : [];
        const mergedTail = wrappedLines.slice(1).join(' ');
        const maxNodeWidth = allNodeRects.length > 0 ? Math.max(...allNodeRects) : 0;

        expect(maxNodeWidth).toBeGreaterThan(0);
        expect(maxNodeWidth).toBeLessThanOrEqual(460);
        expect(wrappedLines.length).toBeGreaterThan(1);
        expect(wrappedLines[0]).not.toEqual(mergedTail);
    });

    it('allocates more Mermaid width for mixed CJK labels than for the English-only equivalent', () => {
        const englishSvg = runRenderer(
            'renderMermaidSvg',
            ['flowchart TD', 'A["Asset Allocation"] --> B["Done"]'].join('\n'),
            { theme: 'dark', maxWidth: 2000, maxHeight: 800 },
        );
        const mixedSvg = runRenderer(
            'renderMermaidSvg',
            ['flowchart TD', 'A["Asset Allocation 资产配置久期匹配"] --> B["Done"]'].join('\n'),
            { theme: 'dark', maxWidth: 2000, maxHeight: 800 },
        );

        const englishWidthMatch = englishSvg.match(/width="(\d+)"/);
        const mixedWidthMatch = mixedSvg.match(/width="(\d+)"/);
        expect(englishWidthMatch).not.toBeNull();
        expect(mixedWidthMatch).not.toBeNull();
        expect(Number(mixedWidthMatch && mixedWidthMatch[1])).toBeGreaterThan(Number(englishWidthMatch && englishWidthMatch[1]) + 30);
    });

    it('keeps mermaid output Godot-safe for html-like labels', () => {
        const svg = runRenderer(
            'renderMermaidSvg',
            ['flowchart TD', 'A["Start<br/>Next"] --> B["Done"]'].join('\n'),
            { theme: 'dark' },
        );

        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('Start');
        expect(svg).not.toContain('foreignObject');
    });

    it('sanitizes raw ampersands in mermaid labels before XML parsing', () => {
        const svg = runRenderer(
            'renderMermaidSvg',
            ['flowchart TD', 'A["Research & Development"] --> B["Done"]'].join('\n'),
            { theme: 'dark' },
        );

        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('Research');
        expect(svg).toContain('&amp;');
    });

    it('injects strong Mermaid style overrides so cluster backgrounds do not wash out the reader', () => {
        const svg = runRenderer(
            'renderMermaidSvg',
            [
                'flowchart TD',
                'subgraph OUTER[Outer Framework]',
                '  A[Alpha ?????] --> B[Beta ?????????]',
                'end',
            ].join('\n'),
            { theme: 'dark', maxWidth: 1200, maxHeight: 900 },
        );

        expect(svg).toContain('noteconnection-mermaid-overrides');
        expect(svg).toContain('.cluster rect, .cluster polygon { fill: none !important; stroke: #61dafb !important; }');
        expect(svg).not.toContain('.cluster rect{fill:hsl(');
        expect(svg).toContain('.edgePaths path, .flowchart-link, .relationshipLine, .messageLine0, .messageLine1 { stroke: #a0a0a0 !important; fill: none !important; }');
        expect(svg).toContain('marker path, .marker, .arrowheadPath { stroke: #a0a0a0 !important; fill: #a0a0a0 !important; }');
        expect(svg).toContain('.basic.label-container, .label-container { fill: #2d2d2d !important; stroke: #61dafb !important; }');
    });

    it('caps oversized mermaid svg dimensions for Godot rasterization safety', () => {
        const longLabel = 'A'.repeat(6000);
        const svg = runRenderer(
            'renderMermaidSvg',
            ['flowchart TD', `A["${longLabel}"] --> B["Done"]`].join('\n'),
            { theme: 'dark' },
        );

        const widthMatch = svg.match(/width="(\d+)"/);
        const heightMatch = svg.match(/height="(\d+)"/);
        expect(widthMatch).not.toBeNull();
        expect(heightMatch).not.toBeNull();
        expect(Number(widthMatch && widthMatch[1])).toBeLessThanOrEqual(4096);
        expect(Number(heightMatch && heightMatch[1])).toBeLessThanOrEqual(4096);
    });
});
