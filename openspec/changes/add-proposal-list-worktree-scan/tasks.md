## 1. openspec-reader 双源扫描

- [ ] 1.1 修改 `electron/main/domain/proposal/openspec-reader.ts`：把现有 `readProposalFiles(projectPath)` 中扫描 main active 与 main archive 的逻辑抽出为两个内部函数 `readActiveDir(dir, worktreePath?)` 与 `readArchiveDir(dir)`。两个函数返回 `ProposalMeta[]`。`readActiveDir` 接收 `worktreePath?: string` 参数，对每条产出的 meta 把该字段赋给 `worktreePath` 字段（`path.resolve` 规范化；为 `undefined` 时字段保持 undefined）。
- [ ] 1.2 在 `openspec-reader.ts` 新增 `readWorktreesActiveDirs(worktreesRoot: string): Promise<ProposalMeta[]>` 函数。实现：
  - 调 `fs.readdir(worktreesRoot, { withFileTypes: true })`；目录不存在或失败时返回 `[]`。
  - 对每个 `entry.isDirectory()` 的子目录 `wt`，计算 `worktreePath = path.resolve(worktreesRoot, wt.name)`；调 `readActiveDir(join(worktreePath, "openspec", "changes"), worktreePath)` 收集 metas。
  - 不扫 `<wt>/openspec/changes/archive/`（worktree 内 archive 不在 P3 范围）。
  - 把所有 worktree 的 metas 拼接返回。
- [ ] 1.3 重写 `readProposalFiles(projectPath)` 主流程：
  ```ts
  const baseChangesDir = join(projectPath, "openspec", "changes");
  const fromMain = await readActiveDir(baseChangesDir, undefined);
  const fromArchive = await readArchiveDir(join(baseChangesDir, "archive"));
  const fromWorktrees = await readWorktreesActiveDirs(join(projectPath, ".worktrees"));
  const dedupe = new Map<string, ProposalMeta>();
  for (const m of fromMain) dedupe.set(m.id, m);
  for (const m of fromArchive) dedupe.set(m.id, m);
  for (const m of fromWorktrees) dedupe.set(m.id, m); // 覆盖 main active 同名
  return Array.from(dedupe.values()).sort(byCreatedDesc);
  ```
- [ ] 1.4 修改 `resolveChangeDir(projectPath, changeId)`：在原有 main → archive 探查之后，新增 worktree 探查——`fs.readdir(<projectPath>/.worktrees, ...)` → 对每个 worktree 子目录检查 `<wt>/openspec/changes/<id>/.openspec.yaml` 是否存在，命中则返回该路径；全部 miss 时返回 `null`。worktrees 目录不存在时按现状返回 `null`。
- [ ] 1.5 验收：`pnpm typecheck` 通过；导出的 `readProposalFiles` 与 `resolveChangeDir` 函数签名不变（向后兼容，所有调用方无需改动）。

## 2. 单测覆盖

- [ ] 2.1 在 `electron/main/domain/proposal/__tests__/openspec-reader.spec.ts`（如不存在则建）覆盖以下场景：
  - 2.1.1 worktrees 目录不存在 → list 仅含 main 来源；不抛错。
  - 2.1.2 单个 worktree 单 change → list 含一条 worktreePath 非空的条目；字符串等于 `path.resolve(<projectPath>/.worktrees/<wt>)`。
  - 2.1.3 多个 worktree 各自一份 change → list 同时含两条 worktreePath 字段不同的条目。
  - 2.1.4 main active 与 worktree 同名 → list 中该 changeId 仅出现一次，且 worktreePath 非空（worktree 优先）。
  - 2.1.5 main archive 与 worktree active 同名（业务上不会发生但测试 archive 路径不参与去重）：archive 那条 changeId 含日期前缀，worktree 那条 changeId 不含日期前缀，list 同时含两条。
  - 2.1.6 worktree 子目录中 `.openspec.yaml` 缺失 → 跳过该子目录，不抛错。
  - 2.1.7 worktree 路径含 trailing slash 的边界（mock fs 路径返回 `/abs/.worktrees/foo/` 时）→ ProposalMeta.worktreePath === `/abs/.worktrees/foo`。
