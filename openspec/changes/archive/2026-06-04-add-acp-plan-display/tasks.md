## 1. 共享类型层

- [x] 1.1 在 `shared/types/chat.ts` 新增并导出 `PlanEntry` 接口：`{ content: string; priority: "high" | "medium" | "low"; status: "pending" | "in_progress" | "completed" }`。在 `Session` 接口新增可选字段 `plan?: PlanEntry[]`（紧邻 `availableCommands`/`configOptions`）。验收：类型可被 main/preload/renderer import，且无 `@agentclientprotocol/sdk` 依赖。
- [x] 1.2 在 `shared/types/ipc.ts` 的 `MessageChunkData` 联合类型新增分支 `{ kind: "plan_update"; entries: PlanEntry[] }`（import `PlanEntry` from `chat.ts`），紧邻 `available_commands_update` 分支。验收：`pnpm typecheck` 通过。

## 2. 主进程映射与透传

- [x] 2.1 在 `electron/main/domain/chat/session-events.ts` 的 `SessionEvent` 联合类型新增成员 `{ type: "plan_update"; entries: PlanEntry[] }`（复用 `shared/types/chat.ts` 的 `PlanEntry`），紧邻 `available_commands_update`。
- [x] 2.2 在 `electron/main/services/chat/acp-mapper.ts` 新增 `case "plan"`：将 `update.entries` 映射为 `PlanEntry[]`（每条仅取 `content`/`priority`/`status`，丢弃 `_meta` 等），产出 `SessionEvent { type: "plan_update", entries }`；空数组也产出事件。参照同文件 `normalizeAvailableCommands` 的写法，可新增 `normalizePlanEntries` 辅助函数。同步把 default 分支注释里列举的 `plan` 移除（已被显式处理）。验收：`acp-mapper.spec.ts` 新增用例覆盖 plan 映射与空数组。
- [x] 2.3 在 `electron/main/services/chat/session-event-mapper.ts` 的 `toMessageChunk` 新增 `case "plan_update"`，返回 `{ kind: "plan_update", entries: ev.entries }`，紧邻 `available_commands_update`。验收：`session-event-mapper.spec.ts` 新增用例。

## 3. 主进程流式 handler

- [x] 3.1 在 `electron/main/ipc/chat.ts`（约 332-344 行 `available_commands_update`/`config_options_update` 分支附近）新增 `case "plan_update"`，通过 `sink.sendChunk` 透传给 renderer。验收：chat 流能下发 plan_update chunk。
- [x] 3.2 在 `electron/main/ipc/proposal-apply.ts`（约 183 与 399 行两处 switch）新增 `case "plan_update"`，显式忽略（不调用 `sink.sendChunk`），与 `config_options_update` 的忽略逻辑同址。验收：proposal/archive 流不下发 plan_update。

## 4. 渲染进程状态

- [x] 4.1 在 `frontend/src/stores/session.ts` 的 `SessionStore` 接口与实现新增 `setSessionPlan(sessionId: string, entries: PlanEntry[]): void`，参照 `setSessionAvailableCommands`，找到 session 后赋值 `session.plan = entries`。确认 `SerializedSession`、`normalizeSession`、`mergeSessionMeta` **不** 处理 `plan` 字段（保证不持久化、不参与 meta 合并）。在 store return 对象导出 `setSessionPlan`。验收：`session` store 测试覆盖 setSessionPlan 写入与"切换会话隔离"。
- [x] 4.2 在 `frontend/src/stores/chat.ts` 的 `streamSessionMessage.onChunk` switch 新增 `case "plan_update"`：调用 `sessionStore.setSessionPlan(activeSession.id, data.entries)` 后 return，置于 `available_commands_update`/`config_options_update` 分支附近。验收：`chat.spec.ts` 新增用例，断言 plan_update 路由到 `setSessionPlan` 且不触碰 assembler。
- [x] 4.3 在 `frontend/src/composables/useUIMessageAssembler.ts` 的 `applyChunk` switch 把 `plan_update` 加入与 `available_commands_update`/`config_options_update` 同组的忽略分支（直接 `return`），保证穷尽检查通过。验收：`use-ui-message-assembler.spec.ts` 新增"忽略 plan_update"用例。

## 5. 渲染进程 UI

- [x] 5.1 将已在 main worktree 验证过的 `frontend/src/components/chat/plan/ChatPlanPanel.vue` 接入真实数据：把组件内本地 `PlanEntry` 类型替换为 `import type { PlanEntry } from "@shared/types/chat"`，`entries` prop 类型改为 `PlanEntry[]`。保留现有 status/priority 视觉映射、折叠交互、空数组不渲染逻辑。
- [x] 5.2 在 `frontend/src/components/chat/ChatContainer.vue` 移除静态 mock 数据 `mockPlanEntries`，将 `ChatPlanPanel` 的 `entries` 改为绑定 `activeSession?.plan ?? []`，保留 `v-if="!isDraft"`。验收：进入有 plan 的 session 展示面板，切换到无 plan 的 session 面板消失，草稿态不展示。

## 6. 验证与文档

- [x] 6.1 运行 `pnpm typecheck`、`pnpm lint`、`pnpm test`，全部通过。验收：无类型/lint 错误，新增与既有测试全绿。
- [x] 6.2 ~~更新 `guidelines/reference/acp/ACP-Message-Types.md`~~ reference文档无需更新。
