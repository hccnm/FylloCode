## Why

用户在多轮对话中无法感知当前 session 已消耗的上下文 token 量，难以判断何时需要开启新 session 避免上下文溢出。在输入框区域显示实时 context 消耗信息，帮助用户做出更明智的会话管理决策。

## What Changes

- 在 `ChatContainer.vue` 输入框区域（`UChatPrompt` footer slot）新增 context 消耗指示器，以环形进度条展示当前 used/size 百分比
- 新增 ACP `usage_update` 事件处理链路：主进程 `acp-mapper.ts` 映射为 `SessionEvent`，通过流式通道实时推送给渲染进程
- 将 token 消耗从 chat store 迁移到 session store：`Session` 对象新增 `tokenUsage` 字段，chat store 移除 `tokenUsage` ref
- **每收到 `usage_update` 即更新 session 元数据并持久化到磁盘**，确保 usage 信息实时落盘
- 加载 session 时从 meta 文件恢复历史 token 用量

## Capabilities

### New Capabilities

- `input-context-usage-display`: 在输入框区域显示当前 session 的实时 context 消耗信息

### Modified Capabilities

- `acp-chat-backend`: 新增 `usage_update` 事件映射；`SessionEvent` 新增 `usage_update` 类型；流式通道支持推送 usage 增量；收到 usage_update 时实时持久化到 session meta
- `chat-interface`: chat store 移除 `tokenUsage` ref，改为从 `activeSession.tokenUsage` 读取；流式回调新增 `usage_update` 处理
- `session-management`: session 元数据新增 `tokenUsage` 字段，每次 usage_update 实时持久化到磁盘，加载 session 时恢复；token 消耗归属从 chat store 迁移到 session store

## Impact

- **前端**: `ChatContainer.vue`（新增环形进度条 UI 组件）、`stores/chat.ts`（移除 tokenUsage ref，新增 usage_update 回调）、`stores/session.ts`（新增 tokenUsage 字段管理）
- **主进程**: `session-events.ts`（新增 usage_update 类型）、`acp-mapper.ts`（新增 usage_update 映射）、`ipc/chat.ts`（usage_update 透传 + 实时持久化）、`services/chat/session-store.ts`（元数据持久化扩展）
- **共享类型**: `shared/types/chat.ts`（`TokenUsage` 扩展，`Session` 扩展）、`shared/types/ipc.ts`（`MessageChunkData` 新增 usage_update kind）
- **ACP 协议**: 消费 ACP `usage_update` 事件 `{ cost: { amount, currency }, size, used, sessionUpdate: "usage_update" }`
