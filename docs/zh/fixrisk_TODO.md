# NoteConnection Fixrisk TODO（实时状态）

最后更新：2026-03-13

## 范围说明
本文件只保留“当前可验证”的真实风险。只有当问题具备代码修复和契约测试（或明确的运维闸门）时，才标记为 `Closed`。

## Issues（实时）
| ID | 问题 | 严重级别 | 状态 | 证据 |
| :-- | :-- | :-- | :-- | :-- |
| FR-001 | 大负载下请求体内存风险 | Critical | Closed | `src/server.ts` 已采用请求体上限落盘缓冲。 |
| FR-002 | Sidecar 打包器冲突 | Critical | Closed | 已统一为 `@yao-pkg/pkg`。 |
| FR-003 | Capacitor 回环地址策略不显式 | High | Closed | `capacitor.config.ts` 已显式声明。 |
| FR-004 | 运行时 eval 快照/CSP 风险 | Critical | Closed | 契约门禁禁止动态 eval 回退。 |
| FR-005 | 硬编码 12GB 堆内存 | High | Closed | 改为自适应堆策略。 |
| FR-006 | 缺少签名闸门策略 | Medium | Closed | CI 工作流已接入。 |
| FR-007 | Canvas 读屏不可访问 | Critical | Closed | 无障碍契约已纳入测试集。 |
| FR-008 | 隐私清单合规闸门缺失 | Critical | Closed | 已具备 Privacy Manifest 测试。 |
| FR-009 | 真机证据未强绑定大图阈值 | High | Closed | 校验脚本已严格校验。 |
| FR-010 | Action 节点弃用 | Medium | Closed | 升级 Node 24 流程。 |
| FR-011 | Android 工具链漂移 | High | Closed | 强制 Java 21。 |
| FR-012 | App Store 拒审风险（缺少跟踪用途说明） | High | Closed | `ios/App/Info.plist` 已加入 `NSUserTrackingUsageDescription`，并由 `scripts/verify-privacy-manifest.js` 与 `src/privacy.manifest.contract.test.ts` 强制校验。 |
| FR-013 | 无界限 localhost 端口回退 | Medium | Closed | 临时端口回退改为显式开关（`NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK=1`），并由 `src/server.port.fallback.contract.test.ts` 进行契约回归测试。 |

## 下一步
- 持续推进 fixrisk 范围外的延后加固项（Deferred Hardening）。
