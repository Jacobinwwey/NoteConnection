import { Graph } from '../core/Graph';
import { NoteNode } from '../core/types';
import { RawFile } from './FileLoader';
import { config } from './config';
import * as path from 'path';
import { CommunityDetection } from './CommunityDetection';
import { GraphMetrics } from './GraphMetrics';
import { isSimilar } from './utils/stringUtils';
import { FrontmatterParser } from './utils/frontmatterParser';
import { CycleDetector } from './algorithms/CycleDetection';
import { TopologicalSort } from './algorithms/TopologicalSort';
import { StatisticalAnalyzer } from './algorithms/StatisticalAnalyzer';

/**
 * Service to build the graph from raw files.
 * 从原始文件构建图的服务。
 */
export class GraphBuilder {
  /**
   * Builds a graph from raw files using keyword matching.
   * 使用关键词匹配从原始文件构建图。
   * @param files Array of raw files | 原始文件数组
   * @param layout Optional map of saved node positions | 可选的保存节点位置映射
   */
  static build(files: RawFile[], layout?: Map<string, {x: number, y: number}>): Graph {
    const graph = new Graph();

    // 1. Add all nodes first
    // 1. 首先添加所有节点
    const fileMap = new Map<string, RawFile>();
    files.forEach(file => {
      // Parse Metadata (Tags, Prerequisites, Next)
      const metadata = FrontmatterParser.parse(file.content);

      const node: NoteNode = {
        id: file.filename,
        label: file.filename,
        inDegree: 0,
        outDegree: 0,
        content: file.content,
        metadata: { 
            filepath: file.filepath, 
            tags: metadata.tags,
            prerequisites: metadata.prerequisites,
            next: metadata.next
        }
      };

      if (layout && layout.has(file.filename)) {
          const pos = layout.get(file.filename)!;
          node.x = pos.x;
          node.y = pos.y;
      }

      graph.addNode(node);
      fileMap.set(file.filename, file);

      // 1b. Add Tag Nodes
      if (config.enableTags) {
          metadata.tags.forEach(tag => {
              const tagId = `#${tag}`;
              if (!graph.hasNode(tagId)) {
                  graph.addNode({
                      id: tagId,
                      label: tagId,
                      inDegree: 0, outDegree: 0,
                      clusterId: 'tags' // Group tags together
                  });
              }
              // Edge: Note -> Tag
              graph.addEdge(node.id, tagId, 'tagged');
          });
      }
    });

    // 2. Identify edges
    
    // 2a. Explicit Dependencies (Frontmatter)
    // 2a. 显式依赖 (Frontmatter)
    files.forEach(sourceFile => {
        const sourceId = sourceFile.filename;
        const node = graph.getNode(sourceId);
        if (!node || !node.metadata) return;

        // Handle 'prerequisites': Target (Prereq) -> Source (Current)
        if (node.metadata.prerequisites && Array.isArray(node.metadata.prerequisites)) {
            node.metadata.prerequisites.forEach((prereq: string) => {
                // Check if prereq exists as a file (simple ID match or filename match)
                // We assume prereq string is the ID/filename
                // Need to handle partial matches or extension issues? 
                // For now, assume exact ID match (without extension if ID is sans-extension).
                
                // Try to find the node
                let targetId = prereq;
                if (!graph.hasNode(targetId)) {
                    // Try adding .md or checking map? 
                    // If node doesn't exist, we might skip or add a "missing" node.
                    // For robustness, skip if not found in file list.
                    // But wait, the ID in graph is `filename` (e.g. "Concept A.md").
                    // The prereq might be "Concept A".
                    if (graph.hasNode(targetId + '.md')) {
                        targetId = targetId + '.md';
                    } else {
                        return; // Target not found
                    }
                }
                
                graph.addEdge(targetId, sourceId, 'explicit-prerequisite');
            });
        }

        // Handle 'next': Source (Current) -> Target (Next)
        if (node.metadata.next && Array.isArray(node.metadata.next)) {
            node.metadata.next.forEach((nextItem: string) => {
                 let targetId = nextItem;
                 if (!graph.hasNode(targetId)) {
                     if (graph.hasNode(targetId + '.md')) {
                         targetId = targetId + '.md';
                     }
                     else {
                         return;
                     }
                 }
                 graph.addEdge(sourceId, targetId, 'explicit-next');
            });
        }
    });

    // 2b. Keyword Matching Strategy
    // 2b. 关键词匹配策略
    // Logic: If Note A contains "Note B", then Note B -> Note A (B is a concept used in A)
    // 逻辑：如果笔记 A 包含“笔记 B”，则 笔记 B -> 笔记 A（B 是 A 中使用的概念）
    
    files.forEach(sourceFile => {
      const sourceId = sourceFile.filename;
      const content = sourceFile.content;

      files.forEach(targetFile => {
        const targetId = targetFile.filename;
        if (sourceId === targetId) return; // Skip self | 跳过自身

        // Exclusion Check
        if (config.exclusionList.includes(targetId)) {
            return;
        }

        if (this.isMatch(content, targetId)) {
             // Found a reference!
             // Target (Concept) -> Source (Context)
             graph.addEdge(targetId, sourceId, 'keyword-match');
        }
      });
    });

    // 2c. Statistical Inference (v0.6.0)
    if (config.enableStatisticalInference) {
        console.log('[GraphBuilder] Running Statistical Inference...');
        const terms = Array.from(fileMap.keys());
        const matrix = StatisticalAnalyzer.analyze(files, terms);
        const inferredEdges = StatisticalAnalyzer.inferDependencies(matrix, 0.05, 0.1); // Using test thresholds
        
        inferredEdges.forEach(dep => {
            // Only add if edge doesn't exist to avoid duplicates with explicit/keyword links
            // Graph.addEdge usually allows multi-edges or updates weight?
            // Our Graph implementation is simple. Let's add with a distinct type.
            graph.addEdge(dep.source, dep.target, 'statistical-inferred', dep.confidence);
        });
        console.log(`[GraphBuilder] Added ${inferredEdges.length} inferred edges.`);
    }

    // 3. Community Detection (v0.1.6) or Folder Clustering (v0.5.0)
    if (config.clusteringStrategy === 'folder') {
        // Folder-based Clustering
        graph.getNodes().forEach(node => {
             // Skip special nodes like tags which might not have filepath
             if (node.clusterId === 'tags') return;
             
             if (node.metadata && node.metadata.filepath) {
                 const dirName = path.basename(path.dirname(node.metadata.filepath));
                 node.clusterId = dirName;
             } else {
                 node.clusterId = 'root'; // Fallback
             }
        });
    } else {
        // Label Propagation (Default)
        const clusters = CommunityDetection.detect(graph);
        clusters.forEach((clusterId, nodeId) => {
            const node = graph.getNode(nodeId);
            if (node) {
                // Don't overwrite special cluster IDs like 'tags'
                if (node.clusterId !== 'tags') {
                    node.clusterId = clusterId;
                }
            }
        });
    }

    // 4. Graph Metrics (v0.1.7)
    const centrality = GraphMetrics.calculateBetweenness(graph);
    centrality.forEach((val, nodeId) => {
        const node = graph.getNode(nodeId);
        if (node) {
            node.centrality = val;
        }
    });

    // 5. Algorithmic Core (v0.3.0)
    // Cycle Detection
    if (CycleDetector.hasCycle(graph)) {
        const cycles = CycleDetector.detectCycles(graph);
        console.warn(`[GraphBuilder] Detected ${cycles.length} cycles. Topological Sort may be partial.`);
        // Note: We proceed anyway, but ranks might be inaccurate for cyclic nodes.
    }

    // Topological Sort & Ranking
    const ranks = TopologicalSort.assignRanks(graph);
    ranks.forEach((rank, nodeId) => {
        const node = graph.getNode(nodeId);
        if (node) {
            node.rank = rank;
        }
    });

    return graph;
  }

