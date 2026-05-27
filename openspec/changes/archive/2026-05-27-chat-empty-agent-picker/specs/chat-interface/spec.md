## ADDED Requirements

### Requirement: Chat 空态展示 Agent 选择器占位页

当 Chat 主区域无消息时（草稿态或已建空 session），系统 SHALL 渲染 `ChatEmptyAgentPicker` 组件替代消息列表，为用户提供明确的 Agent 选择引导。

`ChatContainer` SHALL 通过 `v-if="isEmpty" / v-else` 在 `messages.length === 0` 时渲染 `ChatEmptyAgentPicker`，有消息时渲染 `ChatMessageList`。`isEmpty` 定义为 `(activeSession?.messages.length ?? 0) === 0`（草稿态 `activeSession` 为 null，视为空）。

#### Scenario: 草稿态进入 Chat 页面

- **WHEN** 用户进入 Chat 页面，`activeSession` 为 null（草稿态）
- **THEN** `ChatContainer` 渲染 `ChatEmptyAgentPicker`，不渲染 `ChatMessageList`
- **AND** `ChatPromptPanel` 仍在底部正常渲染

#### Scenario: 已建空 session 时显示占位页

- **WHEN** 用户切换到一个 `messages.length === 0` 的已建 session
- **THEN** `ChatContainer` 渲染 `ChatEmptyAgentPicker`

#### Scenario: 发送第一条消息后切换为消息列表

- **WHEN** 用户发送第一条消息，`activeSession.messages.length` 变为 1
- **THEN** `ChatContainer` 切换为渲染 `ChatMessageList`，`ChatEmptyAgentPicker` 不再渲染

### Requirement: ChatEmptyAgentPicker 展示已安装 Agent 方块卡片

`ChatEmptyAgentPicker` SHALL 在页面中央展示标题 "Pick an Agent to Start"，以及一个 5 列网格（`grid-cols-5`）：前 4 列为已安装 Agent 的 `InstalledAgentTile`（最多 4 个，取 `installedAgentIds` 前 4 项），第 5 列为 `MoreAgentsTile`（`variant="more"`）。

当无已安装 Agent 时，SHALL 改为展示单个 `MoreAgentsTile`（`variant="promo"`），文案为 "N+ Agents Available"（N 取 `registry.agents.length`）和"点击安装你的第一个 Agent"。

#### Scenario: 有已安装 Agent 时展示方块卡片

- **WHEN** `installedAgentIds.length >= 1`
- **THEN** 展示最多 4 个 `InstalledAgentTile` + 1 个 `MoreAgentsTile variant="more"`，共 5 列网格

#### Scenario: 无已安装 Agent 时展示 promo 卡

- **WHEN** `installedAgentIds.length === 0`
- **THEN** 展示单个 `MoreAgentsTile variant="promo"`，显示 registry 总数和安装引导文案

### Requirement: InstalledAgentTile 即点即生效

点击 `InstalledAgentTile` SHALL 立即写入选定 agent，不需要额外确认步骤。

- 草稿态（`activeSession === null`）：调用 `sessionStore.setDraftAgent(agentId)`
- 已建空 session（`activeSession !== null && messages.length === 0`）：调用 `sessionStore.setSessionAgent(agentId)`

当前选中的 agent（`effectiveAgentId`）对应的 `InstalledAgentTile` SHALL 显示选中态（primary 描边 + 右上角 check icon）。

#### Scenario: 草稿态点击卡片即时切换 agent

- **WHEN** 用户处于草稿态，点击 `InstalledAgentTile`（agentId = "codex"）
- **THEN** `sessionStore.setDraftAgent("codex")` 被调用
- **AND** `draftAgentId` 立即变为 "codex"
- **AND** session store watcher 触发，发起 probe 和 capability 刷新
- **AND** 该卡片显示选中态

#### Scenario: 已建空 session 点击卡片切换 agent

- **WHEN** 用户处于已建空 session，点击另一个 `InstalledAgentTile`
- **THEN** `sessionStore.setSessionAgent(agentId)` 被调用

### Requirement: MoreAgentsTile 打开 AgentPickerModal

点击 `MoreAgentsTile`（无论 variant）SHALL 打开 `AgentPickerModal`。

#### Scenario: 点击 More Agents 打开弹窗

- **WHEN** 用户点击 `MoreAgentsTile`
- **THEN** `AgentPickerModal` 打开

### Requirement: AgentPickerModal 支持搜索、安装、选择

`AgentPickerModal` SHALL 包含：

- 标题"全部 Agents"，副标题"搜索、安装并切换不同的 ACP Agent"
- 搜索框（按 agent name / id 过滤）
- 已安装区：展示已安装 agent 的 `AgentPickerCard`（`selectable`），点击高亮选中（staged）
- 未安装区：展示未安装 agent 的 `AgentPickerCard`，含安装按钮（复用 `acpAgentsStore.installAgent`）
- footer：取消按钮（关闭弹窗不生效）、确定按钮（将 staged agent 写入 `draftAgentId` / `activeSession.agentId`）

弹窗打开时 SHALL 将 `stagedAgentId` 初始化为当前 `effectiveAgentId`，搜索框清空。

未安装 Agent 的卡片 SHALL NOT 可被选中（`selectable` 为 false），只能点安装按钮。安装完成后该 agent 自动出现在已安装区（`statuses` 响应式更新）。

#### Scenario: 弹窗打开初始化 staged agent

- **WHEN** 弹窗打开，当前 `effectiveAgentId` 为 "claude-code"
- **THEN** 已安装区中 "claude-code" 卡片显示选中态

#### Scenario: 选中已安装 agent 后确定生效

- **WHEN** 用户在弹窗中点击已安装 agent 卡片（staged），再点"确定"
- **THEN** `setDraftAgent` 或 `setSessionAgent` 被调用，弹窗关闭

#### Scenario: 取消不生效

- **WHEN** 用户点击"取消"或关闭弹窗
- **THEN** `draftAgentId` / `activeSession.agentId` 不变

#### Scenario: 搜索过滤 agent 列表

- **WHEN** 用户在搜索框输入 "claude"
- **THEN** 已安装区和未安装区均只显示 name 或 id 包含 "claude" 的 agent

#### Scenario: 安装未安装 agent

- **WHEN** 用户点击未安装 agent 卡片上的"安装"按钮
- **THEN** `acpAgentsStore.installAgent(agentId)` 被调用
- **AND** 卡片显示安装进度（spinner + 进度文案）
- **AND** 安装完成后该 agent 出现在已安装区

## REMOVED Requirements

### Requirement: ChatAgentSelect 在 agent 锁定时隐藏

**Reason**: `ChatAgentSelect` 已从 `ChatPromptPanel` footer 移除，由 `ChatEmptyAgentPicker` 承担 agent 选择职责。footer 不再需要 agent 选择器的显示/隐藏逻辑。

**Migration**: agent 选择入口改为 Chat 空态页面的 `InstalledAgentTile` 和 `AgentPickerModal`。
