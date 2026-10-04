# NoteConnection Release Runbook (Codex)

## English

### Goal

Provide a stable, repeatable release procedure for NoteConnection so that GitHub Release and npm publication stay aligned and predictable.

### Preconditions

- Work on the reviewed release branch. Keep the source PR open until candidate validation and the remaining release work are complete.
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
4. Commit and push the release branch for review:
   - `rtk git add <changed files>`
   - `rtk git commit -m "docs(release): ..."` or `release: vX.Y.Z`
   - `rtk git push origin <release-branch>`
   - Keep the source PR unmerged while the candidate is being validated.
5. Tag and push tag:
   - `rtk git tag vX.Y.Z`
   - `rtk git push origin refs/tags/vX.Y.Z`
6. Keep the GitHub Release in draft with explicit notes:
   - CI creates the draft from the checked-out release source and rejects an already public release.
   - If creating it manually: `rtk gh release create vX.Y.Z --draft --target <release-commit> --title "vX.Y.Z" --notes-file docs/release_notes_vX.Y.Z.md`.
7. Monitor candidate CI:
   - `Release Desktop Multi-OS` should pass and upload assets to the draft.
   - Android builds run only when native-device evidence is explicitly requested; signed-device gates remain required.
   - npm publication does not run for the tag or draft release.
8. Verify the exact candidate artifacts:
   - Download the CI AppImage and its separate original-server workflow artifact, run `npm run verify:appimage -- <image.AppImage> <original-server-sidecar>`, and complete baseline KVM/runtime acceptance.
   - Record the tested hashes and actual platform coverage in the bilingual release notes before publishing.
9. After validation and all remaining work are complete, merge the source PR into `main` and publish the existing draft:
   - `rtk gh release edit vX.Y.Z --draft=false --latest --notes-file docs/release_notes_vX.Y.Z.md`
10. Verify published outputs:
   - GitHub release assets match the accepted bytes and the documented platform coverage.
   - `Publish to npm` runs only for published product `v*` releases; Godot mirror releases are excluded.
   - Verify the npm registry: `npm view noteconnection version dist-tags --json`.

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

- 在经过审查的发布分支上工作；候选制品验收和其余发布工作完成前，源码 PR 保持未合并。
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
4. 提交并推送发布分支供审查：
   - `rtk git add <变更文件>`
   - `rtk git commit -m "docs(release): ..."` 或 `release: vX.Y.Z`
   - `rtk git push origin <release-branch>`
   - 候选制品验收期间保持源码 PR 未合并。
5. 打标签并推送：
   - `rtk git tag vX.Y.Z`
   - `rtk git push origin refs/tags/vX.Y.Z`
6. 保持 GitHub Release 为草稿并提供完整更新日志：
   - CI 从检出的发布源码创建草稿，并拒绝复用已公开的发布。
   - 如需手动创建：`rtk gh release create vX.Y.Z --draft --target <release-commit> --title "vX.Y.Z" --notes-file docs/release_notes_vX.Y.Z.md`。
7. 观察候选制品 CI：
   - `Release Desktop Multi-OS` 通过并将平台资产上传至草稿。
   - 仅在明确请求原生真机证据时执行 Android 构建，仍保留签名和真机门禁。
   - tag 或草稿发布不会触发 npm 发布。
8. 验收候选制品的精确字节：
   - 下载 CI AppImage 及单独保存原始 server 的 workflow artifact，执行 `npm run verify:appimage -- <image.AppImage> <original-server-sidecar>`，完成基线 KVM/运行时验收。
   - 正式公开前，在双语发布说明中记录实际测试散列和平台覆盖范围。
9. 验收和其余工作全部完成后，将源码 PR 合并到 `main`，再公开已有草稿：
   - `rtk gh release edit vX.Y.Z --draft=false --latest --notes-file docs/release_notes_vX.Y.Z.md`
10. 核验已发布产物：
   - GitHub Release 资产与已验收字节及文档中的平台覆盖一致。
   - `Publish to npm` 仅由正式公开的产品 `v*` release 触发，Godot 镜像发布除外。
   - npm 版本核验：`npm view noteconnection version dist-tags --json`。

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
