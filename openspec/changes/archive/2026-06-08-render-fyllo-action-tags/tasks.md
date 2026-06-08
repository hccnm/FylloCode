## 1. Shared Contract

- [x] 1.1 新增 `src/shared/types/fyllo-action.ts`，定义 `FylloActionType`、`TaskCreateActionPayload`、`FylloActionPayloadByType`、解析状态类型和 handler 结果类型；从 `src/shared/types/index.ts` 导出这些类型。
- [x] 1.2 新增 `src/shared/schemas/fyllo-action.ts`，使用 zod 定义 `taskCreateFylloActionPayloadSchema`，要求 `title` 为非空字符串、`description` 为可选字符串，并使用 strict object 拒绝未知字段。
- [x] 1.3 新增 `src/shared/constants/fyllo-action-contracts.ts`，定义启用的 contract 注册表（初始只含 `task.create`）、type 命名校验 helper、按 type 查找 contract 的 helper，以及 `formatFylloActionContractInstructions()` 用于生成 system-reminder 注入文本。

## 2. Renderer Parsing And Definitions

- [x] 2.1 新增 `src/renderer/src/utils/fyllo-action.ts`，实现 `parseFylloActionNode(node)`：读取 `node.attrs?.type`、拒绝额外 attr、在 `node.loading === true` 时返回 pending、不解析 JSON；完成态下读取 `String(node.content ?? "").trim()`、执行 `JSON.parse` 和对应 zod schema 校验。
- [x] 2.2 新增 `src/renderer/src/config/fyllo-actions.ts`，基于 shared contract 定义 renderer action definitions，包括 `task.create` 的标题、图标、摘要渲染和 dispatcher type 绑定；不得包含 Agent 可控制的按钮文案。
- [x] 2.3 新增 `src/renderer/src/composables/useFylloActionDispatcher.ts`，实现 `dispatchFylloAction(type, payload)`；`task.create` 分支调用 `useTaskStore().createTask()`，把 description 转为 `{ format: "plain_text", content }`，不得直接调用 `window.api.task` 或 `taskApi`。

## 3. MarkStream Integration

- [x] 3.1 修改 `src/renderer/src/components/shared/MarkStream.vue`，新增 `enableActions?: boolean` prop；启用时向 `MarkdownRender` 传入 `customHtmlTags={["fyllo-action"]}`，并使用 `setCustomComponents(props.id, { "fyllo-action": FylloActionNode })` 注册 scoped component。
- [x] 3.2 在 `MarkStream.vue` 中处理 lifecycle cleanup：组件卸载或 `id` 变化时调用 `removeCustomComponents(previousId)`，避免消息实例之间串用 mapping。
- [x] 3.3 修改 `src/renderer/src/components/chat/message/AssistantMessage.vue`：assistant text part 调用 `MarkStream` 时传 `enable-actions`，reasoning part 调用时传 `:enable-actions="false"`。

## 4. Action UI

- [x] 4.1 新增 `src/renderer/src/components/shared/markstream/FylloActionNode.vue`，接收 markstream-vue custom node props，调用 `parseFylloActionNode`，并把解析结果、dark mode/context 信息传给 action shell。
- [x] 4.2 新增 `src/renderer/src/components/shared/markstream/FylloActionShell.vue`，实现 pending、invalid、ready、running、succeeded、failed、cancelled 状态；按钮固定为 `确认` / `取消`；invalid/pending 禁用确认；running/succeeded 防止重复确认。
- [x] 4.3 确保 `FylloActionShell.vue` 只负责通用展示、状态流转和 confirm/cancel 编排，不 import `window.api`、`@renderer/api/task`、Pinia store 或 task 业务模块；业务执行只经由 `useFylloActionDispatcher.ts`。

## 5. System Reminder

- [x] 5.1 修改 `src/main/services/chat/system-reminder/providers/chat.ts`，在现有 `chat.txt` 模板渲染结果后追加 `formatFylloActionContractInstructions()` 生成的 `<fyllo-action>` 协议与 enabled type 说明。
- [x] 5.2 确保 apply/archive reminder 不追加 Fyllo action contract；不修改现有 system-reminder 模板变量白名单。

## 6. Tests

- [x] 6.1 新增 `test/renderer/src/utils/fyllo-action.spec.ts`，覆盖 pending 不解析 JSON、合法 `task.create`、未知 type、额外 attr、非法 JSON、schema 失败和未知字段失败。
- [x] 6.2 新增或扩展 renderer 组件测试，覆盖 `MarkStream.vue` 注册/清理 scoped custom components、`AssistantMessage.vue` text 分支启用 `enableActions`、reasoning 分支不启用 action。
- [x] 6.3 新增 `test/renderer/src/components/fyllo-action-shell.spec.ts`，覆盖 fixed `确认` / `取消`、invalid 禁用确认、confirm 后 running/succeeded、失败后可重试、cancelled 不调用 handler。
- [x] 6.4 新增 `test/renderer/src/composables/use-fyllo-action-dispatcher.spec.ts`，mock `useTaskStore().createTask()`，验证 `task.create` payload 转换为本地任务 input，并覆盖失败路径。
- [x] 6.5 扩展 `test/main/services/chat/system-reminder/resolve.spec.ts` 或新增 chat provider 测试，验证 chat reminder 包含 `<fyllo-action>`、`task.create` schema 和禁止额外 attr/按钮的说明，且 apply/archive reminder 不包含 chat-only action contract。

