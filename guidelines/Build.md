---
name: Build
description: FylloCode 的构建入口、打包产物、MCP server bundling 与生成物约束
keywords: [build, electron-vite, electron-builder, packaging, generated]
---

# Build

## Purpose

定义 FylloCode 的构建命令、Electron 打包链路、MCP server bundle 输出、生成物边界和不可手改的构建产物。任何涉及 `electron-vite`、`electron-builder`、`out/`、`dist/`、`resources/`、`build/` 或脚本化构建的工作，都必须先阅读本文档。

## Applicability

- 适用于 `package.json` 中的 build/dev/start 脚本。
- 适用于 `electron.vite.config.ts`、`electron-builder.yml`、`scripts/build-mcp-servers.mjs`。
- 适用于 `out/`、`dist/`、`resources/`、`build/`、`mcp-servers/` 的构建与打包边界。

## Sources of Truth

- `package.json`
- `electron.vite.config.ts`
- `electron-builder.yml`
- `scripts/build-mcp-servers.mjs`
- `scripts/electron-builder-before-pack.cjs`
- `build/**`
- `resources/**`
- `mcp-servers/**`
- `openspec/specs/bundled-mcp-servers/spec.md`

## Rules

- MUST: 使用 `electron-vite` 作为主进程、预加载脚本和渲染进程的统一构建入口；入口定义以 `electron.vite.config.ts` 为准。
- MUST: 在 `pnpm dev` 和 `pnpm build` 之前先执行 `build:mcp-servers`，确保内置 MCP server 已构建到 `out/mcp-servers/`。
- MUST: 让 `scripts/build-mcp-servers.mjs` 作为 bundled MCP server 的唯一打包脚本来源，不在其他脚本中手写重复 bundle 逻辑。
- MUST: 将 `out/` 与 `dist/` 视为生成物目录，不手动编辑、不提交人为修补结果。
- MUST: 让 `electron-builder.yml` 成为桌面打包行为的权威来源，包括 `files`、`asarUnpack`、`extraResources`、平台产物命名和 `beforePack` 钩子。
- MUST: 通过 `extraResources` 将 `out/mcp-servers` 打包到 `app.asar.unpacked/mcp-servers`，保持生产环境与开发环境对 bundled servers 的寻址契约一致。
- MUST: 将应用资源放在 `resources/`，将打包图标、entitlements 等构建素材放在 `build/`，避免把运行时数据混入构建素材目录。
- SHOULD: 在修改构建脚本、打包资源或 alias 配置后，至少执行一次 `pnpm build` 验证主/预加载/渲染三端都能完成构建。
- SHOULD: 保持 `electron-builder.yml` 与 `electron.vite.config.ts` 的入口和输出职责一致，避免一个文件新增入口而另一个文件没有对应打包规则。
- MAY: 为特定平台增加单独的 build 脚本，但必须通过 `package.json` 与 `electron-builder.yml` 显式声明。

## Examples

- Good: `pnpm dev` 先运行 `npm run build:mcp-servers`，再执行 `electron-vite dev`。
- Good: `scripts/build-mcp-servers.mjs` 使用 esbuild 为 `mcp-servers/fyllo-specs` 与 `mcp-servers/fyllo-skills` 生成 `out/mcp-servers/<name>/index.js`。
- Good: `electron-builder.yml` 通过 `extraResources` 将构建好的 MCP servers 带入产物。
- Bad: 手动修改 `out/mcp-servers/**/index.js` 修补运行时问题。
- Bad: 在业务代码里假设生产环境直接从仓库源文件运行 `mcp-servers/**/src/index.ts`。

## Verification

- `pnpm build`
- `pnpm build:mcp-servers`
- 如修改打包配置：`pnpm build:unpack`
- 如修改平台相关配置：运行对应平台脚本，如 `pnpm build:mac`、`pnpm build:win`、`pnpm build:linux`
- 手动检查 `out/mcp-servers/`、`dist/` 与打包资源路径是否符合文档描述。

## Maintenance

- 当构建入口、打包工具、MCP server bundle 方式、资源目录或生成物约定变化时，必须更新本文档。
- 当引入新的内置 MCP server、平台脚本或打包钩子时，必须补充 Sources of Truth、Rules 和 Examples。
- 若构建脚本与 `package.json` 命令不一致，以实际脚本为准并立即修正文档。
