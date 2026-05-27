# Explanation: Agent Conversation + Focus Mode Delivery Plan

This page defines the current delivery focus for NoteConnection:

- the user chats with an agent in the frontend,
- the frontend lists locally resolvable knowledge points,
- clicking a knowledge point opens a docked Tauri graph `focus mode` pane for the selected node,
- clicking a "Learning Path" action opens a docked learning-path pane for that focus,
- the graph-focus pane and learning-path pane may coexist side by side,
- both panes support promote-to-fullscreen behavior independently.

This is the current product-facing priority because it connects the existing learning core to a
single, discoverable interaction loop instead of leaving tutor, path, and focus behaviors split
across separate UI surfaces.

## 2026-05-27 Tauri-First Reply Delivery

The Tauri-first reply-rendering baseline is now implemented.

Delivered now:

- `src/learning/types.ts` and `src/learning/KnowledgeLearningPlatform.ts` now expose backward-compatible `assistantBlocks` beside legacy `assistantMessage`,
- `src/frontend/markdown_runtime.js` now provides a shared markdown/math/mermaid runtime extracted from the Reader-side logic,
- `src/frontend/workspace_panes.js` now mounts structured assistant replies through typed blocks instead of only plain text when structured payloads are present,
- `src/frontend/agent_workspace.js` keeps the legacy fallback path so older `assistantMessage`-only responses still work,
- `html_artifact` rendering now has a sandboxed preview path instead of requiring arbitrary full-HTML injection into the main chat DOM.

If Tauri is temporarily allowed to lead and Godot is treated as a later adaptation target, the
architecture center is now aligned as intended:

- Tauri is the rich-render baseline,
- the Reader markdown/math/mermaid pipeline is the render substrate,
- Godot can later consume downgraded/materialized output instead of constraining Tauri-first UX now.

### Delivered implementation program

1. **Response contract evolution**
   - `assistantMessage` remains as a compatibility fallback.
   - `assistantBlocks` is now present for typed reply rendering.
   - Current block baseline:
     - `main_markdown`
     - `citations`
     - `knowledge_actions`
     - `system_notice`
     - optional `html_artifact`
   - Primary touch points:
     - `src/learning/api.ts`
     - `src/learning/types.ts`
     - `src/learning/KnowledgeLearningPlatform.ts`
     - `src/server.ts`

2. **Shared render runtime extraction**
   - The mature Reader pipeline is now reused instead of creating a fourth markdown path.
   - The reusable markdown/math/mermaid runtime is extracted from:
     - `src/frontend/reader.js`
     - `src/frontend/app.js`
     - `src/reader_renderer.ts`
     - `src/routes/render.ts`
   - The shared runtime remains browser/Tauri-friendly and preserves a later Godot materialization boundary.

3. **Message block renderer in the agent workspace**
   - Plain message mounting is now replaced by a typed block renderer where structured payloads are present.
   - Conversation-card/result-presentation registries remain intact.
   - Assistant-reply rendering now lives in:
     - `src/frontend/agent_workspace.js`
     - `src/frontend/workspace_panes.js`
     - `src/frontend/index.html`
     - `src/frontend/styles.css`

4. **HTML artifact path**
   - Arbitrary full HTML is not injected into the main chat DOM.
   - Large HTML payloads are treated as artifacts with a sandboxed preview flow.

5. **Streaming and transition safety**
   - SSE + sync fallback behavior is preserved.
   - Structured replies now flow through `main_markdown` blocks while legacy replies still fall back cleanly.
   - Current `knowledgePoints` and capability execution behavior stays forward-compatible.

### Remaining follow-up

- expand block usage where future endpoints emit richer assistant payloads,
- keep the new render substrate honest through real browser/Tauri verification,
- decide later whether Reader itself should delegate more of its internal rendering helpers to the shared runtime rather than only sharing extracted logic.

### Acceptance criteria for this delivered slice

1. Tauri agent replies can render markdown headings, lists, tables, KaTeX, and Mermaid without leaving persistent error overlays in the visible chat surface.
2. The reply surface still works when only legacy `assistantMessage` is present.
3. Existing `knowledgePoints`, capability execution, and card registries remain backward-compatible.
4. The same shared render substrate can later be materialized or downgraded for Godot instead of forcing Godot constraints into the Tauri-first UX now.

## Current Branch Status

The branch has already crossed the "plan only" stage for this slice.

Implemented now:

