## 1. Pre-flight（方案 A：CLI spawn 的 3 点验证）

- [x] 1.1 写一次性脚本 `scripts/tmp/openspec-cli-probe.mjs`，用 `child_process.spawn` 以 `process.execPath` + `ELECTRON_RUN_AS_NODE=1` 启动 `node_modules/@fission-ai/openspec/bin/openspec.js`，依次跑 `list --json` / `status --change ... --json` / `instructions proposal --change ... --json` / `new change <tmp>`，确认 stdout 合法 JSON、exit code 0、cwd 语义正确（以 `openspec/` 所在目录为根）
- [x] 1.2 在 1.1 的 spawn 调用里传 env `OPENSPEC_TELEMETRY=0` 与 `DO_NOT_TRACK=1`（openspec README 文档化的两种关闭方式，并用双保险），运行期间抓网络（`lsof -p <pid>` 或本地 http proxy）确认无外发；若仍有上报，记录需要的 patch 方案（`patches/@fission-ai+openspec.patch` 替换 posthog 为 no-op）
- [x] 1.3 验证 electron-builder 的分发方式：在本地跑一次 `pnpm build:unpack`，检查打包结果中 `@fission-ai/openspec` 的 `bin/openspec.js` 与其 `dist/` 是否能被 spawn 启动；记录最终采用"方案 1：asarUnpack 保留 node_modules"还是"方案 2：独立 bundle CLI"的决定
- [x] 1.4 在 `design.md` 末尾补记 §1 验证结论（关键发现 / 最终采纳的 telemetry 关闭手段 / CLI 分发方式）

## 2. 顶层目录与工程骨架

- [x] 2.1 创建 `mcp-servers/fyllo-specs/` 目录骨架：`src/`、`src/tools/`、`src/prompts/`、`src/openspec-runtime/`、`src/utils/`、`__tests__/`、`tsconfig.json`、`README.md`
- [x] 2.2 将 §1 装入的 `@fission-ai/openspec@~1.3.1` 从 devDeps 升为 `dependencies`；新增 `@modelcontextprotocol/sdk` 为 `dependencies`；MCP server bundle 中 `@fission-ai/openspec` 声明为 external，`@modelcontextprotocol/sdk` 默认 inline
- [x] 2.3 `mcp-servers/fyllo-specs/tsconfig.json` 继承 `@electron-toolkit/tsconfig` 的 node 配置，`rootDir: src`，`outDir` 交给 electron-vite，不单独产出 `dist/`
- [x] 2.4 `mcp-servers/fyllo-specs/README.md` 写明：目录结构、改 md 无需改 ts、构建命令、调试方式（stdio handshake 手动跑 `process.execPath + out/mcp-servers/fyllo-specs/index.js`）

## 3. openspec-runtime 适配层（spawn CLI 模式）

- [x] 3.1 定义适配层类型 `ChangeSummary / ArtifactStatus / InstructionPayload / ArchiveResult / OpenspecCliError / OpenspecTimeoutError`，置于 `src/openspec-runtime/types.ts`
- [x] 3.2 实现 `src/openspec-runtime/spawner.ts`：封装 `spawn(cliPath, args, { cwd, env, timeout: 30s })`，合并 telemetry-off env（`OPENSPEC_TELEMETRY=0`/`DO_NOT_TRACK=1`/`NO_COLOR=1`），按需解析 stdout 为 JSON；非 0 退出或非法 JSON 抛 `OpenspecCliError`；超时抛 `OpenspecTimeoutError`；stderr 前 400 字符随 error 传出
- [x] 3.3 实现 `src/openspec-runtime/resolve-cli.ts`：dev 定位到 repo `node_modules/@fission-ai/openspec/bin/openspec.js`；prod 根据 §1.3 决定的方案返回对应路径（优先 `getResourcesPath`+`app.asar.unpacked/node_modules/.../bin/openspec.js`，或独立 bundle 路径）；统一通过环境变量 `FYLLO_OPENSPEC_CLI_PATH` 覆盖（便于测试注入）
- [x] 3.4 实现 `listChanges(projectRoot)`：调用 `spawner` 执行 `list --json`，JSON 解析 → `ChangeSummary[]`
- [x] 3.5 实现 `computeStatus(projectRoot, changeName)`：执行 `status --change <name> --json`，返回 applyRequires / artifacts 数组；包装 CLI 已归一化的 done/ready/blocked 状态
- [x] 3.6 实现 `getInstructions(projectRoot, changeName, artifactId)`：执行 `instructions <artifactId> --change <name> --json`，直接转交 CLI 返回的 `template / outputPath / dependencies / instruction`
- [x] 3.7 实现 `createChange(projectRoot, name)`：先 `status` 检查是否已存在；不存在时 `new change "<name>"`；成功后用 `fs` 读取并补写 `.openspec.yaml` 的 `status: creating`
- [x] 3.8 实现 `archiveChange(projectRoot, name, { confirm })`：预览模式（`confirm !== true`）用 `status` + `fs.readdir` 推导 `archiveTarget`、`deltaSpecSummary`、`conflicts`；确认模式下先写 `.openspec.yaml.status = archived`，再 `fs.rename` 到 `archive/YYYY-MM-DD-<name>`；不调用 `openspec archive`（其默认依赖 inquirer 交互，行为不确定）
- [x] 3.9 `src/openspec-runtime/index.ts` 仅 re-export 上述 5 个函数与类型，其它保持内部；spawner / resolve-cli 为内部实现
- [x] 3.10 `__tests__/openspec-runtime/` 用 Vitest + 真实 spawn 做集成测试（不 mock CLI）：每个函数至少 2 个 scenario（正常路径 + 错误路径）；准备 fixture 目录 `__tests__/fixtures/openspec-sample/`

