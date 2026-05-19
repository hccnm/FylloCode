## ADDED Requirements

### Requirement: 所有 tool 入参必填 targetPath 并校验合法性

`fyllo-specs` MCP 的 4 个 tool（`explore` / `create-proposal` / `apply-change` / `archive-change`）SHALL 全部把 `targetPath: string` 设为必填入参（zod schema 中无 `.optional()`、无 `.default(...)`）。

工具内部 SHALL 在执行任何 fs 副作用之前对 `targetPath` 进行合法性校验：

1. **绝对路径**：`path.isAbsolute(targetPath)` 必须为 `true`。
2. **是 main repo 的合法 worktree**：通过 `child_process.spawnSync("git", ["-C", FYLLO_PROJECT_PATH, "worktree", "list", "--porcelain"], { encoding: "utf8" })` 获取主仓库下所有已注册 worktree 的绝对路径集合（以 `worktree ` 开头的行后跟绝对路径）；`path.resolve(targetPath)` 必须出现在该集合中（main repo 自身在 `worktree list` 输出中亦算一条，因此 `targetPath === FYLLO_PROJECT_PATH` 总是合法）。
3. **non-git 项目兜底**：若 `git worktree list` 子进程退出码非 0（典型情况：`<FYLLO_PROJECT_PATH>/.git` 不存在，即 `template: "empty"` 项目），SHALL 退化为"`path.resolve(targetPath) === path.resolve(FYLLO_PROJECT_PATH)` 即合法"的旧规则。

校验失败时 tool SHALL：

- 不创建 change、不修改任何文件、不调用任何 git 子进程（除合法性校验本身的 `git worktree list`）。
- 在 `state.errors` 中追加 `{ type: "InvalidTargetPath", message }` 条目，message 中携带原始 `git worktree list --porcelain` stdout 供 agent 诊断。
- 仍然按 `runTool` 约定返回 `<tool_instruction>` + `<state>` 双段文本。

工具内部 projectRoot SHALL 取自 `path.resolve(input.targetPath)`，不再从 `resolveProjectRoot()`（`FYLLO_PROJECT_PATH` env）兜底。

#### Scenario: 4 个 tool 都拦截缺省 targetPath

- **WHEN** MCP client 调用 `explore` / `create-proposal` / `apply-change` / `archive-change` 任一，未传 `targetPath`
- **THEN** MCP SDK 在 zod schema 层拦截并返回 `isError: true`
- **AND** error code 等于 `InvalidParams`
- **AND** tool handler 不执行

#### Scenario: targetPath 为空字符串拦截

- **WHEN** MCP client 调用任一 tool 传入 `targetPath: ""`
- **THEN** zod schema 拦截（`.min(1)` 约束）并返回 `InvalidParams`
- **AND** tool handler 不执行

#### Scenario: targetPath 非绝对路径返回 InvalidTargetPath

- **WHEN** MCP client 调用任一 tool 传入相对路径如 `targetPath: "./.worktrees/foo"`
- **THEN** 响应仍含 `<tool_instruction>` 与 `<state>` 双段
- **AND** `state.errors` 包含 `{ type: "InvalidTargetPath", message }`
- **AND** message 文本说明 targetPath 必须是绝对路径
- **AND** 不调用 git 子进程
- **AND** 不修改任何文件

#### Scenario: targetPath 不在 worktree list 中返回 InvalidTargetPath

- **WHEN** 调用 `create-proposal` 传入 `targetPath: "/tmp/random-path"`
- **AND** `<FYLLO_PROJECT_PATH>/.git` 存在
- **AND** `/tmp/random-path` 不在 `git worktree list --porcelain` 输出中
- **THEN** `state.errors` 包含 `{ type: "InvalidTargetPath", message }`
- **AND** message 中包含 `git worktree list --porcelain` 的原始 stdout
- **AND** 不创建 change、不修改任何文件

#### Scenario: targetPath 等于 FYLLO_PROJECT_PATH 视为合法

- **WHEN** 调用任一 tool 传入 `targetPath` 等于 `FYLLO_PROJECT_PATH`（path.resolve 后）
- **AND** `<FYLLO_PROJECT_PATH>/.git` 存在
- **THEN** 视为合法（main repo 自身在 worktree list 中也是一条记录）
- **AND** 进入正常 tool 处理逻辑

#### Scenario: non-git 项目降级合法

- **WHEN** `<FYLLO_PROJECT_PATH>/.git` 不存在
- **AND** 调用任一 tool 传入 `targetPath` 等于 `FYLLO_PROJECT_PATH`
- **THEN** `git worktree list` spawn 退出码非 0
- **AND** 退化规则命中："targetPath === FYLLO_PROJECT_PATH 即合法"
- **AND** 进入正常 tool 处理逻辑

#### Scenario: non-git 项目传入其他路径仍 InvalidTargetPath

