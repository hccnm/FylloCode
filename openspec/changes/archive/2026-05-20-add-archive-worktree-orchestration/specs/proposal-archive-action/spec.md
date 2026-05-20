## MODIFIED Requirements

### Requirement: Archive action resumes the completed apply session

系统 SHALL 在触发归档时，复用已完成 apply stage 的 ACP session id，并使用 `proposal-archive` stage type 构造归档 prompt。归档 prompt SHALL 仅指明归档目标，不在 prompt 文本中重复编排具体步骤：

`归档 {changeId}`

具体的 sync 主 spec / archive-change 文件移动 / git commit / merge 进 main / worktree cleanup 等操作 SHALL 由 archive system-reminder 与 `archive-change` MCP tool 的 `tool_instruction` 共同保障。归档 prompt SHALL NOT 出现 "提交代码" / "merge" / "worktree" / "commit" 等编排关键词。

归档流程 SHALL 使用与 stage stream 相同的 MessagePort 流式传输方式。归档 ACP session 的 cwd SHALL 为 `runMeta.worktreePath ?? projectPath`（P1 通路）。

#### Scenario: Archive starts successfully

- **WHEN** 用户触发归档且存在已完成的 apply run
- **THEN** main process 恢复最后一个 completed apply stage 的 ACP session
- **AND** 发送的 archive prompt 文本严格等于 `归档 {changeId}`
- **AND** prompt 文本不含 `提交代码` / `merge` / `worktree` / `commit` 字符串
- **AND** ACP session cwd 等于 `runMeta.worktreePath ?? projectPath`
- **AND** renderer 收到 chunk、done 和 error 事件

#### Scenario: No completed apply run

- **WHEN** 用户触发归档但没有可复用的 completed apply run
- **THEN** 系统返回错误（沿用现有 `APPLY_RUN_NOT_READY` 错误语义）

## ADDED Requirements

### Requirement: Archive completes 4-step git cleanup when worktreePath is non-empty

archive 阶段完成 OpenSpec 文件归档移动与归档 commit 后，当 `runMeta.worktreePath` 非空时，agent SHALL 在 archive system-reminder 编排下用 Bash 执行以下 4 步 git 收尾：

1. `git -C {{mainProjectPath}} merge --ff-only proposal/{{changeId}}`
2. `git -C {{mainProjectPath}} worktree remove {{worktreePath}}`
3. `git -C {{mainProjectPath}} branch -d proposal/{{changeId}}`

（commit 步骤位于 archive-change 文件移动之后、merge 之前，已由 archive.txt 的 `<rules>` / `<critical>` 段约束。）

merge 操作 SHALL 使用 `--ff-only`，SHALL NOT 自动 fall back 到普通 merge / rebase。worktree remove SHALL NOT 使用 `--force`。branch delete SHALL NOT 使用 `-D` 强删。

任一步失败时 archive ACP session SHALL 把 stderr 完整复述给用户，archive ACP session 不自动重试、不自动 fall back。后续动作（rebase / 普通 merge / `--force`）由用户决策并通过对话告知 agent。

archive ACP session 在 4 步全部成功后 SHALL：

- 主仓库 `git -C {{mainProjectPath}} log` 当前分支头部含归档 commit；
- `git -C {{mainProjectPath}} worktree list` 不再含 `{{worktreePath}}`；
- `git -C {{mainProjectPath}} branch` 不再含 `proposal/{{changeId}}`。

#### Scenario: 全成路径

- **WHEN** archive ACP session 在 worktreePath 非空的 ApplyRunMeta 上启动
- **AND** archive-change confirm:true 完成 OpenSpec 文件移动
- **AND** agent 完成归档 commit
- **AND** main 自 worktree 创建后未被推进
- **THEN** agent 执行 `git -C <main> merge --ff-only proposal/<changeId>` 成功
- **AND** agent 执行 `git -C <main> worktree remove <worktreePath>` 成功
- **AND** agent 执行 `git -C <main> branch -d proposal/<changeId>` 成功
- **AND** 磁盘上 worktree 目录不存在
- **AND** main 当前分支 HEAD 含归档 commit

#### Scenario: merge 冲突

- **WHEN** main 在 worktree 创建后被推进
- **AND** agent 执行 `git -C <main> merge --ff-only proposal/<changeId>`
- **THEN** 命令失败，stderr 含 "Not possible to fast-forward"
- **AND** agent 把 stderr 完整复述给用户
- **AND** agent 不自动尝试普通 merge 或 rebase
- **AND** agent 不执行后续 worktree remove / branch -d
- **AND** archive ACP session 等待用户进一步指示

#### Scenario: worktree remove 被锁定文件占用

- **WHEN** merge --ff-only 已成功
- **AND** worktree 内某文件被外部进程锁定
- **AND** agent 执行 `git -C <main> worktree remove <worktreePath>`
- **THEN** 命令失败，stderr 含 locking error
- **AND** agent 把 stderr 完整复述给用户
- **AND** agent 不自动加 `--force`
- **AND** 后续 branch -d 不执行（因 worktree 仍占用分支）

#### Scenario: branch delete 失败

- **WHEN** merge / worktree remove 已成功
- **AND** agent 执行 `git -C <main> branch -d proposal/<changeId>`
- **AND** 由于历史异常（如用户曾 reset main），git 报 "branch is not fully merged"
- **THEN** stderr 复述用户
- **AND** agent 不自动 `-D` 强删

### Requirement: Archive skips git cleanup when worktreePath is empty

archive 阶段在 `runMeta.worktreePath` 为空字符串或 `undefined` 时，SHALL 跳过 4 步 git 收尾，仅完成 archive-change 文件移动 + 归档 commit；行为完全等价于 multi-worktree 工作流引入前。

archive system-reminder 文本 SHALL 在 `<worktree>` 段开头明确这一降级条件，让 agent 通过对 `{{worktreePath}}` 占位符渲染结果的判断（空字符串 vs 非空字符串）选择路径。

#### Scenario: 非 git 项目 archive

- **WHEN** `<projectPath>/.git` 不存在
- **AND** runMeta.worktreePath 为 `undefined`
- **AND** 用户触发 archive
- **THEN** archive ACP session cwd 等于 projectPath（P1 fallback）
- **AND** archive system-reminder 渲染后的 `{{worktreePath}}` 为空字符串
- **AND** agent 完成 archive-change + commit 后**不**执行 merge / worktree remove / branch -d
- **AND** archive 行为与 multi-worktree 工作流引入前完全等价

#### Scenario: 旧 ApplyRunMeta archive

- **WHEN** runMeta 为 P3 启用前持久化的 JSON（不含 worktreePath 字段）
- **AND** 用户触发 archive
- **THEN** runMeta.worktreePath 反序列化为 `undefined`
- **AND** archive 行为与多 worktree 工作流引入前完全等价
- **AND** 不报错、不留遗留 worktree
