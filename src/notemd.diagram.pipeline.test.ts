/**
 * Diagram Pipeline unit tests — validates intent inference, planner,
 * spec validation, and response parser (all pure functions).
 */
import { inferDiagramIntent } from './notemd/diagram/intent';
import { buildDiagramPlan } from './notemd/diagram/planner';
import { validateDiagramSpec, assertValidDiagramSpec } from './notemd/diagram/diagramSpec';
import { parseDiagramSpecResponse } from './notemd/diagram/diagramSpecResponseParser';
import { buildDiagramSpecPrompt } from './notemd/diagram/prompts/diagramSpecPrompt';

// ── Intent Inference ──

describe('Diagram Intent Inference', () => {
    test('empty content defaults to mindmap', () => {
        const result = inferDiagramIntent('');
        expect(result.intent).toBe('mindmap');
        expect(result.confidence).toBeLessThan(0.5);
    });

    test('whitespace-only defaults to mindmap', () => {
        const result = inferDiagramIntent('   \n  ');
        expect(result.intent).toBe('mindmap');
    });

    test('data table with numeric values infers dataChart', () => {
        const md = [
            '| Metric | Value |',
            '| ------ | ----- |',
            '| CPU    | 85%   |',
            '| Memory | 72%   |',
            'Monthly growth trend: 12% increase.',
        ].join('\n');
        const result = inferDiagramIntent(md);
        expect(result.intent).toBe('dataChart');
        expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('request-response vocabulary infers sequence', () => {
        const md = 'Client sends request to server. Server processes and returns response. Gateway routes the request. Service handles the response.';
        const result = inferDiagramIntent(md);
        expect(result.intent).toBe('sequence');
    });

    test('arrow markers infers sequence', () => {
        const result = inferDiagramIntent('User -> API -> Database -> Response');
        expect(result.intent).toBe('sequence');
    });

    test('database schema vocabulary infers erDiagram', () => {
        const md = 'The entity has a primary key. The table references a foreign key. The schema defines the column.';
        const result = inferDiagramIntent(md);
        expect(result.intent).toBe('erDiagram');
    });

    test('state transition vocabulary infers stateDiagram', () => {
        const md = 'The state machine transitions from pending to running. Completed state follows. Failed state triggers retry.';
        const result = inferDiagramIntent(md);
        expect(result.intent).toBe('stateDiagram');
    });

    test('workflow/process vocabulary infers flowchart', () => {
        const md = 'Step 1: Validate input. If valid then process, else stop. Continue to next step.';
        const result = inferDiagramIntent(md);
        expect(result.intent).toBe('flowchart');
    });

    test('numbered steps infers flowchart', () => {
        const md = '1. First step\n2. Second step\n3. Third step';
        const result = inferDiagramIntent(md);
        expect(result.intent).toBe('flowchart');
    });

    test('concept map keywords infers canvasMap', () => {
        const md = 'This is a concept map showing the knowledge graph of spatial clusters.';
        const result = inferDiagramIntent(md);
        expect(result.intent).toBe('canvasMap');
    });

    test('general content defaults to mindmap', () => {
        const result = inferDiagramIntent('The quick brown fox jumps over the lazy dog.');
        expect(result.intent).toBe('mindmap');
        expect(result.confidence).toBeGreaterThan(0.4);
    });
});

// ── Planner ──

describe('Diagram Planner', () => {
    test('best-fit mode routes dataChart to vega-lite', () => {
        const md = '| A | B |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |\nchart';
        const plan = buildDiagramPlan(md, { compatibilityMode: 'best-fit' });
        expect(plan.renderTarget).toBe('vega-lite');
    });

    test('best-fit mode routes sequence to mermaid', () => {
        const md = 'Client sends request. Server returns response. Gateway routes. Service processes.';
        const plan = buildDiagramPlan(md, { compatibilityMode: 'best-fit' });
        expect(plan.intent).toBe('sequence');
        expect(plan.renderTarget).toBe('mermaid');
        expect(plan.mermaidDiagramType).toBe('sequenceDiagram');
    });

    test('legacy-mermaid mode forces mermaid render target', () => {
        const md = '| A | B |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |\nchart share distribution';
        const plan = buildDiagramPlan(md, { compatibilityMode: 'legacy-mermaid' });
        expect(plan.renderTarget).toBe('mermaid');
        expect(plan.legacyCompatibilityMode).toBe(true);
    });

    test('explicit intent overrides inference', () => {
        const plan = buildDiagramPlan('any content', {
            requestedIntent: 'flowchart',
            compatibilityMode: 'best-fit'
        });
        expect(plan.intent).toBe('flowchart');
        expect(plan.confidence).toBeGreaterThan(0.9);
    });

    test('mindmap intent resolves to mindmap mermaid type', () => {
        const plan = buildDiagramPlan('# Just a regular note about topics', { compatibilityMode: 'best-fit' });
        expect(plan.intent).toBe('mindmap');
        expect(plan.mermaidDiagramType).toBe('mindmap');
    });

    test('fallback targets include html for dataChart (non-mermaid)', () => {
        const md = '| A | B |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |\nchart share breakdown';
        const plan = buildDiagramPlan(md, { compatibilityMode: 'best-fit' });
        expect(plan.renderTarget).toBe('vega-lite');
        // dataChart has no mermaidDiagramType, so only html is a valid fallback
        expect(plan.fallbackTargets).toContain('html');
    });
});

// ── Spec Validation ──

describe('Diagram Spec Validation', () => {
    const validMindmapSpec = {
        intent: 'mindmap' as const,
        title: 'Test Diagram',
        nodes: [{ id: 'n1', label: 'Node 1' }, { id: 'n2', label: 'Node 2' }],
        edges: [{ from: 'n1', to: 'n2' }],
    };

    test('valid mindmap spec passes validation', () => {
        const result = validateDiagramSpec(validMindmapSpec);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('missing title fails validation', () => {
        const result = validateDiagramSpec({ ...validMindmapSpec, title: '' });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('title'))).toBe(true);
    });

    test('duplicate node ids fail validation', () => {
        const result = validateDiagramSpec({
            ...validMindmapSpec,
            nodes: [{ id: 'n1', label: 'A' }, { id: 'n1', label: 'B' }],
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('duplicate'))).toBe(true);
    });

    test('edge to missing node fails validation', () => {
        const result = validateDiagramSpec({
            ...validMindmapSpec,
            edges: [{ from: 'n1', to: 'missing' }],
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('missing'))).toBe(true);
    });

    test('unsupported intent fails validation', () => {
        const result = validateDiagramSpec({ ...validMindmapSpec, intent: 'bogus' as any });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('unsupported'))).toBe(true);
    });

    test('assertValidDiagramSpec throws on invalid spec', () => {
        expect(() => assertValidDiagramSpec({ ...validMindmapSpec, title: '' })).toThrow();
    });

    test('dataChart intent requires data series', () => {
        const result = validateDiagramSpec({ ...validMindmapSpec, intent: 'dataChart' as any, nodes: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('data series'))).toBe(true);
    });
});

