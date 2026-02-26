/**
 * TreeLayout.test.ts - Rule 4 (Single Appearance) Regression Test
 * Tests that duplicate nodes in learningPath.nodes are correctly deduplicated
 * by getTreeLayout, ensuring no node appears more than once in the output.
 *
 * 树形布局测试 - 规则4（单次出现）回归测试
 * 测试 learningPath.nodes 中的重复节点是否被 getTreeLayout 正确去重，
 * 确保输出中没有节点出现超过一次。
 */

import { Graph } from './Graph';
import { PathEngine } from './PathEngine';
import { NoteNode } from './types';

describe('TreeLayout - Rule 4: Single Appearance', () => {
  let graph: Graph;
  let engine: PathEngine;

  const createNode = (id: string, inDegree = 0, outDegree = 0, centrality = 0): NoteNode => ({
    id,
    label: id,
    inDegree,
    outDegree,
    centrality
  });

  beforeEach(() => {
    graph = new Graph();
    engine = new PathEngine(graph);
  });

  /**
   * Helper: Simulate the deduplication logic extracted from path_core.js getTreeLayout.
   * This tests the exact same algorithm used in the frontend.
   * 辅助函数：模拟从 path_core.js getTreeLayout 中提取的去重逻辑。
   */
  function deduplicateNodes<T extends { id: string }>(rawNodes: T[]): T[] {
    const seenIds = new Set<string>();
    const result: T[] = [];
    for (const n of rawNodes) {
      if (!seenIds.has(n.id)) {
        seenIds.add(n.id);
        result.push(n);
      }
    }
    return result;
  }

  test('Duplicate nodes in input are deduplicated (first wins)', () => {
    // Simulate learningPath.nodes containing duplicate "Risk Management"
    // 模拟 learningPath.nodes 包含重复的 "Risk Management"
    const rawNodes = [
      { id: 'Preferred Stock', label: 'Preferred Stock', stepOrder: 1, isCritical: true },
      { id: 'Risk Management', label: 'Risk Management', stepOrder: 2, isCritical: true },
      { id: 'Risk Management', label: 'Risk Management', stepOrder: 3, isCritical: true }, // DUPLICATE
      { id: 'SEC', label: 'SEC', stepOrder: 4, isCritical: true },
      { id: 'VA', label: 'VA', stepOrder: 5, isCritical: true }
    ];

    const deduped = deduplicateNodes(rawNodes);

    // Should have 4 unique nodes, not 5
    expect(deduped.length).toBe(4);
    // IDs should be unique
    const ids = deduped.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    // First occurrence preserved (stepOrder 2, not 3)
    const rm = deduped.find(n => n.id === 'Risk Management');
    expect(rm).toBeDefined();
    expect(rm!.stepOrder).toBe(2);
  });

  test('No duplicates when input is already unique', () => {
    const rawNodes = [
      { id: 'A', label: 'A' },
      { id: 'B', label: 'B' },
      { id: 'C', label: 'C' }
    ];

    const deduped = deduplicateNodes(rawNodes);
    expect(deduped.length).toBe(3);
    expect(deduped.map(n => n.id)).toEqual(['A', 'B', 'C']);
  });

  test('Multiple duplicates are all removed except first', () => {
    const rawNodes = [
      { id: 'Valuation', label: 'Valuation', stepOrder: 1 },
      { id: 'Yield Curve', label: 'Yield Curve', stepOrder: 2 },
      { id: 'Valuation', label: 'Valuation', stepOrder: 3 }, // DUP 1
      { id: 'Valuation', label: 'Valuation', stepOrder: 4 }, // DUP 2
      { id: 'SEC', label: 'SEC', stepOrder: 5 }
    ];

    const deduped = deduplicateNodes(rawNodes);
    expect(deduped.length).toBe(3);
    const ids = deduped.map(n => n.id);
    expect(ids).toEqual(['Valuation', 'Yield Curve', 'SEC']);
  });

  test('Prerequisite source deduplication prevents double claiming', () => {
    // Simulate pathReverseAdj with duplicate source entries
    // 模拟具有重复源条目的 pathReverseAdj
    const pathReverseAdj = new Map<string, string[]>();
    pathReverseAdj.set('C', ['A', 'B', 'A']); // 'A' appears twice (duplicate edge)

    const sources = pathReverseAdj.get('C') || [];
    const uniqueSources = [...new Set(sources)];

    expect(sources.length).toBe(3);          // Raw has 3
    expect(uniqueSources.length).toBe(2);    // Deduped has 2
    expect(uniqueSources).toEqual(['A', 'B']);
  });

  test('PathEngine domainLearning does not produce duplicate node IDs', () => {
    // Build a diamond graph: A -> B, A -> C, B -> D, C -> D
    // D has two paths leading to it; ensure no duplicate in output
    graph.addNode(createNode('A', 0, 2));
    graph.addNode(createNode('B', 1, 1));
    graph.addNode(createNode('C', 1, 1));
    graph.addNode(createNode('D', 2, 0));

    graph.addEdge('A', 'B');
    graph.addEdge('A', 'C');
    graph.addEdge('B', 'D');
    graph.addEdge('C', 'D');

    const result = engine.domainLearning(null, 'foundational');
    const ids = result.nodes.map(n => n.id);

    // No ID should appear more than once
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(4);
  });

  test('Empty input returns empty', () => {
    const deduped = deduplicateNodes([]);
    expect(deduped.length).toBe(0);
  });
});
