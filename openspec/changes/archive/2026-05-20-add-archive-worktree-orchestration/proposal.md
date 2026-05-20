## Why

P2 让 chat 阶段在 `<projectPath>/.worktrees/<changeName>/` 下创建 worktree 与 OpenSpec change；P3 让 list 能扫到 worktree 来源的 change，apply 阶段 ACP cwd 自然落到 worktree。但 archive 阶段的清理路径（commit OpenSpec 归档移动、`merge --ff-only` 进 main、`worktree remove`、`branch -d`）目前没有任何编排——archive ACP session 虽然 cwd 已是 worktree（P1 通路），但当前 `archive.txt` system-reminder 与 stage-prompts 都没说怎么把 worktree 干净地合回 main 仓库。结果是：archive 完成后 worktree 长期残留在磁盘上，main 仓库看不到归档 commit，多 worktree 隔离反而留下更多孤儿目录。

P4 让 archive 阶段的 agent 在 `archive.txt` system-reminder 编排下完成 4 步 git 收尾，把 OpenSpec 归档结果 fast-forward 进 main，再清理 worktree——multi-worktree 工作流闭环。

## What Changes

- **MODIFIED `archive.txt` system-reminder 模板**：在现有 `<rules>` / `<critical>` 段基础上新增 `<worktree>` 段（位于 `<context>` 之后、`<rules>` 之前）。段内明确 4 步收尾顺序与命令模板：
  1. 调 `mcp__fyllo_specs__archive-change` `confirm:true`，让 OpenSpec 归档移动落到 worktree 内的 `archive/<date>-<changeId>/`（MCP 仅做文件移动，不碰 git）。
  2. agent 自己用 Bash 执行 `git -C {{worktreePath}} add . && git -C {{worktreePath}} commit -m "<commit message>"`；commit message 按现有 `archive.txt` `<critical>` 段已规定的 `type(scope): summary` 模板（如 `chore(openspec): archive <changeId>`），可结合 chat 上下文细化。
  3. `git -C {{mainProjectPath}} merge --ff-only proposal/{{changeId}}`；非 fast-forward 失败时把 stderr 完整复述给用户，让用户决定 rebase 或普通 merge。
  4. `git -C {{mainProjectPath}} worktree remove {{worktreePath}} && git -C {{mainProjectPath}} branch -d proposal/{{changeId}}`；remove 失败（典型：编辑器锁定文件）或 branch -d 失败（典型：未完全合并）时把 stderr 复述给用户。
- **MODIFIED archive.txt `<critical>` 段**：在已有的 `MUST follow the order: sync → archive → commit` 基础上扩展为 `sync → archive → commit → merge → worktree-cleanup`；新增 `MUST run merge as --ff-only and stop on failure (no force, no普通 merge auto-fallback)`、`MUST clean up worktree only after merge succeeds`。
- **MODIFIED archive prompt（`stage-prompts.ts` 中 `proposal-archive` runner）**：从 `归档 {changeId} 并提交代码` 精简为 `归档 {changeId}`。具体的 sync / archive / commit / merge / worktree-cleanup 编排全部交给 `archive.txt` system-reminder 与 `mcp__fyllo_specs__archive-change` 的 `tool_instruction`；prompt 不再重复编排（不重复表述就不会出现表述漂移）。
- **MODIFIED `proposal-archive-action` spec**：删去原 spec 中"`archive prompt` 携带 sync 主 spec / commit message 模仿最近记录"那段具体文案要求；改为"prompt 仅指明归档目标，sync / commit / merge / worktree 收尾由 archive system-reminder 与 archive-change tool 共同保障"。新增 SHALL：archive 完成后 worktree 须被移除、`proposal/{{changeId}}` 分支须被删除；如 merge / remove 任一步失败，archive ACP session 须把 stderr 透传用户，**不**自动重试。
- **MODIFIED `system-reminder-injection` spec**（轻微）：`archive.txt` 模板正文 SHALL 含 `<worktree>` 段，引用 `{{worktreePath}}`、`{{mainProjectPath}}`、`{{changeId}}` 占位符（`changeId` 在 archive 阶段对应 archive 操作的目标 change，与 reminderContext.changeId 一致）。
- 不修改 MCP 工具实现：`archive-change` 的 confirm 阶段仍只做 OpenSpec 文件移动；不引入 git 子进程。
- 不修改 `proposal-apply.ts` 的 archive handler：cwd / reminderContext / agentId 由 P1 已就绪的通路提供；只改 `stage-prompts.ts` 的一行 prompt。
- 非 git 项目（`<mainProjectPath>/.git` 不存在或 ApplyRunMeta.worktreePath 为 undefined）：archive.txt 显式说明此情况下跳过 git 编排（merge / worktree remove / branch delete 全部 skip），仅做 archive-change + 现有 commit 步骤；这与 P3 之前的 archive 行为完全等价。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `proposal-archive-action`：archive prompt 精简；archive 完成后 worktree / branch 须被清理；merge --ff-only 失败由 agent 接手。
- `system-reminder-injection`：`archive.txt` 模板正文新增 `<worktree>` 段，引用 worktreePath / mainProjectPath / changeId 占位符。

