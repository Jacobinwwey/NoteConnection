---
title: Mobile Cross-Host Forward Compatibility Phase 13
updated: 2026-08-18
status: active
---

# Mobile Cross-Host Forward Compatibility Phase 13

## English

### Decision

Keep the mobile runtime body-free and adapter-led. Web, Tauri, Capacitor, and Android must consume the same versioned projection and query semantics, while each host owns only storage, lifecycle, and cancellation primitives. Do not promote SQLite/WASM, Godot, a sidecar, or an embedded model to the default mobile profile until measured evidence proves that the bounded exact workload needs it.

### Current architectural truth

The Phase 12 projection replay is a contract test, not native parity evidence. The current code still has material host drift:

| Surface | Current behavior | Required direction |
|---|---|---|
| Node identity | Tauri uses workspace-relative paths; Capacitor can fall back to basenames; TypeScript uses NFC and SHA-256 | One namespaced manifest with NFC, canonical relative path, SHA-256 revision, and additive aliases |
| Revision | Tauri/Capacitor have FNV-1a fallbacks; the canonical backend uses SHA-256 | FNV remains legacy read-only compatibility; new evidence must use SHA-256 |
| Edge direction | Capacitor and Rust currently disagree for wiki-link orientation | Define `source -> target` once and carry provenance (`explicit`, `inferred`, `runtime`) |
| Import transaction | SAF staging/rename has in-call rollback only | Persist a small journal and recover on the next process start |
| Memory | Android admission is bounded and the draft clears `content`, but the single-document read and native RSS are not measured | Preserve body-free drafts, measure transient allocation/RSS, and never raise budgets without device evidence |

### Phase 13 implementation

1. **Native import recovery (implemented).** `KnowledgeBasePickerBridge` now writes `knowledge_base_import_journal.v1.json` atomically. The journal records `staging`, `target-backed-up`, and `target-activated` phases using app-local names only. `MainActivity` recovery scans the journal and orphan transaction directories before exposing the picker. Recovery preserves the previous tree when activation was interrupted, removes abandoned staging data, and emits the existing result-marker shape. Corrupt or unsafe journals fail closed.
2. **Atomic result markers (implemented).** Picker results and journal writes use a sibling temporary file, `fsync`, and rename. The public Rust request/poll API and result JSON fields are unchanged; this is an additive durability improvement.
3. **Device evidence harness (next).** Add CI-secret-only signing, install a fresh arm64 artifact, execute SAF import -> graph build -> exact query -> neighbors/path, force-stop, reopen, and replay the same projection. Capture artifact SHA-256, sanitized device identity, workload bounds, import status, and peak `VmRSS` in one JSON record. A missing device or missing RSS must fail the release job, not downgrade to pass.
4. **Portable identity corpus (next).** Replay old snapshots, move/rename journals, same-content documents, NFC collisions, cross-root loads, and delete/restore operations through each host adapter. Keep `NoteNode.id` and old layouts as compatibility keys until the corpus proves alias continuity.
5. **Android memory closure (next).** Keep the existing 5,000-document, 16 MiB/document, 64 MiB input, 250,000-edge, and depth-64 admission contract, prove that Android drafts remain body-free, and measure the transient single-document read plus native RSS. The bound is an admission guard, not a substitute for device RSS.

### Gates and trade-offs

- **G2 mobile release:** static slim staging is currently 120 files / 4,253,837 uncompressed bytes / 1,546,201 estimated compressed bytes. The latest unsigned APK/AAB compressed payloads are 9,436,196 and 6,983,880 bytes. This is below the 25 MiB budget, but signature, SAF workload, process-death replay, and RSS `<= 256 MiB` remain open.
- **G3 persistence:** fixture replay and the journal implementation are code evidence. They do not prove a real Android process death, filesystem corruption, or storage-permission failure. Native evidence is required before claiming durable mobile persistence.
- **G4 identity:** public IDs remain frozen. A path-derived URI is not a rename-proof identity; a move journal or persisted alias record is required before canonical-ID migration.
- **SQLite/WASM:** keep it opt-in. It may reduce query startup cost for larger corpora, but it adds binary size, initialization work, heap pressure, and a migration surface. Promote only after a measured comparison against the body-free JSON projection.