- `POST /api/knowledge/conversation` returns actionable local knowledge points from the learning platform.
- the main frontend ships an `agent workspace` shell in `src/frontend/index.html`.
- clicking `Focus` resolves a live graph node and opens the existing graph focus flow.
- clicking `Learning Path` now mounts the existing path workspace into the docked pane instead of rendering a text-only placeholder.
- the graph layout now reserves width for the docked workspace so the graph surface and agent surface can coexist.
- graph-focus fullscreen now promotes the real graph workspace while keeping a restorable control card in front of it.
- the new shell strings and runtime empty/fullscreen labels now have bilingual coverage, existing knowledge-card actions / localized system messages re-render on language switch, and conversation card rerender now flows through a centralized card-kind renderer registry in `workspace_panes` to reduce drift risk.
- conversation knowledge points now carry an execution-capable typed descriptor surface: `focus` and `learning path` are joined by tutor-side `generate_quiz` / `recap` / `generate_transfer` / `generate_counterexample` / `follow_up`, query-side `compare_query_backends` / `inspect_query_backend_diagnostics` / `inspect_query_backend_comparison_history` / `inspect_query_backend_comparison_trend`, tutor diagnostics `inspect_tutor_adapter_telemetry` / `inspect_tutor_trace_diagnostics`, quality/session diagnostics (`inspect_learning_quality_trend` / `inspect_learning_quality_history` / `inspect_session_plan_quality_trend` / `inspect_session_plan_quality_history`), and session-side `inspect_session_history` / `build_study_session`, while descriptors include execution, failure, and UI-hint metadata.
- tutor/memory diagnostics are now partly real on the backend: tutor telemetry, tutor trace/provider trends, conversation memory, and memory-policy diagnostics no longer stop at empty placeholders.
- browser smoke now exercises real `conversation/path/query-compare/query-compare-history/query-compare-trend/quality-trend/quality-history/session-plan-quality-trend/session-plan-quality-history/session-plan` backend flows, real graph runtime, and real path runtime with screenshot/console/network-summary evidence artifacts.

Still open:

- strict Tauri lifecycle/window evidence is implementation-closed, but host-dependent in practice: Linux/CI hosts with `javascriptcoregtk-4.1`, `libsoup-3.0`, and `webkit2gtk-4.1` should pass `verify:agent-workspace:tauri:rust:strict`, `verify:agent-workspace:tauri:window-evidence:strict`, `verify:agent-workspace:tauri:evidence:index:strict`, and `verify:agent-workspace:tauri:evidence:manifest:strict`; the current Windows host instead proves the non-strict tauri/runtime behavior and load-flow parity path.
- long-lived dynamic conversation cards beyond the current `study_session_card` / `tutor_action_card` / `session_history_card` / `query_backend_comparison_card` / `query_backend_diagnostics_card` / `query_backend_comparison_history_card` / `query_backend_comparison_trend_card` / `tutor_adapter_telemetry_card` / `tutor_trace_diagnostics_card` / `learning_quality_trend_card` / `learning_quality_history_card` / `session_plan_quality_trend_card` / `session_plan_quality_history_card` paths now share registry-driven rerender wiring, and a source-level guard test now enforces append-kind/registry parity (`src/agent_workspace.frontend.test.ts`); follow-up work is to keep each new card kind wired through that gate by default.
- the execution-capable contract is now backed by live query-comparison, staleness, learning-quality, session-plan-quality, and query-backend-diagnostics results in `src/learning/KnowledgeLearningPlatform.ts`; follow-up work is to calibrate those outputs against a real Phase-1 graphdb/ANN baseline and then promote them into release-grade gates.
- server bootstrap now injects an active default local `tutorAdapter` while keeping the `local` + `cloud` adapter catalog, so normal runtime tutor execution can emit adapter telemetry; the remaining routing work is production-proven multi-provider policy rather than basic activation.

## Product Target

The target flow is:

1. User enters a request in a frontend conversation surface.
2. The backend returns:
   - normal conversational answer,
   - ranked local knowledge points that are actually resolvable inside the current graph,
   - optional path-oriented actions.
3. When the user clicks a knowledge point:
   - the frontend resolves the corresponding graph node,
   - the conversation surface remains primary,
   - the side work area displays the existing Tauri graph `focus mode` for that node,
   - the graph-focus pane may remain visible alongside the learning-path pane,
   - the user may promote that pane to fullscreen.
