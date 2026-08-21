# Architecture Hardening and Forward-Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current architecture audit into a forward-compatible hardening slice that prevents silent data loss, closes a duplicated authentication boundary, and makes snapshot persistence safe under cache reuse and concurrent writes while preserving existing public APIs.

**Architecture:** Keep Markdown and existing runtime payloads as compatibility surfaces, but make resource identity, authorization, and snapshot persistence explicit boundaries. The portable core (ingest, exact graph projection, indexed query, evidence and export) must remain host-neutral; Node/Tauri/Godot/Capacitor are adapters, not alternate business-rule implementations. The first slice is deliberately additive and fail-fast at the edge; larger migrations (strict route registry, graph projection rewrite, domain extraction, Bridge v2) remain gated by contract tests and are documented as subsequent phases rather than mixed into this change.

**Tech Stack:** TypeScript 5.9, Node.js 20+ runtime, Jest 30 with ts-jest, file-backed JSON snapshots, existing modular route registry, bilingual Markdown documentation.

## Global Constraints

- Preserve `NoteNode.id`, legacy `RawFile.filename`, `assistantMessage`, and existing HTTP/IPC route paths.
- Validate identity and authorization once at process boundaries; internal graph code may rely on the established invariant.
- Do not introduce a new `XxxManager`/pass-through wrapper or rewrite `GraphBuilder`, `KnowledgeLearningPlatform`, or `PathBridge` in this slice.
- Use POSIX separators for persisted relative source paths so Windows/POSIX builds produce the same identity input.
- Keep snapshot replacement atomic; a failed write must not remove the last valid snapshot.
- Mobile builds must use the `mobile-slim` export profile: no Godot binary, no Node sidecar, no bundled LLM weights, PNG/WebP-only assets, and lazy optional capabilities.
- Mobile analysis must work on-device through the portable bounded exact-index path shipped in this slice; SQLite/WASM is a future persistence/acceleration host, not a current capability claim. Remote LLM/ANN calls are optional, explicit, cancellable, and never required for local ingest/query.
- Initial mobile budgets are release gates, not aspirations: app-owned compressed payload <= 25 MiB, low-memory profile peak RSS <= 256 MiB for a 5,000-document/50,000-atom corpus, and standard profile peak RSS <= 384 MiB for a 20,000-document/200,000-atom corpus on a 4-core ARM64 device.
- Do not ship model weights or desktop-only `mermaid.min.js`/Godot assets in the mobile profile; measure the signed APK/AAB and extracted asset set in CI.
- Every plan/progress/walkthrough document updated in this slice contains separated English and Chinese sections.

---

## English

### Current Audit Baseline

- `FileLoader` derives `RawFile.filename` from basename only, while `Graph.addNode()` silently ignores duplicate IDs. Two directories containing `index.md` can therefore merge or drop content without an error.
- `src/middleware/auth.ts` returns `true` when a sidecar token is configured but the request has no Bearer header. `src/server.ts` has a second token implementation, so tests of one boundary do not prove the production path.
- `FileBackedKnowledgeGraphStore` writes every concurrent save through the same `<file>.tmp` name and does not refresh `cachedSnapshot` after a successful save. A later query can return stale data and concurrent writers can delete each other's temporary file.
- The reference repositories provide useful patterns but are not drop-in architectures: LearnGraph's typed FastAPI/Pydantic boundary is a contract model, while textbooks' content package convention is a source-authoring model. Neither justifies replacing this project's local/Tauri/Godot runtime or introducing an external graph database before invariants are closed.

### Task 1: Canonical Resource Boundary and Collision Guard

**Files:**
- Create: `src/backend/ResourceIdentity.ts`
- Modify: `src/backend/FileLoader.ts`
- Modify: `src/backend/GraphBuilder.ts`
- Test: `src/backend/ResourceIdentity.test.ts`
- Test: `src/backend/FileLoader.test.ts`

