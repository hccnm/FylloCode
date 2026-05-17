## MODIFIED Requirements

### Requirement: 云效任务适配层将工作项统一映射为 TaskItem

云效任务适配层 SHALL 在主进程内把云效工作项映射为统一 `TaskItem`，再返回给 renderer。映射结果中 `source` SHALL 为 `yunxiao`，`status` SHALL 为 `open`，`description` SHALL 原样保留云效返回值，`labels` SHALL 严格包含三项：项目名称 `space.name`、类型固定枚举 `需求/任务/缺陷`、当前状态 `status.displayName`。系统 SHALL 按 workitem 类型为 `sourceMeta.url` 构造稳定详情地址：`Req` → `https://devops.aliyun.com/projex/project/<space.id>/req/<id>`，`Task` → `https://devops.aliyun.com/projex/project/<space.id>/task/<id>`，`Bug` → `https://devops.aliyun.com/projex/project/<space.id>/bug/<id>`。若本地云效类型声明缺少实现所需字段，系统 SHALL 先补齐 domain 类型声明，而 SHALL NOT 把原始云效对象直接透传到 renderer。

#### Scenario: 映射单条需求类云效工作项

- **WHEN** 适配层拿到一条 `category = "Req"` 的云效工作项
- **THEN** 系统生成一个 `TaskItem`
- **AND** 其 `id` 采用 `yunxiao:<spaceId>:<workitemId>` 命名空间格式
- **AND** 其 `sourceMeta.key` 使用云效 `serialNumber`
- **AND** 其 `sourceMeta.url` 等于 `https://devops.aliyun.com/projex/project/<space.id>/req/<id>`
- **AND** 其 `labels` 依次包含项目名称、类型枚举“需求”、当前状态

#### Scenario: 映射单条任务类云效工作项

- **WHEN** 适配层拿到一条 `category = "Task"` 的云效工作项
- **THEN** 系统生成一个 `TaskItem`
- **AND** 其 `sourceMeta.url` 等于 `https://devops.aliyun.com/projex/project/<space.id>/task/<id>`
- **AND** 其 `labels` 依次包含项目名称、类型枚举“任务”、当前状态

#### Scenario: 映射单条缺陷类云效工作项

- **WHEN** 适配层拿到一条 `category = "Bug"` 的云效工作项
- **THEN** 系统生成一个 `TaskItem`
- **AND** 其 `sourceMeta.url` 等于 `https://devops.aliyun.com/projex/project/<space.id>/bug/<id>`
- **AND** 其 `labels` 依次包含项目名称、类型枚举“缺陷”、当前状态
