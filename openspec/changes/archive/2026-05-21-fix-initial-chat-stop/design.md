## Context

`ChatPromptPanel.vue` 会把 `chatStatus` 传给 `UChatPromptSubmit`，因此当 `chatStatus` 为 `submitted` 或 `streaming` 时，stop 按钮可见。对新会话的首条消息来说，chat store 会在 ACP 流完全建立之前先把 `chatStatus` 设成 `submitted`。当前的 `cancelStream()` 只会调用现有 `cancelFn`，不会自己回收状态，也不会使后续异步流程失效。

`electron/preload/api/chat.ts` 虽然从 `streamMessage()` 返回了 cancel 函数，但这个函数只会调用 `ChatStreamChannels.streamCancel`，不会关闭 MessagePort；而 `ipc-streaming` 本身已经要求 renderer 取消时要关闭端口并通知 main。如果 cancel 和流初始化抢时序，main 可能会错过这次取消，因为 chat 的 `AcpSession` 还未注册完成。

`AcpSession.cancel()` 目前会记录 `cancelled = true`，但如果 `acpSessionId` 仍然是 `null`，它就会直接返回，不会接触 ACP。start 流里虽然有部分取消检查，但还需要明确的防线，确保 setup 阶段发生的取消不会继续推进到 `connection.prompt(...)`。

## Canonical Stop Path

这次改动只允许一条停止链路，顺序必须保持一致：

1. renderer 的 `cancelStream()` 失效当前 run，并把 `chatStatus` 设回 `ready`
2. preload 的 `cancel()` 关闭 MessagePort，并通过 `ChatStreamChannels.streamCancel` 通知 main
3. main 的 `streamCancel` 和 port close 都要收敛到当前 chat turn 的 `AcpSession.cancel()`
4. `AcpSession.cancel()` 记录 `cancelled = true`
5. `AcpSession.start()` 在所有 setup await 之后、`connection.prompt(...)` 之前检查 `cancelled`
6. 已取消 run 的迟到回调必须被忽略

实现时不得新增另一条“看起来等价”的 stop 路径；如果某一层收到了 stop，但下一层还没准备好，就必须把取消意图传递下去，而不是让旧 run 继续走完。

## Goals / Non-Goals

**Goals:**

- 在 `submitted` 状态点击 stop 时，当前提交必须立即回到 `ready`。
- 当用户停止新会话的首条消息、且 ACP 还没有发出任何 chunk、done 或 error 时，取消也必须生效。
- 已取消流的迟到回调不能把过期的 `submitted`、`streaming` 或 `error` 状态恢复回来。
- preload 的取消在可能时关闭流端口，并支持端口尚未到达时的取消。
- ACP setup 的取消必须幂等，并阻止已取消的 setup 之后继续发起 prompt。

**Non-Goals:**

- 不回滚、不删除、不重放已经排队或已经持久化的用户消息。
- 不重做聊天消息持久化，也不引入按消息粒度的送达状态。
- 除非实现必须复用共享流原语，否则不改变 proposal/apply/archive 的流行为。

## Decisions

- **把 run 失效作为 renderer 的事实来源。** `sendMessage()` 需要在异步 session 创建开始之前创建或复用一个 submission run id；`cancelStream()` 需要推进当前 active run id。旧 run 后续的任何继续动作，都必须在排队/持久化消息、启动流或处理回调之前直接 no-op。

- **停止时乐观回收 UI 状态。** 对 setup 期的取消来说，等待 `onDone` 或 `onError` 不够，因为提前关闭端口或注册表没命中时，未必会有终态回调。`cancelStream()` 应同步清掉 `cancelFn`、清掉瞬时流错误、在有 active session 时标记结束，并把 `chatStatus` 设回 `ready`。

- **preload 取消时主动关闭 MessagePort。** `chatApi.streamMessage()` 返回的 cancel 函数应当幂等。它既要调用 `ChatStreamChannels.streamCancel`，也要关闭已经收到的 port；如果在 `chat:stream:port` 到达前就被调用，则需要记录 pending-cancel，等 port 到达时直接关闭，而不是发送 `{ type: "ready" }`。

- **在 session id 未解析前，ACP 取消只能尽力而为。** `AcpSession.cancel()` 必须始终把实例标记成已取消。`acpSessionId` 不可用时，start 流必须在各个 setup await 之后、且在发送 `connection.prompt(...)` 之前检查 `cancelled`。如果取消后才拿到 ACP session id，可以尽力调用 `connection.cancel(...)` 做清理，但不能再为这个已取消的 run 发起新的 prompt。

## Risks / Trade-offs

- **风险：即使 ACP 没收到该 turn，持久化的用户消息仍可能保留** -> 缓解：本次明确把消息历史一致性排除在范围外，与用户收缩后的目标保持一致。
- **风险：立即重置 UI 会掩盖迟到的流错误** -> 缓解：通过 run id 检查忽略已取消 run 的回调，避免过期工作把错误重新暴露出来。
- **风险：在 ready 前关闭 port 会影响时序敏感测试** -> 缓解：补充 cancel-before-port 和 cancel-after-port 的定向测试，并保持取消幂等。
