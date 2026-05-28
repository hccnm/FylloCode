## Context

`agent-install` 已经定义了三种分发类型（npx / uvx / binary）的安装流程、`installed.json` 记录、`acp:install` IPC、并发互斥与 `acp:installProgress` 进度推送。当前缺失的是对称的卸载能力：

- 设置页 `AgentCard.vue` 在 `installed === true` 时只显示"已安装"徽章和"最新版本"提示，没有卸载按钮。
- 主进程 `installer.ts` 只导出 `installAgent`；`acp-agent-service.ts` 只暴露 `installAgentById`；IPC 层只注册了 `acp:install`。
- `installed.json`（由 `detector.ts` 的 `readInstalledRecords` / `writeInstalledRecords` 维护）和 `agent-capabilities.json`（`agent-capability-store.ts`）没有删除单条记录的工具函数。

`installed.json` 中每条记录已经携带 `managedBy: "fyllocode" | "user"` 与 `installMethod: "npx" | "uvx" | "binary"`，这是设计卸载分支的现成依据，无需引入新字段。

## Goals / Non-Goals

**Goals:**

- 提供与"安装"对称的"卸载"能力，覆盖 npx / uvx / binary 三种分发类型。
- 在 UI 层强制二次确认，文案根据 `managedBy × installMethod` 组合精确告知用户即将执行的命令或要删除的路径。
- 卸载完成后，`installed.json` 与 `agent-capabilities.json` 中的对应条目同步清理；卸载失败则任何记录都不动。
- 与安装共用并发互斥锁，避免同一 agent 同时处于"装"与"卸"中间态。

**Non-Goals:**

- 不删除 agent 运行时写入的用户数据（`~/.claude/`、`~/.config/<agent>/`、`~/.cache/<agent>/` 等）。这些目录的所有权属于 agent 自身，与 npm/uv 的卸载行为对称。
- 不提供"批量卸载"。
- 不引入"软卸载/仅清记录"的分支：对 `managedBy: "user"` 的 agent 也执行真实卸载命令，差异仅在确认文案上。
- 不改动 registry 拉取、icon 缓存、health check 等周边逻辑。
- 不为 binary 卸载实现"系统级卸载"——当前 binary 安装路径（`net.fetch` 下载 archive → `unzip`/`tar -x` 解压到 `<userData>/acp/bin/<id>/`）没有向系统注册任何卸载入口，`rm -rf` 是该安装路径的唯一对称卸载方式。

## Decisions

### 1. 新增独立 IPC channel：`acp:uninstall` 与 `acp:uninstallProgress`

**为什么不复用 `acp:install` / `acp:installProgress`**：

- 语义不同：`installProgress.status` 包含 `downloading | installing | done | error`，卸载没有 `downloading` 阶段；混用会让前端区分逻辑变得脆弱。
- 复用并发锁不等于复用 channel——锁可以共享，进度流应当分离。

**Decision**：

```ts
// shared/types/channels.ts
export const AcpAgentChannels = {
  // ...existing...
  uninstall: "acp:uninstall",
  uninstallProgress: "acp:uninstallProgress",
} as const;
```

```ts
// shared/types/acp-agent.ts
export interface AcpUninstallProgress {
  agentId: string;
  status: "uninstalling" | "done" | "error";
  message?: string;
}
```

### 2. 并发锁改造：`activeInstallAgentId` → `activeMutationAgentId`

**Alternative considered**：为 uninstall 单独维护 `activeUninstallAgentId`。被否决原因：UI 上同一 agent 不应同时显示"安装中"和"卸载中"，且对其他 agent 来说，"全局有一个 agent 正在变更"才是关键约束。

**Decision**：

- `installer.ts` 中 `activeInstallAgentId: string | null` 重命名为 `activeMutationAgentId: string | null`。
- 新增 `INSTALL_BUSY` / `UNINSTALL_BUSY` 错误码语义统一，复用现有 `INSTALL_BUSY`（消息变为"请等待当前操作完成"）以减少分散。
- `installAgent` 与 `uninstallAgent` 入口处都检查并设置 `activeMutationAgentId`，`finally` 中统一释放。

### 3. 卸载失败时不清理任何记录

**Alternative considered**：卸载命令失败但本地路径已不存在时，仍清记录以避免"幽灵已安装"。被否决原因：增加分支判断，且 `detectAgentStatuses` 自身已经具备"系统中检测不到则下次刷新清记录"的兜底逻辑（`detector.ts:354-356`）。

**Decision**：

- `npm uninstall -g` / `uv tool uninstall` 退出码非 0 → 抛 `UNINSTALL_FAILED` 错误，保留 `installed.json` 与 `agent-capabilities.json` 完整。
- `rm -rf` 抛错（极少见）→ 同上。
- 真正"已不存在"的情况由下一次 `acp:detectStatus` 自然修正。

### 4. 二次确认文案：按 `managedBy × installMethod` 渲染六种组合

**Decision**：在 `AgentCard.vue` 中新增 `showUninstallModal` 状态，模态结构与已有 `showTakeoverModal` 保持一致风格（`UModal` + 警告图标 + 命令展示块）。

文案矩阵（`agent.distribution.npx?.package` / `agent.distribution.uvx?.package` / `<userData>/acp/bin/<agent-id>` 通过 props 与 store 派生）：

