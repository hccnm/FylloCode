## Context

P1（`add-multi-worktree-foundation`）已经把 `targetPath` 必填、cwd fallback、`SystemReminderContext.worktreePath?` 字段、ApplyRunMeta worktreePath 透传等基建落到位。但因为来源端（ProposalMeta.worktreePath）始终为 `undefined`，所有 worktreePath 字段在 P1 阶段实际都是空值，agent 的工作目录仍始终是主仓库。

P2 让 chat 阶段开始**真正创建并使用** linked worktree：用户同意 propose 后，chat ACP session 内的 agent 用 Bash 执行 `git worktree add`，把 OpenSpec change scaffold 直接写到 worktree 内部，再调 `mcp__fyllo_specs__create-proposal targetPath=<worktreePath>` 让 MCP scaffold 落到 worktree 的 `openspec/changes/<name>/`。

P2 的边界：

- **MCP 不变**：`create-proposal` 仍只做 OpenSpec 文件级原子操作 + `targetPath` 合法性校验。worktree add / .gitignore commit 全由 agent 用 Bash 完成。这是与"create-proposal 内置 git"方案的核心分野——已经在 P1 的设计讨论中拍板（MCP 永远不 owning git workflow）。
- **chat session cwd 不变**：chat ACP session 仍绑定主仓库 projectPath；agent 通过 reminder 拿到 worktree 绝对路径，用绝对路径访问 worktree 内的 OpenSpec artifacts。chat 自身 cwd 与 worktree 路径分离是预期，不是缺陷。
- **不修改 list / archive**：proposal 列表能否扫到 worktree 来源的 change 是 P3 的事；archive 时怎么 commit/merge/remove worktree 是 P4 的事。P2 只让 worktree **被产出**。

**关键事实**

- chat.txt 和 apply.txt 模板由 `electron/main/services/chat/system-reminder/templates/*.txt?raw` 在 build 时打包进主进程，运行时通过 `renderSystemReminderTemplate(template, ctx)` 替换 `{{...}}` 占位符。
- `ALLOWED_VARIABLES`（`providers/shared.ts:6`）当前只有 `["changeId", "stageIndex", "runId", "projectPath"]`。任何不在白名单的占位符保持字面量。
- `apply.txt` 当前的 `<context>` 段已用 `{{projectPath}}`、`{{changeId}}`、`{{stageIndex}}`、`{{runId}}`，但**不包含** `worktreePath` 或 `cwd` 信息。
- chat.txt 当前的 `<context>` 段也不引用 projectPath 或任何 cwd 信息（chat 阶段只面向"理解任务"的指令）。
- ACP session 的 `cwd` 由调用方传入，`SystemReminderContext.cwd` 字段已是该 cwd 的副本。本设计**不修改** cwd 字段语义。

## Goals / Non-Goals

**Goals**

- chat 阶段的 agent 在用户同意 propose 后，能根据 reminder 编排：① 检查并维护主仓库 `.gitignore`；② `git worktree add .worktrees/<changeName> -b proposal/<changeName>`；③ 用 worktree 绝对路径作为 `targetPath` 调 create-proposal。
- apply 阶段的 agent 在 reminder 中清楚看到当前 stage cwd 是 linked worktree 还是主仓库（取决于 `runMeta.worktreePath` 是否非空）。
- 模板变量白名单扩展，新增 `worktreePath` 与 `mainProjectPath`，沿用 P1 已经存在的 sanitize 流程（含尖括号则跳过注入）。
- 同一 chat session 允许孵化多个 change，每个 change 占独立 worktree；agent 在用户表述模糊时主动确认目标。
- non-git 项目（`<projectPath>/.git` 不存在）跳过 worktree 编排，与 P1 行为完全等价。

**Non-Goals**

- 不修改 MCP `create-proposal` 工具（P1 已完成必填 `targetPath`；P2 不引入 worktree add 副作用进 MCP）。
- 不修改 list / 卡片标记（P3）。
- 不修改 archive 编排（P4）。
- 不修改 chat ACP session 的 cwd（保持主仓库）。
- 不引入新的 IPC 通道、`shared/` 类型、preload 暴露。
- 不实现 worktree 创建失败的自动恢复（agent 把 stderr 复述给用户，由用户决策）。

## Decisions

### D1：worktree 编排放进 chat.txt 模板，而不是新增 prompt 工具

**选择**：在 `chat.txt` 的 `<rules>` 段新增 `<worktree>` 子段，把 worktree 编排步骤写成自然语言指令（含 Bash 命令模板）。agent 收到 reminder 后用现有的 Bash 工具执行命令。

**理由**：

