## 1. OpenSpec 与共享契约

- [x] 1.1 在 `openspec/changes/integrate-yunxiao-task-board/proposal.md` 中明确记录本 change 的目标、边界和显式非目标，确保其他 agent 不会把范围扩展到 GitHub、第三方写操作、分页优化或富文本渲染。
- [x] 1.2 在 `openspec/changes/integrate-yunxiao-task-board/design.md` 中完整记录动态 tab 规则、云效任务聚合策略、固定查询参数、标签映射、部分失败静默忽略、`sourceMeta.url` 置空、顶部文案修改与空态复用策略。
- [x] 1.3 在 `openspec/changes/integrate-yunxiao-task-board/specs/yunxiao-task-read-model/spec.md` 中新增云效只读任务聚合能力，写清“从 `project-management` 挂载资源读取”“三类固定查询”“TaskItem 映射”“部分成功优先”的行为约束。
- [x] 1.4 在 `openspec/changes/integrate-yunxiao-task-board/specs/task-panel/spec.md` 中修改任务页来源 tab requirement，明确“本地固定 + 第三方按项目集成动态出现”的规则，并去掉“云效 mock 任务”语义。
- [x] 1.5 在 `openspec/changes/integrate-yunxiao-task-board/specs/task-chat-bridge/spec.md` 中补充真实云效任务 `sourceMeta.url` 可为空时的 prompt 行为，禁止输出空 URL 占位。

## 2. 云效 domain 类型与查询参数补齐

- [x] 2.1 检查并补齐 `electron/main/domain/integration/yunxiao/projex/types.ts` 中 `Workitem`、`category`、`space`、`status`、`assignedTo` 等字段声明，确保实现可直接读取 `space.name`、`status.displayName`、`serialNumber`、`assignedTo.id`、`assignedTo.name`；不得通过 `any` 绕过类型缺失。
- [x] 2.2 在 `electron/main/domain/integration/yunxiao/projex/index.ts` 保持现有 `searchWorkitems()` API 作为原始云效查询入口，不在 domain 层写入 FylloCode 的任务映射逻辑。
- [x] 2.3 在 `electron/main/services/task/adapters/yunxiao-task-adapter.ts` 内定义固定查询参数构造函数，分别生成 `Req`、`Task`、`Bug` 的查询参数，三类参数必须严格使用以下固定值：
- [x] 2.4 `Req` 查询参数必须包含：`category: "Req"`、`spaceType: "Project"`、`orderBy: "gmtCreate"`、`sort: "desc"`、`page: 1`、`perPage: 20`，以及 `conditions` 中的状态集合 `["100005","625489","154395","165115","100010","156603","307012","100011","142838","100012","100013","92f8892614756eb5551309e826","bc9040b0df1bbe9dc7a335b75a"]` 与 `assignedTo CONTAINS [yunxiaoUserId]`。
- [x] 2.5 `Task` 查询参数必须包含：`category: "Task"`、`spaceType: "Project"`、`orderBy: "gmtCreate"`、`sort: "desc"`、`page: 1`、`perPage: 20`，以及 `conditions` 中的状态集合 `["100005","100010"]` 与 `assignedTo CONTAINS [yunxiaoUserId]`。
- [x] 2.6 `Bug` 查询参数必须包含：`category: "Bug"`、`spaceType: "Project"`、`orderBy: "gmtCreate"`、`sort: "desc"`、`page: 1`、`perPage: 20`，以及 `conditions` 中的状态集合 `["28","30","100010"]` 与 `assignedTo CONTAINS [yunxiaoUserId]`。
- [x] 2.7 查询参数中的 `yunxiaoUserId` 必须通过 `electron/main/infra/storage/yunxiao-credentials/index.ts` 的 `getYunxiaoUserId()` 读取，`organizationId` 必须通过同文件的 `getYunxiaoOrganizationId()` 读取，不得改用 renderer 传参或临时再探测用户信息。

