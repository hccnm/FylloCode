## REMOVED Requirements

### Requirement: 项目创建模态框收集项目信息

**Reason**: FylloCode 的核心理念是"打开现有代码文件夹即开始工作"，创建项目功能与这一理念不符。用户可通过"打开文件夹"完成所有工作流。

**Migration**: 使用 WelcomeView 上的"打开文件夹"按钮打开现有目录。

### Requirement: 项目名称为必填项

**Reason**: 创建项目功能已移除，表单校验不再适用。

**Migration**: N/A

### Requirement: 存储路径默认为合理位置

**Reason**: 创建项目功能已移除，默认路径填充不再适用。

**Migration**: N/A

### Requirement: 模板选择支持空项目和 Git 克隆

**Reason**: 创建项目功能已移除，模板选择不再适用。

**Migration**: N/A

### Requirement: 项目创建后进入工作区

**Reason**: 创建项目功能已移除，创建后跳转逻辑不再适用。

**Migration**: 使用"打开文件夹"打开目录后，系统会自动进入工作区。
