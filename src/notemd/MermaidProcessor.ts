import { MermaidFixResult } from './types';

type BlockFixResult = {
    block: string;
    fixes: string[];
};

const MERMAID_BLOCK_PATTERN = /```mermaid\s*([\s\S]*?)```/gi;
const TABLE_PLACEHOLDER_PREFIX = '___MERMAID_TABLE_LINE_';

function normalizeMermaidLineBreaks(source: string): string {
    return String(source || '')
        .replace(/\r\n?/g, '\n')
        .replace(/<br\s*>/gi, '<br/>');
}

function stripWrappingDoubleQuotes(text: string): string {
    const trimmed = String(text || '').trim();
    if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function escapeMermaidLabel(rawValue: string): string {
    return String(rawValue || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .trim();
}

function protectTableLines(content: string): { next: string; protectedLines: string[] } {
    const protectedLines: string[] = [];
    const tableSeparatorRegex = /^\s*\|(?:[\s\t]*:?[\s\t]*-+[\s\t]*:?[\s\t]*\|)+[\s\t]*$/;
    const next = String(content || '')
        .split('\n')
        .map((line) => {
            if (line.includes(':-- :') || tableSeparatorRegex.test(line)) {
                const placeholder = `${TABLE_PLACEHOLDER_PREFIX}${protectedLines.length}___`;
                protectedLines.push(line);
                return placeholder;
            }
            return line;
        })
        .join('\n');
    return { next, protectedLines };
}

function restoreTableLines(content: string, protectedLines: string[]): string {
    return protectedLines.reduce((restored, line, index) => {
        const placeholder = `${TABLE_PLACEHOLDER_PREFIX}${index}___`;
        return restored.split(placeholder).join(line);
    }, content);
}

function splitTopLevelStatements(source: string): string {
    const text = normalizeMermaidLineBreaks(source)
        .split('\n')
        .map((line) => rewriteQuotedLabelAfterSemicolonLine(line) || line)
        .join('\n');
    let result = '';
    let quote = false;
    let squareDepth = 0;
    let roundDepth = 0;
    let curlyDepth = 0;

    for (let index = 0; index < text.length; index += 1) {
        const char = text.charAt(index);
        if (char === '"' && text.charAt(index - 1) !== '\\') {
            quote = !quote;
            result += char;
            continue;
        }
        if (!quote) {
            if (char === '[') squareDepth += 1;
            else if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
            else if (char === '(') roundDepth += 1;
            else if (char === ')') roundDepth = Math.max(0, roundDepth - 1);
            else if (char === '{') curlyDepth += 1;
            else if (char === '}') curlyDepth = Math.max(0, curlyDepth - 1);
            if (char === ';' && squareDepth === 0 && roundDepth === 0 && curlyDepth === 0) {
                result += '\n';
                continue;
            }
        }
        result += char;
    }

    return result;
}

function rewriteSingleDoubleDashLabelLine(line: string): string | null {
    const match = line.match(/^(.*?)\s*(?<!-)--(?!>|-)\s*"([^"\n]+)"\s*(?<!-)--(?!>|-)\s*(.+?)\s*;?\s*$/);
    if (!match) {
        return null;
    }

    const start = String(match[1] || '').trim();
    const label = String(match[2] || '').trim();
    const end = String(match[3] || '').trim();
    if (!start || !label || !end || /^"/.test(end)) {
        return null;
    }

    return `${start} -- "${label}" --> ${end};`;
}

function normalizeSubgraphLine(line: string): { next: string; changed: boolean } {
    const match = /^(\s*subgraph\s+)(.+)$/i.exec(line);
    if (!match) {
        return { next: line, changed: false };
    }

    const prefix = match[1];
    const rawTitle = match[2].trim();
    if (!rawTitle || rawTitle.startsWith('"') || rawTitle.startsWith("'")) {
        return { next: line, changed: false };
    }

    if (/[\s()[\]{}:;,-]/.test(rawTitle)) {
        return {
            next: `${prefix}"${rawTitle.replace(/"/g, '\\"')}"`,
            changed: true,
        };
    }

    return { next: line, changed: false };
}

function rewriteQuotedLabelAfterSemicolonLine(line: string): string | null {
    if (!line.includes('-->')) {
        return null;
    }

    const match = line.match(/^(.*?)\s*(-->)\s*(.*?);\s*"([^"\n]+)"\s*$/);
    if (!match) {
        return null;
    }

    const source = String(match[1] || '').trim();
    const arrow = String(match[2] || '').trim();
    const target = String(match[3] || '').trim();
    const label = String(match[4] || '').trim();
    if (!source || !target || !label) {
        return null;
    }

    return `${source} -- "${label}" ${arrow} ${target};`;
}

