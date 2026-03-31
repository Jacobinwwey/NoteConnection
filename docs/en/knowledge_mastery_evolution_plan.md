# 2026-03-31 v1.7.0 - Knowledge Mastery Evolution Plan

## Purpose

This plan solidifies the next-stage evolution of NoteConnection from a "knowledge visualization system" into a local-first "knowledge parsing + mastery loop + divergence thinking + pluggable LLM tutor" platform.

This document is implementation-facing and decision-complete for the next 6-9 months.

## Locked Product Decisions

1. Deployment priority: local-first and privacy-preserving by default.
2. Learning objective: dual-core strategy, mastery closure + divergence thinking.
3. LLM strategy: pluggable adapter for both local and cloud models.
4. Graph backbone: introduce a local graph database as advanced engine.
5. Delivery cadence: three phases in 6-9 months.
6. Primary success metric: mastery improvement.

## Core Terms

1. Knowledge Atom: smallest independently assessable unit of knowledge.
2. Evidence Span: traceable source segment backing a knowledge atom.
3. Relation Edge: prerequisite/analogy/contrast/causal/application relationship between atoms.
4. Temporal Evolution: versioned state change and validity window of atoms and relations.
5. Mastery State: observable probability of user mastery per atom.
6. Divergence Graph: graph of cross-domain expansion around a current topic.
7. Learning Action: executable next step (quiz, explanation, analysis, reflection, transfer task).

## Layered Architecture and Contracts

### L0 Representation Layer

- Parse Markdown, code blocks, formulas, and Mermaid blocks into `KnowledgeAtom + EvidenceSpan`.
- Every atom must keep source provenance for explainable retrieval.

### L1 Structure Layer

- Build static graph, process graph, and temporal graph from atoms and relation edges.
- Distinguish fact edges from inferred edges to prevent path hallucination.

### L2 Retrieval Layer

- Hybrid retrieval: keyword + vector + graph traversal + temporal filtering.
- Every answer must include evidence, relation path, and temporal validity.

### L3 Learning Layer

- Decide next learning action using `MasteryState + DivergenceGraph`.
- Do not consume raw black-box LLM output without evidence binding.

### L4 Interaction Layer

- Provide learning workspace + tutor action APIs + evaluation feedback loop.
- Support local model and cloud model through one adapter contract.

### L5 Governance Layer

- Enforce freshness checks, API contracts, rollback switches, quality gates, and privacy boundaries.
- Gate the full chain from L0 through L4.

## External Strategy Absorption

1. Fast-GraphRAG: absorb stateful insertion/query and high-speed local retrieval pipeline.
2. LightRAG: absorb dual-level retrieval and incremental update orientation.
3. Graphiti: absorb temporal knowledge graph concepts for evolving context.
4. Neo4j GraphRAG: absorb graph-driven explainable retrieval patterns and tool contract discipline.
5. MemOS: absorb layered memory policy (session/unit/long-term) and memory scheduling.
6. GitNexus: absorb process-context, staleness discipline, and agent-consumable interface patterns.

### Explicit Non-goals for v1

1. No cloud-first multi-tenant architecture.
2. No deep distributed complexity at v1.
3. No direct one-to-one reuse of code intelligence patterns as learning intelligence.

## 3-Phase Delivery Blueprint (6-9 Months)

### Phase 1 (Weeks 1-8): Deep Parsing + Graph Backbone

1. Build unified parser pipeline for `KnowledgeAtom + EvidenceSpan`.
2. Introduce local graph database as advanced engine, keep lightweight path for compatibility.
3. Implement temporal model for atom/relation versioning and validity.
4. Add staleness detection by source hash binding.
5. Deliverables:
   - Incremental rebuildable knowledge graph service.
   - Evidence-traceable query interface.
   - Temporal validity annotations.

### Phase 2 (Weeks 9-16): Mastery Loop + Divergence Engine

1. Introduce `LearnerConceptState` per atom (mastery, error tags, retest outcomes).
2. Build mastery closure loop: diagnose -> classify errors -> personalized practice -> retest update.
3. Build divergence engine for same-level expansion, cross-level transfer, and counter-example exploration.
4. Support dual output paths: `MasteryPath[]` and `DivergencePath[]`.
5. Deliverables:
   - Learning path orchestrator.
   - Error taxonomy knowledge base.
   - Dual-core learning panel.

### Phase 3 (Weeks 17-36): Pluggable LLM Tutor + Memory OS

