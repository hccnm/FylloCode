## MODIFIED Requirements

### Requirement: UChatPromptSubmit 支持停止流式回复

系统 SHALL 在 `chatStatus` 为 `streaming` 或 `submitted` 时，响应 `UChatPromptSubmit` 的 `stop` 事件，并调用 cancel 函数终止当前流式请求。

当 stop 作用于当前活跃提交时，前端 SHALL 同步完成 UI 收口：使当前提交失效、清空当前 cancel 控制、清空当前流式瞬时错误，并将 `chatStatus` 设为 `ready`。这个状态回退 SHALL NOT 依赖后续 `onDone` 或 `onError` 回调。

系统 SHALL 忽略已失效提交的迟到 `onChunk`、`onDone`、`onError` 回调，避免 cancelled run 重新把 `chatStatus` 改回 `streaming`、`ready` 或 `error`，也避免 cancelled run 继续组装 assistant 消息。

系统 SHALL 支持新会话首条消息的 setup 期停止：当首条消息已经进入 `submitted`，但 ACP agent 还没有完成连接、session 创建/恢复，或者还没有返回任何 chunk/done/error 时，用户点击 stop 后输入框状态 SHALL 回到 `ready`，且该 setup 期请求 SHALL 被取消或失效。

同时，系统 SHALL 将 chat 页面当前流式错误作为 chatStore 的瞬时状态维护，并在聊天主区域可见渲染；这个错误状态 SHALL NOT 写入 `Session` 的持久模型，且 SHALL 通过统一 reset action 在切换会话、开始新一轮发送、用户停止当前提交或完成清理时复位。

本 requirement 不要求回滚已经排入内存或已经持久化的 user message，也不要求重放未送达 ACP 的历史消息。

#### Scenario: 用户点击 stop 按钮

- **WHEN** `chatStatus` 为 `streaming` 或 `submitted`
- **AND** 用户点击 `UChatPromptSubmit` 的 stop 按钮
- **THEN** 前端调用 cancel 函数，通过 `ChatStreamChannels.streamCancel` IPC 通道通知主进程取消
- **AND** 前端立即使当前提交失效
- **AND** `chatStatus` 立即回到 `ready`
- **AND** 当前流式瞬时错误被清空

#### Scenario: 新会话首条消息在 ACP setup 期停止

- **WHEN** 新会话首条消息发送后 `chatStatus` 为 `submitted`
- **AND** ACP agent 尚未完成连接、session 创建/恢复，或尚未返回任何 chunk/done/error
- **AND** 用户点击 stop 按钮
- **THEN** 前端使该提交失效并将 `chatStatus` 设置为 `ready`
- **AND** 后续来自该提交的迟到回调不再改变 `chatStatus`
- **AND** 后续来自该提交的迟到回调不再追加 assistant 消息

#### Scenario: 停止已失效提交后迟到错误被忽略

- **WHEN** 用户停止当前提交，`chatStatus` 已回到 `ready`
- **AND** 被停止的提交随后触发 `onError`
- **THEN** 前端不将 `chatStatus` 改为 `error`
- **AND** 前端不展示该迟到错误作为当前流式错误

#### Scenario: 无活跃流时 stop 无效

- **WHEN** `chatStatus` 为 `ready` 或 `error`
- **THEN** stop 事件不触发 cancel 调用
