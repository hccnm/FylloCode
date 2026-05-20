# system-reminder-injection Specification

## Purpose

定义主进程在 ACP session 新建时，按 owner 分发并持久化一次性 system-reminder 的能力，以及前端对该 reminder 的隐藏约束。

## Requirements

### Requirement: 主进程全权控制 system-reminder 注入

系统 SHALL 在主进程内提供 `resolveSystemReminder(ctx: SystemReminderContext): Promise<TextUIPart | null>` 函数，按 `owner` 分派到对应 provider。返回非 null 时返回值 SHALL 为 `TextUIPart`（`ai` 包中的类型，形如 `{ type: "text", text: string }`），其 `text` 字段首位为 `<system-reminder>`、末位为 `</system-reminder>`（允许内部换行）。返回 null 表示不注入。

`SystemReminderContext` 的字段 SHALL 为：`owner`（复用 `@main/services/chat/session-registry#SessionOwner`，即 `"chat" | "apply" | "archive"`）、`projectPath`、`cwd`、`fylloSessionId`、`agentId`、以及可选的 `changeId` / `stageIndex` / `runId`。

reminder 相关代码（provider、模板、类型）SHALL 全部位于 `electron/main/services/chat/system-reminder/`，`frontend/` 与 `electron/preload/` SHALL NOT import 该目录下的任何模块。系统 SHALL NOT 新增任何 IPC 通道、preload 暴露、`shared/` 类型，用以让用户或渲染进程影响 reminder 内容或触发时机。

#### Scenario: 已注册的 owner 返回 TextUIPart

- **WHEN** 使用 `owner ∈ {"chat", "apply", "archive"}` 调用 `resolveSystemReminder`
- **AND** 对应 provider 存在且模板插值成功
- **THEN** 返回 `TextUIPart`（`type === "text"`），其 `text` 经 trim 后以 `<system-reminder>` 开头、以 `</system-reminder>` 结尾

#### Scenario: 未识别 owner 返回 null

- **WHEN** `owner` 不在已注册 provider 列表中
- **THEN** 返回 `null`
- **AND** 不抛出异常

### Requirement: 注入判定严格绑定 `connection.newSession()` 成功调用

系统 SHALL 在 `AcpSession.start` 的生命周期内，仅当本次调用执行了 `connection.newSession()` 并成功返回时，才执行 system-reminder 注入。`resumeSession` 成功时 SHALL NOT 注入。

系统 SHALL NOT 使用 `sessionMeta.turnCount`、任何实例级 `hasInjected` 标志、或 `wasResumed` 参数作为判定依据。

#### Scenario: 真·首次发送消息时注入

- **WHEN** `AcpSession.start` 被调用，且对应 `fylloSessionId` 无持久化的 `acpSessionId`
- **THEN** 系统调用 `connection.newSession()`
- **AND** 在 `newSession` 成功返回后、`connection.prompt()` 调用前，解析并注入 system-reminder

#### Scenario: resumeSession 成功时不注入

- **WHEN** `AcpSession.start` 被调用，且对应 `fylloSessionId` 有持久化 `acpSessionId`
- **AND** `connection.resumeSession(...)` 成功返回
- **THEN** 系统 SHALL NOT 注入 system-reminder
- **AND** `connection.prompt()` 的 `prompt` 数组结构保持为单一 user text block

#### Scenario: resumeSession 失败降级到 newSession 时注入

- **WHEN** `connection.resumeSession(...)` 抛出异常
- **AND** 系统降级调用 `connection.newSession()` 并成功返回
- **THEN** 系统 SHALL 按首次分支执行 reminder 注入

### Requirement: Reminder 以独立 text block 注入 ACP prompt 数组

系统 SHALL 将 `resolveSystemReminder` 返回的 `TextUIPart` 直接放入 `connection.prompt()` 的 `prompt` 数组**首位**，随后跟随原有的 user text block，即 `prompt: [reminderPart, { type: "text", text: userPrompt }]`。

系统 SHALL NOT 将 reminder 文本与 user prompt 拼接为单个 text block。

#### Scenario: 注入时 prompt 数组为 `[reminder, user]`

