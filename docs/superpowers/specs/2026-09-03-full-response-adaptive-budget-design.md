# Full Response Adaptive Budget Design

## English

### Goal

Expand desktop `full` responses without weakening the existing `slim` contract or the mobile resource boundary. Full responses should adapt to the host capability, expose their effective budget for diagnostics, and offer an explicit user-controlled mode that removes product truncation while retaining non-optional runtime safety controls.

### Compatibility Contract

- `slim` remains the default and preserves the current response shape, answer quality gates, and legacy verifier filenames.
- `full` remains an additive response mode. Existing clients that send no budget field receive the adaptive default.
- `responseProfile=mobile_compact` always projects to `slim`; it ignores desktop full-budget requests.
- The selected budget mode is part of request normalization, turn-cache fingerprints, response metadata, and trace diagnostics.

### Budget Model

The server owns the budget policy. Clients may request a budget mode but cannot provide arbitrary numeric limits.

| Budget tier | Fragments | Characters per fragment | RAG characters | Report characters |
|---|---:|---:|---:|---:|
| `standard` | 120 | 8,000 | 64,000 | 48,000 |
| `extended` | 160 | 12,000 | 128,000 | 80,000 |
| `max` | 256 | 16,000 | 256,000 | 160,000 |

`adaptive` chooses a tier from an injected host capability/workload hint. Missing or invalid hints resolve to `standard`; the server never accepts a client-supplied value above `max`.

`unbounded` disables product-level RAG/report truncation for the current scoped corpus. It does not mean an infinite allocation: the implementation still uses a runtime safety governor for timeout, byte/memory pressure, and streaming backpressure. When the governor stops assembly, the response must include an explicit truncation state and reason. This state is observable in the response and trace; it must never be silently omitted.

### Architecture

1. Normalize `responseBudgetMode` at the request boundary to `adaptive` or `unbounded`; unknown values are ignored and resolve to `adaptive`.
2. Resolve an immutable effective budget in `KnowledgeLearningPlatform` using the response mode, normalized budget mode, and injected host capability. Mobile projection resolves to `slim` before budget selection.
3. Pass the resolved budget into RAG assembly and full-report assembly. Remove duplicated hard-coded full limits from the composer; the composer receives a budget object and a safety result.
4. Add effective budget and truncation metadata to `AgentConversationResponse.trace` and the public response summary without exposing internal prompt text or raw evidence payloads to mobile projection.
5. Keep cache identity, SSE replay, JSON responses, and browser verification aligned on both mode and budget mode.

### Runtime Safety

- Safety limits are host-owned and cannot be disabled by a user request.
- JSON responses must not build an unbounded in-memory string before writing; the serializer must enforce the same governor state used by report assembly.
- SSE writes must respect backpressure and abort on request disconnect or timeout.
- The mobile profile continues to return the bounded `mobileProjection` only and must not ship desktop report assets or retrieve desktop-sized context.
- A failed or interrupted unbounded assembly returns a valid structured response with `truncated=true`, `truncationReason`, and the sections already assembled.

### Error Handling and Security

- Budget mode is an enum-like contract, not a boolean switch or arbitrary numeric override.
- Unbounded mode is accepted only for desktop/default profiles and must be rejected or projected to `slim` for `mobile_compact`.
- Capability values are validated once at the edge and clamped to the server's hard maximum.
- Trace data records requested mode, effective tier, and truncation reason; it must not record secrets, prompts, or full raw source content outside the existing evidence contract.

### Verification

- Unit tests cover normalization, unknown values, mobile projection, adaptive tier selection, max-tier caps, unbounded assembly, safety-governor truncation, and cache fingerprint separation.
- Existing slim/full composer and Agent Workspace contract suites remain green.
- Browser verification covers desktop adaptive, desktop unbounded, KaTeX rendering, no Mermaid/prompt leakage, and explicit truncation metadata when the safety governor is exercised.
- Full Jest, production/Vite builds, mobile contract gates, and remote CI must pass before updating `main`.

