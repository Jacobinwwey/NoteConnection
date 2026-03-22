import { MermaidFixResult } from './types';

type BlockFixResult = {
    block: string;
    fixes: string[];
};

const MERMAID_BLOCK_PATTERN = /```mermaid\s*([\s\S]*?)```/gi;

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

    // Quote titles that contain spaces or punctuation to avoid Mermaid parse failures.
    if (/[\s()[\]{}:;,-]/.test(rawTitle)) {
        return {
            next: `${prefix}"${rawTitle.replace(/"/g, '\\"')}"`,
            changed: true,
        };
    }

    return { next: line, changed: false };
}

function fixMermaidBlock(blockSource: string): BlockFixResult {
    const fixes: string[] = [];
    let next = blockSource.replace(/\r\n?/g, '\n');

    const replacements: Array<[RegExp, string, string]> = [
        [/\t/g, '    ', 'Converted tab indentation to spaces.'],
        [/[→⇒⟶⟹]/g, '-->', 'Normalized Unicode arrows to Mermaid arrows.'],
        [/\b(end);+\s*$/gim, 'end', 'Removed invalid trailing semicolons after end.'],
        [/graph\s+([A-Z]{2})\s*;/g, 'graph $1', 'Removed semicolon after graph declaration.'],
        [/;\s*$/gm, ';', 'Normalized trailing semicolon spacing.'],
    ];

    replacements.forEach(([pattern, value, description]) => {
        const updated = next.replace(pattern, value);
        if (updated !== next) {
            fixes.push(description);
            next = updated;
        }
    });

    const lines = next.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        const normalized = normalizeSubgraphLine(lines[i]);
        if (normalized.changed) {
            lines[i] = normalized.next;
            fixes.push('Quoted subgraph title with special characters.');
        }
    }
    next = lines.join('\n');

    return {
        block: next.trimEnd(),
        fixes,
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

