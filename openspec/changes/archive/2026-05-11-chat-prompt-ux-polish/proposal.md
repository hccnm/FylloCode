## Why

Chat 输入区域存在三处体验问题：Agent 选择器在锁定时仍可见但被禁用（视觉冗余）；token 用量以原始数字展示（数字过大难以快速阅读）；流式回复过程中无法主动停止（用户被动等待）。

## What Changes

- `ChatAgentSelect`：当 `isAgentLocked` 为 true 时，直接隐藏组件，不再渲染禁用态的选择器
- `ContextUsageRing`：tooltip 中的 token 数值改为以 k 为单位（保留一位小数），如 `12.3k / 128.0k tokens`
- `UChatPromptSubmit` + `ChatContainer`：在 `chatStatus` 为 `streaming` 或 `submitted` 时，点击提交按钮触发 stop 事件，前端调用 `chatApi.streamMessage` 返回的 cancel 函数终止流式请求

## Capabilities

### New Capabilities

无

### Modified Capabilities

- `chat-interface`：`ChatAgentSelect` 的可见性规则从"禁用"改为"隐藏"
- `input-context-usage-display`：token 数值展示格式从原始整数改为 k 单位（保留一位小数）

## Impact

- `frontend/src/components/chat/ChatContainer.vue`：移除 `:disabled` prop，改为 `v-if` 控制 `ChatAgentSelect` 可见性；持有 cancel 函数引用，处理 `@stop` 事件
- `frontend/src/components/chat/ContextUsageRing.vue`：新增 `formatK` 函数，替换 tooltip 中的 `formatNumber` 调用
- `frontend/src/stores/chat.ts`：暴露 cancel 能力，或由 `ChatContainer` 直接持有 cancel 引用
- 不涉及 IPC 新增，使用已有 `ChatStreamChannels.streamCancel` 通道
