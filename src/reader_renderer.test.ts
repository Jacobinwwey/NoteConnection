import { execFileSync } from 'node:child_process';
import path from 'node:path';

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

describe('reader_renderer', () => {
    beforeAll(() => {
        execFileSync(process.execPath, [tscScriptPath, '--pretty', 'false'], {
            cwd: projectRoot,
            stdio: 'inherit',
        });
    }, 120000);

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
