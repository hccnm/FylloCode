## Why

P1 已经为主进程数据通路与 MCP `targetPath` 入参打好基建。本次（P2）让 chat 阶段真正开始用 git linked worktree 隔离 OpenSpec proposal artifacts：当用户在 chat 同意 propose 后，agent 在 `chat.txt` system-reminder 编排下用 Bash 命令创建 `.worktrees/<changeName>/`，把 OpenSpec change 文件直接写到 worktree，避免 main 工作树长期堆积未 commit 的 proposal artifacts，也为 P3 的 list 双源扫描和 P4 的 archive 编排准备数据来源。

## What Changes

- 修改 `chat.txt` system-reminder 模板正文：在 `<rules>` 段中新增 `<worktree>` 子段，明确 chat 阶段用户同意 propose 后 agent 必须用 Bash 执行的 worktree 编排步骤——
  - 检查并维护主仓库 `.gitignore`：若不存在或不含 `.worktrees/` 行，先 `echo .worktrees/ >> .gitignore`，再 `git add .gitignore && git commit -m "chore: ignore .worktrees"`。
  - 执行 `git worktree add .worktrees/<changeName> -b proposal/<changeName>`。
  - 调用 `mcp__fyllo_specs__create-proposal` 时把 `targetPath` 设为 worktree 的绝对路径（即 `<projectPath>/.worktrees/<changeName>`）。
  - 同一 chat session 允许孵化多个 change：每次 propose 都重复以上步骤，每个 change 各占独立 worktree；用户表述模糊（如"刚才那个 change"）且历史中存在多个 worktreePath 时，先确认目标。
  - 后续 chat 内对该 change artifacts 的 Read/Edit 必须使用 worktreePath 的绝对路径（chat session 自身 cwd 仍是主仓库）。
  - 失败处置（worktree add 失败、`.gitignore` commit 被 hook 拒绝、changeName 已存在）一律先把 stderr 复述给用户，由用户决定下一步。
- 修改 `apply.txt` system-reminder 模板正文：新增 `<worktree>` 子段，告知 agent 当前 stage cwd 即为 linked worktree（值由 `{{worktreePath}}` 占位符渲染；为空则提示当前在主仓库）；业务代码改动产生的 commit 由 agent 在 archive 之前自己完成。
- 修改 `electron/main/services/chat/system-reminder/providers/shared.ts` 的模板变量白名单：在 `ALLOWED_VARIABLES` 中追加 `worktreePath` 与 `mainProjectPath`，分别对应 `SystemReminderContext.worktreePath` 和 `SystemReminderContext.projectPath`（mainProjectPath 是 projectPath 的别名，让模板叙述更清晰）。
- chat IPC handler `electron/main/ipc/chat.ts` **不需要改动**：chat owner 的 reminderContext 字段由 `AcpSession` 在 spread 前就已赋值（参见 `acp-session.ts:443`）；chat.txt 中的 `{{mainProjectPath}}` 通过 `projectPath` 字段渲染。
- **non-git 项目降级**：`chat.txt` 中显式说明 ——若用户当前项目不是 git 仓库（agent 用 `git -C <projectPath> rev-parse --is-inside-work-tree` 自检发现失败），跳过 worktree 编排，直接用 `targetPath: <projectPath>` 调 create-proposal，与 P1 阶段行为一致。
- 不修改任何 MCP tool 实现：`create-proposal` 在 P2 阶段仍只做 OpenSpec scaffold + targetPath 校验，git worktree add 完全由 agent 用 Bash 执行（边界与 P1 一致）。
- 不引入 chat session 的 cwd 切换：chat ACP session cwd 永远是主仓库 projectPath。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `system-reminder-injection`: 模板变量白名单新增 `worktreePath` 与 `mainProjectPath`；`chat.txt` / `apply.txt` 模板正文新增 worktree 编排段落（行为契约层面：reminder 在 chat 阶段必须包含 worktree 编排指令，agent 在收到 reminder 后会用 Bash 执行 worktree add 与 .gitignore 维护）。

## Impact

**代码**

- `electron/main/services/chat/system-reminder/templates/chat.txt`：新增 `<worktree>` 编排段
- `electron/main/services/chat/system-reminder/templates/apply.txt`：新增 `<worktree>` 段（通过 `{{worktreePath}}` 渲染）
- `electron/main/services/chat/system-reminder/providers/shared.ts`：`ALLOWED_VARIABLES` 列表追加 `worktreePath` / `mainProjectPath`；`getVariableValue` 处理这两个字段
- `electron/main/services/chat/system-reminder/types.ts`：无需改动（P1 已加 `worktreePath?`）
- `electron/main/ipc/chat.ts`：构造 `reminderContext` 时透传 `projectPath`，新增显式 `worktreePath: undefined`（让契约清晰；行为不变）
- `mcp-servers/fyllo-specs/src/prompts/create-proposal.md`：在"Input"段说明 `targetPath` 在 git 项目下推荐使用 worktree 绝对路径（与 chat.txt 编排一致）；non-git 项目仍传主仓库路径
- 测试：`electron/main/services/chat/system-reminder/__tests__/`（如不存在则新建）覆盖 worktreePath 替换、mainProjectPath 替换、含尖括号时跳过注入

**用户可见变化**

- 用户在 chat 阶段确认 propose 后，会观察到 agent 多出几次 Bash 调用（`git worktree add`、可能的 `.gitignore` 维护 + commit），且后续 OpenSpec artifacts 出现在 `<projectPath>/.worktrees/<changeName>/openspec/changes/<changeName>/` 而不是主仓库的 `openspec/changes/`。
- 主仓库 `.gitignore` 在第一次 propose 时会自动多一条 `.worktrees/` 与一次 `chore: ignore .worktrees` commit 到 main 当前分支。
- non-git 项目体验与 P1 一致：所有 OpenSpec 文件仍写在主仓库 `openspec/changes/`，不创建任何 worktree。

**依赖**

无新增依赖。git 命令由用户系统的 git 二进制提供。

**风险**

- agent 编排行为漂移（中高）：reminder 是自然语言指令，agent 可能跳步、把 `.gitignore` 维护合进业务 commit、或忘记把 `targetPath` 改成 worktreePath。缓解：reminder 文本写明每一步的命令模板与失败处置；P2 上线后在 FylloCode 自身仓库 dogfood 1-2 周。
- `.gitignore` commit 在签名/签出钩子严格的环境失败（中）：用户配置了 commit signing required 或 pre-commit hook 拒绝时，`.gitignore` commit 失败。缓解：reminder 文本说明此时直接把 stderr 给用户，让用户手动处理。
- changeName 重名（低）：`.worktrees/<changeName>` 已存在时 `git worktree add` 会失败。缓解：reminder 让 agent 先 `git worktree list` 检测已有 worktree；冲突时让用户换名后重试。

**回滚**

把 `chat.txt` / `apply.txt` 中的 `<worktree>` 段删除即可；MCP 层面无任何修改，行为完全回到 P1。
