## Why

ACP 协议的 `session/update` 中存在 `sessionUpdate: "plan"` 一类消息，agent 用它向 client 实时广播执行计划（多步任务的拆解与进度）。FylloCode 当前的 `acp-mapper` 在 default 分支直接丢弃该类型，渲染进程也没有任何展示位置，用户在 coding agent 执行多步任务时看不到 agent 的计划与进度。本次变更补齐这条从主进程到 UI 的数据流，并新增一个独立的执行计划面板。

## What Changes

- `acp-mapper.mapSessionUpdate` 新增 `case "plan"`：把 ACP `PlanEntry[]` 规范化为内部 `PlanEntry[]`，产出新的 `SessionEvent { type: "plan_update"; entries }`。
- `SessionEvent` 联合类型新增 `plan_update` 成员；`MessageChunkData` 联合类型新增 `{ kind: "plan_update"; entries }` 分支。
- `session-event-mapper.toMessageChunk` 新增 `plan_update` 处理，透传给渲染进程。
- 前端 `Session` 接口新增内存态字段 `plan?: PlanEntry[]`（**不持久化**，不写入 session meta 文件）；`session` store 新增 `setSessionPlan` action。
- 前端 chat store 的 `streamSessionMessage.onChunk` 新增 `plan_update` 分支：不经过 `useUIMessageAssembler`，直接调用 `setSessionPlan` 覆盖会话内存态。
- 新增渲染组件 `ChatPlanPanel.vue`，固定在消息列表与输入框之间，展示当前 plan 条目（status 图标、priority 标记、完成进度），可折叠。

不持久化的决策依据：ACP 协议规定 agent 每次更新都 MUST 发送完整 plan 条目列表、client MUST 整体替换（无增量语义），因此 plan 是纯运行时状态，重启后无意义。该结论与 `guidelines/reference/acp/ACP-Message-Types.md` 持久化分类表中 `plan` 标注 `✗` 一致。

## Capabilities

### New Capabilities

- `chat-plan-display`: 渲染进程对 ACP 执行计划的展示能力——`ChatPlanPanel` 组件的展示位置、条目状态/优先级的视觉映射、折叠交互、空态处理，以及计划随会话切换的呈现规则。

### Modified Capabilities

- `acp-chat-backend`: `ACP sessionUpdate 映射为 SessionEvent` 需求新增 `plan` 映射规则与 `SessionEvent.plan_update` 成员；`前端 chat store 从流式事件组装 assistant UIMessage` 需求新增 `plan_update` 的分发规则（不进消息组装通路）与 `MessageChunkData.plan_update` 分支。
- `ipc-streaming`: 流式协议的 `MessageChunkData` 新增 `plan_update` 分支，并约束 `session-event-mapper` 透传与 proposal 流忽略行为。

## Impact

- 主进程：`electron/main/services/chat/acp-mapper.ts`、`electron/main/domain/chat/session-events.ts`、`electron/main/services/chat/session-event-mapper.ts`
- 共享层：`shared/types/ipc.ts`、`shared/types/chat.ts`（新增 `PlanEntry` 类型与 `Session.plan` 字段）
- 渲染进程：`frontend/src/stores/session.ts`、`frontend/src/stores/chat.ts`、`frontend/src/components/chat/ChatContainer.vue`、新增 `frontend/src/components/chat/plan/ChatPlanPanel.vue`
- 测试：`acp-mapper`、`session-event-mapper`、chat store、session store、`ChatPlanPanel` 组件
- 不影响 session meta 持久化格式（plan 不落盘），不影响 proposal/archive 流（显式忽略 `plan_update`）
