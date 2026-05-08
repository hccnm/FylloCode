## MODIFIED Requirements

### Requirement: 左侧阶段预览区支持有限结构化编辑

系统 SHALL 在 workflow 详情区左侧提供阶段预览，预览区除只读渲染外，还 SHALL 支持追加 stage、删除 stage、切换 agent、拖拽排序等有限结构化操作，所有操作均通过修改 YAML 字符串实现，YAML 仍为唯一数据源。

#### Scenario: 左侧预览区显示阶段列表及操作入口

- **WHEN** 用户选择一个自定义 workflow 模板
- **THEN** 左侧预览区显示从 YAML 解析的 stage card 列表
- **AND** 列表顶部显示 plus-icon 按钮用于追加 stage
- **AND** 每个 stage card 显示 delete icon 按钮用于移除当前 stage
- **AND** 每个 stage card 的 agent 字段可点击切换

#### Scenario: 内置模板左侧预览区为纯只读

- **WHEN** 用户选择一个内置 workflow 模板
- **THEN** 左侧预览区显示 stage card 列表，但所有交互操作（追加、删除、agent 切换、拖拽）均不可用