## Impact

**代码**

- `electron/main/services/chat/system-reminder/templates/archive.txt`：新增 `<worktree>` 段、`<critical>` 段扩展。
- `electron/main/services/proposal/stage-prompts.ts`：`proposal-archive` runner 文案精简。
- `electron/main/__tests__/ipc/proposal-apply.spec.ts`：archive prompt 文案断言同步更新（如有）。
- `electron/main/services/chat/system-reminder/__tests__/`：archive 模板渲染单测覆盖 `worktreePath` 非空 / undefined 两种渲染。

**用户可见变化**

- archive 完成后，worktree 目录被自动删除；main 仓库当前分支多一次 fast-forward merge commit，含归档移动。
- 非 git 项目 / 旧 ApplyRunMeta（worktreePath undefined）archive 行为与改造前等价。
- merge 冲突或 worktree 文件被占用时，agent 会把 stderr 复述给用户，archive ACP session 进入"等待用户处理"状态——不自动重试、不强行 push 通过。

**依赖**

无新增依赖。所有 git 命令由 agent 用现有 Bash 工具执行。

**风险**

- agent 编排 4 步 git 序列时漂移（中高）：可能跳步、合并 commit、用错 cwd（worktreePath vs mainProjectPath）。缓解：archive.txt 文本写明每步命令模板与 cwd；上线后 dogfood 1-2 周。
- merge --ff-only 失败的 fallback 不自动恢复（中）：用户需手动决策 rebase / 普通 merge。缓解：reminder 文本明确把 stderr 复述给用户作为唯一兜底，不让 agent 自行重试。
- worktree remove 失败导致后续 list 重影（低）：用户编辑器仍打开 worktree 内文件时 `git worktree remove` 会失败。缓解：reminder 让 agent 复述 stderr 并提示用户关闭编辑器；用户手动执行 `git worktree remove --force` 或 P3 列表里看到孤儿条目自行处理。
- 旧 ApplyRunMeta（worktreePath 为空）的 archive 流误触发 git 编排（低）：reminder 文本第 1 步写明"`{{worktreePath}}` 为空时跳过 4 步收尾，沿用 archive-change + commit 经典流程"。

**回滚**

- 把 `archive.txt` 中的 `<worktree>` 段删除、`<critical>` 段恢复为原 5 条 SHALL；`stage-prompts.ts` 的 `proposal-archive` 行恢复为 `归档 ${changeId} 并提交代码`。
- spec 在 OpenSpec 中走反向 delta change（unarchive 的等价），实际工程操作由人工还原。
- worktreePath 字段、ACP cwd fallback、archive-change tool 行为均不变（P1/P3 的能力保留），回滚仅退化 archive 阶段的清理行为。
