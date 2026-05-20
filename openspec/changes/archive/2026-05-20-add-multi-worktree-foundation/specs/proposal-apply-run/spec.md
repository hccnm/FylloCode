## ADDED Requirements

### Requirement: ApplyRunMeta 携带 worktreePath

`ApplyRunMeta` SHALL 增加可选字段 `worktreePath?: string`：

- 类型定义位于 `shared/types/proposal.ts`，字段为 `worktreePath?: string`。
- `proposal:apply` 创建新 run 时，从对应 `ProposalMeta.worktreePath` 透传该值；`ProposalMeta.worktreePath` 同期为可选字段，本能力（P1）阶段来源端始终写入 `undefined`，待 P3 启用 list 双源扫描后才会写入实际 worktree 绝对路径。
- 字段值（如有）SHALL 为绝对路径，写入前 `path.resolve` 规范化。
- 持久化到 `data/projects/<encoded>/apply-runs/<changeId>/run.json`。
- 旧 run.json 缺该字段时，`loadApplyRunMeta` 反序列化为 `worktreePath: undefined`，主进程行为完全等价于本能力引入前。
- `JSON.stringify` 默认对 `undefined` 字段省略，新写入 run.json 在该字段为空时不出现 `"worktreePath": null` 或 `"worktreePath": ""` 噪声。

#### Scenario: 创建 run 时透传 worktreePath（P1 阶段值为 undefined）

- **WHEN** ProposalMeta.worktreePath 为 `undefined`（P1 阶段唯一情况）
- **AND** renderer 调用 `proposal:apply` 创建新 run
- **THEN** 持久化的 run.json 中 `worktreePath` 字段缺失（JSON.stringify 省略）
- **AND** 加载该 run.json 后 `runMeta.worktreePath` 为 `undefined`

#### Scenario: 创建 run 时透传 worktreePath（worktreePath 非空场景）

- **WHEN** ProposalMeta.worktreePath 为 `<mainRepo>/.worktrees/foo`
- **AND** renderer 调用 `proposal:apply` 创建新 run
- **THEN** 持久化的 run.json 中 `worktreePath === <mainRepo>/.worktrees/foo`（path.resolve 后字符串相等）

#### Scenario: 旧 run.json 加载向后兼容

- **WHEN** 磁盘上已存在的 run.json 不含 `worktreePath` 字段
- **AND** 主进程调用 `loadApplyRunMeta`
- **THEN** 返回的 `ApplyRunMeta.worktreePath === undefined`
- **AND** 不抛错

#### Scenario: 路径规范化

- **WHEN** ProposalMeta.worktreePath 为 `<mainRepo>/.worktrees/foo/`（带 trailing slash）
- **AND** apply-run-service 写入 ApplyRunMeta
- **THEN** 持久化的 worktreePath 等于 `path.resolve(<mainRepo>/.worktrees/foo/)`，不含 trailing slash

## MODIFIED Requirements

### Requirement: Stage 流式执行通过 MessagePort 传输 chunk

系统 SHALL 在收到 `proposal:stageStream` IPC 时，main 进程根据 `stage.type` 构造 prompt，启动 `AcpSession`，通过 `MessageChannelMain` 将 `SessionEvent` chunk 推给 renderer。

prompt 构造规则（策略 Map，按 `stage.type` 分发）：

- `proposal-apply`：`加载 skill fyllo-apply-change，实现 {changeId}`
- 其他 type：抛出错误，code 为 `STAGE_TYPE_NOT_IMPLEMENTED`

`agentId` SHALL 取自 `stages[stageIndex].agent`。若 `stage.agent` 为空（`undefined` / `null` / 空字符串），handler SHALL 抛 `ipcError(IpcErrorCodes.VALIDATION_ERROR, "stage.agent is required for stage ${stageIndex}")`，且 SHALL NOT 创建 `AcpSession`、SHALL NOT 写入任何 stage 文件。系统 SHALL NOT 维护 workflow / 主进程级 "默认 agentId" 兜底。

`AcpSession` 创建参数 SHALL 按以下规则取值：

- **`cwd`**：`runMeta.worktreePath ?? projectPath`。即 ApplyRunMeta 含 worktreePath 时使用 worktree 绝对路径；缺失或为空字符串时 fallback 到主仓库 `projectPath`。
- **`projectPath`**：始终为主仓库路径，不随 worktree 变化（用于持久化目录计算等）。
- **`reminderContext`**：`{ changeId, stageIndex, runId, worktreePath: runMeta.worktreePath }`。`worktreePath` 字段允许为 `undefined`。

构造 `AcpSession` 时 SHALL 注入 `ApplyStageAcpSessionStore`（构造参数 `(projectPath, changeId, runId, stageIndex)`）。该 store 的实现：

