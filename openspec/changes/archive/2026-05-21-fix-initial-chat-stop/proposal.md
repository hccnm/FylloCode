## Why

当用户在 ACP agent 还没连上、还没创建/恢复 ACP session，或者还没发出第一条流式回调之前点击停止时，新会话会卡在 `submitted`。界面虽然提供了 stop，但当前取消链路会和流式初始化抢时序，导致输入框没有及时回到 `ready`。

## What Changes

- 让 `submitted` 状态下的停止行为确定化，覆盖首条消息在 ACP 输出前的 setup 窗口。
- 当当前提交被停止时，立即把聊天输入状态恢复为 `ready`，不再等待可能根本不会到达的 `onDone` 或 `onError`。
- 采用一条唯一的 stop 链路：renderer 失效当前 run，preload 关闭 MessagePort 并通知 main，main 再通过 `sessionRegistry` / `AcpSession` 收口 setup 和 prompt。
- 让 preload 的流取消函数在关闭 MessagePort 的同时，继续调用 `ChatStreamChannels.streamCancel`，并支持端口尚未到达时的 pending cancel。
- 让 ACP 聊天取消在 `acpSessionId` 还没解析出来时也保持幂等，避免后续 setup 继续把请求推进到未取消的 prompt。
- 将消息历史一致性问题留在本次范围之外：这次改动不回滚已经排队或已经持久化的用户消息。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `chat-interface`：`submitted` 下的 stop 必须同步把输入状态恢复为 `ready`，并使当前提交失效，包括首条消息的 ACP setup。
- `ipc-streaming`：即使取消发生在 MessagePort 到达 preload 之前，流取消也必须关闭或预关闭 MessagePort。
- `acp-chat-backend`：ACP chat session 的取消必须能在 ACP session id 还未解析时安全执行，并阻止已取消的 setup 继续发起 prompt。

## Impact

- `frontend/src/stores/chat.ts`：补充提交 run 跟踪，以及 stop 时的乐观状态回收。
- `electron/preload/api/chat.ts`：让流取消具备幂等性，能关闭 MessagePort 或记住取消直到端口到达。
- `electron/main/services/chat/acp-session.ts`：在 prompt 开始前加入取消防线，并在 `acpSessionId` 仍为空时保持幂等取消。
- `frontend/src/__tests__/stores/chat.spec.ts` 及相关 Electron/preload/main-process 测试。
