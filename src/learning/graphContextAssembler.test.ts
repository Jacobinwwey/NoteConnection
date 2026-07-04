import { assembleAgentConversationGraphContext } from './graphContextAssembler';
import type {
    AgentConversationKnowledgePoint,
    KnowledgeAtom,
    KnowledgeQueryResolvedScope,
    RelationEdge,
} from './types';
import type {
    EdgeQueryFilter,
    KnowledgeGraphOpsAdapter,
    KnowledgeGraphOpsCapabilities,
    KnowledgeGraphSnapshot,
    KnowledgeGraphStoreDiagnostics,
    NodeQueryFilter,
    PathQueryResult,
} from './store';

class InMemoryOpsStore implements KnowledgeGraphOpsAdapter {
    constructor(
        private readonly atoms: KnowledgeAtom[],
        private readonly relationEdges: RelationEdge[]
    ) {}

    async loadSnapshot(): Promise<KnowledgeGraphSnapshot | null> {
        return null;
    }

    async saveSnapshot(_snapshot: KnowledgeGraphSnapshot): Promise<void> {
    }

    getDiagnostics(): KnowledgeGraphStoreDiagnostics {
        return {
            storeType: 'memory',
            exists: true,
            loaded: true,
        };
    }

    getCapabilities(): KnowledgeGraphOpsCapabilities {
        return {
            snapshotSupported: true,
            nodeQuerySupported: true,
            edgeQuerySupported: true,
            pathQuerySupported: true,
            writeSupported: true,
            serverSideQuery: false,
        };
    }

    async getNode(atomId: string): Promise<KnowledgeAtom | null> {
        return this.atoms.find((atom) => atom.id === atomId || atom.stableKey === atomId) || null;
    }

    async queryNodes(filter: NodeQueryFilter): Promise<KnowledgeAtom[]> {
        if (Array.isArray(filter.nodeIds) && filter.nodeIds.length > 0) {
            const nodeIdSet = new Set(filter.nodeIds);
            return this.atoms.filter((atom) => nodeIdSet.has(atom.id) || nodeIdSet.has(atom.stableKey));
        }
        return this.atoms.slice(0, filter.limit || this.atoms.length);
    }

    async queryEdges(filter: EdgeQueryFilter): Promise<RelationEdge[]> {
        return this.relationEdges.filter((edge) => {
            if (filter.fromNodeId && edge.sourceAtomId !== filter.fromNodeId) {
                return false;
            }
            if (filter.toNodeId && edge.targetAtomId !== filter.toNodeId) {
                return false;
            }
            if (filter.relationKind && edge.relationKind !== filter.relationKind) {
                return false;
            }
            return true;
        }).slice(0, filter.limit || this.relationEdges.length);
    }

    async findPath(sourceId: string, targetId: string, maxDepth = 10): Promise<PathQueryResult> {
        const adjacency = new Map<string, Array<{ to: string; edge: RelationEdge }>>();
        this.relationEdges.forEach((edge) => {
            const nextEdges = adjacency.get(edge.sourceAtomId) || [];
            nextEdges.push({
                to: edge.targetAtomId,
                edge,
            });
            adjacency.set(edge.sourceAtomId, nextEdges);
        });

        const queue: Array<{ atomId: string; path: string[]; edges: PathQueryResult['edges'] }> = [
            { atomId: sourceId, path: [sourceId], edges: [] },
        ];
        const visited = new Set<string>([sourceId]);
        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            if (current.path.length > maxDepth) {
                continue;
            }
            if (current.atomId === targetId) {
                return {
                    path: current.path,
                    length: current.path.length - 1,
                    edges: current.edges,
                    found: true,
                };
            }
            const neighbors = adjacency.get(current.atomId) || [];
            neighbors.forEach((neighbor) => {
                if (visited.has(neighbor.to)) {
                    return;
                }
                visited.add(neighbor.to);
                queue.push({
                    atomId: neighbor.to,
                    path: [...current.path, neighbor.to],
                    edges: [
                        ...current.edges,
                        {
                            from: neighbor.edge.sourceAtomId,
                            to: neighbor.edge.targetAtomId,
                            relation: neighbor.edge.relationKind,
                        },
                    ],
                });
            });
        }
        return {
            path: [],
            length: 0,
            edges: [],
            found: false,
        };
    }
}