**Interfaces:**
- `RawFile.relativePath?: string` is additive and uses `/` separators.
- `normalizeResourceRelativePath(rootPath: string, filePath: string): string` returns a normalized relative path and rejects paths outside `rootPath`.
- `assertUniqueLegacyResourceIds(files: ReadonlyArray<Pick<RawFile, 'filepath' | 'filename'>>): void` throws an error containing every colliding path.

- [x] **Step 1: Write failing identity tests.** Cover nested duplicate basenames, path separator normalization, and a path escaping the root.
- [x] **Step 2: Run the focused tests and confirm failure.**

```powershell
rtk proxy npm.cmd test -- --runInBand src/backend/ResourceIdentity.test.ts src/backend/FileLoader.test.ts
```

Expected: FAIL because the identity module, `relativePath`, and collision guard do not yet exist.

- [x] **Step 3: Implement the edge invariant.** Add `relativePath` to `RawFile`; compute it once in `FileLoader`; call `assertUniqueLegacyResourceIds(files)` before node initialization in `GraphBuilder`. Keep the legacy basename ID and layout lookup unchanged so existing saved layouts and links remain readable during migration.
- [x] **Step 4: Run the focused tests and existing graph tests.**

```powershell
rtk proxy npm.cmd test -- --runInBand src/backend/ResourceIdentity.test.ts src/backend/FileLoader.test.ts src/core/Graph.test.ts src/core/PathEngine.test.ts
```

Expected: all selected suites pass; a duplicate basename is rejected before any graph node is added.

- [x] **Step 5: Commit the identity boundary.**

```powershell
rtk git add src/backend/ResourceIdentity.ts src/backend/ResourceIdentity.test.ts src/backend/FileLoader.ts src/backend/FileLoader.test.ts src/backend/GraphBuilder.ts
rtk git commit -m "fix(graph): reject ambiguous legacy resource identities"
```

### Task 2: One Authorization Decision for Sidecar and HTTP Entry Points

**Files:**
- Modify: `src/middleware/auth.ts`
- Modify: `src/middleware/index.ts`
- Modify: `src/server.ts`
- Test: `src/middleware/auth.test.ts`

**Interfaces:**
- `isRequestTokenAuthorized(req, expectedToken): boolean` accepts the existing `Authorization: Bearer ...` and `X-NoteConnection-Token` forms; an expected token requires one valid non-empty credential.
- `isAuthorizedRequest(req)` remains the existing sidecar middleware API and delegates to the shared decision.

- [x] **Step 1: Write failing authorization tests.** Cover no configured token, valid Bearer, invalid Bearer, missing Bearer, malformed Bearer, and the legacy `X-NoteConnection-Token` header.
- [x] **Step 2: Run the focused auth test and confirm the missing-credential case fails under the current implementation.**

```powershell
rtk proxy npm.cmd test -- --runInBand src/middleware/auth.test.ts
```

- [x] **Step 3: Implement the shared token decision.** Normalize header casing, reject missing/malformed credentials when a token is configured, preserve the legacy header for compatibility, and make `src/server.ts` delegate its protected-request check to the shared function rather than maintaining a second comparison.
- [x] **Step 4: Run auth and server contract tests.**

```powershell
rtk proxy npm.cmd test -- --runInBand src/middleware/auth.test.ts src/server.migration.test.ts src/routes/registry.contract.test.ts
```

- [x] **Step 5: Commit the authentication boundary.**

```powershell
rtk git add src/middleware/auth.ts src/middleware/index.ts src/middleware/auth.test.ts src/server.ts
rtk git commit -m "fix(auth): reject missing credentials when sidecar token is set"
```

### Task 3: Atomic Snapshot Save and Cache Coherence

**Files:**
- Modify: `src/learning/store.ts`
- Modify: `src/learning/store.test.ts`

**Interfaces:**
- `FileBackedKnowledgeGraphStore.saveSnapshot()` continues to return `Promise<void>` and retains the existing JSON schema.
- Temporary files use a unique sibling path; a successful save updates `cachedSnapshot` to the exact snapshot that was persisted.