  /**
   * Checks if the content contains the term based on the configured strategy.
   * 根据配置的策略检查内容是否包含术语。
   */
  private static isMatch(content: string, term: string): boolean {
      if (config.matchingStrategy === 'exact-phrase') {
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
          return regex.test(content);
      } else if (config.matchingStrategy === 'fuzzy') {
          // Fuzzy Strategy: Check for approximate string match
          // Note: Full text scan for fuzzy match is expensive O(N*M).
          // Optimization: Check for exact match first, then maybe sliding window?
          // For now, simpler: check if any WORD in content is similar to term?
          // This is too aggressive.
          // Let's fallback to inclusion for now, plus Levenshtein check on potential candidates if we were doing entity extraction.
          // Since we are scanning full text for a list of known titles:
          
          // Implementation: Regex search for the term allowing some errors? Hard in JS.
          // Alternative: Use inclusion, then check Levenshtein on the match?
          // Simple "includes" is already 'fuzzy' in the sense of substring.
          
          // Let's implement a stronger check:
          // If 'term' is "Water", we match "Waters", "water.", "Water,".
          // If 'term' is "Color", we match "Colour" (Levenshtein=1).
          
          // Current implementation supports 'exact-phrase' (RegEx) or 'fuzzy' (simple includes).
          // We can upgrade 'fuzzy' to mean "Includes OR Similar Word exists".
          
          // Warning: Checking every word against every title is too slow (N*M).
          // We will stick to the previous 'includes' for now, but maybe relax the regex?
          return content.toLowerCase().includes(term.toLowerCase());
      }
      return false;
  }
}