- 模板加段是最低侵入的方式：build 流程 / IPC 协议 / preload 表面全不动。
- worktree 编排逻辑本质是"agent 在某个时机执行某些命令"，与现有"chat 阶段如何工作"的指令同性质，归属在同一份 reminder 文本里语义自洽。
- 新增 MCP 工具或 IPC 都会增加表面，且把"何时建 worktree"这种判断从 reminder 拆出来，反而让 agent 难以连贯执行（reminder 是 agent 的工作合约，跨工具拆分契约容易造成漂移）。

**否决方案**：

- 在 `mcp__fyllo_specs__create-proposal` tool 里内置 git worktree add——已在 P1 讨论中拍板否决（MCP 不 owning git workflow，避免和用户 hooks/signing 冲突）。
- 主进程在某 IPC handler 里 spawn git worktree add——FylloCode 主进程目前完全不调 git，引入此通路会突破现有架构边界。

### D2：worktree 路径与分支命名

**选择**：worktree 路径硬编码为 `<projectPath>/.worktrees/<changeName>`；分支名硬编码为 `proposal/<changeName>`。

**理由**：

- `.worktrees/` 是放在主仓库内部的好处：用户用 `git status` 时一眼能看到哪些 worktree 存在；`.gitignore` 一行 `.worktrees/` 即可隔离。
- 放主仓库**外**（`<projectPath>-worktrees/`）有写权限风险（用户对父目录可能没写权）且违背"工程文件留在仓库内"的直觉。
- `<changeName>` 作为唯一键，重名直接 `git worktree add` 失败，agent 让用户换名重试。

### D3：`.gitignore` 维护由 agent 用 Bash 完成

**选择**：reminder 中明确步骤——`grep -qxF .worktrees/ .gitignore || (echo .worktrees/ >> .gitignore && git add .gitignore && git commit -m "chore: ignore .worktrees")`。

**理由**：

- 只在第一次为该 main repo 创建 worktree 时触发一次（之后 `grep -qxF` 命中即跳过）。
- commit 失败时 stderr 透传给用户（commit signing required / pre-commit hook 拒绝），由用户手动处理。这与 D1 的"agent 主导，stderr 兜底"边界一致。

### D4：模板变量白名单扩展两个字段

**选择**：`ALLOWED_VARIABLES` 追加 `worktreePath` 与 `mainProjectPath`。

- `worktreePath`：取自 `SystemReminderContext.worktreePath`；undefined 时 `sanitizeValue` 已经返回 `""`（参见 `shared.ts:11`），模板侧需要明确"空字符串表示当前不在 worktree 内"的叙述。
- `mainProjectPath`：取自 `SystemReminderContext.projectPath`，**与 `projectPath` 的值完全相同**，仅作为模板叙述用的别名（让"主仓库路径"这个概念在 worktree 引入后更清晰；若仍用 `{{projectPath}}` 在 worktree 段下叙述，"projectPath"在 chat 与 apply 两套语境的含义会让人混淆）。

#### 选项对比

| 方案                                             | 优点                                      | 痛点                                                                 |
| ------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------- |
| 加 worktreePath + mainProjectPath（本设计）      | 模板叙述清晰；不破坏现有 projectPath 语义 | 多一个白名单变量，但语义明确                                         |
| 只加 worktreePath，复用 projectPath 表达"主仓库" | 白名单只多一项                            | 在 worktree 编排段中"projectPath"既是主仓库又是 chat cwd，叙述容易绕 |
| 改名 projectPath → mainProjectPath（破坏现状）   | 单一来源                                  | 已有模板大量引用 projectPath，破坏面大                               |

### D5：apply.txt 用 worktreePath 渲染，空值的叙述策略

**选择**：apply.txt 新增 `<worktree>` 段渲染 `{{worktreePath}}`。当 worktreePath 为 undefined（旧 ApplyRunMeta 或 P3 未启用之前的 P2 阶段）时 `sanitizeValue` 返回 `""`，导致模板渲染出空字符串。模板内文叙述策略：

```
<worktree>
本 stage 的工作目录是 `{{worktreePath}}`。空值代表当前在主仓库 `{{mainProjectPath}}` 上工作（即未启用 worktree 隔离）。
...
</worktree>
```

**理由**：

- 不为 worktreePath 是否为空走两个分支模板（避免模板拷贝维护）。
- 文本里把"空字符串"语义显式说出来，比让 agent 自己根据空值推断更稳。

### D6：chat 阶段 reminderContext.worktreePath 永远是 undefined

**选择**：`chat.ts` IPC handler 构造 reminderContext 时 `worktreePath: undefined`。chat ACP session 自身 cwd 永远是主仓库，worktree 是 agent 在 chat 内创建的产物，不是 chat session 的属性。

