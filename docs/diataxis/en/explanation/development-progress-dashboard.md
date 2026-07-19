# Explanation: Development Progress Dashboard

This page is the implementation-facing dashboard for the Knowledge Mastery evolution plan.
It tracks what is already implemented, where the hard gaps remain, and how to verify progress from code and runtime behavior.

## 2026-07-18 Coverage-driven Follow-up Phase Closure

The remaining answer-planning risks now have executable owners: multilingual concept/polarity matching plus a 24-case calibration report, novelty-aware same-role suppression and discourse ordering, an explicit-only one-step graph expansion policy with replay trace, and an operator-only Grounding Inspector projection. Ordinary `explain` requests no longer silently activate the deep profile.

The orchestration owner remains intentionally unchanged. Extracting `KnowledgeLearningPlatform.ts` is still unjustified until a new owner can enforce the complete planned/reviewed-answer operation rather than forward intermediate values. Verification passed 122/122 Jest suites and 1,145 tests (26 skipped), production/Vite builds, Diataxis/MkDocs gates, and the hardened Water Glass runtime acceptance.

## 2026-07-11 Coverage-driven Graph Answer Planning Closure

The answer pipeline has moved from sentence-budgeted graph-aware RAG to a typed coverage-driven planning contract. `graphContextAssembler.ts` still owns bounded candidate-subgraph selection; `graphAnswerPlan.ts` maps grouped anchor spans and evidenced graph neighbors to semantic claims; `graphAnswerCoverage.ts` verifies required claims; `conversationComposer.ts` realizes the answer; and `answerReleaseReview.ts` enforces grounding, graph consistency, temporal, citation, leakage, and plan-coverage gates without character or sentence ceilings.

Compared with the earlier alternatives: Scheme A budget tuning is retained only as bounded evidence-candidate control, not as answer completeness; Scheme B is implemented across response, trace, knowledge-run artifact, and export; Scheme C iterative agent expansion remains deliberately deferred to explicit deep/research requests. The largest remaining risks are multilingual role inference, lexical coverage false positives/negatives, novelty-aware discourse ordering, and the oversized orchestration owner in `KnowledgeLearningPlatform.ts`.

Verification evidence: 119/119 suites passed, 1,127 tests passed, 26 skipped; the focused answer-quality matrix passed 177/177; TypeScript, production build, and Water Glass runtime acceptance passed. The authoritative implementation and next-direction comparison is [Coverage-driven Graph Answer Planning](../../../plans/2026-07-11-coverage-driven-graph-answer-planning.md).

## 2026-07-05 RSE Document-Augmented Graph RAG Implementation Plan

This slice now tracks implementation progress for richer Knowledge Workspace answers. The concrete plan remains at [RSE document-augmented graph RAG answer pipeline](../../../plans/2026-07-05-001-feat-rse-document-augmented-rag-plan.md), but the branch has moved beyond planning: the deterministic RSE/document-augmentation path, full-document graph-neighbor augmentation, query-intent graph-neighbor ranking, intent-aware graph connection-path ordering, intent-aligned graph-window ambiguity filtering, budgeted context pack, stable RAG context replay ids, provider-backed sufficiency trace, bounded one-step recovery, RAG failure-stage classification, RAG-aware one-message release review, claim-level citation-backed RAG release gating, prompt/preamble artifact filtering for public RAG clauses, answer claim-to-citation trace/export mapping, operand-aware compare answer-profile budgeting, how-to answer-profile budgeting, causal answer-profile budgeting, generic answer-profile ranking, profile-specific release-completeness signals for how-to and causal answers, Mermaid-label evidence extraction, source-label stripping for public RAG clauses, runtime verifier fields, graph successor-window and graph-diagnostics verifier assertions, context-budget truncation/drop/malformed-provider/timeout-provider/graphintent probe coverage, conflicting adjacent, same-section non-adjacent, cross-document structured measurement/date/location/quantity evidence including plural unitless quantity facts, same-document and cross-document controlled ownership identity conflicts, controlled endpoint/dependency/semantic-version/service-port/response-status-code conflicts, full-document remote-scan hard-negative coverage, controlled current-vs-historical, environment-qualified, version-qualified, and platform-qualified false-positive guards including condition-scoped ownership identity plus cross-document condition-scoped endpoint/format/protocol interface facts, dependency facts, semantic-version facts, service-port facts, and response-status-code facts, scoped graph-neighbor RAG evidence filtering, single- and multi-neighbor graph source-unavailable hard-negative coverage, localized frontend RAG status, and export RAG trace preservation are implemented. Calibrated graph-confidence thresholds, broader replay tooling over larger corpora, deeper synthesis beyond deterministic source-label stripping, further profile/corpus-specific release-budget calibration, broader semantic conflict classes, and larger runtime probes remain follow-up work.

Current code-vs-plan reading:

| Requirement / prior expectation | Current branch evidence | Progress call |
|---|---|---|
| RSE should start from precise hit spans rather than broad documents | `src/learning/queryBackend.ts` and `src/learning/KnowledgeLearningPlatform.ts` already return evidence spans, citations, relation paths, query variants, and scoped recovery trace data. `src/learning/evidenceContextAssembler.ts` now starts from those spans instead of whole-document dumping. | Implemented deterministic path |
| Document augmentation should recover enough surrounding source context to answer fully | `evidenceContextAssembler.ts` now reads the full selected source document through a platform boundary, preserves direct support, adds parent/adjacent context, dedupes overlapping windows, emits full-document-aware graph-neighbor support fragments, and marks `source_window_unavailable` when it cannot recover source text. | Implemented deterministic path |
| Graph context should use in-degree/out-degree and neighbor content, not only neighbor titles | `KnowledgeLearningPlatform.agentConversation()` now materializes selected graph-neighbor items and lets the evidence assembler produce both snippet-level and full-document-aware `graph_neighbor_support` fragments. `graphContextAssembler.ts` now ranks predecessor/successor windows and connection paths with query-intent scoring policies, relation-kind priority, confidence/provenance scoring, anchor-equivalent filtering, bibliography exclusion, and intent-aligned ambiguity filtering before evidence assembly. Compare windows prefer `contrast` / `analogy` neighbors when present, fail open to structural neighbors only when no aligned candidate exists, and expose aligned/misaligned candidate diagnostics. | Implemented deterministic path; larger-corpus calibration remains |
| The answer should be one visible message while orchestration stays in backend | `conversationComposer.ts` now passes `ragContextPack` and `ragSufficiencyReview` into `answerReleaseReview.ts`; release review can revise or enrich a public answer from direct, document, and graph fragments while keeping orchestration in trace/status surfaces, and `rag_claim_citation_support` now contracts drafts when sentence-level public claims are unsupported or only weakly covered by citation-backed RAG fragments. Compare-intent RAG answers now extract operands, keep explicit scope from being hard-narrowed to only title-hit document ids, let the initial draft keep multiple direct-support clauses for both sides, rank evidence by operand/fragment coverage, filter procedure-like evidence from public compare answers unless the query itself is procedural, and turn Mermaid comparison labels into readable evidence before graph contrast context is added. How-to answers now reserve direct/document/graph budget for ordered steps, prerequisites, downstream checks, and failure handling instead of collapsing to a generic overview. Generic answers now use query-term coverage ranking and two direct-support slots so broad prompts keep the most relevant grounded clauses instead of generic preambles. `ragPublicText.ts` strips source-authored labels such as `Prerequisite:`, `Mechanism:`, `Graph caveat:`, and `Failure mode:` from the public answer while preserving `Step 1:`-style step numbers and the original trace fragments. `answerReleaseReview.ts` now extends `rag_answer_completeness` with how-to and causal profile signals, so drafts that omit pack-backed prerequisites, failure handling, mechanisms, consequences, or boundaries are revised through profile-aware direct/document/graph clause budgets. `KnowledgeLearningPlatform.ts` now records optional `answerClaimCitations` that map public-answer claims to citation ids, RAG fragment ids, and source paths for trace/export auditing, while `agent_workspace.js` / `workspace_panes.js` show compact status rather than extra chat messages. | Preserved and strengthened |
| LLM judging should improve answer completeness | `ragSufficiencyJudge.ts` has deterministic gates plus an injected optional LLM judge hook. `ragSufficiencyProviderJudge.ts` now adapts the existing `LlmProviderClient` / NoteMD settings boundary with strict JSON parsing, timeout, no retries, and deterministic fallback through the reviewer catch path; malformed completion text now rejects at the adapter boundary so `llm_judge_failed:*` remains replayable. `KnowledgeLearningPlatform.agentConversation()` now performs at most one bounded recovery assembly/review pass when the first pack is recoverably borderline or insufficient. | Implemented for Unit 5 |
| Weak evidence should degrade explicitly | `RagSufficiencyReview` now records `sufficient`, `borderline`, or `insufficient` plus degradation states such as `partial_coverage`, `conflict`, and `insufficient_evidence`; `evidenceContextAssembler.ts` now emits a `conflict` fragment for same-subject measurement, unitless quantity/limit, date/year, explicit state/status, controlled location, controlled ownership identity, controlled endpoint, controlled dependency, controlled semantic-version, controlled service-port, or controlled response-status-code evidence with divergent values when those facts are adjacent or non-adjacent inside the same scoped section. `KnowledgeLearningPlatform.ts` now filters RAG graph-neighbor items against the resolved conversation scope before evidence assembly, so scope-external graph neighbors cannot inject conflict evidence or force false `partial_coverage` degradation. In-scope graph-neighbor source-window misses still retain graph-neighbor role provenance, and `ragSufficiencyJudge.ts` degrades graph context when the neighbor has only a direct span but no recoverable source window. `KnowledgeLearningPlatform.ts` classifies the resulting states under `context_assembly` or `graph_evidence` as appropriate. The frontend evidence pane displays the compact state. | Implemented for deterministic review; broader semantic classes remain open |

Architecture ownership now has a sharper split:

- `queryBackend.ts` remains the precise RSE and hybrid-ranking owner.
- `evidenceContextAssembler.ts` owns source-window, parent-section, adjacent-context, full-document source-boundary reading, graph-neighbor source expansion, and missing-source degradation.
- `ragContextPack.ts` owns model-visible hard caps, role priority, middle truncation, budget decisions, and stable replay ids for selected evidence packs.
- `ragSufficiencyJudge.ts` owns deterministic sufficiency and optional judge integration points.
- `ragSufficiencyProviderJudge.ts` owns the NoteMD provider adapter for bounded JSON-only sufficiency review.
- `KnowledgeLearningPlatform.ts` wires source resolution, graph-neighbor materialization, one-step RAG recovery, failure-stage classification, answer claim-to-citation trace mapping, trace/artifact persistence, and conversation response assembly.
- `conversationComposer.ts` owns the one-message public answer draft from the structured pack.
- `answerReleaseReview.ts` owns public-surface contraction, RAG answer completeness, claim-level citation-backed RAG release gating, prompt/preamble artifact filtering, and final public-answer revision.
- `agent_workspace.js` and `workspace_panes.js` expose localized compact RAG health in the API status/evidence surfaces without rendering raw fragments in the chat.

The key correction remains unchanged: "five paragraphs before and after the hit" is a local expansion heuristic, not the source-reading maximum. The maximum source boundary is the complete scoped document for each selected direct or graph-neighbor knowledge point; the hard cap belongs to the model-visible `RagContextPack`. The implemented path follows that small-to-big shape: direct span first, full-document-aware parent/adjacent context selection, then full-document-aware graph-neighbor evidence when graph context provides usable ids.

Fresh implementation evidence in this slice:

