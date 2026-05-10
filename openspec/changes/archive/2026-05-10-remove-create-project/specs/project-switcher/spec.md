## MODIFIED Requirements

### Requirement: 项目切换器下拉支持导航

The system SHALL 在点击时展开下拉列表，包含从持久化存储加载的项目列表。

#### Scenario: 切换项目

- **WHEN** 用户点击项目切换器并选择其他项目
- **THEN** 系统检测该项目目录是否存在
- **AND** 若目录存在，统一项目上下文更新为所选项目，主内容区域更新为所选项目的工作区
- **AND** 若目录不存在，显示提示告知用户目录不存在，不切换项目，不自动移除该记录

## REMOVED Requirements

### Requirement: 项目切换器下拉包含新建项目选项

**Reason**: 创建项目功能已从应用中移除。

**Migration**: 用户应在 WelcomeView 使用"打开文件夹"按钮来添加新项目。
