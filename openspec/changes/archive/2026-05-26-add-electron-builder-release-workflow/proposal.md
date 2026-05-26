## Why

当前仓库只有 CI 质量检查，没有版本 tag 到 GitHub Release 草稿的自动发布链路。需要让维护者推送版本 tag 后自动构建桌面安装包，并把产物填入 draft release，减少手工打包和上传遗漏。

## What Changes

- 新增 GitHub Actions release workflow，在 `v*.*.*` tag 推送时触发。
- release workflow 使用项目既有 `pnpm@10.33.0`、Node.js 22 与 `pnpm-lock.yaml`，不使用 `samuelmeuli/action-electron-builder@v1` 的 yarn/npm 封装。
- release workflow 在 macOS x64、macOS arm64、Windows x64、Linux x64 四个显式目标上执行 `pnpm build` 后调用对应的 `electron-builder --<target> --<arch> --publish always`。
- 在 `electron-builder.yml` 中配置 GitHub publisher，并将 release 类型设为 draft。
- 明确版本 tag 必须与 `package.json.version` 对齐；推送 tag 后生成的 draft release 与上传产物应使用同一版本号。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `desktop-packaging`: 增加桌面包 GitHub draft release 自动发布契约。

## Impact

- 影响 `.github/workflows/release.yml`。
- 影响 `electron-builder.yml` 的 `publish` 配置。
- 影响发布流程：维护者通过推送版本 tag 触发三平台打包、draft release 创建和产物上传。
- 不改变应用运行时代码、IPC、数据模型或桌面包内容过滤规则。
