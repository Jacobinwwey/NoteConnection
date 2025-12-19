/**
 * Simple Regex-based Frontmatter Parser.
 * 简单的基于正则的 Frontmatter 解析器。
 */
export interface ParsedMetadata {
    tags: string[];
    prerequisites: string[];
    next: string[];
    [key: string]: any;
}

export class FrontmatterParser {
    
    /**
     * Parses YAML frontmatter to extract structured metadata.
     * 解析 YAML frontmatter 以提取结构化元数据。
     */
    static parse(content: string): ParsedMetadata {
        const metadata: ParsedMetadata = {
            tags: [],
            prerequisites: [],
            next: []
        };

        const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!match) return metadata;

        const yaml = match[1];

        // Helper to extract list or inline array
        const extractField = (fieldName: string): string[] => {
            const results: string[] = [];
            
            // 1. Check for List format (starts with newline or empty value)
            // field:
            //   - item
            const listBlockRegex = new RegExp(`${fieldName}:\\s*\\r?\\n((?:\\s*-\\s*.*\\r?\\n?)*)`, 'i');
            const listMatch = yaml.match(listBlockRegex);
            if (listMatch) {
                const lines = listMatch[1].split(/\r?\n/);
                lines.forEach(line => {
                    const itemMatch = line.match(/\s*-\s*(.*)/);
                    if (itemMatch) {
                        const clean = this.cleanLink(itemMatch[1]);
                        if (clean) results.push(clean);
                    }
                });
                // If we found a list, return it. Prioritize list over inline if both exist (rare but possible in bad yaml)
                if (results.length > 0) return results; 
            }

            // 2. Check for Inline value (Array or Single)
            const inlineRegex = new RegExp(`${fieldName}:\\s*(.*)`, 'i');
            const inlineMatch = yaml.match(inlineRegex);
            
            if (inlineMatch) {
                let val = inlineMatch[1].trim();
                if (!val) return results; // handled by list or empty

                // Check if it's a comment or invalid
                if (val.startsWith('#')) return results;

                // Case A: WikiLink "[[Link]]" -> Single Item
                if (val.startsWith('[[')) {
                    const clean = this.cleanLink(val);
                    if (clean) results.push(clean);
                    return results;
                }

                // Case B: Inline Array "[a, b]"
                if (val.startsWith('[')) {
                    // Remove outer [ ]
                    const inner = val.replace(/^\[|\]$/g, '');
                    inner.split(',').forEach(item => {
                        const clean = this.cleanLink(item);
                        if (clean) results.push(clean);
                    });
                    return results;
                }

                // Case C: Plain Single Value "Item"
                // Ensure it's not a list start (dash)
                if (!val.startsWith('-')) {
                    const clean = this.cleanLink(val);
                    if (clean) results.push(clean);
                }
            }

            return results;
        };

        metadata.tags = extractField('tags');
        metadata.prerequisites = extractField('prerequisites');
        metadata.next = extractField('next');

        return metadata;
    }

    /**
     * Cleans a string from WikiLink brackets [[ ]] and whitespace.
     * 清除 WikiLink 括号 [[ ]] 和空格。
     */
    private static cleanLink(raw: string): string {
        let text = raw.trim();
        // Remove [[ ]]
        const linkMatch = text.match(/^\[\[(.*?)(?:\|.*?)?\]\]$/);
        if (linkMatch) {
            return linkMatch[1].trim();
        }
        // Remove quotes if present
        text = text.replace(/^["']|["']$/g, '');
        return text;
    }

    /**
     * Extracts tags from YAML frontmatter and WikiLinks [[tag]].
     * 从 YAML frontmatter 和 WikiLinks [[tag]] 中提取标签。
     * @deprecated Use parse() for metadata. This method mixes concepts.
     */
    static extractTags(content: string): string[] {
        const tags: Set<string> = new Set();
        
        // Use new parser for YAML tags
        const parsed = this.parse(content);
        parsed.tags.forEach(t => tags.add(t));

        // 2. Scan for [[WikiLinks]] in the entire content
        // Regex to capture [[Tag]] or [[Tag|Label]]
        const wikiLinkRegex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
        let wikiMatch;
        while ((wikiMatch = wikiLinkRegex.exec(content)) !== null) {
            if (wikiMatch[1]) {
                tags.add(wikiMatch[1].trim());
            }
        }

        return Array.from(tags);
    }
}
