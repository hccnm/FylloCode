## Why

当前 user message 的文本 part 直接完整渲染在消息气泡中。用户粘贴长文本、日志或大段需求时，单条消息会占据过多垂直空间，降低后续对话内容的可扫描性。

本变更为 user message 文本增加默认折叠展示，让长输入在聊天主区域和 Proposal SidePanel 中保持紧凑，同时仍允许用户展开查看完整内容。

## What Changes

- user message 的普通 text part 在内容高度超过阈值时默认折叠，文本容器使用固定最大高度并隐藏溢出内容。
- 被折叠的 user text part 显示展开控制；用户点击后完整展示该 text part，再次点击可收起。
- 未超过阈值的短文本不显示展开/收起控制，保持现有视觉表现。
- system-reminder text part 继续跳过渲染，不参与折叠 UI。
- user 图片缩略图和文件名片渲染保持现状。
- assistant text/reasoning/tool 渲染保持现状，不纳入本次折叠行为。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `chat-interface`: 明确 user message 普通 text part 的长文本折叠、展开/收起交互，以及与 system-reminder、附件和 assistant 消息的边界。

## Impact

- 受影响代码：`src/renderer/src/components/chat/message/UserMessage.vue`。
- 受影响测试：`test/renderer/src/components/shared/ui-message-list.spec.ts`。
- 受影响规范：`openspec/specs/chat-interface/spec.md` 的 delta spec。
- 不涉及 IPC、共享类型、持久化数据、消息组装逻辑、附件读取逻辑或 markdown 渲染通路。
