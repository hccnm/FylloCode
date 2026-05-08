# workflow-stage-quick-edit 规范

## Purpose

在 workflow 编辑器左侧阶段预览区提供有限的结构化辅助操作，允许用户通过 UI 快速追加/删除 stage、切换 stage 的执行 agent、以及拖拽调整 stage 顺序，所有操作最终转化为 YAML 字符串修改。

## Requirements

### Requirement: 追加预置 stage 模板

系统 SHALL 在左侧阶段预览区提供追加 stage 的入口，用户选择 stage type 后，将对应预置模板追加到 YAML 的 stages 末尾。

#### Scenario: 点击 plus-icon 展开 stage type 菜单

- **WHEN** 用户点击左侧阶段预览区的 plus-icon 按钮
- **THEN** 展开 dropdown 菜单，列出所有可用的 stage type（proposal-apply、proposal-archive、code-review、security-check、create-pr、custom）

#### Scenario: 选择 stage type 追加预置模板

- **WHEN** 用户从 dropdown 中选择一个 stage type
- **THEN** 系统将该 type 对应的预置 stage 对象追加到当前 YAML 的 stages 数组末尾
- **AND** YAML 编辑器内容同步更新
- **AND** 左侧阶段预览区立即显示新追加的 stage card

#### Scenario: 内置模板不可追加 stage

- **WHEN** 当前查看的是内置 workflow 模板
- **THEN** plus-icon 按钮不可点击或不显示

### Requirement: 删除已有 stage

系统 SHALL 在每个 stage card 上提供删除入口，用户点击后，将对应 stage 从 YAML 的 `stages` 数组中移除。

#### Scenario: 点击 delete icon 删除 stage

- **WHEN** 用户点击某个 stage card 上的 delete icon 按钮
- **THEN** 系统将该 stage 从当前 YAML 的 `stages` 数组中移除
- **AND** YAML 编辑器内容同步更新
- **AND** 左侧阶段预览区立即移除该 stage card

#### Scenario: 删除最后一个 stage 后展示空态

- **WHEN** 当前 YAML 中仅有一个 stage
- **AND** 用户点击该 stage 的 delete icon 按钮
- **THEN** YAML 中的 `stages` 更新为空数组
- **AND** 左侧阶段预览区展示“YAML 中尚未定义阶段”空态

#### Scenario: 内置模板不可删除 stage

- **WHEN** 当前查看的是内置 workflow 模板
- **THEN** stage card 上的 delete icon 不显示或不可点击

### Requirement: 通过 dropdown 切换 stage 的执行 agent

系统 SHALL 在每个 stage card 的 agent 字段处提供 dropdown，列出已安装的 ACP agent，选择后更新对应 stage 的 `agent` 字段。

#### Scenario: 点击 agent 字段展开已安装 agent 列表

- **WHEN** 用户点击 stage card 上的 agent 字段区域
- **THEN** 展开 dropdown 菜单，列出所有已安装的 ACP agent（显示 agent name，值为 agent id）

#### Scenario: 无已安装 agent 时 dropdown 显示空态

- **WHEN** 用户点击 agent 字段区域
- **AND** 当前没有已安装的 ACP agent
- **THEN** dropdown 显示"暂无已安装的 Agent"提示

#### Scenario: 选择 agent 更新 YAML

- **WHEN** 用户从 dropdown 中选择一个 agent
- **THEN** 系统更新 YAML 中对应 stage 的 `agent` 字段为所选 agent 的 id
- **AND** YAML 编辑器内容同步更新
- **AND** stage card 上的 agent 字段显示更新后的值

#### Scenario: 内置模板 agent 字段不可交互

- **WHEN** 当前查看的是内置 workflow 模板
- **THEN** stage card 上的 agent 字段不可点击，不展开 dropdown

### Requirement: 拖拽调整 stage 顺序

系统 SHALL 支持在左侧阶段预览区通过拖拽 stage card 调整 stages 的执行顺序，拖拽结束后同步更新 YAML。

#### Scenario: 拖拽 stage card 调整顺序

- **WHEN** 用户拖拽一个 stage card 到新位置并释放
- **THEN** 系统按新顺序重排 YAML 中的 stages 数组
- **AND** YAML 编辑器内容同步更新
- **AND** 左侧阶段预览区按新顺序显示 stage card，序号徽标随之更新

#### Scenario: 内置模板不可拖拽排序

- **WHEN** 当前查看的是内置 workflow 模板
- **THEN** stage card 不可拖拽