- [x] **Step 1: Write failing persistence tests.** Add one test that loads snapshot A, saves snapshot B, then queries B through the same store instance; add one test that performs two saves concurrently and asserts the final file parses as either complete snapshot A or complete snapshot B and no `.tmp` file remains.
- [x] **Step 2: Run the focused tests and confirm failure.**

```powershell
rtk proxy npm.cmd test -- --runInBand src/learning/store.test.ts
```

- [x] **Step 3: Implement unique temporary paths and cache refresh.** Generate a per-save sibling path using process ID, timestamp, and cryptographic/random entropy available in the runtime; rename it atomically; set `cachedSnapshot = snapshot` only after rename succeeds; retain cleanup in `finally`.
- [x] **Step 4: Run store and persistence regression tests.**

```powershell
rtk proxy npm.cmd test -- --runInBand src/learning/store.test.ts src/learning/KnowledgeLearningPlatform.persistence.test.ts
```

- [x] **Step 5: Commit the persistence hardening.**

```powershell
rtk git add src/learning/store.ts src/learning/store.test.ts
rtk git commit -m "fix(storage): keep file snapshots atomic and cache-coherent"
```

### Task 4: Portable Mobile Analysis Profile and Packaging Gates

**Files:**
- Modify: `src/platform/ExportProfile.ts`
- Modify: `src/platform/PlatformCapabilities.ts`
- Modify: `src/platform/RenderMaterializer.ts`
- Create: `src/frontend/mobile_exact_analyzer.js`
- Modify: `src/frontend/storage_provider.js`
- Modify: `src/frontend/index.html`
- Modify: `src/frontend/path.html`
- Modify: `src-tauri/tauri.android.conf.json`
- Modify: `src-tauri/src/lib.rs`
- Modify: `capacitor.config.ts`
- Modify: `build_apk.bat`
- Modify: `scripts/run-tauri-android.js`
- Modify: `scripts/apply-tauri-android-pathmode.js`
- Create: `src/mobile.profile.contract.test.ts`
- Create: `scripts/prepare-mobile-slim.js`
- Create: `scripts/verify-mobile-slim-budget.js`
- Modify: `package.json`
- Modify: `docs/diataxis/en/reference/multi-platform-build-flows.md`
- Modify: `docs/diataxis/zh/reference/multi-platform-build-flows.md`

**Interfaces:**
- `mobile-slim` remains sidecar-free and exposes `supportsLocalExactQuery`, `supportsRemoteInference`, `maxResidentBytes`, and `assetBudgetBytes` through the platform capability contract.
- A mobile workspace bundle contains source metadata, a compact exact graph/index projection, and PNG/WebP assets; it does not contain the desktop server, Godot, full graph text, or model weights. SQLite remains a deferred persistence backend, not a capability claim for this slice.
- `verify-mobile-slim-budget.js` measures the staged mobile asset directory and fails with a file-level report when the compressed payload or runtime memory evidence exceeds the profile budget.

- [x] **Step 1: Write failing capability and packaging tests.** Assert that mobile local ingest/query is available without a sidecar, remote inference is optional, SVG is rejected, desktop/Godot binaries are excluded, and the budget verifier rejects an intentionally oversized fixture.
- [x] **Step 2: Run the focused mobile contract test and confirm failure.**

```powershell
rtk proxy npm.cmd test -- --runInBand src/mobile.profile.contract.test.ts
```

- [x] **Step 3: Implement the profile contract.** Add explicit mobile capability fields and keep graph rules in a bounded portable exact-index core; route mobile ingestion/query through the existing Tauri Rust / Capacitor local graph builders plus the browser-compatible analyzer. Keep remote calls optional, timeout-bounded, cancellable, and explainably offline-degradable. Do not claim SQLite until its mobile runtime is shipped.
- [x] **Step 4: Implement the budget verifier and a deterministic mobile build command.** The command stages only the mobile profile, strips desktop/Godot/LLM assets and desktop-only Mermaid/GPU payloads, emits a deterministic JSON manifest with byte totals and capability flags, and runs before both Capacitor and Tauri Android packaging.
- [x] **Step 5: Run mobile contracts and the existing cross-platform gates.**

