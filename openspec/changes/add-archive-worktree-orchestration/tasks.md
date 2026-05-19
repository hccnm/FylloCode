## 1. archive prompt 文案精简

- [x] 1.1 修改 `electron/main/services/proposal/stage-prompts.ts`：把 `stageRunners["proposal-archive"]` 的实现从 `({ changeId }) => \`归档 ${changeId} 并提交代码\``改为`({ changeId }) => \`归档 ${changeId}\``。
- [x] 1.2 检查并更新 `electron/main/__tests__/ipc/proposal-apply.spec.ts`（line 79 附近 mock `buildArchiveStage`）：如果存在对 archive prompt 文本的断言，同步改为新文案；如果断言不涉及 prompt 文本，本步骤无需修改测试。
- [x] 1.3 在 `electron/main/services/proposal/__tests__/`（如不存在则建）创建/补充 `stage-prompts.spec.ts`，断言：
  - `buildStagePrompt({ stage: { type: "proposal-archive" }, changeId: "foo", projectPath: "/x" })` 返回字符串严格等于 `归档 foo`。
  - 该字符串不含 `提交代码` / `merge` / `worktree` / `commit` 子串。
- [x] 1.4 验收：`pnpm typecheck` 通过；`pnpm test electron/main` 全过。

## 2. archive.txt 模板新增 worktree 段

- [x] 2.1 修改 `electron/main/services/chat/system-reminder/templates/archive.txt`：在现有 `</context>` 闭合标签之后、`<rules>` 开始标签之前，插入完整的 `<worktree>` 段，内容严格按 design.md "archive.txt `<worktree>` 段（设计文本）" 节写入。
- [x] 2.2 文本必须含三个占位符：`{{worktreePath}}`、`{{mainProjectPath}}`、`{{changeId}}`。分支名以 `proposal/{{changeId}}` 字面量出现，不引入 `branchName` 占位符。
- [x] 2.3 文本第 1 段必须明确：`{{worktreePath}}` 为空字符串时跳过整段 4 步 git 编排，仅按 `<rules>` 完成 archive-change + 业务代码 commit。
- [x] 2.4 文本必须依次写出：
  - 1. commit OpenSpec 归档移动（`git -C {{worktreePath}} add -A && commit`）
  - 2. merge --ff-only 进 main（`git -C {{mainProjectPath}} merge --ff-only proposal/{{changeId}}`）
  - 3. worktree remove（`git -C {{mainProjectPath}} worktree remove {{worktreePath}}`）
  - 4. branch delete（`git -C {{mainProjectPath}} branch -d proposal/{{changeId}}`）
- [x] 2.5 每步必须明确"失败时把 stderr 完整复述给用户、不自动重试、不加 force"。

## 3. archive.txt 模板 critical 段扩展

