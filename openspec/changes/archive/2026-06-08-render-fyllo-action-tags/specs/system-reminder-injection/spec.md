## ADDED Requirements

### Requirement: Chat reminder 注入 Fyllo action 协议

系统 SHALL 在 chat owner 的 system-reminder 中注入 `<fyllo-action>` 协议说明和已启用 action type 的 payload contract。该注入 SHALL 只影响 chat reminder，不影响 apply 或 archive reminder。

注入内容 SHALL 来自 shared Fyllo action contract 注册表，而不是在 chat reminder 模板中手写一份可能漂移的 type/payload 列表。注入内容 SHALL 至少包含：

- `<fyllo-action type="...">...</fyllo-action>` 标签格式。
- 只允许 `type` 一个 attribute。
- 已启用 action type 的精确枚举。
- 每个 action type 的严格 JSON object payload schema。
- 每个 action type 的最小合法示例。
- 禁止 Agent 定义按钮、version、id、handler、IPC channel 或额外字段。
- 指示 Agent 只在用户与 Agent 已经讨论出需要 FylloCode 端侧确认的结果后，在 assistant 可见回复中输出该标签。

若没有任何启用的 action type，chat reminder SHALL 明确指示 Agent 不得输出 `<fyllo-action>`。

#### Scenario: chat reminder 包含 task.create contract

- **WHEN** 主进程为 chat owner 渲染 system-reminder
- **THEN** reminder 文本包含 `<fyllo-action type="task.create">`
- **AND** reminder 文本包含 `task.create` 的 payload 字段 `title` 与 `description`
- **AND** reminder 文本说明 `title` 为必填非空字符串
- **AND** reminder 文本说明 `description` 为可选字符串

#### Scenario: chat reminder 禁止 Agent 自定义按钮或额外 attr

- **WHEN** 主进程为 chat owner 渲染 system-reminder
- **THEN** reminder 文本说明 `<fyllo-action>` 只允许 `type` 一个 attribute
- **AND** reminder 文本说明按钮由 FylloCode 控制，Agent 不得输出按钮文案
- **AND** reminder 文本不鼓励输出 `version`、`id`、`title` 或 `confirmLabel` attribute

#### Scenario: apply 和 archive reminder 不注入 action 协议

- **WHEN** 主进程为 apply 或 archive owner 渲染 system-reminder
- **THEN** reminder 文本不追加 chat-only 的 `<fyllo-action>` action type contract 列表