## 4. Prompt 独立 md 与加载器

- [x] 4.1 从 `.claude/skills/openspec-explore/SKILL.md` 改写 `src/prompts/explore.md`，移除所有 `openspec ... --json` CLI 指令，改为"state 中已提供 activeChanges/currentChange"；显式告诉 agent CLI 是 MCP server 内部实现，agent 无需直接调用
- [x] 4.2 从 `.claude/skills/fyllo-propose/SKILL.md` 改写 `src/prompts/create-proposal.md`，替换 `openspec new change` / `status --json` / `instructions` 为 "tool 已为你创建目录，state 中含 nextArtifact/template/outputPath/instruction"
- [x] 4.3 从 `.claude/skills/fyllo-apply-change/SKILL.md` 改写 `src/prompts/apply-change.md`，`status --json` / `instructions apply --json` 替换为"state.contextFiles / state.tasks / state.progress / state.applyState"
- [x] 4.4 从 `.claude/skills/fyllo-archive-change/SKILL.md` 改写 `src/prompts/archive-change.md`，`openspec list --json` / `status --json` 替换为"tool 提供 artifactStatus / incompleteTasks / deltaSpecSummary / archiveTarget"；`mkdir + mv` 改为"调用本 tool 并传 `confirm: true` 完成归档"
- [x] 4.5 实现 `src/utils/load-prompt.ts`：dev 走 `fs.readFileSync`，build 走 esbuild `text` loader 内联（通过 `import promptText from "../prompts/xxx.md"`）
- [x] 4.6 增加单测 `__tests__/prompts.test.ts`：确保每个 prompt md 长度 > 0，且不包含 agent 可见的 CLI 指令片段（正则断言匹配 `openspec list|status|instructions|new change` 等关键字返回空）

## 5. MCP server 与四个 tool

- [x] 5.1 `src/index.ts`：在所有 import 前 `process.env.DO_NOT_TRACK = "1"`，然后 init stdio transport；处理 SIGTERM/SIGINT 干净退出
- [x] 5.2 `src/server.ts`：用 `@modelcontextprotocol/sdk` 的 Server API 注册四个 tool；错误以 `McpError` 归一化，code 按 spec 映射表
- [x] 5.3 `src/utils/project-root.ts`：`FYLLO_PROJECT_PATH` 优先，`process.cwd()` 兜底
- [x] 5.4 `src/utils/state.ts`：统一拼接 `<skill_prompt>` + `<state>` 的 text
- [x] 5.5 `src/tools/explore.ts`：入参 zod schema `{ changeName?: string }`；从 runtime 取 activeChanges / currentChange
- [x] 5.6 `src/tools/create-proposal.ts`：入参 `{ name?, description? }`；若 `name` 合法且目录不存在则 `createChange`；返回 applyRequires/artifacts/nextArtifact/template/instruction
- [x] 5.7 `src/tools/apply-change.ts`：入参 `{ changeName? }`；解析 `tasks.md` 的 checkbox 得到 tasks / progress；根据 computeStatus 决定 applyState；必要时更新 `.openspec.yaml.status = applying`
- [x] 5.8 `src/tools/archive-change.ts`：入参 `{ changeName?, confirm? }`；默认 preview（只返回 state）；`confirm === true` 时调用 runtime.archiveChange；冲突返回 `InvalidRequest`
- [x] 5.9 单测 `__tests__/tools/*.test.ts`：每个 tool 至少覆盖"有 state / 错误入参 / 不存在 change"三种情况；使用在 3.10 建好的 fixture

## 6. 构建与打包

