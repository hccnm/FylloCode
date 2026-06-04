## 1. 共享类型与归一化复用

- [x] 1.1 在 `electron/main/services/chat/acp-mapper.ts` 中导出 `normalizeAvailableCommands`（当前为模块内函数，`acp-mapper.ts:11`），供 probe 复用；或确认 probe 改为复用 `mapSessionUpdate` 后筛选 `type === "available_commands_update"`。二选一并在 PR 说明中标注。验收：probe 端与 stream 端共用同一份命令归一化逻辑，无重复实现。
- [x] 1.2 在 `shared/types/chat-probe.ts` 的 `ProbeSnapshot` 接口新增 `availableCommands: AcpAvailableCommand[]` 字段（从 `@shared/types/chat` 导入 `AcpAvailableCommand`），与 `configOptions` 并列。验收：`pnpm typecheck` 通过。

## 2. 主进程 probe 注册表与 service

- [x] 2.1 在 `electron/main/services/chat/session-probe-registry.ts` 的 `ProbeEntry` 接口新增 `availableCommands: AcpAvailableCommand[]`；`toProbeSnapshot` 把 `entry.availableCommands` 映射到 snapshot。验收：`set`/`get`/`takeFor` 透传该字段，单测 `session-probe-registry` 增加映射断言。
- [x] 2.2 在 `acp-process-pool.ts` 的 `AgentProcess` 接口新增 `pendingProbeHandler?: SessionUpdateHandler`；修改 `sessionUpdate(notification)` 回调（`acp-process-pool.ts:136-139`）：先按 `notification.sessionId` 查 `sessionHandlers`，命中则分发；**未命中且 `pendingProbeHandler` 存在**时回退给 `pendingProbeHandler(notification)`。导出新方法 `setPendingProbeHandler(agentId, handler)` 与 `clearPendingProbeHandler(agentId)`。验收：精确命中优先，未命中才回退（见 5.1 单测）。
- [x] 2.3 在 `session-probe-service.ts#ensureProbe` 中，**在 `connection.newSession` 之前**调用 `setPendingProbeHandler(agentId, probeHandler)`。`probeHandler` 仅处理 session 级元数据：用 1.1 的归一化逻辑把 `available_commands_update` 转为 `AcpAvailableCommand[]`，更新对应 `ProbeEntry.availableCommands`（经 `sessionProbeRegistry.get` 取最新 entry 并 set 回），再 `sessionProbeBus.emitUpdate({ agentId, snapshot: toProbeSnapshot(entry) })`；对消息流事件 no-op。验收：probe 期间收到命令推送会更新 entry 并 emit。
- [x] 2.4 在 `ensureProbe` 占位 entry（`session-probe-service.ts:77-83`）与 ready/failed entry（`:94-101`、`setFailedEntry`）构造处补 `availableCommands: []`；ready entry 的 `availableCommands` 取 entry 当前累积值（newSession 同步返回时可能仍为 `[]`）。验收：所有 `ProbeEntry` 构造点都含该字段，typecheck 通过。
- [x] 2.5 在 `session-probe-service.ts#closeProbe`（`:117`）中调用 `clearPendingProbeHandler(agentId)`，并清理已绑定的精确 sessionId handler（若有）。验收：close 后该 agent 的 `pendingProbeHandler` 为 undefined，单测覆盖。

## 3. createSession 与 stream promote 落盘

- [x] 3.1 在 `shared/schemas/ipc/chat.ts` 的 `createSessionInputSchema` 新增 `availableCommands: <AcpAvailableCommand schema>.array().optional()`；`electron/preload/api/chat.ts` 的 `chatApi.createSession` 入参类型同步扩展。验收：传/不传该字段 schema 校验均通过。
- [x] 3.2 在 `electron/main/services/chat/chat-service.ts#createSession`（参考 `chat-service.ts:58-77` 处理 `configOptions` 的同名模式）：入参 `availableCommands` 为非 `undefined` 数组时写入 `meta.available_commands`，为 `undefined` 时不设置；`toSession` 把 `meta.available_commands` 映射为 `Session.availableCommands`（`chat-service.ts:41` 已有，确认无误）。验收：空数组 `[]` 持久化为 `available_commands: []` 不被折叠为 undefined。
- [x] 3.3 在 `electron/main/ipc/chat.ts` 的 `chat:stream:message` onReady（`chat.ts:240-245`）中，`takeFor` 取出 entry 后的 `patchSessionMeta` 调用补 `available_commands: probeEntry.availableCommands`，与 `configOptions: probeEntry.configOptions` 并列。验收：promote 写入幂等（与 createSession 已写入时值一致，仅 updatedAt 变化）。