### Acceptance order

1. Produce a signed arm64 artifact and a real device/emulator workload record with peak RSS.
2. Add the Tauri/Capacitor/Android native adapter matrix and process-death replay evidence.
3. Close identity corpus and edge-orientation parity; do not change public IDs before this step.
4. Only then evaluate a persistent database adapter or a larger mobile corpus budget.

### Verification baseline

The implementation increment was checked with the Android picker contract suite, mobile artifact/profile contract suites, TypeScript no-emit, the 57-suite migration matrix (307 passed, 13 skipped), and `app:compileArm64ReleaseKotlin`. The environment has no online Android device, no configured AVD, and no signing keystore, so G2 remains explicitly incomplete.

## 中文

### 决策

移动端继续采用无正文 projection 与 adapter 主导的架构。Web、Tauri、Capacitor、Android 必须消费同一份版本化 projection 与 query 语义；host 只负责存储、生命周期和取消原语。除非实测证明有界 exact workload 确实需要，否则不把 SQLite/WASM、Godot、sidecar 或内置模型提升为默认移动配置。

### 当前架构事实

Phase 12 的 projection replay 是契约测试，不是原生端对等证明。现有代码仍存在实质 host 漂移：

| 面 | 当前行为 | 目标方向 |
|---|---|---|
| 节点身份 | Tauri 使用 workspace-relative path；Capacitor 可能回退 basename；TypeScript 使用 NFC 与 SHA-256 | 统一带 namespace 的 manifest，使用 NFC、canonical relative path、SHA-256 revision 与 additive alias |
| revision | Tauri/Capacitor 有 FNV-1a 回退；canonical backend 使用 SHA-256 | FNV 仅保留旧数据只读兼容；新证据统一 SHA-256 |
| 边方向 | Capacitor 与 Rust 当前对 wiki-link 方向不一致 | 统一为 `source -> target`，并携带 `explicit`、`inferred`、`runtime` provenance |
| 导入事务 | SAF staging/rename 只有调用栈内回滚 | 持久化轻量 journal，在下次进程启动时恢复 |
| 内存 | Rust 有文件预算校验，但中间暂存仍可能保留正文 | Android 读取时提取 link candidate，只保留有界 draft/projection 字段 |

### Phase 13 实施

1. **原生导入恢复（已实现）。** `KnowledgeBasePickerBridge` 现在以原子方式写入 `knowledge_base_import_journal.v1.json`。journal 仅保存 app-local 名称，并记录 `staging`、`target-backed-up`、`target-activated` 阶段。`MainActivity` 在暴露 picker 前扫描 journal 与孤儿事务目录；如果激活被中断则恢复旧目录，清理 abandoned staging，并继续输出原有 result marker 结构。损坏或不安全 journal 直接 fail closed。
2. **结果 marker 原子化（已实现）。** picker 结果与 journal 都使用同目录临时文件、`fsync` 和 rename；Rust request/poll API 与结果 JSON 字段不变，只增加耐久性。
3. **真机证据 harness（下一步）。** 只从 CI secret 注入签名配置；安装新鲜 arm64 产物，执行 SAF import -> graph build -> exact query -> neighbors/path，force-stop 后重开并重放同一 projection。统一记录 artifact SHA-256、脱敏设备标识、工作负载边界、导入状态与 peak `VmRSS`。没有设备或没有 RSS 必须让 release job 失败，不能降级成 pass。
4. **可移植身份语料（下一步）。** 让旧 snapshot、move/rename journal、同内容文档、NFC collision、跨 root 加载、删除/恢复操作经过各 host adapter replay。公共 `NoteNode.id` 与旧 layout 在 alias continuity 证据完成前继续作为兼容 key。
5. **Android 内存闭环（下一步）。** 保持现有 5,000 文档、单文档 16 MiB、总输入 64 MiB、250,000 边、depth-64 admission contract，证明 Android draft 持续无正文，并测量单文档瞬时读取与 native RSS。预算只是 admission guard，不能替代真机 RSS。