4. When the user clicks `Learning Path`:
   - the side work area opens a learning-path pane for the selected focus,
   - it does not require replacing the graph-focus pane,
   - the user may promote that pane to fullscreen for the richer path workspace.

## Interaction Model

The intended UX model is:

- primary surface: agent conversation,
- secondary surface: docked side work area,
- child panes inside that area:
  - graph focus mode,
  - learning path,
- escalation action: fullscreen promote.

This means:

- node click must not replace the conversation surface,
- learning-path view must not replace graph focus by default,
- the product must support parallel visibility of both panes,
- fullscreen is a view promotion, not the default path.

## Why This Is the Current Priority

The repo already has the core primitives:

- knowledge query and tutor actions:
  - `src/learning/KnowledgeLearningPlatform.ts`
  - `src/server.ts`
- learning path generation:
  - `src/learning/KnowledgeLearningPlatform.ts`
- frontend learning workbench and bridge-aware UI:
  - `src/frontend/path_app.js`
  - `src/frontend/app.js`
- Tauri window toggle:
  - `src-tauri/src/lib.rs`
- Godot path and tree rendering:
  - `path_mode/scripts/path_renderer.gd`
  - `path_mode/scripts/path_mode_ui.gd`
  - `path_mode/scripts/tree_view_panel.gd`
  - `path_mode/scripts/learning_state_machine.gd`
- bridge message relay:
  - `src/core/PathBridge.ts`

The gap is not missing infrastructure. The gap is missing orchestration and a host-owned pane model
that makes those primitives act like one feature.

## Delivery Constraints

## Constraints to preserve

- keep `src/learning/api.ts` as the contract source of truth,
- keep the agent conversation surface as the owning container,
- do not bypass `PathBridge` with Godot-specific frontend hacks,
- do not make Godot the source of truth for path selection,
- do not fork separate "chat path" and "workbench path" implementations,
- keep Tauri and browser fallback behavior deterministic.

## Non-goals for this slice

- no second memory platform,
- no external Python service dependency,
- no React/Vue/Electron sub-application for chat,
- no rewrite of current tutor/runtime governance,
- no redesign of Godot UI layout system,
- no broad multi-agent runtime introduction.

## Complexity Posture

Implementation should minimize moving parts.

That means:

- reuse the existing HTML/CSS/JS frontend shell,
- extend current sidebars / overlays / panel controllers before adding new containers,
- avoid introducing a separate chat frontend framework,
- treat external desktop clients as interaction references, not donor codebases.

Concrete local reuse targets:

- `src/frontend/index.html`
- `src/frontend/styles.css`
- `src/frontend/workspace_panes.js`
- `src/frontend/agent_workspace.js`
- `src/frontend/path_app.js`
- `src/frontend/app.js`

Runtime caveat:

- the live sidecar/frontend server serves from `dist/src/frontend`, so changes under `src/frontend/*` only become runtime-visible after `npm run build`.
- use `npm run verify:agent-workspace:runtime` to validate the copied frontend shell against a real temporary sidecar/server instead of relying on manual `npm start` checks.
- use `npm run verify:agent-workspace:browser` to validate the rendered shell in a real browser after seeding a minimal document through the real ingest API and writing a minimal `data.js` seed; the check now exercises real graph/path runtimes, the real `conversation/path/query-compare/quality/session/runbook` backend slice (including trend + history diagnostics plus runbook verify/checks/action-queue), localized card/message re-rendering, graph-focus promotion state changes, ANN sync-health rendering evidence across runbook cards, and emits screenshot/console/network-summary evidence paths.
- the next implementation priority is no longer proving that the shell can run; it is shrinking the contract gap between `conversation` output and frontend action orchestration.

External UX references:

- Cherry Studio official repository: `https://github.com/CherryHQ/cherry-studio`
- Chatbox official repository: `https://github.com/chatboxai/chatbox`

What to borrow from those references:

- docked chat + workspace composition,
- message-centric action affordances,
- lightweight pane promotion and restore behavior.

What not to borrow:

- their app stack,
- their state architecture,
- their packaging/runtime model.

## Required Architecture

## 1. Conversation runtime contract

The minimal typed conversation-oriented capability layer now exists above the current learning APIs.
The next step is to broaden it without reintroducing endpoint-specific UI branching.

The response contract now returns, at minimum:

