## Why

当前 `/task` 页面对云效与 GitHub 仅展示前端 mock 任务，尚未接入真实第三方任务来源，无法承接“在集成页选定项目后，把分配给我的真实任务带入 FylloCode 并发起讨论”的核心流程。项目中已经存在 provider 连接、项目级资源挂载、任务聚合器与云效 Projex API 基础，本次需要把这些能力接成一条稳定、可实现、无歧义的只读任务聚合链路。

## What Changes

- 将任务看板的第三方来源从固定写死渠道改为“本地固定 + 当前项目已挂载资源的 provider 动态感知”。
- 将 `/task` 页中的“云效”来源从 mock 数据改为真实数据，数据来源仅限当前项目在 `/integration` 的 `project-management` 阶段已挂载的 `yunxiao / projex-project` 资源。
- 在主进程 `service/task` 层补齐 `yunxiao-task-adapter`，分别以固定查询参数拉取 `Req`、`Task`、`Bug` 三类工作项，并聚合为统一 `TaskItem[]`。
- 云效任务仅只读展示，不支持在 FylloCode 内创建、编辑、评论、改状态、指派或其他第三方写操作。
- 云效任务的“发起讨论”继续复用现有 task-to-chat 流程；第一阶段允许 `sourceMeta.url` 为空，因此不强制展示“任务来源”按钮。
- 任务看板空态继续复用当前“暂无任务”样式，不因“未挂载云效项目”和“已挂载但结果为 0”而区分不同文案。

## Capabilities

### New Capabilities

- `yunxiao-task-read-model`: 定义从已挂载云效 Projex 项目中聚合只读任务并映射为 `TaskItem` 的能力约束。

### Modified Capabilities

- `task-panel`: 将任务来源 tab 从固定写死渠道改为项目集成驱动的动态来源，并把云效来源从 mock 切换为真实只读任务。
- `task-chat-bridge`: 明确真实云效任务进入聊天时允许 `sourceMeta.url` 为空，prompt 仍需保持可操作且不展示空 URL。

## Impact

- 主进程任务层：`electron/main/services/task/adapters/yunxiao-task-adapter.ts`、`electron/main/services/task/task-aggregator.ts`
- 云效 domain 类型与 API 封装：`electron/main/domain/integration/yunxiao/projex/*`
- 项目级集成读取：`electron/main/infra/storage/project-integration-store.ts`
- 共享任务类型：`shared/types/task.ts`
- 渲染进程任务页与 store：`frontend/src/pages/task.vue`、`frontend/src/stores/task.ts`、`frontend/src/utils/task.ts`
- 测试：任务 adapter/service、任务页动态 tab、云效任务展示与 prompt 构造相关测试