- `loadAcpSessionId()`：调用 `loadApplyRunMeta(projectPath, changeId)`，校验 `meta.runId === runId`，返回 `meta.stageAcpSessionIds[stageIndex] ?? null`；若 runId 不一致或 meta 缺失，返回 `null` 并 `logger.warn` 记录
- `persistAcpSessionId(acpSessionId)`：通过 `updateRunMetaIfCurrent(projectPath, changeId, runId, ...)` 更新 `stageAcpSessionIds[stageIndex]` 与 `updatedAt`

apply stage 流 SHALL NOT 读写 `data/projects/<encoded>/sessions/` 目录下的任何文件。

#### Scenario: 发起 stage stream

- **WHEN** renderer 调用 `proposal:stageStream`，传入 `{ runId, stageIndex, projectId, changeId }`
- **AND** `stages[stageIndex].agent` 为非空字符串
- **THEN** main 进程通过策略 Map 构造 prompt
- **AND** 创建 `AcpSession`（`sessionStore` 为 `ApplyStageAcpSessionStore`），通过 `MessageChannelMain` 将 port2 传给 renderer
- **AND** 等待 renderer 发送 `{ type: "ready" }` 后调用 `session.start(prompt)`
- **AND** `acpSessionId` 通过 `sessionStore.persistAcpSessionId` 写入 `run.json` 的 `stageAcpSessionIds[stageIndex]`
- **AND** 不写入 `sessions/run-{runId}-{stageIndex}.json`
- **AND** 不写入 `sessions/run-{runId}-{stageIndex}.messages.jsonl`

#### Scenario: stage stream cwd 使用 worktreePath

- **WHEN** ApplyRunMeta.worktreePath 为非空字符串（例 `<mainRepo>/.worktrees/foo`）
- **AND** renderer 触发 `proposal:stageStream`
- **THEN** `AcpSession` 创建参数 `cwd === <mainRepo>/.worktrees/foo`
- **AND** `AcpSession.opts.projectPath` 仍为主仓库路径（不变）

#### Scenario: 旧 ApplyRunMeta 缺 worktreePath fallback

- **WHEN** ApplyRunMeta.worktreePath 为 `undefined`（P1 阶段全部场景，或旧 run.json）
- **AND** renderer 触发 `proposal:stageStream`
- **THEN** `AcpSession` 创建参数 `cwd === projectPath`
- **AND** 行为完全等价于本能力引入前

#### Scenario: reminderContext 携带 worktreePath

- **WHEN** `AcpSession` 创建并触发 system-reminder 注入流程
- **THEN** `resolveSystemReminder` 接收的 ctx 含 `worktreePath` 字段（值可能为 `undefined`）
- **AND** ctx 同时包含 `changeId`、`stageIndex`、`runId`

#### Scenario: Stage 缺少 agent 直接拒绝

- **WHEN** renderer 调用 `proposal:stageStream`，所选 stage 的 `agent` 字段为空
- **THEN** handler 在创建 `AcpSession` 之前抛 `VALIDATION_ERROR`，错误 message 包含 stage 索引信息
- **AND** 不向 `stage-{stageIndex}.messages.jsonl` 写入任何记录
- **AND** 不调用 `sessionRegistry.register`
- **AND** 不创建 `ApplyStageAcpSessionStore`

#### Scenario: 不支持的 stage type

- **WHEN** `stages[stageIndex].type` 不在策略 Map 中
- **THEN** port 发送 `{ type: "error", data: { code: "STAGE_TYPE_NOT_IMPLEMENTED", message: "..." } }`

#### Scenario: 取消 stage stream

- **WHEN** renderer 调用 `proposal:stageStream:cancel`, 传入 `{ runId }`
- **THEN** main 进程调用对应 `AcpSession.cancel()`
- **AND** 从活跃 session Map 中移除该 runId

### Requirement: Archive 流独立落盘与状态持久化

系统 SHALL 在 `proposal:archive` handler 的 `onReady` 阶段：

