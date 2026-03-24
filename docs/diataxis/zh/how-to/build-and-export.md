# 操作指南：构建与导出

当你需要导出桌面与移动端发布产物时，请使用本指南。

## 桌面端（Tauri）

```bash
npm run tauri:build
# 或精简资源模式
npm run tauri:build:mini
```

## Android（Capacitor）

```bash
npm run mobile:build:capacitor
```

## Android（Tauri Android）

```bash
npm run tauri:android:init
npm run tauri:android:build
```

## 发布校验

建议执行以下关键门禁：

```bash
npm run verify:fixrisk:issues
npm run verify:sbom -- --strict 1
npm run verify:sbom:attestation -- --strict 1 --allow-missing 0
```

## 详细权威来源

- [docs/zh/export.md](../../../zh/export.md)
- [docs/zh/README.md](../../../zh/README.md)
- [docs/zh/release_v1.6.0_report.md](../../../zh/release_v1.6.0_report.md)