## 3. 云效任务 adapter 与主进程聚合

- [x] 3.1 在 `electron/main/services/task/adapters/yunxiao-task-adapter.ts` 中实现 `list(projectId)`，先通过 `electron/main/infra/storage/project-integration-store.ts` 的 `loadProjectIntegrationConfig(projectId)` 读取当前项目集成配置。
- [x] 3.2 在 `list(projectId)` 中只读取 `project-management` 阶段下满足 `{ providerId: "yunxiao", resourceType: "projex-project" }` 的挂载项，并把每个 `resourceId` 作为云效 `spaceId`。
- [x] 3.3 若当前项目没有任何符合条件的云效挂载项，则 `yunxiao-task-adapter.list(projectId)` 必须直接返回空数组，不抛错，不 fallback 到 mock 数据。
- [x] 3.4 对每个 `spaceId` 分别查询 `Req`、`Task`、`Bug` 三类工作项；建议使用 `Promise.allSettled()` 以实现“部分成功优先”的失败策略。
- [x] 3.5 对任意单个 `spaceId` 或单个类型的查询失败，只记录主进程日志，不向上抛出中断整个列表的错误；最终仅聚合成功查询结果。
- [x] 3.6 在 `yunxiao-task-adapter.ts` 内新增工作项到 `TaskItem` 的映射函数，并严格使用以下映射：
- [x] 3.7 `TaskItem.id` 使用 `yunxiao:<spaceId>:<workitemId>`；`projectId` 使用传入的当前 FylloCode 项目 ID；`source` 固定为 `"yunxiao"`；`status` 固定为 `"open"`。
- [x] 3.8 `TaskItem.title` 取 `workitem.subject`；`description` 原样取 `workitem.description`，不做 `RICHTEXT` / `MARKDOWN` 转换。
- [x] 3.9 `TaskItem.sourceMeta` 必须包含 `source: "yunxiao"`、`key: workitem.serialNumber`，并在第一阶段显式不写入或写入空的 `url`；不得自行猜测云效详情页 URL。
- [x] 3.10 `TaskItem.sourceMeta.issueType` 第一阶段写入固定中文类型枚举之一：`"需求"` / `"任务"` / `"缺陷"`，映射来源为当前查询类别 `Req / Task / Bug`，不得使用 `categoryId` 原值、`status.displayName` 或其他字段替代。
- [x] 3.11 `TaskItem.labels` 必须严格写入 3 个标签：`space.name`、固定中文类型枚举、`status.displayName`；不得写入额外标签，也不得改顺序。
- [x] 3.12 `TaskItem.assignee` 在 `assignedTo.id` 与 `assignedTo.name` 存在时映射为 `{ id, name }`；缺失时可省略。
- [x] 3.13 `TaskItem.createdAt` 使用 `new Date(workitem.gmtCreate)`；`updatedAt` 优先使用 `new Date(workitem.gmtModified)`，若缺失再回退到 `new Date(workitem.updateStatusAt)`，再缺失回退到 `createdAt`。
- [x] 3.14 在 `electron/main/services/task/task-aggregator.ts` 中保持现有按来源分发逻辑，但确保 `source === "yunxiao"` 时走真实 adapter 而非任何 mock 数据来源。

## 4. 共享类型、任务 store 与动态 tab

- [x] 4.1 检查 `shared/types/task.ts` 中 `YunxiaoTaskMeta` 是否足以表达第一阶段所需字段；若类型过窄，补到最小必要集合，但不要引入本期未使用字段。
- [x] 4.2 在 `frontend/src/stores/task.ts` 中新增或调整“可用来源 tab”所需的派生逻辑，来源集合必须满足：`local` 固定存在；若当前项目 `project-management` 阶段有任意 `yunxiao / projex-project` 挂载，则出现 `yunxiao`；否则不出现。
- [x] 4.3 动态来源 tab 的判定必须基于当前项目集成配置，而不是基于 provider 是否连接成功或是否过期。
- [x] 4.4 若当前已选来源在项目切换后不再可用，例如新项目没有云效挂载，则任务 store 或任务页必须把当前来源重置到 `local`，避免停留在不可见来源。
- [x] 4.5 `frontend/src/api/task.ts` 与 `electron/main/ipc/task.ts` 的请求/响应结构保持不变；不得为了本期接云效而新增额外 IPC channel。