- [ ] 2.2 在同一测试文件添加 `resolveChangeDir` 测试：
  - 2.2.1 main active 命中 → 返回 main 路径。
  - 2.2.2 main miss、main archive 命中 → 返回 archive 路径。
  - 2.2.3 main miss、archive miss、worktree 命中 → 返回 worktree 路径。
  - 2.2.4 三处都 miss → 返回 null。
- [ ] 2.3 验收：`pnpm test electron/main/domain/proposal` 全过；新增用例覆盖 2.1.1 - 2.2.4。

## 3. 列表页卡片标记

- [ ] 3.1 修改 `frontend/src/pages/proposal/index.vue` 卡片模板：在 status badge 同行右侧（紧邻 `<UBadge ...>` 之后），追加 worktree 标记元素：
  ```vue
  <span
    v-if="proposal.worktreePath"
    class="inline-flex items-center gap-1 text-xs text-muted shrink-0 mt-0.5"
    :title="proposal.worktreePath"
  >
    <UIcon name="i-lucide-git-branch" class="w-3 h-3" />
    <span>worktree</span>
  </span>
  ```
- [ ] 3.2 验收：`worktreePath` 非空的卡片右上角显示 git-branch icon + "worktree" 文案；hover 显示完整路径；`worktreePath` 为 undefined 的卡片不渲染该 DOM。

## 4. dogfood 与零回归验证

- [ ] 4.1 启动 FylloCode（`pnpm dev`）打开任一 git 项目；先用 P2 的 chat 编排创建一个 worktree change（流程：用户同意 propose → agent 跑 worktree add → 调 create-proposal 落 artifacts 到 `.worktrees/foo/`）。
- [ ] 4.2 进入 `/proposal` 列表页，确认看到该 change：
  - 4.2.1 卡片标题为 worktree 内的 change name 标题化。
  - 4.2.2 status badge 旁边出现 worktree 标记。
  - 4.2.3 hover 标记看到完整 worktree 绝对路径。
- [ ] 4.3 点击该卡片进入详情页，确认能正确读到 proposal.md / design.md / specs / tasks 内容（来自 worktree 内的 artifacts）。
- [ ] 4.4 在详情页触发一次 apply（任一 stage）；从主进程 logger / `data/projects/<encoded>/apply-runs/<changeId>/run.json` 中确认 `worktreePath` 字段被写入（值等于 worktree 绝对路径）；apply ACP session cwd 等于 worktree 绝对路径（可在 logger 中 grep "cwd"）。
- [ ] 4.5 用一个非 git 项目（`template: "empty"`）确认列表完全等价于改造前：worktree 标记不出现；apply / archive cwd 仍为主仓库；行为零回归。
- [ ] 4.6 已经 archive 完成的旧 change（`archive/<date>-<id>`）仍在列表显示，状态为 archived；与可能并存的 worktree 来源 active change 不冲突（如果存在异常状态）。
- [ ] 4.7 `pnpm build` / `pnpm lint` / `pnpm typecheck` 全部通过。
- [ ] 4.8 验收：4.1–4.7 全部通过。

## 5. 文档与下游对齐

- [ ] 5.1 检查 `electron/main/services/proposal/apply-run-service.ts` 当前实现是否在 `createApplyRun` 时已经从 ProposalMeta 透传 worktreePath（P1 已完成此 task）。如果发现未透传，按 P1 task 4.1 的实现补齐——但 P1 已完成，本任务只校验。
- [ ] 5.2 检查 `electron/main/ipc/proposal-apply.ts` stage stream 与 archive handler 的 cwd 是否使用 `runMeta.worktreePath ?? projectPath`（P1 已完成）；reminderContext 是否含 worktreePath（P1 已完成）。本任务只校验。
- [ ] 5.3 验收：5.1 / 5.2 校验通过；如果发现 P1 漏实施，回头补 P1 task，**不**在 P3 内补丁。