- **WHEN** `<FYLLO_PROJECT_PATH>/.git` 不存在
- **AND** 调用任一 tool 传入 `targetPath: "/tmp/elsewhere"`
- **THEN** `state.errors` 包含 `{ type: "InvalidTargetPath", message }`
- **AND** 不修改任何文件

#### Scenario: targetPath 路径规范化后比较

- **WHEN** 调用任一 tool 传入 `targetPath: <FYLLO_PROJECT_PATH> + "/"`（含 trailing slash）
- **THEN** 校验通过（path.resolve 剥离 trailing slash 后等于 main repo）

## MODIFIED Requirements

### Requirement: explore tool 返回 state

`explore` tool 接收参数 `{ changeName?: string, targetPath: string, includeInstruction?: boolean }`。`targetPath` 必填，校验规则参见「所有 tool 入参必填 targetPath 并校验合法性」Requirement。tool 内部 projectRoot SHALL 取自 `path.resolve(input.targetPath)`。

返回 state 至少包含：

| 字段            | 类型                         | 说明                                                          |
| --------------- | ---------------------------- | ------------------------------------------------------------- |
| `projectRoot`   | string                       | 等于 `path.resolve(input.targetPath)`                         |
| `schemaName`    | string                       | 当前 `openspec/config.yaml` 的 schema（如 `spec-driven`）     |
| `activeChanges` | `{ name, status, schema }[]` | `<projectRoot>/openspec/changes/` 下非 archive 的 change 列表 |
| `currentChange` | object \| null               | 若入参或上下文命中某 change，返回其 artifact 完成状态         |

#### Scenario: 无入参列出 active changes

- **WHEN** 调用 `explore` 不传 `changeName`、传入 `targetPath` 为 main repo
- **THEN** `state.activeChanges` 为当前 `<targetPath>/openspec/changes/*`（排除 `archive/`）的列表
- **AND** `state.currentChange` 为 `null`
- **AND** `state.projectRoot === path.resolve(input.targetPath)`

#### Scenario: 传入 changeName 命中已有 change

- **WHEN** 调用 `explore` 传入存在的 `changeName`、传入合法 `targetPath`
- **THEN** `state.currentChange.artifacts` 列出该 change 各 artifact 的状态
- **AND** state 中所有路径均基于 `path.resolve(input.targetPath)`

### Requirement: create-proposal tool 返回 state

`create-proposal` tool 接收参数 `{ name?: string, description?: string, targetPath: string, includeInstruction?: boolean }`。`targetPath` 必填，校验规则参见「所有 tool 入参必填 targetPath 并校验合法性」Requirement。tool 内部 projectRoot SHALL 取自 `path.resolve(input.targetPath)`。

当 `name` 提供且该 change 不存在时，tool SHALL 先调用 `openspec-runtime#createChange(projectRoot, name)` 创建目录并写入初始 `.openspec.yaml { schema, status: "creating" }`，再返回 state。本能力（P1）SHALL NOT 引入任何 git worktree 创建副作用。

返回 state 至少包含：

| 字段            | 类型                                                                | 说明                                           |
| --------------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| `changeName`    | string \| null                                                      | 当前目标 change；未指定且无法派生时为 null     |
| `schemaName`    | string                                                              | 如 `spec-driven`                               |
| `applyRequires` | `string[]`                                                          | schema 定义的 apply 前置 artifacts             |
| `artifacts`     | `{ id, status, outputPath, dependencies, template, instruction }[]` | 每个 artifact 的当前状态与创建所需的模板与指令 |
| `nextArtifact`  | string \| null                                                      | 下一个应被创建的 artifact id                   |

#### Scenario: 新建 change 目录与初始 yaml

- **WHEN** 调用 `create-proposal` 传入不存在的 `name`、合法 `targetPath`
- **THEN** `<targetPath>/openspec/changes/<name>/` 被创建
- **AND** `.openspec.yaml` 包含 `schema:` 与 `status: creating`
- **AND** 返回 state 中 `changeName === <name>`
- **AND** 不调用任何 git 子进程（除 targetPath 校验本身）

#### Scenario: 对已有 change 返回当前 artifact 进度

- **WHEN** 调用 `create-proposal` 传入已存在的 `name`、合法 `targetPath`
- **THEN** 不再覆盖已有文件
- **AND** 返回 state 中 `artifacts` 显示各 artifact 的真实状态（`done`/`ready`/`blocked`）
- **AND** `nextArtifact` 为依赖已满足且尚未 done 的第一个 artifact id（若全部 done，则为 null）

### Requirement: apply-change tool 返回 state

`apply-change` tool 接收参数 `{ changeName?: string, targetPath: string, includeInstruction?: boolean }`。`targetPath` 必填，校验规则参见「所有 tool 入参必填 targetPath 并校验合法性」Requirement。tool 内部 projectRoot SHALL 取自 `path.resolve(input.targetPath)`。

返回 state 至少包含：

