import { Graph } from '../core/Graph';
import { NoteNode } from '../core/types';
import { RawFile } from './FileLoader';
import { config } from './config';
import { CommunityDetection } from './CommunityDetection';

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
      // Check exclusion list for Nodes? Usually we want all nodes, just not edges TO excluded nodes?
      // Or do we exclude the node entirely? Usually exclusion list in this context implies "Don't link TO this common word".
      // But if it's a file in the folder, it's a node.
      // Let's keep all files as nodes, but prevent edges if they are in exclusion list.
      
      const node: NoteNode = {
        id: file.filename,
        label: file.filename,
        inDegree: 0,
        outDegree: 0,
        content: file.content,
        metadata: { filepath: file.filepath }
      };

      if (layout && layout.has(file.filename)) {
          const pos = layout.get(file.filename)!;
          node.x = pos.x;
          node.y = pos.y;
      }

      graph.addNode(node);
      fileMap.set(file.filename, file);
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
            node.clusterId = clusterId;
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
          // Regex with word boundaries for exact phrase matching
          // Escape special characters in title for regex
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // \b might not work well with non-ASCII or some symbols, but good for English concepts.
          // For robustness, we might want to ensure we don't match inside a word.
          const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
          return regex.test(content);
      } else {
          // 'fuzzy' or simple inclusion (fallback)
          return content.toLowerCase().includes(term.toLowerCase());
      }
  }
}