## 中文

### 目标

放宽桌面端 `full` 回答，同时不改变既有 `slim` 契约，也不突破移动端资源边界。`full` 应根据宿主能力自适应，暴露实际预算用于诊断，并提供用户显式开启的模式以取消产品层截断，但保留不可关闭的运行时安全控制。

### 兼容性契约

- `slim` 仍是默认模式，保持当前响应结构、回答质量门禁和旧验证器文件名。
- `full` 是 additive response mode；未发送预算字段的旧客户端使用自适应默认档位。
- `responseProfile=mobile_compact` 始终投影为 `slim`，忽略桌面 full-budget 请求。
- 预算模式进入请求归一化、turn-cache fingerprint、响应元数据和 trace 诊断。

### 预算模型

预算策略由服务端拥有。客户端只能请求预算模式，不能提交任意数字上限。

| 预算档位 | fragments | 每片字符数 | RAG 总字符数 | 报告字符上限 |
|---|---:|---:|---:|---:|
| `standard` | 120 | 8,000 | 64,000 | 48,000 |
| `extended` | 160 | 12,000 | 128,000 | 80,000 |
| `max` | 256 | 16,000 | 256,000 | 160,000 |

`adaptive` 根据注入的宿主能力/工作负载提示选择档位。提示缺失或非法时降为 `standard`；服务端不接受超过 `max` 的客户端数值。

`unbounded` 取消当前作用域知识库的产品层 RAG/报告截断。它不代表无限内存分配：实现仍受超时、字节/内存压力和流式背压组成的运行时安全阀约束。安全阀中止拼装时，响应必须带有明确的截断状态和原因；禁止静默丢失。

### 架构

1. 在请求边界将 `responseBudgetMode` 归一化为 `adaptive` 或 `unbounded`；未知值忽略并回落 `adaptive`。
2. `KnowledgeLearningPlatform` 根据回答模式、归一化预算模式和注入的宿主能力解析不可变的 effective budget。移动投影在预算选择前先解析为 `slim`。
3. 将 effective budget 传入 RAG 和 full-report 拼装；移除 composer 内重复的 full 硬编码上限，由 composer 接收预算对象和安全阀结果。
4. 在 `AgentConversationResponse.trace` 和公共 summary 增加 effective budget 与截断元数据；移动投影不得暴露内部 prompt 或原始 evidence payload。
5. JSON、SSE、SSE replay、turn-cache 和浏览器验证器统一识别回答模式与预算模式。

### 运行时安全

- 安全上限由宿主拥有，用户请求不可关闭。
- JSON 响应不得在写出前构造无限大的内存字符串；序列化必须使用与报告拼装相同的安全阀状态。
- SSE 写入遵守背压，在客户端断开或超时后中止。
- 移动 profile 继续只返回有界 `mobileProjection`，不打包桌面报告资源，也不读取桌面级上下文。
- unbounded 拼装失败或中断时返回有效结构化响应，包含已拼装章节、`truncated=true` 与 `truncationReason`。

### 错误处理与安全

- 预算模式是枚举契约，不使用布尔开关或任意数字覆盖。
- unbounded 仅对桌面/default profile 接受；`mobile_compact` 必须拒绝或投影为 `slim`。
- capability 在边界校验，并限制到服务端硬最大值。
- trace 记录请求模式、effective tier 和截断原因，不记录 secret、prompt 或超出现有 evidence 契约的完整源文本。

### 验证

- 单元测试覆盖归一化、未知值、移动投影、自适应档位、max 上限、unbounded 拼装、安全阀截断和缓存 fingerprint 隔离。
- 既有 slim/full composer 与 Agent Workspace contract 套件必须保持通过。
- 浏览器验证覆盖桌面 adaptive、桌面 unbounded、KaTeX 渲染、无 Mermaid/prompt 泄漏，以及安全阀触发时的显式截断元数据。
- 完整 Jest、生产/Vite 构建、移动端 contract gate 和远端 CI 全部通过后才能更新 `main`。
