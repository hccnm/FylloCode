## Why

当前 chat 流式状态以全局 active run 管理，`414df085 fix(chat): archive initial chat stop handling` 为修复 setup 期 stop 而让非当前 run 的回调直接丢弃。用户从 `ChatSidebar` 切换到其他 session 时会清理当前 UI 状态并使原 run 失效，导致原 session 的主进程仍在工作但 renderer 不再接收/应用后续 chunk，破坏此前可用的多会话并行工作流。

## What Changes

- 恢复 chat 多 session 并行流式接收：切换 session 或进入草稿态只影响当前视图瞬时状态，不取消、不失效其他未停止 session 的 stream。
- 将 chat renderer 状态从单个全局 `activeStreamRunId` / `cancelFn` / `chatStatus` 调整为按 `sessionId` 管理 stream run、cancel、status 和 error；当前视图通过 `activeSessionId` 读取对应状态。
- 保留 setup 期 stop 修复：用户主动 stop 时仍必须让目标 run 失效、关闭/预关闭 MessagePort，并阻止迟到回调继续组装 assistant 消息。
- 为 chat MessagePort handoff 增加每次 stream 调用的 `streamId` 关联，避免多个并发 `chat:stream:message` 共用 `chat:stream:port` 时端口错绑。
- 补充回归测试，覆盖 session A 流式输出中切到 session B 后，session A 继续接收 chunk/done 并更新自身消息、标题、usage、状态；stop 只影响目标 session。
- 不改变 ACP agent 业务逻辑、持久化消息格式、用户可见 IPC 方法名或打包产物路径。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `chat-interface`: chat 页面 SHALL 支持多个 session 的后台流式接收；切换 session 不得让未停止的 session stream 失效；stop 语义改为只取消目标 session/run。
- `ipc-streaming`: chat MessagePort handoff SHALL 使用 `streamId` 将端口准确分发给发起该 stream 的 preload 调用，支持多个 chat stream 并发等待端口。
- `session-management`: 选择 session SHALL 保留其他运行中 session 的后台 stream 更新，不得因切换条目而停止或丢弃其他 session 的消息。

## Impact

- 受影响 renderer：`src/renderer/src/stores/chat.ts`、`src/renderer/src/stores/session.ts`、`src/renderer/src/components/chat/SessionItem.vue`、`src/renderer/src/components/chat/ChatSidebar.vue`、`src/renderer/src/components/chat/ChatContainer.vue`、`src/renderer/src/components/chat/prompt/ChatPromptPanel.vue`。
- 受影响 preload / shared / main IPC：`src/preload/api/chat.ts`、`src/shared/schemas/ipc/chat.ts`、`src/shared/types/channels.ts`（如需类型化 payload）、`src/main/ipc/chat.ts`、`src/main/ipc/_kit/stream-channel.ts`。
- 受影响测试：`test/renderer/src/stores/chat.spec.ts`、`test/renderer/src/stores/session.spec.ts`、`test/renderer/src/components/session-item.spec.ts`、`test/preload/api/chat.spec.ts`、`test/main/ipc/chat.spec.ts` 或 `test/main/ipc/_kit/stream-channel.spec.ts`。
- 相关文档：本次改变 IPC stream 约束和 renderer/session 行为契约；暂不需要更新 repository guidelines，除非实现阶段沉淀出新的通用流式状态管理规则。
