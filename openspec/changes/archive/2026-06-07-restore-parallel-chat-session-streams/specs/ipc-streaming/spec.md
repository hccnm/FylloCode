## MODIFIED Requirements

### Requirement: AI 聊天流式输出使用 MessagePort 通信

AI 聊天的流式响应 SHALL 通过 MessagePort 传输。Preload SHALL 为每次 `window.api.chat.streamMessage(...)` 调用生成一个不透明且在当前 renderer 进程内唯一的 `streamId`，并在 `chat:stream:message` invoke payload 中传给 main。Main 进程创建 `MessageChannelMain` 后，SHALL 将 port2 通过 `postMessage` 传递给 renderer，并在该 port 事件 payload 中携带同一个 `streamId`；preload SHALL 只把该 MessagePort 绑定到 `streamId` 匹配的 pending stream，在 port1 上逐 chunk 推送数据。

#### Scenario: 发起流式聊天

- **WHEN** renderer 调用 `window.api.chat.streamMessage(sessionId, prompt, callbacks)`
- **THEN** preload 生成 `streamId`
- **AND** preload 调用 `ipcRenderer.invoke('chat:stream:message', { sessionId, prompt, streamId, ... })` 发起流式请求
- **AND** main 创建 MessagePort 并通过 `event.sender.postMessage('chat:stream:port', { streamId }, [port2])` 传递给 renderer
- **AND** preload 将该 port 绑定到相同 `streamId` 的 callbacks

#### Scenario: 多个 chat stream 端口乱序到达

- **WHEN** preload 已发起 stream A 与 stream B，分别生成 `streamId: "A"` 和 `streamId: "B"`
- **AND** main 先发送 `{ streamId: "B" }` 的 `chat:stream:port`
- **THEN** preload 只为 stream B 注册该 port 的 `onmessage`
- **AND** stream A 的 callbacks 不会收到 stream B 的 chunk/done/error

#### Scenario: 流式完成

- **WHEN** AI 服务完成响应
- **THEN** main 通过 port1 发送 `{ type: 'done', data: { totalTokens: number } }`
- **AND** 关闭 port1
- **AND** preload 层调用该 `streamId` 对应的 `callbacks.onDone(data)` 回调
- **AND** preload 清理该 `streamId` 的 pending stream 记录

#### Scenario: 流式错误

- **WHEN** AI 服务返回错误
- **THEN** main 通过 port1 发送 `{ type: 'error', data: { code: string, message: string } }`
- **AND** 关闭 port1
- **AND** preload 层调用该 `streamId` 对应的 `callbacks.onError(error)` 回调
- **AND** preload 清理该 `streamId` 的 pending stream 记录

### Requirement: 流式 API 封装为回调式接口

Preload 暴露给 renderer 的流式 API SHALL 采用回调式接口，renderer 不直接接触 MessagePort 对象。Chat 流式 API 的 `streamId` SHALL 是 preload/main 的内部关联标识，不要求暴露给 renderer 组件或 store。

Preload 返回的 cancel 函数 SHALL 是幂等的。调用 cancel 时，preload SHALL 调用对应的 stream cancel IPC 通道通知 main 进程，并关闭当前 `streamId` 绑定的 MessagePort（如果已经收到）。如果 cancel 发生在 MessagePort 到达 preload 之前，preload SHALL 记录该 `streamId` 的 pending cancel；当后续收到匹配 `streamId` 的 MessagePort 时，preload SHALL 立即关闭该 port，且 SHALL NOT 发送 `{ type: "ready" }` 启动业务流。

Preload SHALL 使用共享 dispatcher 或等价机制处理 `chat:stream:port`，不得为每次 chat stream 调用注册一个无条件消费下一个 port 事件的 `ipcRenderer.once(ChatStreamChannels.streamPort, ...)` 监听器。未匹配任何 pending stream 的 chat stream port SHALL 被关闭。

#### Scenario: 流式 API 签名

- **WHEN** renderer 使用流式聊天功能
- **THEN** 调用签名为 `streamMessage(sessionId, prompt, { onChunk, onDone, onError })`
- **AND** 返回一个 `cancel()` 函数用于中断流式传输
- **AND** renderer 组件和 store 不需要直接传入或读取 `streamId`

#### Scenario: 取消流式传输

- **WHEN** 用户在流式输出过程中点击停止
- **THEN** renderer 调用 cancel 函数
- **AND** preload 关闭该 `streamId` 对应的 port 并通知 main 中断 AI 调用

#### Scenario: port 到达前取消流式传输

- **WHEN** renderer 已调用流式 API 并获得 cancel 函数
- **AND** MessagePort 尚未到达 preload
- **AND** renderer 调用 cancel 函数
- **THEN** preload 记录该 `streamId` 的 pending cancel 并通知 main 中断 AI 调用
- **AND** 匹配该 `streamId` 的 MessagePort 后续到达时被立即关闭
- **AND** preload 不发送 `{ type: "ready" }`

#### Scenario: 未匹配 streamId 的 port 被关闭

- **WHEN** preload 收到 `chat:stream:port` 事件
- **AND** 事件 payload 中的 `streamId` 不存在于 pending stream registry
- **THEN** preload 关闭该 MessagePort
- **AND** 不调用任何 stream callbacks
