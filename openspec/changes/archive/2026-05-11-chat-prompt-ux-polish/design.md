## Context

Chat 输入区域（`UChatPrompt` footer slot）包含三个子组件：`ContextUsageRing`、`ChatAgentSelect`、`UChatPromptSubmit`。当前存在三处体验问题：

1. `ChatAgentSelect` 在 session 有消息后被禁用，但仍然渲染，占用视觉空间且传递错误信号
2. `ContextUsageRing` tooltip 中的 token 数值以原始整数展示（如 `12345 / 131072 tokens`），数字过长难以快速阅读
3. `UChatPromptSubmit` 在流式回复过程中无法触发停止，用户只能被动等待

## Goals / Non-Goals

**Goals:**

- `ChatAgentSelect` 在 agent 锁定时完全隐藏（`v-if`）
- `ContextUsageRing` tooltip 中的 token 数值以 k 为单位展示（保留一位小数）
- 点击 `UChatPromptSubmit` 的 stop 按钮时，调用已有 cancel IPC 通道终止流式请求

**Non-Goals:**

- 不处理 reload 事件
- 不新增 IPC 通道（复用 `ChatStreamChannels.streamCancel`）
- 不修改 `UChatPromptSubmit` 组件本身（它已 emit `stop` 事件）

## Decisions

### 1. ChatAgentSelect 用 `v-if` 而非 `:disabled`

`v-if` 完全移除 DOM，避免禁用态的视觉噪音。已有 assistant avatar 在消息列表中提供了 agent 身份标识，隐藏选择器不会丢失信息。

### 2. token 格式化：仅改 tooltip，不改环形图内部

环形图内部显示百分比（`%`），不受影响。tooltip 中的 `Context` 和 `Remaining` 行改用 `formatK`，格式为 `12.3k`。`Cost` 行保持货币格式不变。

### 3. cancel 引用持有位置：`ChatContainer` 本地 ref

`chatApi.streamMessage` 返回一个 cancel 函数。当前 `streamSessionMessage` 在 `chat.ts` store 内调用，cancel 函数未被暴露。

方案：在 `chat.ts` store 中增加 `cancelStream` 方法，内部持有 cancel ref，`ChatContainer` 调用 `store.cancelStream()`。这样 cancel 逻辑与 stream 逻辑同处一处，`ChatContainer` 不需要感知 IPC 细节。

## Risks / Trade-offs

- **cancel 时序**：用户点击 stop 后，主进程可能已在发送最后几个 chunk，`onDone`/`onError` 仍会触发。`AcpSession.cancel()` 已设置 `cancelled` 标志，`onDone` 后 `chatStatus` 会被置为 `ready`，行为正确。
- **k 格式精度**：`0.1k` 表示 100 tokens，最小可读单位为 100 tokens，对于上下文窗口场景足够精确。
