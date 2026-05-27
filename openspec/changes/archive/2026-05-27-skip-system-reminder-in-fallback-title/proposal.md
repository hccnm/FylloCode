## Why

`frontend/src/stores/chat.ts` 中的 `buildFallbackSessionTitle()` 通过 `getPrimaryText(parts)` 取 `parts.find((p) => p.type === "text")?.text` 作为标题原文，再做 30 字截断与 `**标题**:` 抽取。

multimodal prompt parts 落地后，调用方（例如 `ProjectHealthPopover.vue`）会将 `<system-reminder>...</system-reminder>` 整段文本作为 `parts[0]` 传入，真正的用户意图在 `parts[1]`。当前实现把 reminder 的开头当作 fallback 标题写入新 session，左侧栏会显示 `<system-reminder> ## 你的角色 ...` 这类无意义内容，违反了 `session-management` 中“首条用户消息生成兜底标题”的契约。

## What Changes

- 在 `frontend/src/stores/chat.ts` 内调整 `buildFallbackSessionTitle` 的取文逻辑：从 `parts` 中查找**第一条 `type === "text"` 且不是 `<system-reminder>...</system-reminder>` 包裹**的 part，再喂给现有的“`**标题**` 抽取 + 空白归一 + 30 字截断”流程。
- 复用 `frontend/src/utils/system-reminder.ts` 已经导出的 `isSystemReminderPart(part)`，不引入新的判定函数。
- 兜底分支保持不变：找不到任何用户文本时，仍返回 `DEFAULT_SESSION_TITLE`（`"New Session"`）。
- 同步更新 `session-management` 规范中“新 session 使用首条消息兜底标题”相关 Scenario 的措辞，明确“首条非 system-reminder 文本”。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `session-management`：修订“Session 标题具备本地兜底与 Agent 覆盖能力”这条 Requirement 的描述与 Scenario，把“首条用户消息”的定义收紧为“首条非 system-reminder 的 text part”。

## Impact

- 受影响代码：`frontend/src/stores/chat.ts`（仅 `getPrimaryText` 与/或 `buildFallbackSessionTitle` 内部）；新增/调整测试 `frontend/src/__tests__/stores/chat.spec.ts`。
- 不改动主进程 `system-reminder-injection`、IPC 通道、shared 类型、磁盘格式。
- 行为变化仅发生在 “第一条 prompt part 是 system-reminder” 的入口（目前是 `ProjectHealthPopover` 的健康检查）；其它入口（`ChatPromptPanel`、`task.vue`）行为不变。
- ACP 推送 `session_info_update` 覆盖标题的能力不受影响。
