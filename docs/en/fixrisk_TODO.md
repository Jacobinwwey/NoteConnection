# NoteConnection Fixrisk TODO (Live Status)

Last updated: 2026-03-11

## Scope
This document tracks only real, currently verifiable risks. Items are marked `Closed` only when backed by code + contract tests (or an explicit operational gate).

## Issues (Live)
| ID | Issue | Severity | Status | Evidence |
| :-- | :-- | :-- | :-- | :-- |
| FR-001 | HTTP request-body memory risk (`readJsonBody`) under large payloads | Critical | Closed (code) | `src/server.ts` now uses bounded body policy + spool-to-disk flow with runtime diagnostics and contract coverage (`src/runtime.spool.policy.contract.test.ts`). |
| FR-002 | Sidecar packager conflict (`pkg` + `@yao-pkg/pkg`) | Critical | Closed (code) | `package.json` now keeps only `@yao-pkg/pkg` in devDependencies; sidecar build script is pinned to `node_modules/@yao-pkg/pkg/...` (`scripts/build-sidecar.js`). |
| FR-003 | Capacitor sidecar loopback binding was implicit | High | Closed (code) | `capacitor.config.ts` now declares explicit server loopback policy (`hostname`, `cleartext`, `allowNavigation`) with contract assertion in `src/mobile.pipeline.test.ts`. |
| FR-004 | Runtime eval/new Function snapshot/CSP risk | Critical | Closed (code) | Contract gate enforces no dynamic eval fallback in critical paths (`src/pkg.snapshot.safety.contract.test.ts`). |
| FR-005 | Hard-coded 12GB startup heap (`--max-old-space-size=12288`) | High | Closed (code) | Startup now uses adaptive memory policy + workload hints (`scripts/start-server.js`, `scripts/lib/runtime-memory-policy.js`) with contract test (`src/runtime.heap.policy.contract.test.ts`). |
| FR-006 | No enforceable signed-sidecar gate policy in CI/release | Medium | Closed (policy gate) | Added `scripts/verify-sidecar-signatures.js`, package script `verify:sidecar:signatures`, CI contract wiring in `.github/workflows/migration-gates.yml` and `.github/workflows/npm-publish.yml`, plus tests (`src/sidecar.signature.contract.test.ts`). |
| FR-010 | GitHub Actions Node 20 JavaScript action runtime deprecation warning | Medium | Closed (pipeline) | Workflows moved to `actions/checkout@v5` + `actions/setup-node@v5` and set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"` in all active workflows. |
| FR-011 | Android/Tauri toolchain feasibility drift (JDK mismatch + unconstrained local Rust OOM) | High | Closed (code gate); Pending (host provisioning) | Android prerequisite verifier now enforces Java 21 toolchain availability (`scripts/verify-tauri-android-prereqs.js`), Capacitor Android build uses Android-only sync (`build_apk.bat`), and Tauri Rust tests run via resource-aware wrapper (`scripts/run-tauri-tests.js`) with strict/non-strict diagnostic reports (`build/tauri-test-verification-strict.json`, `build/tauri-test-verification-nonstrict.json`). |
| FR-007 | Canvas graph semantics inaccessible to assistive tech | Critical | Closed (code) | Accessibility contract exists and is in migration gate set (`src/graph.accessibility.contract.test.ts`). |
| FR-008 | Privacy manifest compliance gate missing | Critical | Closed (code) | iOS privacy manifest + verifier + contract are active (`ios/App/PrivacyInfo.xcprivacy`, `scripts/verify-privacy-manifest.js`, `src/privacy.manifest.contract.test.ts`). |
| FR-009 | Physical-device evidence not explicitly tied to large-graph threshold | High | Closed (tooling); Pending (ops evidence) | Evidence schema now includes workload node/edge counts (`scripts/capture-capacitor-device-evidence.js`) and strict large-graph verifier controls (`scripts/verify-capacitor-evidence-freshness.js`) with contract tests (`src/capacitor.evidence.contract.test.ts`). Real device evidence still requires manual run. |

## Current Operational Blockers
The only remaining blocker is operational, not code completeness:

1. Capture real-device acceptance evidence with workload >= `10,000` nodes and >= `1,000,000` edges.
2. Run strict verification with large-graph mode enabled:
   - `NOTE_CONNECTION_REQUIRE_LARGE_GRAPH_EVIDENCE=1`
   - `NOTE_CONNECTION_MIN_EVIDENCE_NODE_COUNT=10000`
   - `NOTE_CONNECTION_MIN_EVIDENCE_EDGE_COUNT=1000000`