| `managedBy` | `installMethod` | `leadText`                                           | `actionLabel` | `commandOrPath`                 | `footnote`                           | 主按钮     |
| ----------- | --------------- | ---------------------------------------------------- | ------------- | ------------------------------- | ------------------------------------ | ---------- |
| `fyllocode` | `npx`           | 该 Agent 由 FylloCode 安装，确定卸载吗？             | 将会执行      | `npm uninstall -g <package>`    | 卸载完成后将清除本地安装记录。       | 卸载       |
| `fyllocode` | `uvx`           | 同上                                                 | 将会执行      | `uv tool uninstall <package>`   | 同上                                 | 卸载       |
| `fyllocode` | `binary`        | 同上                                                 | 将会删除      | `<userData>/acp/bin/<agent-id>` | 同上                                 | 卸载       |
| `user`      | `npx`           | 该 Agent 由你自行安装，是否同意 FylloCode 代为卸载？ | 将会执行      | `npm uninstall -g <package>`    | 此操作会修改你的全局环境，不可撤销。 | 同意并卸载 |
| `user`      | `uvx`           | 同上                                                 | 将会执行      | `uv tool uninstall <package>`   | 同上                                 | 同意并卸载 |
| `user`      | `binary`        | 同上                                                 | 将会删除      | `<userData>/acp/bin/<agent-id>` | 此操作不可撤销。                     | 同意并卸载 |

binary 行的"删除路径"使用 `<userData>/acp/bin/<agent-id>` 这一**目录**（而非具体可执行文件路径），与 `rm -rf` 实际操作目标一致。`<userData>` 在 UI 上展示为 Electron `app.getPath('userData')` 真实路径（通过 IPC 拿到），避免歧义。

主按钮颜色：`fyllocode` 用 `error`（强卸载），`user` 用 `warning`（用户授权）。

### 5. binary 卸载只删 `<userData>/acp/bin/<agent-id>/`

**Why**：

- `installer.ts:282-313` 显示 binary 安装的副作用仅限于：临时目录（finally 已清）、`<userData>/acp/bin/<agent-id>/`。
- 我们用 `unzip` / `tar -x` 解压，**不执行任何 postinstall 脚本**，因此 archive 内容不可能向其他位置写入。
- 各 OS 的"系统卸载入口"（pkgutil / apt / msiexec）都需要安装时向系统注册——我们的安装路径没有注册，因此没有"系统自带卸载"可用。

### 6. 主进程清理 `agent-capabilities.json` 由 `agent-capability-store.ts` 提供新函数

**Decision**：新增 `removeAgentCapabilities(agentId: string): Promise<void>`，复用已有 `loadCache` / `writeCacheDocument`，删除 key 后回写。

`installed.json` 的清理直接在 `acp-agent-service.ts` 内通过 `readInstalledRecords` → `delete records[agentId]` → `writeInstalledRecords` 完成，不必新加导出函数。

### 7. UI 入口位置

**Decision**：

- 已安装且无可用更新（`canUpdate === false` 且 `agentStatus.installed === true`）：右侧从"已安装徽章 + 最新版本"扩展为"已安装徽章 + 卸载按钮 + 最新版本"。
- 已安装且有可用更新（`canUpdate === true`）：保留"更新"主按钮，旁边追加"卸载"次按钮。
- "卸载"按钮在另一个 agent 正在安装/卸载时（`actionDisabled === true`）禁用，与"安装/更新"按钮一致。
- 卸载进行中：右侧显示与 install 相同形态的 spinner + "正在卸载..."。

## Risks / Trade-offs

- **Risk**：`managedBy: "user"` 的卸载会修改用户全局环境（`npm uninstall -g`），影响超出 FylloCode 范围。 → **Mitigation**：二次确认明确告知"由你自行安装、是否同意代为卸载"，并显示具体命令；按钮文案用"同意并卸载"以强化授权语义。
- **Risk**：binary 卸载用 `rm -rf <userData>/acp/bin/<id>/` 在路径计算错误时具有破坏性。 → **Mitigation**：路径硬编码组合为 `getDataSubPath('acp')` + `'bin'` + `agent.id`，与安装路径同一表达式；卸载前断言 `agent.id` 非空、非 `..`、非绝对路径成分。
- **Risk**：卸载命令执行慢（npm 全局卸载偶尔几十秒），用户重复点击。 → **Mitigation**：执行期间禁用按钮、显示 spinner，配合并发互斥锁阻止重入。
- **Risk**：`npm uninstall -g` 在某些环境（nvm / 权限受限）可能"看似成功但二进制仍在 PATH"。 → **Mitigation**：本次按"命令退出码即真值"处理；下一次 `detectStatus` 仍能检测到则用户会看到"已安装"状态恢复，不算正确性问题。
- **Trade-off**：不实现"撤销卸载"。判定撤销需要重新走完整安装流程，复杂度远高于价值。
- **Trade-off**：不清理 agent 运行时数据。优先与 npm/uv 行为一致，对用户预期更稳定；后续若需要可通过 manifest `uninstall.extraPaths` 增量扩展，不属本次范围。

## Migration Plan

无破坏性变更。`installed.json`、`agent-capabilities.json`、`acp:install` 现有契约保持不变；新增字段 / channel 都是可选增量。前端在更新前后都能正常工作（旧版本看不到卸载按钮但其他功能正常）。

## Open Questions

无。共识已在 chat 阶段全部对齐。
