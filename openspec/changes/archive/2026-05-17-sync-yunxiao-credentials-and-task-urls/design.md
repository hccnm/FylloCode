## Context

当前云效相关持久化链路实际上分为两层：

- 通用 provider 层：
  - `electron/main/services/integration/provider-service.ts`
  - `electron/main/infra/storage/provider-credential-store.ts`
  - `electron/main/infra/storage/provider-connection-store.ts`
- 云效专用包装层：
  - `electron/main/infra/storage/yunxiao-credentials/index.ts`
  - `electron/main/services/integration/yunxiao-service.ts`
  - `electron/main/domain/integration/yunxiao/*`

从现状代码看，`connectProvider("yunxiao", credentials)` 会先把 token 写入 `{userData}/integrations/credentials/yunxiao.json`，随后调用 `getYunxiaoUser()` / `listOrganizations()`，并把 `user.id` 写到 provider connection 的 `accountId`。但是后续云效查询代码读取身份时，并不看 `accountId`，而是看 `getYunxiaoUserId()`：

- `electron/main/services/task/adapters/yunxiao-task-adapter.ts` 通过 `getYunxiaoUserId()` 组装 `assignedTo` 查询条件
- `electron/main/domain/integration/yunxiao/*` 通过 `getYunxiaoToken()` / `getYunxiaoOrganizationId()` 读取同一份云效 credentials 文件

也就是说，当前“连接成功”和“后续按 userId 查询工作项”之间缺了一步显式同步。你已经明确本次不考虑老数据补齐，因此设计只需要保证从这次 change 开始，新连接写对即可。

任务 URL 这部分也类似。现有 `yunxiao-task-adapter` 已经能把 `Req` / `Task` / `Bug` 映射为统一 `TaskItem`，但 `sourceMeta.url` 仍留空。现在用户已经给出稳定规则，而且规则只依赖 `workitem.space.id` 和 `workitem.id`，不依赖额外 API，因此应在适配层内一次性构造，而不是让 renderer 自行拼接。

## Goals / Non-Goals

**Goals:**

- 让 settings 中的云效 provider 连接成功后，同时把云效 `user.id` 写入 `yunxiao` credentials 文件中的 `userId` 字段。
- 保持现有 provider 连接成功后写入 token、`organizationId`、`connection.accountId`、`connection.accountName` 的行为不变。
- 让云效断开连接时，清除 token、`organizationId`、`userId`，避免留下半残的云效身份信息。
- 在 `yunxiao-task-adapter` 中按固定规则构造 `sourceMeta.url`，并让 URL 规则完全由 workitem 类型决定。
- 更新相关 specs 和测试，使其他 agent 不会继续沿用“真实云效任务 URL 可以为空”的旧前提。

**Non-Goals:**

- 不处理已经存在于本地磁盘上的旧 `yunxiao.json` 数据补齐。
- 不要求在 `probeProvider("yunxiao")` 成功时自动回写 `userId`。
- 不重构 provider credential store 与云效 credential wrapper 的层级关系。
- 不新增新的 IPC channel，也不修改现有前后端请求结构。
- 不引入新的云效详情 API，不通过远端接口查询 URL。
- 不扩展 GitHub、Jira 或其他 provider 的任务 URL 规则。

## Decisions

### 1. 云效 `userId` 由 provider 连接成功链路一次性回写到 credentials

**Decision**

- 继续把 `providerId = "yunxiao"` 的原始 token 先写入 `electron/main/infra/storage/provider-credential-store.ts`。
- 在 `electron/main/services/integration/provider-service.ts` 的 `connectProvider()` 成功分支中，拿到 `getYunxiaoUser()` 返回值后，除写入 `connection.accountId` 外，还要把 `user.id` 写回同一份 `yunxiao` credentials 文件中的 `userId` 字段。
- 写入位置必须通过 `saveCredentials("yunxiao", ...)` 这条现有存储链路完成；`electron/main/infra/storage/yunxiao-credentials/index.ts` 只是该文件的语义包装层，不能再额外创建第二份存储文件。
- 写入 `userId` 时必须保留本次连接输入的 token，以及已推断或已存在的 `organizationId`，不能只写一个 `{ userId }` 覆盖整个文件。

**Rationale**

- `getYunxiaoUserId()` 读取的就是 `provider-credential-store` 中 `yunxiao.json` 的 `userId` 字段；只写 `connections.json` 无法满足后续查询。
- 在 `connectProvider()` 内完成回写，可以让 settings 的统一 provider 连接入口和旧 `setYunxiaoToken()` 入口都走到同一条正确逻辑，避免再靠外围调用补丁式同步。

