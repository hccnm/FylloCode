## Context

FylloCode 使用 Electron + electron-vite + electron-builder 打包，项目包管理器为 `pnpm@10.33.0`，现有 CI 只在 push / pull request 到 `main` 时运行测试、lint 和 typecheck。`package.json` 的 `pnpm build` 会执行类型检查、bundled MCP server 构建和 electron-vite build，但不会调用 electron-builder；平台打包由 `electron-builder.yml` 和 `package:*` / `build:*` 脚本负责。

用户参考的 `samuelmeuli/action-electron-builder@v1` 能在 tag 推送后构建产物并创建 draft release，但该 action 的运行逻辑只支持 npm 或 yarn，不符合本项目必须使用 pnpm 的约束。因此本变更使用 GitHub Actions 原生步骤加 `pnpm exec electron-builder --publish always` 实现同等发布结果。

## Goals / Non-Goals

**Goals:**

- 在推送 `v*.*.*` 版本 tag 后自动构建 macOS x64、macOS arm64、Windows x64、Linux x64 桌面产物。
- 自动创建 GitHub draft release，并将 electron-builder 产物上传到该 draft release。
- 保持项目现有 pnpm 安装、`pnpm build` 和 `electron-builder.yml` 打包配置为唯一构建来源。
- 让 release workflow 可通过 `workflow_dispatch` 手动触发，用于调试发布链路。

**Non-Goals:**

- 不引入 `samuelmeuli/action-electron-builder@v1` 或其他替代包管理器封装。
- 不实现 macOS notarization、Windows code signing 或 Linux 仓库发布。
- 不改变桌面包内容过滤、MCP server bundling、artifact 命名或平台 target。
- 不改变现有 CI workflow 的质量检查职责。

## Decisions

### 使用 pnpm + electron-builder CLI，而不是 Marketplace action

选择：新增 release workflow，显式执行 `pnpm install --frozen-lockfile`、`pnpm build`，再按 matrix 执行 `pnpm exec electron-builder --<target> --<arch> --publish always`。

理由：项目规范要求使用 pnpm；Marketplace action 内部包管理器选择不支持 pnpm，会偏离 `pnpm-lock.yaml` 和 `packageManager` 声明。直接调用本地 `electron-builder` CLI 能保留 Marketplace action 的核心发布效果，同时遵守仓库约束。

替代方案：使用 `samuelmeuli/action-electron-builder@v1`。放弃原因是它会在当前仓库落到 yarn 路径，不符合项目包管理策略。

### 在 electron-builder.yml 声明 GitHub draft publisher

选择：添加顶层 `publish` 配置：

```yaml
publish:
  provider: github
  releaseType: draft
```

理由：draft release 是发布行为的一部分，应由 electron-builder 的发布配置显式描述。workflow 只负责提供触发条件、权限、环境变量和命令。

替代方案：用 `gh release create --draft` 手动创建 release，再上传产物。放弃原因是会重复 electron-builder 已有 publisher 能力，并要求手动维护 artifact glob。

### 显式目标与架构 matrix 独立构建并发布到同一个 tag release

选择：`release` job 使用 include matrix 显式声明 macOS x64、macOS arm64、Windows x64、Linux x64。每个 matrix entry 独立安装依赖、运行 `pnpm build`，再运行 `pnpm exec electron-builder --<target> --<arch> --publish always`。

理由：Electron 桌面包通常需要在目标平台 runner 上构建；matrix 能保持平台环境隔离，并允许单个平台或架构失败时清楚定位。macOS 必须拆成 x64 和 arm64 两个产物，避免生成同一个支持双架构的 universal 安装包导致包体积增大。

替代方案：在单个 runner 上交叉构建全部平台。放弃原因是 macOS、Windows 产物尤其涉及平台工具链和潜在签名能力，跨平台构建更脆弱。

### 发布权限使用 GITHUB_TOKEN

选择：workflow 设置 `permissions.contents: write`，并在发布步骤设置 `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`。

理由：electron-builder GitHub publisher 支持通过 `GH_TOKEN` 访问 GitHub Releases；仓库内置 token 对同仓库 draft release 与 asset 上传足够。

替代方案：新增自定义 PAT secret。放弃原因是当前目标只发布到同一仓库 release，不需要更宽权限。

## Risks / Trade-offs

- Tag 与 `package.json.version` 不一致 → 在 tasks 中要求加入版本一致性检查步骤，避免 release 名称和产物文件名分裂。
- 多平台/架构 job 同时向同一 draft release 上传 asset 可能暴露竞态或重复 asset 问题 → 使用相同 tag release，artifactName 已包含 `${os}` 与 `${arch}`，并保留 `fail-fast: false` 便于诊断单个平台或架构失败。
- `workflow_dispatch` 没有 tag 上下文时发布语义可能不完整 → 手动触发主要用于调试 workflow；正式发布以 `v*.*.*` tag push 为准。
- 当前未配置签名和 notarization → 本变更只保证构建与上传草稿 release，不承诺已签名/已公证的正式可分发质量。