- **WHEN** 注入条件满足且 `resolveSystemReminder` 返回非 null
- **THEN** `connection.prompt` 调用参数的 `prompt` 字段为两元素数组，第一个 element 为 reminder text block，第二个 element 为 user text block

#### Scenario: 无 reminder 时 prompt 数组为 `[user]`

- **WHEN** 注入条件满足但 `resolveSystemReminder` 返回 `null`
- **THEN** `connection.prompt` 调用参数的 `prompt` 字段为单元素数组，仅含 user text block

### Requirement: Reminder 持久化到 user message 的 parts 首位

系统 SHALL 在 reminder 注入发生时，将 `resolveSystemReminder` 返回的 `TextUIPart` **pre-pend 到当前 owner 对应 `*.messages.jsonl` 中最后一条 `role === "user"` 消息的 `parts` 数组首位**，随后才调用 `connection.prompt()`。

系统 SHALL 提供磁盘原语 `prependReminderToLastUserMessage(filePath, reminderPart): Promise<void>`，三个 owner（chat / apply / archive）通过传入不同 jsonl 路径复用同一实现。原语实现 SHALL 为"全量读取 jsonl → 定位最后一条 `role === "user"` 消息 → 在其 `parts[0]` 位置插入 reminder part → 全量覆盖写回"。

持久化到磁盘的 reminder part 的 `type` 字段 SHALL 固定为 `"text"`（即 `TextUIPart`），系统 SHALL NOT 新增自定义 `part.type` 值。

系统 SHALL NOT 为 reminder 创建独立的 `UIMessage`，也 SHALL NOT 通过 sink 把 reminder chunk 同步到渲染进程的内存消息容器。"渲染进程当前 turn 内存中的 user message 与磁盘 user message 的 parts 结构不一致"是预期行为，不是缺陷。

#### Scenario: chat owner 把 reminder 写入 `<sessionId>.messages.jsonl`

- **WHEN** chat owner 满足注入条件并完成注入
- **THEN** 系统更新 `sessions/<sessionId>.messages.jsonl` 中当前 turn 的 user 消息，`parts[0]` 为 reminder text part（`type === "text"`）

#### Scenario: apply owner 把 reminder 写入 `stage-{N}.messages.jsonl`

- **WHEN** apply owner 满足注入条件并完成注入
- **THEN** 系统更新对应 `apply-runs/<changeId>/stage-{stageIndex}.messages.jsonl` 中的 user 消息，`parts[0]` 为 reminder text part

#### Scenario: archive owner 把 reminder 写入 `archive.messages.jsonl`

- **WHEN** archive owner 满足注入条件并完成注入
- **THEN** 系统更新 `apply-runs/<changeId>/archive.messages.jsonl` 中的 user 消息，`parts[0]` 为 reminder text part

#### Scenario: 持久化失败不阻塞 prompt 继续

- **WHEN** `prependReminderToLastUserMessage`（由 `onReminderInjected` 钩子调用）抛出异常
- **THEN** `AcpSession.start` 捕获异常并通过 `logger.error` 记录
- **AND** 不再上抛、不中断 stream
- **AND** 仍继续把 reminder block 加入 ACP prompt 数组并调用 `connection.prompt()`

### Requirement: 模板变量白名单与 sanitize

系统 SHALL 使用文本模板（每个 owner 一份 `.md` 或 `.txt` 文件）配合白名单变量插值生成 reminder 正文。允许的变量名 SHALL 限定为 `{{changeId}}`、`{{stageIndex}}`、`{{runId}}`、`{{projectPath}}`、`{{worktreePath}}`、`{{mainProjectPath}}`；其他 `{{...}}` 占位符保持字面量不替换。

`{{worktreePath}}` 与 `{{mainProjectPath}}` 的取值规则：

- `{{worktreePath}}` 取自 `SystemReminderContext.worktreePath`；为 `undefined` 时按 sanitize 流程渲染为空字符串 `""`。
- `{{mainProjectPath}}` 是 `SystemReminderContext.projectPath` 的别名（值完全等同），仅作为模板叙述的语义化变量名，方便在 worktree 编排段落中明确区分"主仓库路径"与"worktree 路径"。

