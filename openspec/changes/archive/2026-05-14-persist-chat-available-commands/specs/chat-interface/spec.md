## MODIFIED Requirements

### Requirement: Session 内存态保存 agent 可用命令列表

系统 SHALL 在 `shared/types/chat.ts` 的 `Session` 接口上保留可选字段 `availableCommands?: AcpAvailableCommand[]`，用于存储 agent 通过 ACP `available_commands_update` 推送的 slash 命令列表，并支持从 session meta 持久化记录恢复。

该字段 SHALL 满足：

- 对 renderer 仍表现为单个 `Session` 对象上的会话级字段：不同 session 各自独立；session 切换时随 `activeSession` 自然切换，无需手工清空。
- 主进程 SHALL 从 session meta 的可选字段 `available_commands` 映射为 `Session.availableCommands` 返回给 renderer。
- session meta 缺失 `available_commands` 时，`Session.availableCommands` SHALL 为 `undefined`。
- `available_commands: []` SHALL 映射为 `availableCommands: []`，不得被折叠为 `undefined`。
- `undefined` 表示"agent 尚未推送"，`[]` 表示"agent 已推送但无可用命令"，`[...]` 表示"有可用命令"。

`AcpAvailableCommand` 类型定义如下（与 ACP 协议 `AvailableCommand` 对齐的前端本地类型）：

```typescript
interface AcpAvailableCommand {
  name: string;
  description: string;
  hint?: string;
}
```

#### Scenario: 磁盘加载的 session 恢复 availableCommands

- **WHEN** session meta 文件包含 `available_commands: [{ name: "review", description: "Review code" }]`
- **THEN** 主进程返回给 renderer 的 `Session.availableCommands` 为 `[{ name: "review", description: "Review code" }]`
- **AND** `useSessionStore.loadSessions` 构建出的 session 保留该字段

#### Scenario: 历史 session 缺失 available_commands 时兜底为 undefined

- **WHEN** session meta 文件不包含 `available_commands`
- **THEN** 主进程返回给 renderer 的 `Session.availableCommands` 为 `undefined`
- **AND** slash 按钮按现有空态规则隐藏

#### Scenario: 空数组语义被保留

- **WHEN** session meta 文件包含 `available_commands: []`
- **THEN** 主进程返回给 renderer 的 `Session.availableCommands` 为 `[]`
- **AND** renderer 不将其归一为 `undefined`

#### Scenario: 切换 session 时数据各自独立并支持回显

- **WHEN** 用户先在 session A 收到并持久化 commands（`availableCommands = [...]`），然后切换到 session B
- **THEN** `activeSession` 切换为 session B，`activeSession.availableCommands` 为 session B 自身字段（通常为 `undefined`、`[]` 或 session B 已持久化的命令集）
- **AND** 再次切回 session A 时，`activeSession.availableCommands` 恢复为 session A 原值
- **AND** slash 按钮和菜单按当前 session 的 `availableCommands` 回显

### Requirement: Session store 提供 setSessionAvailableCommands action

系统 SHALL 在 `frontend/src/stores/session.ts` 的 `useSessionStore` 上提供 action `setSessionAvailableCommands(sessionId: string, commands: AcpAvailableCommand[]): void`，用于在收到 ACP `available_commands_update` chunk 后更新对应 session 的会话级字段。

具体行为：

- 在 `sessions` 数组中查找 `session.id === sessionId` 的条目；
- 若找到，将该 session 的 `availableCommands` 字段覆盖为传入的 `commands`（接受空数组）；
- 若未找到（例如 session 已被删除、或 sessionId 对应 draft 态不在 sessions 数组中），静默 no-op，不抛错；
- 该 action 不修改 `activeSessionId`、不触发排序、不调用任何 IPC。

该 action SHALL 被 `frontend/src/stores/chat.ts` 的 `streamSessionMessage.onChunk` 在收到 `available_commands_update` chunk 时调用。命令持久化由 main 进程负责，renderer 不额外发起持久化 IPC。

#### Scenario: 更新存在的 session

- **WHEN** renderer 收到 `{ kind: "available_commands_update", commands: [{ name: "review", description: "..." }] }` chunk，`activeSession.id` 为 "s-1"，`sessions` 中存在 id 为 "s-1" 的条目
- **THEN** chat store 调用 `sessionStore.setSessionAvailableCommands("s-1", [{ name: "review", description: "..." }])`
- **AND** 该 session 的 `availableCommands` 字段更新为传入数组
- **AND** 其他 session 的 `availableCommands` 不变

#### Scenario: 更新不存在的 session 静默忽略

- **WHEN** 调用 `setSessionAvailableCommands("not-exist", [...])`，`sessions` 中不存在该 id
- **THEN** action 不抛出异常，不修改任何状态

#### Scenario: 空数组覆盖

- **WHEN** 调用 `setSessionAvailableCommands(sessionId, [])`
- **THEN** 对应 session 的 `availableCommands` 被覆盖为 `[]`
- **AND** 不会被当作 `undefined` 处理
