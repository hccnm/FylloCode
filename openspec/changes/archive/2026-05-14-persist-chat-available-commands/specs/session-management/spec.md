## ADDED Requirements

### Requirement: Session 加载恢复可用命令

系统 SHALL 在从磁盘 session meta 加载 session 列表或 session 信息时，恢复持久化的 agent 可用命令列表。主进程读取 session meta 的 `available_commands` 字段后 SHALL 通过 IPC 返回为 `Session.availableCommands`，renderer SHALL 在 `normalizeSession` 后保留该字段。

#### Scenario: Session 列表加载时恢复 availableCommands

- **WHEN** 项目内某 session meta 包含 `available_commands: [{ name: "review", description: "Review code" }]`
- **THEN** `chat:listSessions` 返回的对应 `Session.availableCommands` 为同一命令列表
- **AND** `useSessionStore.loadSessions` 后该 session 对象保留 `availableCommands`

#### Scenario: 选择 session 后命令回显

- **WHEN** 用户选择一个已经从 session meta 恢复 `availableCommands` 的 session
- **THEN** `activeSession.availableCommands` 为该 session 自身字段
- **AND** ChatContainer 的 slash 命令按钮和菜单按该字段回显

#### Scenario: 缺失字段保持兼容

- **WHEN** 历史 session meta 不包含 `available_commands`
- **THEN** `chat:listSessions` 返回的对应 `Session.availableCommands` 为 `undefined`
- **AND** renderer 加载与选择该 session 不抛错
