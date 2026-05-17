## Context

当前任务看板的第三方来源仍停留在 mock 阶段：`frontend/src/pages/task.vue` 顶部来源 tab 固定写死为“本地 / 云效 / GitHub”，其中“云效 / GitHub”直接渲染页面内置 mock 数据。与此同时，主进程已经具备以下可复用基础：

- provider 连接与过期探测：`electron/main/services/integration/provider-service.ts`
- 项目级阶段资源挂载：`electron/main/infra/storage/project-integration-store.ts`
- 云效 Projex API 封装：`electron/main/domain/integration/yunxiao/projex/index.ts`
- 任务聚合骨架：`electron/main/services/task/task-aggregator.ts`
- 云效任务 adapter 占位：`electron/main/services/task/adapters/yunxiao-task-adapter.ts`

用户已经明确本次目标是“打通流程，不追求第一阶段的精致优化”，因此设计应优先复用既有集成模型，而不是在 `/task` 页面重新引入一套独立的连接、项目选择或第三方任务配置逻辑。

## Goals / Non-Goals

**Goals:**

- 让 `/task` 页的云效来源读取当前项目在 `/integration` 的 `project-management` 阶段已挂载的云效 Projex 项目。
- 仅拉取“当前登录云效用户分配给我的未关闭工作项”。
- 以固定搜索参数分别查询 `Req`、`Task`、`Bug` 三类工作项，每个“项目 × 类型”固定拉取 20 条。
- 在主进程内把云效工作项统一映射为 `TaskItem`，前端不直接感知云效原始 `Workitem` 结构。
- 让任务来源 tab 由项目集成配置动态感知，而不是固定写死。
- 保持现有“发起讨论”链路可直接用于真实云效任务。

**Non-Goals:**

- 不实现云效任务写操作，包括创建、编辑、评论、改状态、指派、关闭等。
- 不实现 GitHub、Jira 或其他 provider 的真实任务读取。
- 不在 `/task` 页面新增任何 provider 连接入口或云效项目选择入口。
- 不实现任务分页、无限滚动、批量刷新、失败项目提示等体验优化。
- 不实现云效富文本描述的格式转换或专门渲染。
- 不在第一阶段补齐云效任务详情 URL，`sourceMeta.url` 允许为空。

## Decisions

### 1. 任务来源 tab 由项目集成配置动态派生

**Decision**

- `/task` 顶部 tab 不再固定写死为“本地 / 云效 / GitHub”。
- “本地”tab 固定存在。
- 其他 tab 仅来自当前项目 `project-management` 阶段已挂载的 provider。
- 对于本 change 的第一阶段，只要 `project-management` 阶段存在任意一条 `{ providerId: "yunxiao", resourceType: "projex-project" }` 记录，就显示“云效”tab。
- provider 是否已连接、凭证是否过期，不影响 tab 是否出现；tab 可见性只由项目集成配置决定。

**Rationale**

- 这与用户对“只有在 `/integration` 里选过项目才显示云效 tab”的要求一致。
- 这与现有 `/integration` 页的语义一致：项目是否引用某 provider，与 provider 当前是否可用是两个层面的问题。
- 为未来 GitHub/Jira 等 provider 扩展保留同一套判定模型。

**Alternatives considered**

- 按“全局已连接 provider”生成 tab：被否决，因为用户明确要求未在 `/integration` 挂载项目时不显示云效 tab。
- 按“当前连接状态 + 已挂载项目”共同决定 tab：被否决，因为用户要求只要项目配置还在就显示 tab。

### 2. 云效任务读取严格复用项目级挂载资源，不新增任务页项目选择器

**Decision**

- `yunxiao-task-adapter` 通过 `loadProjectIntegrationConfig(projectId)` 读取项目配置。
- 只取 `project-management` 阶段中满足以下条件的挂载项：
  - `providerId === "yunxiao"`
  - `resourceType === "projex-project"`