### 门禁与权衡

- **G2 移动发布：** 当前 slim staging 为 120 个文件 / 未压缩 4,253,837 字节 / 估算压缩 1,546,201 字节。最新未签名 APK/AAB 压缩 payload 为 9,436,196 与 6,983,880 字节，低于 25 MiB；但签名、SAF workload、进程死亡 replay 与 RSS `<= 256 MiB` 仍未完成。
- **G3 持久化：** fixture replay 与 journal 实现是代码证据，不能证明真实 Android 进程死亡、文件损坏或存储权限失败。关闭 durable mobile persistence 前必须有原生证据。
- **G4 身份：** 公共 ID 继续冻结。路径派生 URI 不能证明 rename 后身份不变；切换 canonical ID 前必须有 move journal 或持久化 alias 记录。
- **SQLite/WASM：** 继续 opt-in。它可能降低大语料 query 启动成本，但会增加包体、初始化、heap 与迁移面；只有与无正文 JSON projection 的实测对比完成后才允许提升。

### 验收顺序

1. 生成签名 arm64 产物，并在真实设备/可复现 emulator 上取得包含 peak RSS 的 workload 记录。
2. 增加 Tauri/Capacitor/Android 原生 adapter matrix 与进程死亡 replay 证据。
3. 关闭 identity corpus 与边方向 parity；在此之前不得改变公共 ID。
4. 之后再评估数据库 adapter 或扩大移动语料预算。

### 本轮验证基线

本轮已通过 Android picker contract、mobile artifact/profile contract、TypeScript no-emit、57 suite migration matrix（307 passed、13 skipped）与 `app:compileArm64ReleaseKotlin`。当前环境没有在线 Android 设备、没有已配置 AVD、也没有签名 keystore，因此 G2 仍明确未完成。

## 2026-08-18 Phase 18 Recovery Evidence Update

### English

The Kotlin import journal now has a deterministic host-side recovery oracle in `scripts/verify-mobile-native-recovery.js`, with a single contract test and six scenarios. It preserves the forward-compatible boundary: the verifier is test-only, emits `host-recovery-state-machine` evidence with `nativeDeviceEvidence: false`, and is excluded from `mobile-slim`. Production recovery remains owned by Kotlin and the Rust request/poll/result-marker contracts are unchanged.

This is useful evidence for phase precedence and fail-closed path/schema handling, but it does not satisfy native process-death, SAF UI, storage/permission failure, signing, or RSS gates. The next implementation order remains signed arm64 device replay, native adapter continuity, and only then public-ID or SQLite/WASM decisions.

### 中文

Kotlin import journal 现在已有 `scripts/verify-mobile-native-recovery.js` 提供确定性的 host recovery oracle，并由一个契约测试覆盖六个场景。它保持向前兼容边界：verifier 只用于测试，输出 `host-recovery-state-machine` 且 `nativeDeviceEvidence: false`，并排除出 `mobile-slim`。生产恢复仍由 Kotlin 拥有，Rust request/poll/result-marker 契约不变。

这能证明 phase 优先级以及路径/schema 的 fail-closed 处理，但不能关闭原生进程死亡、SAF UI、存储/权限失败、签名或 RSS 门禁。后续顺序仍是签名 arm64 真机 replay、原生 adapter continuity，之后才评估 public-ID 或 SQLite/WASM。

## 2026-08-18 Phase 19 Native Import Failure-Path Retention

### English

The Android import outer failure boundary previously deleted `stagingRoot`, `backupRoot`, and the journal together. That is unsafe when `replaceImportedTree()` has moved the previous corpus to backup but cannot complete activation or rollback: the backup is then the only recoverable corpus. The boundary now always removes staging, clears the journal only when no backup exists, and retains backup plus journal for the next `bindActivity()` recovery pass. The existing failed result marker remains unchanged.

