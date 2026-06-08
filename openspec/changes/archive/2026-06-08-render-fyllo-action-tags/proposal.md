## Why

ACP Agent 在流式回复中只能输出文本，FylloCode 目前缺少一个稳定、可校验、需要用户确认的交互入口，用来把讨论结果转成端侧动作。`<fyllo-action>` 标签可以把这类意图从普通 Markdown 中结构化出来，同时保留 FylloCode 对 UI、确认按钮、schema 校验和最终执行的控制权。

## What Changes

- 在 assistant 可见文本中支持 `<fyllo-action type="...">` 自定义标签，标签只允许 `type` 一个 attribute，正文为严格 JSON object。
- 新增 Fyllo action contract/definition 机制：`type` 必须来自本地注册表，payload schema、Agent 注入说明、UI 摘要和 handler 都由 FylloCode 定义，Agent 不得自由发明。
- 通过 `markstream-vue` 的 `customHtmlTags`、`custom-id`、`setCustomComponents` 和 `removeCustomComponents` 接入自定义渲染组件，不在消息层做字符串扫描。
- 流式输出过程中遇到未闭合 `<fyllo-action>` 时只展示 pending 状态，不提前解析 JSON；流结束后再解析和 schema 校验。
- action card 使用 FylloCode 固定的 `确认` / `取消` 操作，不支持 Agent 通过 attr 或 payload 定义动态按钮。
- 初始支持 `task.create` action type：用户确认后通过现有 renderer task store 创建本地任务；实现必须走通用 dispatcher，不能在 MarkStream 自定义节点里硬编码任务创建。
- `<fyllo-action>` 暂时只在 Chat 主会话中启用，不向 Apply / Archive 的 SidePanel 或 workflow stage 输出扩展。
- Chat 会话中的 action 交互状态持久化到 session meta 的 `actionStates` 字段，重新进入会话时回显已确认、已取消或失败状态。
- chat system-reminder 注入 `<fyllo-action>` 协议和每个启用 type 的 JSON payload 说明，注入内容来自 shared action contract，避免和前端校验漂移。

## Capabilities

### New Capabilities

- `fyllo-action-tags`: 定义 ACP Agent 在 assistant 文本中输出 `<fyllo-action>` 的协议、解析状态、UI 交互和初始 `task.create` type 行为。

### Modified Capabilities

- `chat-interface`: assistant 可见 text part 的 Markdown 渲染需要识别并渲染 `<fyllo-action>`，reasoning part 不得挂载可交互 action。
- `system-reminder-injection`: chat owner 的 system-reminder 需要注入 `<fyllo-action>` 协议和 action type payload contract。
- `session-meta-storage`: chat session meta 需要新增 `actionStates` 字段，并通过字段级 patch 保留其他 meta 字段。

## Impact

- 影响 renderer Markdown 渲染入口：`src/renderer/src/components/shared/MarkStream.vue`、`src/renderer/src/components/chat/message/AssistantMessage.vue`。
- 新增 renderer action 组件、parser、definition 和 dispatcher：`src/renderer/src/components/shared/markstream/**`、`src/renderer/src/components/chat/action/TaskCreateAction.vue`、`src/renderer/src/utils/fyllo-action.ts`、`src/renderer/src/config/fyllo-actions.ts`、`src/renderer/src/composables/useFylloActionDispatcher.ts`。
- 新增 shared action contract 和 schema：`src/shared/types/fyllo-action.ts`、`src/shared/schemas/fyllo-action.ts`、`src/shared/constants/fyllo-action-contracts.ts`。
- 影响 chat system-reminder 生成：`src/main/services/chat/system-reminder/providers/chat.ts` 及其测试。
- 新增 chat action state 持久化 IPC，复用 `session-store.ts#patchSessionMeta` 字段级更新；不改变本地任务存储格式。
