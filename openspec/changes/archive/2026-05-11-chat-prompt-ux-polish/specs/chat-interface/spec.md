## MODIFIED Requirements

### Requirement: Chat 区域显示可滚动的消息流

系统 SHALL 在中央主区域渲染垂直滚动的消息序列，消息数据类型为 `UIMessage<MessageMeta>`，每条消息通过 `parts` 数组描述内容。

#### Scenario: 消息流渲染

- **WHEN** session 处于活跃状态
- **THEN** Chat 区域按时间顺序显示所有消息，可从上到下滚动
- **AND** 消息类型为 `UIMessage<MessageMeta>`，包含 `metadata.sessionId` 和 `metadata.createdAt`

### Requirement: ChatAgentSelect 在 agent 锁定时隐藏

系统 SHALL 在 `ChatContainer.vue` 的 `UChatPrompt` footer slot 中，当 session 已有消息（agent 锁定）时，完全隐藏 `ChatAgentSelect` 组件，不渲染禁用态。

#### Scenario: 新 session 或草稿态显示 Agent 选择器

- **WHEN** 用户处于草稿态（无活跃 session）或活跃 session 尚无消息
- **THEN** `ChatAgentSelect` 正常显示，用户可选择 agent

#### Scenario: session 有消息后隐藏 Agent 选择器

- **WHEN** 活跃 session 的消息数量大于 0（agent 已锁定）
- **THEN** `ChatAgentSelect` 不渲染（`v-if="!isAgentLocked"`）
- **AND** 不显示禁用态的选择器

### Requirement: UChatPromptSubmit 支持停止流式回复

系统 SHALL 在 `chatStatus` 为 `streaming` 或 `submitted` 时，响应 `UChatPromptSubmit` 的 `stop` 事件，调用 cancel 函数终止当前流式请求。

#### Scenario: 用户点击 stop 按钮

- **WHEN** `chatStatus` 为 `streaming` 或 `submitted`
- **AND** 用户点击 `UChatPromptSubmit` 的 stop 按钮
- **THEN** 前端调用 cancel 函数，通过 `ChatStreamChannels.streamCancel` IPC 通道通知主进程取消
- **AND** `chatStatus` 最终回到 `ready`（由 `onDone` 或 `onError` 回调处理）

#### Scenario: 无活跃流时 stop 无效

- **WHEN** `chatStatus` 为 `ready` 或 `error`
- **THEN** stop 事件不触发 cancel 调用