若任一白名单变量的实际值包含 `<` 或 `>` 字符，provider SHALL 返回 `null`（跳过该 session 的 reminder 注入），并通过 `logger.warn` 记录。日志字段 SHALL 至少包含 `owner`、被拒字段名、`fylloSessionId`。

系统 SHALL 提供内部 util `wrapAsSystemReminder(body: string): string`，以 `<system-reminder>\n{body}\n</system-reminder>` 包裹正文。若 `body` 字面量已包含 `<system-reminder>` 或 `</system-reminder>` 字符串，`wrapAsSystemReminder` SHALL 抛 `Error`（开发期即暴露模板错误，不做静默 sanitize）。该 util 不对外导出给 IPC handler。

#### Scenario: 白名单变量被替换

- **WHEN** provider 读取模板，上下文提供 `changeId = "add-foo-bar"`
- **THEN** 模板中的 `{{changeId}}` 被替换为 `"add-foo-bar"`

#### Scenario: 非白名单占位符保留字面量

- **WHEN** 模板中出现 `{{unknownField}}`
- **THEN** 渲染后仍为 `{{unknownField}}` 字符串

#### Scenario: worktreePath 占位符替换

- **WHEN** provider 读取模板，上下文 `worktreePath = "<mainRepo>/.worktrees/foo"`
- **THEN** 模板中的 `{{worktreePath}}` 被替换为该字符串字面量

#### Scenario: worktreePath 为 undefined 时渲染空字符串

- **WHEN** provider 读取模板，上下文 `worktreePath` 为 `undefined`
- **THEN** 模板中的 `{{worktreePath}}` 被替换为空字符串

#### Scenario: mainProjectPath 是 projectPath 别名

- **WHEN** provider 读取模板，上下文 `projectPath = "/Users/foo/myapp"`
- **THEN** 模板中的 `{{mainProjectPath}}` 被替换为 `/Users/foo/myapp`
- **AND** 模板中同时存在的 `{{projectPath}}` 也被替换为相同字符串

#### Scenario: 变量值含尖括号时跳过注入

- **WHEN** 任一白名单变量（包含 `worktreePath` / `mainProjectPath`）的值含 `<` 或 `>` 字符
- **THEN** provider 返回 `null`
- **AND** 写入 `logger.warn` 日志，至少包含 owner、被拒字段名、`fylloSessionId`

#### Scenario: 模板正文已含 system-reminder 标签时抛错

- **WHEN** `wrapAsSystemReminder(body)` 被调用，`body` 字面量包含 `<system-reminder>` 或 `</system-reminder>` 字符串
- **THEN** 抛 `Error`
- **AND** provider 将该异常冒泡（非 sanitize 能处理的 user 输入，是模板 bug）

### Requirement: chat reminder 编排 worktree 创建

`chat.txt` system-reminder 模板正文 SHALL 包含一个 `<worktree>` 段（位于 `<rules>` 段尾、`<critical>` 段之前），明确以下编排步骤，用户每次同意 propose 时由 agent 用 Bash 执行：

1. **non-git 项目自检**：`git -C {{mainProjectPath}} rev-parse --is-inside-work-tree`；失败时跳过 worktree 编排，直接以 `targetPath: {{mainProjectPath}}` 调 create-proposal。
2. **维护主仓库 .gitignore**（仅首次需要）：检查并追加 `.worktrees/` 行；追加后 `git add .gitignore && git commit -m "chore: ignore .worktrees"`；commit 失败时把 stderr 完整复述给用户，由用户决定下一步。
3. **创建 worktree**：`git -C {{mainProjectPath}} worktree add .worktrees/<changeName> -b proposal/<changeName>`；记录绝对路径 `{{mainProjectPath}}/.worktrees/<changeName>`；失败（含 changeName 重名）把 stderr 完整复述给用户。
4. **调 create-proposal**：`mcp__fyllo_specs__create-proposal targetPath=<worktree 绝对路径>`，工具内部不创建 worktree、不修改 git 状态。
5. **多 change 语义**：同一 chat session 允许孵化多个 change，每个 change 独立 worktree；用户表述模糊（例 "刚才那个 change"）且历史中存在多个 worktreePath 时，agent 必须先反问目标。
6. **路径口径**：chat session cwd 仍为主仓库；后续 chat 内对 worktree artifacts 的 Read / Edit 必须用绝对路径。

