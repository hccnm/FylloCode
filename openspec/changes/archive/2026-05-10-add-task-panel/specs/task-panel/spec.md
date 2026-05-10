# task-panel Specification

## Purpose

定义任务面板页面的布局、任务卡片展示、渠道切换交互，以及"点击进聊天"的核心入口行为。

## Requirements

### Requirement: 任务面板以可滚动卡片列表渲染任务

系统 SHALL 在 `/task` 主内容区渲染垂直滚动的任务卡片列表。每张卡片 SHALL 显示任务标题、描述摘要、来源标识、创建时间和状态指示器。

#### Scenario: 空任务列表

- **WHEN** 用户导航至 `/task` 且当前无任务
- **THEN** 页面显示空态，包含图标和提示文案

#### Scenario: 多卡片任务列表

- **WHEN** 用户导航至 `/task` 且存在任务
- **THEN** 每个任务渲染为一张卡片，展示标题、描述（截断至 2-3 行）、来源标识、相对创建时间和状态
- **AND** 卡片垂直堆叠，保持一致的间距

### Requirement: 任务卡片支持主操作与次操作

每张任务卡片 SHALL 暴露主操作"发起讨论"和次操作"任务来源"（如适用）。主操作 SHALL 触发聊天集成。次操作 SHALL 在外部浏览器中打开任务 URL。

#### Scenario: 点击本地任务的主操作

- **WHEN** 用户点击本地任务卡片上的"发起讨论"
- **THEN** 系统以任务描述为初始 prompt 发起聊天会话
- **AND** 导航至 `/chat`

#### Scenario: 点击外部任务的主操作

- **WHEN** 用户点击外部任务卡片上的"发起讨论"（未来阶段）
- **THEN** 系统以外部任务描述为初始 prompt 发起聊天会话
- **AND** 次操作打开外部系统的任务 URL

### Requirement: 任务面板提供渠道筛选标签

系统 SHALL 在任务列表顶部渲染渠道筛选标签："本地"、"云效"、"GitHub"。"本地"标签 SHALL 显示本地任务存储中的真实任务（支持 CRUD）。"云效"和"GitHub"标签 SHALL 显示预置的 mock 任务，以演示多源聚合的视觉效果。

#### Scenario: 筛选本地渠道

- **WHEN** 用户点击"本地"标签
- **THEN** 显示来自本地任务存储的任务
- **AND** 可见状态筛选器（"打开" / "关闭"）用于进一步筛选

#### Scenario: MVP 阶段筛选云效渠道

- **WHEN** 用户在 MVP 阶段点击"云效"标签
- **THEN** 页面显示预置的云效 mock 任务（3 条）
- **AND** 每条 mock 任务渲染云效特有的 sourceMeta 字段（`url`、`key`、`issueType`）

#### Scenario: MVP 阶段筛选 GitHub 渠道

- **WHEN** 用户在 MVP 阶段点击"GitHub"标签
- **THEN** 页面显示预置的 GitHub mock 任务（3 条）
- **AND** 每条 mock 任务渲染 GitHub 特有的 sourceMeta 字段（`url`、`repository`、`number`、`issueType`）

### Requirement: 任务面板为本地任务提供状态筛选

系统 SHALL 仅在"本地"标签激活时显示状态筛选单选组（"打开" / "关闭"）。筛选器 SHALL 仅作用于本地任务。默认筛选值为"打开"。

#### Scenario: 筛选打开状态

- **WHEN** 用户在"本地"标签下选择"打开"筛选
- **THEN** 仅显示 `status === "open"` 的本地任务

#### Scenario: 筛选关闭状态

- **WHEN** 用户在"本地"标签下选择"关闭"筛选
- **THEN** 仅显示 `status === "closed"` 的本地任务

### Requirement: 任务面板支持新建本地任务

系统 SHALL 提供"新建任务"按钮，点击后打开弹窗以创建新的本地任务。弹窗 SHALL 包含标题（必填）和描述（可选）字段。

#### Scenario: 新建本地任务

- **WHEN** 用户点击"新建任务"并填写标题
- **THEN** 创建一条 `status: "open"`、`source: "local"` 的新本地任务
- **AND** 任务立即出现在列表中

#### Scenario: 取消任务创建

- **WHEN** 用户打开创建弹窗后点击取消
- **THEN** 不创建任务，弹窗关闭

### Requirement: 任务面板支持删除本地任务

系统 SHALL 允许从任务卡片删除本地任务。删除 SHALL 需要确认。

#### Scenario: 删除本地任务

- **WHEN** 用户点击本地任务的删除按钮并确认
- **THEN** 任务从存储中移除，列表同步更新

### Requirement: 任务面板显示任务来源标识

每张任务卡片 SHALL 显示来源特定的标识，标明任务的来源系统（如"本地"、"云效 YX-1024"、"example/repo#88"）。标识 SHALL 包含代表来源系统的图标。

#### Scenario: 本地任务来源标识

- **WHEN** 显示一条本地任务
- **THEN** 卡片显示"本地"及本地文档图标

#### Scenario: 外部任务来源标识

- **WHEN** 显示一条外部任务（未来阶段）
- **THEN** 卡片显示对应的来源标识及来源系统图标
