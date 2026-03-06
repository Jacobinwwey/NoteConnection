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
});


