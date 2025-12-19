import { Graph } from '../core/Graph';
import { NoteNode } from '../core/types';
import { RawFile } from './FileLoader';

/**
 * Service to build the graph from raw files.
 * 从原始文件构建图的服务。
 */
export class GraphBuilder {
  /**
   * Builds a graph from raw files using keyword matching.
   * 使用关键词匹配从原始文件构建图。
   * @param files Array of raw files | 原始文件数组
   */
  static build(files: RawFile[]): Graph {
    const graph = new Graph();

    // 1. Add all nodes first
    // 1. 首先添加所有节点
    const fileMap = new Map<string, RawFile>();
    files.forEach(file => {
      const node: NoteNode = {
        id: file.filename,
        label: file.filename,
        inDegree: 0,
        outDegree: 0,
        metadata: { filepath: file.filepath }
      };
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

        // Simple case-insensitive exact match of the title
        // 简单的标题不区分大小写精确匹配
        // We use a regex with word boundaries to avoid partial matches (e.g., "Ice" inside "Nice")
        // 我们使用带有单词边界的正则表达式以避免部分匹配（例如，“Nice”中的“Ice”）。
        
        // Escape special characters in title for regex
        const escapedTitle = targetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedTitle, 'i'); // Removed \b for broader matching initially, or keep it?
        // Let's use strict containment to avoid too much noise, but maybe without \b for phrases?
        // Actually, titles can be phrases. "High density amorphous ice".
        // Let's just check if content includes the title string for now.
        
        if (content.toLowerCase().includes(targetId.toLowerCase())) {
             // Found a reference!
             // Target (Concept) -> Source (Context)
             graph.addEdge(targetId, sourceId, 'keyword-match');
        }
      });
    });

    return graph;
  }
}