```powershell
rtk proxy npm.cmd test -- --runInBand src/mobile.profile.contract.test.ts src/platform/PlatformCapabilities.test.ts src/platform/RenderMaterializer.test.ts src/mobile.pipeline.test.ts src/capacitor.runtime.contract.test.ts src/android.pathmode.contract.test.ts
rtk proxy npm.cmd run verify:mobile:slim:budget
```

- [x] **Step 6: Commit the portable mobile profile.**

```powershell
rtk git add src/platform/ExportProfile.ts src/platform/PlatformCapabilities.ts src/platform/RenderMaterializer.ts src/frontend/mobile_exact_analyzer.js src/frontend/storage_provider.js src/frontend/index.html src/frontend/path.html src-tauri/tauri.android.conf.json src-tauri/src/lib.rs capacitor.config.ts build_apk.bat scripts/run-tauri-android.js scripts/apply-tauri-android-pathmode.js src/mobile.profile.contract.test.ts scripts/prepare-mobile-slim.js scripts/verify-mobile-slim-budget.js package.json docs/diataxis/en/reference/multi-platform-build-flows.md docs/diataxis/zh/reference/multi-platform-build-flows.md
rtk git commit -m "feat(mobile): formalize slim local-analysis packaging profile"
```

### Task 5: Reconcile Progress Documents and Reference Comparison

**Files:**
- Create: `docs/solutions/architecture-hardening-forward-compatibility-2026-08-16.md`
- Modify: `task.md`
- Modify: `implementation_plan.md`
- Modify: `walkthrough.md`
- Modify: `docs/diataxis/en/explanation/development-progress-dashboard.md`
- Modify: `docs/diataxis/zh/explanation/development-progress-dashboard.md`

**Interfaces:**
- The new solution note is the dated source of truth for this slice.
- Root tracker files retain their historical entries and receive one new separated bilingual addendum.
- English/Chinese Diataxis dashboards receive matching progress facts, not translated guesses.

- [x] **Step 1: Record code-vs-plan status.** Mark identity collision, auth boundary, and snapshot atomicity as implemented only after their tests pass. Keep strict registry defaulting, graph identity migration, graph index/CSR conversion, Bridge v2, and domain extraction explicitly pending.
- [x] **Step 2: Record reference trade-offs.** State which LearnGraph patterns are adopted (typed boundary, workspace scoping, explicit validation) and which are rejected for now (Docker-only execution, SaaS RBAC/PostgreSQL RLS). State which textbooks patterns are adopted (content package manifest and compiler direction) and why Mathigon's runtime DSL is not copied.
- [x] **Step 3: Add bilingual next-phase gates.** Define the next order: canonical `sourceUri` migration behind dual-read, schema validation at HTTP edges, strict registry shadow metrics then default, graph explicit/inferred projection split, and Bridge protocol negotiation.
- [x] **Step 4: Run documentation checks.**

```powershell
rtk proxy npm.cmd run docs:diataxis:check
```

- [x] **Step 5: Commit the progress reconciliation.** The mobile slice and the bilingual tracker reconciliation are promoted together so no document claims a capability before the corresponding code and tests exist.

```powershell
rtk git add docs/solutions/architecture-hardening-forward-compatibility-2026-08-16.md task.md implementation_plan.md walkthrough.md docs/diataxis/en/explanation/development-progress-dashboard.md docs/diataxis/zh/explanation/development-progress-dashboard.md
rtk git commit -m "docs(architecture): record forward-compatible hardening progress"
```

### Task 6: Full Verification and Mainline Promotion

