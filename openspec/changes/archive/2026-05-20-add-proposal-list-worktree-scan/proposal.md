## Why

P2 让 chat 阶段的 agent 能在 `<projectPath>/.worktrees/<changeName>/` 下创建 OpenSpec change 与 artifacts。但当前 `proposal:list` 仅扫描主仓库 `<projectPath>/openspec/changes/`（参见 `electron/main/domain/proposal/openspec-reader.ts#readProposalFiles`），用户在 proposal 列表里**看不到**写入 worktree 的 change，自然无法点击 apply。本次（P3）让列表与详情页能看到 worktree 来源的 change，并把 worktreePath 自动透传给 ApplyRunMeta（这一步契约 P1 已就绪），让 apply / archive 的 ACP cwd 自然落到 worktree 上。

## What Changes

- **MODIFIED `readProposalFiles(projectPath)`**：在扫主仓库 `<projectPath>/openspec/changes/` 之后，再扫 `<projectPath>/.worktrees/*/openspec/changes/`，把 worktree 来源的 ProposalMeta 也合并进结果。worktree 来源的 meta 设置 `worktreePath`，同名 changeId 出现时以 worktree 来源覆盖主仓库来源（worktree 优先）。主仓库 `archive/` 路径下的归档继续保留。
- **MODIFIED `ProposalMeta` 序列化**：扫描时 `worktreePath` 字段在 worktree 来源的 meta 中写入绝对路径（`path.resolve` 规范化），主仓库来源保持 `undefined`。该字段是 P1 已经在 `shared/types/proposal.ts` 加上的可选字段。
- **MODIFIED `resolveChangeDir(projectPath, changeId)`**：增加对 worktree 路径的探查——按主仓库 `openspec/changes/<id>` → 主仓库 `archive/<id>` → 各 worktree `openspec/changes/<id>` 的顺序查找；找到第一个 `.openspec.yaml` 即返回。这是为了让 `proposal:read` 等下游接口在 P3 后能正确读到 worktree 内的 artifacts。
- **MODIFIED proposal 列表页 UI**：proposal 卡片在 `worktreePath` 非空时显示 worktree 标记（badge / icon）。鼠标悬浮卡片时通过 tooltip / title 属性展示 `worktreePath` 的绝对路径字符串，方便用户排查。
- **MODIFIED `proposal:apply` 创建 run**：当前 P1 的实现在 `apply-run-service.createApplyRun` 中已经有 worktreePath 透传位（来源是 ProposalMeta）。P3 落地后这条通路自然激活，因为 ProposalMeta 第一次有非空 worktreePath。本能力**不修改** apply-run-service 的代码——契约已就绪，行为通过 P3 的来源端启用而生效。
- 单测：`openspec-reader.spec.ts` 增补 worktree 扫描分支（worktree 不存在 / 单 worktree / 多 worktree / 同名去重 / archive 路径不被去重）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `proposal-list`: 列表扫描扩展为主仓库 + worktrees 双源；ProposalMeta 携带 worktreePath；卡片显示 worktree 标记。

## Impact

**代码**

- `electron/main/domain/proposal/openspec-reader.ts`：`readProposalFiles` 双源扫描；`resolveChangeDir` 加 worktree 探查路径
- `frontend/src/pages/proposal/index.vue`：卡片增 worktree 标记 + tooltip
- `electron/main/domain/proposal/__tests__/openspec-reader.spec.ts`（如不存在则新建）：扫描分支单测

**用户可见变化**

- 列表里第一次能看到 worktree 来源的 change（在 P2 已经把 chat 阶段写到 worktree 之后）。
- 卡片右上角多一个 worktree 视觉标记（小 icon + "worktree" 文案），鼠标悬浮显示 worktreePath。
- 触发 apply：ApplyRunMeta.worktreePath 第一次会被写入 worktree 绝对路径，apply ACP cwd 自然落到 worktree——这是 P1 早已部署但未激活的通路。
- 主仓库 `archive/` 下已归档的 change 仍正常显示，状态仍为 `archived`，与 worktree 来源去重不冲突（参见 design 中"去重规则"）。

**依赖**

无新增依赖。

**风险**

- 双源扫描的 IO 成本（低）：N 个 worktree 各自扫一次 `openspec/changes/`，但 worktree 数量预期 < 10，无需缓存。
- 同名去重的边界（中）：archive 完成的瞬间，worktree 内 OpenSpec 已移到 `archive/<date>-<name>/`、worktree 还没被 remove；此时主仓库已经 merge 进归档 commit。两边都看到 archived 状态，且 changeId 含日期前缀（例 `2026-05-19-foo`），与活跃 change（例 `foo`）不冲突。详情见 design 的 D2。
- 卡片标记影响信息密度（低）：badge 增加占用横向空间。卡片当前布局已能在 status badge 旁边再放一个标记（`flex shrink-0` 已在 markup 里）；不需要重排版。

**回滚**

把 `readProposalFiles` 中扫 `.worktrees/` 的循环 + 去重 Map 移除即可；ProposalMeta.worktreePath 字段保留（P1 已加）；前端卡片标记由 `v-if="proposal.worktreePath"` 守卫，回滚扫描后字段为空，标记自然不显示。