| 字段           | 类型                                 | 说明                                                                                  |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| `changeName`   | string                               | 目标 change（若未传入，为上下文中唯一的活跃 change；否则需在 prompt 指引 agent 选择） |
| `schemaName`   | string                               | 如 `spec-driven`                                                                      |
| `applyState`   | `"ready" \| "blocked" \| "all_done"` | apply 当前状态                                                                        |
| `contextFiles` | `Record<string, string[]>`           | artifact id → 绝对文件路径数组（基于 targetPath，供 agent Read）                      |
| `tasks`        | `{ line, text, done }[]`             | 解析自 `tasks.md` 的任务列表                                                          |
| `progress`     | `{ total, complete, remaining }`     | 任务进度摘要                                                                          |

tool 在 state 中一并更新 `<targetPath>/openspec/changes/<changeName>/.openspec.yaml` 的 `status: applying`（若原状态不是 `applying`）。

#### Scenario: contextFiles 路径基于 targetPath

- **WHEN** 调用 `apply-change` 传入合法 `targetPath`、存在的 `changeName`
- **THEN** `state.contextFiles` 中所有路径以 `path.resolve(input.targetPath)` 开头

#### Scenario: 全部 artifacts 已 done 时返回 all_done

- **WHEN** 调用 `apply-change` 指向一个 artifacts 全部 done 且 tasks 全部勾选的 change
- **THEN** `state.applyState === "all_done"`
- **AND** prompt 文本引导 agent 推荐 archive

#### Scenario: 有 artifact 未 done 时返回 blocked

- **WHEN** 调用 `apply-change` 指向仍有 artifact 处于 `ready` 或 `blocked` 的 change
- **THEN** `state.applyState === "blocked"`
- **AND** prompt 文本引导 agent 先补齐 artifact

### Requirement: archive-change tool 返回 state 并执行归档动作

`archive-change` tool 接收参数 `{ changeName?: string, targetPath: string, confirm?: boolean, includeInstruction?: boolean }`。`targetPath` 必填，校验规则参见「所有 tool 入参必填 targetPath 并校验合法性」Requirement。tool 内部 projectRoot SHALL 取自 `path.resolve(input.targetPath)`。

默认（`confirm !== true`）SHALL 仅返回归档 preview 状态，不移动任何文件。本能力（P1）SHALL NOT 引入任何 git commit / merge / worktree remove / branch delete 副作用——`archive-change` 仅负责 OpenSpec 文件级归档（CLI 委托）。

返回 state 字段（同改造前）：

| 字段               | 类型                                     | 说明                                                                                           |
| ------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `changeName`       | string                                   | 目标 change                                                                                    |
| `artifactStatus`   | 同 `apply-change.state.artifacts` 简化版 | 用于展示 incomplete 告警                                                                       |
| `incompleteTasks`  | number                                   | 未勾选 tasks 数量                                                                              |
| `deltaSpecSummary` | object \| null                           | delta specs 与主 specs 的差异摘要                                                              |
| `archiveTarget`    | string                                   | 预计的归档目标路径（基于 targetPath）`<targetPath>/openspec/changes/archive/YYYY-MM-DD-<name>` |
| `archiveRawOutput` | string \| null                           | `confirm: true` 时 `openspec archive` 的 stdout 原文，preview 时为 `null`                      |
| `conflicts`        | `string[]`                               | 目标路径冲突（若有）                                                                           |

当 `confirm === true` 且 `conflicts` 为空时，tool SHALL 委托 `openspec archive <name> --yes` CLI 命令执行归档，CLI cwd 为 `path.resolve(input.targetPath)`。

#### Scenario: 预览模式不修改磁盘

- **WHEN** 调用 `archive-change` 传入存在的 `changeName`、合法 `targetPath`、不传 `confirm`
- **THEN** 返回 state 中包含 `archiveTarget` 与 `deltaSpecSummary`
- **AND** 磁盘上该 change 目录位置不变
- **AND** archiveTarget 路径以 `path.resolve(input.targetPath)` 开头

#### Scenario: 确认后执行归档

- **WHEN** 调用 `archive-change` 传入合法 `targetPath`、`confirm: true`
- **AND** 目标路径不冲突
- **THEN** 调用 `openspec archive <name> --yes` CLI 执行归档（cwd 为 targetPath）
- **AND** 原 `<targetPath>/openspec/changes/<name>/` 被移动至 `<targetPath>/openspec/changes/archive/YYYY-MM-DD-<name>/`
- **AND** 该目录中 `.openspec.yaml` 的 `status` 字段为 `archived`
- **AND** 若 change 包含 delta specs，主 specs 目录（`<targetPath>/openspec/specs/`）被同步更新
- **AND** tool 不调用任何 git 子进程（除 targetPath 校验本身）

#### Scenario: 目标冲突时拒绝归档

- **WHEN** 调用 `archive-change` 传入合法 `targetPath`、`confirm: true`，目标路径已存在
- **THEN** state `conflicts` 非空
- **AND** 不执行任何移动
- **AND** `state.errors` 为包含 `{ type: "Error", message: "Archive target exists: ..." }` 的非空数组
- **AND** 响应 `isError` 为 `false`