## 7. Guidelines And Verification

- [x] 7.1 更新 `guidelines/RendererProcess.md`，在 Chat/Markdown 渲染相关段落记录：MarkStream 自定义标签必须通过 scoped `custom-id` 注册/清理，Fyllo action shell 不承担 IPC/store 业务执行，handler 通过 dispatcher 挂接。
- [x] 7.2 运行 `pnpm vitest run test/renderer/src/utils/fyllo-action.spec.ts test/renderer/src/components/fyllo-action-shell.spec.ts test/renderer/src/composables/use-fyllo-action-dispatcher.spec.ts`。
- [x] 7.3 运行覆盖 MarkStream/AssistantMessage 的 renderer 组件测试，以及 `pnpm vitest run test/main/services/chat/system-reminder/resolve.spec.ts`。
- [x] 7.4 运行 `pnpm typecheck:web` 和 `pnpm lint`，确认 Vue/TS 类型与导入约束通过。

## 8. Chat Action State Persistence

- [x] 8.1 更新 `src/shared/types/fyllo-action.ts` 和 `src/shared/types/chat.ts`，新增 `FylloActionState` 类型和 `Session.actionStates?: Record<string, FylloActionState>`；状态仅允许 `"succeeded" | "failed" | "cancelled"`，字段仅包含 `type`、`status`、`updatedAt`。
- [x] 8.2 更新 `src/main/infra/storage/session-store.ts` 和 `src/main/services/chat/chat-service.ts`，让 chat session meta 支持 `actionStates` 字段，读取时规范化为对象或 `undefined`，`toSession()` 映射到 `Session.actionStates`。
- [x] 8.3 新增 chat action state IPC（channel 名按现有 chat IPC 命名规则确定），输入包含 `{ projectId, sessionId, actionId, state }`，main 通过 `patchSessionMeta` 合并 `actionStates[actionId]`，并保留所有其他 session meta 字段。
- [x] 8.4 更新 renderer chat/session store，新增写入并合并当前 session `actionStates` 的 action；当前 UI 点击确认/取消后应立即更新内存态，重新进入 session 时从 session meta 恢复。
- [x] 8.5 在 Chat 主会话消息渲染链路中传递 action id 所需上下文：`sessionId`、`messageIndex`、`partIndex` 和 `actionOrdinalInPart`；action id 格式为 `chat:{sessionId}:{messageIndex}:{partIndex}:{actionOrdinalInPart}`，不得使用 markstream-vue `indexKey` 或 Agent 输出字段。
- [x] 8.6 更新 `src/renderer/src/components/shared/markstream/FylloActionShell.vue`，在 `handleConfirm` / `handleCancel` 中统一持久化 action state；type-specific 组件和 dispatcher 不得重复处理 action state 持久化。
- [x] 8.7 确保 `<fyllo-action>` 只在 Chat 主会话启用；Apply / Archive SidePanel 的 MarkStream 实例传入 `enableActions=false` 或等价配置。
- [x] 8.8 清理旧命名和旧 wrapper 残留：统一 renderer 调用与测试使用 `enableActions`，不保留 `FylloActionCard.vue` 作为所有 type 共用的业务展示容器；`task.create` 正文由 `src/renderer/src/components/chat/action/TaskCreateAction.vue` 渲染。
- [x] 8.9 同步更新 `guidelines/RendererProcess.md` 中的 Fyllo action 路径与组件名：通用组件为 `src/renderer/src/components/shared/markstream/FylloActionShell.vue`，`task.create` 专用展示组件为 `src/renderer/src/components/chat/action/TaskCreateAction.vue`。

## 9. Action State Tests

- [x] 9.1 新增/更新 session-store 与 chat-service 测试，覆盖 `actionStates` 读取、字段级合并和保留 `available_commands` / `configOptions` / `tokenUsage`。
- [x] 9.2 新增 IPC 测试，覆盖写入单个 action state、保留已有 action state、缺失 session 返回错误。
- [x] 9.3 更新 renderer 组件测试，覆盖 `FylloActionShell` 确认成功写入 `succeeded`、handler 失败写入 `failed`、取消写入 `cancelled`，以及持久化失败不回滚 handler 成功状态。
- [x] 9.4 更新 Chat 消息渲染测试，覆盖同一 session 恢复后 action id 稳定、同一 text part 多个 action 生成不同 id、持久化 `succeeded` / `failed` / `cancelled` 正确回显。
- [x] 9.5 更新 Apply / Archive SidePanel 渲染测试，确认其中的 `<fyllo-action>` 不挂载可交互 action card、不调用 handler、不写 action state。
