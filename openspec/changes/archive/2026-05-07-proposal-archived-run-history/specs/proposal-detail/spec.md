## ADDED Requirements

### Requirement: Archived proposal detail can open apply run history manually

系统 SHALL 在 `proposal.status === "archived"` 的详情页 header 提供“查看运行历史”入口。用户点击后，详情页打开 SidePanel，并尝试加载该 proposal 最近一次 apply run 的元数据与历史日志。

#### Scenario: Archived proposal has persisted run history

- **WHEN** 用户打开 archived proposal 详情页并点击“查看运行历史”
- **THEN** 详情页打开 SidePanel
- **AND** 页面尝试加载该 proposal 最近一次 apply run 的元数据
- **AND** renderer 直接传递当前详情页的 `changeId`
- **AND** 主线程在需要时将 archived proposal id 归一化到对应原始 `changeId` 后读取历史 run
- **AND** SidePanel 展示已持久化的历史日志

### Requirement: Archived proposal history panel shows empty state when no history exists

系统 SHALL 在用户主动打开 archived proposal 的运行历史但未找到可展示的 run 元数据或历史日志时，保留 SidePanel 打开状态并展示 EmptyState。

#### Scenario: No persisted run metadata

- **WHEN** 用户打开 archived proposal 的运行历史，但没有对应的 `run.json`
- **THEN** SidePanel 保持打开
- **AND** SidePanel 展示 EmptyState，提示当前 proposal 暂无运行记录

#### Scenario: Persisted run has no messages

- **WHEN** 用户打开 archived proposal 的运行历史，`run.json` 存在但当前应展示的历史消息为空
- **THEN** SidePanel 保持打开
- **AND** SidePanel 展示 EmptyState，而不是渲染空白日志区域
