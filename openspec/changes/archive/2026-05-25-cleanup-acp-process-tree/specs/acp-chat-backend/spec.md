## MODIFIED Requirements

### Requirement: ACP agent 进程池管理（按 agentId 懒启动复用）

系统 SHALL 维护一个 `Map<agentId, AcpAgentProcess>` 进程池（`acp-process-pool.ts`），不在应用启动时预启动任何进程。首次使用某个 `agentId` 时，系统 SHALL 懒启动对应子进程并通过 `ClientSideConnection.initialize` 完成握手；后续同 `agentId` 的请求复用同一连接。进程退出时 SHALL 自动重启并重新握手。

ACP agent 子进程在 POSIX 平台（macOS / Linux）SHALL 以独立 process group leader 形式启动，使主进程在退出阶段可以按 process group 一次性回收 ACP agent 自身及其派生的所有 MCP 孙进程。Windows 平台 SHALL NOT 设置 `detached`，进程组语义改由 `taskkill /T` 在退出阶段处理。

#### Scenario: 首次使用某 agentId 时懒启动进程

- **WHEN** `getOrStartProcess(agentId)` 被调用，且该 `agentId` 尚无运行中的进程
- **THEN** 系统从 `AcpInstalledRecord` 读取 `installMethod`，按以下规则组装 spawn 命令：
  - `npx`：`spawn("npx", ["--no-install", distribution.npx.package, ...(distribution.npx.args ?? [])])`
  - `uvx`：`spawn("uvx", [distribution.uvx.package, ...(distribution.uvx.args ?? [])])`
  - `binary`：`spawn(installPath, [])` （`installPath` 来自 `installed.json` 中的记录，指向 `getDataSubPath('acp')/bin/<agent-id>/` 下的可执行文件）
- **AND** 所有方式均使用 `stdio: ["pipe", "pipe", "pipe"]`
- **AND** 在 POSIX 平台（`process.platform !== "win32"`）的 spawn options 中携带 `detached: true`，使 child 通过 `setsid()` 成为独立 process group leader（pgid === child.pid）
- **AND** 在 Windows 平台 SHALL NOT 设置 `detached: true`，避免 child 被切到独立 console 窗口
- **AND** SHALL NOT 调用 `child.unref()`，使 Node 主进程在 `before-quit` 钩子完成前仍持有该 child 引用
- **AND** spawn 后通过 `ClientSideConnection.initialize` 完成握手
- **AND** 将连接实例存入进程池，供后续同 `agentId` 的请求复用

#### Scenario: 同 agentId 复用已有进程

- **WHEN** `getOrStartProcess(agentId)` 被调用，且该 `agentId` 已有运行中的进程
- **THEN** 直接返回已有的 `ClientSideConnection`，不重新 spawn

#### Scenario: ACP agent 进程意外退出后自动重启

- **WHEN** 某 `agentId` 对应的子进程意外退出，且当前 pool 未处于 shuttingDown 状态
- **THEN** 系统重新 spawn 该子进程并完成 `initialize` 握手
- **AND** 重启期间收到的 `streamMessage` 请求 SHALL 返回 `{ type: "error", data: { code: "ACP_NOT_READY" } }`