**Files:** No additional source files; verify the complete diff and generated outputs.

- [x] **Step 1: Run targeted regression tests.**
- [x] **Step 2: Run the full Jest suite.**

```powershell
rtk proxy npm.cmd test -- --runInBand
```

- [x] **Step 3: Run the TypeScript/build and documentation gates.**

```powershell
rtk proxy npm.cmd run build
rtk proxy npm.cmd run docs:diataxis:check
```

- [x] **Step 4: Inspect the diff, status, and generated-file policy.** Do not stage runtime caches, logs, or build products unless already tracked and required by the repository.
- [x] **Step 5: Push the verified commits to `origin/main` without force.** Confirm the remote tip after push and re-run `git status --short --branch`.

### Acceptance Criteria

1. Duplicate legacy basenames fail before graph construction and every `RawFile` loaded from disk carries a normalized relative path.
2. Configured authentication rejects missing, malformed, and invalid credentials while preserving both existing credential header forms.
3. Concurrent file saves leave one parseable complete snapshot, and same-process reads see the newly saved snapshot immediately.
4. Mobile `mobile-slim` builds remain sidecar/Godot/model-weight free, provide local exact analysis, and pass the byte/RSS release gates on the low-memory profile.
5. Existing graph, learning persistence, route, build, and documentation checks pass.
6. The architecture note distinguishes shipped behavior from pending migrations and records rollback points.
7. `origin/main` contains the verified commits and the local worktree is clean.

### Migration and Rollback

- Identity migration is dual-read: existing basename IDs and saved layouts remain valid; only ambiguous inputs fail instead of silently corrupting the graph. Rollback is a code revert, with no schema rewrite.
- Authentication rollback restores the previous comparison but is not recommended because it reopens an authorization bypass; the legacy header remains available to avoid client breakage.
- Snapshot rollback is file-level: the previous target file remains intact if a write or rename fails. Unique temporary files are cleaned opportunistically and are never read as snapshots.
- The next `sourceUri` migration must introduce stable IDs and aliases before changing `NoteNode.id`; it must include case-folding/Unicode tests on Windows and POSIX.

### Explicit Non-Goals

- No default strict-registry flip until all legacy URL contracts have modular equivalents.
- No wholesale rewrite of `src/server.ts` or `KnowledgeLearningPlatform.ts` in one change.
- No Neo4j/PostgreSQL/Docker runtime dependency for the local/Tauri/mobile product.
- No unbounded Worker/GPU expansion before replacing the current O(N^2) inferred-edge strategy with indexed exact/inferred projections.
- No mobile-local LLM weight packaging; use deterministic local retrieval plus explicit remote inference when available.

---

## 中文

### 当前审计基线

- `FileLoader` 仅用 basename 派生 `RawFile.filename`，`Graph.addNode()` 对重复 ID 静默忽略；不同目录中的 `index.md` 会发生无告警合并或丢失。
- `src/middleware/auth.ts` 在配置 sidecar token 后，如果请求没有 Bearer 头仍返回 `true`。`src/server.ts` 另有一套 token 实现，导致单测一个入口不能证明生产入口。
- `FileBackedKnowledgeGraphStore` 的并发保存共用 `<file>.tmp`，且成功保存后不刷新 `cachedSnapshot`；后续查询可能读到旧值，并发写入可能互删临时文件。
- 参考仓库只能提供模式而不是整套替换架构：LearnGraph 的 FastAPI/Pydantic 可借鉴为类型化边界，textbooks 的 content package 可借鉴为内容工程边界；二者都不足以证明本项目应替换本地/Tauri/Godot 运行时或提前引入外部图数据库。

### 多端与移动端硬约束