// ── Response Parser ──

describe('Diagram Spec Response Parser', () => {
    test('parses valid JSON DiagramSpec', () => {
        const json = JSON.stringify({
            intent: 'mindmap',
            title: 'Test',
            nodes: [{ id: 'a', label: 'A' }],
        });
        const spec = parseDiagramSpecResponse(json);
        expect(spec.intent).toBe('mindmap');
        expect(spec.title).toBe('Test');
        expect(spec.nodes).toHaveLength(1);
        expect(spec.nodes[0].id).toBe('a');
    });

    test('strips code fences from response', () => {
        const json = '```json\n' + JSON.stringify({
            intent: 'flowchart',
            title: 'Test',
            nodes: [{ id: 'a', label: 'A' }],
        }) + '\n```';
        const spec = parseDiagramSpecResponse(json);
        expect(spec.intent).toBe('flowchart');
        expect(spec.title).toBe('Test');
    });

    test('handles diagramSpec wrapper key', () => {
        const json = JSON.stringify({
            diagramSpec: {
                intent: 'sequence',
                title: 'Test',
                nodes: [{ id: 'a', label: 'A' }],
            }
        });
        const spec = parseDiagramSpecResponse(json);
        expect(spec.intent).toBe('sequence');
    });

    test('throws on non-JSON input', () => {
        expect(() => parseDiagramSpecResponse('not json at all')).toThrow();
    });

    test('normalizes edge fields (source→from, target→to)', () => {
        const json = JSON.stringify({
            intent: 'mindmap', title: 'E',
            nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
            edges: [{ source: 'a', target: 'b', label: 'connects' }],
        });
        const spec = parseDiagramSpecResponse(json);
        expect(spec.edges![0].from).toBe('a');
        expect(spec.edges![0].to).toBe('b');
    });
});

// ── Prompt Builder ──

describe('Diagram Spec Prompt', () => {
    test('includes required intent in output', () => {
        const prompt = buildDiagramSpecPrompt({ requiredIntent: 'flowchart' });
        expect(prompt).toContain('REQUIRED');
        expect(prompt).toContain('flowchart');
    });

    test('includes preferred intent', () => {
        const prompt = buildDiagramSpecPrompt({ preferredIntent: 'sequence' });
        expect(prompt).toContain('Preferred');
        expect(prompt).toContain('sequence');
    });

    test('includes target language', () => {
        const prompt = buildDiagramSpecPrompt({ targetLanguage: 'zh' });
        expect(prompt).toContain('zh');
    });

    test('output rules forbid code fences', () => {
        const prompt = buildDiagramSpecPrompt();
        expect(prompt).toContain('Do not wrap');
    });
});