- New modules: `src/learning/evidenceContextAssembler.ts`, `src/learning/ragContextPack.ts`, `src/learning/ragSufficiencyJudge.ts`, `src/learning/ragSufficiencyProviderJudge.ts`, `src/learning/ragPublicText.ts`.
- New/updated tests: evidence assembler, context pack budgeter, stable context replay ids, sufficiency judge, provider-backed sufficiency judge adapter, bounded recovery, RAG failure-stage classification, answer claim-to-citation trace mapping, RAG-aware claim release gating, RAG-aware release review, persistence compatibility, composer, platform integration, export RAG trace preservation, Knowledge Workspace conversation regression, runtime verifier validation, and frontend RAG grounding display.
- `scripts/verify-knowledge-workspace-runtime.js` can now validate expected RAG source boundary, valid `ragctx_*` replay ids, roles, answer terms, sufficiency statuses, deterministic/no-provider judge flags, recovery flags, degradation states, required RAG failure stages, minimum RAG source-decision status counts, source-decision reason fragments, sufficiency reason fragments, minimum full-document fragment counts by role, recovery-before source-decision status counts, recovery-before reason fragments, and graph successor-window expectations; it also supports per-case scoped document-id expectations, per-case `topK`, isolated temporary NoteMD config, local malformed-provider fixtures, path-scoped source-unavailable fixtures, strict-by-default behavior, and case-insensitive answer-term matching.
- `src/frontend/agent_workspace.js` marks RAG-only trace payloads inspectable; the API status line now reports localized recovered/degraded RAG state plus fragment count rather than raw `sufficient+recovered` tokens.
- `src/frontend/workspace_panes.js` shows localized compact RAG context metrics: replay id, evidence status summary, sufficiency, source boundary, fragment budget, direct/document/graph roles, truncated/dropped/unavailable source counts, degradation, recovery, reasons, and failure stages.
- `src/learning/KnowledgeLearningPlatform.ts` now emits optional `answerClaimCitations` records for final public-answer claims, and `src/export/WorkspaceExportBundle.ts` deep-clones those records so replay/export consumers can inspect citation, fragment, and source-path grounding without exposing orchestration in chat.
- `src/learning/answerReleaseReview.ts` now enforces `rag_claim_citation_support`, so sentence-level public RAG claims must be supported by citation-backed fragments before release; unsupported or weakly covered claims trigger the existing RAG-grounded revision path.
- `src/learning/answerReleaseReview.ts` now filters prompt/preamble artifacts such as "all reasoning" or "final output language" from RAG-grounded public clause selection before revision.
- `src/learning/ragPublicText.ts` now centralizes public RAG source-label stripping for both composer drafts and release-review revisions, keeping source-authored labels out of the one visible answer while leaving raw fragments available in trace/artifacts.
- `src/learning/answerReleaseReview.ts` now adds profile-specific completeness signals to the existing `rag_answer_completeness` gate for how-to and causal answers; missing prerequisites/failure handling or downstream consequence evidence triggers a RAG-grounded revision using profile-aware evidence budgets.
- The compact and spaced `waterglass` runtime probes now require failed release gates to include both `query_intent_alignment` and `rag_claim_citation_support`, and they reject prompt/preamble artifacts such as `所有推理过程`, `最终输出`, `遵从您的指示`, `all reasoning`, and `final output` from the public answer.
- `src/learning/graphContextAssembler.ts` now applies intent-specific graph-window and connection-path scoring: compare queries can prefer contrast/analogy neighbors over procedural sequence/application paths even when the procedural edge has higher confidence, while definition and how-to queries keep their own structural priorities.
- `src/learning/KnowledgeLearningPlatform.ts` now recognizes compare operands across `compare X and/with/to Y`, `X vs Y`, `difference between X and Y`, and `X differs from Y` patterns without constraining an explicit scope to title-hit document ids only.
- `src/learning/conversationComposer.ts` now applies a compare RAG answer profile that keeps four direct-support clauses when the pack contains evidence for both compared sides, ranks compare evidence by operand and query-term coverage, converts Mermaid label evidence into readable clauses, and then adds bounded graph-neighbor contrast context without emitting extra chat messages.
- `src/learning/conversationComposer.ts` now applies a how-to RAG answer profile that keeps three direct-support sentences, one document-context sentence, and two graph-neighbor sentences so procedure answers can retain steps, prerequisites, downstream verification, and failure handling in one bounded public answer.
- `src/learning/conversationComposer.ts` now applies a generic RAG answer profile that ranks direct evidence by query-term coverage and avoids selecting zero-signal preamble sentences solely because they share a fragment with better evidence.
- The runtime probe `waterglass_compare_materials_en` now verifies that `compare water glass and plastic cup` returns both glass and plastic evidence from `Knowledge_Base/waterglass/water glass.md` with `full_document` source boundary and direct/document/graph roles.
- The runtime probe `contextbudget_source_window_truncation_en` now verifies that `what is context budget probe?` reads the scoped full source document from `Knowledge_Base/contextbudget/context budget probe.md` while recording a `fragment_truncated` source decision in the model-visible `RagContextPack`.
- The runtime probe `contextoverflow_no_provider_budget_drop_en` now verifies that `what is overflow budget probe?` stays deterministic without an LLM judge and records `fragment_dropped` in the final bounded `RagContextPack`; recovery source-decision counts are preserved in `ragRecovery` when recovery actually occurs.
- The runtime probe `contextoverflow_malformed_provider_judge_fallback_en` now verifies that a local malformed OpenAI-compatible judge response does not block the answer path: the fixture is called once, the first review records `llm_judge_failed` in `ragRecovery.beforeReasons`, and the recovered answer remains deterministic and bounded.
- The runtime probe `contextoverflow_timeout_provider_judge_fallback_en` now verifies that a delayed local OpenAI-compatible judge response times out through the bounded provider-judge path: the fixture is called once, `ragRecovery.beforeReasons` records `llm_judge_failed:RAG sufficiency judge timed out.`, and the final recovered answer remains deterministic and bounded.
- The runtime probe `contextoverflow_deep_profile_budget_en` now verifies explicit deep/explain requests use a wider first-pass RAG answer profile (`24` fragments, `1600` chars per fragment, `9000` total chars) while preserving the bounded `RagContextPack` contract and avoiding recovery-only budget expansion.
- The runtime probe `graphintent_compare_neighbor_selection_en` now verifies that `compare brittle glass vessel with polymer cup material behavior` selects analogy graph successors from `Knowledge_Base/graphintent`, excludes the high-overlap procedural successor from `successorWindow`, keeps `graph_neighbor_support`, includes at least one `full_document` graph-neighbor support fragment, and does not leak the procedural path into the public answer.
- The runtime probe `graphintent_missing_neighbor_source_window_en` now verifies that when selected graph-neighbor source paths are unavailable, direct graph-neighbor spans remain observable but do not satisfy graph evidence by themselves: source decisions include `source_resolver_returned_no_content:direct_support,graph_neighbor_support`, sufficiency stays `borderline/partial_coverage`, and failure classification includes both `parsing_source` and `graph_evidence`.
- The runtime probe `graphintent_multi_neighbor_source_loss_en` now requires two selected graph-neighbor source documents to be unavailable at once and asserts at least two `source_window_unavailable` decisions. The matching assembler test records both missing neighbor documents independently, so multi-document graph evidence loss remains replayable per neighbor.
- The runtime probe `conflicting_adjacent_evidence_probe_en`, backed by `Knowledge_Base/ragconflict/calibration tolerance conflict probe.md`, now verifies that adjacent `+/-0.10 mm` and `+/-0.50 mm` calibration-tolerance statements produce `direct_support`, `parent_context`, and `conflict` RAG roles, degrade sufficiency to `borderline/conflict`, and classify the issue under `context_assembly` instead of publishing one stable value.
- The runtime probe `conflicting_nonadjacent_section_evidence_probe_en`, backed by `Knowledge_Base/ragconflict/remote calibration tolerance conflict probe.md`, now verifies the same degradation for non-adjacent contradictory tolerance statements inside one scoped section, proving full-document augmentation does not flatten distant same-section conflicts into a single value.
- The runtime probe `conflicting_release_date_evidence_probe_en`, backed by `Knowledge_Base/ragdateconflict/release date conflict probe.md`, now verifies that same-section `2026-07-01` and `2026-08-15` release-date statements produce the same `conflict` RAG role and `borderline/conflict` degradation instead of publishing one stable schedule.
- The runtime probe `full_document_date_scan_remote_conflict_probe_en`, backed by `Knowledge_Base/ragdatefullscan`, now locks the corrected full-document source-reading boundary for release-date facts: matched opening spans can omit `2026-07-01` and `2026-08-15`, while both selected scoped documents are still read fully and remote appendix date facts produce bounded cross-document `conflict` evidence.
- The runtime probe `conflicting_state_status_evidence_probe_en`, backed by `Knowledge_Base/ragstateconflict`, now extends the conflict slice beyond measurement/date facts for a controlled categorical class: explicit status/state/mode facts with paired values such as `enabled` and `disabled` produce a `conflict` fragment, keep both sides visible in the one public answer, and degrade under `context_assembly`.
- The runtime probe `full_document_state_scan_remote_conflict_probe_en`, backed by `Knowledge_Base/ragstatefullscan`, now locks the corrected full-document source-reading boundary for controlled state/status facts: matched opening spans can omit `enabled` and `disabled`, while both selected scoped documents are still read fully and remote appendix status facts produce bounded cross-document `conflict` evidence.
- The runtime probe `temporal_scoped_state_status_probe_en`, backed by `Knowledge_Base/ragtemporalqualifier`, now verifies the opposite hard negative: explicitly current and historical state/status facts stay in separate comparable scopes, the public answer uses the current fact, and the RAG pack does not emit a false `conflict` fragment.
- The runtime probe `temporal_scoped_ownership_identity_probe_en`, backed by `Knowledge_Base/ragtemporalqualifier`, extends that current-vs-historical guard to controlled ownership identity facts: the current `Release Ops` owner and historical `Rollback Team` owner remain condition-qualified evidence rather than a false conflict.
- The runtime probe `temporal_scoped_release_date_probe_en`, backed by `Knowledge_Base/ragtemporalqualifier`, extends the same condition-qualified false-positive guard to release dates: current and historical release-date facts can coexist as evidence without degrading the answer as a structured conflict. These temporal probes also reject generic predecessor/successor graph-profile narration in the one public RAG answer; graph content must come from citation-backed RAG evidence rather than automatic graph-window labels.
- The runtime probe `temporal_scoped_planned_release_date_probe_en`, backed by `Knowledge_Base/ragtemporalqualifier`, extends the same condition-qualified guard to planned/future-qualified release dates: a current release date and a planned roadmap date can both be read from the full source document without becoming a false conflict.
- The runtime probe `temporal_cross_document_planned_release_date_probe_en`, backed by `Knowledge_Base/ragtemporalcrossscope`, extends that guard to the cross-document conflict scanner: separate scoped current and planned roadmap documents can both be read in full and returned as evidence without producing a cross-document `conflict` fragment.
- The runtime probe `temporal_cross_document_quantity_limit_probe_en`, backed by `Knowledge_Base/ragtemporalcrossscope`, extends the temporal quantity guard to separate scoped documents: current retry limit `3` and historical retry limit `5` are both read from full documents, returned as bounded evidence, and kept out of cross-document `conflict`.
- The runtime probe `conflicting_location_evidence_probe_en`, backed by `Knowledge_Base/raglocationconflict`, now extends the conflict slice to a conservative location comparable-fact class: explicit location/site/region/zone/room/rack/slot/bay subjects with Rack A and Rack B values produce a `conflict` fragment, keep both sides visible in the one public answer, and degrade under `context_assembly`.
- The runtime probe `full_document_location_scan_remote_conflict_probe_en`, backed by `Knowledge_Base/raglocationfullscan`, now locks the corrected full-document source-reading boundary for controlled location facts: the matched opening spans can omit Rack A and Rack B, while both selected scoped documents are still read fully, remote appendix placement facts still produce bounded `conflict` evidence, and the public answer remains one message.
- The runtime probe `conflicting_quantity_limit_evidence_probe_en`, backed by `Knowledge_Base/ragquantityconflict`, now extends the conflict slice to conservative unitless quantity facts: explicit count/limit/threshold/budget/quota/capacity/size/window/attempts/retries subjects with `3` and `5` values produce a `conflict` fragment, keep both sides visible in one public answer, and degrade under `context_assembly`.
- The runtime probe `full_document_quantity_scan_remote_conflict_probe_en`, backed by `Knowledge_Base/ragquantityfullscan`, now locks the corrected full-document source-reading boundary for controlled unitless quantity facts: matched opening spans can omit the `3` and `5` retry-limit values, while both selected scoped documents are still read fully, remote appendix limit facts still produce bounded `conflict` evidence, and the public answer remains one message.
- The runtime probe `conflicting_multi_document_quantity_evidence_probe_en`, backed by `Knowledge_Base/ragquantitymulticonflict`, now verifies cross-document plural unitless quantity facts: `retry attempts are 3` and `retry attempts are 5` produce a cross-document `conflict` fragment, keep both values in one public answer, and degrade under `context_assembly` without widening the extractor beyond explicit quantity subjects.
- The runtime probe `conflicting_ownership_identity_evidence_probe_en`, backed by `Knowledge_Base/ragidentityconflict`, now extends the controlled semantic-conflict slice to ownership identity facts: explicit owner/assignee/contact/maintainer/team/group subjects with `Release Ops` and `Rollback Team` values produce a `conflict` fragment, keep both sides visible in one public answer, and degrade under `context_assembly`.
- The runtime probe `conflicting_multi_document_ownership_identity_evidence_probe_en`, backed by `Knowledge_Base/ragidentitymulticonflict`, verifies the same ownership identity fact class across two scoped documents: the handoff-side `Release Ops` owner and rollback-side `Rollback Team` owner produce one cross-document `conflict` fragment and preserve both values in the public answer.
- The runtime probe `full_document_identity_scan_remote_conflict_probe_en`, backed by `Knowledge_Base/ragidentityfullscan`, now locks the corrected full-document source-reading boundary for controlled ownership identity facts: the matched opening spans can omit `Release Ops` and `Rollback Team`, while the selected scoped documents are still read fully, remote appendix owner facts still produce bounded `conflict` evidence, and the public surface remains one answer message.
- The runtime probe `temporal_scoped_location_probe_en`, backed by `Knowledge_Base/ragtemporalqualifier`, verifies the paired hard negative: current and historical placement facts stay in separate comparable scopes, the public answer can use the current Rack A fact, and the RAG pack does not emit a false `conflict` fragment.
- The runtime probe `environment_scoped_state_status_probe_en`, backed by `Knowledge_Base/ragenvironmentqualifier`, now verifies the next condition-qualified guard: staging-enabled and production-disabled status facts stay in explicit environment scopes, the RAG pack forbids `conflict`, and sufficiency remains `sufficient/none` instead of degrading a cross-environment state difference.
- The runtime probe `environment_scoped_quantity_limit_probe_en`, backed by `Knowledge_Base/ragenvironmentqualifier`, now extends that environment guard to unitless quantity facts: staging retry limit `3` and production retry limit `5` stay environment-qualified evidence without a false `conflict` fragment.
- The runtime probe `environment_scoped_ownership_identity_probe_en`, backed by `Knowledge_Base/ragenvironmentqualifier`, extends the same environment guard to controlled ownership identity facts: staging `Release Ops` and production `Rollback Team` owners stay environment-qualified evidence rather than a false conflict.
- The runtime probe `version_scoped_state_status_probe_en`, backed by `Knowledge_Base/ragversionqualifier`, now verifies the next condition-qualified guard: version-1.0-enabled and version-2.0-disabled status facts stay in explicit version scopes, the RAG pack forbids `conflict`, and sufficiency remains `sufficient/none` instead of degrading a cross-version state difference.
- The runtime probe `version_scoped_quantity_limit_probe_en`, backed by `Knowledge_Base/ragversionqualifier`, extends that version guard to unitless quantity facts: version-1.0 retry limit `3` and version-2.0 retry limit `5` remain version-qualified evidence rather than a false conflict.
- The runtime probe `version_scoped_ownership_identity_probe_en`, backed by `Knowledge_Base/ragversionqualifier`, extends that version guard to controlled ownership identity facts: version-1.0 `Release Ops` and version-2.0 `Rollback Team` owners remain version-qualified evidence rather than a false conflict.
- The runtime probe `platform_scoped_state_status_probe_en`, backed by `Knowledge_Base/ragplatformqualifier`, now verifies the next condition-qualified guard: Windows-enabled and Android-disabled status facts stay in explicit platform scopes, the RAG pack forbids `conflict`, and sufficiency remains `sufficient/none` instead of degrading a cross-platform state difference.
- The runtime probe `platform_scoped_quantity_limit_probe_en`, backed by `Knowledge_Base/ragplatformqualifier`, extends that platform guard to unitless quantity facts: Windows retry limit `3` and Android retry limit `5` remain platform-qualified evidence rather than a false conflict.
- The runtime probe `platform_scoped_ownership_identity_probe_en`, backed by `Knowledge_Base/ragplatformqualifier`, extends that platform guard to controlled ownership identity facts: Windows `Release Ops` and Android `Rollback Team` owners remain platform-qualified evidence rather than a false conflict.
- The runtime probe `temporal_scoped_quantity_limit_probe_en`, backed by `Knowledge_Base/ragtemporalqualifier`, extends the current-vs-historical hard negative to unitless quantity facts: current retry limit `3` and historical retry limit `5` remain temporal-scope evidence rather than a false conflict.
- The runtime probe `temporal_cross_document_quantity_limit_probe_en`, backed by `Knowledge_Base/ragtemporalcrossscope`, extends the same temporal quantity guard across two selected scoped documents: current retry limit `3` and historical retry limit `5` are read through `full_document` source decisions, stay in bounded `direct_support` and `parent_context`, and do not create a false cross-document `conflict`.
- The runtime probes `cross_document_environment_scoped_ownership_identity_probe_en`, `cross_document_version_scoped_ownership_identity_probe_en`, and `cross_document_platform_scoped_ownership_identity_probe_en`, backed by `Knowledge_Base/ragconditionownercrossscope`, now verify that the full-document cross-document conflict scanner preserves environment-, version-, and platform-qualified owner facts across separate scoped documents instead of producing false `conflict` fragments.
- The runtime probes `cross_document_environment_scoped_state_status_probe_en`, `cross_document_version_scoped_state_status_probe_en`, and `cross_document_platform_scoped_state_status_probe_en`, backed by `Knowledge_Base/ragconditionstatecrossscope`, now verify the same full-document cross-document hard negative for controlled state/status facts: staging-enabled versus production-disabled, version-1.0-enabled versus version-2.0-disabled, and Windows-enabled versus Android-disabled remain explicitly scoped evidence rather than false conflicts.
- The runtime probes `cross_document_environment_scoped_quantity_limit_probe_en`, `cross_document_version_scoped_quantity_limit_probe_en`, and `cross_document_platform_scoped_quantity_limit_probe_en`, backed by `Knowledge_Base/ragconditionquantitycrossscope`, now verify that the full-document cross-document conflict scanner preserves environment-, version-, and platform-qualified retry-limit facts across separate scoped documents instead of producing false `conflict` fragments.
- The runtime probes `cross_document_environment_scoped_endpoint_probe_en`, `cross_document_version_scoped_endpoint_probe_en`, `cross_document_platform_scoped_endpoint_probe_en`, `cross_document_environment_scoped_format_probe_en`, `cross_document_version_scoped_format_probe_en`, `cross_document_platform_scoped_format_probe_en`, `cross_document_environment_scoped_protocol_probe_en`, `cross_document_version_scoped_protocol_probe_en`, and `cross_document_platform_scoped_protocol_probe_en`, backed by `Knowledge_Base/ragconditioninterfacecrossscope`, now verify the same full-document cross-document hard negative for controlled interface facts. Endpoint, payload-format, and transport-protocol values stay scoped by explicit environment, version, or platform qualifiers instead of becoming false conflicts; version-scoped endpoint fixtures use `/api/release-one/hooks` and `/api/release-two/hooks` so route segments remain endpoint values rather than implicit version scopes.
- The runtime probes `cross_document_environment_scoped_dependency_probe_en`, `cross_document_version_scoped_dependency_probe_en`, and `cross_document_platform_scoped_dependency_probe_en`, backed by `Knowledge_Base/ragconditiondependencycrossscope`, now verify the same full-document cross-document hard negative for controlled dependency facts. Staging SQLite versus production PostgreSQL, version-1.0 SQLite versus version-2.0 PostgreSQL, and Windows SQLite versus Android PostgreSQL stay explicitly scoped evidence rather than false conflicts.
- The runtime probes `conflicting_endpoint_evidence_probe_en`, `full_document_endpoint_scan_remote_conflict_probe_en`, and `environment_scoped_endpoint_probe_en`, backed by `Knowledge_Base/ragendpointconflict`, `Knowledge_Base/ragendpointfullscan`, and `Knowledge_Base/ragendpointqualifier`, now extend controlled semantic-conflict coverage to explicit endpoint/url/uri/route facts. Same-section `/api/v1/hooks` versus `/api/v2/hooks` produces a `conflict` fragment and `context_assembly` degradation, and the full-document remote-scan case proves the matched opening spans do not need to contain those route values for selected scoped documents to emit bounded endpoint-conflict evidence. Staging and production endpoint routes stay environment-qualified evidence without a false conflict. Endpoint path segments such as `/v1/` are treated as route values, not version scopes; this does not infer endpoint compatibility.
- The runtime probes `conflicting_dependency_evidence_probe_en`, `conflicting_multi_document_dependency_evidence_probe_en`, `full_document_dependency_scan_remote_conflict_probe_en`, `environment_scoped_dependency_probe_en`, and `version_scoped_dependency_probe_en`, backed by `Knowledge_Base/ragdependencyconflict`, `Knowledge_Base/ragdependencymulticonflict`, `Knowledge_Base/ragdependencyfullscan`, `Knowledge_Base/ragdependencyqualifier`, and `Knowledge_Base/ragdependencyversionqualifier`, now extend controlled semantic-conflict coverage to explicit dependency/package/provider/driver/runtime/library/module/plugin/adapter facts. Same-section and cross-document SQLite versus PostgreSQL storage dependency statements produce `conflict` fragments and `context_assembly` degradation, including the full-document remote-scan case where the matched opening spans do not contain the conflicting dependency values. Staging/production and version-1.0/version-2.0 dependency records stay condition-qualified evidence without false conflicts.
- The runtime probes `conflicting_format_evidence_probe_en`, `full_document_format_scan_remote_conflict_probe_en`, and `environment_scoped_format_probe_en`, backed by `Knowledge_Base/ragformatconflict`, `Knowledge_Base/ragformatfullscan`, and `Knowledge_Base/ragformatqualifier`, now extend controlled semantic-conflict coverage to explicit format/schema/encoding/serialization/content-type/mime-type facts. Same-section JSON versus YAML payload format statements produce a `conflict` fragment and `context_assembly` degradation, and the full-document remote-scan case proves the matched opening spans do not need to contain those values for selected scoped documents to emit bounded format-conflict evidence. Staging JSON and production XML payload formats stay environment-qualified evidence without a false conflict.
- The runtime probes `conflicting_protocol_evidence_probe_en`, `full_document_protocol_scan_remote_conflict_probe_en`, and `environment_scoped_protocol_probe_en`, backed by `Knowledge_Base/ragprotocolconflict`, `Knowledge_Base/ragprotocolfullscan`, and `Knowledge_Base/ragprotocolqualifier`, now extend controlled semantic-conflict coverage to explicit protocol/transport-protocol/wire-protocol facts. Same-section HTTP/1.1 versus WebSocket transport protocol statements produce a `conflict` fragment and `context_assembly` degradation, and the full-document remote-scan case proves the matched opening spans do not need to contain those values for selected scoped documents to emit bounded protocol-conflict evidence. Staging HTTP/2 and production gRPC transport protocols stay environment-qualified evidence without a false conflict. This is intentionally narrower than endpoint compatibility, route-version inference, or protocol-negotiation semantics.
- The runtime probes `conflicting_semantic_version_evidence_probe_en`, `full_document_semantic_version_scan_remote_conflict_probe_en`, and `cross_document_environment_scoped_semantic_version_probe_en`, backed by `Knowledge_Base/ragversionfactconflict`, `Knowledge_Base/ragversionfactfullscan`, and `Knowledge_Base/ragconditionversionfactcrossscope`, now extend controlled semantic-conflict coverage to explicit version/revision facts whose values are semantic-version-like tokens such as `1.2.0` and `2.0.0`. Same-section runtime-version contradictions produce a `conflict` fragment and `context_assembly` degradation, the full-document remote-scan case proves matched opening spans do not need to contain the version values, and staging/production runtime versions stay environment-qualified evidence without a false conflict. This does not infer release compatibility, migration safety, or general package-version semantics.
- The runtime probes `conflicting_service_port_evidence_probe_en`, `full_document_service_port_scan_remote_conflict_probe_en`, and `cross_document_environment_scoped_service_port_probe_en`, backed by `Knowledge_Base/ragportconflict`, `Knowledge_Base/ragportfullscan`, and `Knowledge_Base/ragconditionportcrossscope`, now extend controlled engineering-fact coverage to explicit port/listener-port/service-port facts with numeric values from `1` to `65535`. Same-section `443` versus `8443` service-port contradictions produce a `conflict` fragment and `context_assembly` degradation, the full-document remote-scan case proves matched opening spans do not need to contain the port values, and staging/production service ports stay environment-qualified evidence without a false conflict. This does not infer network topology, protocol compatibility, or service safety.
- The runtime probes `conflicting_response_status_code_evidence_probe_en`, `full_document_response_status_code_scan_remote_conflict_probe_en`, and `cross_document_environment_scoped_response_status_code_probe_en`, backed by `Knowledge_Base/ragstatuscodeconflict`, `Knowledge_Base/ragstatuscodefullscan`, and `Knowledge_Base/ragconditionstatuscodecrossscope`, now extend controlled engineering-fact coverage to explicit HTTP/response/status-code facts with values from `100` to `599`. Same-section `200` versus `503` response-status contradictions produce a `conflict` fragment and `context_assembly` degradation, the full-document remote-scan case proves matched opening spans do not need to contain the status-code values, and staging/production response statuses stay environment-qualified evidence without a false conflict. The combined runtime verifier also preloads conflict, full-scan, and cross-scope status-code targets in one process to prove scoped RAG graph-neighbor evidence cannot pull status-code facts from earlier active targets outside the current scope. This does not infer endpoint health, retry semantics, or HTTP compatibility.
- The runtime probe `causal_answer_profile_budget_en`, backed by `Knowledge_Base/ragcausalprofile`, now verifies that why/cause/mechanism-style requests use a bounded causal RAG profile (`20` fragments, `1500` chars per fragment, `7600` total chars), keep the source boundary at `full_document`, and return one public answer with mechanism and downstream evidence rather than a single definition sentence.
- The runtime probe `conflicting_multi_document_evidence_probe_en`, backed by `Knowledge_Base/ragmulticonflict`, now verifies that contradictory `+/-0.10 mm` and `+/-0.50 mm` calibration-tolerance facts across two scoped documents produce a cross-document `conflict` fragment, stay visible in the one public answer, and degrade under `context_assembly`.
- The runtime probe `full_document_scan_remote_conflict_probe_en`, backed by `Knowledge_Base/ragfullscan`, now verifies the corrected source-boundary rule: the local paragraph window is not the maximum range. Two selected documents are read in full, remote appendix facts outside the matched opening spans are scanned for structured conflict evidence, and only the budgeted `RagContextPack` is capped before model-visible answer composition.
- Focused provenance tests now verify that repeated snippet text does not force the first textual occurrence when offsets are stale. If an offset candidate does not contain the evidence snippet but the line-range candidate does, `evidenceContextAssembler.ts` uses the line provenance to select the intended source block and parent section.
- The runtime probe `repeated_snippet_target_section_probe_en`, backed by `Knowledge_Base/ragrepeatedspan`, now verifies the same repeated-snippet risk at the conversation/release layer: the selected source document is still read as a full document and retained in trace, but the one public answer prefers clauses from the target section's leaf heading and does not leak the distractor section context. The section-aware filter is disabled for compare queries so existing two-sided material answers remain forward-compatible.
- Focused hard-negative tests now verify that an unavailable graph-neighbor source window is not treated as complete graph evidence merely because a graph-neighbor direct span or title exists. `evidenceContextAssembler.ts` records `source_resolver_returned_no_content:graph_neighbor_support`, and `ragSufficiencyJudge.ts` keeps the answer `borderline/partial_coverage` with `graph_neighbor_evidence_missing` until grounded neighbor source context is available.
- Focused graph-window ambiguity tests now verify that compare intent filters high-confidence `sequence` / `prerequisite` successors when `contrast` / `analogy` neighbors exist, while still failing open to structural successors when the graph has no compare-aligned neighbor. The runtime verifier now also asserts the graph diagnostics for the `graphintent` compare probes: at least two intent-aligned successor candidates, at least one intent-misaligned successor candidate, and no misaligned-successor fallback.

Next movement:

- Calibrate graph relation weights and low-confidence exclusion thresholds against representative hard negatives instead of treating the current scoring constants as final.
- Expand runtime probes beyond the current `graphintent` intent-selection baseline into larger-corpus hard negatives and relation-extraction ambiguity samples.
- Calibrate profile-specific release budgets beyond the current deterministic definition, compare, how-to, causal, and generic baselines while preserving hard public-answer caps.
- Extend replay tooling beyond stable context ids, failure-stage classifications, graph-window ambiguity diagnostics, and answer claim-citation maps; add larger runtime probes for repeated snippets, conflict patterns beyond controlled structured measurement/date/state/location/quantity/environment-qualified/version-qualified/platform-qualified facts, broader multi-document missing graph-neighbor corpora, stricter total-character budget drop cases, broader relation-ambiguity corpora, and provider fallback.

## 2026-07-04 Knowledge Workspace Scope Visibility, Grouped RAG Answers, and File-First Hit Interaction

This slice addresses the current Knowledge Workspace usability and retrieval-quality gap: scope was technically present but visually separated from the actual task flow, retrieval hits could make the prompt/answer area feel unreachable, hit cards either exposed secondary actions too early or hid them behind undiscoverable gestures, and definition-style questions such as `what is water glass?` still underused grouped evidence, graph neighborhoods, and document augmentation.
The current implementation keeps backward compatibility by preserving existing payload fields and capability actions while moving the primary UI contract to a simpler rule: choose scope in the conversation pane, ask, click one matched filename, then inspect the highlighted matched passage on the right.

What is now true in code:

- `src/frontend/index.html` now places `agent-scope-control--workspace` inside the left Knowledge Workspace conversation pane, before learner id, messages, matched files, and the composer. Scope is no longer only a toolbar accessory or an implicit request payload.
- `src/frontend/styles.css` updates the drawer toolbar to title/close only and gives the chat pane a stable grid row for scope, message history, matched files, composer, actions, and API status. The conversation stream and matched-file list remain independently scrollable, while the outer workspace shell now has a desktop and mobile vertical-scroll fallback so returned hits cannot make the prompt/composer unreachable.
- `src/frontend/workspace_panes.js` renders knowledge hits as filename-first buttons, restores a low-emphasis `.agent-knowledge-actions` compatibility strip for `Learning Path` and `Focus`, and keeps the fixed 44px `...` action trigger plus long-press, context-menu, and keyboard menu flows on the same action definitions.
- Clicking a hit filename opens the right-side graph-focus pane, resolves source path / citation / matched-span provenance, renders Markdown, highlights the matched passage inline, and scrolls the first primary highlight into view.
- `src/frontend/agent_workspace.js` keeps RSE, document augmentation, graph context, memory recall, readiness, and scope-recovery details in backend result metadata plus the status/evidence surface. The chat stream gets one user-facing assistant message for the turn, and structured-answer markdown sections remain in the backend payload instead of being rendered as visible orchestration notes.
- `src/learning/queryBackend.ts` now lets the local vector backend reuse a global index while enforcing scoped candidate scoring; if global ANN candidates all miss the active scope, retrieval falls back to a scoped full scan.
- `src/learning/graphContextAssembler.ts` now queries predecessor/successor edges for every atom grouped under a matched knowledge point, deduplicates the resulting graph window, and ranks structural neighbors above bibliography-style reference nodes. This fixes the earlier thin or wrong graph context when the real relation was attached to a secondary matched atom and prevents `References` from dominating definition-answer successor text.
- `src/learning/answerReleaseReview.ts` now keeps definition-intent revisions compact but more complete: it can release same-point document augmentation titles, bounded evidence highlights, and bounded graph-neighborhood context instead of reducing a scoped answer to one generic definition sentence.
- `src/learning/conversationComposer.ts` and `answerReleaseReview.ts` now guard missing graph-degree profiles without emitting `NaN incoming/outgoing` text; both public-answer paths also filter anchor-equivalent graph neighbors, dedupe same-title graph windows, and normalize parser artifact titles such as `(mermaid block)` before they reach the user-facing answer.
- `src/learning/KnowledgeLearningPlatform.ts` adds `warmQueryBackend()`, and `src/server.ts` schedules background warmup at startup and after `/api/knowledge/state`; this reduces cold-start noise when opening the Knowledge Workspace.
- `src/learning/KnowledgeLearningPlatform.ts` also adds a read-only `previewLearningPath()` path, and `src/server.ts` uses it for `/api/knowledge/path`, so Learning Path preview avoids synchronous snapshot persistence while durable `buildLearningPath()` behavior remains available for write paths.
- `src/frontend/agent_workspace.js` now prewarms the first matched Learning Path through a bounded 16-entry, two-minute preview cache. The same cache is used by the generic `build_learning_path` capability path and direct `openLearningPath()` path, so the first visible click can reuse a completed or inflight preview instead of starting duplicate backend work.
- `queryKnowledge()` no longer calls `persistIfNeeded()` for a read-only query response. Mutating paths such as ingest, sessions, configuration, and real state changes still persist; reads no longer rewrite the large graph snapshot.
- The reference review is now reflected in code boundaries: `ref/codex` requires bounded, structured model-visible context with hard caps, and `ref/enterprise_agent_platform` frames RAG as a replayable evidence pipeline (`retrieve` -> `rerank` -> `assemble_context` -> `generate_answer` -> `verify_citations`). The Knowledge Workspace keeps those orchestration details in backend trace/release-review payloads while the chat surface receives one public answer.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| The Knowledge Workspace must show and switch scope inside the workspace window by default | `index.html` places the scope selector inside `agent-chat-pane`; `src/agent_workspace.frontend.test.ts` verifies the selector is in `.agent-scope-control--workspace` and the selected scope is sent in conversation requests. | Implemented |
| The prompt and response area must remain reachable after hits are returned | The frontend regression `partitions conversation and knowledge hit scrolling so the composer remains reachable` now pins both inner scroll partitions and the outer shell vertical-scroll fallback. | Implemented |
| The hit surface should prioritize interactive knowledge-point filenames while keeping Learning Path / focus discoverable | `workspace_panes.js` renders file-first buttons through `renderKnowledgePoints`, restores a compatibility `.agent-knowledge-actions` strip with `data-capability-action-id`, and keeps the 44px menu trigger. Tests verify the strip and menu expose the same `Learning Path` / `Focus` action definitions. | Implemented |
| A conversation turn should produce one visible user-facing answer, while orchestration details stay behind the UI | `agent_workspace.js` publishes grounding state to `__NC_LAST_AGENT_CONVERSATION_GROUNDING` for the status/evidence pane; the frontend test verifies the streamed answer appears once, no `Grounding: scope=...` assistant/system message is appended, and backend structured markdown remains in the result payload instead of the chat bubble. | Implemented |
| Clicking a knowledge point should highlight the matched paragraph on the right | `normalizes citation-backed knowledge hits before opening graph focus` now verifies source rendering, matched-span highlighting, primary-highlight marking, and `scrollIntoView({ block: 'center', inline: 'nearest' })`. | Implemented |
| The same knowledge point should not appear as duplicate primary list entries | Conversation grouping and matched-span provenance collapse same-source hits into one knowledge point; graph context now expands across all grouped atom ids without duplicating the primary hit surface. | Implemented baseline; large-corpus duplicate-fragment pressure still needs continued testing |
| RAG should use RSE and document augmentation to improve answer quality | Scoped retrieval returns document/knowledge-point units; answer release now preserves definition evidence, document augmentation titles, and bounded predecessor/successor graph context when revising or enriching public answers, while filtering parser artifacts and anchor-equivalent graph neighbors. | Implemented stronger baseline |
| The first Learning Path click should avoid blocking persistence and duplicate backend work | `/api/knowledge/path` now uses `previewLearningPath()` while durable artifact recording stays in `buildLearningPath()`. `agent_workspace.js` prewarms the first matched point and reuses the bounded preview cache on the generic capability path. | Implemented |
| The first query must not be blocked by persistence on the read path | `queryKnowledge()` removed read-only persistence; the latest `what is waterglass?` scoped runtime probe returns `ok: true`, one grouped `Knowledge_Base/waterglass/water glass.md` knowledge point, six citations, and a direct definition answer instead of the prior scoped-miss response. | Fixed |

Fresh verification captured on 2026-07-04:

- `rtk npm.cmd exec -- jest src/agent_workspace.frontend.test.ts --runInBand`
- `rtk npm.cmd exec -- jest src/learning/KnowledgeLearningPlatform.test.ts src/learning/graphContextAssembler.test.ts src/learning/conversationComposer.test.ts src/learning/answerReleaseReview.test.ts --runInBand`
- `rtk npm.cmd run build`
- `rtk npm.cmd run build:vite`
- `rtk node scripts/verify-knowledge-workspace-runtime.js --target waterglass --query "what is waterglass?"`

Architecture progress against the earlier plan chain:

| Earlier expectation | Current reading on 2026-07-04 | Progress call |
|---|---|---|
| Knowledge Workspace scope must become explicit task state inside the workspace window | Scope now lives in the conversation pane where the user asks and reviews hits. If a running Tauri window still does not show it, the first assumption should be a stale dev sidecar / WebView build rather than missing source behavior. | Implemented in the current build |
| RAG hits should return by knowledge point and highlight matched fragments | The filename-first list plus right-side source-highlight pane now provides this baseline, including primary-highlight scroll. The next pressure point is ranking and folding multiple matched spans inside one document. | Baseline implemented |
| RSE/document augmentation should improve the public answer rather than only diagnostics | Definition-intent revisions now include same-point augmentation titles and bounded graph neighborhoods while staying compact; bibliography-style reference windows are filtered out of public graph-neighborhood phrasing when stronger structural neighbors exist. | Implemented stronger baseline |
| API status must let users judge availability and stability | Background hydration and query-backend warmup are now in the server lifecycle, and the frontend status strip updates after successful conversation calls. The next UI step is exposing warmup latency, backend id, and scope readiness more directly to non-developer users. | Backend base implemented; user-facing status can still improve |
| The query and preview chains must be robust and forward compatible | Read queries and read-only path previews no longer trigger snapshot persistence; new fields, action-strip selectors, cache diagnostics, and methods are additive, while durable write paths retain their existing behavior. | Significantly improved |
| Architecture pressure should continue to fall | `KnowledgeLearningPlatform.ts` still owns hydration, retrieval, store snapshots, path preview composition, and query context assembly. This slice narrows read/write boundaries first; future work should extract persistence, retrieval-context, and preview-composition owners. | Improved, still needs owner reduction |