`<worktree>` 段 SHALL 不出现 `git merge` / `git push` / `git worktree remove` / `git branch -d` 等任何 archive 阶段才会用到的命令——chat 阶段只负责创建 worktree，清理工作由 P4 的 archive 阶段编排。

`<worktree>` 段 SHALL 不指示 agent 主动调用 `mcp__fyllo_specs__apply-change` 或 `mcp__fyllo_specs__archive-change`——chat 阶段的核心职责未变，仍然在 propose 后等待用户进入 Apply / Archive 阶段。

#### Scenario: chat reminder 包含 worktree 编排

- **WHEN** 主进程为 chat owner 渲染 system-reminder 文本
- **THEN** 文本中包含 `<worktree>` 与 `</worktree>` 两个标签
- **AND** 标签之间的内文包含 `git worktree add` 字符串
- **AND** 标签之间的内文包含 `mcp__fyllo_specs__create-proposal` 与 `targetPath` 字符串
- **AND** 标签之间的内文不包含 `git merge` / `git worktree remove` / `git branch -d` 字符串

#### Scenario: chat reminder 不修改既有 chat stage 行为约束

- **WHEN** 主进程为 chat owner 渲染 system-reminder 文本
- **THEN** 文本仍含 `<authority>` / `<context>` / `<rules>` / `<critical>` 段
- **AND** `<rules>` 段中"MUST NOT modify code directly" / "MUST ask at most one question per turn" / "MUST obtain explicit user consent before calling create-proposal" 等既有 SHALL 全部保留
- **AND** `<worktree>` 段位于 `<rules>` 段尾、`<critical>` 段之前

### Requirement: apply reminder 暴露 worktreePath

`apply.txt` system-reminder 模板正文 SHALL 包含一个 `<worktree>` 段（位于 `<context>` 段之后、`<rules>` 段之前），向 agent 暴露当前 stage 的工作目录：

- 渲染 `{{worktreePath}}` 占位符（取自 `SystemReminderContext.worktreePath`，undefined 时自动渲染为空字符串）。
- 文本中明确说明"空字符串表示当前 stage 的 cwd 是主仓库"。
- 文本中明确说明"业务代码改动产生的 commit 由 agent 自己完成；archive 阶段不会替你 commit 业务代码"。

#### Scenario: apply reminder 含 worktreePath 占位符段

- **WHEN** 主进程为 apply owner 渲染 system-reminder 文本
- **AND** ApplyRunMeta.worktreePath 为非空字符串 `<mainRepo>/.worktrees/foo`
- **THEN** 渲染后的文本包含 `<worktree>` 标签
- **AND** 标签之间的内文包含字面量 `<mainRepo>/.worktrees/foo`（`{{worktreePath}}` 已替换）

#### Scenario: apply reminder worktreePath 为空时显式说明含义

- **WHEN** 主进程为 apply owner 渲染 system-reminder 文本
- **AND** ApplyRunMeta.worktreePath 为 `undefined`（旧 ApplyRunMeta 或 P3 未启用）
- **THEN** 渲染后的文本仍包含 `<worktree>` 标签
- **AND** `{{worktreePath}}` 占位符渲染为空字符串
- **AND** 标签之间的内文包含明确叙述："空字符串"或"空值"代表主仓库 cwd

#### Scenario: apply reminder 仍保留既有 apply stage 行为约束

- **WHEN** 主进程为 apply owner 渲染 system-reminder 文本
- **THEN** 文本仍含 `<authority>` / `<context>` / `<rules>` / `<critical>` 段
- **AND** 现有 SHALL（"MUST read state.contextFiles"、"MUST work one task at a time" 等）全部保留

### Requirement: archive reminder 编排 worktree 4 步收尾

`archive.txt` system-reminder 模板正文 SHALL 包含一个 `<worktree>` 段（位于 `</context>` 闭合标签之后、`<rules>` 开始标签之前），段内 SHALL 明确以下内容：