const globalScope: KnowledgeQueryResolvedScope = {
    source: 'global',
    workspaceId: null,
    corpusId: null,
    documentIds: [],
    atomIds: [],
    sourcePathPrefixes: [],
    languages: [],
    matchedAtomCount: 3,
    scopeSource: 'global_default',
};

function createKnowledgePoint(overrides: Partial<AgentConversationKnowledgePoint>): AgentConversationKnowledgePoint {
    return {
        atomId: 'atom_default',
        atomIds: ['atom_default'],
        documentId: 'doc_default',
        sourcePath: 'Knowledge_Base/default.md',
        title: 'Default Point',
        summary: 'Default point summary.',
        evidenceSnippet: 'Default point summary.',
        score: 0.5,
        citation: null,
        citations: [],
        matchedSpans: [],
        matchCount: 0,
        relationPath: [],
        relationPathAtomIds: [],
        relationKinds: [],
        temporalValidity: {
            isValid: true,
            checkedAt: '2026-06-17T00:00:00.000Z',
            reasons: [],
            details: [],
        },
        capabilities: [],
        ...overrides,
    };
}

function createAtom(overrides: Partial<KnowledgeAtom>): KnowledgeAtom {
    const id = String(overrides.id || 'atom_default');
    return {
        id,
        stableKey: id,
        documentId: 'doc_default',
        sourcePath: `Knowledge_Base/${id}.md`,
        title: id,
        content: `${id} content.`,
        representationType: 'text',
        keywords: [],
        evidenceSpanIds: [],
        createdAt: '2026-06-17T00:00:00.000Z',
        updatedAt: '2026-06-17T00:00:00.000Z',
        metadata: {
            sectionPath: [],
            version: 1,
            sourceHash: id,
            language: 'en',
        },
        ...overrides,
    };
}