1. 校验 `runMeta.status === "done"`，并通过 `getCompletedApplyStageIndex(runMeta)` 找到最后一个完成的 stage 索引 `lastStageIndex`
2. 从 `runMeta.stages[lastStageIndex].agent` 取 `agentId`；若为空字符串、`null` 或 `undefined`，SHALL 抛 `ipcError(IpcErrorCodes.VALIDATION_ERROR, ...)`，SHALL NOT 创建 `AcpSession`、SHALL NOT 写任何 archive 文件
3. 校验 `runMeta.stageAcpSessionIds[lastStageIndex]` 为非空字符串；若不满足，SHALL 抛 `ipcError(IpcErrorCodes.APPLY_SESSION_NOT_READY, ...)`。SHALL NOT 调用 `loadSessionMeta` 来获取该判据，SHALL NOT 调用 `loadSessionMeta` 来获取 `agentId`
4. 通过 `newArchiveFylloSessionId(runMeta.runId)` 生成 archive 阶段使用的 `fylloSessionId`，格式为 `${runId}-archive`。该 id SHALL NOT 复用任何 stage 的 `fylloSessionId`
5. 构造 `ArchiveRunMeta`，结构为 `{ runId: "archive-<timestamp>", changeId, status: "running", startedAt, updatedAt }`，通过 `saveArchiveRunMeta` 写入 `apply-runs/<changeId>/archive.json`。新建时 SHALL NOT 写入 `acpSessionId` 字段（`acpSessionId` 由 `ArchiveAcpSessionStore` 在 ACP newSession 成功后通过字段级更新写入）
6. 构造 archive 的 user message（`role: "user"`，`parts: [{ type: "text", text: prompt }]`），通过 `appendArchiveMessage` 写入 `apply-runs/<changeId>/archive.messages.jsonl`，并通过 sink 发送 `{ kind: "user_message", message }` chunk
7. 构造 `AcpSession` 时传入：
   - `fylloSessionId`：第 4 步生成的 `${runId}-archive`
   - `agentId`：第 2 步从 `runMeta.stages[lastStageIndex].agent` 取得
   - `owner`：`"archive"`
   - **`cwd`**：`runMeta.worktreePath ?? projectPath`
   - **`projectPath`**：始终为主仓库路径
   - `sessionStore`：`ArchiveAcpSessionStore` 实例（构造参数 `(projectPath, changeId)`）
   - **`reminderContext`**：`{ changeId, runId: archiveRunId, worktreePath: runMeta.worktreePath }`。`worktreePath` 字段允许为 `undefined`
   - `onReminderInjected` 钩子：调用 `prependReminderToLastUserMessage(<archive.messages.jsonl 的绝对路径>, reminderPart)`，把 reminder text part pre-pend 到刚落盘的 user 消息 `parts` 首位；钩子 SHALL NOT 通过 sink 推送 `user_message` chunk
8. 使用 `MessageAssembler` 收集 assistant 事件；`done` 时 `flush()` → `appendArchiveMessage` → 更新 `archive.json` 的 `status` 为 `"done"` 与 `updatedAt`
9. 若 `AcpSession` emit `error`，更新 `archive.json` 的 `status` 为 `"error"` 后再通过 sink 发送错误 chunk

archive 的持久化路径 SHALL 与 stage 完全解耦：不写入 `stage-*.messages.jsonl`，不修改 `run.json` 的 `stages` 数组，不读写 `sessions/` 目录下的任何文件。

`ArchiveAcpSessionStore` 在 `AcpSession.start` 期间被调用：

- `loadAcpSessionId()`：调用 `loadArchiveRunMeta(projectPath, changeId)`，返回 `meta?.acpSessionId ?? null`
- `persistAcpSessionId(acpSessionId)`：调用 `updateArchiveRunAcpSessionId(projectPath, changeId, acpSessionId)`，进行字段级更新，仅修改 `acpSessionId` 与 `updatedAt`，不覆盖 `runId / status / startedAt`

`ArchiveRunMeta` 的 `acpSessionId` 字段 SHALL 为可选 `string`；旧 archive.json 文件缺该字段时 SHALL 视为 `undefined`，`AcpSession` 据此走 `connection.newSession()` 路径并触发 reminder 注入。

**事件白名单（archive stream handler）**：`proposal:archive` 的事件判定 SHALL 将 `text_delta`、`reasoning_delta`、`tool_call_start`、`tool_call_update` 四类事件分派到 "assembler.apply(ev) + toMessageChunk(ev) + sink.sendChunk(chunk)" 组合。对 `available_commands_update` 事件 SHALL 显式忽略：不调用 assembler、不 sendChunk、不写磁盘、不修改 `archive.json`。其余事件（`session_info_update` / `done` / `error`）按既有逻辑处理。

#### Scenario: Archive 流启动时初始化 meta 与 user 消息

- **WHEN** `proposal:archive` handler 的 `onReady` 执行
- **THEN** 主进程从 `runMeta.stages[lastStageIndex].agent` 读取 `agentId`，从 `runMeta.stageAcpSessionIds[lastStageIndex]` 读取 apply 就绪标记
- **AND** 不调用 `loadSessionMeta`
- **AND** 通过 `newArchiveFylloSessionId(runMeta.runId)` 生成独立的 archive `fylloSessionId`
- **AND** 写入 `archive.json`（status: "running"）
- **AND** 落盘 archive user message 到 `archive.messages.jsonl`
- **AND** 通过 sink 发送 `user_message` chunk
- **AND** 启动 `AcpSession`（owner 为 `"archive"`，sessionStore 为 `ArchiveAcpSessionStore`）

#### Scenario: archive cwd 使用 worktreePath

