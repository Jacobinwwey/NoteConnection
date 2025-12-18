import * as fs from 'fs';
import * as path from 'path';

/**
 * 2025-12-18 v0.1.1
 * Independent DAG Builder
 * 
 * Implements the logic to scan the 'testconcept' directory, infer relationships
 * via keyword matching, and generate a JSON graph for D3 visualization.
 * 
 * 独立 DAG 构建器
 * 实现扫描 'testconcept' 目录，通过关键词匹配推断关系，并生成用于 D3 可视化的 JSON 图的逻辑。
 */

// --- Interfaces (Matches Interface Document.md v0.1.1) ---

interface RawNote {
    id: string;      // Filename without extension
    content: string; // Full text content
}

interface DiscoveredEdge {
    source: string; // Mentioned Concept (Prerequisite)
    target: string; // Current File (Context)
    weight: number; // Match count
}

interface D3Node {
    id: string;
    group: number; // 1 for now
    inDegree: number;
    outDegree: number;
}

interface D3Link {
    source: string;
    target: string;
    value: number;
}

interface GraphData {
    nodes: D3Node[];
    links: D3Link[];
}

// --- Implementations ---

class LocalFileLoader {
    /**
     * Loads all .md files from a directory.
     * 从目录加载所有 .md 文件。
     */
    static load(dirPath: string): RawNote[] {
        if (!fs.existsSync(dirPath)) {
            console.error(`Directory not found: ${dirPath}`);
            return [];
        }

        const files = fs.readdirSync(dirPath);
        const notes: RawNote[] = [];

        for (const file of files) {
            if (path.extname(file).toLowerCase() === '.md') {
                const fullPath = path.join(dirPath, file);
                const content = fs.readFileSync(fullPath, 'utf-8');
                const id = path.parse(file).name; // Filename as ID
                notes.push({ id, content });
            }
        }
        console.log(`Loaded ${notes.length} notes.`);
        return notes;
    }
}

class KeywordMatcher {
    /**
     * Escapes RegExp special characters.
     * 转义正则特殊字符。
     */
    private static escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\\]/g, '\\$&');
    }

    /**
     * Finds edges where one note mentions another's title.
     * 查找一个笔记提及另一个笔记标题的边。
     */
    static findMatches(notes: RawNote[]): DiscoveredEdge[] {
        const edges: DiscoveredEdge[] = [];
        const ids = notes.map(n => n.id);

        // Pre-compile regex for each ID to improve performance
        // 为每个 ID 预编译正则以提高性能
        const idRegexes = ids.map(id => ({
            id: id,
            regex: new RegExp(`\\b${this.escapeRegExp(id)}\\b`, 'i') // Case insensitive, whole word
        }));

        for (const currentNote of notes) {
            for (const other of idRegexes) {
                if (currentNote.id === other.id) continue; // No self-loops

                // If current note contains other note's ID
                // 如果当前笔记包含其他笔记的 ID
                if (other.regex.test(currentNote.content)) {
                    // Logic: Mentioned (other) -> Mentioner (current)
                    // Basic -> Advanced
                    edges.push({
                        source: other.id,
                        target: currentNote.id,
                        weight: 1 // Could count matches for higher weight
                    });
                }
            }
        }
        console.log(`Discovered ${edges.length} edges.`);
        return edges;
    }
}

class StructureGenerator {
    /**
     * Converts to D3 JSON format with Degree calculation.
     * 转换为 D3 JSON 格式并计算度数。
     */
    static generateJSON(notes: RawNote[], edges: DiscoveredEdge[]): GraphData {
        // Calculate degrees
        const inDegreeMap = new Map<string, number>();
        const outDegreeMap = new Map<string, number>();

        // Initialize maps
        notes.forEach(n => {
            inDegreeMap.set(n.id, 0);
            outDegreeMap.set(n.id, 0);
        });

        // Sum degrees
        edges.forEach(e => {
            const currentIn = inDegreeMap.get(e.target) || 0;
            inDegreeMap.set(e.target, currentIn + 1);

            const currentOut = outDegreeMap.get(e.source) || 0;
            outDegreeMap.set(e.source, currentOut + 1);
        });

        const d3Nodes: D3Node[] = notes.map(n => ({
            id: n.id,
            group: 1,
            inDegree: inDegreeMap.get(n.id) || 0,
            outDegree: outDegreeMap.get(n.id) || 0
        }));

        const d3Links: D3Link[] = edges.map(e => ({
            source: e.source,
            target: e.target,
            value: e.weight
        }));

        return {
            nodes: d3Nodes,
            links: d3Links
        };
    }
}

// --- Main Execution ---

const CONFIG = {
    inputDir: path.join(__dirname, '../../testconcept'),
    outputFile: path.join(__dirname, '../../src/frontend/graph_data.json')
};

function main() {
    console.log("Starting DAG Build Process...");
    
    // 1. Load Files
    const notes = LocalFileLoader.load(CONFIG.inputDir);
    
    // 2. Find Edges
    const edges = KeywordMatcher.findMatches(notes);
    
    // 3. Generate Graph Data
    const graphData = StructureGenerator.generateJSON(notes, edges);
    
    // 4. Write Output
    const outputDir = path.dirname(CONFIG.outputFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(graphData, null, 2));
    console.log(`Graph data written to: ${CONFIG.outputFile}`);
}

main();
