## MODIFIED Requirements

### Requirement: ACP session 生命周期管理

系统 SHALL 在每次 `streamMessage` 时，根据是否存在持久化的 `acpSessionId` 决定调用 `newSession` 或 `resumeSession`。`acpSessionId` SHALL 在 `newSession`/`resumeSession` 返回后**立即**持久化，不等待 prompt 完成。

`newSession` 与 `resumeSession` 的 `mcpServers` 参数 SHALL 统一由 `@main/infra/mcp/bundled-mcp-servers#getBundledMcpServers({ projectPath })` 计算得出，而非硬编码空数组或忽略不传。系统 SHALL 不在 `services/chat/acp-session.ts` 内部拼装 MCP server 的 `command`/`args`/`env`；所有启动描述符单点通过 `getBundledMcpServers` 获取。虽然 ACP 协议中 `ResumeSessionRequest.mcpServers` 为 optional，但为了保持恢复后的 session 内可用 tool 集合与 new session 一致，系统 SHALL 在 resume 调用中也显式传入该参数。

#### Scenario: 首次发送消息创建新 ACP session

- **WHEN** IPC handler 收到 `chat:stream:message`，且该 `sessionId` 无持久化的 `acpSessionId`
- **THEN** 调用 `connection.newSession({ cwd, mcpServers })`，其中 `mcpServers` 为 `getBundledMcpServers({ projectPath })` 的返回值
- **AND** 在正常启用内置 MCP 的场景下，`mcpServers` 至少包含一个 `name === "fyllo-specs"` 的 spec
- **AND** `newSession` 返回后立即将 `acpSessionId` 持久化到 session 元数据文件
- **AND** emit `{ type: "session_id_resolved", acpSessionId }` 事件，IPC 层监听后写入 session-store

#### Scenario: 续接已有 ACP session

- **WHEN** IPC handler 收到 `chat:stream:message`，且该 `sessionId` 存在持久化的 `acpSessionId`
- **THEN** 调用 `connection.resumeSession({ sessionId: acpSessionId, cwd, mcpServers })`，其中 `mcpServers` 为 `getBundledMcpServers({ projectPath })` 的返回值
- **AND** 在正常启用内置 MCP 的场景下，`mcpServers` 至少包含一个 `name === "fyllo-specs"` 的 spec
- **AND** 若 `resumeSession` 返回错误，降级为 `newSession`，降级时 `mcpServers` 同样由 `getBundledMcpServers({ projectPath })` 计算，更新持久化记录，并 emit `session_id_resolved`

#### Scenario: 取消流式传输

- **WHEN** IPC handler 收到 `chat:stream:cancel`，包含 `{ sessionId }`
- **THEN** 调用 `connection.cancel({ sessionId: acpSessionId })` 取消当前 prompt
- **AND** 通过 MessagePort 发送 `{ type: "done" }` 并关闭 port1

#### Scenario: 禁用内置 MCP 环境变量生效

- **WHEN** 主进程启动前环境变量 `FYLLO_DISABLE_BUNDLED_MCP=1`
- **AND** IPC handler 收到 `chat:stream:message`，无论走 `newSession` 还是 `resumeSession` 分支
- **THEN** 对应调用的 `mcpServers` 为空数组
- **AND** chat 流程其余行为保持不变
