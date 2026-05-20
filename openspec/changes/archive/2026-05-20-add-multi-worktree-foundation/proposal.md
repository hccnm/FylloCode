## Why

为了支持后续 multi-worktree 工作流（chat 阶段在 linked worktree 创建 proposal、apply/archive 在 linked worktree 执行），主进程的数据契约、ACP cwd 取值、MCP 工具入参都需要先具备承载 worktreePath 的能力。本次只做基建：所有新字段对外保持空值/默认值，行为完全等价于改造前；为后续 P2（chat 编排）/ P3（list 双源扫描）/ P4（archive 编排）打地基。

## What Changes

- `ProposalMeta` 增加可选字段 `worktreePath?: string`（来源端暂时永远为 `undefined`，待 P3 启用扫描后才会写入）。
- `ApplyRunMeta` 增加可选字段 `worktreePath?: string`；`proposal:apply` 创建 run 时从对应 `ProposalMeta.worktreePath` 透传；旧 run.json 缺字段时反序列化为 `undefined`。
- `proposal:stageStream` / `proposal:archive` 创建 `AcpSession` 时 `cwd` 取 `runMeta.worktreePath ?? projectPath`；`projectPath` 字段不变（始终是主仓库路径）。
- `SystemReminderContext` 增加可选 `worktreePath?: string` 字段，由 stage stream / archive handler 在构造 reminderContext 时传入（P1 阶段值始终为 `undefined`）。
- **BREAKING**（仅对 MCP 内部调用方）：fyllo-specs MCP 4 个 tool（`explore` / `create-proposal` / `apply-change` / `archive-change`）入参增加 `targetPath: string` 必填字段：
  - 必须是绝对路径
  - 必须出现在 `git -C $FYLLO_PROJECT_PATH worktree list --porcelain` 输出中（main repo 自身合法）
  - 工具内部以 `targetPath` 作为 projectRoot 计算 OpenSpec 路径，不再调用 `resolveProjectRoot()`
  - 校验失败时返回 `state.errors` 包含原始 `worktree list` 输出，且 SHALL NOT 执行任何 fs 副作用
- non-git 项目（`<mainRepo>/.git` 不存在）：`targetPath === <mainRepo>` 始终视为合法，工具行为等价于改造前；本能力不为 non-git 项目引入新概念。
- `FYLLO_PROJECT_PATH` env 退化为"main repo 标识"——仅用于 worktree 合法性校验；不再作为 `targetPath` 缺省值。
- 单测覆盖：`targetPath` 校验、cwd fallback、ApplyRunMeta 序列化兼容旧文件、ProposalMeta 序列化忽略 `undefined`。

## Capabilities

### New Capabilities

无。本次基建不引入新 capability；worktree 生命周期、命名、隔离语义都留给 P2/P3/P4。

### Modified Capabilities

- `fyllo-specs-mcp`: 4 个 tool 入参追加 `targetPath: string` 必填，并把 projectRoot 来源从 `resolveProjectRoot()` 改为 `targetPath`；增加 `targetPath` 合法性校验；`FYLLO_PROJECT_PATH` 仅用于校验。
- `proposal-apply-run`: ApplyRunMeta 增加 `worktreePath?`；apply 创建 run 时透传；stage stream / archive 的 ACP `cwd` 改为 `runMeta.worktreePath ?? projectPath`；reminderContext 携带 worktreePath。

## Impact

**代码**

- `mcp-servers/fyllo-specs/src/tools/{explore,create-proposal,apply-change,archive-change}.ts`：入参 schema、handler 内部 projectRoot 来源
- `mcp-servers/fyllo-specs/src/utils/project-root.ts`：新增 `validateTargetPath(targetPath: string): { ok, rawOutput?, error? }` 工具
- `shared/types/proposal.ts`：ProposalMeta / ApplyRunMeta 字段扩展
- `electron/main/services/proposal/apply-run-service.ts`：创建 run 时透传 worktreePath（来源仍为 undefined）
- `electron/main/ipc/proposal-apply.ts`：stage stream（`cwd` 与 `reminderContext`）、archive（`cwd` 与 `reminderContext`）两处
- `electron/main/services/chat/system-reminder/types.ts`：`SystemReminderContext.worktreePath?`
- `electron/main/domain/proposal/openspec-reader.ts`：写入 ProposalMeta 时字段保留 undefined（不修改扫描逻辑——扫描扩展属于 P3）

**依赖**

无新增依赖；仍只用 Node 内置 `child_process` 调起 `git -C $FYLLO_PROJECT_PATH worktree list --porcelain` 进行校验。

**风险**

- MCP `targetPath` 必填属于破坏性入参变更；当前 fyllo-specs MCP 唯一调用方是同进程 ACP agent，不存在外部老调用方。验证：FylloCode 启动后立即跑一次 chat → create-proposal → apply-change → archive-change 流程，确认 agent 在工具描述更新后能正确传 `targetPath`（P1 默认值约定为传 `$FYLLO_PROJECT_PATH`，由 P2 改成 worktreePath）。
- 旧 ApplyRunMeta JSON 文件缺 `worktreePath` 字段：解析时 `worktreePath` 为 `undefined`，cwd fallback 到 `projectPath`，行为等价于改造前。

**回滚**

回滚成本低：把 `cwd: runMeta.worktreePath ?? projectPath` 改回 `cwd: projectPath`，删除字段即可；MCP 把 `targetPath` 改回可选并 fallback `resolveProjectRoot()`。