## 5. 任务页、卡片与聊天桥接

- [x] 5.1 修改 `frontend/src/pages/task.vue`，移除页面内写死的 `sourceTabs` 中固定第三方项，改为根据任务 store / 集成配置动态生成 tabs。
- [x] 5.2 删除 `frontend/src/pages/task.vue` 中云效与 GitHub mock 任务常量，以及对应的“v-else 直接渲染 mock 卡片”分支，统一走 `taskStore.loadTasks(selectedSource)` 的真实数据加载路径。
- [x] 5.3 将 `/task` 顶部说明文案从“集中查看本地任务，并快速发起 AI 讨论。”修改为“集中查看任务，并快速发起 AI 讨论。”。
- [x] 5.4 保持“本地”来源下的“新建任务”按钮与状态筛选单选组仅在 `selectedSource === "local"` 时可见；云效来源下不展示本地 CRUD 控件。
- [x] 5.5 当云效来源下加载结果为空时，直接复用当前 `frontend/src/pages/task.vue` 中已有的“暂无任务”空态块，不新增特化文案，不强制抽新组件。
- [x] 5.6 保持 `frontend/src/components/task/TaskCard.vue` 现有 `externalUrl` 判定逻辑；由于第一阶段 `sourceMeta.url` 为空，真实云效任务允许不显示“任务来源”按钮。
- [x] 5.7 保持 `frontend/src/utils/task.ts` 中 `buildSourceDisplay()` 的云效来源展示规则优先使用 `sourceMeta.key`，确保真实云效任务在卡片、详情与 prompt 中显示为 `云效 <serialNumber>`。
- [x] 5.8 保持 `frontend/src/pages/task.vue` 中 `buildTaskPrompt(task)` 的现有“URL 存在才追加括号”的逻辑，不得改成强制输出空 URL 占位。

## 6. 测试与验证

- [x] 6.1 为 `electron/main/services/task/adapters/yunxiao-task-adapter.ts` 新增单元测试，至少覆盖：无挂载项返回空数组、单项目三类查询成功、多项目部分失败静默忽略、`TaskItem.labels` 三项映射、`sourceMeta.url` 为空、`assignedTo` 查询条件使用已存储 `userId`。
- [x] 6.2 为 `electron/main/services/task/task-aggregator.ts` 或相关 service 测试补充“source = yunxiao 返回真实 adapter 结果”的断言，避免回退到 mock 路径。
- [x] 6.3 为 `frontend/src/stores/task.ts` 或相关 store 测试补充动态来源可见性断言，至少覆盖：仅本地、已挂载云效、挂载存在但 provider 过期仍显示云效 tab、项目切换后来源回退到 `local`。
- [x] 6.4 为 `frontend/src/pages/task.vue` 或任务页测试补充真实来源行为断言，至少覆盖：顶部文案更新、云效 tab 只在挂载存在时出现、云效空列表复用“暂无任务”、云效任务不显示“新建任务”与本地状态筛选。
- [x] 6.5 为任务聊天桥接测试补充真实云效任务 prompt 断言，确保 `sourceMeta.url` 为空时 prompt 只显示 `**来源**: 云效 <key>`，不出现空括号。
- [x] 6.6 实施完成后运行与本 change 相关的测试集，并记录至少包含任务 adapter、任务页、任务 store 的验证结果；若无法运行，需在实现说明中明确标出未验证项。