- 当 `{{worktreePath}}` 占位符渲染为空字符串时，agent 跳过 git 编排，仅完成 archive-change + 归档 commit。
- 当 `{{worktreePath}}` 渲染为非空字符串时，archive-change 完成 OpenSpec 文件移动后，agent 用 Bash 执行 4 步 git 收尾：
  1. `git -C {{worktreePath}} add -A && git -C {{worktreePath}} commit -m "<commit message>"`（commit message 仍按 `<rules>` / `<critical>` 段已规定的 `type(scope): summary` 模板，scope 用 `openspec`）。
  2. `git -C {{mainProjectPath}} merge --ff-only proposal/{{changeId}}`；失败 stderr 复述用户、不自动 fall back。
  3. `git -C {{mainProjectPath}} worktree remove {{worktreePath}}`；失败 stderr 复述用户、不加 `--force`。
  4. `git -C {{mainProjectPath}} branch -d proposal/{{changeId}}`；失败 stderr 复述用户、不 `-D`。

`<worktree>` 段 SHALL 引用以下三个白名单占位符（已由 P2 添加到 `ALLOWED_VARIABLES`）：`{{worktreePath}}`、`{{mainProjectPath}}`、`{{changeId}}`。SHALL NOT 引用 `branchName` 等其他占位符——分支名 `proposal/{{changeId}}` 以字面量出现。

`<critical>` 段 SHALL 包含以下新增 SHALL 条款（与原有 SHALL 并列，原有内容保留）：

- 完整顺序为 `sync → archive → commit → merge → worktree-cleanup`，禁止重排或跳步；merge / cleanup 仅在 `{{worktreePath}}` 非空时执行。
- merge 必须用 `git merge --ff-only`，失败时停止，禁止 force / 自动普通 merge fall back。
- worktree cleanup 仅在 merge 成功后执行；merge 失败时禁止执行 worktree remove / branch delete。
- 禁止 `worktree remove --force` / `branch -D`；失败 stderr 由用户决定 force。

#### Scenario: archive reminder 含 worktree 段

- **WHEN** 主进程为 archive owner 渲染 system-reminder 文本
- **THEN** 文本含 `<worktree>` 与 `</worktree>` 闭合标签
- **AND** 标签之间内文含 `git -C {{mainProjectPath}} merge --ff-only proposal/{{changeId}}` 模板（占位符渲染后的字面量）
- **AND** 标签之间内文含 `git -C {{mainProjectPath}} worktree remove` 与 `git -C {{mainProjectPath}} branch -d proposal/{{changeId}}` 模板
- **AND** `<critical>` 段含 `merge --ff-only` 字符串
- **AND** `<critical>` 段含禁止 `--force` / `-D` 强删的 SHALL 描述

#### Scenario: archive reminder worktreePath 为空时显式说明降级

- **WHEN** runMeta.worktreePath 为 `undefined`
- **THEN** `<worktree>` 段开头明确说明 "若 `{{worktreePath}}` 为空字符串，跳过本段全部 git 编排"
- **AND** `{{worktreePath}}` 占位符在该段中被渲染为空字符串
- **AND** agent 收到 reminder 后跳过 4 步 git 收尾

#### Scenario: archive prompt 文案精简

- **WHEN** main process 为 `proposal-archive` stage type 构造 prompt
- **THEN** prompt 文本严格等于 `归档 {changeId}`
- **AND** prompt 文本不含 "提交代码" / "merge" / "worktree" / "commit" 等编排关键词
- **AND** worktree 收尾步骤完全由 archive system-reminder 与 archive-change tool_instruction 共同保障

#### Scenario: archive reminder 既有 SHALL 全部保留

- **WHEN** 主进程为 archive owner 渲染 system-reminder 文本
- **THEN** 文本仍含 `<authority>` / `<context>` / `<rules>` / `<critical>` 既有段
- **AND** 既有 SHALL 全部保留（commit subject 格式 `type(scope): summary`、commit only change-related files、不能 bypass MCP 等）
- **AND** `<worktree>` 段位于 `</context>` 闭合后、`<rules>` 开始前