**理由**：

- 与"chat session cwd 不变"决策一致（D1 的整体定位）。
- chat.txt 模板**不渲染** `{{worktreePath}}`——因为 chat 一次会话可能孵化多个 change，每个 change 一个 worktree，无法在 reminder 注入时确定单一 worktreePath。worktreePath 只在 apply.txt / archive.txt 这种 1 run = 1 worktree 的语境下才有渲染意义。
- 因此 chat.txt 中的 worktree 编排段**只引用 `{{mainProjectPath}}`**，描述操作主仓库的命令模板；具体 worktreePath 在 agent 执行 `git worktree add` 后由 agent 自己记下并用作后续 `targetPath`。

### D7：chat.txt 编排同一 chat 多 change 的语义

**选择**：reminder 文本明确：

- 用户每次同意 propose 时都重复整套 worktree 编排（不假设 chat 内只会孵化一个 change）。
- 用户表述模糊（如"刚才那个 change"）且对话历史中存在多个 change 时，agent 必须先反问目标 worktree。
- chat 内对 worktree artifacts 的 Read/Edit 一律用绝对路径，因为 chat session cwd 是主仓库。

**理由**：根据用户在 P1 设计阶段的明确要求："A1 可以，用户可能在同一个 session 里创建多个 proposal" + "如果用户未指明，agent 应该会主动去问"。

### D8：non-git 项目降级走文本判断

**选择**：reminder 文本中先让 agent 用 `git -C <projectPath> rev-parse --is-inside-work-tree` 自检；若失败（exit code 非 0 / stderr 含 "not a git repository"），跳过整个 worktree 编排，直接用 `targetPath: {{mainProjectPath}}` 调 create-proposal。

**理由**：

- 主进程不需要新增"是否 git 项目"的字段；agent 自检更直接。
- 与 P1 中 `validateTargetPath` 的 non-git 降级逻辑（`git worktree list` 失败时 fallback 到 main repo 自身合法）天然对齐。

## Architecture

### chat.txt worktree 编排子段（自然语言文本）

放在 `<rules>` 段末尾、`<critical>` 段之前。完整新增段落（确切文本由 tasks 步骤实施时按本设计落入模板）：

```
<worktree>
当用户同意提议（propose）后，按以下顺序为本次 change 创建独立的 git linked worktree：

1. 自检主仓库是否为 git 仓库：`git -C {{mainProjectPath}} rev-parse --is-inside-work-tree`。失败（非 git 项目）则跳过本段，直接用 `targetPath: {{mainProjectPath}}` 调用 mcp__fyllo_specs__create-proposal。

2. 维护主仓库 .gitignore（仅首次需要）：
   `cd {{mainProjectPath}} && (grep -qxF .worktrees/ .gitignore 2>/dev/null || (echo .worktrees/ >> .gitignore && git add .gitignore && git commit -m "chore: ignore .worktrees"))`
   commit 失败时（如 commit signing required、pre-commit hook 拒绝），把 stderr 完整复述给用户，让用户决定下一步；不要自行重试。

3. 创建 worktree：
   `git -C {{mainProjectPath}} worktree add .worktrees/<changeName> -b proposal/<changeName>`
   <changeName> 为 kebab-case 改动名（如 add-foo-bar）。命令成功后，worktree 绝对路径为 `{{mainProjectPath}}/.worktrees/<changeName>`，记下作为后续 `targetPath`。
   失败常见原因：worktree 已存在（changeName 重名）、HEAD 状态异常。把 stderr 完整复述给用户，请用户换名或处理后再继续。

4. 调 `mcp__fyllo_specs__create-proposal`，`targetPath` 必传 worktree 绝对路径（即第 3 步记下的 path），`changeName` 与目录名一致。本工具内部不会创建 worktree、不会改 git 状态，仅在传入路径下生成 OpenSpec change scaffold。

5. 同一 chat session 允许孵化多个 change，每个 change 各占独立 worktree；用户后续提到"刚才那个 change"且历史中存在多个 worktreePath 时，先反问目标。

6. 后续在 chat 内对该 change artifacts 的 Read / Edit 必须用 worktree 的绝对路径。chat session 自身 cwd 是主仓库 `{{mainProjectPath}}`，相对路径会落到主仓库。
</worktree>
```

### apply.txt worktree 子段（自然语言文本）

放在现有 `<context>` 段之后、`<rules>` 段之前：

```
<worktree>
本 stage 的工作目录（cwd）是 `{{worktreePath}}`。若该字符串为空，表示当前 stage 的 cwd 是主仓库 `{{mainProjectPath}}`（旧 ApplyRunMeta 或 worktree 编排尚未启用的项目）。

业务代码改动产生的 commit 由你（agent）自己完成；archive 阶段不会替你 commit 业务代码。在准备进入 archive 之前，请确保 `git status` 工作区 clean（OpenSpec tasks.md 的勾选除外，那是工具进度）。
</worktree>
```

