export interface SegmentBuilderOptions {
    maxSegmentChars?: number;
}

export interface BuiltSegmentDraft {
    content: string;
    segmentIndex: number;
    tokenCount: number;
    contentHash: string;
}

export class SegmentBuilder {
    public constructor(private readonly computeHash: (value: string) => string) {}

    public buildSegments(content: string, options: SegmentBuilderOptions = {}): BuiltSegmentDraft[] {
        const normalizedContent = String(content || '').trim();
        if (!normalizedContent) {
            return [];
        }
        const maxSegmentChars = Math.max(120, Math.floor(Number(options.maxSegmentChars) || 420));
        const paragraphs = normalizedContent
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean);

        const segments: BuiltSegmentDraft[] = [];
        let current = '';
        const flush = (): void => {
            const value = current.trim();
            if (!value) {
                current = '';
                return;
            }
            segments.push({
                content: value,
                segmentIndex: segments.length,
                tokenCount: value.split(/\s+/).filter(Boolean).length,
                contentHash: this.computeHash(value),
            });
            current = '';
        };

        paragraphs.forEach((paragraph) => {
            const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
            if (candidate.length > maxSegmentChars && current) {
                flush();
            }
            if (paragraph.length > maxSegmentChars) {
                const tokens = paragraph.split(/\s+/).filter(Boolean);
                let buffer = '';
                tokens.forEach((token) => {
                    const tokenCandidate = buffer ? `${buffer} ${token}` : token;
                    if (tokenCandidate.length > maxSegmentChars && buffer) {
                        current = buffer;
                        flush();
                        buffer = token;
                        return;
                    }
                    buffer = tokenCandidate;
                });
                if (buffer) {
                    current = buffer;
                    flush();
                }
                return;
            }
            current = current ? `${current}\n\n${paragraph}` : paragraph;
        });

        flush();
        return segments;
    }
}
