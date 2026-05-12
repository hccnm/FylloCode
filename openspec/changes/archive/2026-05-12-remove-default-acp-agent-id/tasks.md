## 1. 移除 system-reminder 白名单

- [x] 1.1 删除 `electron/main/services/chat/system-reminder/agents.ts`（含 `CLAUDE_CODE_AGENT_IDS` 导出与 `DEFAULT_ACP_AGENT_ID` import）。
- [x] 1.2 修改 `electron/main/services/chat/system-reminder/index.ts`：移除对 `./agents` 的 import，移除 `if (!CLAUDE_CODE_AGENT_IDS.includes(ctx.agentId)) return null;` 拦截分支；保留 owner→provider 路由、未知 owner 返回 `null`、模板渲染流程。
- [x] 1.3 更新单测 `electron/main/__tests__/services/chat/system-reminder/resolve.spec.ts`：删除 "未知 agentId 跳过 reminder" 用例；新增 "任意非空 agentId（如 `"some-other-agent"`），owner 命中即返回 `TextUIPart`"。

## 2. 移除 DEFAULT_ACP_AGENT_ID 并把 agentId 改为必填

- [x] 2.1 修改 `shared/schemas/ipc/chat.ts`：将 `createSessionInputSchema.agentId` 从 `z.string().min(1).optional()` 改为 `z.string().min(1)`（必填）。
- [x] 2.2 修改 `electron/main/services/chat/chat-service.ts`：`createSession` 的 `input` 类型中 `agentId: string`（去掉 `?`），删除 `?? DEFAULT_ACP_AGENT_ID`，删除对 `@shared/constants/agents` 的 import。
- [x] 2.3 修改 `electron/main/ipc/chat.ts`：删除 `DEFAULT_ACP_AGENT_ID` 的 import；`streamMessage` 的 onReady 中 `agentId` 解析改为 `inputAgentId || meta?.agentId`，若结果为空（`undefined`/`""`）则 throw `ipcError(IpcErrorCodes.VALIDATION_ERROR, "agentId is required")`，置于 `new AcpSession` 之前。
- [x] 2.4 修改 `electron/main/ipc/proposal-apply.ts`：删除 `DEFAULT_ACP_AGENT_ID` 的 import；`stageStream` 中删除 `stage.agent ?? DEFAULT_ACP_AGENT_ID`，改为先校验 `if (!stage.agent) throw ipcError(IpcErrorCodes.VALIDATION_ERROR, ...)` 再赋值 `const agentId = stage.agent`。
- [x] 2.5 删除 `shared/constants/agents.ts` 整文件；运行 `pnpm typecheck` 确认没有遗留引用。
- [x] 2.6 全仓 grep `DEFAULT_ACP_AGENT_ID` 与 `"claude-acp"`（产品代码范围，排除 `openspec/changes/archive/`、`.worktrees/`、本 change 的 specs 与 docs），确认无残留；对 `docs/MainProcess.md` 中 `DEFAULT_ACP_AGENT_ID` 的条目做对应清理。

## 3. 文档与 spec 同步

- [x] 3.1 修改 `docs/MainProcess.md`：从常量表中移除 `DEFAULT_ACP_AGENT_ID` 一行。
- [x] 3.2 在本 change 归档前，确认 `openspec/changes/remove-default-acp-agent-id/specs/system-reminder-injection/spec.md`（REMOVED）、`openspec/changes/remove-default-acp-agent-id/specs/main-process-layering/spec.md`（MODIFIED）与 `openspec/changes/remove-default-acp-agent-id/specs/proposal-apply-run/spec.md`（MODIFIED）的 delta 内容与代码改动一一对应。

## 4. 测试与回归验证

- [x] 4.1 在 `electron/main/__tests__/ipc/chat.spec.ts`（如不存在则新建对应文件）补 "streamMessage 在 inputAgentId/meta.agentId 都为空时抛 VALIDATION_ERROR" 用例。
- [x] 4.2 在 `electron/main/__tests__/ipc/proposal-apply.spec.ts` 补 "stageStream 在 stage.agent 为空时抛 VALIDATION_ERROR" 用例。
- [x] 4.3 运行 `pnpm typecheck`、`pnpm lint`、`pnpm test`，全部通过。
- [x] 4.4 手动 smoke：启动 `pnpm dev`，验证 (a) 选定 agent 后新建 chat session、发送消息、reminder 注入到 jsonl 与 prompt 数组首位；(b) workflow apply 阶段对 stage 缺 agent 的场景给出 VALIDATION_ERROR 提示。