This is intentionally additive and low-cost: Kotlin remains the production owner; Rust request/poll/result-marker contracts, schema-1 journal fields, legacy IDs, and the mobile-slim export profile do not change. The focused contract assertion is scoped to the exact failure catch because successful replacement and recovery branches are allowed to delete backup after the active target is known. Retention trades a bounded amount of app-local disk for data recoverability and avoids hiding a destructive path behind a generic catch.

The focused picker contract and TypeScript no-emit pass. The change does not close native evidence: signed arm64 rollback/recovery, SAF/storage-permission failure, force-stop/reopen continuity, and RSS `<= 256 MiB` remain G2/G3 gates. Public-ID migration, default SQLite/WASM, and mobile budget increases remain frozen.

### 中文

Android import 外层失败边界此前会同时删除 `stagingRoot`、`backupRoot` 与 journal。当 `replaceImportedTree()` 已将旧知识库移入 backup、但激活或回滚未完成时，backup 就是唯一可恢复语料；这种无条件清理会造成数据丢失。现在该边界始终删除 staging，仅在不存在 backup 时清理 journal；backup 仍存在时保留 backup 与 journal，等待下一次 `bindActivity()` recovery。既有 failed result marker 保持不变。

这是 additive 且低成本的修正：生产 owner 仍是 Kotlin；Rust request/poll/result-marker 契约、schema-1 journal 字段、legacy ID 与 mobile-slim export profile 均不变。契约断言只扫描准确的失败 catch，因为成功替换与 recovery 在确认 active target 后允许删除 backup。保留策略以有界 app-local 磁盘占用换取数据可恢复性，避免通用 catch 隐藏破坏性路径。

picker 定向契约与 TypeScript no-emit 已通过。本轮不关闭原生证据：签名 arm64 rollback/recovery、SAF/存储权限失败、force-stop/reopen continuity 与 RSS `<= 256 MiB` 仍是 G2/G3 门禁；public-ID 迁移、默认 SQLite/WASM 与移动端预算上调继续冻结。

## 2026-08-18 Phase 20 Recovery Retry and Fresh Arm64 Artifact Evidence

### English

The previous Phase 19 fix still had one destructive startup branch: a retained backup was deleted when `backupRoot.renameTo(targetRoot)` failed during recovery. Phase 20 makes the state machine monotonic. A present backup is either activated and journaled cleanup completes, or staging is removed while backup and journal remain with `import_recovery_pending`. Orphan backup activation now emits `orphan_recovery_pending` instead of silently leaving no result. Empty and unsafe journal paths remain fail-closed.

The host oracle now injects journaled and orphan rename failures and reports eight scenarios. It proves retention and retry signaling at the host boundary only; `nativeDeviceEvidence` remains false and the verifier stays out of `mobile-slim`. A fresh Tauri Android slim build produced unsigned universal APK/AAB artifacts with compressed payloads `9,576,838` and `7,055,579` bytes. Both pass arm64/forbidden-entry/25 MiB checks, but signature, device workload, storage/permission retry, process death, and RSS evidence are still absent.

### 中文

Phase 19 修复后仍有一个破坏性启动分支：恢复期间 `backupRoot.renameTo(targetRoot)` 失败时会删除已保留的 backup。Phase 20 让状态机相对于已知数据单调：backup 存在时，要么成功激活并完成 journal 清理，要么只删除 staging，保留 backup 与 journal 并写入 `import_recovery_pending`。孤儿 backup 激活失败现在写入 `orphan_recovery_pending`，不再静默丢失结果；空路径与不安全 journal 继续 fail-closed。

Host oracle 现在注入 journaled 与 orphan rename failure 并报告 8 个场景，只证明 host boundary 的保留与重试信号；`nativeDeviceEvidence` 仍为 false，verifier 继续排除出 `mobile-slim`。新鲜 Tauri Android slim 构建生成未签名 universal APK/AAB，压缩 payload 分别为 `9,576,838` 与 `7,055,579` 字节，均通过 arm64、禁入项与 25 MiB 检查；签名、真机 workload、存储/权限重试、进程死亡与 RSS 证据仍缺失。
