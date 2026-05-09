## MODIFIED Requirements

### Requirement: ACP sessionUpdate 映射为 SessionEvent

系统 SHALL 将 ACP `session/update` notification 映射为 `SessionEvent` 联合类型，通过 MessagePort 推送给渲染进程。

ACP 的 tool call 是独立的一等公民事件（不依附于某条 assistant message），因此不使用旧的 `message_upsert`/`message_patch` 模式，改为直接映射 ACP tool call 语义的新事件类型。

**`SessionEvent` 联合类型定义：**

```typescript
type SessionEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; toolCallId: string; title: string; kind: string }
  | {
      type: "tool_call_update";
      toolCallId: string;
      status: "in_progress" | "completed" | "failed";
      content?: string;
    }
  | {
      type: "usage_update";
      used: number;
      size: number;
      cost?: { amount: number; currency: string };
    }
  | { type: "done"; totalTokens: number }
  | { type: "error"; code: string; message: string }
  | { type: "session_id_resolved"; acpSessionId: string };
```

#### Scenario: 文本流式输出

- **WHEN** ACP 推送 `sessionUpdate === "agent_message_chunk"` 且 `content.type === "text"`
- **THEN** 通过 MessagePort 发送 `{ type: "chunk", data: { kind: "text_delta", text } }`

#### Scenario: 工具调用开始

- **WHEN** ACP 推送 `sessionUpdate === "tool_call"` 且 `status === "pending"`
- **THEN** 通过 MessagePort 发送 `{ type: "chunk", data: { kind: "tool_call_start", toolCallId, title, kind } }`

#### Scenario: 工具调用进度或完成

- **WHEN** ACP 推送 `sessionUpdate === "tool_call_update"`，`status` 为 `"in_progress"`、`"completed"` 或 `"failed"`
- **THEN** 通过 MessagePort 发送 `{ type: "chunk", data: { kind: "tool_call_update", toolCallId, status, content } }`
- **AND** `content` 为 `tool_call_update.content` 中所有 text 类型 ContentBlock 的拼合文本（无 content 时为 `undefined`）

#### Scenario: usage_update 实时推送

- **WHEN** ACP 推送 `sessionUpdate === "usage_update"`
- **THEN** 通过 MessagePort 发送 `{ type: "chunk", data: { kind: "usage_update", used, size, cost } }`
- **AND** `used`、`size`、`cost` 直接透传 ACP 推送的原始值

#### Scenario: prompt 完成

- **WHEN** `connection.prompt` 返回（`stopReason` 为 `"end_turn"` 或其他终止原因）
- **THEN** 通过 MessagePort 发送 `{ type: "done", data: { totalTokens } }`
- **AND** 关闭 port1

#### Scenario: ACP 通信异常

- **WHEN** `connection.prompt` 抛出异常或 ACP 进程不可用
- **THEN** 通过 MessagePort 发送 `{ type: "error", data: { code: "ACP_ERROR", message } }`
- **AND** 关闭 port1

### Requirement: Main 进程在 chat stream done 时组装并持久化 assistant UIMessage

系统 SHALL 在 `chat:stream:message` 的主进程 handler 中维护 `MessageAssembler` 实例（来自 `@main/services/chat/message-assembler`），在 `text_delta` / `tool_call_start` / `tool_call_update` 事件上调用 `assembler.apply(ev)`，并在收到 `done` 事件时先执行 `assembler.flush()`，将返回的 `UIMessage<MessageMeta>` 通过 `appendMessage` 写入 `sessions/<sessionId>.messages.jsonl`，随后再通过 sink 发送 `done` chunk。落盘失败 SHALL 通过 sink 以 `ACP_ERROR` 归一化抛错，不阻塞 session 注销。

`MessageAssembler.flush()` 产生的 `UIMessage.id` 由主进程自行 `generateId()` 生成，与渲染进程活跃期间使用的临时 id 独立。

#### Scenario: usage_update 透传并实时持久化

- **WHEN** `chat:stream:message` 的 `AcpSession` emit `usage_update` 事件
- **THEN** 主进程直接通过 sink 发送 `{ type: "chunk", data: { kind: "usage_update", used, size, cost } }`
- **AND** 不经过 `MessageAssembler`
- **AND** 立即更新 session 元数据的 `tokenUsage` 为 `{ used, size, cost }` 并调用 `saveSessionMeta` 持久化到磁盘
- **AND** 当 `cost` 不存在时，`tokenUsage.cost` SHALL 保持为 `undefined`

#### Scenario: Stage 正常完成时主进程组装并落盘 assistant 消息

- **WHEN** `chat:stream:message` 的 `AcpSession` emit `done` 事件
- **THEN** 主进程调用 `assembler.flush()` 得到完整 `UIMessage<MessageMeta>`
- **AND** 通过 `appendMessage(projectPath, sessionId, message)` 将该消息写入磁盘
- **AND** 通过 sink 发送 `{ type: "done", data: { totalTokens } }`
- **AND** 更新 session 元数据的 `tokenUsage.used` 字段（累加 `totalTokens`）
- **AND** 保留 session 元数据中已有的 `tokenUsage.cost`
- **AND** 从 `sessionRegistry` 注销对应的 `chat` session

### Requirement: Session 信息持久化

系统 SHALL 将每个 session 的元数据（含 `acpSessionId`、`agentId`）持久化到 `getDataSubPath('sessions')/<sessionId>.json`，支持应用重启后恢复 ACP session 上下文。

#### Scenario: 首次创建 session 时写入持久化文件

- **WHEN** 新 ACP session 创建成功
- **THEN** 系统在 `getDataSubPath('projects')/<encodeProjectPath(project.path)>/sessions/<sessionId>.json` 写入 `{ sessionId, acpSessionId, agentId, title, turnCount, tokenUsage, createdAt, updatedAt }`
- **AND** `tokenUsage` 初始化为 `{ used: 0, size: 0 }`
- **AND** `tokenUsage.cost` 初始为 `undefined`
- **AND** `encodeProjectPath` 实现为：去掉路径开头的 `/`，将所有 `/` 替换为 `-`
