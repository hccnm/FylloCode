## ADDED Requirements

### Requirement: 云效任务适配层从项目挂载资源聚合只读任务

系统 SHALL 在主进程 `service/task` 层提供云效任务适配能力，从当前 FylloCode 项目在 `/integration` 的 `project-management` 阶段中已挂载的 `yunxiao / projex-project` 资源读取云效任务。适配层 SHALL NOT 在 `/task` 页面重新要求用户选择云效项目，也 SHALL NOT 引入独立于项目集成配置之外的云效任务来源配置。

#### Scenario: 当前项目挂载多个云效 Projex 项目

- **WHEN** 当前项目的 `project-management` 阶段已挂载多个 `{ providerId: "yunxiao", resourceType: "projex-project" }` 资源
- **THEN** 适配层从这些挂载项的 `resourceId` 中逐一读取 `spaceId`
- **AND** 对每个 `spaceId` 继续执行云效工作项查询

### Requirement: 云效任务适配层按固定参数查询分配给我的未关闭工作项

云效任务适配层 SHALL 分别对 `Req`、`Task`、`Bug` 三类工作项发起查询，并使用固定搜索参数表达“当前登录云效用户分配给我的未关闭工作项”。实现 SHALL 使用已持久化的云效 `userId` 组装 `assignedTo` 过滤条件，并 SHALL 以固定 `page=1`、`perPage=20`、`orderBy=gmtCreate`、`sort=desc` 查询每个“项目 × 类型”的结果。适配层 SHALL NOT 在 FylloCode 内再次通过 `logicalStatus`、`statusStageId` 或状态名重算“未关闭”。

#### Scenario: 查询需求、任务、缺陷三类工作项

- **WHEN** 适配层开始拉取某个云效 Projex 项目的任务
- **THEN** 系统分别以固定条件查询 `Req`、`Task`、`Bug`
- **AND** 每类请求都包含该项目的 `spaceId`
- **AND** 每类请求都包含 `assignedTo` 为当前云效用户 ID 的过滤条件
- **AND** 每类请求都最多拉取 20 条结果

### Requirement: 云效任务适配层将工作项统一映射为 TaskItem

云效任务适配层 SHALL 在主进程内把云效工作项映射为统一 `TaskItem`，再返回给 renderer。映射结果中 `source` SHALL 为 `yunxiao`，`status` SHALL 为 `open`，`description` SHALL 原样保留云效返回值，`sourceMeta.url` 在第一阶段 SHALL 允许为空。`labels` SHALL 严格包含三项：项目名称 `space.name`、类型固定枚举 `需求/任务/缺陷`、当前状态 `status.displayName`。若本地云效类型声明缺少实现所需字段，系统 SHALL 先补齐 domain 类型声明，而 SHALL NOT 把原始云效对象直接透传到 renderer。

#### Scenario: 映射单条云效工作项

- **WHEN** 适配层拿到一条云效工作项
- **THEN** 系统生成一个 `TaskItem`
- **AND** 其 `id` 采用 `yunxiao:<spaceId>:<workitemId>` 命名空间格式
- **AND** 其 `sourceMeta.key` 使用云效 `serialNumber`
- **AND** 其 `labels` 依次包含项目名称、类型枚举、当前状态

### Requirement: 云效任务聚合采用部分成功优先并静默忽略失败

云效任务适配层 SHALL 允许多个挂载项目中的部分查询失败。对于失败的项目或失败的工作项类型，系统 SHALL 仅记录主进程日志，SHALL NOT 向用户展示错误提示，也 SHALL NOT 因局部失败而丢弃其他项目的成功结果。聚合完成后，系统 SHALL 按 `updatedAt` 倒序返回成功映射出的任务集合。

#### Scenario: 三个挂载项目中一个项目查询失败

- **WHEN** 当前项目挂载了三个云效 Projex 项目，且其中一个项目的任意查询失败
- **THEN** 系统继续返回其余项目中成功拉取并映射出的任务
- **AND** `/task` 页面不展示“部分项目加载失败”提示
- **AND** 失败信息仅保留在主进程日志中