- [x] 6.1 更新 `electron.vite.config.ts`：新增 MCP server 构建入口（evaluate `electron-vite` 是否原生支持额外 node lib；否则独立 esbuild 脚本 + `concurrently`）
- [x] 6.2 esbuild 配置：`bundle: true`、`platform: node`、`format: cjs`、`target: node20`、`external: ["@fission-ai/openspec"]`、`loader: { ".md": "text" }`、`minify: true`
- [x] 6.3 `package.json` scripts 补 `build:mcp-servers` 并串接进 `pnpm build`；dev 路径下也能一次产出 `out/mcp-servers/fyllo-specs/index.js`
- [x] 6.4 更新 `electron-builder.yml` 增加 `extraResources: - from: out/mcp-servers, to: mcp-servers`；按 §1.3 决定的方案补 `asarUnpack` 条目（方案 1）或 `extraResources` 增加 CLI bundle 目录（方案 2）
- [x] 6.5 产出体积门禁：CI/本地脚本校验 `out/mcp-servers/fyllo-specs/index.js < 500KB`（external 后应该更小），以及整包新增约束 `< 3MB`；超标失败

## 7. 主进程注入点

- [x] 7.1 新建 `electron/main/infra/mcp/` 目录；新建 `bundled-mcp-servers.ts` 实现 `getBundledMcpServers({ projectPath })`，内部依赖 `@main/infra/paths#getResourcesPath()` 与 `is.dev` 区分 dev/prod
- [x] 7.2 增加 `FYLLO_DISABLE_BUNDLED_MCP` 与 `FYLLO_MCP_TELEMETRY` 的 env 处理；禁用时直接返回 `[]`
- [x] 7.3 类型：`shared/types/mcp.ts` 定义 `McpServerSpec`（name/command/args/env），供主进程与未来 `integration-custom-mcp` 合并使用
- [x] 7.4 修改 `electron/main/services/chat/acp-session.ts`：`newSession` 与 `resumeSession` 两处都传 `mcpServers: getBundledMcpServers({ projectPath: this.opts.projectPath })`；`resumeSession` 失败降级到 `newSession` 时同样注入
- [x] 7.5 `electron/main/__tests__/infra/mcp/bundled-mcp-servers.test.ts`：mock `is.dev` 与 env，断言 dev/prod 路径、env 覆盖、disable 开关

## 8. ESLint 与文档

- [x] 8.1 ESLint 补充规则：禁止 `electron/main/**` 以外的代码 import `@main/*`；禁止 `mcp-servers/**` import `electron/**`；禁止 `mcp-servers/fyllo-specs/src/tools/**` 与 `mcp-servers/fyllo-specs/src/openspec-runtime/**` import `@fission-ai/openspec`；禁止 `mcp-servers/fyllo-specs/src/tools/**` 直接使用 `child_process`
- [x] 8.2 更新 `docs/Architecture.md`："顶层目录" 增加 `mcp-servers/`；"数据目录 / 路径规范" 段补一条 MCP server 解析规则
- [x] 8.3 更新 `docs/MainProcess.md`："路径 / ID / 默认值单点化" 表格增加 `getBundledMcpServers`；增加一节"新增一个内置 MCP server 的完整流程"
- [x] 8.4 在 `CLAUDE.md` 项目概述小节追加一条：内置 MCP server 位于 `mcp-servers/`

## 9. 端到端冒烟

- [x] 9.1 `pnpm dev` 起动应用，创建一个空 chat session，观察主进程日志确认 ACP agent spawn 的 MCP server 子进程已启动
- [x] 9.2 在 chat 里让 agent 调用 `explore` / `create-proposal` / `apply-change` / `archive-change` 四个 tool；验证返回 state 合理、prompt md 文本被 agent 正确解读
- [x] 9.3 验证 `resumeSession` 场景：重启应用后对同一个 session 继续聊，观察 `tools/list` 仍包含 fyllo-specs 四个 tool；若某 ACP agent 在 resume 后不暴露 MCP，则视为 agent 实现局限，记录但不作为本 change 阻塞
- [x] 9.4 打包测试：`pnpm build:mac`（或其他平台），从生成的 dmg/zip 安装后重复 §9.1–9.3；验证 `@fission-ai/openspec` CLI 在打包产物中可 spawn
- [x] 9.5 `FYLLO_DISABLE_BUNDLED_MCP=1` 启动一次，确认 ACP session 正常建立且 tools/list 不包含 fyllo-specs 四个 tool

## 10. 收尾

- [x] 10.1 全链路 `pnpm typecheck && pnpm lint && pnpm test` 通过
- [x] 10.2 提交前在 `proposal.md` / `design.md` / `specs/**` 补记 §1 验证实际结论（若与预估不同）
- [x] 10.3 在本 change 的 `tasks.md` 勾选所有任务后，按 `fyllo-archive-change` 流程归档
