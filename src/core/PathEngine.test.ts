import { Graph } from './Graph';
import { PathEngine } from './PathEngine';
import { NoteNode } from './types';

describe('PathEngine', () => {
  let graph: Graph;
  let engine: PathEngine;

  beforeEach(() => {
    graph = new Graph();
    engine = new PathEngine(graph);
  });

  const createNode = (id: string, inDegree = 0, outDegree = 0, centrality = 0): NoteNode => ({
    id,
    label: id,
    inDegree,
    outDegree,
    centrality
  });

  test('Domain Learning: Simple Linear Chain', () => {
    // A -> B -> C
    graph.addNode(createNode('A'));
    graph.addNode(createNode('B'));
    graph.addNode(createNode('C'));
    graph.addEdge('A', 'B');
    graph.addEdge('B', 'C');

    const result = engine.domainLearning(null, 'foundational');
    
    expect(result.nodes.map(n => n.id)).toEqual(['A', 'B', 'C']);
    expect(result.coverage).toBe(1);
  });

  test('Domain Learning: Branching with Strategy', () => {
    // A -> B
    // A -> C
    // B and C are available after A.
    // Make B "Foundational" (high out-degree) and C "Core" (high centrality)
    graph.addNode(createNode('A', 0, 2, 0.1));
    graph.addNode(createNode('B', 1, 5, 0.2)); // High out-degree
    graph.addNode(createNode('C', 1, 0, 0.9)); // High centrality

    graph.addEdge('A', 'B');
    graph.addEdge('A', 'C');

    // Foundational should pick B first (High Out / Low In)
    const resFoundational = engine.domainLearning(null, 'foundational');
    expect(resFoundational.nodes.slice(1).map(n => n.id)).toEqual(['B', 'C']);

    // Core should pick C first (High Centrality)
    const resCore = engine.domainLearning(null, 'core');
    expect(resCore.nodes.slice(1).map(n => n.id)).toEqual(['C', 'B']);
  });

  test('Diffusion Learning: Prerequisites Extraction', () => {
    // A -> B -> Target
    // X -> Y (unrelated)
    graph.addNode(createNode('A'));
    graph.addNode(createNode('B'));
    graph.addNode(createNode('Target'));
    graph.addNode(createNode('X'));
    graph.addNode(createNode('Y'));

    graph.addEdge('A', 'B');
    graph.addEdge('B', 'Target');
    graph.addEdge('X', 'Y');

    const result = engine.diffusionLearning('Target', 'foundational');
    
    expect(result.nodes.length).toBe(3);
    expect(result.nodes.map(n => n.id)).toContain('A');
    expect(result.nodes.map(n => n.id)).toContain('B');
    expect(result.nodes.map(n => n.id)).toContain('Target');
    expect(result.nodes.map(n => n.id)).not.toContain('X');
  });

  test('Complex Prerequisite Chain', () => {
      //     A
      //    / \
      //   B   C
      //    \ /
      //     D
      graph.addNode(createNode('A'));
      graph.addNode(createNode('B'));
      graph.addNode(createNode('C'));
      graph.addNode(createNode('D'));

      graph.addEdge('A', 'B');
      graph.addEdge('A', 'C');
      graph.addEdge('B', 'D');
      graph.addEdge('C', 'D');

      const result = engine.domainLearning(null, 'foundational');
      const order = result.nodes.map(n => n.id);

      expect(order[0]).toBe('A');
      expect(order[3]).toBe('D');
      expect(order.includes('B')).toBeTruthy();
      expect(order.includes('C')).toBeTruthy();
  });
});
