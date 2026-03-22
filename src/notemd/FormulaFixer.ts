import { FormulaFixResult } from './types';

function shouldConvertInlineDisplay(line: string): boolean {
    const trimmed = line.trim();
    const match = /^\$(.+)\$$/.exec(trimmed);
    if (!match) {
        return false;
    }

    const body = match[1].trim();
    if (!body) {
        return false;
    }

    return /[\\=^_{}]/.test(body);
}

export class FormulaFixer {
    public fixInMarkdown(markdown: string): FormulaFixResult {
        const fixes: string[] = [];
        let changed = false;
        let next = String(markdown || '');

        const singleDollarLine = /^(\s*)\$(\s*)$/gm;
        const replacedSingleDollar = next.replace(singleDollarLine, (_match, leading: string, trailing: string) => {
            return `${leading}$$${trailing}`;
        });
        if (replacedSingleDollar !== next) {
            changed = true;
            fixes.push('Converted standalone $ lines to $$ delimiters.');
            next = replacedSingleDollar;
        }

        const replacedBracketDelimiters = next
            .replace(/\\\[/g, '$$')
            .replace(/\\\]/g, '$$');
        if (replacedBracketDelimiters !== next) {
            changed = true;
            fixes.push('Converted \\[...\\] delimiters to $$...$$.');
            next = replacedBracketDelimiters;
        }

        const squashedDollarRuns = next.replace(/\${3,}/g, '$$');
        if (squashedDollarRuns !== next) {
            changed = true;
            fixes.push('Normalized repeated dollar delimiters.');
            next = squashedDollarRuns;
        }

        const lines = next.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
            const originalLine = lines[i];
            if (!shouldConvertInlineDisplay(originalLine)) {
                continue;
            }

            const trimmed = originalLine.trim();
            const body = trimmed.slice(1, -1).trim();
            lines[i] = originalLine.replace(trimmed, `$$ ${body} $$`);
            changed = true;
            fixes.push('Promoted likely display formulas from $...$ to $$ ... $$.');
        }

        next = lines.join('\n');

        return {
            content: next,
            changed,
            fixes: Array.from(new Set(fixes)),
        };
    }
}

export function fixFormulaFormats(markdown: string): FormulaFixResult {
    return new FormulaFixer().fixInMarkdown(markdown);
}
