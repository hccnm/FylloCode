## Context

ACP `session/update` 的 `sessionUpdate: "plan"` 当前在 `acp-mapper.mapSessionUpdate` 的 default 分支被丢弃，渲染进程无展示位置。现有同类"会话级、与消息流解耦"的事件（`available_commands_update`、`config_options_update`）已有成熟的接入范式：mapper 产出独立 `SessionEvent` → `session-event-mapper` 转 `MessageChunkData` → chat store `onChunk` 分发到 session store 内存态，**不进** `useUIMessageAssembler`。plan 与它们同构，本次直接复用该范式。

关键约束来自 ACP 协议：agent 每次更新 plan 都 MUST 发送完整条目列表，client MUST 整体替换，无增量语义。`guidelines/reference/acp/ACP-Message-Types.md` 持久化分类表已将 `plan` 标注为 `✗`（运行时状态，重启后无意义）。

UI 形态已在 main worktree 用 mock 数据做过静态验证并经用户确认：独立 Plan 面板，固定在输入框上方。

## Goals / Non-Goals

**Goals:**

- 打通 ACP `plan` 从主进程到渲染进程 UI 的完整数据流，复用现有会话级事件范式。
- plan 作为 `Session.plan` 内存态，全量替换、不持久化、不进 `session.messages`。
- 提供 `ChatPlanPanel.vue` 独立面板，展示条目 status/priority 与完成进度，可折叠。

**Non-Goals:**

- 不持久化 plan 到 session meta 文件（明确排除）。
- 不把 plan 做成 message part（与全量替换/不持久化语义冲突）。
- 不在 proposal/archive 流中展示 plan（这些流显式忽略 `plan_update`）。
- 不实现 plan 条目的交互编辑（仅展示 agent 推送的计划）。

## Decisions

**决策 1：plan 走会话级内存态，而非 message part。**
ACP plan 是"当前 turn 执行计划的全量快照"，随时被整体替换。message part 是 append-only 且会被持久化，二者语义冲突。因此把 plan 放到 `Session.plan?: PlanEntry[]`，与 `availableCommands`/`configOptions` 同列，经 `setSessionPlan` 覆盖。

- 备选：做成 message part 跟随消息流——否决，违背全量替换语义，且会被错误持久化。

**决策 2：不持久化。**
依据 ACP 协议（无增量、整体替换）与项目既有文档结论。`Session.plan` 不出现在 `SerializedSession`，`mergeSessionMeta`/`normalizeSession` 不处理它，重启后自然为 `undefined`。

- 备选：持久化到 session meta——否决，重启后无法对齐"plan 属于哪个 turn 的哪个进度"，存了也无意义。

**决策 3：新增 `plan_update` 而非复用既有事件 kind。**
plan 的 payload（`entries`）与现有任何 chunk 都不同构，必须新增独立的 `SessionEvent` 成员与 `MessageChunkData` 分支，借 TypeScript 穷尽检查保证所有 switch 都显式处理。

**决策 4：`PlanEntry` 类型脱 SDK，定义在 `shared/types/chat.ts`。**
与 `AcpAvailableCommand`、`AcpSessionConfigOption` 一致——shared/preload/renderer 不得 import `@agentclientprotocol/sdk`。mapper 在主进程侧把 SDK 的 plan entry 规范化为本地 `PlanEntry`。

**决策 5：UI 形态为独立面板（方案 A）。**
固定在 `ChatContainer.vue` 消息列表与 `ChatPromptPanel` 之间。视觉复用 `ProposalApplySidePanel.vue` 的语义色与 `i-lucide-*` 约定，保持与 Apply 侧栏一致。

- 备选：内联到当前 assistant 消息气泡——否决，与"全量替换/不持久化/不属于任何历史消息"语义有摩擦。

## Risks / Trade-offs

- [切换会话残留] plan 是内存态，若面板直接读全局而非 `activeSession.plan`，切换会话可能残留旧 plan → 面板的 `entries` 必须来源于 `activeSession.plan`，会话切换天然隔离。
- [proposal 流误收 plan] proposal/archive 复用 `AcpSession`，可能 emit `plan_update` → 在对应 handler 显式忽略 `plan_update`（与 `config_options_update` 现有忽略逻辑同址），并由 spec scenario 固化。
- [穷尽检查遗漏] 新增 union 成员后若某 switch 漏处理 → 依赖 TypeScript 穷尽检查（`never` 兜底）在 `pnpm typecheck` 暴露；本次涉及的所有 switch 都需补分支。

## Migration Plan

无数据迁移。plan 不落盘，不改变 session meta 格式，旧 session 文件无需处理。变更纯增量：新增 union 分支与新组件，不破坏既有契约。回滚只需还原相关文件，无残留状态。
