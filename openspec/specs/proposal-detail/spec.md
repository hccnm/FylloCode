# proposal-detail Specification

## Purpose

定义 Proposal 详情页能力，包括独立详情路由、顶部基础信息展示，以及 proposal/design/tasks markdown 文件的 tab 渲染。

## Requirements

### Requirement: Proposal detail page has independent route

系统 SHALL 为 proposal 详情提供独立路由 `/proposal/:id`，其中 id 为 change 目录名。

#### Scenario: Navigate to detail

- **WHEN** 用户点击列表中的 proposal 卡片
- **THEN** 路由跳转至 `/proposal/:id`
- **AND** 页面展示该 proposal 的详情

#### Scenario: Back navigation

- **WHEN** 用户点击详情页的返回按钮
- **THEN** 路由返回 `/proposal` 列表页

### Requirement: Proposal detail header shows basic info

详情页顶部 SHALL 展示：proposal 标题、状态 badge、创建日期、任务完成进度。

#### Scenario: Header renders metadata

- **WHEN** 用户进入详情页
- **THEN** 顶部显示标题、状态 badge、日期和任务进度

### Requirement: Proposal detail renders markdown files as tabs

详情页 SHALL 以 tab 形式渲染 proposal.md、design.md、tasks.md，顺序固定为 Proposal → Design → Tasks。文件不存在时不渲染对应 tab。

#### Scenario: All three files exist

- **WHEN** change 目录下存在 proposal.md、design.md、tasks.md
- **THEN** 详情页显示三个 tab

#### Scenario: design.md missing

- **WHEN** change 目录下不存在 design.md
- **THEN** 详情页只显示 Proposal 和 Tasks 两个 tab

#### Scenario: Tab content renders markdown

- **WHEN** 用户切换到某个 tab
- **THEN** 对应 markdown 文件内容以渲染格式展示
