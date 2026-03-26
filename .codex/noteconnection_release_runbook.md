# NoteConnection Release Runbook (Codex)

## English

### Goal

Provide a stable, repeatable release procedure for NoteConnection so that GitHub Release and npm publication stay aligned and predictable.

### Preconditions

- Local branch is `main` and synced:
  - `rtk git pull --rebase origin main`
- Working tree is clean except intentionally ignored build artifacts.
- Version files are aligned:
  - `package.json`
  - `package-lock.json`
  - `src-tauri/tauri.conf.json`
- Release notes file exists:
  - `docs/release_notes_vX.Y.Z.md`

### Standard Release Flow

1. Update version:
   - `npm version X.Y.Z --no-git-tag-version`
   - Update `src-tauri/tauri.conf.json` version to `X.Y.Z`.
2. Update release docs:
   - Add/update release note file `docs/release_notes_vX.Y.Z.md` (English + Chinese sections).
   - Update README changelog pointers if needed.
3. Validate docs and tests:
   - `npm run docs:diataxis:check`
   - `npm run docs:site:build`
   - `npx jest --runInBand` (recommended for CI parity on Windows).
4. Commit and push to main:
   - `rtk git add <changed files>`
   - `rtk git commit -m "docs(release): ..."` or `release: vX.Y.Z`
   - `rtk git push origin main`
5. Tag and push tag:
   - `rtk git tag vX.Y.Z`
   - `rtk git push origin refs/tags/vX.Y.Z`
6. Create GitHub Release with explicit notes:
   - `rtk gh release create vX.Y.Z --title "vX.Y.Z" --notes-file docs/release_notes_vX.Y.Z.md`
7. Monitor CI:
   - `Release Desktop Multi-OS` should pass and upload assets.
   - `Publish to npm` should pass. npm is expected to auto-publish when CI succeeds.
8. Verify outputs:
   - GitHub release assets include Windows/macOS/Linux and APK (if workflow enables Android).
   - npm registry:
     - `npm view noteconnection version dist-tags --json`

### EdgeOne Docs Deploy (Optional but Recommended for docs releases)

1. Build docs:
   - `npm run docs:site:build`
2. Deploy:
   - `edgeone pages deploy build/mkdocs-site -n noteconnection-docs -e production -a global`
3. Record in release notes:
   - Deployment ID
   - Docs URL (or signed URL if preset-domain protection is enabled)

### Failure Handling

- If `Publish to npm` fails in CI due to environment leakage or flaky infra:
  - Fix workflow/test determinism first.
  - Re-run CI on the same tag.
  - Manual `npm publish` only as fallback with explicit OTP and logging.
- If SSH tag push fails:
  - Retry push once.
  - If still failing, use `gh api` to create tag ref and verify with `git ls-remote`.

---

## 中文

### 目标

沉淀一套稳定、可重复的 NoteConnection 发布流程，保证 GitHub Release 与 npm 发布一致、可追踪、可回放。

### 前置条件

- 当前分支为 `main` 且已同步：
  - `rtk git pull --rebase origin main`
- 工作区干净（仅允许明确忽略的构建产物残留）。
- 版本文件保持一致：
  - `package.json`
  - `package-lock.json`
  - `src-tauri/tauri.conf.json`
- 发布日志文件已准备：
  - `docs/release_notes_vX.Y.Z.md`

### 标准发布流程

1. 升级版本：
   - `npm version X.Y.Z --no-git-tag-version`
   - 同步更新 `src-tauri/tauri.conf.json` 版本号为 `X.Y.Z`。
2. 更新发布文档：
   - 新增/更新 `docs/release_notes_vX.Y.Z.md`（中英文分区）。
   - 按需补充 README 的 changelog 指针。
3. 执行校验：
   - `npm run docs:diataxis:check`
   - `npm run docs:site:build`
   - `npx jest --runInBand`（Windows 上更接近 CI，稳定性更高）。
4. 提交并推送主干：
   - `rtk git add <变更文件>`
   - `rtk git commit -m "docs(release): ..."` 或 `release: vX.Y.Z`
   - `rtk git push origin main`
5. 打标签并推送：
   - `rtk git tag vX.Y.Z`
   - `rtk git push origin refs/tags/vX.Y.Z`
6. 创建 GitHub Release（必须带完整更新日志）：
   - `rtk gh release create vX.Y.Z --title "vX.Y.Z" --notes-file docs/release_notes_vX.Y.Z.md`
7. 观察 CI：
   - `Release Desktop Multi-OS` 通过并上传平台资产。
   - `Publish to npm` 通过并自动发布 npm。
8. 发布后验收：
   - GitHub Release 资产包含 Windows/macOS/Linux（以及启用时的 APK）。
   - npm 版本核验：
     - `npm view noteconnection version dist-tags --json`

### EdgeOne 文档发布（文档类版本建议执行）

1. 构建文档：
   - `npm run docs:site:build`
2. 发布到 EdgeOne：
   - `edgeone pages deploy build/mkdocs-site -n noteconnection-docs -e production -a global`
3. 在发布日志中登记：
   - Deployment ID
   - 文档访问地址（若预设域名保护开启，记录签名 URL）

### 失败处理策略

- 若 `Publish to npm` 因 CI 环境污染或基础设施波动失败：
  - 优先修复工作流/测试确定性；
  - 重新运行同一 tag 的 CI；
  - 仅在必要时手动 `npm publish`（需 OTP，并记录日志）。
- 若 SSH 推送 tag 失败：
  - 先重试一次；
  - 仍失败时可用 `gh api` 创建 tag ref，并用 `git ls-remote` 校验。
