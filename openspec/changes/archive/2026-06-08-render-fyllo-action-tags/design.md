## Context

当前 assistant 消息在 `src/renderer/src/components/chat/message/AssistantMessage.vue` 中按 AI SDK part 类型分派，text 与 reasoning 都交给 `src/renderer/src/components/shared/MarkStream.vue` 渲染。`MarkStream.vue` 已经向 `markstream-vue` 传入 `custom-id`，而当前安装的 `markstream-vue@1.0.0` 类型和文档支持 `customHtmlTags`、`setCustomComponents(customId, mapping)`、`removeCustomComponents(customId)`、`final` 以及自定义节点上的 `loading?: boolean`。

这次变更要把 `<fyllo-action>` 定义成 ACP Agent 到 FylloCode 的用户确认型入口。它不是 HTML 扩展，也不是 Agent 可自由调用的 tool；它是 FylloCode 解析、校验、渲染并在用户确认后派发的本地协议。

## Goals / Non-Goals

**Goals:**

- 使用 MarkStream/markstream-vue 的自定义组件能力渲染 `<fyllo-action>`。
- 让 action `type`、payload schema、Agent 注入说明、UI 展示和 handler 都由本地定义控制。
- 对流式未闭合标签保持稳定 pending UI，避免半截 JSON 带来闪烁错误。
- 提供第一个 concrete type `task.create`，用户确认后创建本地任务。
- 保持通用 action shell 与 type-specific 展示组件分离；业务执行通过 dispatcher 和现有 store/API 完成。
- 在 Chat session meta 中持久化 action 交互状态，使用户重新进入会话时能看到已完成、失败或已取消状态。

**Non-Goals:**

- 不实现无需用户交互的 MCP server，例如 `fyllo-action` MCP server。
- 不允许 `<fyllo-action>` 带 `version`、`id`、按钮文案、标题等额外 attribute。
- 不允许 Agent 在 payload 中定义按钮、任意组件、IPC channel 或 handler。
- 不在 reasoning part 中挂载可交互 action。
- 不在 Apply / Archive 的 SidePanel 或 workflow stage 输出中启用 `<fyllo-action>`；workflow gate action 以后另行设计。
- 不改变 `UnifiedTask`、task IPC、任务存储文件格式或本地任务列表现有编辑 UI。
- 不持久化 action payload、payload hash、业务 result 或错误详情；session meta 只保存最小 action 状态。

## Decisions

### 1. Protocol

Agent 输出格式固定为：

```xml
<fyllo-action type="task.create">
{"title":"补齐错误处理","description":"来自讨论结论"}
</fyllo-action>
```

规则：

- 标签名固定为 `fyllo-action`。
- 唯一 attribute 是 `type`。缺失、空值、未知值或任何额外 attribute 都是 invalid。
- `type` 必须是本地 action contract 注册表中的精确字符串。初始注册 `task.create`，后续 type 使用同一注册表扩展。
- type 命名约束为小写 domain/action 形式，例如 `task.create`；segment 使用 lower-kebab/camel-free 文本，不允许空格、下划线或自然语言。
- 标签正文必须是严格 JSON object，不允许 Markdown code fence、注释、尾逗号、数组、字符串或裸文本。
- 每个 type 的 JSON schema 必须 strict；未知字段 invalid，除非该 type 的 schema 明确声明允许。

### 2. Shared Contract 与 Renderer Definition 分层

新增 shared contract 作为跨 main/renderer 的协议源：

- `src/shared/types/fyllo-action.ts`：定义 `FylloActionType`、payload 类型映射、parse/validation 状态类型。
- `src/shared/schemas/fyllo-action.ts`：提供 zod schema，例如 `taskCreateFylloActionPayloadSchema`。
- `src/shared/constants/fyllo-action-contracts.ts`：导出启用的 action contract 列表，并提供把 contract 渲染为 Agent system-reminder 文本的纯函数。

Renderer 再新增本地 definition：

- `src/renderer/src/config/fyllo-actions.ts`：基于 shared contract 补充 UI 标题、摘要渲染、图标和 dispatcher type 绑定。
- definition 不提供动态按钮文案；按钮固定为 `确认` / `取消`。

这样 main process 生成 system-reminder 和 renderer 解析 payload 都依赖同一份 type/schema contract，避免“Agent 被注入的 JSON 格式”和“前端实际校验格式”分裂。

### 3. MarkStream 接入

`MarkStream.vue` 新增 `enableActions?: boolean` prop：

- Chat 主会话 assistant text part 传 `true`。
- assistant reasoning part 传 `false`。
- Apply / Archive SidePanel 或其他非 Chat 主会话渲染入口传 `false`。

当启用时：

- 向 `MarkdownRender` 传入 `:custom-html-tags="['fyllo-action']"`。
- 在组件生命周期内调用 `setCustomComponents(props.id, { 'fyllo-action': FylloActionNode })`。
- unmount 或 `id` 变化时调用 `removeCustomComponents(previousId)` 清理 scoped mapping。

自定义节点只从 markstream-vue 的节点 props 读取：

- `node.attrs?.type`
- `node.loading`
- `node.content`
- `node.raw`

解析正文时使用 `String(node.content ?? "").trim()`。当 `node.loading === true` 时不调用 `JSON.parse`，只渲染 pending 状态。流结束后再 parse 和 zod 校验。

### 4. UI 状态与执行边界

`src/renderer/src/components/shared/markstream/FylloActionNode.vue` 负责把 markstream-vue 节点转换为解析结果；在 Chat 主会话传入 action 上下文时生成 action id、读取 persisted action state，并把结果传给 `FylloActionShell.vue`。