function mergeDoubleArrowLabelLine(line: string): string | null {
    const match = line.match(/^(.*?)\s*--\s*"([^"\n]+)"\s*--\s*"([^"\n]+)"\s*(-->|---)\s*(.*)$/);
    if (!match) {
        return null;
    }

    const start = String(match[1] || '').trim();
    const labelLeft = String(match[2] || '').trim();
    const labelRight = String(match[3] || '').trim();
    const arrow = String(match[4] || '').trim();
    const end = String(match[5] || '').trim();
    if (!start || !labelLeft || !labelRight || !end) {
        return null;
    }

    return `${start} -- "${labelLeft}<br/>${labelRight}" ${arrow} ${end}`;
}

function quoteUnquotedEdgeLabelLine(line: string): string | null {
    const match = line.match(/^(.*?)\s*--\s*([^"\n][^>\n]*?)\s*-->\s*(.*)$/);
    if (!match) {
        return null;
    }

    const start = String(match[1] || '').trim();
    const label = String(match[2] || '').trim();
    const end = String(match[3] || '').trim();
    if (!start || !label || !end) {
        return null;
    }
    if (
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(label) ||
        /^[A-Za-z_][A-Za-z0-9_]*\s*[\[\(\{].*$/.test(label) ||
        /^["[{(]/.test(label)
    ) {
        return null;
    }

    return `${start} -- "${label}" --> ${end}`;
}

function fixMalformedArrows(content: string): string {
    return String(content || '')
        .replace(/[→⇒⟶⟹]/g, '-->')
        .replace(/--\|>/g, '-->')
        .replace(/<--/g, '-->')
        .replace(/-- >/g, '-->');
}

function normalizeMermaidComments(content: string): string {
    return String(content || '')
        .split('\n')
        .map((line) => {
            const hashCommentMatch = line.match(/^(\s*[A-Za-z0-9_()[\]{}"'\s.-]+?)\s*-->\s*([A-Za-z0-9_()[\]{}"'\s.-]+?)\s*;\s*#(.*)$/);
            if (hashCommentMatch) {
                return `${hashCommentMatch[1].trim()} -- "${hashCommentMatch[3].trim()}" --> ${hashCommentMatch[2].trim()};`;
            }
            const percentCommentMatch = line.match(/^(\s*[A-Za-z0-9_()[\]{}"'\s.-]+?)\s*-->\s*([A-Za-z0-9_()[\]{}"'\s.-]+?)\s*;\s*%(.*)$/);
            if (percentCommentMatch) {
                return `${percentCommentMatch[1].trim()} -- "${percentCommentMatch[3].trim()}" --> ${percentCommentMatch[2].trim()};`;
            }
            const slashCommentMatch = line.match(/^(\s*[A-Za-z0-9_()[\]{}"'\s.-]+?)\s*-->\s*([A-Za-z0-9_()[\]{}"'\s.-]+?)\s*;\s*\/\/(.*)$/);
            if (slashCommentMatch) {
                return `${slashCommentMatch[1].trim()} -- "${slashCommentMatch[3].trim()}" --> ${slashCommentMatch[2].trim()};`;
            }
            return line;
        })
        .join('\n');
}

function normalizeHtmlBreakBareNodeLabels(line: string): string {
    const text = String(line || '');
    const arrowMatch = text.match(/^(.*?(?:-->|---|-\.->|\-.-))\s*([A-Za-z_][A-Za-z0-9_]*)\s+(.+?)\s*;?\s*$/);
    if (!arrowMatch) {
        return text;
    }
    const prefix = String(arrowMatch[1] || '');
    const nodeId = String(arrowMatch[2] || '').trim();
    const label = String(arrowMatch[3] || '').trim();
    if (!nodeId || !label || !label.includes('<br/>')) {
        return text;
    }
    if (/^[\[\(\{"]/.test(label)) {
        return text;
    }
    if (/(?:-->|---|-\.->|\-.-)/.test(label)) {
        return text;
    }
    return `${prefix} ${nodeId}["${escapeMermaidLabel(stripWrappingDoubleQuotes(label))}"]`;
}

function convertNoteLine(line: string, counters: { note: number }): string[] | null {
    const directionalMatch = line.match(/^\s*note\s+(?:right|left|top|bottom)\s+of\s+([A-Za-z0-9_]+)\s*:\s*(.+)$/i);
    if (directionalMatch) {
        const targetId = directionalMatch[1];
        const noteId = `Note${targetId}`;
        const noteText = escapeMermaidLabel(stripWrappingDoubleQuotes(directionalMatch[2]));
        return [
            `${noteId}["${noteText}"]`,
            `${targetId} -.- ${noteId}`,
        ];
    }

    const targetedMatch = line.match(/^\s*note\s+([A-Za-z0-9_]+)\s+"(.+)"\s*;?\s*$/i);
    if (targetedMatch) {
        const targetId = targetedMatch[1];
        const noteId = `Note${targetId}`;
        const noteText = escapeMermaidLabel(stripWrappingDoubleQuotes(targetedMatch[2]));
        return [
            `${noteId}["${noteText}"]`,
            `${targetId} -.- ${noteId}`,
        ];
    }

    const forOfMatch = line.match(/^\s*note\s+(?:for|of)\s+([A-Za-z0-9_]+)\s+(.+)$/i);
    if (forOfMatch) {
        const targetId = forOfMatch[1];
        const noteId = `Note${targetId}`;
        const noteText = escapeMermaidLabel(stripWrappingDoubleQuotes(forOfMatch[2].replace(/\]$/, '').trim()));
        return [
            `${noteId}["${noteText}"]`,
            `${targetId} -.- ${noteId}`,
        ];
    }

    const standaloneMatch = line.match(/^\s*note\s*:\s*(.+)$/i);
    if (standaloneMatch) {
        counters.note += 1;
        const noteId = `NoteStandalone${counters.note}`;
        const noteText = escapeMermaidLabel(stripWrappingDoubleQuotes(standaloneMatch[1]));
        return [`${noteId}["${noteText}"]`];
    }

    return null;
}

function splitIntermediateNodeLine(line: string): string[] | null {
    const match = line.match(/^(.*?)\s*(-->|---)\s*([A-Za-z_][A-Za-z0-9_]*)\s*(\[[^\]]+\]|\([^)]+\)|\{[^}]+\})\s*(-->|---)\s*(.*)$/);
    if (!match) {
        return null;
    }

    const start = String(match[1] || '').trim();
    const leftArrow = String(match[2] || '').trim();
    const nodeId = String(match[3] || '').trim();
    const nodeShape = String(match[4] || '').trim();
    const rightArrow = String(match[5] || '').trim();
    const end = String(match[6] || '').trim();
    if (!start || !nodeId || !nodeShape || !end) {
        return null;
    }

    return [
        `${start} ${leftArrow} ${nodeId}${nodeShape}`,
        `${nodeId} ${rightArrow} ${end}`,
    ];
}

function normalizeMermaidPipes(content: string): string {
    return String(content || '')
        .replace(/\|""\|"/g, '')
        .replace(/"\[\]"/g, '');
}

function fixExcessiveBrackets(content: string): string {
    return String(content || '')
        .replace(/\]{3,}/g, ']')
        .replace(/\[""\]/g, '')
        .replace(/\["\]/g, ']')
        .replace(/\[\/\["/g, '["')
        .replace(/\["\/\]/g, '"]');
}

function fixDanglingBracketedNodeLabelLine(line: string): string | null {
    const match = line.match(/^(\s*[A-Za-z_][A-Za-z0-9_]*)\["([^"\n]*)\["\s*;?\s*$/);
    if (!match) {
        return null;
    }

    const nodeId = String(match[1] || '').trim();
    const label = String(match[2] || '').trim();
    if (!nodeId || !label) {
        return null;
    }

    return `${nodeId}["${escapeMermaidLabel(label)}"]`;
}

function applyDeepDebugMermaid(content: string): { next: string; fixes: string[] } {
    let next = normalizeMermaidPipes(content);
    const fixes: string[] = [];

    const passes: Array<[string, (input: string) => string]> = [
        ['Normalized Mermaid line breaks.', normalizeMermaidLineBreaks],
        ['Normalized malformed arrows and Unicode arrows.', fixMalformedArrows],
        ['Converted Mermaid comments into explicit edge labels.', normalizeMermaidComments],
        ['Cleaned excessive Mermaid brackets and placeholder artifacts.', fixExcessiveBrackets],
    ];

    passes.forEach(([description, apply]) => {
        const updated = apply(next);
        if (updated !== next) {
            fixes.push(description);
            next = updated;
        }
    });

    const noteCounters = { note: 0 };
    const nextLines: string[] = [];
    next.split('\n').forEach((rawLine) => {
        const subgraphNormalized = normalizeSubgraphLine(rawLine);
        let line = subgraphNormalized.next;
        if (subgraphNormalized.changed) {
            fixes.push('Quoted subgraph title with special characters.');
        }

        const convertedNotes = convertNoteLine(line, noteCounters);
        if (convertedNotes) {
            nextLines.push(...convertedNotes);
            fixes.push('Converted Mermaid note directives into linked note nodes.');
            return;
        }

        const rewrittenQuotedLabel = rewriteQuotedLabelAfterSemicolonLine(line);
        if (rewrittenQuotedLabel && rewrittenQuotedLabel !== line) {
            line = rewrittenQuotedLabel;
            fixes.push('Re-attached quoted edge labels that were displaced after semicolons.');
        }

        const mergedDoubleLabel = mergeDoubleArrowLabelLine(line);
        if (mergedDoubleLabel && mergedDoubleLabel !== line) {
            line = mergedDoubleLabel;
            fixes.push('Merged legacy double-label Mermaid edges.');
        }

        const rewrittenSingleDoubleDash = rewriteSingleDoubleDashLabelLine(line);
        if (rewrittenSingleDoubleDash && rewrittenSingleDoubleDash !== line) {
            line = rewrittenSingleDoubleDash;
            fixes.push('Converted legacy double-dash Mermaid edges into standard arrows.');
        }

        const quotedUnquotedLabel = quoteUnquotedEdgeLabelLine(line);
        if (quotedUnquotedLabel && quotedUnquotedLabel !== line) {
            line = quotedUnquotedLabel;
            fixes.push('Quoted unquoted Mermaid edge labels.');
        }

        const htmlBreakLabel = normalizeHtmlBreakBareNodeLabels(line);
        if (htmlBreakLabel !== line) {
            line = htmlBreakLabel;
            fixes.push('Wrapped bare Mermaid node labels containing HTML line breaks.');
        }

        const danglingLabelFix = fixDanglingBracketedNodeLabelLine(line);
        if (danglingLabelFix && danglingLabelFix !== line) {
            line = danglingLabelFix;
            fixes.push('Closed Mermaid node labels that had a dangling opening bracket inside quotes.');
        }

        const splitIntermediate = splitIntermediateNodeLine(line);
        if (splitIntermediate) {
            nextLines.push(...splitIntermediate);
            fixes.push('Split Mermaid intermediate node edges into valid statements.');
            return;
        }

        nextLines.push(line);
    });

    next = nextLines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd();

    return {
        next,
        fixes: Array.from(new Set(fixes)),
    };
}

function fixMermaidBlock(blockSource: string): BlockFixResult {
    const fixes: string[] = [];
    const protectedTables = protectTableLines(blockSource);
    let next = splitTopLevelStatements(protectedTables.next);

    const deepDebug = applyDeepDebugMermaid(next);
    next = deepDebug.next;
    fixes.push(...deepDebug.fixes);

    next = restoreTableLines(next, protectedTables.protectedLines);

    // Cleanup final syntax trivia after all structural passes.
    const cleanupPasses: Array<[RegExp, string, string]> = [
        [/\b(end);+\s*$/gim, 'end', 'Removed invalid trailing semicolons after end.'],
        [/graph\s+([A-Z]{2})\s*;/g, 'graph $1', 'Removed semicolon after graph declaration.'],
        [/\n{3,}/g, '\n\n', 'Collapsed excessive blank lines inside Mermaid blocks.'],
    ];

    cleanupPasses.forEach(([pattern, replacement, description]) => {
        const updated = next.replace(pattern, replacement);
        if (updated !== next) {
            next = updated;
            fixes.push(description);
        }
    });

    return {
        block: next.trimEnd(),
        fixes: Array.from(new Set(fixes)),
    };
}

export class MermaidProcessor {
    public fixInMarkdown(markdown: string): MermaidFixResult {
        let changed = false;
        const allFixes: string[] = [];

        const next = String(markdown || '').replace(MERMAID_BLOCK_PATTERN, (_full, blockBody) => {
            const fixed = fixMermaidBlock(String(blockBody || ''));
            if (fixed.fixes.length > 0) {
                changed = true;
                allFixes.push(...fixed.fixes);
            }
            return `\`\`\`mermaid\n${fixed.block}\n\`\`\``;
        });

        return {
            content: next,
            changed,
            fixes: Array.from(new Set(allFixes)),
        };
    }
}

export function fixMermaidSyntax(markdown: string): MermaidFixResult {
    return new MermaidProcessor().fixInMarkdown(markdown);
}