- `mobile-slim` 必须是不带 Godot、Node sidecar、模型权重的 slim profile，只保留 PNG/WebP、紧凑 exact 索引投影与 portable core 路径；SQLite/WASM 作为后续持久化/加速 host，不能在本切片中冒充已交付。
- 移动端必须能在本机完成 ingest、exact graph projection、indexed query、evidence/export；远程 LLM/ANN 只是可取消、可超时、需用户授权的增强，不得成为本地知识库分析的启动依赖。
- 初始 release gate：应用自有压缩 payload 不超过 25 MiB；4 核 ARM64、低内存 profile 在 5,000 文档 / 50,000 atom 下峰值 RSS 不超过 256 MiB；standard profile 在 20,000 文档 / 200,000 atom 下不超过 384 MiB。
- CI 必须测量签名 APK/AAB 与解包资源，按文件列出超预算原因；不得把桌面 `server`、Godot 或完整 `mermaid.min.js` 偷渡进 mobile bundle。

### 任务 1：规范资源边界与冲突保护

**文件：** 创建 `src/backend/ResourceIdentity.ts`、`src/backend/ResourceIdentity.test.ts`、`src/backend/FileLoader.test.ts`；修改 `src/backend/FileLoader.ts`、`src/backend/GraphBuilder.ts`。

- [x] 先写失败测试：嵌套目录 basename 冲突、路径分隔符归一化、越界路径拒绝。
- [x] 运行 `rtk proxy npm.cmd test -- --runInBand src/backend/ResourceIdentity.test.ts src/backend/FileLoader.test.ts`，确认当前实现失败。
- [x] 在边界一次性计算 `relativePath`，统一使用 `/`；在 GraphBuilder 初始化前调用 `assertUniqueLegacyResourceIds()`，保留旧 basename ID、布局查找和链接兼容性。
- [x] 运行资源身份、FileLoader、Graph、PathEngine 回归测试。

### 任务 2：统一 Sidecar 与 HTTP 认证判定

**文件：** 修改 `src/middleware/auth.ts`、`src/middleware/index.ts`、`src/server.ts`；创建 `src/middleware/auth.test.ts`。

- [x] 覆盖无 token、合法/非法 Bearer、缺失/畸形 Bearer、旧 `X-NoteConnection-Token` 头。
- [x] 配置 token 时缺少凭证的用例必须先在当前实现下失败，再由共享判定函数修复。
- [x] 保留两个既有凭证头格式，拒绝空凭证，并让 server 复用共享判定，消除双实现漂移。
- [x] 运行 auth、server migration、route registry contract 测试。

### 任务 3：原子快照保存与缓存一致性

**文件：** 修改 `src/learning/store.ts`、`src/learning/store.test.ts`。

- [x] 增加“加载 A、保存 B、同一实例查询 B”和“并发保存两个完整快照”的失败测试。
- [x] 临时文件改为每次保存唯一的同目录文件；rename 成功后才把 `cachedSnapshot` 更新为已持久化对象；保留 finally 清理。
- [x] 运行 store 与 `KnowledgeLearningPlatform.persistence` 回归测试。

### 任务 4：portable mobile profile 与打包门禁

**文件：** 修改 `src/platform/ExportProfile.ts`、`src/platform/PlatformCapabilities.ts`、`src/platform/RenderMaterializer.ts`、`src/frontend/storage_provider.js`、`src/frontend/index.html`、`src/frontend/path.html`、`src-tauri/tauri.android.conf.json`、`src-tauri/src/lib.rs`、`capacitor.config.ts`、`build_apk.bat`、`scripts/run-tauri-android.js`、`scripts/apply-tauri-android-pathmode.js`、`package.json`；创建 `src/frontend/mobile_exact_analyzer.js`、`src/mobile.profile.contract.test.ts`、`scripts/prepare-mobile-slim.js`、`scripts/verify-mobile-slim-budget.js`；更新中英文多端构建参考文档。

