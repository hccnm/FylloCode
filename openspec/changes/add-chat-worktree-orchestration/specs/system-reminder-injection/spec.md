## ADDED Requirements

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

## MODIFIED Requirements

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
