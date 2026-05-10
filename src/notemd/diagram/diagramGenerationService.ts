import { DiagramPlan, DiagramSpec } from './types';
import { buildDiagramPlan } from './planner';
import { buildDiagramSpecPrompt } from './prompts/diagramSpecPrompt';
import { assertValidDiagramSpec } from './diagramSpec';
import { parseDiagramSpecResponse } from './diagramSpecResponseParser';
import { DiagramIntent } from './types';

export interface DiagramGenerationOptions {
    compatibilityMode: 'best-fit' | 'legacy-mermaid';
    targetLanguage?: string;
    requestedIntent?: DiagramIntent;
    llmInvoker: (systemPrompt: string, sourceMarkdown: string) => Promise<string>;
}

export type DiagramOperationOutputMode = 'artifact' | 'mermaid';
export type DiagramOperationExecutionMode = 'save-mermaid' | 'save-artifact' | 'preview-artifact';

export interface DiagramOperationInput {
    sourcePath?: string;
    sourceMarkdown: string;
    requestedIntent?: DiagramIntent;
    compatibilityMode: 'best-fit' | 'legacy-mermaid';
    outputMode: DiagramOperationOutputMode;
    targetLanguage?: string;
}

export interface DiagramGenerationResult {
    plan: DiagramPlan;
    spec: DiagramSpec;
    mermaidContent: string;
    artifactTarget: string;
    renderError?: string;
}

function mergeSpecDefaults(spec: DiagramSpec, plan: DiagramPlan): DiagramSpec {
    const resolvedIntent = plan.legacyCompatibilityMode ? plan.intent : spec.intent;
    const normalizedLayoutHints = { ...(spec.layoutHints ?? {}) };
    if (resolvedIntent !== 'dataChart') delete normalizedLayoutHints.chartType;
    else if (normalizedLayoutHints.chartType === undefined && plan.preferredChartType) {
        normalizedLayoutHints.chartType = plan.preferredChartType;
    }

    return {
        ...spec,
        intent: resolvedIntent,
        title: spec.title?.trim() || 'Generated Diagram',
        nodes: (spec.nodes ?? []).map(node => ({ ...node, label: node.label?.trim() || node.id || 'Untitled' })),
        edges: (spec.edges ?? []).map(edge => ({ ...edge, label: edge.label?.trim() || undefined })),
        sections: spec.sections ?? [],
        callouts: spec.callouts ?? [],
        dataSeries: spec.dataSeries ?? [],
        layoutHints: Object.keys(normalizedLayoutHints).length > 0 ? normalizedLayoutHints : undefined,
        evidenceRefs: spec.evidenceRefs ?? []
    };
}

function specToMermaid(spec: DiagramSpec): string {
    const { intent, nodes, edges } = spec;
    const nodeLines = nodes.map(n => `    ${n.id}[${n.label || n.id}]`);
    const edgeLines = (edges ?? []).map(e => `    ${e.from} --> ${e.to}${e.label ? `: ${e.label}` : ''}`);

    switch (intent) {
        case 'mindmap': return `mindmap\n  ${spec.title}\n${nodes.map(n => `    ${n.label || n.id}`).join('\n')}`;
        case 'sequence': return `sequenceDiagram\n${nodes.map(n => `    participant ${n.id} as ${n.label}`).join('\n')}\n${(edges ?? []).map(e => `    ${e.from}->>${e.to}: ${e.label || ''}`).join('\n')}`;
        case 'classDiagram': return `classDiagram\n${nodes.map(n => `    class ${n.id} {\n      ${n.label}\n    }`).join('\n')}`;
        case 'erDiagram': return `erDiagram\n${nodes.map(n => `    ${n.id} {\n      string label "${n.label}"\n    }`).join('\n')}\n${(edges ?? []).map(e => `    ${e.from} ||--o{ ${e.to} : "${e.label || ''}"`).join('\n')}`;
        case 'stateDiagram': return `stateDiagram-v2\n${nodes.map(n => `    state "${n.label}" as ${n.id}`).join('\n')}\n${(edges ?? []).map(e => `    ${e.from} --> ${e.to}: ${e.label || ''}`).join('\n')}`;
        default: return `graph TD\n${nodeLines.join('\n')}\n${edgeLines.join('\n')}`;
    }
}

export async function generateDiagramArtifact(
    markdown: string,
    options: DiagramGenerationOptions
): Promise<DiagramGenerationResult> {
    const plan = buildDiagramPlan(markdown, {
        compatibilityMode: options.compatibilityMode,
        requestedIntent: options.requestedIntent
    });

    const prompt = buildDiagramSpecPrompt({
        preferredIntent: plan.intent,
        requiredIntent: options.requestedIntent,
        preferredChartType: plan.preferredChartType,
        targetLanguage: options.targetLanguage
    });

    let rawResponse = await options.llmInvoker(prompt, markdown);
    let parsedSpec = parseDiagramSpecResponse(rawResponse);
    let spec = mergeSpecDefaults(parsedSpec, plan);
    assertValidDiagramSpec(spec);

    // Retry if intent mismatch
    if (options.requestedIntent && spec.intent !== options.requestedIntent) {
        const retryPrompt = buildDiagramSpecPrompt({
            preferredIntent: plan.intent,
            requiredIntent: options.requestedIntent,
            preferredChartType: plan.preferredChartType,
            targetLanguage: options.targetLanguage
        }) + `\n\nCRITICAL: Your previous response used intent "${spec.intent}" but the required intent is "${options.requestedIntent}". Regenerate with the correct intent.`;

        rawResponse = await options.llmInvoker(retryPrompt, markdown);
        parsedSpec = parseDiagramSpecResponse(rawResponse);
        spec = mergeSpecDefaults(parsedSpec, plan);
        assertValidDiagramSpec(spec);
    }

    const mermaidContent = specToMermaid(spec);

    return {
        plan,
        spec,
        mermaidContent,
        artifactTarget: plan.renderTarget,
        renderError: undefined
    };
}
