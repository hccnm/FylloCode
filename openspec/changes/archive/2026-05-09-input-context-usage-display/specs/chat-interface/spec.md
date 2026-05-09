## MODIFIED Requirements

### Requirement: 前端 chat store 从流式事件组装 assistant UIMessage

前端 chat store SHALL 在流式过程中实时组装 `role: "assistant"` 的 `UIMessage`，不等待 prompt 完成。ACP 没有"assistant message"的概念，text chunk 和 tool call 均为独立事件，store 负责将它们归并到同一条 assistant message 的 `parts` 数组中。

**组装规则：**

- 收到第一个 `text_delta` 时，若当前无活跃 assistant message，则创建一条新的 `UIMessage`（生成临时 id），追加到 `session.messages`，并记录为 `activeAssistantId`
- 后续 `text_delta` 追加到 `activeAssistantId` 对应消息的 text part
- 收到 `tool_call_start` 时，向 `activeAssistantId` 对应消息追加一个 `dynamic-tool` part（`state: "input-available"`，携带 `toolCallId`、`toolName: title`、`input: {}`）；若当前无活跃 assistant message，先创建一条
- 收到 `tool_call_update`（completed/failed）时，找到对应 `toolCallId` 的 `dynamic-tool` part，更新 `state` 为 `"output-available"`，写入 `output: content`
- 收到 `usage_update` 时，更新 `activeSession.tokenUsage`
- 收到 `done` 时，清空 `activeAssistantId`

**`MessageChunkData` 类型：**

```typescript
type MessageChunkData =
  | { kind: "text_delta"; text: string }
  | { kind: "tool_call_start"; toolCallId: string; title: string; kind: string }
  | {
      kind: "tool_call_update";
      toolCallId: string;
      status: "in_progress" | "completed" | "failed";
      content?: string;
    }
  | {
      kind: "usage_update";
      used: number;
      size: number;
      cost?: { amount: number; currency: string };
    }
  | { kind: "status"; agentStatus: ChatStatus };
```

#### Scenario: 纯文本回复的流式渲染

- **WHEN** 流式过程中连续收到多个 `text_delta`
- **THEN** store 创建一条 assistant UIMessage，每个 delta 追加到其 text part，UI 实时更新

#### Scenario: 含工具调用的回复

- **WHEN** 流式过程中收到 `tool_call_start`，随后收到 `tool_call_update`（completed）
- **THEN** store 向当前 assistant message 追加 `dynamic-tool` part，初始 `state: "input-available"`
- **AND** 收到 completed 后更新该 part 的 `state` 为 `"output-available"`，写入 `output`

#### Scenario: 文本与工具调用交替出现

- **WHEN** 同一轮回复中 `text_delta` 和 `tool_call_start` 交替到达
- **THEN** 所有内容归并到同一条 assistant UIMessage 的 `parts` 数组，顺序与到达顺序一致

#### Scenario: 流式过程中实时更新 token 用量

- **WHEN** 前端收到 `usage_update` chunk，携带 `used` 和 `size`
- **THEN** chat store 更新 `activeSession.tokenUsage.used` 为 `used`
- **AND** 更新 `activeSession.tokenUsage.size` 为 `size`
- **AND** UI 环形进度条实时反映新百分比

#### Scenario: 流式完成后保持 token 用量

- **WHEN** 前端收到 `done` 事件
- **THEN** chat store 不清空 `tokenUsage`，保持当前累计值供后续轮次继续累加

### Requirement: Chat 区域显示可滚动的消息流

系统 SHALL 在中央主区域渲染垂直滚动的消息序列，消息数据类型为 `UIMessage<MessageMeta>`，每条消息通过 `parts` 数组描述内容。

#### Scenario: 消息流渲染

- **WHEN** session 处于活跃状态
- **THEN** Chat 区域按时间顺序显示所有消息，可从上到下滚动
- **AND** 消息类型为 `UIMessage<MessageMeta>`，包含 `metadata.sessionId` 和 `metadata.createdAt`

### Requirement: Chat 侧边栏仅显示 Sessions 标签

系统 SHALL 在 Chat 侧边栏直接渲染 SessionList，不提供标签切换器。

#### Scenario: 侧边栏默认显示 SessionList

- **WHEN** 用户打开 Chat 页面
- **THEN** 侧边栏直接显示 SessionList，无标签切换器
