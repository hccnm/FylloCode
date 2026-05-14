## MODIFIED Requirements

### Requirement: Main 进程在 chat stream done 时组装并持久化 assistant UIMessage

系统 SHALL 在 `chat:stream:message` 的主进程 handler 中维护 `MessageAssembler` 实例（来自 `@main/services/chat/message-assembler`），在 `text_delta` / `reasoning_delta` / `tool_call_start` / `tool_call_update` 事件上调用 `assembler.apply(ev)`，并在收到 `done` 事件时先执行 `assembler.flush()`，将返回的 `UIMessage<MessageMeta>` 通过 `appendMessage` 写入 `sessions/<sessionId>.messages.jsonl`，随后再通过 sink 发送 `done` chunk。落盘失败 SHALL 通过 sink 以 `ACP_ERROR` 归一化抛错，不阻塞 session 注销。

`MessageAssembler.flush()` 产生的 `UIMessage.id` 由主进程自行 `generateId()` 生成，与渲染进程活跃期间使用的临时 id 独立。

`MessageAssembler` 维护三个 active idx：`activeTextPartIdx` / `activeReasoningPartIdx` / （tool 由 `toolCallId` 直接索引，无独立 idx）。reasoning 轨道与 text 轨道互相重置，tool_call_start 同时重置两者。reasoning part 结构为 `{ type: "reasoning", text: string }`，与 AI SDK `ReasoningUIPart` 一致。

#### Scenario: usage_update 透传并实时持久化

- **WHEN** `chat:stream:message` 的 `AcpSession` emit `usage_update` 事件
- **THEN** 主进程直接通过 sink 发送 `{ type: "chunk", data: { kind: "usage_update", used, size, cost } }`
- **AND** 不经过 `MessageAssembler`
- **AND** 立即更新 session 元数据的 `tokenUsage` 为 `{ used, size, cost }` 并调用 `saveSessionMeta` 持久化到磁盘
- **AND** 当 `cost` 不存在时，`tokenUsage.cost` SHALL 保持为 `undefined`

#### Scenario: available_commands_update 透传并持久化

- **WHEN** `chat:stream:message` 的 `AcpSession` emit `available_commands_update` 事件
- **THEN** 主进程直接通过 sink 发送 `{ type: "chunk", data: { kind: "available_commands_update", commands } }`
- **AND** 不经过 `MessageAssembler`
- **AND** 主进程将 `commands` 覆盖写入当前 session meta 的 `available_commands` 字段并调用 `saveSessionMeta` 持久化到磁盘
- **AND** `commands` 为空数组时仍然透传并持久化为空数组
- **AND** 持久化失败 SHALL 记录日志但 SHALL NOT 阻断本次流式响应

#### Scenario: reasoning_delta 进入 MessageAssembler 并透传

- **WHEN** `chat:stream:message` 的 `AcpSession` emit `reasoning_delta` 事件
- **THEN** 主进程调用 `assembler.apply(ev)`，assembler 按 reasoning 轨道规则合并到当前 assistant message 的 `{ type: "reasoning", text }` part
- **AND** 主进程通过 sink 发送 `{ type: "chunk", data: { kind: "reasoning_delta", text } }`

#### Scenario: Stage 正常完成时主进程组装并落盘 assistant 消息

- **WHEN** `chat:stream:message` 的 `AcpSession` emit `done` 事件
- **THEN** 主进程调用 `assembler.flush()` 得到完整 `UIMessage<MessageMeta>`
- **AND** 通过 `appendMessage(projectPath, sessionId, message)` 将该消息写入磁盘
- **AND** 通过 sink 发送 `{ type: "done", data: { totalTokens } }`
- **AND** 更新 session 元数据的 `tokenUsage.used` 字段（累加 `totalTokens`）
- **AND** 保留 session 元数据中已有的 `tokenUsage.cost`
- **AND** 保留 session 元数据中已有的 `available_commands`
- **AND** 从 `sessionRegistry` 注销对应的 `chat` session

#### Scenario: 渲染进程在流中途关闭仍完成 assistant 落盘

- **WHEN** 渲染进程在 chat stream 进行中关闭 MessagePort
- **THEN** 主进程的 `AcpSession` 继续运行
- **AND** `MessageAssembler` 继续累积事件（包括 reasoning_delta）
- **AND** `available_commands_update` 仍会写入当前 session meta 的 `available_commands`
- **AND** `done` 到达时 assistant 消息正常写入 `sessions/<sessionId>.messages.jsonl`，包含 reasoning part

#### Scenario: Assistant 消息落盘失败

- **WHEN** `appendMessage` 抛出异常
- **THEN** 主进程通过 sink 发送 `{ type: "error", data: { code: "ACP_ERROR", message } }`
- **AND** 从 `sessionRegistry` 注销对应的 `chat` session

### Requirement: Session 信息持久化

系统 SHALL 将每个 session 的元数据（含 `acpSessionId`、`agentId`、可选 `available_commands`）持久化到 `getDataSubPath('sessions')/<sessionId>.json`，支持应用重启后恢复 ACP session 上下文和 session 级可用命令列表。

#### Scenario: 首次创建 session 时写入持久化文件

- **WHEN** 新 ACP session 创建成功
- **THEN** 系统在 `getDataSubPath('projects')/<encodeProjectPath(project.path)>/sessions/<sessionId>.json` 写入 `{ sessionId, acpSessionId, agentId, title, turnCount, tokenUsage, createdAt, updatedAt }`
- **AND** `available_commands` 初始缺失
- **AND** `tokenUsage` 初始化为 `{ used: 0, size: 0 }`
- **AND** `tokenUsage.cost` 初始为 `undefined`
- **AND** `encodeProjectPath` 实现为：去掉路径开头的 `/`，将所有 `/` 替换为 `-`

#### Scenario: 应用重启后读取持久化 session

- **WHEN** IPC handler 收到 `chat:stream:message`，且 `getDataSubPath('projects')/<encodeProjectPath(project.path)>/sessions/<sessionId>.json` 存在
- **THEN** 读取文件中的 `acpSessionId` 用于 `resumeSession`
- **AND** 若文件包含 `available_commands`，主进程在构建 `Session` 返回值时将其映射为 `availableCommands`

#### Scenario: available_commands 持久化格式

- **WHEN** 主进程保存 session meta 且当前 session 已收到 commands
- **THEN** session meta JSON 使用 key `available_commands`
- **AND** 其值为 `AcpAvailableCommand[]`
- **AND** 不使用 `availableCommands` 作为落盘 key
