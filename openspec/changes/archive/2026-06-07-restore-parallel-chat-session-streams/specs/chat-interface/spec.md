## MODIFIED Requirements

### Requirement: UChatPromptSubmit 支持停止流式回复

系统 SHALL 在当前选中 session 的 `chatStatus` 为 `streaming` 或 `submitted` 时，响应 `UChatPromptSubmit` 的 `stop` 事件，并调用该 session 对应的 cancel 函数终止当前流式请求。

当 stop 作用于当前选中 session 的活跃提交时，前端 SHALL 同步完成该 session 的 UI 收口：使该 session 的当前 run 失效、清空该 session 的 cancel 控制、清空该 session 的流式瞬时错误，并将当前视图 `chatStatus` 设为 `ready`。这个状态回退 SHALL NOT 依赖后续 `onDone` 或 `onError` 回调。

系统 SHALL 只忽略已被 stop 取消、被同一 session 更新 run 取代，或仍处于草稿 setup 且已被取消的提交的迟到 `onChunk`、`onDone`、`onError` 回调，避免 cancelled run 重新把 `chatStatus` 改回 `streaming`、`ready` 或 `error`，也避免 cancelled run 继续组装 assistant 消息。系统 SHALL NOT 因用户切换到其他 session、进入草稿态或清理当前视图瞬时错误，而忽略其他未停止 session 的后续 stream 回调。

系统 SHALL 支持新会话首条消息的 setup 期停止：当首条消息已经进入 `submitted`，但 ACP agent 还没有完成连接、session 创建/恢复，或者还没有返回任何 chunk/done/error 时，用户点击 stop 后输入框状态 SHALL 回到 `ready`，且该 setup 期请求 SHALL 被取消或失效。

同时，系统 SHALL 将 chat 页面流式错误作为 session 级瞬时状态维护，并在聊天主区域只渲染当前选中 session 的流式错误；这个错误状态 SHALL NOT 写入 `Session` 的持久模型，且 SHALL 在选择其他 session、进入草稿态、开始该 session 新一轮发送、用户停止该 session 当前提交或完成清理时从当前视图复位。

本 requirement 不要求回滚已经排入内存或已经持久化的 user message，也不要求重放未送达 ACP 的历史消息。

#### Scenario: 用户点击 stop 按钮

- **WHEN** 当前选中 session 的 `chatStatus` 为 `streaming` 或 `submitted`
- **AND** 用户点击 `UChatPromptSubmit` 的 stop 按钮
- **THEN** 前端调用该 session 当前 run 的 cancel 函数，通过 `ChatStreamChannels.streamCancel` IPC 通道通知主进程取消
- **AND** 前端立即使该 session 的当前提交失效
- **AND** 当前视图 `chatStatus` 立即回到 `ready`
- **AND** 该 session 的流式瞬时错误被清空

#### Scenario: 新会话首条消息在 ACP setup 期停止

- **WHEN** 新会话首条消息发送后 `chatStatus` 为 `submitted`
- **AND** ACP agent 尚未完成连接、session 创建/恢复，或尚未返回任何 chunk/done/error
- **AND** 用户点击 stop 按钮
- **THEN** 前端使该提交失效并将 `chatStatus` 设置为 `ready`
- **AND** 后续来自该提交的迟到回调不再改变 `chatStatus`
- **AND** 后续来自该提交的迟到回调不再追加 assistant 消息

#### Scenario: 停止已失效提交后迟到错误被忽略

- **WHEN** 用户停止当前选中 session 的当前提交，`chatStatus` 已回到 `ready`
- **AND** 被停止的提交随后触发 `onError`
- **THEN** 前端不将当前视图 `chatStatus` 改为 `error`
- **AND** 前端不展示该迟到错误作为当前流式错误

#### Scenario: 切换 session 不使后台流失效

- **WHEN** session A 正在流式输出
- **AND** 用户选择 session B 或点击新建 session 进入草稿态
- **THEN** 前端不得使 session A 的当前 run 失效
- **AND** session A 后续收到的 `onChunk` 继续更新 session A 的内存消息、标题、usage、可用命令、配置选项和计划状态
- **AND** session A 后续收到的 `onDone` 将 session A 状态更新为 `ended`

#### Scenario: 无活跃流时 stop 无效

- **WHEN** 当前选中 session 的 `chatStatus` 为 `ready` 或 `error`
- **THEN** stop 事件不触发 cancel 调用

## ADDED Requirements

### Requirement: chat store 按 session 管理流式运行态

渲染进程 chat store SHALL 按 `sessionId` 维护每个已建立 session 的流式运行态，至少包含该 session 当前 run 标识、`ChatStatus`、cancel 函数和流式瞬时错误。当前页面暴露给组件的 `chatStatus`、`streamError` 和 `cancelFn` SHALL 从 `useSessionStore.activeSessionId` 对应的 session 运行态派生；当前处于草稿态或当前 session 没有运行态时，`chatStatus` SHALL 回落为 `ready`，`streamError` 和 `cancelFn` SHALL 回落为 `null`。

每个 `streamMessage` 回调 SHALL 通过 `sessionId + runId` 判断是否仍属于该 session 的当前有效 run。未被 stop 取消且未被同一 session 更新 run 取代的回调 SHALL 更新其所属 session，即使该 session 当前未被选中。已被 stop 取消或被同一 session 更新 run 取代的回调 SHALL 被忽略，并不得继续组装 assistant 消息。

#### Scenario: 两个 session 并行接收 chunk

- **WHEN** session A 与 session B 各自存在有效的运行中 stream
- **AND** 当前选中 session 为 B
- **AND** session A 的 stream 收到 `{ kind: "text_delta", text: "hello" }`
- **THEN** session A 的 `messages` 追加或更新 assistant 消息
- **AND** session B 的 `messages` 不被修改
- **AND** 当前视图 `chatStatus` 仍反映 session B 的状态

#### Scenario: 后台 session 完成

- **WHEN** 当前选中 session 为 B
- **AND** session A 的有效 stream 收到 `onDone({ totalTokens })`
- **THEN** session A 的 assistant 临时消息被收口
- **AND** session A 的 `status` 更新为 `ended`
- **AND** session A 的 `tokenUsage.used` 按完成事件更新
- **AND** 当前视图不展示 session A 的完成状态作为 session B 的状态

#### Scenario: 同一 session 的已取消 run 不再追加 assistant

- **WHEN** session A 的 run-1 已被用户 stop 取消
- **AND** run-1 随后收到 `text_delta` 或 `onDone`
- **THEN** renderer 忽略该回调
- **AND** session A 不追加来自 run-1 的 assistant 消息