**Alternatives considered**

- 只在 `electron/main/services/integration/yunxiao-service.ts` 的 `setYunxiaoToken()` 中调用 `saveYunxiaoCredentials({ userId })`：被否决，因为 settings 新 provider 入口直接调用的是 `connectProvider()`，不是旧入口。
- 在 `probeProvider("yunxiao")` 成功时补写 `userId`：被否决，因为你已明确“不需要考虑老用户数据问题”，本次不需要自愈逻辑。

### 2. 云效断开连接时同步清除 `userId`

**Decision**

- `disconnectProvider("yunxiao")` 继续负责删除 provider credentials 文件与 connection 记录。
- `electron/main/services/integration/yunxiao-service.ts` 的 `disconnectYunxiao()` 需要把当前 `saveYunxiaoCredentials()` 的 patch 从 `{ "x-yunxiao-token": undefined, organizationId: undefined }` 扩展为同时清除 `userId`。
- change artifacts 中明确要求：实现时不要只删除 token 和 organizationId 而忘记 `userId`。

**Rationale**

- 这份文件会被后续任务查询直接读取。若只清 token 不清 `userId`，会留下与连接状态不一致的残留身份。

### 3. URL 在 `yunxiao-task-adapter` 内构造，不下放给 renderer

**Decision**

- 在 `electron/main/services/task/adapters/yunxiao-task-adapter.ts` 中新增一个纯函数，用 workitem 类型和字段构造 URL。
- 函数输入必须只依赖：
  - `category: "Req" | "Task" | "Bug"`
  - `workitem.space.id`
  - `workitem.id`
- 规则固定为：
  - `Req` → `https://devops.aliyun.com/projex/project/${workitem.space.id}/req/${workitem.id}`
  - `Task` → `https://devops.aliyun.com/projex/project/${workitem.space.id}/task/${workitem.id}`
  - `Bug` → `https://devops.aliyun.com/projex/project/${workitem.space.id}/bug/${workitem.id}`
- `mapToTaskItem()` 必须把该 URL 写入 `sourceMeta.url`；不要把 URL 交给前端 `buildSourceDisplay()`、`TaskCard` 或 `task.vue` 再推断。

**Rationale**

- `TaskItem` 是 renderer 唯一依赖的统一模型，来源 URL 应与其他来源特有元数据一样，在适配层内一次性归一化。
- 规则只依赖主进程已持有的数据，没必要增加渲染层推断。

### 4. 旧 spec 中“真实云效任务 URL 可为空”的前提必须彻底收回

**Decision**

- 修改 `openspec/specs/yunxiao-task-read-model/spec.md` 中“映射为 TaskItem”的 requirement，删除“第一阶段允许为空”表述，改为“必须按类型规则构造 URL”。
- 修改 `openspec/specs/task-chat-bridge/spec.md` 中针对真实云效任务的 scenario，从“无 URL”改成“有 URL，并在 prompt 中附带 URL”。
- 修改 `openspec/specs/task-panel/spec.md` 中任务来源标识 requirement，从“无 URL 时 MAY 不显示按钮”改成“真实云效任务 SHALL 复用构造出的 URL 作为来源按钮跳转”。

**Rationale**

- 如果只改代码不改 spec，其他 agent 会继续遵循现有 SHALL，把 URL 当成可选项，导致实现偏移。

## Risks / Trade-offs

- `[provider-service 与 yunxiao-service 双入口并存]` → 若实现方只改一处，另一处仍可能留旧行为。缓解方式：在 tasks 中显式列出 `connectProvider()` 与 `disconnectYunxiao()` 两个必查点。
- `[saveCredentials 是整文件覆盖语义]` → 若回写 `userId` 时没有把 token / organizationId 一并带回，可能把现有字段抹掉。缓解方式：任务中明确要求基于当前 credentials 合并写入。
- `[URL 规则未来若发生平台调整]` → 当前规则由用户明确给出，本 change 先按固定常量写死。后续若平台侧变化，再单独起 change。
- `[测试名义上看起来像小修，但行为跨多层]` → 需要同时覆盖 IPC / service / adapter / frontend prompt，否则其他 agent 可能误判为只要改一行映射即可。缓解方式：把验证任务拆到具体测试文件与断言。