## 4. 前端 store 与组件双源读取

- [x] 4.1 在 `frontend/src/stores/session.ts` 的 `DraftProbeState` 接口（`session.ts:30-36`）新增 `availableCommands: AcpAvailableCommand[]`；`setDraftProbe`（`:240-248`）把 `snapshot.availableCommands` 写入；starting/failed 占位（`:252-257`、`:266-283`）补 `availableCommands: []`。验收：typecheck 通过，`activeDraftProbe.value.availableCommands` 可读。
- [x] 4.2 在 `frontend/src/stores/chat.ts` 的 `sendMessage` 的 `carryProbe`（`chat.ts:256-265`）中，新增 `availableCommands: JSON.parse(JSON.stringify(probeBeforeCreate.availableCommands))`，并在 `createSession` 调用（`:268-273`）透传。验收：草稿态首条消息 createSession 入参含 availableCommands。
- [x] 4.3 在 `frontend/src/stores/session.ts#createSession`（`:387-400`）入参类型与 `chatApi.createSession` 调用新增 `availableCommands?: AcpAvailableCommand[]` 透传（仅非 undefined 时传）。验收：与 configOptions 透传逻辑对称。
- [x] 4.4 在 `frontend/src/components/chat/prompt/ChatPromptPanel.vue` 把 `availableCommands` 计算属性（`ChatPromptPanel.vue:35`）改为双源回退：`activeSession` 存在读 `activeSession.availableCommands ?? []`，否则 `activeDraftProbe?.status === "ready" ? activeDraftProbe.availableCommands : []`（镜像 `ConfigOptionsBar.vue:20-25` 的 `sourceOptions`）。需从 `storeToRefs(sessionStore)` 解出 `activeDraftProbe`。验收：草稿态 probe ready 且有命令时 slash 按钮显示、`/` 键可唤起菜单。
- [x] 4.5 在 `frontend/src/components/chat/prompt/SlashCommandMenu.vue` 给触发按钮（`SlashCommandMenu.vue:66-74` 的 `UButton`）包裹 `<Transition>`，类名常量与 `ConfigOptionsBar.vue:74-81` 完全一致（`opacity-0 translate-y-1` ↔ `opacity-100 translate-y-0`，`duration-150 ease-out`），`v-if="hasAvailableCommands"` 移到被包裹按钮上。验收：命令从无到有时按钮划入、清空时划出，视觉与 `ConfigOptionsBar` 一致；`UPopover`（`:portal="false"`、`side: 'top'`、`align: 'start'`）定位不漂移、按钮卸载不报错；`UCommandPalette` 弹层交互不受影响。

## 5. 测试

- [x] 5.1 `acp-process-pool` 单测（新增或扩展 `electron/main/__tests__/infra/process/`）：覆盖「精确 sessionId 命中分发」「未命中且有 pendingProbeHandler 时回退」「精确 handler 注册后回退不再触发」「clearPendingProbeHandler 后回退不触发」。
- [x] 5.2 `session-probe-service` 单测（`electron/main/__tests__/services/chat/session-probe-service.spec.ts`）：覆盖 ensureProbe 在 newSession 前注册 pendingProbeHandler、收到 available_commands_update 更新 entry 并 emit、空数组也 emit、closeProbe 清理 handler。
- [x] 5.3 `chat-service` 单测：createSession 透传 availableCommands 写入 `available_commands`（含空数组）、不传时不设置字段。
- [x] 5.4 `ipc/chat` 单测（`electron/main/__tests__/ipc/chat.spec.ts`）：promote 时 patchSessionMeta 含 available_commands、幂等。
- [x] 5.5 前端 store 单测（`frontend/src/__tests__/stores/session.spec.ts`、`chat.spec.ts`）：setDraftProbe/applyProbeUpdate 透传 availableCommands、carryProbe 携带 availableCommands。
- [x] 5.6 `ChatPromptPanel` 组件测试：草稿态 activeDraftProbe ready 含命令时 slash 按钮渲染；probe 未就绪时不渲染。
- [x] 5.7 `SlashCommandMenu` 组件测试：`commands` 从空变非空时触发按钮被 `<Transition>` 包裹并以 ConfigOptionsBar 同款类名渲染（断言过渡类名存在）；`commands` 变空时按钮卸载且 `UPopover` 不报错。
- [x] 5.8 运行 `pnpm typecheck`、`pnpm lint`、`pnpm test` 全绿。

## 6. 项目 guidelines 评估

- [x] 6.1 ~~评估是否需要更新 `guidelines/reference/acp/ACP-Message-Types.md`：补充「`available_commands_update` 为 newSession 返回后异步推送~~ guidelines/reference 文档不需要更新。
