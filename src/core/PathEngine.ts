import { Graph } from './Graph';
import { NoteEdge, NoteNode } from './types';

export interface LearningNode extends NoteNode {
  stepOrder?: number;
  isCompleted?: boolean;
  unlocks?: string[];
  isCritical?: boolean;
  hasHiddenPrereqs?: boolean;
  isExpanded?: boolean;
}

export interface PathResult {
  nodes: LearningNode[];
  edges: NoteEdge[];
  strategy: 'foundational' | 'core';
  coverage: number;
}

export type LearningStrategy = 'foundational' | 'core';

export interface PeripheralNode extends NoteNode {
  relation: 'prerequisite' | 'association' | 'relevance';
  weight?: number;
  score?: number;
}

type TreeLayoutSourceNode = LearningNode;

export interface TreeLayoutNode {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending';
  inDegree: number;
  outDegree: number;
  collapsed: boolean;
  isExpanded: boolean;
  isSpine: boolean;
  spineIndex: number;
  visible: boolean;
  x: number;
  y: number;
  currentOwner: string | null;
  hasPrereqs: boolean;
  inDegreeNames: string[];
  outDegreeNames: string[];
}

type InternalTreeLayoutNode = {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending';
  inDegree: number;
  collapsed: boolean;
  isExpanded: boolean;
  isSpine: boolean;
  spineIndex: number;
  visible: boolean;
  x: number;
  y: number;
  currentOwner: string | null;
  ownerPriority: number;
  hasPrereqs: boolean;
  _tributaries: InternalTreeLayoutNode[];
  _isOnSpine: boolean;
  _tribWidth?: number;
  _dir?: 1 | -1;
};

export interface TreeLayoutEdge {
  from: string;
  to: string;
}

export interface TreeLayoutHull {
  groupNodeId: string;
  memberIds: string[];
}

export interface TreeLayoutResult {
  nodes: TreeLayoutNode[];
  edges: TreeLayoutEdge[];
  hulls: TreeLayoutHull[];
}

export class PathEngine {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  domainLearning(nodeIds: string[] | null, strategy: LearningStrategy): PathResult {
    const targetNodes = nodeIds ? new Set(nodeIds) : new Set(this.graph.getNodes().map((node) => node.id));
    const relevantNodes = this.expandToIncludePrerequisites(targetNodes);
    return this.generateLearningPath(relevantNodes, strategy);
  }

