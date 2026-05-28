## Why

设置页"ACP Agents"目前只能安装，不能卸载。已安装的 agent 无法在 UI 内移除，用户必须自行 `npm uninstall -g`、`uv tool uninstall` 或手动删除 `<userData>/acp/bin/<id>/` 目录，并且手动操作不会同步清理 FylloCode 的 `installed.json` 与 `agent-capabilities.json` 缓存，导致状态不一致。

为了闭合 install/uninstall 的对称生命周期，避免状态漂移，并对"FylloCode 安装"与"用户自行安装"两类来源给出明确语义，需要在 UI、IPC、主进程服务三层增加卸载能力。

## What Changes

- 在 `AgentCard.vue` 的"已安装"状态下新增**卸载**按钮入口（仅当 `agentStatus.installed === true` 时可见），点击后弹出二次确认对话框。
- 新增二次确认对话框：根据 `managedBy` 与 `installMethod` 渲染不同文案与命令展示块，明确告知用户即将执行的命令或要删除的路径。
- 新增 IPC channel `acp:uninstall`，输入参数 `agentId: string`，输出 `IpcResponse<void>`。
- 新增 IPC channel `acp:uninstallProgress`（事件流），用于推送 `{ agentId, status: "uninstalling" | "done" | "error", message? }`。
- 主进程新增 `uninstallAgent` / `uninstallAgentById`，按 `installMethod` 分支执行：
  - `npx` → `npm uninstall -g <package>`
  - `uvx` → `uv tool uninstall <package>`
  - `binary` → `rm -rf <userData>/acp/bin/<agent-id>/`
- 卸载成功后从 `installed.json` 删除该 agent 条目，并从 `agent-capabilities.json` 删除该 agent 的能力缓存。卸载失败则报错并保留所有记录。
- 与安装共用同一把并发互斥锁：同一时间只允许一个 agent 处于"安装中"或"卸载中"状态。
- Pinia store `useAcpAgentsStore` 新增 `uninstallAgent(agentId)` 方法、`uninstallProgress` state、`onUninstallProgress` 监听。
- 卸载不会删除 agent 运行时写入的用户数据（如 `~/.claude/`、`~/.config/<agent>/`）；这是显式的非目标。
- **MODIFIED Capabilities** 的影响范围仅限 `agent-install`；状态检测、安装行为本身不变。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-install`：在 `acp:install`、`acp:installProgress`、并发限制等已有需求基础上，新增卸载相关需求（卸载入口可见性、二次确认契约、按 method 分支的卸载操作、记录与缓存清理、与安装互斥的并发限制）。

## Impact

- **代码**
  - `shared/types/channels.ts`：新增 `AcpAgentChannels.uninstall`、`AcpAgentChannels.uninstallProgress`。
  - `shared/schemas/ipc/acp-agents.ts`：新增 `uninstallAgentInputSchema`。
  - `shared/types/acp-agent.ts`：新增 `AcpUninstallProgress` 类型。
  - `electron/main/ipc/acp-agents.ts`：注册 `uninstall` handler。
  - `electron/main/services/acp-agent/acp-agent-service.ts`：新增 `uninstallAgentById`、`broadcastUninstallProgress`。
  - `electron/main/services/acp-agent/installer.ts`：新增 `uninstallAgent`，并将并发锁 `activeInstallAgentId` 改造为 `activeMutationAgentId`，覆盖 install 与 uninstall。
  - `electron/main/domain/acp/detector.ts`：新增 `removeInstalledRecord(agentId)` 工具函数（或在 service 层就地处理）。
  - `electron/main/infra/storage/agent-capability-store.ts`：新增 `removeAgentCapabilities(agentId)`。
  - `electron/preload/api/acp-agents.ts`：新增 `uninstall(agentId)`、`onUninstallProgress(listener)`。
  - `frontend/src/api/acp-agents.ts`：新增 `uninstall` 方法。
  - `frontend/src/stores/acp-agents.ts`：新增 `uninstallAgent`、`uninstallProgress` state、`onUninstallProgress` 订阅。
  - `frontend/src/components/settings/AgentCard.vue`：新增卸载按钮 + 卸载确认 `UModal`。
  - `frontend/src/components/settings/SettingsAgents.vue`：监听卸载事件，向 store 转发。

- **数据 / 文件**
  - `<userData>/acp/installed.json`：卸载成功删除对应 agent 条目。
  - `<userData>/acp/agent-capabilities.json`：卸载成功删除对应 agent 条目。
  - `<userData>/acp/bin/<agent-id>/`：binary 类型卸载时整目录删除。

- **OpenSpec**
  - `openspec/specs/agent-install/spec.md`：在 MODIFIED 区块更新"并发安装限制"为"安装与卸载共用并发互斥"，并新增 ADDED 卸载相关 SHALL。

- **不影响**：会话、任务、registry 拉取、icon 缓存、health-check、其他 spec。
