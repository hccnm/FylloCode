## Why

ACP agent 会在 `available_commands_update` 中声明当前 session 可用的 slash 命令。现有实现只把该事件透传到 renderer 并存入前端内存态，应用重启、重新加载 session 或重新进入会话后命令会丢失，导致 slash 菜单无法回显。

## What Changes

- `chat:stream:message` 在收到 `available_commands_update` 后，继续向 renderer 透传 chunk，同时将命令列表写入当前 session meta。
- session meta 新增可选落盘字段 `available_commands`，用于保存 `AcpAvailableCommand[]`；字段缺失时表示 agent 尚未推送，空数组表示 agent 明确声明无可用命令。
- 主进程从 session meta 构建返回给 renderer 的 `Session` 时，将 `available_commands` 映射为现有 `Session.availableCommands` 字段；字段缺失时返回 `undefined`。
- renderer 从主进程加载 session 列表或 session 信息后保留 `availableCommands`，切换会话时依赖 `activeSession.availableCommands` 自然回显 slash 命令按钮与菜单。
- 更新既有“availableCommands 仅内存态、不写 SessionMeta”的规范与测试断言。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `chat-interface`: `Session.availableCommands` 从纯内存态改为可由 session meta 恢复的会话级字段，并要求切换会话时回显持久化命令。
- `session-management`: 从磁盘加载 session 列表/选择 session 时应恢复 session meta 中的可用命令字段。
- `ipc-streaming`: `available_commands_update` 在 chat 流中仍作为 chunk 透传，但 chat handler 需要同时持久化该 session 级状态。
- `acp-chat-backend`: 主进程 chat stream 对 `available_commands_update` 的处理从“不写 SessionMeta”改为“透传并写入 SessionMeta.available_commands”。

## Impact

- 共享类型：`SessionMeta` 需要新增 `available_commands?: AcpAvailableCommand[]`，`Session` 继续暴露 `availableCommands?: AcpAvailableCommand[]`。
- 主进程：`session-store` 读写/normalize、`chat-service.toSession`、`chat:stream:message` 的 `available_commands_update` 分支。
- 渲染进程：`frontend/src/stores/session.ts` 的序列化/normalize 类型需要保留来自 IPC 的 `availableCommands`。
- 测试：更新 chat IPC 中 `available_commands_update` 持久化断言，补充 session meta round-trip、list/load sessions 回显、renderer 切换回显相关测试。