Next movement:

- Continue promoting the API status panel beyond the new localized RAG evidence state into readable `scope readiness`, backend warmup, recent latency, cache hit, and index-size state instead of hiding most diagnostics behind developer details.
- Repeat `water glass`-style title-like queries on representative large corpora to confirm scoped ANN fallback, document augmentation, grouped graph windows, and file-first hit rendering remain stable.
- Continue calibrating predecessor/successor answer phrasing on larger corpora now that reference/bibliography-like graph nodes no longer dominate the bounded public graph summary when stronger semantic neighbors exist.
- Continue splitting snapshot persistence, query context assembly, retrieval telemetry, and path preview composition out of `KnowledgeLearningPlatform.ts` into narrower owners so read/write boundaries stay enforceable.

## 2026-07-03 Mermaid Fallback, Future Path Runtime Reuse, and Graph-Aware Public Answers

This slice closes three concrete gaps that remained after the hosted interaction parity work:

- malformed Mermaid bracketed-node labels could still fail in the Node-side fallback renderer,
- the first Guided Learning open could still pay for repeated hosted `Graph` / `PathEngine` reconstruction,
- the public answer path still underused bounded DAG context and often collapsed to a single top-hit sentence.

What is now true in code:

- `src/notemd/MermaidProcessor.ts` and `src/reader_renderer.ts` now normalize stray inner double quotes inside bracketed Mermaid node labels on a per-line basis before parsing/rendering. The known `Superior Overall` failure class now self-heals at both the NoteMD source-fix boundary and the local renderer fallback boundary.
- The Mermaid repair path is intentionally bounded: the new normalization is line-scoped so it does not cross statement boundaries or break the existing dangling-bracket label repair path.
- `src/frontend/workspace_panes.js` now caches the hosted Future Path `Graph` / `PathEngine` runtime by source-graph signature. Reopening or rerendering the same Guided Learning projection no longer rebuilds the full hosted graph runtime every time.
- The hosted Future Path cache now has a narrower owner: `src/frontend/hosted_future_path_runtime.js` owns signature-based reuse plus cold/hot-path diagnostics, while `workspace_panes.js` consumes that owner and exposes the last diagnostics snapshot.
- `src/frontend/agent_workspace.js` keeps the pending-pane behavior introduced earlier, so Guided Learning still opens immediately while `/api/knowledge/path` resolves; runtime reuse now removes the repeated graph-rebuild cost behind that UI.
- Guided Learning pending state is now more useful on first open: when local graph state is sufficient, `workspace_panes.js` renders the hosted Future Path projection immediately and keeps the pending status visible while `/api/knowledge/path` is still building the richer response.
- `src/frontend/agent_workspace.js` now dedupes identical in-flight `/api/knowledge/path` requests by normalized payload, so repeated clicks on the same Learning Path target no longer spawn parallel duplicate backend work.
- `src/learning/graphContextAssembler.ts` now emits additive `anchorGraphProfile` data carrying bounded in-degree, out-degree, and centrality facts for the selected anchor, and predecessor/successor windows now preserve optional degree metadata.
- `src/learning/conversationComposer.ts` and `src/learning/answerReleaseReview.ts` now use bounded graph-derived path and degree context on the public-answer path. The answer remains contracted, but it is no longer forced to stay at “first direct sentence or `title: summary`” when stronger DAG context is already available.
- The local references under `ref/enterprise_agent_platform` and `ref/codex` now reinforce the chosen owner split: runtime/retrieval/memory/release-review remain local runtime owners, while model-visible context remains bounded and additive.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Fallback Mermaid rendering should not crash on the known malformed bracketed-label pattern | `MermaidProcessor.ts` and `reader_renderer.ts` now normalize stray quotes per line; `src/notemd.core.test.ts` and `src/reader_renderer.test.ts` pin the regression. | Implemented |
| First Guided Learning open should avoid repeated hosted runtime rebuilds for the same graph snapshot | `workspace_panes.js` caches the hosted Future Path runtime by source-graph signature, and `src/agent_workspace.frontend.test.ts` verifies repeated pane renders do not rebuild nodes/edges for the same snapshot. | Implemented |
| First Guided Learning open should show path structure before the backend path request completes | `workspace_panes.js` now renders an immediate hosted projection during the pending phase, and `src/agent_workspace.frontend.test.ts` verifies that pending status and hosted path surface coexist before the deferred response resolves. | Implemented |
| Hosted runtime reuse should expose observable cold/hot-path evidence | `hosted_future_path_runtime.js` now owns reuse diagnostics, and `src/agent_workspace.frontend.test.ts` verifies both same-snapshot reuse and signature-change rebuilds. | Implemented |
| Learning Path request chaining should avoid duplicate identical in-flight backend work | `agent_workspace.js` now dedupes identical in-flight `/api/knowledge/path` calls, and `src/agent_workspace.frontend.test.ts` verifies two same-target opens share one backend request. | Implemented |
| Public answers should use bounded graph context instead of only the top-hit sentence | `graphContextAssembler.ts` now supplies `anchorGraphProfile`; `conversationComposer.ts` and `answerReleaseReview.ts` now use bounded path/degree context on the public-answer path. | Implemented |

Fresh verification captured on 2026-07-03:

- `npm.cmd exec -- tsc --noEmit`
- `npm.cmd exec -- jest src/learning/KnowledgeLearningPlatform.test.ts src/learning/KnowledgeWorkspaceConversationRegression.test.ts src/learning/conversationComposer.test.ts src/agent_workspace.frontend.test.ts src/notemd.core.test.ts src/reader_renderer.test.ts --runInBand --no-cache`
- `npm.cmd run build:mini`
- `node scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh`

Architecture progress against the earlier plan chain:

| Earlier expectation | Current reading on 2026-07-03 | Progress call |
|---|---|---|
| The existing DAG should become an answer-time structure instead of a shallow relation bonus | `graphContextAssembler.ts` now emits bounded `connectionPaths`, `anchorGraphProfile`, predecessor/successor windows, and evidence refs; `conversationComposer.ts` plus `answerReleaseReview.ts` now use that bounded context on the public-answer path. | Implemented stronger baseline |
| Knowledge Workspace should keep evidence and graph detail out of the main answer surface | The main answer remains contracted, while graph detail stays in pane-backed evidence and trace surfaces. | Implemented |
| Hosted Guided Learning should not rebuild the same runtime on every reopen | `workspace_panes.js` now reuses hosted `Graph` / `PathEngine` runtime by source-graph signature. | Implemented |
| The platform should learn from reference architectures without importing their runtime owners | `ref/enterprise_agent_platform` reinforces evidence/retrieval/runtime/review separation; `ref/codex` reinforces bounded model-visible context and additive fragments. | Implemented as design guidance |
| Architecture pressure should fall over time | It is still concentrated in `src/server.ts` (~15850), `KnowledgeLearningPlatform.ts` (~11200), `workspace_panes.js` (~9289), `agent_workspace.js` (~4882), and `answerReleaseReview.ts` (~4261), but `hosted_future_path_runtime.js` now pulls one real cache/telemetry invariant out of `workspace_panes.js`. | Improved, still behind |

This changes the forward reading:

- The remaining gap is no longer "does DAG context reach the answer path?"
- The remaining gap is no longer "can Learning Path reuse hosted runtime?"
- The remaining gap is calibration plus ownership reduction inside a few oversized local owners.

The next movement is narrower than another “framework pass”:

- measure first-open versus hot-reopen Guided Learning latency on large corpora,
- add explicit hosted Future Path cache invalidation only if real graph-mutation paths prove signature reuse is insufficient,
- keep graph-aware public answers aligned with bounded RSE-style augmentation instead of turning the main answer area into a graph-inspection surface.

## 2026-06-24 Knowledge Workspace Hosted Interaction Parity

This increment closes two remaining pane-hosting gaps without changing the ownership model established on 2026-06-22.
The Knowledge Workspace still reuses Focus/Future Path behavior contracts locally; it does not reparent the Tauri main graph DOM and does not open or embed the native Godot window by default.

What is now true in code:

- `src/frontend/workspace_panes.js` wraps the hosted Focus projection in a pane-local viewport with wheel zoom, pointer panning, icon reset, and icon focus-history controls.
- Hosted Focus history is scoped to the Knowledge Focus pane, bounded to the most recent anchors, and switches anchors through the same hosted `switchHostedFocusNode()` path instead of mutating the main graph runtime.
- Hosted Focus still hides the dense gray context-dot background, visible edge layer, and main toolbar frame by default, while preserving Focus semantic labels and active node density.
- `src/frontend/godot_tree_interactions.js` now lets callers provide `nodeReaderRequested`; hosted Future Path uses that callback so double-click opens concrete node Markdown in the Guided Learning pane, while callers without the callback keep the previous prerequisite expand/collapse fallback.
- `src/frontend/workspace_panes.js` now uses a shared pane-local reader path for both Knowledge Focus and Guided Learning, so node content opens inside the pane that owns the interaction and global `reader.open` remains untouched.
- `src/frontend/locales/en.json` and `src/frontend/locales/zh.json` now include the new Focus viewport control labels, keeping locale contracts intact.
- `scripts/verify-agent-workspace-browser.js` now asserts the real browser regression path: Future Path double-click emits `node_reader_requested`, reads `Knowledge_Base/waterglass/water glass.md`, renders Markdown inside the learning-path pane, keeps global reader calls at zero, zooms the hosted Focus viewport by wheel, resets to `1/0/0`, opens focus history, and switches history back to `water glass`.
- `src/agent_workspace.frontend.test.ts` now pins the same contracts at jsdom level for fast regression feedback.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Knowledge Focus should behave like Focus mode in a small right-side pane | Hosted Focus uses the existing projection/double-click contract plus pane-local wheel zoom, reset, and history controls. | Implemented |
| Knowledge Focus controls must not take over the Tauri main graph | The hosted viewport stores transform state on pane-local DOM attributes and calls hosted anchor switching only. | Implemented |
| Learning Path double-click should open concrete node content in-place | Hosted Future Path passes `nodeReaderRequested` into the TreeRenderer adapter and opens the shared pane-local Markdown reader. | Implemented |
| Reuse must remain compatible | The TreeRenderer adapter falls back to the prior expansion behavior when no reader callback is supplied. | Implemented |
| Regression coverage must be executable | Strict browser verification now checks `water glass` Focus/Future Path interactions, source read path, Markdown render, zoom/reset/history, and global reader non-use. | Implemented |

Tradeoff:

This still deliberately avoids native Godot window docking.
That is the correct boundary for now: embedding native windows would require platform-specific ownership of window parenting, input focus, teardown, and reader routing.
The shipped path reuses the stable graph/path contracts and renderer semantics inside the web workspace, which is lower risk and keeps the main Tauri surface isolated.

## 2026-06-22 Knowledge Workspace Hosted Focus/Future Path Closure

The latest closure is not a new framework direction.
It corrects the prior reuse mistake: the Knowledge Workspace now reuses the existing Focus-mode and Godot Future Path behavior/data contracts without reparenting the main Tauri graph DOM or opening the native Godot window as the default pane behavior.

What is now true in code:

- the public answer remains contracted to the release-reviewed answer from `src/learning/conversationComposer.ts` and `src/learning/answerReleaseReview.ts`,
- the existing DAG is still consumed before synthesis by `src/learning/graphContextAssembler.ts` and again at release time through graph-aware reviewer gates,
- the matched-file list in `src/frontend/workspace_panes.js` now uses a compact question-mark help affordance instead of dumping instructional copy into the workspace,
- matched-file source focus remains right-pane-first: clicks resolve source paths, render Markdown, and project inline highlights through line/snippet/offset provenance paths,
- `Related Focus` now hosts an isolated Focus-mode pane backed by `NoteConnectionGraphView.getFocusModeProjection()`: it keeps the main `#graph-container` in its original parent, renders active Focus nodes without the dense gray background context-node layer, preserves the Focus semantic labels, omits the main toolbar frame and visible edge layer, switches the pane-local anchor on related-node double click, and opens Markdown content inside the pane-local reader when the anchor is double-clicked; relation-edge/debug details remain Developer Mode only,
- `Learning Path` no longer mounts the browser `path-container` and no longer asks Tauri/Godot to show the native Path window by default; it resolves the selected DAG node and runs the existing frontend `Graph` / `PathEngine` contract with `diffusionLearning(target, 'core', completedSet, forcedExpansionSet)` plus `getTreeLayout(..., collapsedSet, expansionOrder, stickyClaimEnabled, { verticalGap: 240 })`, inheriting live Path-mode expansion/collapse/completion state when the live `diffusion/core` target matches,
- `src/frontend/focus_mode_interactions.js` now holds the shared Focus double-click decision model used by both the main graph runtime and the hosted Knowledge Focus pane,
- `src/frontend/godot_tree_interactions.js` now maps hosted Future Path DOM input back to Godot TreeRenderer-style signals instead of relying on pane-local one-off handlers, and it follows the Godot TreeRenderer spine-only prerequisite expand/collapse contract,
- the hosted Future Path is rendered through the modular `src/frontend/godot_future_path_renderer.js` TreeRenderer-compatible surface, including 140x50 capsule nodes, Bezier skip-level edge filtering, active subtree hulls, spine expansion badges, hover subtree focus, word-preserving labels, and target-centered pane-local pan/zoom auto-fit,
- right-pane windows now expose close controls on the affected source/focus/path surfaces,
- strict browser verification in `scripts/verify-agent-workspace-browser.js` now owns the user-reported `water glass.md` UI regression surface, including hosted Godot Future Path `diffusion/core` projection for `water glass`, live Path-mode expansion-state inheritance, TreeRenderer markers/hulls/viewport auto-fit, Future Path left-click/right-click/middle-click signal checks, right-click collapse state for `water glass`, refusal to dock `#path-container`, refusal to call bridge/Tauri `showGodot=true`, refusal to dock the real `#graph-container`, absence of dense Focus context dots, hosted Focus anchor assertion for `water glass`, hosted Focus semantic labels, absence of the hosted Focus toolbar/edge layer, hosted Focus double-click switch to `application`, pane-local reader opening, and global `reader.open` non-use.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| The answer area should not become an evidence dump | `conversationComposer.ts` publishes `answerReleaseReview.publicAnswer`; graph/evidence diagnostics stay in secondary surfaces. | Implemented |
| Users need to discover that matched files are clickable without permanent workspace clutter | `workspace_panes.js` renders the instruction behind a help icon that appears on hover/focus. | Implemented |
| Clicking a matched file should open source and highlight the basis | Source focus consumes source-line provenance, line windows, snippets, and offsets where available. | Implemented baseline |
| `Related Focus` should correspond to the Tauri Focus-mode state | The pane hosts Focus-mode behavior locally through `getFocusModeProjection()` and the shared `focus_mode_interactions.js` decision model: active Focus nodes, Focus semantic labels, no dense gray background context layer, no toolbar frame, no visible edge layer, pane-local double-click switching, pane-local Markdown reader, no mutation of the main graph runtime, no global `reader.open`; diagnostics are Developer Mode only. | Implemented |
| `Learning Path` should correspond to the Godot/Path-mode design | The pane hosts the Godot Future Path data contract by using the existing frontend `Graph` / `PathEngine` `diffusion/core` + `treeLayout` path for the resolved DAG node, inherits live Path-mode expansion/collapse/completion state when target/mode/strategy match, renders through `godot_future_path_renderer.js`, and routes input through `godot_tree_interactions.js` as TreeRenderer spine-only signals; it deliberately does not mount browser `path-container` or show the native Godot window by default. | Implemented |
| Final answers need a robust review/correction owner | `answerReleaseReview.ts` remains the deterministic backend release-policy owner. | Implemented baseline |
| Compatibility must hold | New provenance/runtime-dispatch fields remain additive/optional; legacy response fields remain valid. | Implemented |

The important tradeoff is now narrower.
Focus reuse now means projection-contract reuse, not DOM ownership transfer. Moving `#graph-container` made the pane accidentally own the main Tauri graph lifecycle, which violated isolation and opened Markdown in the wrong surface.
Path reuse now means Godot Future Path data-contract and renderer-semantics reuse through the existing `Graph` / `PathEngine` tree layout consumed by Godot's TreeRenderer, not the browser/Tauri Learning Path and not a native-window visibility toggle. The latest parity fix is a state-contract correction: the hosted pane must pass the same kind of `completedIds`, `forcedExpansionIds`, `collapsedIds`, `expansionOrder`, and `stickyClaimEnabled` package that Path mode sends to the worker, while explicit pane-local collapse must still survive the next render instead of being overwritten by the default "target starts expanded" invariant.
Embedding the native Godot window into the DOM remains a separate native window-container spike; it should not be smuggled into the Knowledge Workspace pane implementation.

Remaining work has moved to calibration:

- expand reviewer contradiction corpora without widening false positives,
- increase source-offset coverage for legacy payloads,
- calibrate graph-aware ranking on real corpora before increasing relation weights,
- extract smaller frontend owners only when the new module owns a real invariant,
- keep strict browser UI verification active while matched-file interactions continue evolving.

Durable plan:

- [Agent Knowledge Workspace Graph Preview and Review Closure (2026-06-20)](../../../solutions/agent-knowledge-workspace-graph-preview-and-review-closure-2026-06-20.md)

## 2026-06-19 Re-audit: Reviewer Owner Already Landed

The latest re-audit changes the diagnosis of the slice.
The project no longer lacks a final public-answer reviewer; that owner already exists in `src/learning/answerReleaseReview.ts`.
The active gaps now sit in broader contradiction coverage and deeper evidence provenance.

What is now true in code:

- the final public-answer release decision is already owned by `answerReleaseReview.ts`, not by prompt templates and not by the frontend,
- the existing DAG is already being consumed twice:
  - at answer-planning time by `src/learning/graphContextAssembler.ts`,
  - at release-review time by `claim_graph_causal_consistency`, `claim_graph_order_consistency`, and `claim_graph_comparison_consistency`,
- `src/learning/answerReleaseReview.ts` now also enforces `claim_state_consistency`, so same-subject state reversals such as `open system` vs `closed system` are revised instead of reaching the public answer,
- `src/learning/answerReleaseReview.ts` now also enforces `query_intent_alignment`, so definition-style questions such as `什么是waterglass?` revise document-self-description drafts into direct grounded definitions before release,
- `src/learning/answerReleaseReview.ts` now also enforces `claim_containment_consistency`, so drafts that keep the same grounded subject and explicit containment relation but swap the contained material, such as `contains water` to `contains oil`, are revised before release,
- `src/learning/answerReleaseReview.ts` now also enforces `claim_composition_consistency`, so drafts that keep the same grounded subject and explicit `composed of` / `由...组成` relation but swap the supported components, such as `water and a glass cup` to `oil and a plastic cup`, are revised before release,
- `src/learning/answerReleaseReview.ts` now also enforces `claim_purpose_consistency`, so drafts that keep the same grounded subject and explicit `used for` / `用于` relation but swap the supported use, such as `drinking water` to `storing motor oil`, are revised before release,
- `src/learning/answerReleaseReview.ts` now also enforces `claim_dependency_consistency`, so drafts that keep the same grounded subject and explicit `depends on` / `requires` / `依赖` / `前置条件` relation but swap the supported dependency, such as `Baseline Measurement and Sensor Calibration` to `Final Reporting`, are revised before release,
- `src/learning/answerReleaseReview.ts` now also enforces `claim_location_consistency`, so drafts that keep the same grounded subject and explicit `located in` / `位于` relation but swap the supported location, such as `main chamber` to `auxiliary chamber`, are revised before release,
- `src/learning/answerReleaseReview.ts` now also enforces `claim_subject_consistency`, so drafts that keep the supported fact tail but silently swap the grounded subject, such as `Water density` to `Glass density`, are revised before release,
- `src/learning/answerReleaseReview.ts` now also enforces `claim_structured_comparison_consistency`, so drafts that explicitly invert supported same-property comparisons such as `Water density is higher than glass density` are revised before release when support facts prove the opposite ordering,
- `src/learning/answerReleaseReview.ts` now also enforces `claim_attribute_consistency`, so drafts that keep the same grounded subject and explicit `has` / `具有` attribute frame but swap the supported attribute, such as `moderate thermal insulation` to `high thermal insulation`, are revised before release,
- `src/learning/answerReleaseReview.ts` now also enforces `claim_graph_causal_consistency`, so drafts that reverse DAG-backed cause/effect direction, such as `Pressure Rise causes Thermal Expansion`, are revised before release in both English and Chinese,
- `src/learning/answerReleaseReview.ts` now also enforces `claim_graph_comparison_consistency`, so drafts that misstate DAG-backed `contrast` / `analogy` title pairs are revised before release with deterministic correction sentences,
- `src/learning/answerReleaseReview.ts` now also enforces `claim_temporal_validity_consistency`, so DAG temporal warnings now participate in final release: when `graphContext.temporalValidity.allPointsValid === false`, unqualified current-tense drafts are revised, explicitly time-qualified drafts may still release, and supersedes-only lineage does not create a false-positive block,
- locative predicates such as `located in` / `位于` are now explicitly excluded from `claim_state_consistency` extraction, so location claims stay owned by the location slice instead of surfacing as false-positive state conflicts,
- the shared alias/scope corpus no longer overfits that internal rewrite step across every fixture:
  - synthetic in-memory corpora now accept either `release` or `revise` as long as the final public answer is grounded and contracted,
  - the real screenshot-derived runtime case `waterglass_explicit_scope_compact_zh` still requires `revise` with failed gate `query_intent_alignment`,
- `src/frontend/markdown_runtime.js` now annotates rendered markdown blocks with block-level source-line metadata,
- `src/frontend/workspace_panes.js` now tightens right-pane evidence focus beyond payload stability:
  - it prefers `source_line_provenance` when rendered-node source ranges overlap trusted evidence spans,
  - after selecting the correct node, it projects the matched evidence fragment into inline highlight markup,
  - inside a source-authenticated selected block, it now prefers snippet-sized fragment projection before broad text search, so a single-line paragraph no longer highlights as one giant fragment,
  - it falls back to `line_window` when rendered provenance is absent but citation line windows are still trustworthy,
  - it falls back to `snippet_fallback` when line metadata is absent or stale,
  - it exposes additive `highlightStrategy` diagnostics (`source_line_provenance`, `line_window`, `snippet_fallback`, `none`),
  - it also exposes additive `inlineHighlightStrategy` diagnostics (`source_fragment_provenance`, `text_search`, `none`),
  - it records additive source-provenance coverage counts, and penalizes over-broad container matches so repeated snippet text does not highlight the whole article,
- `src/agent_workspace.frontend.test.ts` now pins four operator-relevant regressions:
  - repeated snippet text must resolve to the correct paragraph when the line window is trustworthy,
  - unusable line metadata must fall back to snippet highlighting instead of highlighting the wrong paragraph,
  - a single-line paragraph must collapse highlight down to the matched fragment instead of the full line,
  - nested inline markdown nodes must still produce one exact fragment highlight,
- runtime verification now also has a build-freshness constraint: reviewer-gate changes must be checked against freshly built `dist` output, because one stale-build probe temporarily hid the new gate inventory until `npm.cmd run build:mini`,
- the user-provided screenshot `1781782257390.jpg` remains a formal runtime acceptance owner through `waterglass_explicit_scope_compact_zh`; its root cause is now recorded as planner/retrieval normalization drift plus public-answer diagnostic leakage.

## 2026-06-19 Structured Comparison Contradiction Gate

This sub-slice closes a narrower gap than generic "fact checking".
The failure class is explicit ordering drift between two grounded entities on the same property, not broad semantic uncertainty.

What changed:

- `src/learning/answerReleaseReview.ts` now extracts explicit comparison frames such as `higher than`, `lower than`, `greater than`, `less than`, `高于`, and `低于`,
- `claim_structured_comparison_consistency` compares those answer frames against support facts only when both sides resolve to same-property, same-unit structured facts,
- deterministic correction sentences now preserve strong English casing signals instead of blindly lowercasing anchors,
- `src/learning/types.ts` now exposes the gate as first-class `AnswerReleaseGateId`,
- `src/learning/answerReleaseReview.test.ts` now pins four contract edges:
  - English inversion must `revise`,
  - Chinese inversion must `revise`,
  - supported comparison direction must still `release`,
  - mixed-property support must not create a false positive.

Why this matters architecturally:

- lexical overlap alone cannot distinguish `Water density is higher than glass density` from the exact opposite claim,
- `claim_structured_consistency` catches scalar mismatches on one fact, but it does not by itself prove pairwise ordering between two entities,
- DAG comparison-family checks (`contrast` / `analogy`) answer a different question; they do not own same-property numeric ordering,
- therefore this gate belongs in the deterministic backend reviewer, not in prompt wording and not in frontend rendering.

What remains open:

- broader claim-vs-citation / claim-vs-evidence contradiction coverage still needs to extend beyond the current lexical + query-intent + structured + structured-comparison + attribute + containment + composition + purpose + dependency + location + subject + state + polarity + graph-causal + graph-order + graph-comparison + temporal-validity stack,
- repeated fragment disambiguation inside one authenticated rendered block still needs exact offsets or richer markdown AST provenance.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Final public-answer review must own pairwise comparison ordering when support facts are structurally comparable | `answerReleaseReview.ts` now enforces `claim_structured_comparison_consistency` on explicit comparison frames backed by same-property, same-unit support facts. | Implemented baseline |
| The gate must remain conservative instead of guessing across unrelated numerics | Mixed-property or mixed-unit support facts do not become comparable; the new tests pin that false-positive boundary. | Implemented baseline |
| Runtime verification must not trust stale compiled reviewer output | Reviewer-gate runtime checks now require fresh `dist` output; `npm.cmd run build:mini` is part of the verification path after source changes. | Implemented |