1. Build unified LLM adapter for local and cloud providers.
2. Implement tutor actions: quiz generation, probing questions, answer analysis, misconception diagnosis, transfer-task generation, recap synthesis.
3. Implement layered memory: session memory, unit memory, long-term mastery memory.
4. Add safety guardrails: evidence-first responses, source traceability, confidence-based downgrade.
5. Deliverables:
   - LLM tutor orchestration layer.
   - Memory policy engine.
   - Learning quality dashboard.

## Public Interfaces and Types (Must Implement)

### Public APIs

1. `KnowledgeIngestAPI`
   - Input: document payload + incremental change metadata.
   - Output: atom/evidence/relation/temporal metadata.
2. `KnowledgeQueryAPI`
   - Unified retrieval entry with evidence-first response contract.
3. `MasteryDiagnosticsAPI`
   - Input: learner answer/behavior events.
   - Output: mastery updates + error labels.
4. `LearningPathAPI`
   - Output: prioritized `MasteryPath[]` and `DivergencePath[]`.
5. `TutorActionAPI`
   - Unified tutor action contract (ask/analyze/feedback/recap).
6. `MemoryPolicyAPI`
   - Session/unit/long-term memory write and eviction policy management.

### New Core Types

- `KnowledgeAtom`
- `EvidenceSpan`
- `RelationEdge`
- `TemporalEdge`
- `LearnerConceptState`
- `LearningAction`
- `TutorTrace`

## Quality Gates and Acceptance

### Core Test Areas

1. Parsing correctness: atom extraction, evidence alignment, relation consistency.
2. Retrieval trust: evidence traceability, path explainability, temporal validity hit rate.
3. Learning effectiveness: mastery uplift, misconception recurrence decline, retest pass-rate uplift.
4. Divergence quality: cross-topic linkage quality, counter-example quality, transfer-task quality.
5. Performance: p95 query latency and rebuild duration at 10k atom scale.
6. Privacy/security: no external leakage by default, model-call auditability, boundary enforcement.

### v1.5 Acceptance Thresholds

1. Retest pass-rate uplift >= 20%.
2. High-frequency misconception recurrence reduction >= 25%.
3. Evidence-backed learning suggestion ratio >= 90%.
4. Path effectiveness significantly better than random baseline.
5. Key p95 interactions remain at interactive latency and gates stay green.

## First-Principles Explanation

1. Learning is a state-estimation + intervention-control problem, not only a content presentation problem.
2. Without atomization, mastery cannot be measured or improved robustly.
3. Without explainable retrieval, feedback loops are not trustworthy.
4. Without temporal and memory layers, forgetting and transfer cannot be modeled correctly.
5. Without governance gates, quality drifts and model hallucinations will erode learning reliability.

## Mental Models and Common Pitfalls

### Mental Models

1. State-space loop: `Knowledge State -> Observation -> Update -> Policy`.
2. Dual-objective optimization: mastery gain and divergence quality under explicit constraints.
3. Evidence-first orchestration: every tutor action must map to source evidence and relation path.
4. Layered memory: separate short-term interaction memory from long-term mastery memory.
5. Controlled evolution: each capability expansion is contract-tested and gate-verified.

### Common Pitfalls

1. Optimizing vector recall only without graph and evidence chains.
2. Treating raw LLM output as ground truth.
3. Recommending paths without updating mastery state and retest loops.
4. Pursuing full-modality scope too early and increasing architecture risk.
5. Ignoring local privacy and auditability until late-stage.

## 5-Point Summary

1. The direction shift to a verifiable learning system is feasible and strategically sound.
2. Local-first plus graph-database backbone is foundational for long-term capability ceiling.
3. Dual-core value requires mastery loop and divergence engine to be implemented together.
4. Pluggable LLM works only when built on evidence-first retrieval and layered memory.
5. A 6-9 month phased roadmap can generate measurable value while controlling risk.

## References

1. GitNexus: <https://github.com/abhigyanpatwari/GitNexus>
2. Fast-GraphRAG: <https://github.com/circlemind-ai/fast-graphrag>
3. LightRAG: <https://github.com/HKUDS/LightRAG>
4. Graphiti: <https://github.com/getzep/graphiti>
5. Neo4j GraphRAG Python: <https://github.com/neo4j/neo4j-graphrag-python>
6. MemOS: <https://github.com/MemTensor/MemOS>
7. Neo4j GraphRAG Docs: <https://neo4j.com/docs/neo4j-graphrag-python/current/>
