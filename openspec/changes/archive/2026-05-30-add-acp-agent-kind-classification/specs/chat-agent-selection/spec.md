## ADDED Requirements

### Requirement: Chat 空态 AgentPickerModal 卡片表达分类差异

Chat 空态弹窗 `AgentPickerModal` 中的 `AgentPickerCard` SHALL 根据 `agent.__fyllo.kind` 渲染分类标识，与设置页 `AgentCard` 共用同一个徽章组件（如 `AgentKindBadge.vue`），以保证图标与文案一致。

渲染规则：

- `native` 或缺失 `__fyllo`：不渲染分类图标
- `adapter`：渲染 `i-lucide-layers` 图标，hover 显示「适配器 · 自带完整实现，可与已安装的对应 Agent 共享配置」
- `bridge`：渲染 `i-lucide-cable` 图标，hover 显示「桥接器 · 与 Agent 桥接打通，需要先安装对应的 Agent」

#### Scenario: AgentPickerModal 卡片显示分类图标

- **WHEN** `AgentPickerModal` 中渲染的 `AgentPickerCard` 对应 agent `__fyllo.kind` 为 `"adapter"` 或 `"bridge"`
- **THEN** 卡片名称行 SHALL 显示对应的分类图标
- **AND** hover 时 SHALL 显示对应文案

#### Scenario: AgentPickerModal native 卡片保持简洁

- **WHEN** `AgentPickerModal` 中渲染的 `AgentPickerCard` 对应 agent `__fyllo.kind` 为 `"native"` 或 `__fyllo` 缺失
- **THEN** 卡片 SHALL 不显示任何分类图标

### Requirement: Chat 空态 InstalledAgentTile 不展示分类

Chat 空态首屏的 `InstalledAgentTile` SHALL **不**接受、传递或渲染 `__fyllo.kind` 相关的视觉标识。该 tile 仅承担 agent 切换入口职责，引导/教育由 `AgentPickerModal` 中的 `AgentPickerCard` 承担。

#### Scenario: InstalledAgentTile 不渲染分类徽章

- **WHEN** Chat 空态渲染任意 `InstalledAgentTile`（无论对应 agent `__fyllo.kind` 为何值）
- **THEN** tile 内 SHALL **不**显示任何分类图标或徽章

#### Scenario: InstalledAgentTile 不接受 kind prop

- **WHEN** 检视 `InstalledAgentTile.vue` 的 `defineProps`
- **THEN** SHALL **不**包含 `kind` 字段
- **AND** 父组件 `ChatEmptyAgentPicker` 在传值时 SHALL **不**传 `kind`

#### Scenario: 切换/选中行为不受分类影响

- **WHEN** 用户在 Chat 空态点击 adapter 或 bridge 类的 `InstalledAgentTile`
- **THEN** `sessionStore.setDraftAgent(agentId)` 的调用与 native 类完全一致
- **AND** 分类元数据 SHALL 不影响选中、确认、流式等交互逻辑
