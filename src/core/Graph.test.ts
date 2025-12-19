import { Graph } from './Graph';
import { NoteNode } from './types';

describe('Graph Core', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph();
  });

  test('should add a node correctly', () => {
    const node: NoteNode = { id: 'A', label: 'Note A', inDegree: 0, outDegree: 0 };
    graph.addNode(node);
    expect(graph.hasNode('A')).toBe(true);
    expect(graph.getNode('A')).toEqual(expect.objectContaining({ id: 'A' }));
  });

  test('should add an edge and update degrees', () => {
    graph.addEdge('A', 'B');
    
    expect(graph.hasNode('A')).toBe(true);
    expect(graph.hasNode('B')).toBe(true);
    
    const nodeA = graph.getNode('A');
    const nodeB = graph.getNode('B');
    
    expect(nodeA?.outDegree).toBe(1);
    expect(nodeB?.inDegree).toBe(1);
    
    const outgoing = graph.getOutgoingEdges('A');
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].target).toBe('B');
    
    const incoming = graph.getIncomingEdges('B');
    expect(incoming).toHaveLength(1);
    expect(incoming[0].source).toBe('A');
  });

  test('should not add duplicate edges', () => {
    graph.addEdge('A', 'B');
    graph.addEdge('A', 'B'); // Duplicate
    
    const nodeA = graph.getNode('A');
    expect(nodeA?.outDegree).toBe(1);
    expect(graph.getOutgoingEdges('A')).toHaveLength(1);
  });
});
