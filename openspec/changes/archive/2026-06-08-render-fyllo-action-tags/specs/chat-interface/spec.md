## ADDED Requirements

### Requirement: Assistant text 渲染支持 Fyllo action 自定义标签

系统 SHALL 在 Chat 主会话的 assistant 可见 text part 的 Markdown 渲染路径中启用 `<fyllo-action>` 自定义标签渲染。该能力 SHALL 通过项目统一 Markdown 渲染组件接入 markstream-vue 的 `customHtmlTags` 与 scoped custom component mapping，而不是在 `AssistantMessage.vue` 中扫描字符串。

当 assistant part 为 reasoning 时，系统 SHALL NOT 启用可交互 Fyllo action 渲染。reasoning 内容中的 `<fyllo-action>` SHALL 不挂载确认/取消 action card，也 SHALL NOT 执行任何 action handler。

Apply / Archive SidePanel 或其他非 Chat 主会话的 assistant 消息渲染 SHALL NOT 启用可交互 Fyllo action。该阶段未来若需要 workflow gate action，应另行定义独立能力，不复用 Chat session meta。

系统 SHALL 在每个 MarkStream 实例的生命周期内使用该实例的 `custom-id` 注册 scoped custom component，并在实例卸载或 `custom-id` 变化时清理对应 mapping，避免不同消息或历史渲染实例之间串用自定义组件。

#### Scenario: assistant text part 渲染 action card

- **WHEN** assistant text part 包含合法 `<fyllo-action type="task.create">{"title":"补齐错误处理"}</fyllo-action>`
- **THEN** `MarkStream.vue` 向 markstream-vue 传入包含 `fyllo-action` 的 custom HTML tags
- **AND** markstream-vue 将该标签交给 Fyllo action 自定义组件渲染
- **AND** 页面显示 FylloCode 控制的 action card

#### Scenario: assistant reasoning part 不挂载交互 action

- **WHEN** assistant reasoning part 包含 `<fyllo-action type="task.create">{"title":"补齐错误处理"}</fyllo-action>`
- **THEN** `AssistantMessage.vue` 对 reasoning 分支调用 `MarkStream.vue` 时不启用 Fyllo action
- **AND** renderer 不显示可确认的 action card
- **AND** renderer 不调用任何 Fyllo action handler

#### Scenario: Apply SidePanel 不启用 Fyllo action

- **WHEN** Proposal Apply 或 Archive SidePanel 中的 assistant text part 包含 `<fyllo-action type="task.create">{"title":"补齐错误处理"}</fyllo-action>`
- **THEN** 该 MarkStream 实例不启用 Fyllo action custom component
- **AND** renderer 不显示可确认的 action card
- **AND** renderer 不调用任何 Fyllo action handler

#### Scenario: MarkStream 卸载时清理 scoped custom component

- **WHEN** 一个渲染过 Fyllo action 的 MarkStream 实例被卸载
- **THEN** renderer 调用 markstream-vue 的 `removeCustomComponents(customId)` 清理该实例注册的 mapping
- **AND** 其他消息实例继续使用自己的 scoped mapping

#### Scenario: 普通 Markdown 渲染保持现状

- **WHEN** assistant text part 不包含 `<fyllo-action>`
- **THEN** Markdown 段落、代码块、工具结果和其他现有渲染行为保持不变
