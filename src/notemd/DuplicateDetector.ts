import { DuplicateTerm } from './types';

function stripCodeBlocks(input: string): string {
    return input
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`\n]+`/g, ' ');
}

function normalizeWord(token: string): string {
    const cleaned = token
        .toLowerCase()
        .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
        .trim();
    if (!cleaned) {
        return '';
    }
    if (cleaned.length > 4 && cleaned.endsWith('ies')) {
        return `${cleaned.slice(0, -3)}y`;
    }
    if (cleaned.length > 3 && cleaned.endsWith('es')) {
        return cleaned.slice(0, -2);
    }
    if (cleaned.length > 3 && cleaned.endsWith('s')) {
        return cleaned.slice(0, -1);
    }
    return cleaned;
}

export class DuplicateDetector {
    public detectDuplicateTerms(content: string, minOccurrences = 2): DuplicateTerm[] {
        const text = stripCodeBlocks(String(content || ''));
        const counts = new Map<string, number>();
        const tokens = text.split(/\s+/g);
        tokens.forEach((raw) => {
            const normalized = normalizeWord(raw);
            if (!normalized || normalized.length < 4) {
                return;
            }
            counts.set(normalized, (counts.get(normalized) || 0) + 1);
        });

        return Array.from(counts.entries())
            .filter(([, count]) => count >= minOccurrences)
            .map(([term, count]) => ({ term, count }))
            .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
    }

    public detectDuplicateWikiLinks(content: string, minOccurrences = 2): DuplicateTerm[] {
        const counts = new Map<string, number>();
        const pattern = /\[\[([^[\]]+)\]\]/g;
        const text = String(content || '');

        let match: RegExpExecArray | null = pattern.exec(text);
        while (match) {
            const concept = normalizeWord(match[1] || '');
            if (concept) {
                counts.set(concept, (counts.get(concept) || 0) + 1);
            }
            match = pattern.exec(text);
        }

        return Array.from(counts.entries())
            .filter(([, count]) => count >= minOccurrences)
            .map(([term, count]) => ({ term, count }))
            .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
    }

    public detectDuplicateConceptFiles(fileNames: string[]): Array<{ normalized: string; files: string[] }> {
        const groups = new Map<string, Set<string>>();
        fileNames.forEach((fileName) => {
            const basename = String(fileName || '')
                .replace(/\.[^/.]+$/, '')
                .trim();
            const key = normalizeWord(basename);
            if (!key) {
                return;
            }
            if (!groups.has(key)) {
                groups.set(key, new Set<string>());
            }
            groups.get(key)?.add(fileName);
        });

        return Array.from(groups.entries())
            .filter(([, files]) => files.size > 1)
            .map(([normalized, files]) => ({
                normalized,
                files: Array.from(files).sort((a, b) => a.localeCompare(b)),
            }))
            .sort((a, b) => a.normalized.localeCompare(b.normalized));
    }
}