Verification for this sub-slice:

- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `npm.cmd run build:mini`
- `node scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh`

## 2026-06-19 Location Contradiction Gate

This sub-slice closes a different failure class from state contradictions.
The problem is explicit same-subject location drift, not copula/state disagreement.

What changed:

- `src/learning/answerReleaseReview.ts` now extracts location frames such as `located in`, `situated in`, `positioned in`, `lies in`, `位于`, and `坐落于`,
- `claim_location_consistency` compares same-subject location claims against the grounded support set and revises the draft when the supported location is swapped,
- `STATE_FRAME_SKIP_VALUE_PATTERN` now excludes locative predicates from `claim_state_consistency`, so location claims no longer surface as false-positive state conflicts,
- `src/learning/types.ts` now exposes `claim_location_consistency` as a first-class `AnswerReleaseGateId`,
- `src/learning/answerReleaseReview.test.ts` now pins three contract edges:
  - English location contradiction must `revise`,
  - Chinese location contradiction must `revise`,
  - a broader supported location must still `release`.

Why this matters architecturally:

- location drift is a concrete contradiction family that lexical overlap and state checks do not own cleanly,
- if locative phrases are left inside the state slice, the reviewer produces the right decision for the wrong reason and the gate surface becomes harder to trust,
- therefore the fix is not another framework or a broader semantic verifier; it is a narrower local owner with an explicit false-positive boundary.

What remains open:

- broader claim-vs-citation / claim-vs-evidence contradiction coverage still needs to go beyond explicit location frames,
- repeated inline-fragment disambiguation still needs exact offsets or richer markdown AST provenance.

Verification for this sub-slice:

- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`

## 2026-06-19 Dependency/Prerequisite Contradiction Gate

This sub-slice is intentionally narrower than a generic "LLM verifier" discussion.
The failure class is explicit dependency drift inside an otherwise grounded answer, not broad semantic uncertainty.

What changed:

- `src/learning/answerReleaseReview.ts` now extracts explicit dependency/prerequisite frames such as `depends on`, `requires`, `relies on`, `has prerequisite`, `依赖`, `需要`, and `前置条件`,
- `claim_dependency_consistency` compares same-subject dependency claims against the scoped support set and revises the draft when the supported dependency is swapped,
- `src/learning/types.ts` now exposes that gate as a first-class `AnswerReleaseGateId`,
- `src/learning/answerReleaseReview.test.ts` now fixes three contract edges:
  - English dependency contradiction must `revise`,
  - Chinese dependency contradiction must `revise`,
  - supported dependency refinements must still `release`.

Why this matters architecturally:

- this gate belongs in the post-synthesis backend reviewer because the question is release-worthiness, not generation style,
- it deliberately reuses the current DAG-and-evidence runtime instead of introducing a second correctness owner from `ref/`,
- it closes a concrete contradiction family without widening the false-positive surface into unstable semantic guesswork.

What remains open:

- claim-vs-citation and claim-vs-evidence contradiction coverage still needs to go beyond explicit dependency frames,
- repeated inline fragment disambiguation still needs exact offsets or richer markdown AST provenance.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Final public-answer review must have a durable backend owner | `src/learning/answerReleaseReview.ts` already owns `release` / `revise` / `abstain` after synthesis. | Implemented |
| The existing DAG must influence answer correctness, not just retrieval ranking | `graphContextAssembler.ts` shapes support windows before synthesis, and `claim_graph_causal_consistency`, `claim_graph_order_consistency`, plus `claim_graph_comparison_consistency` use DAG evidence at release time. | Implemented baseline |
| Definition-style questions must not release document-self-description drafts | `answerReleaseReview.ts` now enforces `query_intent_alignment`, revising `what is` / `什么是` answers when grounded definition frames exist but the draft still says `This technical document...` / `本技术文档旨在...`. | Implemented baseline |
| Grounded drafts must not keep the same explicit containment relation while swapping the contained material | `answerReleaseReview.ts` now enforces `claim_containment_consistency` on comparable containment/content frames, revising drifts such as `Water glass contains water` -> `Water glass contains oil`. | Implemented baseline |
| Grounded drafts must not keep the same explicit composition relation while swapping the supported components | `answerReleaseReview.ts` now enforces `claim_composition_consistency` on comparable `composed of` / `consists of` / `由...组成` frames, revising drifts such as `water and a glass cup` -> `oil and a plastic cup` while allowing compatible component order/refinement. | Implemented baseline |
| Grounded drafts must not keep the same explicit purpose relation while swapping the supported use | `answerReleaseReview.ts` now enforces `claim_purpose_consistency` on comparable `used for` / `用于` frames, revising drifts such as `drinking water` -> `storing motor oil` while allowing supported-purpose refinements. | Implemented baseline |
| Grounded drafts must not keep the same explicit dependency/prerequisite relation while swapping the supported dependency | `answerReleaseReview.ts` now enforces `claim_dependency_consistency` on comparable `depends on` / `requires` / `依赖` / `前置条件` frames, revising drifts such as `Baseline Measurement and Sensor Calibration` -> `Final Reporting` while allowing genuinely supported dependency answers. | Implemented baseline |
| Grounded drafts must not keep the same explicit location relation while swapping the supported location | `answerReleaseReview.ts` now enforces `claim_location_consistency` on comparable `located in` / `位于` frames, revising drifts such as `main chamber` -> `auxiliary chamber`; locative predicates are excluded from `claim_state_consistency` extraction so the location slice owns the contradiction. | Implemented baseline |
| Grounded drafts must not keep the supported fact tail while swapping the grounded subject | `answerReleaseReview.ts` now enforces `claim_subject_consistency` on comparable subject-tail frames, revising subject drift such as `Water density` -> `Glass density` even when the numeric tail still matches support. | Implemented baseline |
| Grounded drafts must not keep the same subject and explicit attribute frame while swapping the supported attribute | `answerReleaseReview.ts` now enforces `claim_attribute_consistency` on comparable `has` / `have` / `具有` frames, revising drifts such as `moderate thermal insulation` -> `high thermal insulation` while allowing compatible refinements. | Implemented baseline |
| Same-subject state contradictions must be revised before release | `answerReleaseReview.ts` now enforces `claim_state_consistency` on comparable definition/copula frames across English and Chinese evidence. | Implemented baseline |
| Grounded drafts must not reverse DAG-backed cause/effect direction | `answerReleaseReview.ts` now enforces `claim_graph_causal_consistency` on assembled `causal` edges from `connectionPaths`, `knowledgePointRelations`, and predecessor/successor windows, revising reversed cause/effect claims into deterministic correction sentences. | Implemented baseline |
| Grounded drafts must not restate a single-family DAG comparison pair as the opposite comparison family | `answerReleaseReview.ts` now enforces `claim_graph_comparison_consistency` on assembled `contrast` / `analogy` evidence when the graph supports only one comparison family for that title pair. | Implemented baseline |
| Grounded drafts must not present temporally flagged DAG evidence as a current answer | `answerReleaseReview.ts` now enforces `claim_temporal_validity_consistency` from `graphContext.temporalValidity`, revising unqualified current-tense releases while allowing explicit time qualification and avoiding supersedes-only false positives. | Implemented baseline |
| Right-pane source preview must consume source-to-render provenance when available | `markdown_runtime.js` now annotates rendered blocks with source-line metadata, and `workspace_panes.js` prefers `source_line_provenance` while reporting provenance coverage counts. | Implemented baseline |
| Right-pane source preview must highlight the matched fragment, not only the whole paragraph | `workspace_panes.js` now projects matched evidence fragments into inline highlight markup inside the selected node, prefers snippet-sized source-authenticated fragment projection inside already-authenticated blocks, and reports both `inlineHighlightCount` and `inlineHighlightStrategy`. | Implemented baseline |
| Right-pane source preview must highlight the correct paragraph even when snippet text repeats | `workspace_panes.js` now prefers trustworthy `line_window` anchors and scores candidate rendered nodes with specificity/container penalties. | Implemented baseline |
| Stale line metadata must not force the wrong highlight | `workspace_panes.js` now distrusts stale line windows and falls back to `snippet_fallback`; frontend tests pin the failure mode. | Implemented baseline |
| The screenshot-backed `waterglass` failure must remain a formal acceptance rule | `scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh` now expects grounded output, reviewer/public-answer parity, no diagnostic leakage, and no `本技术文档旨在` meta-answer fallback. | Implemented |
| The active remaining gap must move to broader contradiction coverage and narrower unresolved provenance | Current code still needs wider claim-vs-citation / claim-vs-evidence conflict checks beyond the lexical + query-intent + structured + structured-comparison + attribute + containment + composition + purpose + dependency + location + subject + state + polarity + graph-causal + graph-order + graph-comparison + temporal-validity stack, plus explicit span offsets or richer AST provenance to disambiguate identical repeated fragments inside one authenticated block. | Open |

Verification for this re-audit:

- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts src/export/WorkspaceExportBundle.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `npm.cmd run build:mini`
- `node scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh`

## 2026-06-18 Final Reply Release Review and Correction Layer

This slice closes a structural robustness gap in the agent path: the system already had retrieval, DAG context assembly, answer composition, evidence panes, and workflow artifacts, but it still lacked a first-class owner for the last decision before public release.

That missing owner is now implemented as `src/learning/answerReleaseReview.ts`.

What is now true in code:

- `conversationComposer.ts` still drafts the answer, but no longer owns the final public release by itself.
- the new reviewer evaluates deterministic gates for:
  - evidence sufficiency,
  - graph support sufficiency,
  - public-surface contraction,
  - internal diagnostic leakage,
  - abstention hygiene.
- the reviewer can now `release`, `revise`, or `abstain`.
- the reviewer now also enforces `claim_grounding_alignment`, using lightweight lexical overlap across ASCII and CJK support features so evidence-backed draft drift can trigger revision instead of release.
- scoped Chinese misses now produce Chinese abstentions instead of falling back to English diagnostic-heavy text.
- reviewer state is retained additively in:
  - `AgentConversationResponse.answerReleaseReview`,
  - `AgentConversationTrace.answerReleaseReview`,
  - `KnowledgeRun.answerReleaseReview`.
- `KnowledgeLearningPlatform.ts` persists that state into runtime responses and workflow-artifact payloads.
- operator-facing inspection now surfaces sanitized reviewer state in `knowledge_run` detail/history cards through `src/frontend/agent_workspace.js` and `src/frontend/workspace_panes.js`, without widening the main answer surface.
- `WorkspaceExportBundle.ts` now projects compact reviewer summaries into `runtime.knowledgeRunReports[*].answerReleaseReview`.
- that exported summary intentionally keeps only `reviewedAt`, `decision`, `revised`, `failedGateIds`, `leakedInternalFragmentCount`, and `reason`; full original/public answer text stays in workflow artifacts and traces instead of the compare-ready report surface.
- `WorkspaceExportBundle.ts` now also derives `runtime.knowledgeRunAnswerReleaseAuditSummary`, a longer-horizon aggregate built from the exported knowledge-run reports rather than from a second telemetry path.
- the operator history surface now renders the same aggregate `Release audit` shape from returned runs, covering reviewed/unreviewed counts, decision buckets, failed-gate counts, leak counts, revised runs, and latest review time.
- that same aggregate path now also carries `reviewTrend` windows and `failedGateAging` entries, so reviewer drift can be inspected as sequence data instead of only totals.
- that same aggregate path now also carries compare-ready drilldowns: recent/prior metric shifts, gate shifts, and the latest reviewed-pair delta; the run-compare card now surfaces answer-release deltas on top of the existing quality/graph comparison.
- `scripts/verify-knowledge-workspace-runtime.js` now treats reviewer presence and `publicAnswer === result.answer` parity as part of the runtime contract.

Why this matters:

- the earlier `waterglass` screenshot was not only a retrieval miss,
- it also showed that internal failure language could leak directly into the main answer surface,
- the new reviewer layer blocks that class of regression even when evidence is absent.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Final public answer must be reviewed before release | `src/learning/answerReleaseReview.ts` now owns the post-synthesis release decision. | Implemented |
| Unsupported answers must abstain cleanly | Empty-result debug-style drafts are now downgraded into concise abstentions. | Implemented |
| Grounded draft claims must stay aligned with their own support | `claim_grounding_alignment` now revises grounded drafts when lexical support overlap shows the answer drifting away from citations/knowledge points. | Implemented |
| Developers must be able to inspect the release decision | Review state is now stored on response, trace, and `KnowledgeRun`. | Implemented |
| Operators must see reviewer state without widening the main answer area | `agent_workspace.js` sanitizes `answerReleaseReview`, and `workspace_panes.js` renders release-review detail/history inside `knowledge_run` cards. | Implemented |
| Replay/export surfaces must retain reviewer state durably | `WorkspaceExportBundle.ts` now emits compact `answerReleaseReview` summaries inside `runtime.knowledgeRunReports`. | Implemented |
| Longer-horizon operator audit must reuse exported reviewer telemetry instead of adding another telemetry path | `WorkspaceExportBundle.ts` now derives `runtime.knowledgeRunAnswerReleaseAuditSummary`, and the history card renders the same multi-run release-audit shape. | Implemented baseline |
| Review trends and gate aging must also stay on the same audit path | `runtime.knowledgeRunAnswerReleaseAuditSummary` now carries `reviewTrend` and `failedGateAging`, and the history card renders both. | Implemented baseline |
| Operators must be able to compare recent reviewer drift without opening raw traces | The same audit path now derives metric shifts, gate shifts, and latest-pair deltas; the compare card also shows answer-release deltas between runs. | Implemented baseline |
| `waterglass` screenshot must become a formal regression gate | Runtime verifier now requires reviewer presence and rejects public-answer diagnostic leakage. | Implemented |
| Backward compatibility must remain explicit | `assistantMessage`, `answer`, and `assistantBlocks` remain valid; reviewer fields are additive. | Preserved |

Verification for this slice:

- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts src/learning/answerReleaseReview.test.ts src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/export/WorkspaceExportBundle.test.ts src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `npm run verify:knowledge-workspace:runtime`

## 2026-06-19 Structured Fact Contradiction Gate

The next robustness gap was narrower than release review itself but still material: lexical topic overlap can say that a draft is "about the right thing" while still missing a concrete contradiction in the facts being stated.

That gap is now partially closed in `src/learning/answerReleaseReview.ts` by a second deterministic reviewer layer: `claim_structured_consistency`.

What is now true in code:

- the reviewer now extracts high-confidence structured facts from the draft answer and grounded support:
  - numeric values with supported units such as `%`, `kg/m3`, `GPa`, `kPa`, `km/h`, and similar technical units,
  - year claims when the local context actually looks date-like rather than treating every 4-digit number as a year.
- structured-fact comparison is intentionally conservative:
  - if no comparable support fact exists, the gate does not invent a contradiction,
  - if support contains multiple values under the same anchor/unit family, any matching supported value is enough to avoid a false positive.
- the new gate is additive:
  - `src/learning/types.ts` now includes `claim_structured_consistency` in `AnswerReleaseGateId`,
  - operator surfaces and export telemetry keep working because they already consume gate IDs generically.
- grounded drafts are now revised when structured facts conflict even though lexical alignment still passes.
- grounded revisions are also slightly cleaner now: the reviewer no longer prefixes the title again when the support sentence already starts with an article + title phrase.

Why this matters:

- lexical alignment catches topic drift,
- it does not reliably catch `same subject, wrong number/year`,
- that means a reviewer that stops at lexical overlap can still release a materially wrong answer.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Contradiction detection must go beyond lexical overlap without becoming speculative | `answerReleaseReview.ts` now evaluates structured numeric/year consistency only when there is a high-confidence comparable support fact. | Implemented baseline |
| Numeric contradictions must trigger revision even when the topic still matches | `claim_structured_consistency` now fails and revises drafts such as `875 kg/m3` against supported `999.8 kg/m3`. | Implemented |
| Year contradictions must also be caught deterministically | The reviewer now revises date-like year conflicts such as `1935` vs grounded `1933`. | Implemented |
| Multi-value support must not create avoidable false positives | `answerReleaseReview.test.ts` now pins a case where support contains both `2500 kg/m3` and `999.8 kg/m3`, and the correct supported value still releases cleanly. | Implemented |

Verification for this slice:

- `npm.cmd exec -- tsc --noEmit`
- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/export/WorkspaceExportBundle.test.ts src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts src/learning/KnowledgeWorkspaceConversationRegression.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc`
- `node scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh`

## 2026-06-19 Polarity Contradiction Gate

The next contradiction gap after structured facts was still deterministic: a draft can keep the same topic words and even the same entity, but explicitly reverse the support by saying `is not` where the evidence says `is`.

That gap is now partially closed in `src/learning/answerReleaseReview.ts` by `claim_polarity_consistency`.

What is now true in code:

- the reviewer now extracts comparable answer/support sentences and classifies a narrow positive/negative polarity signal:
  - English negation paths such as `is not`, `do not`, `cannot`, and normalized contraction forms,
  - narrow Chinese negation paths such as `不是`, `并非`, `没有`, `不能`, `无法`.
- the gate is deliberately constrained:
  - it only compares sentences whose feature overlap is high enough to suggest the same claim skeleton,
  - if a comparable support sentence exists with the same polarity, it does not raise a conflict,
  - unrelated negative wording in support does not count as a contradiction by itself.
- the new gate is additive:
  - `src/learning/types.ts` now includes `claim_polarity_consistency` in `AnswerReleaseGateId`,
  - export and operator surfaces continue to work because they already consume gate IDs generically.
- grounded drafts are now revised when they explicitly reverse supported polarity even though lexical alignment still passes.

Why this matters:

- lexical alignment catches topic drift,
- structured consistency catches `same topic, wrong number/year`,
- polarity consistency catches `same topic, same entity, but the claim was said backwards`.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Reviewer contradiction coverage must include explicit positive/negative reversals | `answerReleaseReview.ts` now evaluates `claim_polarity_consistency` on high-overlap comparable sentences. | Implemented baseline |
| English explicit polarity reversals must trigger revision | `answerReleaseReview.test.ts` now pins `Water glass is not ...` against grounded `Water glass is ...`. | Implemented |
| Chinese explicit polarity reversals must also trigger revision | `answerReleaseReview.test.ts` now pins `水杯不是...` against grounded `水杯是...`. | Implemented |
| Unrelated support negation must not create an avoidable false positive | `answerReleaseReview.test.ts` now pins a case where support includes `Water glass is not plastic` but the public answer correctly states `Water glass is a transparent container filled with water.` | Implemented |

Verification for this slice:

- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/export/WorkspaceExportBundle.test.ts src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts src/learning/KnowledgeWorkspaceConversationRegression.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc`
- `node scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh`

## 2026-06-19 DAG Order Consistency Gate

The next gap was not another generic verifier problem. It was specific to this project: the current DAG was already being assembled into graph context, but the final-answer reviewer still was not treating DAG direction as a release invariant.

That gap is now partially closed in `src/learning/answerReleaseReview.ts` by `claim_graph_order_consistency`.

What is now true in code:

- the reviewer now consumes the existing assembled DAG evidence rather than a new graph runtime:
  - `connectionPaths`,
  - `knowledgePointRelations`,
  - `predecessorWindow`,
  - `successorWindow`.
- the first supported directional checks are intentionally narrow:
  - `prerequisite`,
  - `sequence`.
- the gate only reacts when the draft itself makes an explicit order claim between grounded titles.
- when the draft reverses supported order, the reviewer now revises the public answer with a deterministic correction sentence instead of falling back to a generic summary.
- `src/learning/answerReleaseReview.test.ts` now pins three important behaviors:
  - prerequisite reversal forces `revise`,
  - correct prerequisite direction still `release`s cleanly,
  - sequence reversal forces `revise`.
- this closes part of the earlier DAG-underuse criticism:
  - the project DAG is no longer only answer-planning context,
  - it is now also a release-time contradiction boundary.
- this slice does not solve the right-pane file-preview/highlight issue by itself:
  - the click/render path already exists in `workspace_panes.js`,
  - the remaining gap is payload-contract stability for source paths and matched spans.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| The assembled DAG must influence the final release decision, not only answer composition | `answerReleaseReview.ts` now evaluates `claim_graph_order_consistency` from graph-context directionality. | Implemented baseline |
| Reversed `prerequisite` claims must be corrected before release | Reviewer now revises drafts such as `Ground State is a prerequisite for Bridge Layer.` into a DAG-grounded correction. | Implemented |
| Reversed `sequence` claims must also be corrected before release | Reviewer now revises drafts such as `Response Validation comes before Baseline Measurement.` when the DAG says the opposite. | Implemented |
| Right-pane source/highlight failures still need a separate owner | The graph-focus render path already exists; the unresolved issue is payload quality, not missing frontend click wiring. | Still open |

Verification for this slice:

- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `node scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh`

## 2026-06-19 Graph-Focus Payload Contract Hardening

The next closed gap was not public-answer release review itself but the evidence-usability boundary beside it. The click/render path already existed. The failure was that grouped knowledge hits could still carry the real source path or evidence snippet only inside citation-backed fields, while `workspace_panes.js` mainly trusted raw top-level `sourcePath` / `matchedSpan.sourcePath` data.

What is now true in code:

- `src/frontend/workspace_panes.js` now normalizes `matchedSpans` from both raw span fields and `span.citation`, including:
  - `title`,
  - `snippet`,
  - `sourcePath`,
  - `startLine`,
  - `endLine`.
- `buildKnowledgePointFocusPayload(...)` now derives additive `candidateSourcePaths` before opening graph focus.
- `resolveKnowledgePointSourcePath(...)` no longer stops at the first raw field. It now scans:
  - top-level `sourcePath`,
  - top-level `citation.sourcePath`,
  - `citations[*].sourcePath`,
  - `matchedSpan.sourcePath`,
  - `matchedSpan.citation.sourcePath`.
- `resolveGraphFocusCandidatePaths(...)` now consumes the additive candidate list, so grouped knowledge hits remain previewable even when they do not carry a single canonical top-level path.
- `src/agent_workspace.frontend.test.ts` now pins two concrete failure modes:
  - citation-backed snippets must still highlight after markdown render,
  - citation-backed paths must still open source content when the top-level hit path is missing.
- The screenshot-derived `waterglass` runtime verifier remains the public-answer acceptance owner; these new frontend contract tests complement it by protecting the operator evidence surface.

Why this matters:

- release-review robustness and right-pane evidence usability are different owners;
- a clean public answer is still not enough if operators cannot open the supporting source reliably;
- this is also why the `ref/` frameworks are not the fix owner here: the problem was local payload invariants, not prompt orchestration.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Right-pane preview must not depend on one raw top-level hit path | `workspace_panes.js` now derives additive `candidateSourcePaths` from item, citation, citation list, span, and span-citation surfaces. | Implemented |
| Highlighting must survive snippet gaps when citation still carries the evidence text | `normalizeMatchedSpans(...)` now backfills `snippet` from `span.citation.snippet` before highlight-term extraction. | Implemented |
| Grouped knowledge hits with missing top-level path must still open the original document | `resolveKnowledgePointSourcePath(...)` now scans citation-backed path sources instead of stopping at the first raw span path. | Implemented |
| Screenshot-backed runtime acceptance must remain formal | `verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh` remains required; the new frontend graph-focus tests complement that gate instead of replacing it. | Preserved |

Verification for this slice:

- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts src/export/WorkspaceExportBundle.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`

## 2026-06-18 Shared Alias/Scope Regression Corpus and Soft-Miss Recovery

The screenshot-backed `waterglass` failure is no longer treated as a one-off manual check. The project now has a shared deterministic regression corpus at `src/learning/KnowledgeWorkspaceConversationRegression.ts`, and the first corpus matters for two reasons:

1. it turns alias/scope correctness into an explicit contract shared by Jest and runtime verification,
2. it exposed a real retrieval bug that the single `waterglass` happy-path pair would not catch.

What is now true in code:

- the corpus includes four deterministic conversation cases:
  - `waterglass_explicit_scope_compact_zh`,
  - `waterglass_explicit_scope_spaced_zh`,
  - `financial_scope_recovery_spaced_en`,
  - `financial_scope_recovery_compact_en`.
- the screenshot-derived case `waterglass_explicit_scope_compact_zh` is now the durable acceptance owner for `1781782257390.jpg`, not just an anecdotal repro.
- `src/learning/KnowledgeWorkspaceConversationRegression.test.ts` runs the same corpus in-memory and deliberately injects `financial/liquidity.md`, `financial/glass steagall act.md`, and `financial/watered stock.md` as noisy in-scope distractors.
- `scripts/verify-knowledge-workspace-runtime.js` now loads the built corpus module by default when no ad hoc `--query` is supplied, and it also supports targeted `--case` execution.
- `KnowledgeLearningPlatform.ts` now applies planner scope recovery through `shouldApplyPlannerScopeRecovery(...)` instead of checking only `rerankedItems.length <= 0`.
- recovery now triggers in two situations:
  - hard miss: no reranked items survive,
  - soft miss: reranked items survive, but none of them belong to planner title-hit documents.

Why the soft-miss bug mattered:

