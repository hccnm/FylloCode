# proposal-list Specification

## Purpose

定义 Proposal 列表页能力，包括概览统计、状态筛选、卡片元数据展示和排序规则。

## Requirements

### Requirement: Proposal list page displays overview statistics

系统 SHALL 在列表页顶部展示三个统计数字：全部 proposal 数量、进行中（applying 状态）数量、已归档数量。

#### Scenario: Statistics reflect current data

- **WHEN** 用户进入 `/proposal` 页面
- **THEN** 页面顶部显示全部、进行中、已归档三个统计数字
- **AND** 数字与当前 project 的 openspec/changes 目录内容一致

### Requirement: Proposal list supports status filtering

系统 SHALL 提供状态筛选，支持按全部、创建中、草稿、实现中、已归档过滤列表。

#### Scenario: Filter by status

- **WHEN** 用户点击某个状态筛选项
- **THEN** 列表只显示该状态的 proposal
- **AND** 其他状态的 proposal 不可见

#### Scenario: Default shows all

- **WHEN** 用户进入列表页，未选择任何筛选
- **THEN** 显示全部 proposal

### Requirement: Proposal cards display key metadata

每张 proposal 卡片 SHALL 展示：标题（目录名格式化）、状态 badge、Why 摘要（2 行截断）、创建日期、任务完成进度（完成数/总数）。

#### Scenario: Card renders metadata

- **WHEN** 列表中存在 proposal
- **THEN** 每张卡片显示标题、状态 badge、why 摘要、日期和任务进度

#### Scenario: Why text truncation

- **WHEN** Why 摘要超过 2 行
- **THEN** 超出部分以省略号截断

### Requirement: Proposal list is sorted by creation date descending

系统 SHALL 按 `.openspec.yaml` 中的 `created` 字段倒序排列 proposal 列表。

#### Scenario: Newest first

- **WHEN** 列表页加载完成
- **THEN** 创建日期最新的 proposal 排在最前
