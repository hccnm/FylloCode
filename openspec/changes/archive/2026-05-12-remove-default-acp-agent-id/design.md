## Context

System-reminder 注入能力（`openspec/specs/system-reminder-injection/spec.md`）在 v1 实现时为了控制爆炸半径，在最后一道判定里加了 "agentId 白名单"：只对 `ctx.agentId === DEFAULT_ACP_AGENT_ID` 的 session 注入 reminder，其他 agentId 一律返回 `null`。这一约束以 Requirement 形式锁在 spec 里。

实际产品迭代后发现：

- reminder 模板与正文渲染并不依赖 agentId（白名单变量是 `changeId / stageIndex / runId / projectPath`，不含 agent）。
- reminder 的路由分发已经由 `owner: "chat" | "apply" | "archive"` 决定。
- ACP 协议本身是 agent-agnostic 的，任何 ACP agent 在接入 chat / apply / archive 流程时都应享受同样的 reminder 注入语义。
- 维护一份"白名单"反而需要主进程持续追新所有 ACP 实现（Claude Code、Codex、其他第三方）。这种枚举式管控既不可持续，也与"主进程零业务知识"的分层目标相悖。

与白名单耦合的另一笔历史债是 `DEFAULT_ACP_AGENT_ID`：

- 它是一个声明在 `shared/constants/agents.ts` 的字符串常量 `"claude-acp"`。
- 它在主进程 3 个会话入口被当作"调用方未提供 agentId 时的兜底默认值"使用。
- 在产品层这是"系统替用户预选了一个 agent"的反模式：用户多 agent 的时代，预设 agent 会让上游契约的破口（缺失 agentId）变成静默的产品行为偏移。
- 它同时是上述 reminder 白名单的唯一元素，因此移除白名单后，该常量自然也失去了存在意义。

## Goals / Non-Goals

**Goals:**

- 让 system-reminder 注入对任意 ACP agent 都生效；reminder 路由 100% 由 owner 决定。
- 移除 `DEFAULT_ACP_AGENT_ID`，将 "缺失 agentId" 重新定义为 **调用契约错误**，而不是回退到隐式默认值。
- 在 schema 层（`createSessionInputSchema`）、handler 层（`streamMessage`、`stageStream`）一致地把 agentId 必填语义沉淀下来。
- 同步更新两份 spec（`system-reminder-injection`、`main-process-layering`），让 spec 与代码再次一致。

**Non-Goals:**

- 不修改 reminder 模板正文、不改变 owner→provider 路由结构。
- 不改 `AcpSession` 对外接口（构造参数 `agentId` 仍按现状传入）。
- 不调整 WorkflowStage 的 schema 形态（stage.agent 可在 yaml 中存在或缺失，由 apply 时的运行时校验拒绝缺 agent 的 stage）。
- 不做前端 UI 文案调整（缺 agentId 报 VALIDATION_ERROR 会经现有错误通道呈现）。

## Decisions

### D1. 取消 system-reminder 白名单，路由仅依赖 owner

**决定**：删除 `CLAUDE_CODE_AGENT_IDS` 与文件 `electron/main/services/chat/system-reminder/agents.ts`。`resolveSystemReminder` 不再读 `ctx.agentId` 做拦截，直接按 `owner` 查 `providers` 字典；命中则 provider 渲染模板，未命中返回 `null`。

**替代方案**：

- 沿用白名单但开放配置：风险更高（运行时配置可被劫持），收益小。
- 按 agentId 走不同模板：当前模板与 agentId 无关，没有必要。

**理由**：reminder 正文设计本身就是 agent-agnostic 的（白名单变量列表里没有 agent 相关字段）；路由维度应与决定输出内容的维度一致，agentId 不影响输出，就不应进入路由判定。

### D2. 删除 `DEFAULT_ACP_AGENT_ID`，缺失 agentId 一律抛 VALIDATION_ERROR

**决定**：

- 删除 `shared/constants/agents.ts` 整文件。
- `createSessionInputSchema.agentId` 改为 `z.string().min(1)`（必填）；schema 校验在 `validate(createSessionInputSchema, ...)` 阶段拒绝缺失。
- `chat.streamMessage` handler：`inputAgentId || meta?.agentId`，两个都缺失则在 onReady 入口 throw `ipcError(IpcErrorCodes.VALIDATION_ERROR, "agentId is required")`。注意 `streamMessageInputSchema.agentId` 现已是 `z.string()`，但允许空串通过 zod，handler 仍需补 truthy 检查；另外 schema 字段值与持久化 meta 都可能为空，所以最终判定放在 handler。
- `proposal-apply.stageStream` handler：在 stage 解析后立刻判定 `stage.agent` truthy；缺失则 throw `ipcError(IpcErrorCodes.VALIDATION_ERROR, "stage.agent is required for stage ${form.stageIndex}")`。