- a scoped retrieval system can return non-empty noise and still be wrong,
- absolute zero-result logic misses that class of failure,
- the `financial` recovery cases prove this exact issue because `glass steagall act` and `watered stock` can survive as scope-local noise even though the correct title-hit document is `Knowledge_Base/waterglass/water glass.md`.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Alias/scope regression coverage must be explicit and shared | `KnowledgeWorkspaceConversationRegression.ts` is now the shared deterministic corpus consumed by Jest and runtime verification. | Implemented |
| Runtime verification must cover more than the single `waterglass` control pair | `verify-knowledge-workspace-runtime.js` now defaults to the shared corpus and supports `--case` selection. | Implemented |
| Scope recovery must handle soft misses, not only zero-result misses | `KnowledgeLearningPlatform.ts` now uses `shouldApplyPlannerScopeRecovery(...)` to recover when no planner title-hit document survives reranking. | Implemented |
| Cross-scope recovery must survive realistic in-scope noise | The `financial` recovery cases add noisy in-scope documents and still require grounded recovery into `Knowledge_Base/waterglass/water glass.md`. | Implemented |

Verification for this slice:

- `npm.cmd exec -- jest src/learning/KnowledgeWorkspaceConversationRegression.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/learning/answerReleaseReview.test.ts src/learning/conversationComposer.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `npm run verify:knowledge-workspace:runtime`

## 2026-06-18 Compact-Alias Scoped Retrieval Regression

This slice closes the screenshot-backed runtime failure where `scope=waterglass` plus the prompt `什么是waterglass?` returned:

- `No scoped knowledge points matched "..."`
- planner title/document hits in trace,
- but zero evidence-bearing retrieval candidates after reranking.

The important conclusion is architectural, not cosmetic:

- scope normalization was already working,
- planner title-like expansion was already working,
- the failure was the lexical contract between planner normalization and retrieval scoring.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Compact mixed-language aliases must retrieve evidence inside an explicit scope | `KnowledgeLearningPlatform.buildQueryBackendContext()` now expands retrieval `queryTokens` from the raw query plus planner-derived title-like variants and passes explicit `queryVariants`. `queryBackend.ts` consumes those variants for semantic token build, anchor inference, and title matching. | Implemented |
| Runtime verification must cover the real regression, not only the spaced control query | `scripts/verify-knowledge-workspace-runtime.js` now defaults to the shared alias/scope corpus, which includes the `waterglass` pair plus cross-scope recovery cases, and `package.json` exposes `npm run verify:knowledge-workspace:runtime`. | Implemented |
| Fix direction must stay at the retrieval boundary, not drift into prompt-framework adoption | The fix is local TypeScript runtime normalization. DSPy/Guidance/Semantic Kernel/LangChain/LiteLLM remain design references, not runtime dependencies or bug-workarounds. | Confirmed |

Verification for this slice:

- `npm.cmd exec -- jest src/learning/queryBackend.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/server.migration.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `npm.cmd run verify:knowledge-workspace:runtime`

## 2026-06-17 Agent Knowledge DAG Answer Contract

This slice updates the Knowledge Workspace graph/RAG direction after clarifying that "graph structure" means the project's existing DAG-shaped learning data, not a generic graph database replacement.

Implemented or documented in this slice:

- the new bilingual source-of-truth note is `docs/solutions/agent-knowledge-dag-answer-contract-plan-2026-06-17.md`,
- the open-source review boundary is explicit: DSPy, Guidance, Semantic Kernel, LangChain Core, and LiteLLM are design references under `ref/`, not runtime dependencies,
- `AgentConversationGraphContext` now has an optional `connectionPaths` surface,
- `KnowledgeLearningPlatform` can enrich conversation graph context with explicit store-backed paths between returned knowledge points and the anchor when an ops-capable store is available,
- `conversationComposer` now keeps public `answer` / `directAnswer` output narrow instead of embedding citation lists, graph paths, memory notices, or knowledge-run diagnostics,
- `conversationComposer` can use those explicit paths in structured answer sections,
- `queryBackend.ts` now recognizes Chinese compare/how-to/explain markers in graph intent detection, and direct compare branches (`contrast` / `analogy`) receive a calibrated structural promotion over reference-only notes,
- `conversationComposer.ts` now treats `graph_comparison_branch` as a real branch-difference gate: reference-only support no longer passes compare quality checks unless contrast/analogy or multi-branch structure is actually present,
- `workspace_panes.js` renders connection paths in the evidence pane,
- `knowledge_run` workflow artifacts now also retain `graphContext`, and the knowledge-run inspection card exposes graph context plus graph diagnostics for operator review,
- recent-run history and run-to-run comparison cards now also surface compact graph telemetry, so operator review is no longer limited to single-run inspection,
- `WorkspaceExportBundle` now exposes durable `runtime.knowledgeRunReports`, carrying compare-ready graph signal summaries for offline replay and operator analysis,
- `workspace_panes.js` now retries graph-focus source rendering against matched-span candidate paths, records requested/candidate/attempted/resolved source-path diagnostics, and exposes those diagnostics inside the right pane when fallback or path fallback occurs,
- the agent workspace now persists interesting graph-focus diagnostics into session state instead of leaving them frontend-local only,
- later conversation/study-session session-state updates now preserve prior graph-focus report history instead of overwriting unrelated `panelState` domains,
- `WorkspaceExportBundle` now also derives durable `runtime.graphFocusReports`, so graph-focus failures and path-fallback events can be replayed without scraping raw `panelState`,
- `WorkspaceExportBundle` preserves connection paths in exported conversation trace graph context,
- focused tests cover graph-path composition, platform enrichment, frontend evidence rendering, locale labels, and export serialization.

Code-vs-plan reconciliation:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Public answer should not dump every internal artifact | `answer` / `directAnswer` now stays targeted; graph connection paths, citations, temporal detail, and knowledge-run diagnostics are secondary inspection data. | Implemented current slice |
| Hide developer-heavy support material for now | Graph paths, temporal details, citations, and traces belong in evidence/export surfaces unless explicitly requested. | Preserved direction |
| File hit opens right pane with highlighted source | Graph-focus now retries source rendering across payload + matched-span candidate paths, preserves highlighted markdown rendering, exposes requested/candidate/attempted/resolved-path diagnostics in the pane, persists interesting diagnostics into session state, and exports stable summaries as `runtime.graphFocusReports`. | Implemented broadened P4 slice |
| Use the current DAG | `KnowledgeAtom`, `RelationEdge`, `TemporalEdge`, store ops, and `findPath` are the active graph substrate. | Confirmed |
| Let the LLM inspect graph structure | A bounded `graphContextAssembler` now selects the anchor, reorders support nodes, attaches explicit paths, and adds predecessor/successor windows plus diagnostics before answer synthesis. | Implemented P1 foundation |
| Retrieval uses graph structure instead of shallow degree bonus | `queryBackend.ts` now applies anchor distance, directed path confidence, prerequisite depth, temporal invalidity penalties, and relation-intent bonuses in `local_hybrid` / `local_vector`. Chinese compare/how-to/explain markers are now included in intent detection, and direct compare branches are explicitly calibrated against lexically stronger reference notes. | Implemented broader P2 slice |
| Graph-specific answer quality gates | `knowledgeRun.quality.gates` now checks prerequisite ordering, comparison branches, temporal warnings, graph-op fallback, and bounded graph budgeting. The comparison gate has also been tightened so reference-only support does not pass as branch structure. | Implemented broader P5 slice |
| Full DAG-native answer planning | The assembler, graph-aware ranking, graph-quality gates, graph-focus diagnostics, single-run inspection, history, and run-to-run comparison surfaces are real, but the model still needs calibration breadth and longer-run operator evidence. | Calibration pending |

Immediate next direction:

1. Calibrate the new graph-aware ranking and graph-quality-gate model against more real-world regressions and operator evidence.
2. Calibrate the replay/export operator surfaces now that `knowledge_run` telemetry is exported as `runtime.knowledgeRunReports` and graph-focus diagnostics are exported as `runtime.graphFocusReports`.
3. Keep the public answer focused while graph/evidence/developer detail remains inspectable through evidence panes, traces, artifacts, and export bundles.

## 2026-06-10 Knowledge Workspace Durable Artifact and DAG Alignment

This slice reconciles the current codebase against the earlier lightweight-RAG and agent-workspace plans, with special focus on the existing DAG-backed learning substrate.

The key result is that the current code has moved further than the old plan wording suggested:

- the Knowledge Workspace is no longer just a thin scoped-chat shell,
- workflow artifacts now include durable `flashcard_batch` and `knowledge_run` records,
- reply rendering now has a typed structured-answer path,
- workflow-artifact review follow-up is part of the runtime surface,
- graph focus can render original markdown with matched-span highlighting,
- a dedicated evidence pane now carries grounding inspection plus durable `knowledge_run` and `flashcard_batch` inspection,
- grouped conversation knowledge points now retain relation-path and temporal-validity signals,
- the composer now materializes an explicit `graphContext`,
- that `graphContext` now survives through conversation trace, snapshot persistence, and workspace export,
- the grounding inspector now renders that persisted `graphContext` as structured graph evidence,
- relation aggregation now spans the whole grouped knowledge-point set instead of only the leading anchor's local hint set,
- direct grouped-knowledge-point relations are now preserved as first-class graph-context data instead of only implicit edge membership,
- temporal-validity aggregation now preserves temporal edge kinds/details in addition to warning text,
- supersession details now also influence explanation and next-action text instead of staying limited to warning-only evidence,
- and grounding inspectability is now normalized per turn so later turns without grounding payload do not keep stale evidence-pane state alive.

At the same time, the product surface is still behind the intended final behavior:

- the primary answer area is now contracted to user-facing reply blocks only,
- left-side knowledge hits now route directly into graph focus as file-only entries,
- the existing DAG substrate is real, but answer synthesis still behaves more like evidence-grouped text RAG than graph-native answer planning.

Code-vs-plan reconciliation for this slice:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Structured grounded conversation with backward compatibility | `src/learning/types.ts`, `src/learning/conversationComposer.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/agent_workspace.js`, and `src/frontend/workspace_panes.js` now support `answer`, `assistantBlocks`, `knowledgeRun`, grouped `knowledgePoints`, citations, and legacy `assistantMessage`; the primary assistant area now limits visible blocks to user-facing reply content. | Implemented current slice |
| Durable learning/review artifacts | `src/workflows/WorkflowArtifactStore.ts`, `src/learning/KnowledgeLearningPlatform.ts`, and `src/routes/knowledge.ts` now support durable `flashcard_batch` / `knowledge_run` artifacts plus `/api/knowledge/workflow-artifacts` and `/api/knowledge/workflow-artifacts/review-follow-up`; `workspace_panes.js` now routes their inspection into a dedicated evidence pane. | Implemented current slice |
| File-first scoped knowledge hits | `workspace_panes.js` renders grouped knowledge hits by source file and routes file selection into graph focus instead of inline preview/action expansion. | Implemented current slice |
| Right-pane evidence reading | Graph focus reuses the shared markdown runtime and highlights matched spans in rendered source markdown. | Implemented baseline |
| Answer area contraction to a single targeted answer | `conversationComposer.ts` now keeps `answer` / `directAnswer` targeted, and `agent_workspace.js` keeps the full conversation result in runtime state while only rendering user-facing answer blocks (`structured_answer`, `main_markdown`, `html_artifact`) in the main chat surface. | Implemented current slice |
| Hide developer-heavy evidence from the primary hit list | `workspace_panes.js` no longer renders inline knowledge previews or visible typed capability buttons in the left-side hit list; those flows now route into graph focus or the dedicated evidence pane. | Implemented current slice |
| Durable evidence/claim inspector | `workspace_panes.js` now exposes a dedicated evidence pane for grounding metadata, `knowledge_run`, `knowledge_run_history`, `knowledge_run_compare`, and `flashcard_batch`; `agent_workspace.js` wires the API status strip into grounding inspection and normalizes per-turn inspectability so stale grounding is cleared on later turns without evidence payloads. | Implemented broader current slice |
| DAG-native answer planning | `AgentConversationKnowledgePoint` now carries grouped `relationPath`, `relationKinds`, `relationPathAtomIds`, and `temporalValidity`; `conversationComposer.ts` now materializes an explicit `graphContext`; `KnowledgeLearningPlatform.ts` and `WorkspaceExportBundle.ts` now preserve it through trace, persistence, and export surfaces; `workspace_panes.js` now renders that persisted `graphContext` in the evidence pane as a structured graph explanation surface; relation and temporal aggregation now span the whole grouped knowledge-point set and preserve source-atom plus temporal-edge detail; direct grouped-knowledge-point relations are now preserved and surfaced; supersession details now also flow into explanation and next-action text. | Implemented broader partial slice |

Immediate next direction from this point:

1. Extend the new DAG-aware conversation slice into a dedicated graph-conditioned context-assembly layer instead of relying on grouped relation hints and the current still-thin `graphContext` alone.
2. Build on the new multi-point relation/temporal aggregation by adding richer predecessor/successor/path semantics and explicit supersession handling without expanding the primary chat transcript.
3. Continue ownership reduction across `src/server.ts`, `KnowledgeLearningPlatform.ts`, `agent_workspace.js`, and `workspace_panes.js`.

Verification for the current code-backed alignment:

- `npm.cmd exec -- tsc --noEmit`
- `node --check src/frontend/agent_workspace.js`
- `node --check src/frontend/workspace_panes.js`
- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/learning/KnowledgeLearningPlatform.persistence.test.ts src/learning/KnowledgeLearningPlatform.program-f.test.ts src/agent_workspace.frontend.test.ts src/knowledge.api.contract.test.ts src/routes/registry.contract.test.ts src/pathbridge.handshake.contract.test.ts src/server.port.fallback.contract.test.ts src/workflows/WorkflowArtifactStore.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts src/agent_workspace.contract.parity.test.ts src/agent_workspace.runtime.behavior.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/export/WorkspaceExportBundle.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/export/WorkspaceExportBundle.test.ts src/learning/KnowledgeLearningPlatform.persistence.test.ts src/learning/KnowledgeLearningPlatform.program-f.test.ts --runInBand --no-cache`
- `npm.cmd run test:agent-workspace:contracts`
- `npm.cmd run build`

## 2026-06-06 Knowledge Workspace Scope Switcher and Evidence-Focused Hit UI

This slice closes the frontend usability gap that made the active RAG scope hard to see from inside the Knowledge Workspace itself.
The prior implementation depended on the global folder selector and request payload state, so users could ask a scoped question without a local, task-adjacent confirmation of the actual retrieval boundary.
It also rendered summaries, citations, matched sections, and actions in every hit card, which pushed the question/reply area out of view after results returned and increased first-level choice density.

Code-vs-plan reconciliation for this slice:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Show and switch the Knowledge Workspace scope in the workspace window | `src/frontend/index.html` now includes an in-pane `agent-workspace-scope-select`; `src/frontend/agent_workspace.js` mirrors the global `folder-select`, publishes the same active-target event, updates `localStorage.nc_last_target`, and sends `activeTarget` plus `scope` with conversation requests. | Implemented |
| Keep the question/reply area visible after hits return | `src/frontend/styles.css` gives chat messages a stable flex floor and caps the knowledge-hit list height, so the conversation stream and input remain part of the active workspace instead of being displaced by result cards. | Implemented |
| Show only interactive knowledge-point filenames at the first level | `src/frontend/workspace_panes.js` now renders each knowledge point as a file button resolved from `sourcePath`, `citation.sourcePath`, or `matchedSpans[0].sourcePath`; summaries, scores, citations, and matched section snippets are no longer first-level card content. | Implemented |
| Move secondary actions behind a long-press/context menu | Typed capability buttons remain backward-compatible, but are hidden in `agent-knowledge-actions-menu` until long-press, context menu, or keyboard context-menu activation opens them. | Implemented |
| Highlight matched passages in the right pane | Clicking the filename opens the graph-focus pane with the knowledge point title and `matchedSpans`, rendering each matched passage as highlighted evidence. | Implemented |
| Bilingual locale and contract compatibility | `agentWorkspace.scope.*` and new knowledge action labels are present in both frontend locale bundles, and the locale contract test verifies key coverage and placeholder parity. | Preserved |

Verification for this slice:

- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts -t "scope selector|knowledge hits as file entries" --runInBand`
- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts --runInBand`
- `npm.cmd exec -- jest src/agent_workspace.locale.contract.test.ts --runInBand`
- `node --check src/frontend/agent_workspace.js`
- `node --check src/frontend/workspace_panes.js`
- `npm.cmd run build`

## 2026-06-07 Graph-Focus Source Rendering and AhaDiff Comparison

This slice corrects a remaining mismatch between the intended Knowledge Workspace interaction and the actual right-side graph-focus pane behavior.
The earlier implementation opened the right pane with `matchedSpans`, but only rendered a compact evidence list.
That meant the user could not inspect the original knowledge point in its normal rendered form and therefore could not see matched passages highlighted in-place.

Code-vs-plan reconciliation for this slice:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Render the original knowledge point in the right pane | `src/frontend/workspace_panes.js` now resolves `sourcePath`, reads the original markdown through `NoteConnectionStorage.readContent()`, and renders it through the shared `NoteConnectionMarkdownRuntime.renderMarkdownInto()` path instead of falling back to a snippet-only card. | Implemented |
| Highlight matched passages inside the normal rendered document | The graph-focus pane now scores rendered paragraphs/blocks against `matchedSpans[].snippet` terms and applies a restrained highlight style in `src/frontend/styles.css` via `.agent-focus-match` / `data-agent-focus-highlight`. | Implemented |
| Preserve backward compatibility when source rendering is unavailable | The previous summary + evidence-list view remains the fallback path when source markdown, storage access, or markdown runtime rendering is unavailable. | Preserved |
| Keep the pane inside the same Reader-aligned rendering substrate | The focus pane reuses the same markdown runtime owner already used by the Tauri reply surface rather than creating a second markdown/mermaid/math render stack. | Implemented |

Verification for this slice:

- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts -t "graph focus|knowledge hits as file entries" --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`

### AhaDiff comparison and implications

The latest `ref/ahadiff` codebase makes three moves that are directly relevant to this project's next phase.

1. It treats claims, evidence, runtime validation, and review state as first-class product surfaces, not hidden backend details.
   Evidence in `ref/ahadiff/src/ahadiff/claims/verify.py` is verified against concrete file/hunk anchors instead of being treated as a loose text summary problem.
   Viewer-side API boundaries are runtime-validated in `ref/ahadiff/viewer/src/api/schemas.ts`, which prevents UI drift from silently accepting malformed payloads.
2. It productizes memory/review/challenge loops as durable state, not just one-shot outputs.
   `review.sqlite` is guarded as a real persistence boundary in `ref/ahadiff/src/ahadiff/review/database.py`, and the challenge loop in `ref/ahadiff/src/ahadiff/challenge/engine.py` converts missed understanding back into new learning signals.
3. Its UI is organized around explicit task surfaces with typed stores, typed API clients, and route-level product pages.
   The viewer separates shell, API schemas, Zustand state, and focused pages/components rather than letting one large host file own too much of the interaction model.

For this project, that comparison sharpens the next gaps:

| Area | Current NoteConnection position | Gap vs AhaDiff-style maturity | Next move |
|---|---|---|---|
| Evidence model | Scoped citations and `matchedSpans` exist, but evidence is still mostly conversation-output metadata. | Missing a first-class evidence ledger that can survive beyond one answer turn and be reused by later agent flows. | Introduce a durable evidence/claim projection for agent answers and learning artifacts. |
| Runtime contract validation | TypeScript contracts exist, but runtime response validation is still uneven across the frontend boundary. | UI can still trust structurally malformed payloads too often. | Expand runtime schema validation at the agent-workspace API boundary, especially for richer assistant payloads and future learning-state endpoints. |
| Durable learning loop | Conversation memory exists, but challenge/review/adaptation loops are still shallow. | Missing a mechanism that turns failed understanding or weak answers back into future tasks/review signals. | Build an explicit agent learning loop: answer -> inspect evidence -> mark confusion/gap -> schedule guided follow-up. |
| UI information architecture | Tauri workspace is improving, but large host files still own too much orchestration and the workspace still mixes retrieval, action, and diagnostics surfaces densely. | Interaction surfaces are less modular and less stateful than AhaDiff's page/store split. | Continue extracting workspace surfaces behind clear owners and move high-density diagnostics/learning views toward typed state modules. |
| Cross-run quality governance | Foundation and runbook gates exist, but answer quality and learning effectiveness are not yet tracked with the same durability. | Missing a stable quality ratchet for agent-grounded learning outcomes. | Add persistent answer-quality / evidence-coverage / follow-up-effectiveness history that can drive policy rather than just reporting snapshots. |

## 2026-06-06 Active-Scope Miss Recovery and Document-Augmented RAG Patch

This patch resolves the live "what is water glass?" failure that reproduced while the WebView was already running on `npm run tauri:dev:mini:gpu`.

Runtime probes showed that the current sidecar could answer correctly when called with an explicit `waterglass` scope: it returned one grouped knowledge point, eight citations, and `matchedSpans`.
The WebView, however, had `folder-select=financial`, `localStorage.nc_last_target=financial`, and `window.__NC_ACTIVE_SOURCE_TARGET.scope.sourcePathPrefixes=["Knowledge_Base/financial"]`.
The user question was therefore sent as a scoped financial query. The existing planner found the global title-like `water glass` document, but then intersected that document id with the explicit financial workspace/corpus/prefix scope, reducing the retrieval candidate set to zero indexed atoms.

Code-vs-plan reconciliation for this patch:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| Positive answer when the selected scope misses but the query clearly names another knowledge point | `buildQueryBackendContext()` now distinguishes title hits inside the requested scope from title hits outside it. If an explicit scope has no compatible title hit but a document title/alias hit exists elsewhere, retrieval switches to a document-only `planner_scope_recovery` scope instead of intersecting incompatible corpus constraints. | Implemented |
| Return results by knowledge point, not duplicated sections | The prior document-level conversation grouping remains intact. The recovery query still returns segment-level evidence internally, then `mergeAgentConversationKnowledgePoints()` groups hits by `documentId` and exposes `matchedSpans` inside the single knowledge-point card. | Implemented |
| RSE + document augmentation direction | The implementation keeps Relevant Segment Extraction behavior at retrieval time while adding document augmentation at planning time: title-like queries can recover the target document, and section hits inside that document become marked evidence spans rather than duplicated cards. | Operational baseline |
| User-visible diagnosis of scope behavior | The Knowledge Workspace API status strip now includes the active scope label and, when recovery is used, the recovered source path. This directly exposes cases such as "Scope: financial" plus "Recovered: Knowledge_Base/waterglass/water glass.md". | Implemented |
| Backward compatibility | Public response fields remain additive. Existing `assistantMessage`, `answer`, `assistantBlocks`, citations, and legacy sync/SSE flows remain supported. `scopeSource` gains a new optional value, `planner_scope_recovery`, without removing existing values. | Preserved |

Verification for this patch:

- Red/green backend regression: `KnowledgeLearningPlatform.test.ts` now covers `financial` active scope plus a `water glass` title-like query recovering the `waterglass` document and returning one grouped knowledge point with multiple matched spans.
- Red/green frontend regression: `agent_workspace.frontend.test.ts` now covers status-strip scope and recovered-source visibility.
- Live root-cause evidence: CDP showed the running WebView was scoped to `financial`; direct sidecar probing with `waterglass` scope returned grouped evidence correctly.

## 2026-06-06 Knowledge Workspace RAG Answering and API Observability Slice

This update closes a practical Knowledge Workspace gap observed while `npm run tauri:dev:mini:gpu` was already running: the live sidecar could retrieve scoped `waterglass` evidence after hydration, but the user-facing answer still used the old "strongest scoped match" template and returned repeated section-level cards from the same knowledge point.

Code-vs-plan reconciliation for this slice:

| Requirement | Current implementation evidence | Progress call |
|---|---|---|
| User-visible API call status | The Knowledge Workspace now renders a compact API status strip for `/api/knowledge/conversation`, including idle/pending/ok/error state, transport (`SSE` or sync fallback), latency, knowledge-point count, citation count, and memory count (`src/frontend/index.html`, `src/frontend/agent_workspace.js`, `src/frontend/styles.css`). | Implemented |
| Direct grounded answers | `agentConversation()` now composes the top-level `answer` and `Scoped Answer` block from the best retrieved evidence sentence first, then appends grounding counts and citations. It no longer forces successful explanation turns to start with "The strongest scoped match is..." (`src/learning/KnowledgeLearningPlatform.ts`). | Implemented |
| Knowledge-point grouping | Conversation responses preserve low-level `queryKnowledge()` atom granularity internally, but group user-facing `knowledgePoints` by `documentId`, exposing optional `atomIds`, `documentId`, `sourcePath`, `matchedSpans`, `citations`, and `matchCount` for document-augmented UI rendering (`src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts`). | Implemented |
| RSE/document augmentation direction | The response shape now separates retrieval evidence spans from the knowledge-point card identity, so repeated hits inside one document are shown as matched spans inside one card rather than duplicate cards. This is the current lightweight RSE-style boundary: retrieval remains segment-level; answer/UI presentation becomes evidence-grouped and document-augmented. | Operational baseline |
| Runtime caveat | A running `server.exe` sidecar does not hot-swap TypeScript/backend changes. `npm run build` and `npm run ensure:sidecar:dev` prepare the fixed dev sidecar, but the currently open `tauri:dev:mini:gpu` window must be restarted to load the rebuilt backend binary. | Operational note |

Verification for this slice:

