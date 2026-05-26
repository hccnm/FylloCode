## 1. Release Workflow

- [x] 1.1 新增 `.github/workflows/release.yml`，配置 `push.tags: ["v*.*.*"]` 与 `workflow_dispatch` 触发，并设置 `permissions.contents: write`。
- [x] 1.2 在 `.github/workflows/release.yml` 中新增 macOS x64、macOS arm64、Windows x64、Linux x64 显式 matrix job；每个 job 复用现有 CI 的 `actions/checkout@v4`、`pnpm/action-setup@v4`、`actions/setup-node@v4`、Node.js 22、pnpm cache 和 `pnpm-lock.yaml`。
- [x] 1.3 在 `.github/workflows/release.yml` 中添加安装与构建步骤：`pnpm install --frozen-lockfile`、`pnpm build`。
- [x] 1.4 在 `.github/workflows/release.yml` 中添加版本一致性检查步骤：从 `GITHUB_REF_NAME` 读取 tag，去掉开头 `v` 后必须等于 `package.json` 的 `version`；不一致时步骤失败，且后续发布步骤不会运行。
- [x] 1.5 在 `.github/workflows/release.yml` 中添加发布步骤：设置 `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`，按 matrix 执行 `pnpm exec electron-builder --<target> --<arch> --publish always`，并确保该步骤仅在版本一致性检查成功后运行。

## 2. Electron Builder 配置

- [x] 2.1 修改 `electron-builder.yml`，新增顶层 `publish` 配置，provider 使用 `github`，`releaseType` 使用 `draft`。
- [x] 2.2 保持 `electron-builder.yml` 现有 `files`、`electronLanguages`、`asarUnpack`、`extraResources`、`mac`、`win`、`linux`、artifactName 和 `npmRebuild` 配置不变，除非实现发布 workflow 必须调整。

## 3. 文档与验证

- [x] 3.1 更新 `guidelines/Build.md`，补充 release workflow 是桌面发布入口、版本 tag 触发规则、draft release 行为、pnpm 约束和 tag/package version 一致性要求。
- [x] 3.2 运行 `pnpm build`，确认类型检查、MCP server bundle 和 electron-vite build 仍通过。
- [x] 3.3 静态检查 `.github/workflows/release.yml` YAML 结构、macOS x64 / macOS arm64 / Windows x64 / Linux x64 matrix、`GH_TOKEN` 环境变量、`permissions.contents: write` 和 electron-builder publish 命令均符合 spec。
- [x] 3.4 在实现说明中记录真实发布验证缺口：当前本地环境不能通过 GitHub tag push 验证 draft release 创建和 asset 上传；后续需通过推送与 `package.json.version` 匹配的 `v*.*.*` tag 验证。