- 每条挂载项的 `resourceId` 作为云效 Projex 查询的 `spaceId`。
- `/task` 页面不新增云效项目选择器，不允许用户在任务页重新选择或覆盖集成页中的挂载项目。

**Rationale**

- 统一“项目集成配置是第三方任务来源的唯一真源”。
- 避免 `/integration` 与 `/task` 出现两套互相不一致的项目选择状态。

### 3. “未关闭任务”由固定云效搜索参数定义，不在 FylloCode 内二次推断

**Decision**

- `yunxiao-task-adapter` 不使用 `logicalStatus`、`statusStageId` 或状态名再做第二次未关闭判断。
- 每类工作项的“未关闭”集合，完全由固定 `conditions` 参数中的状态 ID 决定。
- 三类查询都额外加上 `assignedTo CONTAINS [当前云效用户 ID]` 条件，表示“分配给我”。
- 当前云效用户 ID 从 `getYunxiaoUserId()` 读取，组织 ID 从 `getYunxiaoOrganizationId()` 读取。

**固定查询参数**

- 通用参数：
  - `spaceType: "Project"`
  - `orderBy: "gmtCreate"`
  - `sort: "desc"`
  - `page: 1`
  - `perPage: 20`
- `Bug`：
  - `category: "Bug"`
  - `conditions: {"conditionGroups":[[{"fieldIdentifier":"status","operator":"CONTAINS","value":["28","30","100010"],"toValue":null,"className":"status","format":"list"},{"fieldIdentifier":"assignedTo","operator":"CONTAINS","value":["<yunxiaoUserId>"],"toValue":null,"className":"user","format":"list"}]]}`
- `Req`：
  - `category: "Req"`
  - `conditions: {"conditionGroups":[[{"fieldIdentifier":"status","operator":"CONTAINS","value":["100005","625489","154395","165115","100010","156603","307012","100011","142838","100012","100013","92f8892614756eb5551309e826","bc9040b0df1bbe9dc7a335b75a"],"toValue":null,"className":"status","format":"list"},{"fieldIdentifier":"assignedTo","operator":"CONTAINS","value":["<yunxiaoUserId>"],"toValue":null,"className":"user","format":"list"}]]}`
- `Task`：
  - `category: "Task"`
  - `conditions: {"conditionGroups":[[{"fieldIdentifier":"status","operator":"CONTAINS","value":["100005","100010"],"toValue":null,"className":"status","format":"list"},{"fieldIdentifier":"assignedTo","operator":"CONTAINS","value":["<yunxiaoUserId>"],"toValue":null,"className":"user","format":"list"}]]}`

**Rationale**

- 这些参数是用户直接确认过的业务口径，不应由实现方再自行换成“按阶段推断”或“按状态名推断”。
- 将未关闭逻辑前置到云效查询本身，可以减少 FylloCode 内部二次过滤偏差。

### 4. 云效适配层返回统一 `TaskItem`，不向 renderer 暴露 `Workitem`

**Decision**

- `yunxiao-task-adapter` 内部完成聚合、排序、字段映射。
- `frontend/src/stores/task.ts` 与 `/task` 页继续只处理 `TaskItem[]`。
- 若现有云效类型声明缺少实现所需字段，必须先补齐 `electron/main/domain/integration/yunxiao/projex/types.ts`，而不是把 `unknown` / `any` 或原始对象透传到前端。

**字段映射**

- `TaskItem.id`：`yunxiao:<spaceId>:<workitemId>`
- `TaskItem.projectId`：当前 FylloCode 项目 ID
- `TaskItem.title`：`workitem.subject`
- `TaskItem.description`：原样保留 `workitem.description`
- `TaskItem.status`：固定为 `"open"`，因为查询结果已被固定条件限定为未关闭集合
- `TaskItem.source`：固定为 `"yunxiao"`
- `TaskItem.sourceMeta.source`：`"yunxiao"`
- `TaskItem.sourceMeta.url`：第一阶段固定为空或不填
- `TaskItem.sourceMeta.key`：`workitem.serialNumber`
- `TaskItem.sourceMeta.issueType`：固定枚举映射后的中文类型名之一：`"需求"` / `"任务"` / `"缺陷"`
- `TaskItem.labels`：严格写入三个标签，顺序建议为
  1. 项目名称：`space.name`
  2. 类型：固定枚举 `"需求"` / `"任务"` / `"缺陷"`
  3. 当前状态：`status.displayName`