3. Provision Java 21 toolchain on host/CI runners used for Android builds (current host only has JDK 23).
4. Use a higher-memory runner for strict Tauri Rust compilation or keep strict mode in CI where memory budget is controlled.

## Commands (Verification Baseline)
```bash
node scripts/verify-detox-pipeline.js
node scripts/verify-privacy-manifest.js
node scripts/verify-sidecar-signatures.js --contract-only
node node_modules/typescript/bin/tsc --noEmit
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run test:migration
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run test:gates
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run test:tauri
```

## Best-Practice Compliance Checklist
| Area | Status | Note |
| :-- | :--: | :-- |
| Data transmission guardrails | ✅ | Request-body spool policy + bridge inbound policy are both adaptive. |
| Sidecar packaging consistency | ✅ | Single packager strategy (`@yao-pkg/pkg`). |
| Capacitor loopback policy clarity | ✅ | Explicit loopback server config in `capacitor.config.ts`. |
| Runtime safety (no eval fallback) | ✅ | Contract-protected. |
| Memory policy for large graphs | ✅ | Adaptive heap policy with host-budget clamp. |
| Mobile E2E/contract baseline | ✅ | Detox + privacy + mobile pipeline verifiers wired. |
| Accessibility contract | ✅ | Graph accessibility contract in migration suite. |
| Release signing policy gate | ✅ | Signature verifier script + CI contract wiring present. |
| Android/Tauri toolchain guardrails | ⚠️ | Guardrails are implemented; this host still needs Java 21 toolchain and stable memory headroom for strict Tauri Rust builds. |
| Real large-graph device evidence | ⚠️ | Tooling complete; physical evidence capture still required. |
diff --git a/e:\Knowledge_project\NoteConnection_app\docs\en\fixrisk_TODO.md b/e:\Knowledge_project\NoteConnection_app\docs\en\fixrisk_TODO.md
deleted file mode 100644
--- a/e:\Knowledge_project\NoteConnection_app\docs\en\fixrisk_TODO.md
+++ /dev/null
@@ -1,311 +0,0 @@
-# NoteConnection Hybrid Architecture & Security Audit (2026-03)
-
-## EXECUTIVE SUMMARY
-
-**Hybrid Verdict:** NoteConnection presents an ambitious edge-computing hybrid vision that effectively bridges Godot Vulkan rendering with Capacitor 8.2+ mobile shells and `@yao-pkg/pkg` Node.js sidecars, but its production readiness is severely hampered by critical bottlenecks in data serialization limits, runtime evaluation violations, and suboptimal memory provisioning which jeopardize App Store compliance and long-term scalability.
-
-### Production Readiness Scorecard
-
-| Dimension | Risk Area | Score (1-10) | Status | Primary Bottleneck |
-| :--- | :--- | :---: | :--- | :--- |
-| **1. Data Transmission** | Hybrid IPC Chain | 5/10 | ⚠️ At Risk | JSON.parse blocking on >5000 nodes, WebView OOM risk. |
-| **2. Pkg Distribution** | Sidecar Binary | 4/10 | ❌ Critical | `new Function`/dynamic requires bypass snapshot safety. |
-| **3. Capacitor Hybrid** | Mobile Plugins | 7/10 | ✅ Passable | CSP restrictions, background execution limitations. |
-| **4. Code Strictness** | Static Analysis | 3/10 | ❌ Critical | Dependency conflicts (`pkg` vs `@yao-pkg/pkg`). |
-| **5. Performance** | Resource Usage | 4/10 | ❌ Critical | Overly permissive heap (12GB) causes instant OOM on mobile. |
-| **6. Testing & CI/CD** | Pipeline Gates | 6/10 | ✅ Passable | Missing deep E2E matrix execution (Detox on pure native). |
-| **7. Accessibility** | UX & A11y | 4/10 | ❌ Critical | Canvas rendering completely obscures graph semantics to screen readers. |
-| **8. Compliance** | Security/Legal | 4/10 | ❌ Critical | Missing comprehensive Privacy Manifest, threat of Store rejection. |
-
----
-
-## SECTION 1: HYBRID DATA TRANSMISSION CHAIN ANALYSIS (端到端混合数据传输链路微观审查)
-
-**Quantitative Bottleneck:** Streaming 1GB+ payloads over the WebSocket/HTTP hybrid bridge causes synchronous `JSON.parse` blocks exceeding 3,000ms. Mobile devices experience massive battery drain (up to 12% per 10 mins of continuous data sync). 
-
-```mermaid
-flowchart TD
-    subgraph Data Flow Architecture
-    A[Local FS/IndexedDB] -->|Read Chunked (Stream)| B(Node 22 Sidecar Worker)
-    B -->|Serialized JSON / Brotli| C{Connection Bridge IPC}
-    C -->|WebSocket Port 9876| D[Godot Vulkan Renderer]
-    C -->|HTTP REST port 3000| E[Capacitor WebView Bridge]
-    E -->|JSON.parse Blocking Queue| F[Canvas / WebGL Fallback]
-    F --> G[End User Device Screen]
-    end
-    style B fill:#f9f,stroke:#333,stroke-width:2px
-    style C fill:#bbf,stroke:#333,stroke-width:2px
-    style E fill:#fcc,stroke:#333,stroke-width:2px
-```
-
-### Critical Issues (Table 1/6)
-| Severity | File : Line | Issue Description | Reproduction CLI | Cross-Tool Impact | Store Risk |
-| :--- | :--- | :--- | :--- | :--- | :--- |
-| **CRITICAL** | `src/server.ts:458` | Memory buffer exhaustion during `readJsonBody`. | `curl -X POST -d @huge.json localhost:3000` | Crashes Node worker, causing Capacitor to hang. | App Crash (Rejection) |
-
----
-
-## SECTION 2: MULTI-PLATFORM DISTRIBUTION & PACKAGING STRATEGY — PKG LAYER
-
-**Quantitative Bottleneck:** The final binary size is 50MB+, but memory usage spikes to >500MB upon unpacking virtual FS assets. Garbage collection post-packaging is inconsistent.
-
-```mermaid
-sequenceDiagram
-    autonumber
-    title Packaging Pipeline
-    participant CI as GitHub Actions
-    participant P as @yao-pkg/pkg
-    participant VFS as Virtual Snapshot FS
-    participant EXE as Output Binary
-
-    CI->>P: Run targets (node22-linux/win/mac)
-    P->>VFS: AST static analysis & tree shaking
-    Note over P,VFS: Dynamic imports trigger warnings
-    VFS-->>P: Package assets
-    P->>EXE: Embed V8 Bytecode & Brotli assets
-    EXE->>CI: Emit Self-contained Server
-```
-
-### Critical Issues (Table 2/6)
-| Severity | File : Line | Issue Description | Reproduction CLI | Cross-Tool Impact | Store Risk |
-| :--- | :--- | :--- | :--- | :--- | :--- |
-| **CRITICAL** | `package.json:15` | Conflicting `pkg` and `@yao-pkg/pkg` definitions. | `npm run build:sidecar` | Forces fallback to older Vercel pkg limits Node 22 compat. | Execution failure |
-
----
-
-## SECTION 3: CAPACITOR HYBRID LAYER INTEGRATION
-
-**Quantitative Bottleneck:** Under 10k concurrent nodes, the Capacitor WebView bridge serializes strings inefficiently. CPU profiles show 60% of time spent in `bridge.postMessage` serialization.
-
-```mermaid
-architecture-beta
-    title Monorepo Structure
-    group root(NoteConnection Workspace)
-    group app(Capacitor Hybrid App) in root
-    service web(WebView Context) in app
-    service native(Native Swift/Kotlin) in app
-    group sidecar(Pkg Backend) in root
-    service node(Node.js 22 Engine) in sidecar
-    service db(Local SQLite/JSON) in sidecar
-    
-    web:right:native
-    native:bottom:node
-    node:right:db
-```
-
-### Critical Issues (Table 3/6)
-| Severity | File : Line | Issue Description | Reproduction CLI | Cross-Tool Impact | Store Risk |
-| :--- | :--- | :--- | :--- | :--- | :--- |
-| **HIGH** | `capacitor.config.ts:8` | Missing explicit server IP binding configurations for sidecar IPC. | `npx cap run android` | Local network rejection on strict Android profiles. | Local Network Denied |
-
----
-
-## SECTION 4: CODE STRICTNESS & MAINTAINABILITY
-
-**Quantitative Bottleneck:** 35+ instances of missing `try/catch` around async network calls lead to unhandled promise rejections, permanently crashing the sidecar event loop.
-
-```mermaid
-gantt
-    title Refactoring Overview (8-Week Roadmap)
-    dateFormat YYYY-MM-DD
-    section Phase 1: Security
-    Remove eval/new Function    :active, a1, 2026-03-12, 7d
-    Dependency Cleanups         :a2, after a1, 7d
-    section Phase 2: Perf
-    Migrate to Uint8Array       :a3, after a2, 14d
-    Memory Profiling Limits     :a4, after a3, 7d
-    section Phase 3: CI/CD
-    Detox & A11y Automation     :a5, after a4, 14d
-    Privacy Manifest Finalize   :a6, after a5, 7d
-```
-
-### Critical Issues (Table 4/6)
-| Severity | File : Line | Issue Description | Reproduction CLI | Cross-Tool Impact | Store Risk |
-| :--- | :--- | :--- | :--- | :--- | :--- |
-| **CRITICAL** | `src/reader_renderer.ts:15` | Usage of `new Function` for dynamic imports violates CSP. | `grep -r "new Function" src/` | Breaks iOS App Store 2.5.2 guideline. | **Instant Rejection** |
-
----
-
-## SECTION 5: PERFORMANCE PROFILING, SCALABILITY & RESOURCE MANAGEMENT
-
-**Quantitative Bottleneck:** The `--max-old-space-size=12288` (12GB) flag causes instant OOM kills on 4GB RAM iOS devices. 
-
-```mermaid
-flowchart LR
-    subgraph Performance Call Graph
-    A[User Request] --> B{Node Event Loop}
-    B -->|Large Payload| C[V8 Heap Allocation]
-    C -->|Exceeds 1GB| D[Synchronous GC Pause]
-    D -->|OOM Trigger| E[Process Killed (SIGKILL)]
-    C -->|Memory Available| F[Bridge Transfer]
-    end
-```
-
-### Critical Issues (Table 5/6)
-| Severity | File : Line | Issue Description | Reproduction CLI | Cross-Tool Impact | Store Risk |
-| :--- | :--- | :--- | :--- | :--- | :--- |
-| **HIGH** | `package.json:10` | Hardcoded 12GB heap limit is lethal for mobile deployment. | `node --max-old-space-size=12288 src/server.ts` | Overrides OS limits, causing OS-level App termination. | High Crash Rate |
-
----
-
-## SECTION 6: TESTING COVERAGE, QUALITY GATES & CI/CD PIPELINE AUDIT
-
-**Quantitative Bottleneck:** Test coverage is below 90% in IPC bridging. No actual E2E matrix execution runs for packaged binary + Capacitor Swift simultaneously.
-
-```mermaid
-flowchart TD
-    subgraph CI/CD Matrix Execution
-    A[Push Event] --> B[Lint/TSC Strict]
-    B --> C{Platform Matrix}
-    C -->|Ubuntu| D[pkg linux-x64]
-    C -->|Windows| E[pkg win-x64]
-    C -->|macOS| F[pkg macos-arm64]
-    D & E & F --> G[Playwright Desktop E2E]
-    F --> H[xcodebuild / fastlane]
-    H --> I[Detox iOS E2E]
-    I --> J[Quality Gate Validation]
-    end
-```
-
-### Critical Issues (Table 6/6)
-| Severity | File : Line | Issue Description | Reproduction CLI | Cross-Tool Impact | Store Risk |
-| :--- | :--- | :--- | :--- | :--- | :--- |
-| **MEDIUM** | `.github/workflows/main.yml` | Missing signed binary gates. | `codesign -v --strict output.exe` | macOS Gatekeeper blocks execution of sidecar. | User blocked by OS |
-
----
-
-## SECTION 7: ACCESSIBILITY, INTERNATIONALIZATION & USER EXPERIENCE AUDIT
-
-**Quantitative Bottleneck:** WCAG 2.2 / ARIA compliance is 0% inside the Canvas graph element. VoiceOver reads nothing.
-
-```mermaid
-flowchart TD
-    subgraph Accessibility Flow
-    A[Canvas Node Render] --> B{ARIA Shadow DOM Mapper}
-    B -->|Sync Coordinates| C[Hidden div elements]
-    C -->|Focus Event| D[Screen Reader (VoiceOver)]
-    D -->|Speech Output| E[User]
-    end
-```
-
----
-
-## SECTION 8: DEPENDENCY/SUPPLY-CHAIN SECURITY, COMPLIANCE & LEGAL AUDIT
-
-**Quantitative Bottleneck:** Unpinned dependencies and missing SBOM. Privacy Manifest generation is not automated, putting every release at risk of rejection.
-
-```mermaid
-flowchart LR
-    subgraph Threat Model (STRIDE)
-    A[Malicious Graph Payload] -->|Spoofing| B[IPC Bridge]
-    B -->|Tampering| C[Node.js Sidecar]
-    C -->|Information Disclosure| D[Local FS Access]
-    D -->|Denial of Service| E[OOM Crash]
-    end
-```
-
----
-
-## FULL BEFORE/AFTER CODE DIFFS (Top 5 Critical Issues)
-
-**1. Remove dynamic `new Function` (src/reader_renderer.ts)**
-```diff
-- const dynamicImport = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<any>;
-+ const dynamicImport = (specifier: string) => import(specifier);
-```
-
-**2. Fix memory limits (package.json / scripts)**
-```diff
-- "start": "node --max-old-space-size=12288 src/server.ts"
-+ "start": "node --max-old-space-size=1024 src/server.ts"
-```
-
-**3. Fix Pkg Dependency Conflict (package.json)**
-```diff
-- "pkg": "^5.8.1",
-- "@yao-pkg/pkg": "^6.14.1"
-+ "@yao-pkg/pkg": "^6.14.1"
-```
-
-**4. Add missing try/catch in IPC (src/server.ts)**
-```diff
-- const data = await fs.promises.readFile(path);
-+ let data;
-+ try { data = await fs.promises.readFile(path); } catch(e) { throw new Error('FS Read fail'); }
-```
-
-**5. Fix Synchronous JSON Parse (src/server.ts)**
-```diff
-- const body = JSON.parse(await getRawBody(req));
-+ const body = await streamJsonParse(req); // Requires stream-json integration
-```
-
----
-
-## RECOMMENDED REFACTORING PLAN (CLI COMMANDS)
-
-Copy and paste these exact commands to execute the first phase of the roadmap:
-```bash
-# 1. Clean dependencies and remove conflicts
-npm uninstall pkg
-npm install @yao-pkg/pkg@latest --save-dev
-npm audit fix --force
-
-# 2. Sync Capacitor runtime
-npx cap sync
-
-# 3. Build sidecars with safe memory limits and brotli compression
-NODE_OPTIONS="--max-old-space-size=16384" npx @yao-pkg/pkg . --targets node22-win-x64,node22-linux-x64,node22-macos-arm64 --compress Brotli --public-packages "*"
-
-# 4. Generate iOS Privacy Manifest via Fastlane (if configured)
-fastlane ios build
-```
-
----
-
-## AUTOMATED SCAN COMMANDS
-
-Run these commands continuously in CI/CD:
-```bash
-# Static Analysis / Linting (Zero Warnings Policy)
-npx eslint src/ --ext .ts --max-warnings=0
-
-# Security Auditing (Fail on High/Critical)
-npm audit --audit-level=high
-
-# Automated E2E Matrix (Detox)
-npx detox test -c ios.sim.release
-npx detox test -c android.emu.release
-
-# Performance / Flamegraph Profiling
-node --prof src/server.ts && node --prof-process isolate-0x*-v8.log > flamegraph.txt
-```
-
----
-
-## BEST PRACTICES COMPLIANCE CHECKLIST
-
-| Section | Status | Remediation Command |
-| :--- | :---: | :--- |
-| **1. Data Transmission** | ❌ | `npm i stream-json && npm i -D @types/stream-json` |
-| **2. Pkg Distribution** | ❌ | `npm uninstall pkg && npm run build:sidecar` |
-| **3. Capacitor Layer** | ✅ | None required currently. |
-| **4. Code Quality** | ❌ | `npx eslint src/ --fix` |
-| **5. Performance** | ❌ | `sed -i '' 's/12288/1024/g' package.json` |
-| **6. Testing CI/CD** | ❌ | `npm install detox detox-cli --save-dev` |
-| **7. Accessibility** | ❌ | Implement ARIA shadow DOM layer. |
-| **8. Compliance** | ❌ | Generate `PrivacyInfo.xcprivacy` and sign binaries. |
-
----
-
-## FUTURE-PROOFING RECOMMENDATIONS
-
-1. **Node.js SEA Migration:** Moving away from `@yao-pkg/pkg` entirely. Node.js 22 has built-in Single Executable Application (SEA) capabilities. Transitioning to SEA will eliminate AST dynamic require failures natively.
-2. **Capacitor 9 Strategy:** Prepare for upcoming WASM-native threading models in Capacitor 9, which will deprecate standard WebSocket IPC in favor of direct JSI/WASM memory sharing.
-3. **Unified Monorepo Build Script:** Consolidate `scripts/build-sidecar.js` and `scripts/run-tauri-android.js` into a singular Nx or Turborepo pipeline to guarantee deterministic caching and synchronized versioning.
-
----
-**Missing Artifacts/Assumptions:**
-- **Assumption:** Node.js version is fixed at `22.x`.
-- **Assumption:** iOS target is `17.0+` supporting strict Local Network Privacy.
-- **Missing Artifacts:** Detailed memory dump (`.heapsnapshot`) for Android devices during a 10,000 node graph load.
