import { Graph } from '../core/Graph';
import { NoteNode } from '../core/types';
import { RawFile } from './FileLoader';
import { config } from './config';
import { CommunityDetection } from './CommunityDetection';
import { GraphMetrics } from './GraphMetrics';
import { isSimilar } from './utils/stringUtils';
import { FrontmatterParser } from './utils/frontmatterParser';

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
      // Parse Tags
      const tags = FrontmatterParser.extractTags(file.content);

      const node: NoteNode = {
        id: file.filename,
        label: file.filename,
        inDegree: 0,
        outDegree: 0,
        content: file.content,
        metadata: { filepath: file.filepath, tags: tags }
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
          tags.forEach(tag => {
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

    // 2. Identify edges (Keyword Matching Strategy)
    // 2. 识别边（关键词匹配策略）
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

    // 3. Community Detection (v0.1.6)
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

    // 4. Graph Metrics (v0.1.7)
    const centrality = GraphMetrics.calculateBetweenness(graph);
    centrality.forEach((val, nodeId) => {
        const node = graph.getNode(nodeId);
        if (node) {
            node.centrality = val;
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
