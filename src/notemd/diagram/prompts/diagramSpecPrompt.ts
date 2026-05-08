import { DiagramIntent } from '../types';

export interface DiagramSpecPromptOptions {
    preferredIntent?: DiagramIntent;
    requiredIntent?: DiagramIntent;
    preferredChartType?: string;
    targetLanguage?: string;
}

export function buildDiagramSpecPrompt(options: DiagramSpecPromptOptions = {}): string {
    const supportedChartTypes = 'bar, line, pie, scatter, table';
    const preferredIntentLine = options.requiredIntent
        ? `REQUIRED diagram intent: ${options.requiredIntent}. You MUST use this exact intent. Do not choose any other intent under any circumstances.`
        : options.preferredIntent
            ? `Preferred diagram intent: ${options.preferredIntent}. Follow it when the source content supports it.`
            : 'Preferred diagram intent: choose the most suitable intent from the supported list.';
    const preferredChartTypeLine = options.preferredIntent === 'dataChart' && options.preferredChartType
        ? `Preferred chart template: ${options.preferredChartType}. Use it when the extracted data supports it.`
        : '';
    const targetLanguageLine = options.targetLanguage
        ? `Write all human-readable labels in ${options.targetLanguage}.`
        : 'Write all human-readable labels in the same language as the source unless the caller specifies a target language.';

    return `You are a diagram planning assistant. Analyze the source note and return a structured DiagramSpec JSON object.

Output rules:
- Return JSON only. Do not wrap the JSON in markdown code fences.
- Do not output Mermaid, Canvas, Vega-Lite, PlantUML, or any other renderer syntax.
- Do not output explanations outside the DiagramSpec JSON payload.
- Do not invent numeric data. If the source lacks reliable numeric values, choose a non-dataChart intent and leave dataSeries empty.

Supported intents: mindmap, flowchart, sequence, classDiagram, erDiagram, stateDiagram, canvasMap, dataChart

${preferredIntentLine}
${preferredChartTypeLine}
${targetLanguageLine}

Required DiagramSpec fields:
- intent: one of the supported intents
- title: a concise descriptive title
- summary: a short description of the diagram
- nodes: array of {id, label, kind?, children?}
- edges: array of {from, to, label?, relation?}
- sections: array of {id, label, summary?}
- callouts: array of {label, detail}
- dataSeries: array of {id, label, points: [{x, y, series?}]}
- layoutHints: optional {chartType?}
- sourceLanguage, outputLanguage: optional language codes`;
}
