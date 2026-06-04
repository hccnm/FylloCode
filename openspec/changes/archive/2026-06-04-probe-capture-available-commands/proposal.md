## Why

新建会话发送首条消息时，slash command 组件始终不展示，消息日志里也看不到 `available_commands_update`。根因已定位：草稿期 probe 在 `session-probe-service.ts` 调用 `connection.newSession()` 后**从不注册 `sessionHandler`**；而 ACP agent（如 claude-acp）按规范在 `newSession` 响应返回**之后**用 `setTimeout(0)` 异步推送 `available_commands_update`（`session/update` notification），这条 notification 落在「无 handler 窗口」，被 `acp-process-pool.ts` 的 `sessionUpdate` 路由静默丢弃。对照之下，`configOptions` 是 `newSession` 的**同步返回值**，所以配置选项能正常显示——同一个 `newSession`，一个走同步返回值活下来、一个走异步 notification 被丢掉，这正是「配置项在、命令不在」的原因。由于 agent 一个 session 通常只在创建时推一次命令列表，首次丢失后整个会话生命周期都不再补推。

## What Changes

- probe 在 `ensureProbe` 调用 `newSession` **之前**注册一个 probe-only `sessionHandler`，只处理 session 级元数据事件（首要为 `available_commands_update`），把 agent 异步推送的可用命令接住、归一化后写入 `ProbeEntry` 并通过 `SessionProbeBus` 广播；草稿期空闲窗口里 agent 不会推送 text/reasoning/tool_call，因此该 handler 不触碰消息流。
- `ProbeEntry` 与 `ProbeSnapshot` 新增 `availableCommands: AcpAvailableCommand[]` 字段，与既有 `configOptions` 字段并列，复用同一条 `ProbeEntry → ProbeSnapshot → SessionProbeBus → 前端 draftProbe` 广播通路。
- 前端 `DraftProbeState`、`setDraftProbe`、`activeDraftProbe` 透传 `availableCommands`；草稿态首条消息的 `carryProbe` 把命令一并带入 `chat:createSession`；`createSession` IPC 入参与 `SessionMeta` 落盘新增 `available_commands` 透传，与现有 `config_options` 完全对称。
- `chat:stream:message` 的 `onReady` 在 `takeFor` 取出 probe entry 后，`patchSessionMeta` 一并写入 `available_commands`（与现有 `config_options` 写入并列），保证 promote 落盘不丢命令。
- 前端 `ChatPromptPanel.vue` 的 `availableCommands` 计算属性改为「`activeSession` 优先、草稿态回退 `activeDraftProbe`」的双源读取，与 `ConfigOptionsBar.vue` 的 `sourceOptions` 模式对称——这是 slash command 在「首条消息发送前」即可用的关键。
- `closeProbe` 释放 probe entry 时一并注销该 probe-only `sessionHandler`，避免 handler 泄漏。

非范围（仅记录于 design）：`acp-session.ts` 的 `recoverSession` 在 `resumeSession`/`loadSession` 均失败后回退到 `newSession` 时，存在同源的「newSession 到 runPrompt 注册 handler 之间」丢失窗口。该路径属极小概率事件（绝大多数 ACP agent 支持 loadSession 或 resumeSession），本次不实现。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `chat-session-probe`: probe 抓取并广播 `available_commands`——`ProbeEntry`/`ProbeSnapshot` 新增 `availableCommands` 字段；`ensureProbe` 注册 probe-only session handler 接住异步 `available_commands_update`；`closeProbe` 注销该 handler；`chat:stream:message` promote 时把 `available_commands` 写入 SessionMeta；`chat:createSession` 入参与落盘透传 `available_commands`。
- `chat-interface`: 草稿态 slash command 数据源——`ChatPromptPanel` 的 `availableCommands` 改为 `activeSession` 优先、草稿期回退 `activeDraftProbe.availableCommands` 的双源读取，使首条消息发送前 slash command 即可用。

## Impact

- 主进程：`electron/main/services/chat/session-probe-service.ts`、`session-probe-registry.ts`、`electron/main/ipc/chat.ts`、`electron/main/services/chat/chat-service.ts`。
- 共享类型：`shared/types/chat-probe.ts`（`ProbeSnapshot`）、`shared/schemas/ipc/chat.ts`（`createSessionInputSchema`）、`electron/preload/api/chat.ts`。
- 渲染进程：`frontend/src/stores/session.ts`（`DraftProbeState`/`setDraftProbe`/`activeDraftProbe`/`createSession`）、`frontend/src/stores/chat.ts`（`carryProbe`）、`frontend/src/components/chat/prompt/ChatPromptPanel.vue`。
- 不改动 ACP notification 分发语义（不改 `acp-process-pool.ts`）、不改 `acp-mapper.ts` 的命令归一化逻辑、不改 content 流式通路。
