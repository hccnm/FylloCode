## ADDED Requirements

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
