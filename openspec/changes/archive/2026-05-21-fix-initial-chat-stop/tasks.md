## 1. Renderer 的聊天状态

- [x] 1.1 修改 `frontend/src/stores/chat.ts`，让 `sendMessage()` 在异步 session 创建开始前就生成一个 stream run id，并把这个 run id 传给 `streamSessionMessage()`，而不是让 `cancelStream()` 失效后旧 setup 继续往下跑。
- [x] 1.2 修改 `frontend/src/stores/chat.ts#cancelStream`，确保当 `chatStatus` 为 `submitted` 或 `streaming` 时，stop 会调用当前 cancel 函数（如果存在）、使当前 run 失效、清空 `cancelFn`、清空 `streamError`、把 `chatStatus` 设回 `ready`，并在存在 active session 时把该 session 的 `status` 标记为 `ended`。
- [x] 1.3 在 `await sessionStore.createSession(...)` 之后、消息入队、消息持久化和流启动之前增加守卫，确保已取消的 setup 不会重新启动流，也不会再次进入 `submitted`。
- [x] 1.4 确保 `streamSessionMessage()` 的回调继续沿用 run id 守卫，避免已取消 run 的迟到 `onChunk`、`onDone` 和 `onError` 改变 `chatStatus`、设置 `streamError` 或追加 assistant 消息片段。

## 2. preload 的流取消

- [x] 2.1 修改 `electron/preload/api/chat.ts#streamMessage`，把收到的 MessagePort 保存在局部闭包状态中，并让返回的 cancel 函数具备幂等性。
- [x] 2.2 在 `electron/preload/api/chat.ts#streamMessage` 里，让 cancel 调用 `ChatStreamChannels.streamCancel`，并在 MessagePort 已到达时关闭它。
- [x] 2.3 在 `electron/preload/api/chat.ts#streamMessage` 里，若 cancel 发生在 `ChatStreamChannels.streamPort` 到达之前，记录 pending-cancel；等 port 到达后立即关闭，并且不要发送 `{ type: "ready" }`。

## 3. ACP Session 取消

- [x] 3.1 修改 `electron/main/services/chat/acp-session.ts#cancel`，让它保持幂等、始终记录 `cancelled = true`，并且只在 `acpSessionId` 可用时才调用 `connection.cancel(...)`。
- [x] 3.2 在 `electron/main/services/chat/acp-session.ts` 中，补上解析 reminder 之前和 `runPrompt(...)` 之前的取消守卫，确保 prompt 开始前被取消的 setup 不会后续再发出 `connection.prompt(...)`。
- [x] 3.3 在 `electron/main/services/chat/acp-session.ts` 中，对 ACP 进程/Session setup 的各个 await 点补充取消守卫（如 `prepareStartContext`、recovery/new-session 完成、direct prompt/recovery 决策点），确保 setup 期间的取消可以干净退出本轮。

## 4. 测试

- [x] 4.1 在 `frontend/src/__tests__/stores/chat.spec.ts` 增加或更新覆盖：当 `sessionStore.createSession(...)` 仍在 pending 时取消首条消息提交，`chatStatus` 会回到 `ready`，且 `create` promise 结束后不会继续启动流。
- [x] 4.2 在 `frontend/src/__tests__/stores/chat.spec.ts` 增加或更新覆盖：`streamMessage(...)` 已返回 cancel 函数但还没有任何 chunk 时执行取消，取消会被调用，`chatStatus` 会回到 `ready`，且迟到的 `onError` 不会把状态改成 `error`。
- [x] 4.3 为 `electron/preload/api/chat.ts#streamMessage` 增加 preload 测试，覆盖 port 到达后取消和 port 到达前取消两种情况；两者都必须调用 `ChatStreamChannels.streamCancel`，而 port 到达前的情况不能发送 `{ type: "ready" }`。
- [x] 4.4 为 `AcpSession.cancel()` 增加主进程单元测试，覆盖 `acpSessionId` 尚未解析前的取消：取消意图会被记录，且 setup 完成后不会再调用 `connection.prompt(...)`。
- [x] 4.5 先运行 `pnpm test -- frontend/src/__tests__/stores/chat.spec.ts`，或者仓库中等价的定向 Vitest 命令；若通过，再补跑更广的相关测试。
