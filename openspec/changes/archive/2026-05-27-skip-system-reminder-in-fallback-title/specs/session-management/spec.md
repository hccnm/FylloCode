## MODIFIED Requirements

### Requirement: Session 标题具备本地兜底与 Agent 覆盖能力

系统 SHALL 在真实 session 创建时，从草稿态首条 prompt 的 `parts` 中选取**第一条 `type === "text"` 且不是 system-reminder 包裹**的 text part，作为本地兜底标题的原文；其中 system-reminder 包裹定义为：经 `String#trim` 后以 `<system-reminder>` 开头并以 `</system-reminder>` 结尾的 text part（与 `frontend/src/utils/system-reminder.ts` 的 `isSystemReminderPart` 判定一致）。系统 SHALL 在该原文上保留既有截断与抽取策略——优先匹配 `^\*\*标题\*\*:\s*(.+)$` 行作为标题来源；否则去首尾空白并将连续空白压缩为单个空格——再取前 30 个字符。当 `parts` 中不存在任何符合上述条件的 text part，或抽取后字符串为空时，系统 SHALL 使用 `DEFAULT_SESSION_TITLE`（`"New Session"`）作为兜底标题。

当 ACP agent 在对话过程中推送 `session_info_update` 事件且包含 `title` 字段时，系统 SHALL 用该值覆盖当前标题并持久化到磁盘。

#### Scenario: 新 session 使用首条非 system-reminder 文本兜底标题

- **WHEN** 用户在草稿态发送第一条消息并创建 session，且 `parts` 全部为非 system-reminder 的 text part
- **THEN** session 标题初始显示为对首条 text part 内容执行去首尾空白、压缩连续空白后的前 30 个字符

#### Scenario: 草稿态首条 prompt 含 system-reminder 时跳过 reminder 取后续文本

- **WHEN** 用户在草稿态发送第一条消息，且 `parts[0]` 是 system-reminder 包裹的 text part，`parts[1]` 是普通 text part
- **THEN** session 兜底标题基于 `parts[1]` 文本生成，不包含 `parts[0]` 的任何字符
- **AND** 截断策略与现有一致（`**标题**:` 抽取优先，否则空白归一后取前 30 个字符）

#### Scenario: 草稿态首条 prompt 仅含 system-reminder 时回退默认标题

- **WHEN** 用户在草稿态发送第一条消息，且 `parts` 中所有 text part 都是 system-reminder 包裹
- **THEN** session 标题为 `DEFAULT_SESSION_TITLE`（`"New Session"`）
- **AND** 不抛错，不影响后续 `streamMessage` 调用

#### Scenario: Agent 未推送标题时保留兜底标题

- **WHEN** 新 session 创建后，ACP agent 未推送任何 `session_info_update`
- **THEN** session 标题保持为首条非 system-reminder 文本生成的兜底标题

#### Scenario: Agent 推送标题后更新

- **WHEN** ACP agent 推送 `session_info_update` 事件且 `title` 字段非空
- **THEN** session 标题更新为 agent 推送的值，并持久化到磁盘元数据文件