- [x] 3.1 修改 `archive.txt` 的 `<critical priority="must-not-violate">` 段：把原有第一条 `MUST follow the order: sync → archive → commit. No reordering, no skipping.` 改为 `MUST follow the order: sync → archive → commit → merge → worktree-cleanup. No reordering, no skipping. Steps 4–5 only when `{{worktreePath}}` is non-empty.`
- [x] 3.2 在 `<critical>` 段中追加以下新 SHALL 条款（保留原有所有其他 SHALL）：
  - `MUST run merge as `git merge --ff-only`` and stop on failure (no force, no auto普通 merge fallback).`
  - `MUST clean up worktree only after merge succeeds.` worktree remove without successful merge would lose the archive commit.`
  - `MUST NOT use `worktree remove --force`/`branch -D`.` Failure stderr goes to the user; the user decides force.`
- [x] 3.3 验收：`<critical>` 段总条款数（既有 + 新增）= 既有 + 3；既有的 commit subject 格式 / commit only change-related files / 不能 bypass MCP / `archive-change` 必须传 `includeInstruction: true` 等条款全部保留。

## 4. 模板渲染单测扩展

- [x] 4.1 在 P2 已建的 `electron/main/services/chat/system-reminder/providers/__tests__/`（或同路径下新建 archive-specific 测试文件）追加用例：
  - 4.1.1 archive owner 渲染：传入 `worktreePath: "/abs/.worktrees/foo"`、`projectPath: "/abs"`、`changeId: "foo"` → 渲染后文本含 `<worktree>` 段、含字面量 `/abs/.worktrees/foo` 与 `proposal/foo` 字符串。
  - 4.1.2 archive owner 渲染：传入 `worktreePath: undefined` → 渲染后 `{{worktreePath}}` 替换为空字符串；文本仍含 `<worktree>` 段；段开头能找到"为空字符串时跳过 git 编排"的中文叙述。
  - 4.1.3 archive owner 渲染：`{{mainProjectPath}}` 与 `{{projectPath}}` 应渲染为同一字符串。
  - 4.1.4 archive owner 渲染：`changeId` 含特殊字符（如下划线）时占位符正常替换；`{{changeId}}` 与 `proposal/{{changeId}}` 都按规则渲染。
  - 4.1.5 任一字段含 `<` 或 `>` 字符时 `renderSystemReminderTemplate` 返回 `null`、`logger.warn` 被调用。
- [x] 4.2 验收：上述 5 条用例全过；`pnpm test electron/main/services/chat/system-reminder` 全过。

## 5. dogfood 与零回归验证

- [ ] 5.1 准备：FylloCode 自身仓库（git 项目）。前置 P1 / P2 / P3 都已 archive 落 `openspec/specs/`；本任务在 P3 完成基础上落地。
- [ ] 5.2 全成路径 dogfood：
  - 5.2.1 chat 阶段创建一个新 change（worktree 创建落 `.worktrees/<changeName>`）。
  - 5.2.2 走完 apply（任意 stage）。
  - 5.2.3 触发 archive；从 logger 与 messages.jsonl 中确认：
    - archive prompt 文本严格等于 `归档 <changeName>`（不含"提交代码"等）。
    - archive system-reminder 含 `<worktree>` 段；段内 `{{worktreePath}}` 渲染为绝对路径。
    - agent 依次执行 `archive-change confirm:true` → 在 worktree commit OpenSpec 归档移动 → `git -C <main> merge --ff-only proposal/<changeName>` → `git -C <main> worktree remove <wt>` → `git -C <main> branch -d proposal/<changeName>`。
  - 5.2.4 archive 完成后磁盘验证：
    - `<projectPath>/.worktrees/<changeName>/` 不存在。
    - `git -C <main> worktree list` 不含该 worktree。
    - `git -C <main> branch` 不含 `proposal/<changeName>`。
    - main 当前分支 HEAD 含归档 commit（`git log -1` 可见），commit 内文件包含 OpenSpec 文件归档移动。
- [ ] 5.3 merge 冲突 dogfood：
  - 5.3.1 chat 阶段创建 worktree change，apply 完成。
  - 5.3.2 在 archive 触发**之前**，给 main 加一个不相关的 commit（例如 `git -C <main> commit --allow-empty -m "trigger conflict"`），让 main 推进到 worktree 创建之后。
  - 5.3.3 触发 archive。预期：agent 完成 archive-change + commit 后执行 merge --ff-only 失败，stderr 含 "Not possible to fast-forward"；agent 把 stderr 完整复述给用户；agent **不**继续执行 worktree remove / branch delete；archive ACP session 等待用户。
  - 5.3.4 验证 worktree 与 branch 仍保留（用户可手动 rebase 或普通 merge 后再继续）。
- [ ] 5.4 worktreePath 为空 dogfood（旧 ApplyRunMeta）：
  - 5.4.1 找一个 P3 启用之前的 ApplyRunMeta JSON（手工准备一份不含 worktreePath 字段的 run.json）。
  - 5.4.2 触发 archive。预期：archive ACP cwd === projectPath；agent 完成 archive-change + commit 后**不**执行 merge / worktree remove / branch delete；行为与多 worktree 工作流引入前完全等价。
- [ ] 5.5 非 git 项目 dogfood：
  - 5.5.1 在 FylloCode 创建一个 `template: "empty"` 项目，其中无 `.git`。
  - 5.5.2 走完一次 chat → apply → archive 流程；预期与 5.4 等价。
- [ ] 5.6 `pnpm build` / `pnpm lint` / `pnpm typecheck` 全部通过；不引入新告警。
- [ ] 5.7 验收：5.2 / 5.3 / 5.4 / 5.5 / 5.6 全部通过；记录 dogfood 结果到 commit/PR 描述。

## 6. 文档与实施顺序对齐

- [x] 6.1 检查 `mcp-servers/fyllo-specs/src/prompts/archive-change.md`：当前 `tool_instruction` 的"sync 主 spec → archive 文件移动 → 报告状态"约束是否已经清晰。如不清晰，补一句"git commit / merge / worktree-cleanup 由 archive system-reminder 编排，不在本工具内执行"，避免 agent 混淆 MCP 边界。
- [x] 6.2 验收：`mcp-servers/fyllo-specs/__tests__/prompts.test.ts` 仍通过（如断言 prompt 文本片段，则同步更新断言）。

## 7. 验收总闸

- [ ] 7.1 1.1 - 6.2 全部勾选完成。
- [ ] 7.2 multi-worktree 工作流端到端闭环：chat → propose → 创建 worktree → apply 在 worktree → archive 完成后 worktree 自动清理 → main 多一次 fast-forward merge commit。
- [ ] 7.3 旧 ApplyRunMeta / 非 git 项目行为完全等价于本能力引入前。
- [ ] 7.4 OpenSpec change 状态从 `applying` 顺利变为 `archived`，proposal 详情页显示 archived，list 中（worktree 已删）该 change 不再显示 worktree 标记。