`FylloActionShell.vue` 负责通用状态机、固定确认/取消按钮和 action state 持久化：

- `pending`：流式未完成，展示占位内容，确认禁用。
- `invalid`：未知 type、额外 attr、JSON parse 失败或 schema 校验失败，确认禁用，允许取消。
- `ready`：解析成功，展示 FylloCode 定义的标题/摘要和固定确认/取消按钮。
- `running`：用户确认后 handler 执行中，禁用重复点击。
- `succeeded`：handler 成功完成，展示成功状态。
- `failed`：handler 失败，展示错误，允许再次确认重试或取消。
- `cancelled`：用户取消。Chat ready action 写入 session meta；pending/invalid 节点只更新当前渲染状态。

type-specific 展示组件由 `src/renderer/src/config/fyllo-actions.ts` 绑定，初始 `task.create` 使用 `src/renderer/src/components/chat/action/TaskCreateAction.vue` 渲染 payload。展示组件不得 import `window.api`、renderer API wrapper、Pinia store 或 task 业务模块。业务执行放在 `src/renderer/src/composables/useFylloActionDispatcher.ts`，由 node/container 在用户确认时调用。

### 5. Chat action state 持久化

`<fyllo-action>` 暂时只在 Chat 主会话中可交互。Chat session meta 新增最小字段：

```json
{
  "actionStates": {
    "chat:session-1:3:0:0": {
      "type": "task.create",
      "status": "succeeded",
      "updatedAt": "2026-06-08T00:00:00.000Z"
    }
  }
}
```

`actionStates` 的 value 只包含：

- `type`: action type。
- `status`: `"succeeded" | "failed" | "cancelled"`。
- `updatedAt`: ISO 时间戳。

`ready` 不持久化，没有 state 即为 ready。`running` 不持久化，避免应用退出或 renderer 重载后卡在执行中。handler 错误详情可在当前渲染实例展示，但不写入 session meta。

action id 由 Chat transcript 稳定位置生成，不由 Agent 输出，也不使用 markstream-vue 的 `indexKey`：

```text
chat:{sessionId}:{messageIndex}:{partIndex}:{actionOrdinalInPart}
```

- `sessionId`: 当前 Chat session id。
- `messageIndex`: 当前消息在 `session.messages` 中按持久化顺序的位置。
- `partIndex`: assistant text part 在该消息 `parts` 中的位置。
- `actionOrdinalInPart`: 当前 text part 内第几个 `<fyllo-action>`，按源码出现顺序从 0 开始。

`FylloActionShell` 在用户点击 `确认` 后调用 dispatcher。dispatcher 返回成功时，shell 统一写入 `{ type, status: "succeeded", updatedAt }`；dispatcher 返回失败或抛错时，shell 统一写入 `{ type, status: "failed", updatedAt }` 并允许用户重试；用户点击 `取消` 时，shell 写入 `{ type, status: "cancelled", updatedAt }`。

只有 Chat 主会话中已经解析为 ready、具备注册 type 和 action id 的节点才写入 `actionStates`。pending、invalid 或非 Chat 渲染入口不写 session meta。

状态写入失败不得回滚已完成的业务副作用。例如 `task.create` 已创建任务但 action state 写入失败时，当前 UI 仍显示 handler 成功，同时可展示状态保存失败提示。

### 6. 初始 task.create 行为

初始支持的 action type：

```json
{
  "title": "string, non-empty",
  "description": "string, optional"
}
```

确认后 dispatcher 调用 `useTaskStore().createTask()`：

- `title` 透传。
- `description` 转为 `{ "format": "plain_text", "content": description ?? "" }`。
- 不直接调用 `window.api.task`。
- 没有当前项目或 task store 抛错时，卡片进入 `failed`，展示错误并允许重试/取消。

### 7. System Reminder 注入

`resolveChatSystemReminder(ctx)` 在渲染现有 `chat.txt` 后追加 `<fyllo-action>` 协议说明，说明内容由 shared action contracts 生成。注入文本必须包含：

- 标签格式。
- 只允许 `type` 一个 attr。
- 允许的 type 枚举。
- 每个 type 的 JSON payload schema 和示例。
- 不允许 Agent 定义按钮、version、id、handler 或额外字段。
- 仅在用户与 Agent 讨论出需要 FylloCode 端侧确认的结果后，在 assistant 可见回复中输出。

不修改 apply/archive reminder；这次入口只服务 Chat stage 中的 ACP Agent 与用户讨论结果。

## Risks / Trade-offs

- `markstream-vue` 的自定义节点类型来自第三方库，未来版本可能调整字段名。缓解：parser 对 `node.loading`、`attrs`、`content` 做防御性读取，并用组件测试锁定当前集成行为。
- system-reminder 注入内容和前端 schema 一旦分裂，Agent 输出会不稳定。缓解：把 action contract 放在 shared，main 和 renderer 都从同一来源读取。
- action card 嵌入 assistant Markdown 后可能出现在 reasoning 中。缓解：只在 assistant text part 启用 `enableActions`，reasoning part 保持普通 Markdown 渲染。
- 用户多次点击确认可能重复创建任务。缓解：`running` 状态禁用重复点击，`succeeded` 后不再允许再次确认；失败态才允许 retry。
- 后续 type 可能需要更复杂的字段或确认 UI。缓解：type-specific schema 和 summary renderer 放在 definition 中扩展，按钮文案仍保持 FylloCode 固定控制。
- action state 不保存 payload hash，依赖已落盘 Chat 历史消息顺序稳定。该取舍保持 session meta 简单；手工改写历史消息或未来消息编辑不在本 proposal 内处理。
