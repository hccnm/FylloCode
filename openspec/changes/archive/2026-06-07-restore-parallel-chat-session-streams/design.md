## Context

当前 renderer chat store 使用单个全局 `activeStreamRunId` 判断 stream 回调是否仍有效，并用单个 `cancelFn`、`chatStatus`、`streamError` 表示当前 chat 页面状态。`SessionItem.handleSelect()` 会调用 `chatStore.resetChatState()`，该 action 当前会让全局 run id 增加；因此运行中的 session A 在用户切到 session B 后，A 的 `onChunk` / `onDone` / `onError` 都会因为 `!isCurrentStreamRun(streamRunId)` 被丢弃。

`414df085 fix(chat): archive initial chat stop handling` 的目标是正确处理“首条消息 setup 阶段 stop 后迟到回调不能继续污染 UI 或追加 assistant 消息”。这个修复本身需要保留，但它把“主动 stop/cancel”与“切换 session 清当前视图错误状态”都建模成同一种全局 run 失效，造成多会话并行回归。

preload 还有一个并发隐患：每次 `chatApi.streamMessage()` 都对同一个 `chat:stream:port` 注册 `ipcRenderer.once(...)`。当多个 chat stream 同时启动并等待端口时，第一个 port 事件可能被多个 once listener 消费，或被错误的 stream 回调绑定。需要为 chat stream 的 port handoff 增加每次调用的关联标识。

## Goals / Non-Goals

**Goals:**

- 切换 session 或进入草稿态不取消、不失效其他 session 的运行中 stream。
- 用户主动 stop 时只取消目标 session/run，并保持 setup 期 stop 的迟到回调防护。
- renderer 能同时接收多个 session 的 chunk/done/error，并把内容写入各自 session 的内存态。
- preload 能把每个 `chat:stream:port` MessagePort 准确交给对应的 `streamMessage()` 调用。
- 保持主进程 `AcpSession`、`MessageAssembler`、assistant 落盘逻辑不做业务语义重写。

**Non-Goals:**

- 不支持同一个 session 内同时发起多条 prompt；同 session 新 run 可以取代或拒绝旧 run，具体以当前 UI 能力为准。
- 不改变 `Session` 持久化文件格式、assistant 消息落盘位置或 ACP session recovery 语义。
- 不把 proposal/apply/archive 流式状态迁移到同一套 chat session 状态模型。
- 不引入新的外部依赖。

## Decisions

### 1. 按 session 管理 stream 状态，而不是恢复全局 run

实现阶段应在 `src/renderer/src/stores/chat.ts` 中引入 session 级运行态，例如 `streamStateBySessionId: Ref<Map<string, ChatSessionStreamState>>`。状态至少包含：

- `runId: number`
- `status: ChatStatus`
- `cancel: (() => void) | null`
- `error: StreamError | null`

`sendMessage()` 在已有 session 中发送时，为该 `session.id` 创建新的 run；回调通过 `isCurrentSessionRun(sessionId, runId)` 判断是否仍属于该 session 的当前 run。有效的后台 chunk 必须继续调用该 session 对应的 `useUIMessageAssembler(ref(session.messages), { sessionId })`，并更新该 session 的 title、usage、commands、configOptions、plan 和 status。

当前 UI 仍可暴露兼容的 `chatStatus`、`streamError`、`cancelFn`，但它们应成为基于 `useSessionStore().activeSessionId` 的 computed/派生状态：当前选中 session 有 stream 状态时返回该状态；没有时返回 `ready` / `null`。这样 `ChatContainer`、`ChatPromptPanel` 只显示当前 session 的状态，后台 session 通过 session item 的 running indicator 和自身 messages 保持更新。

备选方案是保留全局 run 并在 `resetChatState()` 不再 invalidate。该方案无法处理“session A 运行中，切到 session B 后发送新消息”场景，因为 B 的 `sendMessage()` 仍会创建新的全局 run 并让 A 失效，所以不采用。

