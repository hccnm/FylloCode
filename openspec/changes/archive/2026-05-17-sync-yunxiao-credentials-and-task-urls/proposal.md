## Why

当前云效集成存在两个已经确认的行为缺口。其一，settings 中通过 provider 入口连接云效成功后，只把云效用户 ID 写入了 `connections.json` 的 `accountId`，但后续云效 API 调用和任务适配层实际依赖的是 `credentials` 文件中的 `userId`，导致连接成功与后续读取身份之间存在断层。其二，`yunxiao-task-adapter` 已经把云效 workitem 映射为 `TaskItem`，但 `sourceMeta.url` 仍为空，导致任务卡片与任务到聊天的来源引用链路缺少稳定跳转地址。

这两个问题都不是单纯的内部实现替换，而是在补齐“系统应该如何持久化云效身份”和“系统应该如何构造云效任务来源 URL”的明确行为约束。如果不先把 change artifacts 写清楚，后续交由其他 agent 实现时很容易把写入位置、字段来源、URL 规则或测试边界做偏。

## What Changes

- 明确云效 provider 连接成功后的凭据持久化规则：在通用 provider 连接状态写入之外，云效还必须把 `getUser()` 返回的 `user.id` 持久化到 `yunxiao` credentials 文件中的 `userId` 字段。
- 明确本次只覆盖“新连接成功后的正确写入”，不处理历史已连接数据补齐，也不要求在 `probeProvider("yunxiao")` 成功时做自愈回填。
- 明确云效 provider 断开连接时，`yunxiao` credentials 文件中的 `userId` 也必须一并清除，避免残留过期身份信息。
- 修改云效任务读模型：`yunxiao-task-adapter` 在把云效 `Req` / `Task` / `Bug` 映射为 `TaskItem` 时，必须按固定规则构造 `sourceMeta.url`。
- 固定三类云效 workitem 的 URL 规则：
  - `Req` → `https://devops.aliyun.com/projex/project/<space.id>/req/<id>`
  - `Task` → `https://devops.aliyun.com/projex/project/<space.id>/task/<id>`
  - `Bug` → `https://devops.aliyun.com/projex/project/<space.id>/bug/<id>`
- 同步修正任务卡片与任务到聊天桥接的相关规范，使真实云效任务被视为“有稳定 URL 的外部任务”，而不是继续沿用“真实云效任务 URL 可为空”的第一阶段约束。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `integration-providers`: 细化云效 provider 连接成功与断开连接时的凭据持久化约束，明确 `userId` 必须写入并清理。
- `yunxiao-task-read-model`: 修改云效 workitem 到 `TaskItem` 的映射约束，要求按固定规则构造 `sourceMeta.url`。
- `task-panel`: 修改真实云效任务的来源展示约束，明确当 `sourceMeta.url` 已按规则构造后，任务卡片可展示并复用该来源跳转。
- `task-chat-bridge`: 修改真实云效任务进入聊天时的来源引用约束，明确 prompt 应包含云效来源标签与构造出的 URL。

## Impact

- 主进程 provider 连接服务：`electron/main/services/integration/provider-service.ts`
- 主进程云效专用服务：`electron/main/services/integration/yunxiao-service.ts`
- 通用 provider 凭据存储：`electron/main/infra/storage/provider-credential-store.ts`
- 云效凭据包装层：`electron/main/infra/storage/yunxiao-credentials/index.ts`
- 云效任务适配器：`electron/main/services/task/adapters/yunxiao-task-adapter.ts`
- 共享任务类型：`shared/types/task.ts`
- 任务页 prompt 生成：`frontend/src/pages/task.vue`
- 任务来源展示：`frontend/src/utils/task.ts`、`frontend/src/components/task/TaskCard.vue`
- 测试：`electron/main/__tests__/ipc/integration.spec.ts`、`electron/main/__tests__/services/task/yunxiao-task-adapter.spec.ts`、任务页/任务卡片相关测试