**替代方案**：

- 兜底为每个入口本地默认值（如 chat-service 本地常量）：相当于把预设分散到三处，问题没消除，反而更难审计。
- 给前端默认 UI 选项：是产品层做法，应该单独评估；与"主进程层是否预设 agent"是两件事。

**理由**：缺失 agentId 的语义不是"使用默认"，而是"调用方契约不完整"。在请求边界一次性把契约错误暴露出去，比让默认值悄悄生效更利于发现 bug、也更利于后续多 agent 演进。

### D3. WorkflowStage 类型保持 agent 可选，运行时强校验

**决定**：不修改 `shared/types` 或 `electron/main/domain/workflow/yaml-parser.ts` 中 stage.agent 的可选语义；apply 时由 ipc handler 在运行前强校验。

**替代方案**：

- 把 stage.agent 在类型与 yaml 解析层改为必填：会让历史 workflow.yaml（用户自有文件）解析直接报错，迁移成本高，且 stage 在编辑过程中允许暂存缺 agent 的草稿状态（前端 store 也支持）。

**理由**：把"草稿态"与"可执行态"分开。stage 在编辑/草稿态可以无 agent，到 apply 入口才以"必须显式指定 agent"的方式拒绝。

### D4. 单测口径

**决定**：

- `resolve.spec.ts` 删掉 "未知 agentId → null" 用例；新增 "任意非默认 agentId（如 `"some-other-agent"`），owner 命中即返回 `TextUIPart`"。
- 保留并继续覆盖：未知 owner → null；变量含尖括号 → null + warn；白名单变量替换；非白名单占位符保留字面量；`text` 边界包 `<system-reminder>` / `</system-reminder>`。
- `proposal-apply.spec.ts` 与 `chat.ipc` 测试中：补 "agentId / stage.agent 缺失抛 VALIDATION_ERROR" 路径。

### D5. spec delta 写法

**决定**：

- `system-reminder-injection`：使用 `## REMOVED Requirements` 删除 "v1 仅对 Claude Code 家族 agent 输出 reminder"；理由与迁移注明。
- `main-process-layering`：使用 `## MODIFIED Requirements` 修改 "默认值通过 shared/constants 集中声明"，将 "默认 agentId" scenario 替换为 "agentId 由调用方显式提供，无系统级默认"。

## Risks / Trade-offs

- **风险**：取消白名单意味着任何 agentId 都会触发 reminder 持久化与 prompt 注入。如果未来接入了某个对 system-reminder 语义不兼容的 ACP agent（极端假设），reminder 的内容是否会干扰其行为？  
  **缓解**：reminder 内容由项目自行控制，本仓本身就是面向自家 agent 生态的；如未来出现需要按 agent 屏蔽的情形，应在 owner 之下加 "agent 不兼容声明" 机制，而不是回到白名单。

- **风险**：把 agentId 改为必填会让历史调用方报错。  
  **缓解**：审计所有现存调用点（在 tasks 中列出），确保前端 chat 与 proposal 模块在请求前已携带 agentId；session 持久化 meta 中的 agentId 都是显式写入的，loadSessionMeta 路径不受影响。

- **风险**：spec 删 Requirement 后，archive 流程需要正确合并。  
  **缓解**：`openspec/changes/<name>/specs/<capability>/spec.md` 使用 `REMOVED Requirements` + 完整原文，方便归档时 diff。

- **取舍**：未在本次一并把 WorkflowStage.agent 改为类型必填。优点是迁移面更小；代价是 stage 编辑/解析与 apply 校验在"agent 是否必填"上语义不完全对齐，需要在前端 stage 编辑表单上以校验提示弥补（不在本次范围）。

## Migration Plan

1. 同步代码改动与 spec delta（本 change 的 tasks 阶段执行）。
2. 在 PR 描述与 release note 中标注："`createSession` / `streamMessage` / `stageStream` 三处 agentId 改为必填，缺失返回 `VALIDATION_ERROR`"。
3. 归档本 change 时，按 `MODIFIED` / `REMOVED` 操作合并到 `openspec/specs/`。
4. 无数据迁移；持久化的 session/stage meta 字段保持不变。

## Open Questions

- （无未决项；user 已确认 agentId 缺失一律抛 VALIDATION_ERROR、先建 change 再实施。）