describe('assembleAgentConversationGraphContext', () => {
    test('selects a title-mentioned anchor and enriches bounded graph windows before answer synthesis', async () => {
        const atoms: KnowledgeAtom[] = [
            {
                id: 'atom_foundation',
                stableKey: 'foundation',
                documentId: 'doc_foundation',
                sourcePath: 'Knowledge_Base/optics/foundation.md',
                title: 'Foundation Note',
                content: 'Foundation note stabilizes the chain.',
                representationType: 'text',
                keywords: [],
                evidenceSpanIds: [],
                createdAt: '2026-06-17T00:00:00.000Z',
                updatedAt: '2026-06-17T00:00:00.000Z',
                metadata: {
                    sectionPath: [],
                    version: 1,
                    sourceHash: 'foundation',
                    language: 'en',
                },
            },
            {
                id: 'atom_bridge',
                stableKey: 'bridge',
                documentId: 'doc_bridge',
                sourcePath: 'Knowledge_Base/optics/bridge.md',
                title: 'Bridge Layer',
                content: 'Bridge layer connects foundation to ground state.',
                representationType: 'text',
                keywords: [],
                evidenceSpanIds: [],
                createdAt: '2026-06-17T00:00:00.000Z',
                updatedAt: '2026-06-17T00:00:00.000Z',
                metadata: {
                    sectionPath: [],
                    version: 1,
                    sourceHash: 'bridge',
                    language: 'en',
                },
            },
            {
                id: 'atom_ground',
                stableKey: 'ground',
                documentId: 'doc_ground',
                sourcePath: 'Knowledge_Base/optics/ground.md',
                title: 'Ground State',
                content: 'Ground state is the target optical state.',
                representationType: 'text',
                keywords: [],
                evidenceSpanIds: [],
                createdAt: '2026-06-17T00:00:00.000Z',
                updatedAt: '2026-06-17T00:00:00.000Z',
                metadata: {
                    sectionPath: [],
                    version: 1,
                    sourceHash: 'ground',
                    language: 'en',
                },
            },
            {
                id: 'atom_application',
                stableKey: 'application',
                documentId: 'doc_application',
                sourcePath: 'Knowledge_Base/optics/application.md',
                title: 'Application Example',
                content: 'Application example extends the ground state into execution.',
                representationType: 'text',
                keywords: [],
                evidenceSpanIds: [],
                createdAt: '2026-06-17T00:00:00.000Z',
                updatedAt: '2026-06-17T00:00:00.000Z',
                metadata: {
                    sectionPath: [],
                    version: 1,
                    sourceHash: 'application',
                    language: 'en',
                },
            },
        ];
        const edges: RelationEdge[] = [
            {
                id: 'edge_foundation_bridge',
                sourceAtomId: 'atom_foundation',
                targetAtomId: 'atom_bridge',
                relationKind: 'prerequisite',
                provenance: 'fact',
                confidence: 0.91,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-06-17T00:00:00.000Z',
                },
            },
            {
                id: 'edge_bridge_ground',
                sourceAtomId: 'atom_bridge',
                targetAtomId: 'atom_ground',
                relationKind: 'reference',
                provenance: 'fact',
                confidence: 0.88,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-06-17T00:00:00.000Z',
                },
            },
            {
                id: 'edge_ground_application',
                sourceAtomId: 'atom_ground',
                targetAtomId: 'atom_application',
                relationKind: 'sequence',
                provenance: 'fact',
                confidence: 0.74,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-06-17T00:00:00.000Z',
                },
            },
        ];
        const knowledgePoints: AgentConversationKnowledgePoint[] = [
            createKnowledgePoint({
                atomId: 'atom_foundation',
                atomIds: ['atom_foundation'],
                documentId: 'doc_foundation',
                sourcePath: 'Knowledge_Base/optics/foundation.md',
                title: 'Foundation Note',
                summary: 'Foundation note stabilizes the optics chain.',
                evidenceSnippet: 'Foundation note stabilizes the optics chain.',
                score: 0.94,
                citation: {
                    citationId: 'citation_foundation',
                    atomId: 'atom_foundation',
                    documentId: 'doc_foundation',
                    sourcePath: 'Knowledge_Base/optics/foundation.md',
                    title: 'Foundation Note',
                    snippet: 'Foundation note stabilizes the optics chain.',
                    startLine: 4,
                    endLine: 4,
                    score: 0.94,
                },
                citations: [
                    {
                        citationId: 'citation_foundation',
                        atomId: 'atom_foundation',
                        documentId: 'doc_foundation',
                        sourcePath: 'Knowledge_Base/optics/foundation.md',
                        title: 'Foundation Note',
                        snippet: 'Foundation note stabilizes the optics chain.',
                        startLine: 4,
                        endLine: 4,
                        score: 0.94,
                    },
                ],
            }),
            createKnowledgePoint({
                atomId: 'atom_ground',
                atomIds: ['atom_ground'],
                documentId: 'doc_ground',
                sourcePath: 'Knowledge_Base/optics/ground.md',
                title: 'Ground State',
                summary: 'Ground state is the target optical state.',
                evidenceSnippet: 'Ground state is the target optical state.',
                score: 0.91,
                citation: {
                    citationId: 'citation_ground',
                    atomId: 'atom_ground',
                    documentId: 'doc_ground',
                    sourcePath: 'Knowledge_Base/optics/ground.md',
                    title: 'Ground State',
                    snippet: 'Ground state is the target optical state.',
                    startLine: 8,
                    endLine: 8,
                    score: 0.91,
                },
                citations: [
                    {
                        citationId: 'citation_ground',
                        atomId: 'atom_ground',
                        documentId: 'doc_ground',
                        sourcePath: 'Knowledge_Base/optics/ground.md',
                        title: 'Ground State',
                        snippet: 'Ground state is the target optical state.',
                        startLine: 8,
                        endLine: 8,
                        score: 0.91,
                    },
                ],
            }),
            createKnowledgePoint({
                atomId: 'atom_application',
                atomIds: ['atom_application'],
                documentId: 'doc_application',
                sourcePath: 'Knowledge_Base/optics/application.md',
                title: 'Application Example',
                summary: 'Application example extends the ground state into execution.',
                evidenceSnippet: 'Application example extends the ground state into execution.',
                score: 0.73,
            }),
        ];
        const store = new InMemoryOpsStore(atoms, edges);

        const result = await assembleAgentConversationGraphContext({
            message: 'how to calibrate ground state',
            usedScope: globalScope,
            knowledgePoints,
            store,
        });

        expect(result.knowledgePoints[0].title).toBe('Ground State');
        expect(result.graphContext).not.toBeNull();
        expect(result.graphContext).toEqual(expect.objectContaining({
            anchorAtomId: 'atom_ground',
            anchorTitle: 'Ground State',
            evidenceSourceRefs: expect.arrayContaining([
                'Knowledge_Base/optics/foundation.md:4',
                'Knowledge_Base/optics/ground.md:8',
            ]),
            diagnostics: expect.objectContaining({
                graphOpsAvailable: true,
                selectedAnchorReason: 'title_mention',
                candidateCount: 3,
            }),
        }));
        expect((result.graphContext as any).connectionPaths).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceTitle: 'Foundation Note',
                targetTitle: 'Ground State',
                pathTitles: ['Foundation Note', 'Bridge Layer', 'Ground State'],
            }),
        ]));
        expect((result.graphContext as any).predecessorWindow).toEqual(expect.arrayContaining([
            expect.objectContaining({
                atomId: 'atom_bridge',
                title: 'Bridge Layer',
                relationKind: 'reference',
            }),
        ]));
        expect((result.graphContext as any).successorWindow).toEqual(expect.arrayContaining([
            expect.objectContaining({
                atomId: 'atom_application',
                title: 'Application Example',
                relationKind: 'sequence',
            }),
        ]));
    });

    test('filters anchor-equivalent graph neighbors before reporting windows and local degree', async () => {
        const atoms: KnowledgeAtom[] = [
            createAtom({
                id: 'atom_water_glass',
                stableKey: 'water_glass',
                title: 'Water Glass',
            }),
            createAtom({
                id: 'atom_water_glass_alias',
                stableKey: 'water_glass_alias',
                title: 'Water Glass',
            }),
            createAtom({
                id: 'atom_container_physics',
                stableKey: 'container_physics',
                title: 'Container Physics',
            }),
            createAtom({
                id: 'atom_mathematical_basis',
                stableKey: 'mathematical_basis',
                title: 'Mathematical Basis',
            }),
        ];
        const edges: RelationEdge[] = [
            {
                id: 'edge_anchor_self',
                sourceAtomId: 'atom_water_glass',
                targetAtomId: 'atom_water_glass',
                relationKind: 'reference',
                provenance: 'fact',
                confidence: 0.99,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-06-17T00:00:00.000Z',
                },
            },
            {
                id: 'edge_alias_anchor',
                sourceAtomId: 'atom_water_glass_alias',
                targetAtomId: 'atom_water_glass',
                relationKind: 'reference',
                provenance: 'fact',
                confidence: 0.98,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-06-17T00:00:00.000Z',
                },
            },
            {
                id: 'edge_container_anchor',
                sourceAtomId: 'atom_container_physics',
                targetAtomId: 'atom_water_glass',
                relationKind: 'prerequisite',
                provenance: 'fact',
                confidence: 0.92,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-06-17T00:00:00.000Z',
                },
            },
            {
                id: 'edge_anchor_math',
                sourceAtomId: 'atom_water_glass',
                targetAtomId: 'atom_mathematical_basis',
                relationKind: 'sequence',
                provenance: 'fact',
                confidence: 0.9,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-06-17T00:00:00.000Z',
                },
            },
            {
                id: 'edge_anchor_math_duplicate',
                sourceAtomId: 'atom_water_glass',
                targetAtomId: 'atom_mathematical_basis',
                relationKind: 'reference',
                provenance: 'fact',
                confidence: 0.82,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-06-17T00:00:00.000Z',
                },
            },
        ];
        const store = new InMemoryOpsStore(atoms, edges);
        const knowledgePoints: AgentConversationKnowledgePoint[] = [
            createKnowledgePoint({
                atomId: 'atom_water_glass',
                atomIds: ['atom_water_glass'],
                documentId: 'doc_water_glass',
                sourcePath: 'Knowledge_Base/waterglass/water-glass.md',
                title: 'Water Glass',
                summary: 'A water glass is a physical system made of a transparent container and water.',
                evidenceSnippet: 'A water glass is a physical system made of a transparent container and water.',
                score: 0.96,
            }),
        ];

        const result = await assembleAgentConversationGraphContext({
            message: 'what is waterglass?',
            usedScope: globalScope,
            knowledgePoints,
            store,
            budget: {
                maxPredecessors: 3,
                maxSuccessors: 3,
            },
        });

        expect((result.graphContext as any)?.predecessorWindow).toEqual([
            expect.objectContaining({
                atomId: 'atom_container_physics',
                title: 'Container Physics',
                relationKind: 'prerequisite',
            }),
        ]);
        expect((result.graphContext as any)?.successorWindow).toEqual([
            expect.objectContaining({
                atomId: 'atom_mathematical_basis',
                title: 'Mathematical Basis',
                relationKind: 'sequence',
            }),
        ]);
        expect((result.graphContext as any)?.anchorGraphProfile).toEqual(expect.objectContaining({
            atomId: 'atom_water_glass',
            title: 'Water Glass',
            inDegree: 1,
            outDegree: 1,
        }));
    });

    test('builds graph windows from every atom grouped under the matched knowledge point', async () => {
        const atoms: KnowledgeAtom[] = [
            createAtom({
                id: 'atom_water_glass_heading',
                stableKey: 'water_glass_heading',
                title: 'Water Glass',
            }),
            createAtom({
                id: 'atom_water_glass_physics',
                stableKey: 'water_glass_physics',
                title: 'Water Glass Physics',
            }),
            createAtom({
                id: 'atom_material_science',
                stableKey: 'material_science',
                title: 'Material Science',
            }),
            createAtom({
                id: 'atom_thermal_model',
                stableKey: 'thermal_model',
                title: 'Thermal Model',
            }),
        ];
        const edges: RelationEdge[] = [
            {
                id: 'edge_material_to_secondary',
                sourceAtomId: 'atom_material_science',
                targetAtomId: 'atom_water_glass_physics',
                relationKind: 'prerequisite',
                provenance: 'fact',
                confidence: 0.93,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-06-17T00:00:00.000Z',
                },
            },
            {
                id: 'edge_secondary_to_thermal',
                sourceAtomId: 'atom_water_glass_physics',
                targetAtomId: 'atom_thermal_model',
                relationKind: 'sequence',
                provenance: 'fact',
                confidence: 0.91,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-06-17T00:00:00.000Z',
                },
            },
        ];
        const knowledgePoints: AgentConversationKnowledgePoint[] = [
            createKnowledgePoint({
                atomId: 'atom_water_glass_heading',
                atomIds: ['atom_water_glass_heading', 'atom_water_glass_physics'],
                documentId: 'doc_water_glass',
                sourcePath: 'Knowledge_Base/waterglass/water-glass.md',
                title: 'Water Glass',
                summary: 'A water glass is a physical system made of a transparent container and water.',
                evidenceSnippet: 'A water glass is a physical system made of a transparent container and water.',
                score: 0.96,
            }),
        ];

        const result = await assembleAgentConversationGraphContext({
            message: 'what is waterglass?',
            usedScope: globalScope,
            knowledgePoints,
            store: new InMemoryOpsStore(atoms, edges),
            budget: {
                maxPredecessors: 3,
                maxSuccessors: 3,
            },
        });

        expect((result.graphContext as any)?.predecessorWindow).toEqual([
            expect.objectContaining({
                atomId: 'atom_material_science',
                title: 'Material Science',
                relationKind: 'prerequisite',
            }),
        ]);
        expect((result.graphContext as any)?.successorWindow).toEqual([
            expect.objectContaining({
                atomId: 'atom_thermal_model',
                title: 'Thermal Model',
                relationKind: 'sequence',
            }),
        ]);
        expect((result.graphContext as any)?.anchorGraphProfile).toEqual(expect.objectContaining({
            atomId: 'atom_water_glass_heading',
            inDegree: 1,
            outDegree: 1,
        }));
    });

    test('prioritizes structural graph neighbors over bibliography-style reference successors for definition answers', async () => {
        const atoms: KnowledgeAtom[] = [
            createAtom({
                id: 'atom_water_glass_heading',
                stableKey: 'water_glass_heading',
                title: 'Water Glass',
            }),
            createAtom({
                id: 'atom_water_glass_thermal',
                stableKey: 'water_glass_thermal',
                title: 'Thermodynamics',
            }),
            createAtom({
                id: 'atom_core_concepts',
                stableKey: 'core_concepts',
                title: 'Core Concepts and Mathematical Basis',
            }),
            createAtom({
                id: 'atom_references',
                stableKey: 'references',
                title: 'References',
            }),
        ];
        const edges: RelationEdge[] = [
            {
                id: 'edge_thermal_references',
                sourceAtomId: 'atom_water_glass_thermal',
                targetAtomId: 'atom_references',
                relationKind: 'reference',
                provenance: 'fact',
                confidence: 0.99,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-06-17T00:00:00.000Z',
                },
            },
            {
                id: 'edge_heading_core_concepts',
                sourceAtomId: 'atom_water_glass_heading',
                targetAtomId: 'atom_core_concepts',
                relationKind: 'sequence',
                provenance: 'fact',
                confidence: 0.71,
                evidenceSpanIds: [],
                temporal: {
                    validFrom: '2026-06-17T00:00:00.000Z',
                },
            },
        ];
        const knowledgePoints: AgentConversationKnowledgePoint[] = [
            createKnowledgePoint({
                atomId: 'atom_water_glass_heading',
                atomIds: ['atom_water_glass_heading', 'atom_water_glass_thermal'],
                documentId: 'doc_water_glass',
                sourcePath: 'Knowledge_Base/waterglass/water-glass.md',
                title: 'Water Glass',
                summary: 'A water glass is a physical system made of a transparent container and water.',
                evidenceSnippet: 'A water glass is a physical system made of a transparent container and water.',
                score: 0.96,
            }),
        ];

        const result = await assembleAgentConversationGraphContext({
            message: 'what is waterglass?',
            usedScope: globalScope,
            knowledgePoints,
            store: new InMemoryOpsStore(atoms, edges),
            budget: {
                maxPredecessors: 3,
                maxSuccessors: 1,
            },
        });

        expect((result.graphContext as any)?.successorWindow).toEqual([
            expect.objectContaining({
                atomId: 'atom_core_concepts',
                title: 'Core Concepts and Mathematical Basis',
                relationKind: 'sequence',
            }),
        ]);
        expect((result.graphContext as any)?.successorWindow).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                atomId: 'atom_references',
                title: 'References',
            }),
        ]));
        expect((result.graphContext as any)?.anchorGraphProfile).toEqual(expect.objectContaining({
            atomId: 'atom_water_glass_heading',
            outDegree: 2,
        }));
    });

    test('fails open to retrieval-shaped graph context when graph ops are unavailable', async () => {
        const knowledgePoints: AgentConversationKnowledgePoint[] = [
            createKnowledgePoint({
                atomId: 'atom_generic',
                atomIds: ['atom_generic'],
                documentId: 'doc_generic',
                sourcePath: 'Knowledge_Base/notes/generic.md',
                title: 'Generic Note',
                summary: 'Generic note is broad and highly connected.',
                evidenceSnippet: 'Generic note is broad and highly connected.',
                score: 0.92,
            }),
            createKnowledgePoint({
                atomId: 'atom_ground',
                atomIds: ['atom_ground'],
                documentId: 'doc_ground',
                sourcePath: 'Knowledge_Base/notes/ground.md',
                title: 'Ground State',
                summary: 'Ground state is the target optical state.',
                evidenceSnippet: 'Ground state is the target optical state.',
                score: 0.84,
                citation: {
                    citationId: 'citation_ground',
                    atomId: 'atom_ground',
                    documentId: 'doc_ground',
                    sourcePath: 'Knowledge_Base/notes/ground.md',
                    title: 'Ground State',
                    snippet: 'Ground state is the target optical state.',
                    startLine: 11,
                    endLine: 11,
                    score: 0.84,
                },
                citations: [
                    {
                        citationId: 'citation_ground',
                        atomId: 'atom_ground',
                        documentId: 'doc_ground',
                        sourcePath: 'Knowledge_Base/notes/ground.md',
                        title: 'Ground State',
                        snippet: 'Ground state is the target optical state.',
                        startLine: 11,
                        endLine: 11,
                        score: 0.84,
                    },
                ],
            }),
        ];

        const result = await assembleAgentConversationGraphContext({
            message: 'explain ground state',
            usedScope: globalScope,
            knowledgePoints,
            store: null,
        });

        expect(result.knowledgePoints[0].title).toBe('Ground State');
        expect(result.graphContext).toEqual(expect.objectContaining({
            anchorTitle: 'Ground State',
            evidenceSourceRefs: ['Knowledge_Base/notes/ground.md:11'],
            diagnostics: expect.objectContaining({
                graphOpsAvailable: false,
                usedFallback: true,
                selectedAnchorReason: 'title_mention',
            }),
        }));
        expect((result.graphContext as any).connectionPaths || []).toEqual([]);
        expect((result.graphContext as any).predecessorWindow || []).toEqual([]);
        expect((result.graphContext as any).successorWindow || []).toEqual([]);
    });
});