- conversational message,
- cited or evidence-bound knowledge hits,
- local knowledge point cards,
- CTA actions:
  - `open_focus_mode`
  - `open_learning_path`
  - `generate_quiz`
  - `recap`
  - `generate_transfer`
  - `generate_counterexample`
  - `follow_up`
  - `compare_query_backends`
  - `inspect_query_backend_diagnostics`
  - `inspect_query_backend_comparison_history`
  - `inspect_query_backend_comparison_trend`
  - `inspect_tutor_adapter_telemetry`
  - `inspect_tutor_trace_diagnostics`
  - `inspect_learning_quality_trend`
  - `inspect_learning_quality_history`
  - `inspect_session_plan_quality_trend`
  - `inspect_session_plan_quality_history`
  - `inspect_session_history`
  - `build_study_session`

Capability descriptors now also carry:

- execution semantics,
- failure semantics,
- optional UI hints.

Implementation rule:

- local knowledge points must reference resolvable graph atoms or node IDs only,
- the frontend must never render a click target that cannot be mapped back to local graph state.

Likely touch points:

- `src/learning/api.ts`
- `src/learning/types.ts`
- `src/server.ts`
- `src/learning/KnowledgeLearningPlatform.ts`

## 2. Frontend chat surface

The frontend needs a dedicated agent-chat entry, not a prompt pop-up attached to an existing button.

Responsibilities:

- submit the user message,
- render streamed or batched assistant output,
- render local knowledge-point cards from the response,
- render explicit action buttons per knowledge point,
- manage a host-owned side work area that can hold both graph-focus and learning-path panes,
- keep node-selection logic separate from rendering logic.

Likely touch points:

- `src/frontend/path.html`
- `src/frontend/path_styles.css`
- `src/frontend/path_app.js`

Best practice:

- add one integration surface in `path_app.js` for "conversation result to graph action mapping",
- add one pane-layout controller for dock / undock / split / fullscreen state,
- do not spread click-to-focus logic across HTML handlers and bridge callbacks.

## 3. Frontend focus-mode handoff

Knowledge-point click should reuse the existing frontend graph `focus mode` implementation from
`src/frontend/app.js`, but it should render inside a docked pane instead of taking over the
whole view.

Required behavior:

- resolve clicked knowledge point to graph node / atom,
- resolve the live graph node instance,
- open or refresh the graph-focus pane,
- call the existing focus-mode entry path,
- preserve browser and Tauri behavior consistently,
- avoid any bridge or Godot dependency for this click branch.

Relevant current code:

- `src/frontend/app.js`
- `src/frontend/path_app.js`

Pitfall:

- if the conversation layer resolves by label instead of stable ID, focus mode will target the
  wrong node or a stale graph object. The frontend needs one transaction-style helper for
  "resolve node -> load live node instance -> open/refresh graph-focus pane -> call `enterFocusMode`".

## 4. Godot learning-path visibility

The product requirement is "learning path also appears in the docked work area, can coexist with
graph focus mode, and can be promoted to fullscreen". That does not mean live Godot must be embedded
into the docked pane.

The safer plan is:

- product contract: docked learning-path pane plus fullscreen promotion,
- implementation freedom: the docked pane may initially be Tauri-hosted while fullscreen promotion
  opens the richer Godot workspace.

Relevant code:

- `path_mode/scripts/path_mode_ui.gd`
- `path_mode/scripts/tree_view_panel.gd`
- `path_mode/scripts/path_renderer.gd`
- `path_mode/scripts/learning_state_machine.gd`

Required addition:

- one host-owned learning-path pane contract in the frontend,
- one pane-layout contract that allows graph focus and learning path to coexist,
- one explicit fullscreen promotion path for the richer path workspace,
- one bridge-safe focus handoff into Godot for the promoted/fullscreen path experience.

Best practice:

- keep the frontend as pane-layout owner,
- keep Godot as fullscreen path-workspace owner,
- make promotion messages idempotent,
- do not let the product requirement force a fragile in-window Godot embed.

## 5. Data mapping rules

The plan only works if "knowledge point" means one stable, actionable local entity.

Use this rule set:

- backend returns stable atom/node identifiers,
- frontend maps identifiers to graph nodes,
- if mapping fails, downgrade the card to non-clickable text,
- node click enters frontend focus mode only when the mapping succeeds,
- learning-path CTA is shown only when the atom/node is locally actionable,
- both actions must target the same resolved node identity,
- opening one pane must not invalidate the other's resolved focus.