### 模板变量白名单扩展

`shared.ts` 修改后：

```ts
const ALLOWED_VARIABLES = [
  "changeId",
  "stageIndex",
  "runId",
  "projectPath",
  "worktreePath",
  "mainProjectPath",
] as const;

function getVariableValue(ctx, field) {
  switch (field) {
    case "changeId":
      return ctx.changeId;
    case "stageIndex":
      return ctx.stageIndex;
    case "runId":
      return ctx.runId;
    case "projectPath":
      return ctx.projectPath;
    case "worktreePath":
      return ctx.worktreePath;
    case "mainProjectPath":
      return ctx.projectPath; // alias
    default:
      return undefined;
  }
}
```

### chat.ts IPC handler 不需要修改

`chat.ts` 当前调 `new AcpSession({ ... })` 时没有传 `reminderContext`（参见 `electron/main/services/chat/acp-session.ts:443`，AcpSession 内部对 `this.opts.reminderContext ?? {}` 做兜底 spread）。chat owner 的 reminder 解析仅依赖 `projectPath` / `cwd` / `fylloSessionId` / `agentId` 等核心字段，因此 P2 阶段 chat handler 完全不需要改动；chat.txt 的新 `<worktree>` 段只引用 `{{mainProjectPath}}`，该值由 AcpSession 在 spread 前就已赋为 `args.projectPath`（即主仓库路径），渲染天然正确。

## Risks / Trade-offs

- **agent 编排行为漂移**（中高）：reminder 是自然语言指令，agent 可能跳步、合并 commit、用错路径。
  - 缓解：reminder 文本写明每一步的命令模板与失败处置；上线后在 FylloCode 自身仓库 dogfood 1-2 周观察实际行为。
  - 验证：上线后跑一次 chat → propose，确认 agent 真的执行了 `.gitignore` 维护、`worktree add`、并把 `targetPath` 设为 worktree 路径。

- **commit 在严格 git 环境失败**（中）：commit signing / pre-commit hook 拒绝时 `.gitignore` commit 失败。
  - 缓解：reminder 中明确 stderr 透传给用户由用户处理；不要 agent 自行 retry。

- **`.worktrees/` 路径冲突**（低）：用户已自定义其它工具用 `.worktrees/` 目录。
  - 缓解：`git worktree add` 在 `.worktrees/<changeName>` 已存在时直接失败，stderr 含路径冲突信息；agent 复述给用户解决。

- **changeName 重名**（低）：`.worktrees/<changeName>` 已被 `git worktree add` 注册。
  - 缓解：reminder 让 agent 在 add 前用 `git worktree list` 自检；冲突时让用户换名。

- **空值 worktreePath 在 apply.txt 的叙述歧义**（低）：旧 ApplyRunMeta 或 P3 启用之前的 P2 阶段，apply 渲染的 `{{worktreePath}}` 为空字符串。
  - 缓解：apply.txt 文本明确"空值代表主仓库 cwd"。

- **non-git 项目自检依赖 agent 行为**（低）：agent 可能跳过 `git rev-parse --is-inside-work-tree` 自检直接 `worktree add` 失败。
  - 缓解：reminder 文本把自检步骤放在第 1 步且强调"失败则跳过"。

## Migration Plan

1. 修改 `providers/shared.ts`：`ALLOWED_VARIABLES` 加 `worktreePath` / `mainProjectPath`；`getVariableValue` 处理这两个字段；单测覆盖含尖括号时跳过注入。
2. 修改 `templates/chat.txt`：在 `<rules>` 段末尾追加 `<worktree>` 子段（设计文本如上）。
3. 修改 `templates/apply.txt`：在 `<context>` 段后追加 `<worktree>` 子段（设计文本如上）。
4. 修改 `electron/main/ipc/chat.ts`：构造 reminderContext 时显式 `worktreePath: undefined`。
5. 在 FylloCode 自身仓库 dogfood：跑一次 chat → propose 流程，确认 agent 行为符合预期；跑一次 apply 流程，确认 apply.txt 渲染含 worktreePath 段。
6. 单测：`providers/shared.spec.ts`（如不存在则新建）覆盖新变量；模板正文不需要单测（dogfood 替代）。

**回滚**：把 chat.txt / apply.txt 的 `<worktree>` 段删除；`shared.ts` 的两个新变量从白名单移除即可。MCP 不变、IPC 不变、字段类型不变。

## Open Questions

无。
