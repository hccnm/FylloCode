# system-reminder-injection delta

## REMOVED Requirements

### Requirement: v1 仅对 Claude Code 家族 agent 输出 reminder

**Reason**: reminder 路由与正文模板均不依赖 `agentId`（白名单变量为 `changeId / stageIndex / runId / projectPath`），按 agent 维度白名单拦截会让任何新接入的 ACP agent 都失去 reminder 注入能力，且维护一份不断扩张的兼容名单不可持续。改为 reminder 路由仅依赖 `owner`，由 owner→provider 字典命中即注入；任何 ACP agent 在接入 chat / apply / archive 流程时享受一致的 reminder 注入语义。

**Migration**:

- 删除 `electron/main/services/chat/system-reminder/agents.ts`（`CLAUDE_CODE_AGENT_IDS`）。
- `electron/main/services/chat/system-reminder/index.ts` 中删除 `CLAUDE_CODE_AGENT_IDS` 引用与 agentId 拦截分支；保留 owner→provider 查表与 `wrapAsSystemReminder` 包裹流程不变。
- 现存判定保持：未知 owner 仍返回 `null`；白名单变量含 `<` / `>` 时仍返回 `null` 并 `logger.warn`。这两条由其他 Requirement 承载，不受本次删除影响。
- 单测 `electron/main/__tests__/services/chat/system-reminder/resolve.spec.ts`：删除 "未知 agentId 跳过 reminder" 用例；新增 "任意非空 agentId（如 `"some-other-agent"`），owner 命中即返回 `TextUIPart`" 用例。