Do not rely on fuzzy label matching as the primary key.

## Implementation Sequence

## Phase A: Typed conversation capability

Add the minimal server contract for agent conversation:

- request:
  - `userId`
  - `message`
  - optional mode/context fields
- response:
  - `assistantMessage`
  - `knowledgePoints[]`
  - `actions[]`

This should wrap existing learning primitives before any UI work expands.

## Phase B: Frontend conversation panel

Add the user-facing chat surface and render knowledge-point cards.

Must include:

- loading/error/empty states,
- explicit clickable local knowledge points,
- side work area with parallel graph-focus pane, learning-path pane, and per-pane fullscreen action,
- click action bound to frontend `focus mode`,
- `Learning Path` action button per item or per current focus.

## Phase C: Frontend focus-mode integration helper

Introduce one frontend helper responsible for:

- resolving node identity,
- resolving the live graph node,
- opening or refreshing the graph-focus pane,
- invoking the existing frontend focus-mode path,
- handling failure states.

This helper becomes the only path used by:

- conversation click actions,
- future workbench focus actions,
- future recommended-path actions.

## Phase D: Parallel pane orchestration and fullscreen promotion

Add one host-level pane orchestration controller and explicit fullscreen promotion paths.

Recommended implementation posture:

- graph-focus pane: Tauri-hosted focus mode,
- learning-path pane: Tauri-hosted learning-path experience first,
- fullscreen: Godot workspace promotion,
- shared focus identity across both.

Avoid treating "docked pane" and "fullscreen Godot" as the same rendering surface in v1.

## Phase E: Verification and docs

Add tests for:

- contract shape,
- frontend action rendering,
- frontend focus-mode helper behavior,
- pane coexistence and split-layout state transitions,
- fullscreen promotion routing,
- learning-path handoff command routing.

Update:

- progress dashboard,
- roadmap,
- interface/runtime reference pages if endpoint or bridge contracts change.

## Risks and Pitfalls

## 1. Identity drift between atom IDs and graph node IDs

If the conversation layer emits atom IDs that are not directly mappable to displayed graph nodes,
the click flow becomes nondeterministic.

Mitigation:

- define one canonical mapping path and test it explicitly.

## 2. Duplicate orchestration paths

If `btn-path-mode`, workbench actions, and chat-result actions each evolve separate launch logic,
the product will diverge fast.

Mitigation:

- create one shared frontend orchestration helper.

## 3. Parallel-pane coordination bugs

If node click and `Learning Path` CTA share the same action path, product behavior will become
ambiguous and regress quickly.

Mitigation:

- separate the branches explicitly:
  - node click -> graph-focus pane
  - `Learning Path` click -> learning-path pane
  - fullscreen -> promoted path workspace
- keep pane layout independent from focus resolution.

## 4. Godot panel ownership confusion

If the frontend starts assuming it owns Godot panel state, future UI changes will become brittle.

Mitigation:

- frontend sends intent,
- Godot decides visual state,
- bridge messages stay narrow and idempotent.

## Best-Practice Decisions

- Keep the learning platform core authoritative.
- Use typed contracts for all conversation-result actions.
- Make local knowledge points explicitly actionable only when graph-mappable.
- Reuse the existing frontend `focus mode` path for node clicks.
- Reuse the current web UI shell and only borrow UX patterns from Cherry Studio / Chatbox.
- Make the conversation window own the side-work-area lifecycle.
- Allow graph focus and learning path to coexist instead of competing for one pane slot.
- Use Tauri + `PathBridge` for fullscreen learning-path promotion.
- Keep Godot responsible for the promoted path workspace, not the default side-pane shell.

## Current Program Priority

This delivery path should replace "generic conversation enhancement" as the immediate L4 priority.

Priority order:

1. frontend agent conversation entry,
2. local knowledge-point actionability,
3. parallel graph-focus pane,
4. parallel learning-path pane,
5. split-layout and coexistence contract,
6. fullscreen promotion contract,
6. only then deeper memory/personalization work.

## Related Pages

- [Development Progress Dashboard](./development-progress-dashboard.md)
- [Knowledge Mastery Evolution Roadmap](./knowledge-mastery-evolution-roadmap.md)
- [DeepTutor Reuse Assessment](./deeptutor-reuse-assessment.md)
- [MemOS Reuse Assessment](./memos-reuse-assessment.md)
