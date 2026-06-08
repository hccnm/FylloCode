## ADDED Requirements

### Requirement: Chat session meta persists Fyllo action states

系统 SHALL 在 chat session meta 中持久化 Fyllo action 的用户交互状态，字段名为 `actionStates`。该字段 SHALL 只服务 Chat 主会话中的 `<fyllo-action>`，Apply / Archive SHALL NOT 读写该字段。

`actionStates` SHALL 是 `Record<string, FylloActionState>`，key 为 action id，value 结构如下：

```json
{
  "type": "task.create",
  "status": "succeeded",
  "updatedAt": "2026-06-08T00:00:00.000Z"
}
```

`FylloActionState` SHALL 只包含：

- `type`: 已注册的 Fyllo action type。
- `status`: `"succeeded" | "failed" | "cancelled"`。
- `updatedAt`: ISO 8601 字符串。

系统 SHALL NOT 持久化 `ready` 或 `running` 状态。缺失 action state SHALL 表示该 action 处于默认 ready 状态。系统 SHALL NOT 在 `actionStates` 中持久化 payload、payload hash、业务 result 或错误详情。

#### Scenario: 用户确认成功后写入 succeeded

- **WHEN** Chat 主会话中的 `task.create` action handler 执行成功
- **THEN** renderer 通过 chat action state IPC 写入当前 session meta
- **AND** session meta 的 `actionStates[actionId]` 为 `{ "type": "task.create", "status": "succeeded", "updatedAt": "<ISO timestamp>" }`
- **AND** session meta 中已有的 `available_commands`、`configOptions`、`tokenUsage` 等字段保持不变

#### Scenario: 用户取消后写入 cancelled

- **WHEN** 用户点击 Chat 主会话中 Fyllo action 的 `取消`
- **THEN** renderer 通过 chat action state IPC 写入当前 session meta
- **AND** session meta 的 `actionStates[actionId].status` 为 `"cancelled"`
- **AND** 不调用该 action 的业务 handler

#### Scenario: handler 失败后写入 failed

- **WHEN** 用户确认 Chat 主会话中的 Fyllo action
- **AND** action handler 返回失败或抛出错误
- **THEN** renderer 通过 chat action state IPC 写入当前 session meta
- **AND** session meta 的 `actionStates[actionId].status` 为 `"failed"`
- **AND** 错误详情不写入 session meta

#### Scenario: 重新加载 session 后回显 action state

- **WHEN** renderer 通过 `chat:listSessions` 或 session meta 恢复一个包含 `actionStates` 的 Chat session
- **THEN** `Session.actionStates` 包含持久化的 action state
- **AND** 对应 action card 按 `succeeded`、`failed` 或 `cancelled` 状态回显

### Requirement: Action state updates use field-level session meta patch

系统 SHALL 通过 `session-store.ts` 的字段级更新接口写入 `actionStates`。写入单个 action state 时 SHALL 合并现有 `actionStates`，并保留 session meta 的所有其他字段。

#### Scenario: 写入一个 action state 保留其他 action state

- **WHEN** session meta 中已有 `actionStates.actionA`
- **AND** renderer 写入 `actionStates.actionB`
- **THEN** 写回后的 session meta 同时包含 `actionA` 和 `actionB`

#### Scenario: action state 写入不覆盖其他 meta 字段

- **WHEN** session meta 中已有 `available_commands`、`configOptions` 和 `tokenUsage`
- **AND** renderer 写入一个 Fyllo action state
- **THEN** 写回后的 session meta 保留原有 `available_commands`、`configOptions` 和 `tokenUsage`