- `TaskItem.assignee`：若 `assignedTo.id` 和 `assignedTo.name` 存在，则映射为 `{ id, name }`
- `TaskItem.createdAt`：`new Date(workitem.gmtCreate)`
- `TaskItem.updatedAt`：优先 `new Date(workitem.gmtModified)`；若缺失则回退 `new Date(workitem.updateStatusAt)`；再缺失则回退 `createdAt`

**Rationale**

- 统一模型可最大程度复用现有 `TaskCard`、`TaskDetailModal` 和 task-to-chat 流程。
- 标签写法已被用户明确指定，必须写死，避免其他 agent 改成 `categoryId`、`workitemType.name` 或额外标签。

### 5. 多项目、多类型聚合采用“部分成功优先 + 静默忽略失败”

**Decision**

- 对每个已挂载 `spaceId`，分别查询 `Req`、`Task`、`Bug` 三类工作项。
- 聚合时允许单个项目或单个类型查询失败。
- 查询失败的项目/类型不向用户提示，不中断整个云效来源列表。
- 成功结果合并后按 `updatedAt` 倒序返回。
- 失败细节仅记录主进程日志。

**Rationale**

- 用户明确要求“只展示成功拉取的任务，失败状态不提示给用户，就算部分失败也静默忽略”。
- 第一阶段目标是打通链路，不是做完备的失败可视化。

**Alternatives considered**

- 任一项目失败则整体报错：被否决，因为会让局部异常拖垮整个看板。
- 向用户显示“部分项目加载失败”：被否决，因为用户明确不要提示。

### 6. 云效任务空态复用现有“暂无任务”块，不做来源特化

**Decision**

- “云效”tab 下如果最终没有任何可展示任务，直接复用任务页现有“暂无任务”空态块。
- 不区分以下两种情况的文案：
  - 当前项目没有挂载任何云效项目
  - 已挂载云效项目，但“分配给我”的未关闭结果为 0
- 同时将任务页说明文案从“集中查看本地任务，并快速发起 AI 讨论。”修改为“集中查看任务，并快速发起 AI 讨论。”

**Rationale**

- 用户明确要求直接复用当前空态，不再额外抽组件或增加说明文案分支。

### 7. 真实云效任务允许没有 `sourceMeta.url`

**Decision**

- 第一阶段不尝试构造云效任务详情 URL。
- `sourceMeta.url` 留空或不设置。
- 因 `TaskCard` 中“任务来源”按钮依赖 `sourceMeta.url`，第一阶段真实云效任务可以不显示该按钮。
- “发起讨论”与“查看详情”不受影响。

**Rationale**

- 用户明确确认当前云效 API 返回中没有稳定、可立即依赖的详情页 URL 字段。
- 不在这期制造猜测性 URL 规则，避免后续产生错误跳转。

## Risks / Trade-offs

- `[RICHTEXT 描述直接透传]` → 卡片摘要和聊天 prompt 可能出现富文本噪音；第一阶段接受该风险，后续如影响明显再单独处理富文本转换。
- `[部分失败静默忽略]` → 用户无法感知某些挂载项目未成功拉取；通过主进程日志保留诊断线索。
- `[每个项目 × 类型固定 20 条]` → 多项目场景下单次查询量可能较大；第一阶段接受该成本，以流程打通优先。
- `[云效类型声明可能缺字段]` → 如果真实 API 结构与本地类型不一致，实现方必须先补 domain 类型，否则容易出现前端字段漂移。
