/**
 * Simple Regex-based Frontmatter Parser.
 * 简单的基于正则的 Frontmatter 解析器。
 */
export class FrontmatterParser {
    
    /**
     * Extracts tags from YAML frontmatter and WikiLinks [[tag]].
     * 从 YAML frontmatter 和 WikiLinks [[tag]] 中提取标签。
     */
    static extractTags(content: string): string[] {
        const tags: Set<string> = new Set();
        
        // 1. Find Frontmatter block
        const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (match) {
            const yaml = match[1];
            
            // Case A: Inline array `tags: [a, b, c]`
            const inlineMatch = yaml.match(/tags:\s*\[(.*?)\]/);
            if (inlineMatch) {
                inlineMatch[1].split(',').forEach(t => {
                    const tag = t.trim();
                    if (tag) tags.add(tag);
                });
            }
            
            // Case B: List format
            const listMatch = yaml.match(/tags:\s*\r?\n((?:\s*-\s*.*\r?\n?)*)/);
            if (listMatch) {
                const lines = listMatch[1].split(/\r?\n/);
                lines.forEach(line => {
                    const tagMatch = line.match(/\s*-\s*(.*)/);
                    if (tagMatch) {
                        tags.add(tagMatch[1].trim());
                    }
                });
            }
        }

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
