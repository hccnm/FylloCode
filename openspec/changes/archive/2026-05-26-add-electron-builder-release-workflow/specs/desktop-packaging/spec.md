## ADDED Requirements

### Requirement: 版本 tag 自动创建桌面包 draft release

系统 SHALL 在 GitHub 收到匹配 `v*.*.*` 的版本 tag push 后，自动执行桌面发布 workflow。该 workflow MUST 使用 pnpm 安装依赖和执行项目构建，MUST 在 macOS x64、macOS arm64、Windows x64、Linux x64 四个显式目标上调用 electron-builder 构建对应产物，并 MUST 将产物上传到同一个 GitHub draft release。macOS 发布 MUST 拆分 x64 与 arm64 产物，MUST NOT 生成单个支持双架构的 universal 安装包。系统 MUST NOT 依赖不支持 pnpm 的 electron-builder GitHub Action 封装。

#### Scenario: 推送版本 tag 后创建 draft release

- **WHEN** 维护者向 GitHub 推送匹配 `v*.*.*` 的 tag
- **THEN** GitHub Actions 启动桌面发布 workflow
- **AND** workflow 使用 `pnpm install --frozen-lockfile` 安装依赖
- **AND** workflow 在发布前执行 `pnpm build`
- **AND** workflow 使用 electron-builder GitHub publisher 创建或更新该 tag 对应的 draft release

#### Scenario: 四个目标产物上传到同一个 draft release

- **WHEN** 桌面发布 workflow 在 macOS x64、macOS arm64、Windows x64、Linux x64 matrix job 中运行成功
- **THEN** macOS x64 job 上传 macOS x64 electron-builder 产物到该 tag 的 draft release
- **AND** macOS arm64 job 上传 macOS arm64 electron-builder 产物到该 tag 的 draft release
- **AND** Windows x64 job 上传 Windows x64 electron-builder 产物到该 tag 的 draft release
- **AND** Linux x64 job 上传 Linux x64 electron-builder 产物到该 tag 的 draft release

#### Scenario: 版本 tag 与 package version 对齐

- **WHEN** 桌面发布 workflow 由版本 tag 触发
- **THEN** workflow 在打包发布前校验 tag 去除 `v` 前缀后的版本号等于 `package.json` 的 `version`
- **AND** 如果版本不一致，workflow MUST 失败且不继续执行 electron-builder 发布步骤