- [x] 先写失败契约：mobile 无 sidecar 仍能本地 ingest/query，remote inference 可选，SVG/桌面/Godot/模型权重被排除，超大 fixture 会被预算验证器拒绝。
- [x] 运行 `rtk proxy npm.cmd test -- --runInBand src/mobile.profile.contract.test.ts` 确认失败。
- [x] 在 platform capability 中显式暴露 `supportsLocalExactQuery`、`supportsRemoteInference`、`maxResidentBytes`、`assetBudgetBytes`；移动 ingestion/query 走 Tauri Rust/Capacitor 本地建图 + 有界 browser exact-index projection；SQLite/WASM 不在本切片中冒充已交付；远程调用必须有 timeout、cancel 与 offline fallback。
- [x] 新增 deterministic mobile staging/budget 命令，同时供 Capacitor 与 Tauri Android 调用，输出字节与 capability manifest。
- [x] 运行 mobile contract、Platform/Render、现有 Capacitor/Android gate 与 `rtk proxy npm.cmd run verify:mobile:slim:budget`。

### 任务 5：进度文档与参考对比对账

**文件：** 创建 `docs/solutions/architecture-hardening-forward-compatibility-2026-08-16.md`；更新 `task.md`、`implementation_plan.md`、`walkthrough.md` 及中英文 Diataxis dashboard。

- [x] 只有测试通过后才把身份冲突、认证边界、快照原子性标记为已实现；strict registry 默认切换、稳定 `sourceUri` 迁移、CSR/索引图、Bridge v2、领域拆分继续标为待推进。
- [x] 明确采用 LearnGraph 的类型化边界/工作区隔离思想，暂不采用 Docker-only、SaaS RBAC、PostgreSQL RLS；采用 textbooks 的内容包/编译器方向，不复制依赖 Mathigon Studio 的 DSL。
- [x] 给出后续顺序：双读 `sourceUri` 迁移、HTTP schema、strict registry shadow→default、exact/inferred graph projection、Bridge capability negotiation。
- [x] 运行 `rtk proxy npm.cmd run docs:diataxis:check`。

### 任务 6：完整验证并推进 main

- [x] 运行定向回归、完整 `rtk proxy npm.cmd test -- --runInBand`、`rtk proxy npm.cmd run build`、`rtk proxy npm.cmd run docs:diataxis:check`。
- [x] 检查 diff、生成物和状态，仅提交源码/测试/文档，不带入日志、缓存和临时构建产物。
- [x] 非强制推送到 `origin/main`，确认远程 tip，并再次检查工作区 clean。

### 验收标准

1. 重复 basename 在建图前失败，磁盘加载的每个 `RawFile` 都携带 `/` 归一化相对路径。
2. 配置 token 时缺失、畸形、错误凭证均拒绝，同时兼容已有两种凭证头。
3. 并发保存留下一个可解析的完整快照，同一进程保存后立即读到新快照。
4. `mobile-slim` 不带 sidecar/Godot/模型权重，具备本地 exact 分析能力，并通过低内存字节/RSS 门禁。
5. 现有 Graph、learning persistence、route、build、文档检查通过。
6. 架构说明严格区分已交付行为、待迁移事项和回滚点。
7. `origin/main` 含已验证提交，本地工作区 clean。

### 迁移、回滚与明确不做

- 资源身份采用双读过渡：旧 basename ID 与布局继续可读，歧义输入改为失败而非静默损坏；回滚无需改数据格式。
- 认证回滚会重新打开越权风险，不建议；保留旧 header 以避免客户端破坏性变更。
- 快照写入失败时旧目标文件仍保持有效；唯一临时文件不会作为快照读取。
- 后续改变 `NoteNode.id` 前必须先引入稳定 `sourceUri`、alias、Windows 大小写与 Unicode 测试。
- 本轮不默认切 strict registry、不整体重写超大宿主文件、不引入 Neo4j/PostgreSQL/Docker 依赖，也不以更多 Worker/GPU 掩盖当前 O(N^2) 推断算法。
- 不把本地 LLM 权重塞进移动包；移动端默认是 deterministic local retrieval，联网时才显式调用远端推理。