- **WHEN** ApplyRunMeta.worktreePath 为非空字符串
- **AND** 用户触发 `proposal:archive`
- **THEN** `AcpSession` 创建参数 `cwd === ApplyRunMeta.worktreePath`
- **AND** `archive.json` 与 `archive.messages.jsonl` 仍写入 `data/projects/<encode(主仓库 projectPath)>/apply-runs/<changeId>/`（持久化路径不随 worktree 变化）

#### Scenario: 旧 ApplyRunMeta archive fallback

- **WHEN** ApplyRunMeta.worktreePath 为 `undefined`（P1 阶段全部场景）
- **AND** 用户触发 archive
- **THEN** `AcpSession` 创建参数 `cwd === projectPath`
- **AND** 行为完全等价于本能力引入前

#### Scenario: archive reminderContext 携带 worktreePath

- **WHEN** archive 阶段 `AcpSession` 创建并触发 system-reminder 注入流程
- **THEN** ctx 含 `worktreePath` 字段（值可能为 `undefined`）
- **AND** ctx 同时含 `changeId`、`runId`

#### Scenario: Archive 启动校验 stage 是否就绪

- **WHEN** `proposal:archive` 被调用，但 `runMeta.stageAcpSessionIds[lastStageIndex]` 缺失或为空字符串
- **THEN** 主进程抛 `ipcError(IpcErrorCodes.APPLY_SESSION_NOT_READY, ...)`
- **AND** 不创建 `AcpSession`
- **AND** 不调用 `loadSessionMeta` 进行兜底检查

#### Scenario: Archive 启动校验 stage agent 存在

- **WHEN** `proposal:archive` 被调用，但 `runMeta.stages[lastStageIndex].agent` 为空字符串、null 或 undefined
- **THEN** 主进程抛 `ipcError(IpcErrorCodes.VALIDATION_ERROR, ...)`，错误 message 包含 stage 索引信息
- **AND** 不创建 `AcpSession`
- **AND** 不写入任何 archive 文件

#### Scenario: Archive 首次运行触发 reminder 注入

- **WHEN** archive `AcpSession.start` 调用 `sessionStore.loadAcpSessionId()` 返回 `null`（archive.json 缺 `acpSessionId`）
- **AND** 系统调用 `connection.newSession()` 成功返回
- **AND** `resolveSystemReminder({ owner: "archive", ... })` 返回非 null 的 `TextUIPart`
- **THEN** 主进程调用 `await sessionStore.persistAcpSessionId(newAcpSessionId)`，archive.json 的 `acpSessionId` 被字段级更新
- **AND** 在 `try/catch` 中 `await onReminderInjected(reminderPart)`；成功时磁盘上 `archive.messages.jsonl` 中最后一条 user 消息的 `parts` 首位被 prepend 为 reminder text part
- **AND** `connection.prompt()` 的 `prompt` 数组首位为 reminder part，次位为 user text block

#### Scenario: Archive 不写 sessions 目录

- **WHEN** archive 流的整个生命周期内（启动、运行、done、error）
- **THEN** 主进程不创建、不修改 `data/projects/<encoded>/sessions/` 目录下的任何文件
- **AND** 不调用 `loadSessionMeta` / `upsertSessionMeta` / `saveSessionMeta`

#### Scenario: Archive 流透传 reasoning_delta

- **WHEN** archive 执行中 `AcpSession` emit `reasoning_delta` 事件
- **THEN** main 进程调用 `assembler.apply(ev)`（按 reasoning 轨道合并到当前 assistant message）
- **AND** 通过 sink 发送 `{ type: "chunk", data: { kind: "reasoning_delta", text } }`

#### Scenario: Archive 流忽略 available_commands_update

- **WHEN** archive 执行中 `AcpSession` emit `available_commands_update` 事件
- **THEN** main 进程不调用 `assembler.apply(ev)`
- **AND** 不通过 sink 发送任何 chunk
- **AND** 不修改 `archive.json`
- **AND** 不写任何磁盘文件

#### Scenario: Archive 正常完成

- **WHEN** `AcpSession` emit `done` 事件
- **THEN** 主进程调用 `assembler.flush()` 得到完整 assistant `UIMessage<MessageMeta>`（可能含 reasoning / text / dynamic-tool 各类 part）
- **AND** 通过 `appendArchiveMessage` 将该消息追加到 `archive.messages.jsonl`
- **AND** 更新 `archive.json` 的 `status` 为 `"done"`，更新 `updatedAt`，保留 `acpSessionId`
- **AND** 通过 sink 发送 `{ type: "done" }`

#### Scenario: Archive 执行出错

- **WHEN** `AcpSession` emit `error` 事件
- **THEN** 主进程更新 `archive.json` 的 `status` 为 `"error"`，更新 `updatedAt`，保留 `acpSessionId`
- **AND** 通过 sink 发送 `{ type: "error", data: { code, message } }`