### 2. 区分 view reset 与 explicit stop

`resetChatState()` 或其替代 action 只应清理当前视图的瞬时 error/status 展示，不应让任何未停止 session 的 run 失效，也不应清空后台 session 的 cancel 函数。`SessionItem.handleSelect()` 和 `ChatSidebar.handleCreateSession()` 应使用这个“视图清理”语义。

`cancelStream()` 才执行取消语义：找到当前 active session 的 stream state，失效该 session 的 run，调用该 run 的 `cancel()`，清空该 session 的 cancel/error，并把该 session 状态设为 `ready`/`ended`。如果处于首条消息 createSession 尚未完成的草稿 setup 期，则取消的是 pending draft run：使 pending run 失效，后续 createSession resolve 后不得 queue user message、不得调用 `chatApi.streamMessage()`。

备选方案是在切换 session 时直接调用 cancel。该方案会把“查看别的会话”等同于停止后台工作，违背多会话并行目标，所以不采用。

### 3. 用 streamId 绑定 chat MessagePort

`src/preload/api/chat.ts` 每次执行 `chatApi.streamMessage(...)` 时生成一个不透明 `streamId`，将其加入 `ChatStreamChannels.streamMessage` invoke payload。`src/main/ipc/chat.ts` 校验并把该 `streamId` 传给 `makeStreamChannel`，`makeStreamChannel` 在 `event.sender.postMessage(portChannel, payload, [port2])` 中发送 `{ streamId }`。

preload 不再为每次调用注册一个无条件 `ipcRenderer.once(ChatStreamChannels.streamPort, ...)`。应改为模块级 dispatcher：维护 `pendingStreamsByStreamId`，对 `ChatStreamChannels.streamPort` 使用一个共享 `ipcRenderer.on` listener，读取事件 payload 的 `streamId` 后把端口交给对应 pending stream。未匹配 streamId 的 port 应关闭并记录警告，避免泄漏。

`ChatStreamChannels.streamCancel` 主进程取消仍以 `sessionId` 为准，因为系统不支持同一 session 同时多个 prompt；preload 本地关闭端口时使用 `streamId` 精准关闭对应 port。这样可以最小化对 main 业务和 shared cancel schema 的影响。

备选方案是为每个 stream 创建动态 port channel 名称。该方案会扩散 channel 命名、shared constants 和测试复杂度，不符合当前 `domain:action` channel 集中定义约束，所以不采用。

### 4. 后台流更新内存态，不依赖切回时重读磁盘

主进程已经在 done/error/cancel 出口负责 assistant 落盘；renderer 仍应在收到 chunk 时更新对应 session 的内存消息。`useSessionStore.selectSession()` 对已加载 session 继续可以跳过磁盘读取，但前提是后台 stream 持续维护了该 session 的 `messages`。如果目标 session 从未加载过消息，选择时仍按现有逻辑从磁盘加载。

备选方案是在每次切回 running/ended session 时强制 reload messages。该方案会制造与正在组装的 assistant 临时消息的合并问题，也会增加 IO；本次优先修复回调丢弃，让内存态保持最新。

## Risks / Trade-offs

- 同一 session 内重复发送可能覆盖旧 run → 实现阶段应保持或明确禁止同 session 并发发送；测试至少覆盖“旧 run 被同 session stop/新 run 失效后迟到回调不追加 assistant”。
- `chatStatus` 从 ref 变为 computed/派生状态可能影响测试赋值方式 → 更新测试只通过 action 和 stream callbacks 驱动状态，不直接写 `chatStatus`。
- preload dispatcher 是模块级状态，测试需要在 `vi.resetModules()` 后隔离 pending map → `test/preload/api/chat.spec.ts` 应覆盖多个 pending stream 端口乱序到达。
- `makeStreamChannel` 增加可选 port payload 后会影响 proposal/apply/archive 流 → 默认 payload 保持 `null`，只让 chat handler 传 `{ streamId }`，并用现有 proposal 流测试确认兼容。