  diffusionLearning(
    targetId: string,
    strategy: LearningStrategy,
    completedSet: Set<string> = new Set(),
    forcedExpansionSet: Set<string> = new Set(),
  ): PathResult {
    if (!this.graph.hasNode(targetId)) {
      throw new Error(`Node ${targetId} not found in graph`);
    }

    const targetNode = this.graph.getNode(targetId)!;
    const ancestors = this.getAncestors(targetId);
    const unlearned = ancestors.filter((id) => !completedSet.has(id));
    if (!completedSet.has(targetId) && !unlearned.includes(targetId)) {
      unlearned.push(targetId);
    }

    if (unlearned.length === 0) {
      return {
        nodes: [targetNode],
        edges: [],
        strategy,
        coverage: 1,
      };
    }

    const frontier = unlearned.filter((id) => {
      const incoming = this.graph.getIncomingEdges(id);
      return incoming.every((edge) => completedSet.has(edge.source));
    });

    let bestPath: string[] | null = null;
    const reverseAdj = new Map<string, string[]>();
    unlearned.forEach((id) => reverseAdj.set(id, []));

    unlearned.forEach((id) => {
      const incoming = this.graph.getIncomingEdges(id);
      incoming.forEach((edge) => {
        if (unlearned.includes(edge.source)) {
          if (!reverseAdj.has(id)) {
            reverseAdj.set(id, []);
          }
          reverseAdj.get(id)!.push(edge.source);
        }
      });
    });

    const queue: string[][] = [[targetId]];
    const visited = new Set<string>([targetId]);

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const head = currentPath[currentPath.length - 1];

      if (frontier.includes(head)) {
        bestPath = [...currentPath].reverse();
        break;
      }

      const neighbors = reverseAdj.get(head) || [];
      neighbors.sort((left, right) => this.compareNodes(left, right, strategy));

      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push([...currentPath, next]);
        }
      }
    }

    let finalPathNodes: NoteNode[];
    if (bestPath) {
      finalPathNodes = bestPath.map((id) => this.graph.getNode(id)).filter((node): node is NoteNode => Boolean(node));
    } else if (unlearned.length < 50) {
      finalPathNodes = unlearned.map((id) => this.graph.getNode(id)).filter((node): node is NoteNode => Boolean(node));
    } else {
      const immediate = this.graph.getIncomingEdges(targetId)
        .map((edge) => edge.source)
        .filter((id) => !completedSet.has(id));
      finalPathNodes = [targetId, ...immediate]
        .map((id) => this.graph.getNode(id))
        .filter((node): node is NoteNode => Boolean(node));
    }

    const spineSet = new Set(finalPathNodes.map((node) => node.id));
    const nodesToAdd = new Set<string>();
    const currentPathIds = new Set(finalPathNodes.map((node) => node.id));

    currentPathIds.forEach((id) => {
      if (!forcedExpansionSet.has(id)) {
        return;
      }

      const incoming = this.graph.getIncomingEdges(id);
      incoming.forEach((edge) => {
        const prereqId = edge.source;
        if (!currentPathIds.has(prereqId)) {
          nodesToAdd.add(prereqId);
        }
      });
    });

    nodesToAdd.forEach((id) => {
      const node = this.graph.getNode(id);
      if (node) {
        finalPathNodes.push(node);
      }
    });

    const pathSet = new Set(finalPathNodes.map((node) => node.id));
    const enrichedNodes: LearningNode[] = finalPathNodes.map((node) => {
      const isOriginalPath = bestPath ? bestPath.includes(node.id) : spineSet.has(node.id);
      const nextNode: LearningNode = {
        ...node,
        isCritical: isOriginalPath,
      };

      const incoming = this.graph.getIncomingEdges(node.id);
      const hasHidden = incoming.some((edge) => !completedSet.has(edge.source) && !pathSet.has(edge.source));
      if (hasHidden) {
        nextNode.hasHiddenPrereqs = true;
      }
      if (forcedExpansionSet.has(node.id)) {
        nextNode.isExpanded = true;
      }

      return nextNode;
    });

    return {
      nodes: enrichedNodes,
      edges: this.getRelevantEdges(enrichedNodes),
      strategy,
      coverage: unlearned.length > 0 ? enrichedNodes.length / unlearned.length : 1,
    };
  }

  getPeripheralNodes(
    centralId: string,
    mode: 'domain' | 'diffusion' = 'domain',
    ultimateTargetId: string | null = null,
    maxCount = 4,
  ): PeripheralNode[] {
    const centralNode = this.graph.getNode(centralId);
    if (!centralNode) {
      return [];
    }

    const peripherals: PeripheralNode[] = [];
    const addedIds = new Set<string>([centralId]);

    const incomingEdges = this.graph.getIncomingEdges(centralId);
    for (const edge of incomingEdges) {
      if (peripherals.length >= maxCount) {
        break;
      }
      if (!addedIds.has(edge.source)) {
        const node = this.graph.getNode(edge.source);
        if (node) {
          peripherals.push({ ...node, relation: 'prerequisite' });
          addedIds.add(edge.source);
        }
      }
    }

    if (peripherals.length < maxCount) {
      const outgoingEdges = this.graph.getOutgoingEdges(centralId);
      const candidates: PeripheralNode[] = [];

      for (const edge of outgoingEdges) {
        if (addedIds.has(edge.target)) {
          continue;
        }

        if (mode === 'diffusion' && ultimateTargetId) {
          const targetOutgoing = this.graph.getOutgoingEdges(ultimateTargetId);
          const isOutDegreeOfTarget = targetOutgoing.some((candidateEdge) => candidateEdge.target === edge.target);
          if (isOutDegreeOfTarget) {
            continue;
          }
        }

        const node = this.graph.getNode(edge.target);
        if (node) {
          candidates.push({
            ...node,
            relation: 'association',
            weight: edge.weight || 1,
          });
        }
      }

      candidates.sort((left, right) => (right.weight || 0) - (left.weight || 0));
      for (const candidate of candidates) {
        if (peripherals.length >= maxCount) {
          break;
        }
        if (!addedIds.has(candidate.id)) {
          peripherals.push(candidate);
          addedIds.add(candidate.id);
        }
      }
    }

    if (peripherals.length === 0) {
      const candidates = this.graph.getNodes()
        .filter((node) => node.id !== centralId)
        .map((node) => ({
          ...node,
          relation: 'relevance' as const,
          score: (node.centrality || 0) + (node.outDegree || 0) * 0.1,
        }))
        .sort((left, right) => (right.score || 0) - (left.score || 0));

      for (const candidate of candidates) {
        if (peripherals.length >= maxCount) {
          break;
        }
        peripherals.push(candidate);
      }
    }

    return peripherals;
  }

  public getTreeLayout(
    centralId: string | null,
    learningPath: PathResult,
    collapsedSet: Set<string> = new Set(),
    expansionOrder: string[] = [],
    stickyClaimEnabled = true,
  ): TreeLayoutResult | null {
    const rawNodesRaw = Array.isArray(learningPath.nodes) ? learningPath.nodes : [];
    if (rawNodesRaw.length === 0) {
      return null;
    }

    const seenIds = new Set<string>();
    const rawNodes: TreeLayoutSourceNode[] = [];
    for (const node of rawNodesRaw) {
      if (!node || !node.id || seenIds.has(node.id)) {
        continue;
      }
      seenIds.add(node.id);
      rawNodes.push(node);
    }

    if (rawNodes.length === 0) {
      return null;
    }

    let spineCandidates = rawNodes.filter((node) => Boolean(node.isCritical));
    if (spineCandidates.length === 0) {
      spineCandidates = [...rawNodes];
    }
    spineCandidates.sort((left, right) => (left.stepOrder || 0) - (right.stepOrder || 0));

    const spineIndexMap = new Map<string, number>();
    spineCandidates.forEach((node, index) => spineIndexMap.set(node.id, index));

    const visualWidth = 140;
    const horizontalGap = 50;
    const verticalGap = 120;
    const spineSpacing = 290;

    const nodes: InternalTreeLayoutNode[] = rawNodes.map((node) => {
      const isSpine = spineIndexMap.has(node.id);
      return {
        id: node.id,
        label: node.label,
        status: this.getNodeStatus(node, centralId),
        inDegree: node.inDegree || 0,
        collapsed: collapsedSet.has(node.id),
        isExpanded: !collapsedSet.has(node.id),
        isSpine,
        spineIndex: isSpine ? spineIndexMap.get(node.id)! : -1,
        visible: true,
        x: 0,
        y: 0,
        currentOwner: null,
        ownerPriority: -1,
        hasPrereqs: false,
        _tributaries: [],
        _isOnSpine: isSpine,
      };
    });

    const nodeMap = new Map<string, InternalTreeLayoutNode>(nodes.map((node) => [node.id, node]));
    const expandedOrder = expansionOrder.filter((nodeId) => nodeMap.has(nodeId) && !collapsedSet.has(nodeId));
    const expandedSet = new Set(expandedOrder);

    const usePathEdges = Array.isArray(learningPath.edges) && learningPath.edges.length > 0;
    const pathReverseAdj = new Map<string, string[]>();
    if (usePathEdges) {
      learningPath.edges.forEach((edge) => {
        const targetId = this.resolveEdgeNodeId(edge.target);
        const sourceId = this.resolveEdgeNodeId(edge.source);
        if (!targetId || !sourceId) {
          return;
        }
        if (!pathReverseAdj.has(targetId)) {
          pathReverseAdj.set(targetId, []);
        }
        pathReverseAdj.get(targetId)!.push(sourceId);
      });
    }

    const getNode = (nodeId: string | null | undefined): InternalTreeLayoutNode | undefined => {
      if (!nodeId) {
        return undefined;
      }
      return nodeMap.get(nodeId);
    };

    const getPrereqs = (nodeId: string): InternalTreeLayoutNode[] => {
      const sources = usePathEdges
        ? (pathReverseAdj.get(nodeId) || [])
        : this.graph.getIncomingEdges(nodeId).map((edge) => edge.source);

      return [...new Set(sources)]
        .filter((sourceId) => nodeMap.has(sourceId))
        .map((sourceId) => getNode(sourceId)!)
        .filter((node): node is InternalTreeLayoutNode => Boolean(node));
    };

    nodes.forEach((node) => {
      node.hasPrereqs = getPrereqs(node.id).length > 0;
    });

    const getTributaryRootSpineIndex = (node: InternalTreeLayoutNode): number => {
      if (node._isOnSpine && node.isSpine) {
        return node.spineIndex;
      }

      let current: InternalTreeLayoutNode | undefined = node;
      const visited = new Set<string>();
      while (current && !visited.has(current.id)) {
        visited.add(current.id);
        if (current.isSpine) {
          return current.spineIndex;
        }
        current = current.currentOwner ? getNode(current.currentOwner) : undefined;
      }

      return -1;
    };

    const getEffectiveSpineIndex = (node: InternalTreeLayoutNode, visited = new Set<string>()): number => {
      if (!node.isSpine) {
        return -1;
      }
      if (node._isOnSpine || node.currentOwner === null) {
        return node.spineIndex ?? -1;
      }
      if (visited.has(node.id)) {
        return node.spineIndex ?? -1;
      }

      visited.add(node.id);
      const owner = node.currentOwner ? getNode(node.currentOwner) : undefined;
      if (owner && owner.isSpine) {
        return getEffectiveSpineIndex(owner, visited);
      }

      return getTributaryRootSpineIndex(node);
    };

    const claim = (
      target: InternalTreeLayoutNode,
      owner: InternalTreeLayoutNode,
      priority: number,
      claimVisited = new Set<string>(),
    ): void => {
      if (claimVisited.has(target.id)) {
        return;
      }
      claimVisited.add(target.id);

      target.currentOwner = owner.id;
      target.ownerPriority = priority;
      target._isOnSpine = false;

      if (!owner._tributaries.includes(target)) {
        owner._tributaries.push(target);
      }

      if (expandedSet.has(target.id)) {
        const targetEffectiveIdx = getEffectiveSpineIndex(target);
        const targetTributaries = getPrereqs(target.id).filter((node) => node.currentOwner === null);

        targetTributaries.forEach((node) => {
          if (node.isSpine && target.isSpine) {
            const nodeIndex = node.spineIndex ?? -1;
            if (nodeIndex !== -1 && targetEffectiveIdx !== -1 && nodeIndex <= targetEffectiveIdx) {
              return;
            }
          }

          claim(node, target, priority, claimVisited);
        });
      }
    };

    const claimSpineChain = (startNode: InternalTreeLayoutNode, owner: InternalTreeLayoutNode, priority: number): void => {
      const chain = nodes
        .filter((node) => node.isSpine && node.spineIndex >= startNode.spineIndex)
        .sort((left, right) => left.spineIndex - right.spineIndex);
      chain.forEach((node) => claim(node, owner, priority));
    };

    const tryClaim = (expander: InternalTreeLayoutNode, target: InternalTreeLayoutNode, priority: number): { success: boolean } => {
      if (target.currentOwner !== null && target.ownerPriority < priority) {
        return { success: false };
      }

      const expanderEffectiveIdx = getEffectiveSpineIndex(expander);
      const targetEffectiveIdx = target.spineIndex ?? -1;

      if (target.isSpine && expander.isSpine) {
        if (targetEffectiveIdx !== -1 && expanderEffectiveIdx !== -1 && targetEffectiveIdx <= expanderEffectiveIdx) {
          return { success: false };
        }
      }

      if (target.isSpine && !expander.isSpine) {
        const rootSpineIndex = getTributaryRootSpineIndex(expander);
        if (rootSpineIndex !== -1 && targetEffectiveIdx <= rootSpineIndex) {
          return { success: false };
        }
      }

      if (target.isSpine && expander.isSpine && expander._isOnSpine) {
        claimSpineChain(target, expander, priority);
        return { success: true };
      }

      claim(target, expander, priority);
      return { success: true };
    };

    const isOwnerChainVisible = (node: InternalTreeLayoutNode, visited = new Set<string>()): boolean => {
      if (node.currentOwner === null) {
        return false;
      }
      if (visited.has(node.id)) {
        return false;
      }

      visited.add(node.id);
      if (!expandedSet.has(node.currentOwner)) {
        return false;
      }

      const owner = getNode(node.currentOwner);
      if (!owner) {
        return false;
      }
      if (owner.isSpine && owner._isOnSpine) {
        return true;
      }
      if (owner.isSpine && !owner._isOnSpine) {
        return owner.visible;
      }

      return isOwnerChainVisible(owner, visited);
    };

    expandedOrder.forEach((expanderId, priority) => {
      const expander = getNode(expanderId);
      if (!expander || !expandedSet.has(expanderId)) {
        return;
      }

      const prereqs = getPrereqs(expanderId);
      prereqs.forEach((prereq) => tryClaim(expander, prereq, priority));
    });

    nodes.forEach((node) => {
      if (node.isSpine) {
        node.visible = true;
        if (node.currentOwner && !expandedSet.has(node.currentOwner)) {
          node._isOnSpine = true;
          node.currentOwner = null;
        }
      }
    });

    nodes.forEach((node) => {
      if (!node.isSpine) {
        node.visible = isOwnerChainVisible(node);
        if (!node.visible && !stickyClaimEnabled) {
          node.currentOwner = null;
        }
      }
    });

    const calculateContourWidth = (node: InternalTreeLayoutNode, visited = new Set<string>()): number => {
      if (visited.has(node.id)) {
        return 0;
      }
      visited.add(node.id);

      if (!expandedSet.has(node.id)) {
        return visualWidth + horizontalGap;
      }

      const tributaries = node._tributaries.filter((candidate) => candidate.visible && !candidate._isOnSpine);
      if (tributaries.length === 0) {
        return visualWidth + horizontalGap;
      }

      let total = 0;
      tributaries.forEach((candidate) => {
        total += calculateContourWidth(candidate, visited);
      });

      return Math.max(visualWidth + horizontalGap, total);
    };

    const renderPlaced = new Set<string>();
    const placeSubTributaries = (parent: InternalTreeLayoutNode, direction: 1 | -1): void => {
      if (renderPlaced.has(parent.id)) {
        return;
      }
      renderPlaced.add(parent.id);

      const tributaries = parent._tributaries.filter((node) => node.visible && !node._isOnSpine);
      if (tributaries.length === 0) {
        return;
      }

      const widths = tributaries.map((node) => calculateContourWidth(node));
      const totalWidth = widths.reduce((sum, width) => sum + width, 0);
      let startX = parent.x - totalWidth / 2;

      tributaries.forEach((node, index) => {
        const width = widths[index];
        node.x = startX + width / 2;
        node.y = parent.y + direction * verticalGap;
        startX += width;
      });

      tributaries.forEach((node) => {
        if (expandedSet.has(node.id)) {
          placeSubTributaries(node, direction);
        }
      });
    };

    const visibleSpineNodes = nodes.filter((node) => node._isOnSpine).sort((left, right) => left.spineIndex - right.spineIndex);
    let lastUpSpine: InternalTreeLayoutNode | null = null;
    let lastDownSpine: InternalTreeLayoutNode | null = null;

    visibleSpineNodes.forEach((node, index) => {
      const effectiveIdx = getEffectiveSpineIndex(node);
      const direction: 1 | -1 = ((effectiveIdx === -1 ? node.spineIndex : effectiveIdx) % 2 === 0) ? 1 : -1;

      const tributaryWidth = calculateContourWidth(node);
      node._tribWidth = tributaryWidth;
      node._dir = direction;

      let minX = index === 0 ? 0 : visibleSpineNodes[index - 1].x + spineSpacing;
      const previousSameSide = direction === 1 ? lastDownSpine : lastUpSpine;
      if (previousSameSide) {
        const safeX = previousSameSide.x + (previousSameSide._tribWidth || 0) / 2 + tributaryWidth / 2 + horizontalGap * 2;
        minX = Math.max(minX, safeX);
      }

      node.x = minX;
      node.y = 0;

      if (direction === 1) {
        lastDownSpine = node;
      } else {
        lastUpSpine = node;
      }
    });

    visibleSpineNodes.forEach((node) => {
      if (expandedSet.has(node.id)) {
        placeSubTributaries(node, node._dir || 1);
      }
    });

    const visibleNodes = nodes.filter((node) => node.visible);
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const edgeSet = new Set<string>();
    const layoutEdges: TreeLayoutEdge[] = [];
    const allEdges = usePathEdges ? learningPath.edges : this.graph.getEdges();

    allEdges.forEach((edge) => {
      const sourceId = this.resolveEdgeNodeId(edge.source);
      const targetId = this.resolveEdgeNodeId(edge.target);
      if (!sourceId || !targetId) {
        return;
      }

      const source = getNode(sourceId);
      const target = getNode(targetId);
      if (!source || !target || !visibleIds.has(source.id) || !visibleIds.has(target.id)) {
        return;
      }
      if (source.currentOwner && target.currentOwner && source.currentOwner !== target.currentOwner) {
        return;
      }

      const edgeKey = `${sourceId}->${targetId}`;
      if (edgeSet.has(edgeKey)) {
        return;
      }

      edgeSet.add(edgeKey);
      layoutEdges.push({ from: sourceId, to: targetId });
    });

    const hulls: TreeLayoutHull[] = [];
    expandedOrder.forEach((nodeId) => {
      const expander = getNode(nodeId);
      if (!expander || !expandedSet.has(nodeId)) {
        return;
      }

      const tributaries = expander._tributaries.filter((node) => node.visible);
      if (tributaries.length === 0) {
        return;
      }

      hulls.push({
        groupNodeId: nodeId,
        memberIds: tributaries.map((node) => node.id),
      });
    });

    const outAdj = new Map<string, Set<string>>();
    const allEdgesForDegree = usePathEdges ? learningPath.edges : this.graph.getEdges();
    allEdgesForDegree.forEach((edge) => {
      const sourceId = this.resolveEdgeNodeId(edge.source);
      const targetId = this.resolveEdgeNodeId(edge.target);
      if (!sourceId || !targetId) {
        return;
      }

      if (!outAdj.has(sourceId)) {
        outAdj.set(sourceId, new Set());
      }
      outAdj.get(sourceId)!.add(targetId);
    });

    const cleanNodes: TreeLayoutNode[] = visibleNodes.map((node) => {
      const inSources = getPrereqs(node.id);
      const inDegreeNames = inSources.map((source) => source.label || source.id);
      const outTargets = outAdj.get(node.id) || new Set<string>();
      const outDegreeNames = [...outTargets].map((targetId) => {
        const target = getNode(targetId);
        return target ? (target.label || target.id) : targetId;
      });

      return {
        id: node.id,
        label: node.label,
        status: node.status,
        x: node.x,
        y: node.y,
        isSpine: node.isSpine,
        spineIndex: node.spineIndex,
        isExpanded: node.isExpanded,
        collapsed: node.collapsed,
        hasPrereqs: node.hasPrereqs,
        currentOwner: node.currentOwner,
        visible: node.visible,
        inDegree: node.inDegree,
        outDegree: outTargets.size,
        inDegreeNames,
        outDegreeNames,
      };
    });

    return {
      nodes: cleanNodes,
      edges: layoutEdges,
      hulls,
    };
  }

  private getAncestors(startId: string): string[] {
    const queue = [startId];
    const ancestors: string[] = [];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const incoming = this.graph.getIncomingEdges(current);
      incoming.forEach((edge) => {
        if (!visited.has(edge.source)) {
          visited.add(edge.source);
          ancestors.push(edge.source);
          queue.push(edge.source);
        }
      });
    }

    return ancestors;
  }

  private getRelevantEdges(nodes: Array<Pick<NoteNode, 'id'>>): NoteEdge[] {
    const nodeSet = new Set(nodes.map((node) => node.id));
    const edges: NoteEdge[] = [];
    const edgeSet = new Set<string>();

    nodes.forEach((node) => {
      const outgoing = this.graph.getOutgoingEdges(node.id);
      outgoing.forEach((edge) => {
        if (!nodeSet.has(edge.target)) {
          return;
        }

        const edgeKey = `${edge.source}->${edge.target}:${edge.type || 'dependency'}`;
        if (edgeSet.has(edgeKey)) {
          return;
        }

        edgeSet.add(edgeKey);
        edges.push(edge);
      });
    });

    return edges;
  }

  private generateLearningPath(nodesOfInterest: Set<string>, strategy: LearningStrategy): PathResult {
    const nodes = Array.from(nodesOfInterest)
      .map((id) => this.graph.getNode(id))
      .filter((node): node is NoteNode => Boolean(node));
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    const localInDegree = new Map<string, number>();
    const localAdjacency = new Map<string, string[]>();

    nodes.forEach((node) => {
      localInDegree.set(node.id, 0);
      localAdjacency.set(node.id, []);
    });

    const relevantEdges: NoteEdge[] = [];
    nodes.forEach((node) => {
      const outgoing = this.graph.getOutgoingEdges(node.id);
      outgoing.forEach((edge) => {
        if (nodesOfInterest.has(edge.target)) {
          localAdjacency.get(node.id)!.push(edge.target);
          localInDegree.set(edge.target, (localInDegree.get(edge.target) || 0) + 1);
          relevantEdges.push(edge);
        }
      });
    });

    const available: string[] = [];
    nodes.forEach((node) => {
      if (localInDegree.get(node.id) === 0) {
        available.push(node.id);
      }
    });

    const learnedPath: LearningNode[] = [];
    const visited = new Set<string>();
    let step = 1;

    const processNode = (currentId: string): void => {
      visited.add(currentId);
      const currentNode = nodeMap.get(currentId)!;

      learnedPath.push({
        ...currentNode,
        stepOrder: step++,
        isCompleted: false,
        unlocks: localAdjacency.get(currentId)!,
      });

      const neighbors = localAdjacency.get(currentId)!;
      neighbors.forEach((neighborId) => {
        if (!visited.has(neighborId)) {
          const newDegree = (localInDegree.get(neighborId) || 0) - 1;
          localInDegree.set(neighborId, newDegree);
          if (newDegree <= 0 && !available.includes(neighborId)) {
            available.push(neighborId);
          }
        }
      });
    };

    while (learnedPath.length < nodes.length) {
      if (available.length > 0) {
        available.sort((left, right) => this.compareNodes(left, right, strategy));
        const currentId = available.shift()!;
        if (!visited.has(currentId)) {
          processNode(currentId);
        }
        continue;
      }

      const remainingIds = nodes.filter((node) => !visited.has(node.id)).map((node) => node.id);
      if (remainingIds.length === 0) {
        break;
      }

      remainingIds.sort((left, right) => {
        const leftDegree = localInDegree.get(left) || 0;
        const rightDegree = localInDegree.get(right) || 0;
        if (leftDegree !== rightDegree) {
          return leftDegree - rightDegree;
        }
        return this.compareNodes(left, right, strategy);
      });

      const forcedId = remainingIds[0];
      localInDegree.set(forcedId, 0);
      processNode(forcedId);
    }

    return {
      nodes: learnedPath,
      edges: relevantEdges,
      strategy,
      coverage: nodes.length > 0 ? learnedPath.length / nodes.length : 0,
    };
  }

  private expandToIncludePrerequisites(initialNodes: Set<string>): Set<string> {
    const result = new Set(initialNodes);
    for (const nodeId of initialNodes) {
      const predecessors = this.graph.getPredecessors(nodeId);
      predecessors.forEach((predecessorId) => result.add(predecessorId));
    }
    return result;
  }

  private compareNodes(idA: string, idB: string, strategy: LearningStrategy): number {
    const nodeA = this.graph.getNode(idA)!;
    const nodeB = this.graph.getNode(idB)!;

    const scoreA = this.calculateScore(nodeA, strategy);
    const scoreB = this.calculateScore(nodeB, strategy);
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    return idA.localeCompare(idB);
  }

  private calculateScore(node: NoteNode, strategy: LearningStrategy): number {
    const safeInDegree = node.inDegree + 1;
    if (strategy === 'foundational') {
      return (node.outDegree + 0.1) / safeInDegree;
    }
    return (node.centrality || 0) * 10 - node.inDegree;
  }

  private getNodeStatus(node: LearningNode, centralId: string | null): 'completed' | 'current' | 'pending' {
    if (node.isCompleted) {
      return 'completed';
    }
    if (centralId && node.id === centralId) {
      return 'current';
    }
    return 'pending';
  }

  private resolveEdgeNodeId(endpoint: unknown): string {
    if (typeof endpoint === 'string') {
      return endpoint;
    }
    if (endpoint && typeof endpoint === 'object' && 'id' in (endpoint as Record<string, unknown>)) {
      const candidate = (endpoint as { id?: unknown }).id;
      return typeof candidate === 'string' ? candidate : '';
    }
    return '';
  }
}
