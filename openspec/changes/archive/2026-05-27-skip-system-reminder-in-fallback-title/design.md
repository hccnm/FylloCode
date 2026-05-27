## Context

- 触发点：`frontend/src/stores/chat.ts:36-53`

  ```ts
  function getPrimaryText(parts: ChatPromptPart[]): string {
    return parts.find((part) => part.type === "text")?.text ?? "";
  }

  function buildFallbackSessionTitle(parts: ChatPromptPart[]): string {
    const content = getPrimaryText(parts);
    const taskTitle = content.match(/^\*\*标题\*\*:\s*(.+)$/m)?.[1]?.trim();
    if (taskTitle) {
      return Array.from(taskTitle).slice(0, FALLBACK_SESSION_TITLE_MAX_LENGTH).join("");
    }
    const normalized = content.trim().replace(/\s+/g, " ");
    if (!normalized) return DEFAULT_SESSION_TITLE;
    return Array.from(normalized).slice(0, FALLBACK_SESSION_TITLE_MAX_LENGTH).join("");
  }
  ```

- `ChatPromptPart`（`shared/types/chat-prompt.ts`）的判别字段为 `type: "text" | "image" | "resource_link"`，`text` 仅存在于 `"text"` 分支。
- 已存在的 reminder 判定工具：`frontend/src/utils/system-reminder.ts`
  ```ts
  export function isSystemReminderPart(part: unknown): boolean {
    // type === "text" && trim 后以 <system-reminder> 开头并以 </system-reminder> 结尾
  }
  ```
- 当前唯一会让 `parts[0]` 是 reminder 的入口：`frontend/src/components/layout/ProjectHealthPopover.vue:48-54`，该入口将 `buildHealthCheckReminder(project)` 作为首条 text part 传入。
- 现有规范：`openspec/specs/session-management/spec.md` 的 Requirement “Session 标题具备本地兜底与 Agent 覆盖能力”与 Scenario “新 session 使用首条消息兜底标题”定义了“首条用户消息”→ trim + 压空白 + 前 30 字符 的兜底契约，但未对 system-reminder 做出排除。

## Goals / Non-Goals

**Goals:**

- 使 `buildFallbackSessionTitle(parts)` 在 `parts` 含 system-reminder 文本时跳过 reminder，使用真正的用户文本生成兜底标题。
- 完整保留现有截断策略：`**标题**: <X>` 抽取优先；否则 `trim()` + `replace(/\s+/g, " ")` 后取前 30 个字符；空字符串落 `DEFAULT_SESSION_TITLE`。
- 在 `session-management` 规范中明确“首条非 system-reminder text part”这一定义。

**Non-Goals:**

- 不修改主进程 `system-reminder-injection`（电子端注入逻辑、磁盘 prepend、ACP prompt 数组结构均不动）。
- 不引入新的 IPC、preload 暴露或 `shared/` 类型。
- 不改变 `DEFAULT_SESSION_TITLE` 字面量、不调整 30 字限制。
- 不变更 `ChatPromptPart` schema、不调整 `chatStore.sendMessage` 调用签名、不改任何调用方传参。
- 不重写或拆分 `getPrimaryText`/`buildFallbackSessionTitle` 的对外签名（保持 `parts: ChatPromptPart[] => string`）。

## Decisions

### D1：在 `getPrimaryText` 内收紧 find 谓词，而不是新增 util

候选：

1. 在 `getPrimaryText` 的 `parts.find` 谓词上叠加 `!isSystemReminderPart(part)`。
2. 在 `frontend/src/utils/system-reminder.ts` 新增 `getFirstUserText(parts)` 之类 util，再被 `chat.ts` 调用。

选 1。原因：

- 单点修改、零新增导出符号；
- `isSystemReminderPart` 已经是稳定 util，谓词组合即可；
- 该函数在 `chat.ts` 内为模块私有，没有第二个调用方。

### D2：判定时机使用“原始 part”

`isSystemReminderPart` 接受 `unknown` 并对 `type === "text"` + `text` 字符串内容做 trim 检查。在 `buildFallbackSessionTitle` 收到的 `ChatPromptPart[]` 上直接传 part 即可，无需在前面再做一次 type narrow。返回 text 时仍需以 `part.type === "text"` 收窄拿到 `part.text`。

### D3：`**标题**:` 抽取放在跳过 reminder 之后

任务来自 `task.vue:145` 的入口当前 `parts` 仅含一条用户 text，本次改动不会引入新 reminder。但若未来某处既注入 reminder 又包含 `**标题**: …` 模板，逻辑顺序应为「先选出非 reminder 文本 → 再做 `**标题**` 抽取」。这与本次实现完全一致：先用收紧后的 `getPrimaryText` 选出 text，再进入既有 `match(/^\*\*标题\*\*:\s*(.+)$/m)`。

### D4：空 prompt / 全是 reminder 时回退 `DEFAULT_SESSION_TITLE`

若 `parts` 中没有任何“非 reminder text part”，`getPrimaryText` 返回 `""`，后续 `normalized` 为空，落入既有 `return DEFAULT_SESSION_TITLE`。无需新增分支。

## Risks / Trade-offs

- **Risk**：未来若有调用方需要 `parts` 的“原始首条 text”而非“首条用户 text”，`getPrimaryText` 名称会出现语义偏差 → Mitigation：本次保留函数名（与 spec/测试历史一致），由后续真正出现第二个用例时再考虑更名/拆分。
- **Risk**：`isSystemReminderPart` 仅做字面量首尾判定，攻击面理论上可被构造成内嵌伪 reminder 的用户消息 → Mitigation：维持现有判定不动；本场景下用户主动输入恰好以 `<system-reminder>` 开头并 `</system-reminder>` 结尾的概率极低，且与全链路（`UserMessage.vue` 渲染、ACP 注入）现有判定保持一致。
- **Trade-off**：`task.vue` 入口当前不传 reminder，行为不变；`ProjectHealthPopover` 入口的会话标题将从 reminder 开头变为真实用户提示词的前 30 字。这是预期改进，但属于可见行为变化，应在 spec 中体现。