- Red/green regression coverage: `KnowledgeLearningPlatform.test.ts` now verifies direct `water glass` answering plus grouped matched spans; `agent_workspace.frontend.test.ts` verifies grouped hit rendering and the API status panel.
- Reconfirmed locally: `npm.cmd exec -- jest src/learning/KnowledgeLearningPlatform.test.ts --runInBand`, `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts --runInBand`, `npm.cmd exec -- jest src/server.migration.test.ts -t "conversation route auto-hydrates|knowledge/conversation" --runInBand`, `npm.cmd exec -- jest src/agent_workspace.contract.parity.test.ts src/agent_workspace.runtime.behavior.test.ts --runInBand`, `node --check src/frontend/agent_workspace.js`, `node --check src/frontend/workspace_panes.js`, `npm.cmd run build`, and `npm.cmd run ensure:sidecar:dev`.

## 2026-06-06 Mainline Architecture Progress and Code-vs-Plan Reconciliation

This update reconciles the current `main` codebase against the May architecture plans and supersedes any stale reading that treats Program F delivery as the same thing as release-grade foundation closure.

Current source-of-truth references:

- Detailed bilingual plan: [Architecture Progress Alignment and Mainline Plan (2026-06-06)](../../../solutions/architecture-progress-alignment-2026-06-06.md)
- Prior RAG/agent plan: [Multiplatform Lightweight RAG and Agent Architecture Plan](../../../brainstorms/2026-05-25-multiplatform-lightweight-rag-agent-architecture-plan.md)
- Prior substrate plan: [Deep Student Comparison Next-Phase Plan](../../../brainstorms/2026-05-26-deep-student-comparison-next-phase-plan.md)

Code-vs-plan reconciliation:

| Plan requirement | Current `main` evidence | Progress call |
|---|---|---|
| Scoped retrieval and workspace/corpus boundaries | `KnowledgeQueryRequest.scope`, `KnowledgeCorpusScope`, workspace readiness, miss diagnostics, active-target hydration, and workspace/export substrate exist across `src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/workspace/`, and `src/export/`. | Implemented baseline |
| Lightweight RAG and grounded conversation | `AgentConversationResponse` carries `answer`, citations, memory actions, trace, and backward-compatible `assistantBlocks`; frontend Tauri workspace renders typed blocks when present and still supports legacy `assistantMessage`. | Operational baseline |
| Durable resource/index/workspace/session/memory/export substrate | Program A-F code exists under `src/resources/`, `src/indexing/`, `src/workspace/`, `src/session/`, `src/workflows/`, `src/memory/`, and `src/export/`. | Implemented |
| Platform shell separation | `PlatformCapabilities`, `RenderMaterializer`, render routes, and workspace export bundles keep desktop/Godot/mobile materialization decisions explicit. Godot remains PNG-first because direct SVG import is unsafe. | Implemented |
| Runtime graphdb/ANN production closure | graphdb/sqlite, external graphdb HTTP, local-vector rollout controls, external HTTP vector acceleration, runtime capability checks, and rollout profile payloads exist. | Operational, not production-closed |
| Single route/runtime ownership | modular route registration exists, and runtime runbook modular-route operations now have a dedicated owner in `src/routes/runtimeRunbookRouteOps.ts`, but conversation, turn-cache, rollout, and other stateful fallback/orchestration logic still carry heavy ownership inside `src/server.ts`. | Partially complete |
| Architecture reduction | Current line-count scan shows `src/server.ts` about 15,920 lines and `src/learning/KnowledgeLearningPlatform.ts` about 10,351 lines; major frontend hosts remain large. | Behind target |

Architecture progress map:

| Layer | Current maturity | Next move |
|---|---|---|
| Graph/path core | Mature operational baseline | Preserve compatibility and avoid unrelated churn. |
| Runtime storage/retrieval | Operational baseline | Current Windows-host strict release-evidence history audit now passes at 3/3 for sqlite and ANN, readiness exposes it as `foundation_release_evidence_history`, and an opt-in multi-host audit script now exists; next movement is real multi-host evidence plus threshold calibration. |
| Scoped RAG/conversation | Operational baseline | Extract ownership from `server.ts` without removing legacy response fields. |
| Memory/session/workflow | Implemented substrate | Harden policy, audit, and workflow artifact quality before adding UI-only state. |
| Export/platform shell | Implemented baseline | Keep Godot/mobile materialization and export profile rules explicit. |
| Governance/CI | Strong but host-dependent | Keep FR-009, Linux strict Tauri evidence, graphdb/ANN calibration, and docs truth as separate gates. |

Immediate next direction:

1. Keep docs truth synchronized across this dashboard, task, implementation plan, TODO, README, interface docs, and the new solution note.
2. Finish release-grade graphdb and ANN closure: use the new opt-in multi-host evidence gate to extend strict release-evidence history beyond the current Windows host, tighten graphdb connector budgets, calibrate ANN release-gate matrix recall/latency thresholds, and collect strict rollout evidence.
3. Reduce `server.ts` ownership pressure by moving turn-cache, alert trend, runbook bridge, and rollout helper logic behind explicit modules.
4. Continue `KnowledgeLearningPlatform.ts` domain extraction only when the new owner hides state or enforces a real invariant.
5. Expand assistant block coverage through typed, optional payloads while preserving `assistantMessage` and stream/sync/replay compatibility.
6. Keep Godot/mobile constraints at platform adapter boundaries, especially the no-direct-SVG rule.

Verification position for the 2026-06-06 alignment and P1 evidence slices:

- The initial alignment update was documentation-only; the current P1 evidence-history/readiness slice changes verifier tooling, package scripts, tests, and readiness mandatory checks, not public runtime APIs.
- Required gate for this slice: foundation release-evidence contract tests, foundation readiness regression tests, default/strict release-evidence verification, migration tests, docs map validation, docs site build, Mermaid fence guard, diff review, and clean worktree after commit.
- Code slices that follow must continue to use the runtime gates listed in the active task docs, especially `verify:foundation:sqlite-runtime:soak`, `verify:foundation:ann-runtime:matrix`, `verify:foundation:release-evidence`, `verify:foundation:release-evidence:strict`, `test:agent-workspace:contracts`, and `verify:core-real-machine:clean`; release owners should add `verify:foundation:release-evidence:multi-host` when a release window needs host diversity.
- ANN release calibration slices should use `verify:foundation:ann-runtime:release`; the full matrix release-gate path now has fresh Windows-host evidence, `verify:foundation:release-evidence` checks whether latest sqlite/ANN release reports are still fresh before they are used as release context, readiness exposes the strict history audit through `foundation_release_evidence_history`, and `verify:foundation:release-evidence:multi-host` can now enforce 2 distinct host keys per component. `verify:foundation:release-evidence:strict` now passes on the current Windows host with sqlite `3/3` and ANN `3/3`, so the remaining evidence gap is actual multi-host release evidence and calibration rather than local report count.

## 2026-05-27 Workflow Gate Realignment and Progress Truth Sync

- The current branch had already migrated repo-owned workflows to `actions/setup-node@v4` with `node-version: "24"`.
- The actual failure on `main` was narrower than the old docs suggested:
  - `scripts/verify-fixrisk-issues.js` was still enforcing the removed `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` transition override,
  - so `FR-010` failed even though the workflow YAMLs themselves were already on the intended baseline.
- This slice realigns three layers at once:
  - the verifier now checks the current Node 24/no-override baseline,
  - the fixrisk live-status docs now describe that baseline precisely,
  - the active progress/task/implementation docs no longer treat “green once” as a timeless fact.

Code-vs-plan reality for this correction:

| Area | Prior expectation | Current HEAD reality | Status |
|---|---|---|---|
| FR-010 workflow closure | keep the old Node24 compatibility override in place | repo-owned workflows already run on `setup-node@v4` + `node-version: "24"` and should stay free of the removed override | Corrected |
| Fixrisk code-level gate | workflow migration was already “done” | verifier logic lagged behind workflow reality and had to be updated to match the new baseline | Corrected |
| Residual Node 20 warnings | all deprecation noise should disappear once `setup-node` moved to 24 | some annotations still come from marketplace action runtimes (`upload-artifact`, release helpers) and remain external non-blocking debt | Tracked |
| Progress reporting | prior docs could keep saying remote CI was green again | active docs now need to separate repo-owned closure from remaining external/runtime debt and live-run status | Corrected |

Immediate next direction from this point:

- keep `Fixrisk Operational Readiness` and `Migration Gates` green on live `main` runs,
- continue Tauri-first rich reply expansion without breaking the shared Reader-derived render substrate,
- keep Program F substrate work stable while Phase-1/Phase-2 release-grade calibration remains the real engineering frontier,
- keep architecture reduction active because `server.ts`, `KnowledgeLearningPlatform.ts`, and the frontend host files are still oversized.

## 2026-05-27 Tauri-First Conversation Rendering Reality Sync

- The branch has moved materially beyond the last Program F-only status snapshot.
- Current code truth now spans five distinct slices that the older dashboard under-reported:
  - scoped knowledge-workspace grounding is now real rather than graph-only optimistic,
  - Tauri reader markdown/math/mermaid rendering is materially hardened,
  - provider settings and TOML template management are now productized in the frontend,
  - conversation preflight/CORS compatibility is fixed for turn-resume headers,
  - desktop/runtime debug capture tooling is now part of the repo rather than an ad hoc local workflow.

Implemented now at current HEAD:

- Knowledge workspace closure:
  - `src/frontend/source_manager.js` now publishes the active source target,
  - `src/frontend/agent_workspace.js` now forwards `activeTarget` and scoped prefixes with conversation requests,
  - `src/server.ts` now performs active-target-aware workspace hydration plus selective title-like hydration,
  - `src/routes/data.ts` no longer shadows the real build / restore-cache path with stub behavior,
  - `src/learning/KnowledgeLearningPlatform.ts` now exposes `workspaceReadiness`, `missDiagnostics`, title-hit planning, and request inspection helpers.
- Reader/runtime rendering hardening:
  - `src/frontend/reader.js` now renders raw markdown, KaTeX, and Mermaid through one runtime path, with frontend render first and backend PNG fallback retained,
  - `src/frontend/app.js` now suppresses leaked Mermaid error artifacts so long-lived error blocks stop occupying the visible Tauri surface,
  - `src/notemd/MermaidProcessor.ts`, `src/reader_renderer.ts`, and `src/routes/render.ts` now strengthen parity and render-service behavior around Mermaid/Math handoff.
- Provider and settings delivery:
  - `src/frontend/index.html`, `src/frontend/settings.js`, `src/notemd/AppConfigToml.ts`, `src/notemd/providerTemplates.ts`, and the locale bundles now expose a dedicated agent/provider settings page with preset templates and TOML materialization support,
  - the API-version field is now documented in-product instead of being left as unexplained raw config.
- Runtime transport compatibility:
  - `src/middleware/cors.ts` now explicitly allows `x-agent-conversation-turn-id` and `x-agent-conversation-resume-turn-id`, which closes the preflight failure that previously broke browser/Tauri conversation retries.
- Debug and evidence tooling:
  - the repository now ships runtime/webview/window capture helpers plus Mermaid stage/export tooling under `scripts/`, so live Tauri failures can be inspected with first-party evidence commands instead of one-off manual probing.

Tauri-first reply rendering baseline delivered:

- `src/learning/types.ts` and `src/learning/KnowledgeLearningPlatform.ts` now expose backward-compatible `assistantBlocks` alongside legacy `assistantMessage`,
- `src/frontend/markdown_runtime.js` now carries a shared markdown/math/mermaid runtime extracted from the Reader-side logic,
- `src/frontend/workspace_panes.js` now mounts assistant replies through typed blocks instead of only plain text when structured payloads are present,
- `src/frontend/agent_workspace.js` keeps legacy fallback behavior intact, so older `assistantMessage`-only flows still render.

The next real improvement beyond that baseline is now also in code:

- `src/learning/KnowledgeLearningPlatform.ts` no longer treats `assistantBlocks` as a thin transport wrapper around the same old answer string,
- the scoped conversation reply is now organized into explicit overview / explanation / evidence summary / memory notice / action guidance sections before citations and knowledge-action affordances are appended,
- those sections now also consume real scoped data instead of only templated filler: explanation is anchored to the strongest scoped point, evidence summary reflects actual citations, and action guidance now carries memory follow-through hints,
- the reply policy is now also intent-aware, so comparison-style and how-to-style prompts can shape the explanation and next-action sections differently,
- which means the Tauri agent surface can now look materially different even when the underlying knowledge result set is unchanged.

The next architecture-quality improvement beyond that rendering/semantics baseline is also now started:

- the agent-conversation reply composition path is no longer treated as permanent inline `KnowledgeLearningPlatform.ts` ownership,
- a dedicated `src/learning/conversationComposer.ts` module now owns grouped knowledge-point composition plus scoped reply-section synthesis,
- which lowers KLP pressure without changing the public `AgentConversationResponse` contract or the existing Tauri/browser rendering path.
- this is intentionally a small, ownership-oriented extraction rather than a new abstraction layer: KLP still owns runtime state and persistence, while the new module owns pure data composition only.

The next gap is narrower now:

- broaden block coverage where future endpoints emit richer assistant payloads,
- keep the new render substrate honest under real browser/Tauri runtime verification,
- preserve a clean downgrade/materialization boundary for later Godot reuse.

## 2026-05-27 Phase-1 SQLite Soak Gate Baseline

- The embedded `graphdb/sqlite` baseline no longer stops at restart continuity plus workload-envelope proof.
- Current HEAD now also carries a dedicated host-level soak/performance verifier:
  - `npm run verify:foundation:sqlite-runtime:soak`
  - emits structured JSON reports under `output/verification/foundation-sqlite-runtime/`,
  - keeps release-grade evidence separate from the lighter `smoke` / `medium` / `heavy` matrix path.

What this newly proves:

- repeated restart cycles on both `dist` runtime and packaged sidecar paths,
- structured startup / ingest / readiness / diagnostics / query duration summaries,
- threshold-gated p95 / max latency checks for the sqlite baseline.

What it still does not prove:

- long-horizon multi-host evidence,
- calibrated final release thresholds across heterogeneous machines,
- a declaration that A8 is fully production-closed.

Code-vs-plan reality for this slice:

| Area | Prior expectation | Current HEAD reality | Status |
|---|---|---|---|
| Knowledge workspace grounding | scoped queries should resolve the selected corpus instead of only the loaded graph | active target, scope prefixes, title-like hydration, workspace readiness, and miss diagnostics are now wired across frontend, server, and KLP | Operational |
| Tauri markdown reader parity | markdown, math, and Mermaid should survive real runtime conditions without persistent error overlays | reader/runtime paths now render Mermaid with frontend-first + backend-PNG fallback and suppress leaked error artifacts | Operational |
| Provider settings | provider/model/API-key controls should be isolated and write durable TOML configuration | dedicated agent/provider settings surface plus preset/TOML template helpers are now present | Operational |
| Conversation retry transport | turn/replay headers should survive browser/Tauri preflight | CORS now allows both conversation turn headers | Closed |
| Tauri agent reply rendering | assistant replies should render rich markdown instead of plain text | backward-compatible `assistantBlocks` plus shared markdown runtime now power rich assistant replies, while legacy `assistantMessage` remains supported | Operational |

## 2026-05-26 Program F Closure

- The deep-student-derived next-phase program is now implemented through Program F at current HEAD.
- The new durable substrate is no longer only a plan artifact. It now exists in code:
  - canonical resources and projections: `src/resources/`,
  - unit/segment indexing lifecycle: `src/indexing/`,
  - durable workspace/corpus entities: `src/workspace/`,
  - session/workflow durability: `src/session/`, `src/workflows/`,
  - typed memory governance and audits: `src/memory/MemoryGovernance.ts`,
  - deterministic workspace export bundles: `src/export/WorkspaceExportBundle.ts`.
- `KnowledgeLearningPlatform.ts` now persists and restores those substrate layers alongside graph, mastery, conversation, and telemetry state.
- `POST /api/knowledge/export/workspace` now exposes the Program F bundle path.
- Platform export semantics are now explicit rather than inferred:
  - `src/platform/PlatformCapabilities.ts` describes bundle packaging mode (`full` vs `slim`) and indexed-readiness requirements,
  - `src/platform/RenderMaterializer.ts` continues to enforce PNG-first materialization where SVG is unsafe.

Fresh verification evidence for this closure:

- `npm.cmd run build:mini`
- `npm.cmd test -- --runInBand src/resources/ResourceRegistry.test.ts src/workspace/WorkspaceRegistry.test.ts src/indexing/IndexLifecycle.test.ts src/session/SessionStateStore.test.ts src/workflows/WorkflowArtifactStore.test.ts src/memory/MemoryGovernance.test.ts src/export/WorkspaceExportBundle.test.ts src/platform/PlatformCapabilities.test.ts src/platform/RenderMaterializer.test.ts src/routes/registry.contract.test.ts src/learning/store.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/learning/KnowledgeLearningPlatform.persistence.test.ts src/learning/KnowledgeLearningPlatform.program-f.test.ts`

Operational implication:

- mobile slim export and desktop export now converge on the same workspace/resource/index/session/memory substrate,
- lightweight local RAG and multi-platform export now share one durable scope model instead of parallel ad hoc state paths.

## 2026-05-10 Open-Goal Sync

- This page is aligned with the repository-wide audit in [Open Goal Audit (2026-05-10)](../../../open_goal_audit_2026-05-10.md).
- Current unresolved-goal decisions should be read from:
  - `docs/en/TODO.md`
  - `docs/en/task.md`
  - `docs/en/tauri_tasks.md`
  - `docs/en/TEST_REPORT.md`
- Historical checklists in archive/historical docs remain traceability context and are not the canonical release gate.

## 2026-05-12 HEAD Reality Recalibration

- The previous "Phase-1 closure" wording is too optimistic for current HEAD and is superseded by this section.
- What is real at HEAD:
  - graph/store operations semantics exist in `src/learning/store.ts`, including file-backed ops, embedded SQLite graphdb persistence/query paths, and HTTP adapter paths with fallback diagnostics,
  - the embedded sqlite baseline now also has restart-durability proof: shutdown closes the store cleanly, the adapter can reopen safely, and server integration covers ingest -> shutdown -> fresh module reload -> diagnostics/query/readiness continuity,
  - a host-level verifier now exercises that same embedded sqlite baseline through both `dist` runtime and packaged sidecar flows on the current Windows host: ingest -> store diagnostics/foundation readiness -> restart -> query continuity (`scripts/verify-foundation-sqlite-runtime.js`),
  - a host-level workload-matrix verifier now extends that proof across `smoke` / `medium` / `heavy` profiles on the same two runtime paths, including snapshot metadata counts plus restart and multi-point query continuity (`scripts/verify-foundation-sqlite-runtime.js --matrix`),
  - foundation readiness mandatory checks now include the release-facing sqlite soak alias (`verify:foundation:sqlite-runtime:release`), the ANN matrix release gate (`verify:foundation:ann-runtime:release`), the release-evidence freshness verifier (`verify:foundation:release-evidence`), and the strict release-evidence history verifier (`verify:foundation:release-evidence:strict`), so operator-facing readiness output matches the package scripts used for release evidence,
  - a host-level ANN verifier now proves the `external_http` connector baseline on the same Windows host through both `dist` runtime and packaged sidecar flows: ingest -> live query-backend diagnostics -> restart -> query continuity (`scripts/verify-foundation-ann-runtime.js`),
  - a host-level ANN workload-matrix verifier now extends that proof across `smoke` / `medium` / `heavy` profiles on the same two runtime paths, including sync/select telemetry, aligned representation metadata, and restart continuity (`scripts/verify-foundation-ann-runtime.js --matrix`),
  - the ANN verifier now also has a release-gate mode and structured report output: `scripts/verify-foundation-ann-runtime.js --release-gates` records startup / ingest / diagnostics / query duration summaries plus targeted-query recall under `output/verification/foundation-ann-runtime/`, and `npm run verify:foundation:ann-runtime:release` wires the full matrix release path,
  - `scripts/verify-foundation-release-evidence.js` now reads the latest sqlite soak and ANN release-gate reports, verifies bounded freshness, required profiles, both runtime modes, sqlite soak gates, ANN release gates, and expected recall, scans timestamped history reports, reports host-key coverage, and writes a compact release-evidence summary under `output/verification/foundation-release-evidence/`; the default audit requires 1 valid fresh report per component, `verify:foundation:release-evidence:strict` requires 3 and now passes on the current Windows host, and `verify:foundation:release-evidence:multi-host` additionally requires 2 host keys,
  - ANN-style prefilter, representation telemetry, circuit health, remote index sync, and live `external_http` connector proof now exist in `src/learning/queryBackend.ts` and `src/learning/vectorAccelerationAdapter.ts`,
  - runtime capability/runbook governance now includes explicit ANN remote index-sync health (`query_vector_acceleration_index_sync_health`) in addition to prefilter, health, traceability, and circuit checks,
  - runtime capability governance now also includes explicit gate `query_vector_acceleration_calibration_readiness`, which formalizes whether the ANN path is even ready for release-grade threshold tuning,
  - `server.ts` now closes the corresponding operator loop: the index-sync gate participates in verification escalation, remediation action-queue generation, and per-check runbook history summaries,
  - the agent workspace runtime-runbook surfaces now render operator-facing ANN governance directly in the frontend shell: verify/checks now expose sync-health plus circuit-budget, traceability, and prefilter summaries, and they now also show threshold/signal drilldowns plus calibration-readiness state and the explicit calibration gate needed for budget tuning work, while action-queue keeps the index-sync incident drilldown,
  - the modular `src/routes/knowledge.ts` runtime-runbook surfaces now delegate to live server-side runbook ops with full query-parameter passthrough, so browser/runtime consumers no longer hit the old KLP placeholder payloads for verify/history/checks/action-queue/remediation/schedule flows,
  - the browser strict smoke gate now also proves those ANN runbook surfaces from real browser evidence: verify-card ANN sync/circuit/traceability/prefilter content plus threshold/signal and calibration-readiness labels, checks-card first-check ANN sync plus circuit/traceability/prefilter snapshots, and action-queue index-sync drilldown are now asserted end to end instead of remaining component-test-only,
  - locale governance for the agent workspace is now tighter on both static and runtime surfaces: bilingual locale bundles now cover the query/quality/runbook cards exercised by strict browser smoke, `src/agent_workspace.locale.contract.test.ts` blocks source-referenced `agentWorkspace.*` key drift, and startup-time translate helpers no longer emit false missing-key warnings before locale initialization finishes,
  - Phase-2 runtime diagnostics are now materially implemented in `src/learning/KnowledgeLearningPlatform.ts` for query-backend comparison/history/trend, knowledge staleness diagnostics/rebuild planning, learning-quality history/trend, session-plan quality evaluation/history/trend/runtime-threshold diagnostics, query-backend config, and query-backend diagnostics,
  - Phase-3 tutor/memory diagnostics remain real and now include an active default runtime tutor adapter path in `src/server.ts`, so normal server execution can emit adapter telemetry instead of staying catalog-only.
- What is not closed yet:
  - Phase-1 A8 has advanced beyond a file-only default: `src/server.ts` now defaults to `graphdb/sqlite` with explicit file fallback, restart durability is already proved, host-level dist/runtime + packaged sidecar proof is in place, and a host-level workload matrix is now in place across `smoke` / `medium` / `heavy`, but soak / longer-duration / performance hardening is still open before calling the local graph backend production-closed,
  - Phase-1 A9 is now operational rather than scaffold-only: host-level runtime proof, a host-level workload matrix, and matrix release-gate evidence are now in place, but repeated multi-host calibration and threshold convergence are still open before calling the ANN layer production-closed,
  - Phase-2 quality/session/query observability is now real, but it is not yet release-closed because these gates still require release-grade calibration on top of the current graph/ANN operational baseline; the new ANN calibration-readiness gate only formalizes prerequisites, not closure,
  - default tutor routing is no longer catalog-only, but the runtime is still effectively `local`-first and retains explicit rule-engine fallback rather than a production-proven multi-provider routing policy.
- Active execution focus therefore shifts to truth-first foundation recovery:
  - finish the remaining soak / longer-duration / performance closure for the embedded graph backend baseline while keeping the new dist/runtime + packaged sidecar proof and workload matrix green,
  - finish the remaining workload/threshold closure for the now-live ANN connector baseline,
  - move the newly surfaced ANN runbook visibility from operator-readable summaries to workload-calibrated release gates,
  - keep the new diagnostic surfaces honest against the same runtime truth,
  - then promote Phase-2 / Phase-3 gates as release-significant only after the graph/ANN baseline is release-grade.

## Scope

- Focus area: local-first knowledge mastery platform (ingest, retrieval, learning path, tutor, memory, governance).
- Time window: `v1.7.0` to current branch baseline.
- Evidence rule: every progress claim must map to:
  - contract surface (`src/learning/api.ts`, `src/learning/types.ts`)
  - route wiring (`src/server.ts`)
  - behavior tests (`src/knowledge.api.contract.test.ts` and domain tests)

## 2026-05-12 Architecture Metrics

| File | Current Lines | Implication |
|---|---:|---|
| `src/server.ts` | 15,920 | routing is modularized, but the main server monolith is still large and now also carries more runtime orchestration |
| `src/learning/KnowledgeLearningPlatform.ts` | 10,043 | KLP remains the dominant implementation gravity well and now also carries workspace-readiness and planner logic |
| `src/frontend/path_app.js` | 4,943 | path workbench/controller split is still incomplete and now additionally carries reader-parity responsibilities |
| `src/frontend/app.js` | 5,953 | graph runtime still keeps a large host-side control surface and now also carries Mermaid error-guard behavior |
| `src/frontend/reader.js` | 1,334 | reader/runtime rendering is now a first-class subsystem rather than a lightweight helper |
| `src/frontend/agent_workspace.js` | 3,214 | agent orchestration exists, but reply rendering still has not crossed from text shell to rich message surface |
| `src/routes/knowledge.ts` | 690 | knowledge routes need another split before claiming route-layer compaction |

