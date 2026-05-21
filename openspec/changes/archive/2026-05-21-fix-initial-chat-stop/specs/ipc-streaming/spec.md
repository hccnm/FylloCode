## MODIFIED Requirements

### Requirement: 流式 API 封装为回调式接口

Preload 暴露给 renderer 的流式 API SHALL 采用回调式接口，renderer 不直接接触 MessagePort 对象。

Preload 返回的 cancel 函数 SHALL 是幂等的。调用 cancel 时，preload SHALL 调用对应的 stream cancel IPC 通道通知 main 进程，并关闭当前 MessagePort（如果已经收到）。如果 cancel 发生在 MessagePort 到达 preload 之前，preload SHALL 记录 pending cancel；当后续收到 MessagePort 时，preload SHALL 立即关闭该 port，且 SHALL NOT 发送 `{ type: "ready" }` 启动业务流。

#### Scenario: 流式 API 签名

- **WHEN** renderer 使用流式聊天功能
- **THEN** 调用签名为 `streamMessage(sessionId, prompt, { onChunk, onDone, onError })`
- **AND** 返回一个 `cancel()` 函数用于中断流式传输

#### Scenario: 取消流式传输

- **WHEN** 用户在流式输出过程中点击停止
- **THEN** renderer 调用 `cancel()` 函数
- **AND** preload 关闭 port 并通知 main 中断 AI 调用

#### Scenario: port 到达前取消流式传输

- **WHEN** renderer 已调用流式 API 并获得 cancel 函数
- **AND** MessagePort 尚未到达 preload
- **AND** renderer 调用 cancel 函数
- **THEN** preload 记录 pending cancel 并通知 main 中断 AI 调用
- **AND** MessagePort 后续到达时被立即关闭
- **AND** preload 不发送 `{ type: "ready" }`
