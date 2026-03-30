#!/usr/bin/env node

/**
 * Obsidian Mermaid compatibility baseline guard:
 * - valid canonical start fence: a standalone line beginning with ```mermaid
 * - invalid pattern: inline concatenation such as $$```mermaid
 */

const fs = require('fs');
const path = require('path');

const markdownPattern = /\.(md|markdown)$/i;
const cliArgs = process.argv.slice(2);
const fixMode = cliArgs.includes('--fix');
const rootsFromArgs = cliArgs
    .filter((item) => item !== '--fix')
    .map((item) => path.resolve(process.cwd(), item));
const targetRoots = rootsFromArgs.length > 0
    ? rootsFromArgs
    : [path.resolve(process.cwd(), 'Knowledge_Base')];

const violations = [];
let scannedFiles = 0;
let fenceCount = 0;
let fixedFiles = 0;
let fixedOccurrences = 0;

function applyDollarFenceFix(content) {
    const hasCRLF = content.includes('\r\n');
    const newline = hasCRLF ? '\r\n' : '\n';
    const pattern = /\$\$[ \t]*```mermaid\b/g;
    let replacements = 0;
    const nextContent = content.replace(pattern, () => {
        replacements += 1;
        return `$$${newline}\`\`\`mermaid`;
    });
    return {
        content: nextContent,
        replacements,
    };
}

function walkDirectory(directoryPath) {
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            walkDirectory(fullPath);
            continue;
        }
        if (entry.isFile() && markdownPattern.test(entry.name)) {
            scannedFiles += 1;
            inspectMarkdownFile(fullPath);
        }
    }
}

function inspectMarkdownFile(filePath) {
    const originalContent = fs.readFileSync(filePath, 'utf8');
    let content = originalContent;
    if (fixMode) {
        const fixed = applyDollarFenceFix(content);
        content = fixed.content;
        if (fixed.replacements > 0 && content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            fixedFiles += 1;
            fixedOccurrences += fixed.replacements;
        }
    }

    const fencePattern = /```mermaid\b/gi;

    let match = fencePattern.exec(content);
    while (match) {
        fenceCount += 1;
        const index = match.index;
        const previousChar = index > 0 ? content[index - 1] : '\n';
        const isLineStart = index === 0 || previousChar === '\n' || previousChar === '\r';

        if (!isLineStart) {
            const line = content.slice(0, index).split(/\r?\n/).length;
            const lineStart = content.lastIndexOf('\n', index - 1) + 1;
            const rawLineEnd = content.indexOf('\n', index);
            const lineEnd = rawLineEnd === -1 ? content.length : rawLineEnd;
            const lineText = content.slice(lineStart, lineEnd).trim();

            violations.push({
                filePath,
                line,
                lineText: lineText.slice(0, 180),
            });
        }
        match = fencePattern.exec(content);
    }
}

for (const targetRoot of targetRoots) {
    if (!fs.existsSync(targetRoot)) {
        console.warn(`[verify-markdown-mermaid-fence] Skip missing path: ${targetRoot}`);
        continue;
    }
    const stat = fs.statSync(targetRoot);
    if (stat.isDirectory()) {
        walkDirectory(targetRoot);
    } else if (stat.isFile() && markdownPattern.test(path.basename(targetRoot))) {
        scannedFiles += 1;
        inspectMarkdownFile(targetRoot);
    }
}

if (violations.length > 0) {
    console.error(`[verify-markdown-mermaid-fence] Found ${violations.length} inline mermaid fence issue(s).`);
    for (const issue of violations) {
        console.error(`- ${issue.filePath}:${issue.line}`);
        console.error(`  ${issue.lineText}`);
    }
    if (fixMode) {
        console.error(
            '[verify-markdown-mermaid-fence] --fix only auto-corrects $$```mermaid patterns. Remaining issues need manual cleanup.'
        );
    }
    process.exit(1);
}

if (fixMode && fixedFiles > 0) {
    console.log(
        `[verify-markdown-mermaid-fence] Auto-fixed $$+mermaid inline fences in ${fixedFiles} file(s), ${fixedOccurrences} occurrence(s).`
    );
}

console.log(
    `[verify-markdown-mermaid-fence] OK. Scanned ${scannedFiles} Markdown file(s), ${fenceCount} mermaid fence(s), no inline fence issues.`
);
