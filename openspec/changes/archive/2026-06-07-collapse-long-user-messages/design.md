## Context

`src/renderer/src/components/chat/message/UserMessage.vue` 当前直接用 `<p>` 渲染 `isTextUIPart(part) && !isSystemReminderPart(part)` 命中的 user text part。该组件由 `ChatMessageList.vue` 在 chat 主区域和 Proposal SidePanel 的共享消息列表中复用，因此改动会同时影响两个场景。

现有 `chat-interface` 规范约束 user 分支继续通过 `isUserImagePart`、`isUserFilePart`、`isTextUIPart` 和 `isSystemReminderPart` 派发；本变更只改变普通 user text part 的展示状态，不改变数据层 `message.parts`、附件分派或 assistant 渲染。

## Goals / Non-Goals

**Goals:**

- 给普通 user text part 增加长文本默认折叠和展开/收起交互。
- 保持短文本、system-reminder 跳过、图片缩略图和文件名片的现有行为。
- 让实现不依赖持久化字段或跨组件全局状态，状态只属于当前 `UserMessage.vue` 实例。
- 补充组件测试覆盖折叠控制、展开/收起，以及 system-reminder 与附件不受影响。

**Non-Goals:**

- 不折叠 assistant text、reasoning、tool output 或 markdown 内容。
- 不改变 `UIMessage` / `MessageMeta` / IPC schema / 存储格式。
- 不新增用户偏好设置，也不记忆每条消息的展开状态。
- 不把用户 text 改成 markdown 渲染。

## Decisions

- 在 `UserMessage.vue` 内部实现折叠状态，而不是新增 store 或修改 `ChatMessageList.vue`。原因是折叠只影响 user text part 的局部展示，不需要跨会话、跨页面或持久化。
- 每个可见 text part 使用由 `message.id`、`part.type` 和 `index` 组成的稳定 key 管理展开状态，避免同一 user message 含多个 text part 时互相影响。
- 使用 DOM 高度检测判断是否需要显示展开控制：文本容器默认设置 `max-height` 与 `overflow-hidden`，挂载和消息内容变化后比较 `scrollHeight` 与 `clientHeight`。这样短文本不会出现无意义按钮，长文本才显示控制。
- 推荐最大高度使用 Tailwind arbitrary value，例如 `max-h-40` 或 `max-h-[10rem]`，并保留当前气泡样式类：`whitespace-pre-wrap wrap-anywhere relative text-pretty px-4 py-3 rounded-lg min-h-12 bg-elevated/50 border border-default`。Apply 阶段可根据实际视觉选择等价 token，但必须是固定最大高度。
- 展开/收起控制使用 `UButton` 或语义化 `button`，文案为 `展开` / `收起`，并通过 `aria-expanded` 表达状态。控制应贴近对应文本气泡，不影响图片或文件卡片。

## Risks / Trade-offs

- DOM 高度检测在测试环境中不会自动计算真实布局。测试需要通过 mock `scrollHeight` / `clientHeight` 或直接验证类名、按钮状态与点击行为，避免依赖浏览器真实排版。
- 在 `content-visibility:auto` 的消息行中，离屏消息可能延迟完成实际布局。实现应在 `nextTick` 后检测，并在展开/收起时重新计算当前 part；不需要为离屏元素引入全局 observer。
- 如果只按字符数判断是否折叠，多行短字符或长单词场景会误判。高度检测更贴近真实 UI，但实现稍复杂。
