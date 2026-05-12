## Why

当前主进程在两处对 ACP `agentId` 做了产品层不应有的硬编码假设：

1. `electron/main/services/chat/system-reminder/index.ts` 通过 `CLAUDE_CODE_AGENT_IDS`（初值锁定为 `[DEFAULT_ACP_AGENT_ID]`）做白名单拦截，只有匹配该列表的 agentId 才会注入 system-reminder。但 reminder 的注入策略是按 owner（chat / apply / archive）决定的，与 agentId 无关；任何 ACP agent 都应享受同样的 reminder 注入能力，不应预先假定只服务 "claude-acp"。
2. `shared/constants/agents.ts` 中的 `DEFAULT_ACP_AGENT_ID = "claude-acp"` 被三处会话/会话流入口当作"用户未指定 agent 时的兜底默认值"使用（`createSession`、`chat` 的 `streamMessage`、`proposal-apply` 的 `stageStream`）。产品层不应给用户预设一个具体的 agent id —— agent id 必须由调用方/上游显式提供，缺失即视为契约错误。

这两个问题在 spec 上由 `system-reminder-injection`（要求"v1 锁死单元素列表"）与 `main-process-layering`（要求"默认 agentId 单点 `DEFAULT_ACP_AGENT_ID`"）的两条强制约束承载，需要同步调整。

## What Changes

- **BREAKING** 移除 system-reminder 注入对 `agentId` 的白名单判断：`resolveSystemReminder` 不再根据 agentId 拦截，路由仅由 `owner` 决定；只要 owner 命中已注册 provider 且模板渲染成功，就返回 `TextUIPart`。
- **BREAKING** 移除共享常量 `DEFAULT_ACP_AGENT_ID` 与文件 `shared/constants/agents.ts`，不再向用户预设默认 agent。
- **BREAKING** `createSession` 的 `agentId` 改为必填；`createSessionInputSchema.agentId` 从 `optional` 改为 `z.string().min(1)`，缺失即在 schema 阶段抛 `VALIDATION_ERROR`。
- **BREAKING** `chat` 的 `streamMessage` handler：当 `inputAgentId` 与持久化的 `meta.agentId` 都缺失时，直接抛 `VALIDATION_ERROR`，不再回退到全局默认值。
- **BREAKING** `proposal-apply` 的 `stageStream` handler：当 `stage.agent` 缺失时，直接抛 `VALIDATION_ERROR`；workflow 在 stage 层必须显式声明 agent。
- 删除文件：`shared/constants/agents.ts`、`electron/main/services/chat/system-reminder/agents.ts`。
- 更新单测 `electron/main/__tests__/services/chat/system-reminder/resolve.spec.ts`：去掉"未知 agentId → null"用例；改为"任意非空 agentId（owner 命中即返回非 null）"。
- 更新文档：`docs/MainProcess.md` 中关于 `DEFAULT_ACP_AGENT_ID` 的条目移除。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `system-reminder-injection`：移除"v1 仅对 Claude Code 家族 agent 输出 reminder"这一 Requirement 与对应 Scenarios；reminder 路由仅依赖 owner，不再依赖 agentId。
- `main-process-layering`：修改"默认值通过 shared/constants 集中声明"这一 Requirement 中关于"默认 agentId 单点 `DEFAULT_ACP_AGENT_ID`"的 scenario 与条文；改为"agentId 由调用方在请求边界显式提供，主进程不维护系统级默认 agentId"。
- `proposal-apply-run`：修改"Stage 流式执行通过 MessagePort 传输 chunk"这一 Requirement，把"`agentId` 取自 `stages[stageIndex].agent`；若为空使用默认 agent（硬编码 `"claude-acp"`）"改为"`stage.agent` 必填，缺失抛 `VALIDATION_ERROR`"，并新增对应 scenario。

## Impact

**代码**

- `electron/main/services/chat/system-reminder/index.ts`：移除白名单判断。
- `electron/main/services/chat/system-reminder/agents.ts`：删除。
- `electron/main/services/chat/chat-service.ts`：`createSession` 的 `input.agentId` 改为必填，去掉 `?? DEFAULT_ACP_AGENT_ID`。
- `electron/main/ipc/chat.ts`：`streamMessage` 中 `agentId` 解析逻辑改为"`inputAgentId || meta?.agentId`，缺失抛 `VALIDATION_ERROR`"。
- `electron/main/ipc/proposal-apply.ts`：`stageStream` 中 `stage.agent` 缺失抛 `VALIDATION_ERROR`。
- `shared/schemas/ipc/chat.ts`：`createSessionInputSchema.agentId` 改为 `z.string().min(1)`（必填）。
- `shared/constants/agents.ts`：删除整个文件。

**测试**

- `electron/main/__tests__/services/chat/system-reminder/resolve.spec.ts`：去掉 agentId 白名单相关用例，新增"非默认 agentId 也能注入"用例。
- 现有 `proposal-apply` / `chat` ipc 测试需要补"agentId 缺失抛错"路径。

**spec**

- `openspec/specs/system-reminder-injection/spec.md`：删除"v1 仅对 Claude Code 家族 agent 输出 reminder"Requirement。
- `openspec/specs/main-process-layering/spec.md`：修改"默认值通过 shared/constants 集中声明" Requirement 的 scenario，去掉对 `DEFAULT_ACP_AGENT_ID` 的引用。
- `openspec/specs/proposal-apply-run/spec.md`：修改"Stage 流式执行通过 MessagePort 传输 chunk" Requirement，去掉 workflow 默认 agent 硬编码 fallback 的条文。

**文档**

- `docs/MainProcess.md`：删除 `DEFAULT_ACP_AGENT_ID` 在常量表中的条目。

**调用方兼容**

- 前端创建 session 时已经通过 `useChatSession` / `createSession` 携带 agentId（实际产品里用户必须选 agent），但仍需审计：所有 `chat.createSession`、`chat.streamMessage`、`proposal.stageStream` 的调用点必须能保证 agentId 非空。
- 历史 session 持久化 meta 中的 `agentId` 已经是 "claude-acp"（或其他显式值），不受影响。
- WorkflowStage 的 `agent` 字段在类型上仍允许缺省（兼容现存 workflow.yaml 文件），但 apply 时 stage 缺 agent 将报错，提示用户在 workflow 中显式声明。
