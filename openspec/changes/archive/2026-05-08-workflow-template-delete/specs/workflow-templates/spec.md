## MODIFIED Requirements

### Requirement: 模板编辑器支持保存和删除

系统 SHALL 在模板编辑器顶部提供保存和删除操作；删除操作 SHALL 仅对自定义模板可见；保存修改后的内置模板 SHALL 创建新的自定义工作流模板副本。

#### Scenario: 保存内置模板副本

- **WHEN** 用户编辑内置工作流模板并点击"复制并保存"
- **THEN** 系统创建包含当前 YAML 内容的新自定义工作流模板
- **AND** 原内置模板保持不变
- **AND** 系统显示 toast 提示保存成功

#### Scenario: 保存自定义模板

- **WHEN** 用户编辑自定义工作流模板并点击"保存 YAML"
- **THEN** 现有自定义工作流模板就地更新
- **AND** 系统显示 toast 提示保存成功

#### Scenario: 详情页删除自定义模板

- **WHEN** 用户查看自定义工作流模板详情页
- **THEN** 顶部操作区显示删除按钮，默认呈现 neutral 风格，hover 时呈现 danger/error 提示
- **AND** 点击删除按钮后，模板被删除，中央主区域退出模板编辑器视图
- **AND** 系统显示 toast 提示删除成功

#### Scenario: 内置模板详情页不显示删除按钮

- **WHEN** 用户查看内置工作流模板详情页
- **THEN** 顶部操作区不显示删除按钮

## ADDED Requirements

### Requirement: 自定义模板卡片支持删除操作

系统 SHALL 在 Sidebar 自定义模板卡片 hover 时显示操作菜单入口（more icon），点击后弹出包含"删除"项的 dropdown menu；内置模板卡片 SHALL 不显示此菜单入口。

#### Scenario: hover 自定义模板卡片显示 more icon

- **WHEN** 用户将鼠标悬停在 Sidebar 自定义模板卡片上
- **THEN** 卡片右侧显示 more icon 按钮

#### Scenario: 点击 more icon 弹出 dropdown menu

- **WHEN** 用户点击自定义模板卡片的 more icon
- **THEN** 弹出 dropdown menu，包含"删除"菜单项

#### Scenario: 从 Sidebar 删除自定义模板

- **WHEN** 用户点击 dropdown menu 中的"删除"
- **THEN** 模板被删除，Sidebar 列表中该模板消失
- **AND** 若该模板当前处于编辑器视图，中央主区域退出模板编辑器视图
- **AND** 系统显示 toast 提示删除成功

#### Scenario: 内置模板卡片不显示 more icon

- **WHEN** 用户将鼠标悬停在 Sidebar 内置模板卡片上
- **THEN** 卡片不显示 more icon 按钮
