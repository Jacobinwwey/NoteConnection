/**
 * Calculates the Levenshtein distance between two strings.
 * 计算两个字符串之间的 Levenshtein 距离。
 */
export function levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    // Increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // Increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Checks if two strings are similar based on a threshold.
 * 基于阈值检查两个字符串是否相似。
 * @param a String A
 * @param b String B
 * @param threshold Max distance allowed (default 2)
 */
export function isSimilar(a: string, b: string, threshold: number = 2): boolean {
    if (Math.abs(a.length - b.length) > threshold) return false;
    return levenshtein(a.toLowerCase(), b.toLowerCase()) <= threshold;
}

/**
 * Checks if the content contains the term based on the provided strategy.
 * 根据提供的策略检查内容是否包含术语。
 * @param content The text content to search within
 * @param term The term to search for
 * @param strategy 'exact-phrase' or 'fuzzy'
 */
export function checkMatch(content: string, term: string, strategy: 'exact-phrase' | 'fuzzy' = 'exact-phrase'): boolean {
    if (strategy === 'exact-phrase') {
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
        return regex.test(content);
    } else if (strategy === 'fuzzy') {
        // Simple inclusion as per original logic
        return content.toLowerCase().includes(term.toLowerCase());
    }
    return false;
}
