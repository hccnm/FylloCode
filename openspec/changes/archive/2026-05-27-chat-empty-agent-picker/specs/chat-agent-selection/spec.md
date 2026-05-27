## REMOVED Requirements

### Requirement: ChatAgentSelect 展示已安装 ACP agent 列表

**Reason**: `ChatAgentSelect` 下拉选择器已被 `ChatEmptyAgentPicker`（空态占位页）替代。空态页面通过 `InstalledAgentTile` 方块卡片和 `AgentPickerModal` 弹窗提供更直观的 agent 选择体验，`ChatAgentSelect` 不再在 `ChatPromptPanel` footer 渲染。

**Migration**: agent 选择入口改为 `frontend/src/components/chat/empty/ChatEmptyAgentPicker.vue`。`ChatAgentSelect.vue` 文件暂留，可在后续清理时删除。

## MODIFIED Requirements

### Requirement: Agent 切换在非流式状态下生效

系统 SHALL 在当前 session 的 `messages.length === 0` 时允许切换 agent。选择器的数据来源为已安装 ACP agent 列表，绑定目标取决于当前是否存在 active session。

agent 选择入口 SHALL 为 `ChatEmptyAgentPicker` 中的 `InstalledAgentTile`（即点即生效）和 `AgentPickerModal`（两步确认）。`ChatAgentSelect` 下拉选择器不再作为 agent 切换入口。

#### Scenario: 草稿态下点击 InstalledAgentTile 绑定 draft agent

- **WHEN** 用户点击"新建 Session"进入草稿态，且当前没有任何 active session
- **THEN** `ChatEmptyAgentPicker` 中的 `InstalledAgentTile` 处于可交互状态
- **AND** 点击后调用 `sessionStore.setDraftAgent(agentId)`，`draftAgentId` 立即更新

#### Scenario: 草稿态首条消息继承当前所选 agent

- **WHEN** 用户在草稿态发送第一条消息
- **THEN** 新创建的 session 的 `agentId` 等于当时的 `draftAgentId`

#### Scenario: 切换到已有 session 时选中态跟随 session

- **WHEN** 用户切换到某个已有 session（`messages.length === 0`）
- **THEN** `ChatEmptyAgentPicker` 中对应 agent 的 `InstalledAgentTile` 显示选中态

#### Scenario: 会话开始后不再显示空态 picker

- **WHEN** 当前 active session 的 `messages.length > 0`
- **THEN** `ChatEmptyAgentPicker` 不渲染，`ChatMessageList` 渲染
