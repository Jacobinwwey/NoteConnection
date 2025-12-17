// src/backend/graph.ts
import { Concept, DirectedGraph, GraphEdge, GraphNode } from './types';
import * as fs from 'fs/promises';

export class GraphBuilder {
    static buildGraph(concepts: Concept[]): DirectedGraph {
        const nodes: GraphNode[] = concepts.map(c => ({
            id: c.id,
            label: c.title
        }));

        const edges: GraphEdge[] = [];
        const titleMap = new Map<string, string>(); // lowercase title -> real id

        // Pre-process titles for case-insensitive lookup
        // 预处理标题以进行不区分大小写的查找
        concepts.forEach(c => {
            titleMap.set(c.title.toLowerCase(), c.id);
        });

        // 1. Explicit Dependencies (Placeholder for now)
        // 1. 显式依赖 (目前占位)

        // 2. Keyword Matching Strategy
        // 2. 关键词匹配策略
        concepts.forEach(sourceConcept => {
            const contentLower = sourceConcept.content.toLowerCase();
            
            concepts.forEach(targetConcept => {
                if (sourceConcept.id === targetConcept.id) return; // Self-loop check
                
                const targetTitle = targetConcept.title.toLowerCase();
                
                // Filter out very short words to reduce noise (e.g. "Ice", "mW")
                // 过滤掉非常短的单词以减少噪声 (例如 "Ice", "mW")
                // Heuristic: Length >= 3 or specific whitelist
                // 启发式：长度 >= 3 或特定白名单
                if (targetTitle.length < 3) return;

                // Check strict inclusion (maybe utilize regex boundary \b in future)
                // 检查严格包含 (未来可能利用正则边界 \b)
                if (contentLower.includes(targetTitle)) {
                    // Heuristic: If A mentions B, B -> A (B is concept used in A)
                    // 启发式：如果 A 提到 B，则 B -> A (B 是 A 中使用的概念)
                    edges.push({
                        source: targetConcept.id,
                        target: sourceConcept.id,
                        type: 'keyword',
                        weight: 1.0
                    });
                }
            });
        });

        // Deduplicate edges
        // 去重边
        const uniqueEdges = this.deduplicateEdges(edges);

        return {
            nodes,
            edges: uniqueEdges
        };
    }

    private static deduplicateEdges(edges: GraphEdge[]): GraphEdge[] {
        const seen = new Set<string>();
        return edges.filter(e => {
            const key = `${e.source}->${e.target}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
}

export class Exporter {
    static async exportToJSON(graph: DirectedGraph, outputPath: string): Promise<void> {
        const json = JSON.stringify(graph, null, 2);
        await fs.writeFile(outputPath, json, 'utf-8');
        console.log(`Graph exported to ${outputPath}`);
    }
}
