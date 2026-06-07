## 1. Renderer Session 级流式状态

- [x] 1.1 修改 `src/renderer/src/stores/chat.ts`，用 `streamStateBySessionId: Map<string, ChatSessionStreamState>` 或等价结构替代全局 `activeStreamRunId` / `cancelFn` 单点控制；新增 `isCurrentSessionRun(sessionId, runId)`，确保有效后台回调按所属 session 更新。
- [x] 1.2 在 `src/renderer/src/stores/chat.ts` 保留或重建组件消费的 `chatStatus`、`streamError`、`cancelFn` 派生值，使其只反映 `useSessionStore().activeSessionId` 对应 session；草稿态或无运行态时回落为 `ready` / `null`。
- [x] 1.3 修改 `sendMessage(parts)` 与 `streamSessionMessage(...)`，让已有 session 的 stream run 绑定到该 session id；`onChunk`、`onDone`、`onError` 在 session 未选中时仍更新该 session 的 `messages`、`title`、`tokenUsage`、`availableCommands`、`configOptions`、`plan`、`status` 和排序。
- [x] 1.4 保留草稿首条消息 setup 期 stop 行为：在 `createSession` 尚未 resolve 时允许 `cancelStream()` 使 pending draft run 失效；resolve 后不得 queue user message、不得 `persistMessage`、不得 `chatApi.streamMessage`。
- [x] 1.5 修改 `cancelStream()`，只取消当前 active session 的 stream run 或当前 pending draft run；不得清空其他 session 的 cancel/error/status，也不得让其他 session 的 run 失效。
- [x] 1.6 修改 `resetChatState()` 或拆出新的 view reset action，并更新 `src/renderer/src/components/chat/SessionItem.vue`、`src/renderer/src/components/chat/ChatSidebar.vue` 调用点，使选择 session / 新建草稿只清当前视图瞬时错误，不取消、不失效后台 session stream。

## 2. Chat MessagePort streamId 绑定

- [x] 2.1 修改 `src/shared/schemas/ipc/chat.ts` 的 `streamMessageInputSchema`，为 `chat:stream:message` 入参增加必填非空 `streamId`；同步必要的 shared/preload 类型声明。
- [x] 2.2 修改 `src/main/ipc/_kit/stream-channel.ts`，为 `makeStreamChannel` 增加可选 port payload（默认 `null`），并在 `event.sender.postMessage(portChannel, payload, [port2])` 中使用；保持 proposal/apply/archive 流未传 payload 时行为不变。
- [x] 2.3 修改 `src/main/ipc/chat.ts`，从 `streamMessageInputSchema` 读取 `streamId`，调用 `makeStreamChannel({ ..., portPayload: { streamId } })` 或等价参数，确保 main 发送的 `chat:stream:port` 事件携带同一个 streamId。
- [x] 2.4 修改 `src/preload/api/chat.ts`，每次 `chatApi.streamMessage(...)` 生成 renderer 进程内唯一 `streamId`，invoke `ChatStreamChannels.streamMessage` 时携带该值。
- [x] 2.5 修改 `src/preload/api/chat.ts`，用模块级 pending stream registry 和共享 `ipcRenderer.on(ChatStreamChannels.streamPort, ...)` dispatcher 替代每次调用的无条件 `ipcRenderer.once(...)`；按事件 payload 的 `streamId` 绑定端口、发送 ready、处理 pending cancel，并关闭未匹配端口。

## 3. 回归测试

- [x] 3.1 在 `test/renderer/src/stores/chat.spec.ts` 增加测试：session A stream 已启动后切到 session B，调用 session A 的 callbacks `onChunk(text_delta)` 仍追加 session A assistant 消息，且当前视图状态仍反映 session B。
- [x] 3.2 在 `test/renderer/src/stores/chat.spec.ts` 增加测试：session A 在后台收到 `onDone({ totalTokens })` 后，session A `status` 为 `ended`、usage 更新、assistant message 收口；切回 session A 时可看到后台完成内容。
- [x] 3.3 在 `test/renderer/src/stores/chat.spec.ts` 增加测试：stop 当前 session 后，该 session 迟到 chunk/error 被忽略；另一个 session 的有效 stream 继续接收 chunk。
- [x] 3.4 更新 `test/renderer/src/components/session-item.spec.ts`，将“点击 session 会 reset transient state”断言调整为“不取消/不失效后台 stream，仅切换 active session 并清当前视图错误”。
- [x] 3.5 在 `test/preload/api/chat.spec.ts` 增加并发端口测试：两个 `streamMessage` 调用生成不同 `streamId`，`chat:stream:port` 乱序到达时分别绑定正确 callbacks；未匹配 streamId 的 port 被关闭。
- [x] 3.6 在 `test/main/ipc/chat.spec.ts` 或 `test/main/ipc/_kit/stream-channel.spec.ts` 增加测试：`chat:stream:message` main handler 传递的 port payload 包含入参 `streamId`；`makeStreamChannel` 默认 payload 为 `null` 时不影响现有流。

## 4. 验证与文档

- [x] 4.1 运行 `pnpm vitest run test/renderer/src/stores/chat.spec.ts test/renderer/src/components/session-item.spec.ts test/preload/api/chat.spec.ts`，确认多 session 和 preload 并发端口回归测试通过。
- [x] 4.2 运行 `pnpm vitest run test/main/ipc/chat.spec.ts test/main/ipc/_kit/stream-channel.spec.ts`（按实际测试文件存在情况调整），确认 main stream payload 和既有 stream-channel 行为通过。
- [x] 4.3 运行 `pnpm typecheck` 与 `pnpm lint`，确认 shared schema、preload、renderer store 和 main IPC 类型一致。
- [x] 4.4 评估是否需要更新 `guidelines/IPC.md` 或 `guidelines/RendererProcess.md`：如果实现后将 `streamId` dispatcher 或 session 级 stream state 作为长期模式沉淀，补充对应 guideline；若仅为 chat 局部实现，则无需更新 guideline。