Use these numbers as the current HEAD truth. Older size-reduction tables later in this page remain useful as historical traceability, but they no longer describe the current branch state exactly.

## Current Delivery Focus

The immediate L4 priority is no longer generic interaction expansion.
It is the end-to-end delivery of:

- frontend agent chat,
- local knowledge-point listing,
- docked Tauri graph `focus mode` pane,
- docked learning-path pane that can coexist with graph focus and be promoted fullscreen.
- Tauri-first assistant reply rendering that can reuse the mature Reader markdown/math/mermaid pipeline.

Execution reference:

- [Agent Conversation + Focus Mode Delivery Plan](./agent-conversation-focus-mode-plan.md)

Current branch status for this slice:

- the main frontend now contains an agent workspace shell (`src/frontend/index.html`, `src/frontend/styles.css`),
- the conversation route now returns actionable local knowledge points with typed capability descriptors, including execution / failure / UI-hint metadata for `focus`, `learning path`, tutor-side actions (`generate_quiz`, `recap`, `generate_transfer`, `generate_counterexample`, `follow_up`), query-side `compare_query_backends` / `inspect_query_backend_diagnostics` / `inspect_query_backend_comparison_history` / `inspect_query_backend_comparison_trend`, tutor diagnostics `inspect_tutor_adapter_telemetry` / `inspect_tutor_trace_diagnostics`, quality/session diagnostics (`inspect_learning_quality_trend` / `inspect_learning_quality_history` / `inspect_session_plan_quality_trend` / `inspect_session_plan_quality_history`), session-side `inspect_session_history` / `build_study_session`, and conversation-memory recall `inspect_conversation_memory` (`src/server.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/learning/types.ts`),
- the capability actions that inspect query comparison, staleness, learning quality, session-plan quality, and query-backend diagnostics are now backed by live `KnowledgeLearningPlatform.ts` implementations instead of empty placeholders,
- default server bootstrap now injects a concrete local `tutorAdapter` while preserving the multi-adapter catalog (`local` + `cloud`), so normal runtime tutor execution can emit adapter telemetry and still degrade explicitly to guarded fallback behavior when needed,
- conversation knowledge points are now typed-only (`capabilities` is the single action source), and legacy `availableActions` fallback telemetry/synthesis has been removed from both backend response shape and pane rendering (`src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/workspace_panes.js`, `src/agent_workspace.frontend.test.ts`, `src/knowledge.api.contract.test.ts`),
- agent workspace capability execution dispatch now enforces explicit execution-kind handlers without legacy action fallback execution; knowledge operations are split into independent transport and request-builder registries, while result presentation is split into custom presenters plus card-presentation descriptors and payload-builder registries with fail-fast `unsupported_result_presentation*` drift semantics, and parity/frontend diagnostics now cover transport/request-builder/custom-presentation/card-presentation/payload-builder/execution-kind completeness (`src/frontend/agent_workspace.js`, `src/agent_workspace.frontend.test.ts`, `src/agent_workspace.contract.parity.test.ts`),
- clicking `Learning Path` now hosts the Godot Future Path data contract for the resolved DAG node through the existing frontend `Graph` / `PathEngine` `diffusion/core` + `treeLayout` flow instead of stopping at a text-only preview, docking the browser `path-container`, or showing the native Godot window by default (`src/frontend/workspace_panes.js`, `src/frontend/agent_workspace.js`, `src/frontend/app.js`),
- the graph surface now reserves workspace width so conversation + graph-focus + learning-path can coexist in one host-owned layout (`src/frontend/styles.css`),
- graph-focus fullscreen now promotes the real graph workspace instead of only enlarging a metadata card (`src/frontend/workspace_panes.js`, `src/frontend/styles.css`),
- the scoped-knowledge conversation flow is now materially more honest about corpus readiness: active folder target flows into the request contract, the server selectively hydrates likely title-matching documents into the workspace, and conversation traces now include readiness + miss diagnostics instead of only returning an empty top-k result (`src/frontend/source_manager.js`, `src/frontend/agent_workspace.js`, `src/server.ts`, `src/routes/data.ts`, `src/learning/KnowledgeLearningPlatform.ts`),
- the new agent workspace shell now has i18n coverage for static shell strings plus runtime button/empty-state messaging, existing knowledge-card actions / localized system messages now re-render on language change instead of staying in the previous locale, conversation card rerender is now centralized through a card-kind renderer registry, and a source-level parity guard now checks append-kind vs registry alignment (`src/frontend/index.html`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/frontend/workspace_panes.js`, `src/frontend/agent_workspace.js`, `src/agent_workspace.frontend.test.ts`),
- provider/model/API-key settings are now isolated into a dedicated agent settings page with preset-template and TOML-template flows, and the same agent workspace now also has a typed rich-reply baseline instead of staying plain-text-only (`src/frontend/index.html`, `src/frontend/settings.js`, `src/notemd/AppConfigToml.ts`, `src/notemd/providerTemplates.ts`, `src/frontend/markdown_runtime.js`, `src/frontend/workspace_panes.js`, `src/frontend/agent_workspace.js`),
- the reader/runtime render stack is now substantially more robust for Tauri markdown usage: raw markdown, KaTeX, Mermaid frontend render, Mermaid backend PNG fallback, leaked Mermaid error suppression, and a shared markdown runtime for agent replies are all present (`src/frontend/reader.js`, `src/frontend/app.js`, `src/frontend/markdown_runtime.js`, `src/reader_renderer.ts`, `src/routes/render.ts`, `src/notemd/MermaidProcessor.ts`),
- locale governance now includes backend-to-frontend capability label-key parity blocking: emitted conversation capability `labelKey` values must resolve to non-empty bilingual `agentWorkspace.actions.*` entries (`src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/agent_workspace.locale.contract.test.ts`),
- modular knowledge-route closure now includes live browser strict proof instead of snapshot-only recovery: conversation response wiring, capability-triggered request routes, card-title localization, and graph-focus compatibility now pass `STRICT`, `UI_STRICT`, and `UI_DYNAMIC_STRICT` against real browser/network traces (`src/routes/knowledge.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/app.js`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `scripts/verify-agent-workspace-browser.js`),
- locale governance now also blocks capability failure-message drift: emitted `failure.messageKey` values must resolve to bilingual `agentWorkspace.messages.*` entries with aligned interpolation placeholders and stable fallback placeholder sets (`src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/agent_workspace.locale.contract.test.ts`),
- backend capability descriptor contract now enforces execution completeness for `knowledge_operation` capabilities (`operationId` + `resultPresentation`) and mandatory failure metadata (`messageKey` + `fallbackMessage`) in the emitted conversation capability payload (`src/learning/KnowledgeLearningPlatform.ts`, `src/agent_workspace.contract.parity.test.ts`),
- frontend capability execution now enforces an operation-scoped result-presentation allowlist (default + explicit overrides such as `execute_tutor_action -> tutor_action_card`) and fails fast on unsupported combinations before backend request dispatch and renderer dispatch (`src/frontend/agent_workspace.js`, `src/agent_workspace.contract.parity.test.ts`, `src/agent_workspace.frontend.test.ts`),
- contract governance now blocks allowlist override drift: override operation keys must be a subset of `AgentConversationCapabilityOperationId`, and override values must be a subset of `AgentConversationCapabilityResultPresentation` (`src/agent_workspace.contract.parity.test.ts`),
- parity governance now enforces allowlist shape: each operation allowlist must include its transport default presentation, and backend non-default operation presentations must be declared by explicit frontend overrides (`src/agent_workspace.contract.parity.test.ts`),
- override hygiene now enforces non-default-only semantics: operation override entries may not repeat transport defaults (`src/agent_workspace.contract.parity.test.ts`, `src/frontend/agent_workspace.js`),
- override governance now also blocks stale entries: each frontend override presentation must be observed in backend capability emission for the same operation (`src/agent_workspace.contract.parity.test.ts`),
- frontend registry diagnostics now export per-operation override/default/allowlist presentation maps (`operationResultPresentationOverrideMap`, `operationDefaultResultPresentations`, `operationAllowedResultPresentations`) to support contract drift debugging (`src/frontend/agent_workspace.js`, `src/agent_workspace.frontend.test.ts`),
- frontend registry diagnostics now also export `operationInvalidResultPresentationOverrideMap` so runtime can surface default-duplicate/unknown override tokens if configuration drifts (`src/frontend/agent_workspace.js`, `src/agent_workspace.frontend.test.ts`),
- frontend registry diagnostics now also export `operationUnknownResultPresentationOverrideMap` so unknown override operation IDs remain visible in runtime drift debugging (`src/frontend/agent_workspace.js`, `src/agent_workspace.frontend.test.ts`),
- frontend registry diagnostics now also export override-drift summary signals (`operationResultPresentationOverrideDriftDetected`, invalid/unknown override token counters) for quick runtime health checks (`src/frontend/agent_workspace.js`, `src/agent_workspace.frontend.test.ts`),
- frontend message-locale governance now blocks unresolved runtime message keys: every `agentWorkspace.messages.*` key referenced by `agent_workspace.js` must resolve to bilingual locale entries with aligned placeholders (`src/frontend/agent_workspace.js`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/agent_workspace.locale.contract.test.ts`),
- app-level tauri lifecycle observability now records `pathmode-window-toggled` payloads into a bounded frontend trace buffer and forwards them as `noteconnection:pathmode-window-toggled` DOM events for local diagnostics (`src/frontend/app.js`),
- the desktop lifecycle verification stack now includes a first real app/window-handle evidence path (`verify:agent-workspace:tauri:window-evidence`) that runs dedicated Rust tests against mock-app webview window handles and emits structured artifacts under `output/tauri/agent-workspace-window-evidence`, with explicit degraded semantics when host system dependencies are missing (`scripts/verify-agent-workspace-tauri-window-evidence.js`, `src-tauri/src/lib.rs`, `src/agent_workspace.tauri.contract.test.ts`),
- CI now has an always-on strict desktop evidence job in `.github/workflows/migration-gates.yml` (`agent-workspace-tauri-strict-evidence`) that runs `verify:agent-workspace:tauri:rust:strict` and `verify:agent-workspace:tauri:window-evidence:strict` on Linux hosts with explicit `javascriptcoregtk-4.1` / `libsoup-3.0` dependencies, and release workflow `.github/workflows/release-desktop-multi-os.yml` now enforces the same strict evidence gate on the Linux desktop build path before bundle generation; both workflows also generate a strict evidence index (`verify:agent-workspace:tauri:evidence:index:strict`), enforce a strict evidence manifest gate (`verify:agent-workspace:tauri:evidence:manifest:strict`), and upload tauri evidence artifacts (retention policy pinned to 30 days) for audit traceability, while the Linux release path now publishes `release-fragment-latest.md` into GitHub Release notes using marker-based idempotent upsert,
- migration workflow now also includes a dedicated always-on `agent-workspace-contract-gates` job that runs `test:agent-workspace:contracts` (parity/frontend/tauri contract suites) plus `test:conversation-turn-cache:durability` (restart durability check for turn-cache trend index/export consistency), closing the CI drift-detection gap for agent-workspace contract evolution,
- license governance now adds `test:license:contract` to enforce `GPL-3.0-only` parity across `LICENSE`, `README`, `package.json`, and `src-tauri/Cargo.toml`, and this gate is wired into `migration-gates` CI to block license drift,
- browser smoke now exercises real `conversation/path/query-compare/quality/session/runbook` backend slices (including trend + history diagnostics plus runbook verify/checks/action-queue), real graph runtime, and real path runtime, and now asserts ANN sync-health plus verify/checks circuit/traceability/prefilter threshold/signal and calibration-readiness content from browser evidence before emitting screenshot/console/network-summary artifacts (`scripts/verify-agent-workspace-browser.js`, `src/agent_workspace.browser.contract.test.ts`),
- scoped conversation-memory foundation is now wired end-to-end (typed contracts, backend normalizers/routes, capability operation registry, locale keys, lifecycle tests, browser/runtime verification) through `/api/knowledge/conversation-memory/{list,add,search,delete,feedback}` (`src/learning/api.ts`, `src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/server.ts`, `src/frontend/agent_workspace.js`, `src/knowledge.api.contract.test.ts`, `src/learning/KnowledgeLearningPlatform.test.ts`, `src/agent_workspace.frontend.test.ts`),
- unified turn streaming baseline is now delivered on `/api/knowledge/conversation` via `Accept: text/event-stream` negotiation with a minimal event set (`turn_started`/`capability_planned`/`capability_progress`/`capability_result`/`turn_completed`/`turn_failed`) and frontend stream-first + sync fallback behavior (`src/server.ts`, `src/frontend/agent_workspace.js`, `src/knowledge.api.contract.test.ts`, `src/agent_workspace.frontend.test.ts`),
- M8.2 recovery semantics are now in place on top of the stream baseline: frontend requests propagate client turn IDs across stream-first + sync fallback, server route `/api/knowledge/conversation` now enforces replay-window idempotency with turn-level dedupe/conflict protection (`turn_id_conflict`), and resumed stream requests replay cached turn events instead of re-running execution (`src/server.ts`, `src/frontend/agent_workspace.js`, `src/knowledge.api.contract.test.ts`, `src/agent_workspace.frontend.test.ts`),
- M8.3 operator baseline is now delivered: turn-cache lifecycle diagnostics are exposed at `GET /api/knowledge/conversation/turn-cache/diagnostics` (including TTL/capacity config, live state, hit ratio, conflict count, replay counters, and eviction counters), and TTL/capacity are runtime-tunable via `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_TTL_MS` / `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_MAX_ENTRIES` (`src/server.ts`, `src/knowledge.api.contract.test.ts`),
- M8.4 operator productization baseline is now delivered: turn-cache diagnostics are wired into the agent workspace execution contract as `inspect_conversation_turn_cache_diagnostics` -> `fetch_conversation_turn_cache_diagnostics` -> `conversation_turn_cache_diagnostics_card`, including bilingual card rendering and language-switch re-render coverage (`src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/agent_workspace.js`, `src/frontend/workspace_panes.js`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/agent_workspace.frontend.test.ts`, `src/agent_workspace.contract.parity.test.ts`, `src/knowledge.api.contract.test.ts`, `src/learning/KnowledgeLearningPlatform.test.ts`),
- M8.5 thresholded-governance baseline is now delivered: turn-cache diagnostics now include env-driven alert thresholds and policy checks (`utilization_pct`, `execution_failure_ratio_pct`, `conflict_count`, `stale_eligible_entries`) with summarized severity state (`summaryStatus`) and fail/warn counters; the workspace diagnostics card now renders alert summary/top-check/threshold-profile metrics with bilingual labels and re-render coverage (`src/server.ts`, `src/frontend/agent_workspace.js`, `src/frontend/workspace_panes.js`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/agent_workspace.frontend.test.ts`, `src/knowledge.api.contract.test.ts`),
- M8.6 alert-trend governance baseline is now delivered: `GET /api/knowledge/conversation/turn-cache/diagnostics/trend` now returns bounded alert-history snapshots, trend status (`insufficient_data` / `stable` / `improving` / `regressing`), escalation state (`normal` / `watch` / `high` / `critical`), and active-streak context; sampling and policy behavior are env-tunable via `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_LIMIT`, `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_SAMPLE_MIN_INTERVAL_MS`, `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_WINDOW_SIZE`, `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_MIN_SAMPLES`, `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_ESCALATION_WARN_STREAK`, and `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_ESCALATION_FAIL_STREAK` (`src/server.ts`, `src/knowledge.api.contract.test.ts`),
- M8.6 operator productization follow-through is now delivered in the workspace contract path: `inspect_conversation_turn_cache_alert_trend` -> `fetch_conversation_turn_cache_alert_trend` -> `conversation_turn_cache_alert_trend_card`, including bilingual card rendering and language-switch re-render coverage (`src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/agent_workspace.js`, `src/frontend/workspace_panes.js`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/agent_workspace.frontend.test.ts`, `src/agent_workspace.contract.parity.test.ts`, `src/learning/KnowledgeLearningPlatform.test.ts`),
- M8.7 durability + runbook-gate linkage baseline is now delivered: turn-cache alert trend history is persisted across restarts at `runtime_data/agent_conversation_turn_cache_alert_history.v1.json` with bounded compaction and async persist queueing, index/export endpoints are available at `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/index` and `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/export`, and escalation is now bridged into runtime runbook through synthetic check `conversation_turn_cache_alert_trend` with remediation actions `inspect_conversation_turn_cache_alert_trend_index`, `stabilize_conversation_turn_cache_alert_pressure`, and `verify_conversation_turn_cache_alert_trend_recovery` (`src/server.ts`, `src/knowledge.api.contract.test.ts`, `src/notemd.server.integration.test.ts`),
- M8.8 operator drilldown + schedule guardrail baseline is now delivered: agent workspace now exposes explicit trend index/export operator actions (`inspect_conversation_turn_cache_alert_trend_index` / `inspect_conversation_turn_cache_alert_trend_export`) and corresponding operation wiring (`fetch_conversation_turn_cache_alert_trend_index` / `fetch_conversation_turn_cache_alert_trend_export`), trend/action-queue cards now surface storage/index/export/endpoint-hint drilldown context, and replay schedule config now applies cross-field guardrails (`maxReplayChecksPerWindow >= replayLimit`) with explicit telemetry reasons (`config_guardrail_applied`, `schedule_config_guardrail:*`) visible through server snapshot + workbench status text (`src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/agent_workspace.js`, `src/frontend/workspace_panes.js`, `src/frontend/path_app.js`, `src/server.ts`, `src/agent_workspace.frontend.test.ts`, `src/agent_workspace.contract.parity.test.ts`, `src/knowledge.api.contract.test.ts`, `src/learning/KnowledgeLearningPlatform.test.ts`, `src/notemd.server.integration.test.ts`),
- M8.9 replay-schedule proactive recommendation + policy-template baseline is now delivered: replay-schedule snapshots now include structured recommendation payloads (`telemetry.recommendations`) and policy-template candidates (`telemetry.policyTemplates`) for guardrail/budget/trigger/cooldown/skip-streak scenarios, schedule config update accepts `policyTemplate` as a first-class payload input, and workbench replay-schedule refresh/update/tick status text now surfaces both top recommendation and top policy template for operator action (`src/server.ts`, `src/frontend/path_app.js`, `src/notemd.server.integration.test.ts`, `src/path_app.runtime_trace_filter.behavior.test.ts`),
- M9 replay-schedule safe auto-execution baseline is now delivered: schedule config now supports explicit `autoExecution` policy (`enabled`, `mode`, `requireDryRunParity`, `minConsecutiveSkips`), snapshot telemetry now reports structured gate diagnostics (`eligible`, `blockedReasons[]`, `decision`, `lastAttemptedAt`, `lastExecutedAt`), and schedule tick now enforces gate-first execution semantics (`auto_execution_blocked`, `auto_execution_dry_run_required`, `auto_execution_executed`) on top of existing trigger/cooldown/budget guards (`src/server.ts`, `src/notemd.server.integration.test.ts`, `src/knowledge.api.contract.test.ts`),
- M9.1 workbench operator explainability is now delivered: replay-schedule refresh/update/tick status text and remediation history formatting now include `autoExecution(...)` diagnostics, and config update flow now forwards `autoExecution` fields from UI preferences to backend payload (`src/frontend/path_app.js`, `src/path_app.runtime_trace_filter.behavior.test.ts`),
- M10 foundation hardening bootstrap is now delivered as rollout controls: graphdb storage now supports provider-based adapter selection plus fallback policy (`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER`, `NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_ID`, `NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED`) and local-vector acceleration now supports explicit failure semantics plus representation strictness (`NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_FAILURE_MODE=fail_open|fail_closed`, `NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT=true|false`) with trace/runtime diagnostics propagation (`src/learning/store.ts`, `src/learning/queryBackend.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/server.ts`, `src/learning/store.test.ts`, `src/learning/queryBackend.test.ts`, `src/knowledge.api.contract.test.ts`),
- local-vector acceleration strictness now also treats `external_http` endpoint misconfiguration as a first-class adapter failure (`external_http_endpoint_missing`) so `fail_closed` rollout no longer silently downgrades to full-scan; strict paths now surface `vector_acceleration_adapter_failure:*` in trace/diagnostics (`src/learning/vectorAccelerationAdapter.ts`, `src/notemd.server.rollout-boundary.integration.test.ts`),
- query-backend diagnostics/config endpoints now echo vector-acceleration rollout context (`configuredVectorAccelerationProvider`, `configuredVectorAccelerationFailureMode`, `configuredVectorAccelerationRepresentationStrict`, `queryVectorAnnPrefilterEnabled`, `rolloutProfile`) so workbench/runtime operators can reason about strictness without cross-calling `/api/knowledge/state` (`src/server.ts`, `src/notemd.server.integration.test.ts`, `src/notemd.server.rollout-boundary.integration.test.ts`),
- M10.2 graphdb adapter baseline now includes an `external_http` provider path (`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_ENDPOINT`, `NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_TIMEOUT_MS`, `NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_MAX_RETRIES`, `NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_RETRY_DELAY_MS`) with connector diagnostics and strict fail-closed behavior when endpoint configuration is invalid (`graphdb_http_endpoint_missing`) (`src/learning/store.ts`, `src/server.ts`, `src/learning/store.test.ts`, `src/notemd.server.rollout-boundary.integration.test.ts`),
- M10.3 graphdb `external_http` connector telemetry is now promoted to first-class runtime governance: store diagnostics now include structured connector health/circuit/request telemetry (`healthStatus`, `circuitState`, `requestCount`, `retryCount`, `shortCircuitCount`, `lastRequestId`, `lastErrorCode`, `lastStatusCode`, `lastRetryAfterMs`), runtime capability matrix now adds `store_graphdb_connector_health` with runbook/debug-trace wiring, and strict rollout integration/store tests now validate the healthy path plus circuit-open degradation semantics (`src/learning/store.ts`, `src/learning/runtimeCapability.ts`, `src/learning/store.test.ts`, `src/learning/runtimeCapability.test.ts`, `src/notemd.server.rollout-boundary.integration.test.ts`),
- M10 rollout-boundary integration coverage is now extended with isolated server bootstrap tests for strict-mode behavior: vector acceleration `fail_closed` now verifies both adapter-failure surfacing and healthy `external_http` success-path telemetry (no backend fallback, `healthStatus=ready`, request-correlation propagation), graphdb `provider=none` + `fallback=false` now verifies fail-closed store API semantics, and graphdb `provider=external_http` + `fallback=false` now verifies the success path across `/api/knowledge/store/reload` + `/api/knowledge/store-diagnostics` (including rollout-context fields `configuredGraphDbAdapterProvider` / `configuredGraphDbAdapterId` / `graphDbFallbackEnabled`) (`src/notemd.server.rollout-boundary.integration.test.ts`, `src/server.ts`),
- M10 rollout profile operator visibility is now wired end-to-end: runtime payload now exposes `rolloutProfile` (store/vector strictness + aggregate mode), `runtime-capability-matrix` plus runbook/verify/history/history-checks/action-queue/remediation-history/replay-schedule endpoints (including remediation POST flows: `event`/`replay`/`schedule`/`tick`) now echo the same profile, and learning-workbench runtime summary now surfaces `rollout=<mode>(...)` cue; integration/contract/frontend behavior coverage is in place (`src/server.ts`, `src/notemd.server.integration.test.ts`, `src/knowledge.api.contract.test.ts`, `src/frontend/path_app.js`, `src/path_app.runtime_trace_filter.behavior.test.ts`),
- the legacy global Path Mode entry now clears the docked pane first so full-path entry remains deterministic (`src/frontend/app.js`).

## Latest Validation Snapshot (2026-05-18)

- Reconfirmed on the current Windows host in this turn: `node node_modules/jest/bin/jest.js src/learning/runtimeCapability.test.ts src/knowledge.api.contract.test.ts --runInBand --no-cache`, `node node_modules/jest/bin/jest.js src/agent_workspace.frontend.test.ts --runInBand --no-cache`, `npm run test:agent-workspace:contracts`, `npm run build:with-vite`, `npm run docs:diataxis:check`, `npm run docs:site:build`, `NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_STRICT=1 NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_STRICT=1 NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_DYNAMIC_STRICT=1 node scripts/verify-agent-workspace-browser.js`.
- Reconfirmed on the current Windows host in this turn: `npm run build:sidecar`, `npm run verify:foundation:sqlite-runtime`, `npm run verify:foundation:sqlite-runtime:matrix`, `npm run verify:foundation:ann-runtime`, `npm run verify:foundation:ann-runtime:matrix`.
- The strict browser proof now explicitly verifies the bilingual runtime-runbook verify/checks ANN governance labels that were added in this slice: sync-health plus circuit, traceability, and prefilter summaries, along with the threshold/signal drilldowns and calibration-readiness cues that support budget-tuning work.
- The embedded sqlite graph baseline now also has repeatable host-level runtime proofs outside Jest integration scope: the lighter verifier keeps `dist` runtime and packaged sidecar ingest -> diagnostics/readiness -> restart -> query continuity green, and the workload-matrix verifier proves the same two runtime paths across `smoke` / `medium` / `heavy` corpus sizes with snapshot metadata counts and multi-point restart queries.
- The `external_http` ANN connector baseline now also has repeatable host-level runtime proofs outside Jest integration scope: the lighter verifier keeps `dist` runtime and packaged sidecar ingest -> query-backend diagnostics -> restart -> query continuity green, and the workload-matrix verifier proves the same two runtime paths across `smoke` / `medium` / `heavy` corpus sizes with sync/select telemetry and aligned representation metadata.
- Tauri strict evidence is implementation-closed but still host-dependent:
  - the current Windows host proves non-strict tauri/runtime behavior and load-flow parity,
  - Linux strict evidence commands (`verify:agent-workspace:tauri:rust:strict`, `verify:agent-workspace:tauri:window-evidence:strict`, strict evidence index/manifest) still require provisioned `webkit2gtk-4.1`, `javascriptcoregtk-4.1`, and `libsoup-3.0`.
- Sidecar/bootstrap readiness on the current Windows host is now `offline-ready`; remaining bootstrap work is policy hardening before strict no-LFS mode, not an immediate host-readiness blocker.
- Practical Phase boundary:
  - interaction/runtime verification infrastructure is strong enough to continue selective Phase-3 hardening in parallel,
- but neither Phase-1 backend closure nor Phase-2 governance closure is actually done at HEAD,
- remaining work is not only ops/release prerequisites; it still includes unresolved real graphdb/ANN delivery, stronger release-grade calibration for the new diagnostics, and continued architecture reduction.

Operational note:

- the live server serves frontend assets from `dist/src/frontend`, so `src/frontend/*` changes do not reach runtime verification until a fresh `npm run build` copies them into the dist tree.
- there is now a dedicated smoke command, `npm run verify:agent-workspace:runtime`, which copies the current frontend into a temporary runtime tree, boots a real sidecar/server, and verifies that the served root HTML and locale payload expose the agent workspace shell.
- there is also a browser-driven smoke command, `npm run verify:agent-workspace:browser`, which seeds a minimal knowledge document through the real ingest API, writes a minimal `data.js` seed so the page boots real graph/path runtimes, opens the served shell in a real Chromium session, drives the agent-workspace conversation/action flow against the real `conversation/path/query-compare/quality/session/runbook` backend slice, verifies localized action/message re-rendering (including runbook checks/action-queue cards), checks graph-focus promotion enter/exit state, and emits screenshot/console/network-summary evidence paths for failure diagnosis.
- there is now a Rust-targeted tauri contract command, `npm run verify:agent-workspace:tauri:rust`, which executes the `pathmode_window_toggle_plan`/`pathmode_window_toggled_event_payload` cargo tests when required system libs exist; local non-strict mode reports `SKIP` if `webkit2gtk-4.1`, `javascriptcoregtk-4.1`, or `libsoup-3.0` are unavailable, while CI/strict mode fails hard.
- there is now a real app/window evidence command, `npm run verify:agent-workspace:tauri:window-evidence`, which attempts dedicated Rust window-lifecycle evidence tests and writes structured reports/logs; if host dependencies are missing it reports `degraded` (non-strict) with explicit reasons, while strict mode hard-fails.
- there is now a strict evidence index command, `npm run verify:agent-workspace:tauri:evidence:index`, which builds a normalized latest-report index across rust/window/smoke artifacts, validates the generated report against `schemas/agent-workspace-tauri-evidence-index.schema.json`, and in strict mode fails when required evidence is missing or not passed.
- there is now a tauri evidence summary renderer, `npm run verify:agent-workspace:tauri:evidence:summary`, which writes `output/tauri/agent-workspace-evidence-index/evidence-summary-latest.md` for operator review and can be published into `GITHUB_STEP_SUMMARY` in CI workflows.
- there is now a tauri evidence release-fragment renderer, `npm run verify:agent-workspace:tauri:evidence:release-fragment`, which emits `output/tauri/agent-workspace-evidence-index/release-fragment-latest.md` and can be appended to `GITHUB_STEP_SUMMARY` for release-gate audit context.
- there is now a tauri evidence manifest renderer, `npm run verify:agent-workspace:tauri:evidence:manifest`, which emits `output/tauri/agent-workspace-evidence-index/evidence-manifest-latest.json`, validates the payload against `schemas/agent-workspace-tauri-evidence-manifest.schema.json`, and includes strict-validation diagnostics over required evidence artifacts.
- there is now a release-note publisher, `npm run verify:agent-workspace:tauri:evidence:publish-release-notes -- --tag <release_tag>`, which upserts the latest tauri evidence fragment into the target GitHub Release body via stable begin/end markers.

## Phase Snapshot (Revalidated 2026-05-12)

| Phase | Plan Target | Current Status | Evidence |
|---|---|---|---|
| Phase 1 | Knowledge parsing + graph backbone + staleness governance | Operational baseline | `src/learning/store.ts`, `src/learning/queryBackend.ts`, `src/learning/vectorAccelerationAdapter.ts`, `src/server.ts` |
| Phase 2 | Mastery loop + divergence engine | Partial | `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/path_app.js` |
| Phase 3 | Pluggable tutor + memory operating layer | Early operational | `src/learning/KnowledgeLearningPlatform.ts`, `src/learning/tutorAdapter.ts`, `src/server.ts`, `src/routes/knowledge.ts` |

## Layer-by-Layer Implementation Matrix

| Layer | Goal | Implemented Baseline | Remaining Work |
|---|---|---|---|
| L0 Representation | Parse document content into atom/evidence units | Atom, evidence, source hash and staleness rebuild are implemented (`ingestKnowledge`, staleness APIs) | Add richer formula/code normalization and stronger parser telemetry granularity |
| L1 Structure | Build relation + temporal graph for learning reasoning | `RelationEdge` with `provenance`, `TemporalEdge` with active validity window are implemented | Improve relation quality scoring and cross-document conflict handling |
| L2 Retrieval | Evidence-first explainable retrieval | `local_hybrid`, `keyword_only`, and `local_vector` retrieval backends exist with ANN-style prefilter, fallback telemetry, and a live sync-backed `external_http` acceleration path; the default graph store baseline is now embedded `graphdb/sqlite` with restart-durability proof | Keep the remaining backend gap honest: packaged/runtime + heavier-workload hardening are still open for graphdb, and ANN still needs benchmarked rollout thresholds plus larger-workload validation |
| L3 Learning | Mastery diagnostics + actionable path generation | Mastery diagnostics, misconception summaries, dual-path recommendation, session execution primitives, and live quality/session-plan trend surfaces are implemented | Calibrate the now-live `learning quality` / `session plan quality` history-trend-evaluation surfaces on top of a release-grade graphdb/ANN baseline before claiming Phase-2 gate closure |
| L4 Interaction | Workbench for operations + tutoring + diagnostics | The agent workspace shell, focus/path panes, typed capability contract, runtime/browser smoke, and turn-cache operator surfaces are real | Keep the shell/runtime evidence healthy, but stop treating observability cards as release-closed while they still depend on an operational rather than release-grade graph/ANN baseline |
| L5 Governance | Runtime checks, trend gates, remediation loop | Runtime capability matrix, connector/circuit telemetry, ANN index-sync telemetry, remediation plumbing, and operator-facing verify/checks drilldowns for ANN sync/circuit/traceability/prefilter are real | Tie governance upgrades to non-empty live thresholds plus adapter-backed telemetry on top of a release-grade graph/ANN baseline |

## Architecture Refactoring Status (2026-05-05, FINAL)

A 12-phase refactoring (A→L) was executed against the baseline. The following modules are now delivered:

### New Module Inventory

| Module | Files | Purpose |
|---|---|---|
| `src/routes/` | 10 | Modular API route handlers (66 routes across knowledge, notemd, markdown, render, data, diagnostics) |
| `src/middleware/` | 5 | HTTP middleware (cors, auth, body-parser, request-trace) |
| `src/learning/domains/` | 8 | Domain classes extracted from KnowledgeLearningPlatform (7 classes + 7 Platform interfaces) |
| `src/frontend/*.mjs` | 4 | ES module versions of i18n, runtime_bridge, main entry, worker bridge |
| `src/utils/platform.ts` | 1 | Cross-platform detection (Linux XDG / macOS Library / Windows LOCALAPPDATA) |
| `src-tauri/tauri.{linux,macos,windows}.conf.json` | 3 | Platform-specific Tauri configs |
| `vite.config.ts` | 1 | Vite 5-entry multi-page build (4 chunks: main/graph-app/agent-workspace/path-mode) |
| `docs/solutions/` | 2 | Cross-platform refinement plan + implementation gap analysis |
| `docs/archive/` | 3 | Archived TODO.md files (448KB) |
| `docs/zh/analysis_ref.md` | 1 | Chinese translation of reference analysis (updated for Tauri v2) |
| `docs/release_notes_v1.6.6.md` | 1 | Canonical quality bar release notes (EN+ZH) |

### Refactoring Metrics

| Metric | Before | After |
|---|---|---|
| Route modules | 0 (inline if/else chain) | 10 modules, 66 routes |
| Middleware modules | 0 (inline functions) | 5 independent modules |
| Domain classes | 1 (13,370-line monolith) | 7 classes with typed Platform interfaces |
| Frontend module system | `<script>` tag chain | ES modules + Vite 4-chunk |
| Platform configs | 1 generic + 1 Android | 5 configs (Linux/macOS/Windows/Android + generic) |
| Platform path logic | 1-line `win32` check | `platform.ts` with proper XDG/Library/LOCALAPPDATA |
| Godot renderer | GL Compatibility | Forward+ (Vulkan) with Wayland fallback |
| Mobile build paths | 2 (Capacitor + Tauri Android) | 1 (Tauri Android, Capacitor deprecated) |
| TODO files | 448KB in docs tree | Archived to `docs/archive/` |
| Bilingual doc pairs | 21 | 24 |
| CI jobs (migration-gates) | 16 | 18 |
| Route contract tests | 0 | 10/10 passing |
| Runtime observability | No route migration metrics | registryHitRate + migrationProgress + 7 domain panels |
| Route migration coverage | 0% | 91.3% (73 modular + 7 terminal inline) |
| Inline chain complexity | Monolithic if/else chain | Clearly sectioned + [REGISTRY_COVERED] annotations |
| Domain class method bodies | 0 (all in monolith) | 7/7 complete (validate → delegate → augment → diagnostics) |
| Vite build time | N/A | 437ms |
| Path-mode chunk size | N/A | 93KB (from 430KB in legacy bundle) |
| tsc errors | 255 (pre-existing M8-M10) | 26 (-90%) |
| Domain method body migration depth | Delegation only | 4-domain-method deep (Ingestor: staleness+guardrails, Querier: validation+cache, Mastery: path validation) |

### Domain Class Implementation Status

| Domain Class | Platform Interface | Own Logic | Production Use |
|---|---|---|---|
| `KnowledgeIngestor` | `IngestPlatform` | 4 domain gates, staleness analysis (freshnessScore/freshnessRating/staleBySource), staleness trend (100-snapshot history, getFreshnessTrend), latency tracking, guardrail pass rate, 10 diagnostics | ✅ `POST /api/knowledge/ingest` |
| `KnowledgeQuerier` | `QueryPlatform` | Query validation (empty/length/max), _domain telemetry, cache (TTL+pruning), latency P95, 10 diagnostics | ✅ `POST /api/knowledge/query` |
| `ConversationManager` | `ConversationPlatform` | Query+memory validation, turn count, response latency, memory ops, 6 diagnostics | ✅ (instantiated) |
| `MasteryEngine` | `MasteryPlatform` | Path validation, _domain augmentation (pathLength/duration), session metrics, 6 diagnostics | ✅ (instantiated) |
| `QualityEvaluator` | `QualityPlatform` | User validation, pass rate tracking (200-window), snapshot metrics, 5 diagnostics | ✅ (instantiated) |
| `TutorRouter` | `TutorPlatform` | UserID+actionKind validation, action distribution, execution metadata, 4 diagnostics | ✅ (instantiated) |
| `MemoryPolicyManager` | `MemoryPlatform` | UserID+layer validation, policy layer distribution, _domain augmentation, 5 diagnostics | ✅ (instantiated) |

## Core API and Runtime Baseline

## Contract layer

- API interfaces: `src/learning/api.ts`
- Core types: `src/learning/types.ts`
- Public export boundary: `src/learning/index.ts`
- Contract coverage: `src/knowledge.api.contract.test.ts`

## Server layer

- `/api/knowledge/*` routes are normalized and alias-compatible in `src/server.ts`.
- Runtime diagnostics endpoint: `GET /api/runtime-request-trace`.
- Runbook endpoints:
  - `GET /api/knowledge/runtime-capability-runbook`
  - `GET /api/knowledge/runtime-capability-runbook/verify`
  - `GET /api/knowledge/runtime-capability-runbook/history*`
  - `POST /api/knowledge/runtime-capability-runbook/remediation-event`
  - `POST /api/knowledge/runtime-capability-runbook/remediation-event/replay`

## State and storage layer

- Store backends in `src/learning/store.ts`:
  - `file`
  - `memory`
  - `graphdb` (now supports embedded SQLite, file, and HTTP adapter paths)
- Current structural limit: the new default graphdb path is embedded SQLite with explicit fallback, but it still needs packaged/runtime proof and workload hardening before being called production-closed.

## Retrieval layer

- Query backend implementations in `src/learning/queryBackend.ts`:
  - `local_hybrid`: keyword + semantic token similarity + relation degree + temporal filtering trace
  - `keyword_only`: keyword-dominant retrieval with temporal filtering
  - `local_vector`: TF-IDF-like local vector similarity + semantic overlap + graph relation bonus, with durable local index snapshot (`knowledge_query_vector_index.v1.json`), ingest-triggered invalidation, lazy refresh by atom signature, ANN-style token/signature prefilter (`ann_prefilter`) with automatic full-scan fallback, and a pluggable acceleration adapter boundary (`local` default + `external_stub` + `external_http`)
- Known structural limits:
  - current external adapter implementations are scaffolds for integration hardening (including `external_http` timeout/retry/circuit-breaker baseline), not production ANN engine connectors,
  - larger-corpus workloads still need dedicated external ANN backends plus benchmarked threshold tuning.
- Governance coverage:
  - runtime checks now distinguish backend availability, vector index readiness, and persistence mode.
  - vector acceleration circuit governance now evaluates warn/fail budgets on short-circuit count/ratio, consecutive failures, and half-open probe success rate.
  - ANN prefilter effectiveness governance now tracks `lastSelectionMode` + `lastCandidateCount` and fails when `ann_prefilter` remains on persistent `full_scan` fallback under stable connector traffic.
  - ANN prefilter effectiveness thresholds are now tunable via runtime env controls (minimum sample size + warn/fail candidate-ratio budgets) for corpus-specific rollout calibration.
  - runbook action queue now adds a dedicated prefilter-risk tie-break inside the same priority band so `query_vector_acceleration_prefilter_effectiveness` remediation actions surface earlier when the check is `warn|fail`.
  - remediation-event replay automation is now available via `POST /api/knowledge/runtime-capability-runbook/remediation-event/replay` to replay risk checks from remediation history into a fresh verify cycle.
  - server integration now validates external_http circuit-open propagation across `/api/knowledge/query-backend-diagnostics`, `/api/knowledge/runtime-capability-matrix`, and runbook verify endpoints.

## Workbench layer

- Frontend orchestration and diagnostics entry: `src/frontend/path_app.js`.
- Key observability integration:
  - runtime runbook dashboards
  - request trace filtering
  - query backend diagnostics/config
  - remediation replay controls in workbench (`risk_only|all`, replay limit 1-24) with local preference persistence
  - remediation replay schedule orchestration controls in workbench (enable/interval/trigger policy + thresholds) with API-backed snapshot + manual tick
  - vector acceleration governance visibility in runtime summary (`queryVectorAcceleration(...)` now surfaces live counters, circuit warn/fail threshold tuples, and embedded prefilter budget snapshot driven by matrix signals)
  - runbook `history/checks` now exposes structured ANN prefilter effectiveness snapshots (`queryVectorAccelerationPrefilter`) at both summary and per-check levels for threshold-aware incident triage
  - dedicated vector acceleration governance drilldown panel in the runbook section (structured status/threshold/flag/action view for `query_vector_acceleration_circuit_state`, remote ANN sync-health view for `query_vector_acceleration_index_sync_health`, prefilter selection/candidate telemetry + threshold budget/action view for `query_vector_acceleration_prefilter_effectiveness`, plus traceability coverage/action view for `query_vector_acceleration_traceability`), and the server-side runbook history/action-queue layer now treats the sync-health gate as a first-class incident object
  - path strategy telemetry and session history analytics

## Practice Runbook (Engineering Workflow)

## 1) Contract-first verification

```bash
npm test -- src/knowledge.api.contract.test.ts --runInBand
```

## 2) Docs governance and page stability

```bash
npm run docs:diataxis:check
npm run docs:site:build
npm run docs:site:serve
```

## 3) Runtime route and diagnostics sanity checks

- Validate runbook reads:
  - `GET /api/knowledge/runtime-capability-runbook`
  - `GET /api/knowledge/runtime-capability-runbook/verify?limit=20`
- Validate trace correlations:
  - `GET /api/runtime-request-trace`
  - `GET /api/runtime-request-trace?requestId=<exact_request_id>`
- Validate turn-cache operator diagnostics and trend governance:
  - `GET /api/knowledge/conversation/turn-cache/diagnostics`
  - `GET /api/knowledge/conversation/turn-cache/diagnostics/trend?limit=20&windowSize=6&minSamples=3`
  - `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/index?limit=20`
  - `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/export?limit=50`
- Validate copied-frontend runtime shell:

```bash
npm run verify:agent-workspace:runtime
```

- Validate browser-rendered shell and interaction loop:

```bash
npm run verify:agent-workspace:browser
```

- Validate desktop lifecycle proxy smoke (runtime + tauri config + source lifecycle contracts + promotion lifecycle test):

```bash
npm run verify:agent-workspace:tauri
```

- Validate Rust-side tauri lifecycle contracts (`pathmode_window_toggle_plan*`, strict in CI):

```bash
npm run verify:agent-workspace:tauri:rust
npm run verify:agent-workspace:tauri:rust:strict
```

- Validate app/window lifecycle evidence path (degraded-friendly local mode + strict mode):

```bash
npm run verify:agent-workspace:tauri:window-evidence
npm run verify:agent-workspace:tauri:window-evidence:strict
```

- Build strict evidence index (local + CI strict mode):

```bash
npm run verify:agent-workspace:tauri:evidence:index
npm run verify:agent-workspace:tauri:evidence:index:strict
npm run verify:agent-workspace:tauri:evidence:summary
npm run verify:agent-workspace:tauri:evidence:release-fragment
npm run verify:agent-workspace:tauri:evidence:manifest
npm run verify:agent-workspace:tauri:evidence:manifest:strict
npm run verify:agent-workspace:tauri:evidence:publish-release-notes -- --tag <release_tag>
```

## 4) Query strategy sanity checks

- Compare backends with same query and inspect explainability gaps:
  - `POST /api/knowledge/query/compare-backends`
- Review recent comparison history:
  - `GET /api/knowledge/query/compare-backends/history?limit=8`
- Review trend window:
  - `GET /api/knowledge/query/compare-backends/trend`

## 5) Session strategy quality checks

- Evaluate strategy-outcome consistency:
  - `GET /api/knowledge/session/history?pathStrategySelectionSource=strategy_trend&sinceMinutes=10080`
  - `GET /api/knowledge/quality/trend`
  - `GET /api/knowledge/session/plan/quality/trend`

## Next Increments (Priority Order)

1. Close CI coverage gaps for the agent-workspace contract suites: keep tauri strict evidence jobs, and add always-on parity/frontend contract gates (`src/agent_workspace.contract.parity.test.ts`, `src/agent_workspace.frontend.test.ts`, `src/agent_workspace.tauri.contract.test.ts`) as first-class CI blockers.
2. Carry the embedded `graphdb/sqlite` baseline from restart-durability proof to packaged/runtime + heavier-workload closure while preserving explicit fail-open/fail-closed rollout semantics; use `verify:foundation:release-evidence` after release report generation to confirm host evidence is still fresh.
3. Finish ANN release-grade closure by keeping the new sync-backed `external_http` path healthy under real traffic, then tightening workload/threshold calibration.
4. Move next into Phase-2 gate promotion only after the same checks run on a release-grade graphdb/ANN baseline.
5. Add CI-integrated durability checks for persisted turn-cache trend index/export consistency across restart flows.
6. Continue strict evidence artifact governance improvements (retention/indexability/export) for operator audits, and keep i18n expansion as a lower-priority stream unless it directly unblocks contract/foundation risk.

## Cross-Platform Architecture Refinement (2026-05-02)

A comprehensive cross-platform compatibility audit and architecture health assessment was completed. Key findings and the unified remediation plan are documented in:

- [Cross-Platform Architecture Refinement Plan](../../../solutions/cross-platform-architecture-refinement-2026-05-02.md)

The plan identifies 6 blocking-level cross-platform issues (Linux asset://localhost 403, missing Windows sidecar binaries, macOS arm64 signing requirement, Wayland + Godot GL crash, WebKitGTK dependency gaps, CI matrix gaps) and 3 monolithic code files (server.ts 16,848 lines, path_app.js 15,140 lines, KnowledgeLearningPlatform.ts 13,370 lines) that together constitute the highest-priority technical debt. The remediation is organized into three phases aligned with the M10 foundation hardening stream.

**Key insight**: Code monoliths and platform fragility are causally linked — splitting server.ts enables platform-specific route handling without touching 16,848-line files; extracting platform.ts eliminates the single `process.platform === 'win32'` pattern that currently handles all Unix platforms identically.

## Related Pages

- [Knowledge Mastery Evolution Roadmap](./knowledge-mastery-evolution-roadmap.md)
- [Agent Conversation + Focus Mode Delivery Plan](./agent-conversation-focus-mode-plan.md)
- [Interfaces and Runtime Contracts](../reference/interfaces-and-runtime.md)
- [Learning Platform Contract and Workbench Baseline](../../../solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md)
- [Agent Workspace Contract Closure Next Direction Requirements (2026-04-14)](../../../brainstorms/2026-04-14-agent-workspace-contract-closure-next-direction-requirements.md)
- [Evolution Progress Alignment Requirements](../../../brainstorms/2026-04-11-evolution-progress-alignment-requirements.md)

## 2026-07-19 v1.8.0 Graph Answer Planning Checkpoint

Status: implementation and full verification complete.

- Closed the RAG composer early-return bypass; the ordered plan now drives the public draft.
- Replaced one-required-claim-per-role with confidence plus novelty semantics.
- Moved public claim shaping before planning while retaining raw provenance.
- Corrected RAG completeness and citation gates for rich plan-driven answers.
- Preserved required claims through release revision and recalculated final coverage.
- Upgraded Water Glass runtime acceptance to verify required IDs, plan order, and leakage hygiene.
- Verified the final repository state: 122/122 Jest suites passed (1,147 passed, 26 skipped), `build:with-vite` passed, the strengthened Water Glass runtime acceptance passed, Diataxis and MkDocs validation passed, and `git diff --check` passed.

The earlier checkpoint proved plan construction and projection, but did not prove that RAG prose executed the plan. This completed phase closes that causal gap. Residual work is quality calibration for dense source clauses, not another orchestration hierarchy.

### Code-humanizer follow-up

The first code-humanizer pass removed duplicated graph-window extraction through `graphAnswerFacts.ts`, with focused and full-suite verification. Similar helpers with different normalization or non-finite-value contracts remain intentionally unchanged; the audit found no safe dead-code deletion or unjustified abstraction removal.

The completed repository-wide pass also consolidated four identical NoteMD no-op progress reporters and removed 20 narrating backend comments. Script-local CLI helpers and frontend `.js`/`.mjs` migration pairs remain explicit exemptions pending characterization or migration closure. Final oracle: 123/123 suites, 1,149 passed, 26 skipped; TypeScript, production/Vite build, Diataxis, MkDocs, and diff hygiene passed.

## 2026-07-19 Final Delivery Alignment

| Stage | Current owner/evidence | Progress | Next decision |
|---|---|---|---|
| Bounded graph context | `graphContextAssembler.ts`, relation/path/temporal tests | Complete | Keep graph breadth bounded by intent and evidence |
| Coverage-driven planning | `graphAnswerPlan.ts`, calibration corpus, omission trace | Complete | Calibrate source clauses, not answer length |
| RAG/non-RAG realization | `conversationComposer.ts` and `buildPlanDrivenRagAnswer()` | Complete | Improve discourse fluency without templates |
| Final release invariants | `answerReleaseReview.ts`, final coverage recalculation, citation-backed plan evidence | Complete | Preserve deterministic replayability |
| Runtime acceptance | required IDs, plan order, Water Glass leakage hygiene | Complete | Add readability metrics before source-quality rollout |
| Operator projection | Grounding Inspector plan/coverage/expansion view | Complete | Keep internal scaffolding out of public prose |
| Structural cleanup | graph facts, NoteMD reporter owner, narrating-comment removal | Complete | Characterize script helpers before consolidation |
| Clause-level source quality | no production scorer/segmenter exists yet | Not started | Add clause segmentation, quality features, and non-regression gates |
| Orchestration extraction | remains inside `KnowledgeLearningPlatform.ts` | Conditional | Extract only a complete planned/reviewed-answer operation |

The critical unresolved question is not “how do we add another agent layer?” It is: **how can the runtime select fluent, clause-sized evidence from dense source fragments without weakening required graph coverage, provenance, or deterministic release review?** That is the next engineering phase.
