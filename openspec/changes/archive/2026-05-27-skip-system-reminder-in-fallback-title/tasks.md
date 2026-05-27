## 1. 调整 fallback 标题取文逻辑

- [x] 1.1 修改 `frontend/src/stores/chat.ts`：在文件头部 `import { useUIMessageAssembler } ...` 之后，新增 `import { isSystemReminderPart } from "@renderer/utils/system-reminder";`
- [x] 1.2 修改 `frontend/src/stores/chat.ts` 中 `getPrimaryText(parts: ChatPromptPart[])`：将 `parts.find((part) => part.type === "text")` 改为 `parts.find((part) => part.type === "text" && !isSystemReminderPart(part))`，函数返回类型与签名保持不变；不要拆分函数、不要重命名、不要新增 helper
- [x] 1.3 不修改 `buildFallbackSessionTitle`、`FALLBACK_SESSION_TITLE_MAX_LENGTH`、`DEFAULT_SESSION_TITLE`、`/^\*\*标题\*\*:\s*(.+)$/m` 抽取分支与 `replace(/\s+/g, " ")` 归一逻辑——确认它们对收紧后的 `getPrimaryText` 结果继续生效（空字符串 → `DEFAULT_SESSION_TITLE`；非空 → 30 字截断 / `**标题**` 抽取）
- [x] 1.4 验收标准：`pnpm typecheck` 通过；`getPrimaryText` 的唯一调用方仍是 `buildFallbackSessionTitle`；不新增任何导出符号、不新增文件

## 2. 单元测试

- [x] 2.1 在 `frontend/src/__tests__/stores/chat.spec.ts` 现有 `describe('useChatStore', ...)` 中，紧邻 `it('uses a normalized truncated first message as fallback session title', ...)`（约第 406 行起），新增测试：
  - 名称：`it("skips system-reminder text part when building fallback session title", ...)`
  - 输入：`parts = [{ type: "text", text: "<system-reminder>\nhealth check\n</system-reminder>" }, { type: "text", text: "  hello\n\nworld   this message is intentionally long  " }]`
  - 期望：`chatApi.createSession` 调用参数 `title === "hello world this message is in"`（与既有用例一致的 30 字截断结果）
  - 期望：`sessionStore.activeSession?.title === "hello world this message is in"`
- [x] 2.2 在同一 `describe` 中新增测试：
  - 名称：`it("falls back to DEFAULT_SESSION_TITLE when all text parts are system-reminder", ...)`
  - 输入：`parts = [{ type: "text", text: "<system-reminder>\nonly reminder\n</system-reminder>" }]`
  - 期望：`chatApi.createSession` 调用参数 `title === "New Session"`
  - 期望：`sessionStore.activeSession?.title === "New Session"`
  - 复用现有 helper `textParts(...)` 写法不可行（reminder 字符串需要原样），直接构造数组传入 `chatStore.sendMessage`
- [x] 2.3 在同一 `describe` 中新增测试：
  - 名称：`it("extracts **标题** from the first non-reminder text part", ...)`
  - 输入：`parts = [{ type: "text", text: "<system-reminder>\nirrelevant\n</system-reminder>" }, { type: "text", text: "**标题**: 修复解析器内存泄漏\n\n更多说明" }]`
  - 期望：`chatApi.createSession` 调用参数 `title === "修复解析器内存泄漏"`
- [x] 2.4 验收标准：`pnpm test --filter chat.spec` 或 `pnpm test`（仓库无 filter 时）全部用例通过；既有 `uses a normalized truncated first message as fallback session title` 与 `allows session_info_update to override the fallback title` 用例无需修改且仍通过

## 3. 规范同步

- [x] 3.1 本 change 归档时由 OpenSpec 流程将 `openspec/changes/skip-system-reminder-in-fallback-title/specs/session-management/spec.md` 合并进 `openspec/specs/session-management/spec.md`；实现期间无需手动改 `openspec/specs/`
- [x] 3.2 评估是否需要更新本仓 `guidelines/`：本次改动属于纯前端 store 单点修复，未引入新模式或约定，**不需要**新增/更新 guidelines 文件；在 PR 描述中注明该判断结果即可

## 4. 手动验证

- [x] 4.1 `pnpm dev` 启动后，在已存在项目的页面点击 `ProjectHealthPopover` 的健康检查入口（触发 `buildHealthCheckReminder` + 用户提示词），确认左侧 sessions 列表中新建会话的标题显示为 `帮我根据当前项目技术栈检查：静态约束` 这类用户文本前 30 字，而不是 `<system-reminder>` 开头
- [x] 4.2 在普通 ChatPromptPanel 输入纯文本发送，确认会话标题行为与改动前一致（前 30 字截断）
- [x] 4.3 从 `task.vue` 的“发起讨论”入口创建会话，确认 `**标题**: <X>` 抽取行为不变
