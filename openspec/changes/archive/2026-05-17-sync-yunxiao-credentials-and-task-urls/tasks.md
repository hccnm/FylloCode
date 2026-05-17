## 1. OpenSpec artifacts 与范围固化

- [x] 1.1 在 `openspec/changes/sync-yunxiao-credentials-and-task-urls/proposal.md` 中明确记录两个且仅两个目标：`yunxiao userId` 回写到 credentials、`sourceMeta.url` 按规则补齐；不得把范围扩展到老数据迁移、probe 自愈、其他 provider 或新的任务交互。
- [x] 1.2 在 `openspec/changes/sync-yunxiao-credentials-and-task-urls/design.md` 中完整记录当前双层存储链路：
  - `electron/main/services/integration/provider-service.ts`
  - `electron/main/infra/storage/provider-credential-store.ts`
  - `electron/main/infra/storage/provider-connection-store.ts`
  - `electron/main/infra/storage/yunxiao-credentials/index.ts`
  - `electron/main/services/integration/yunxiao-service.ts`
    并明确后续读取 `userId` 的代码是 `getYunxiaoUserId()`，不是 `connections.json`。
- [x] 1.3 在 `openspec/changes/sync-yunxiao-credentials-and-task-urls/specs/integration-providers/spec.md` 中修改连接与断开 requirement，明确 `userId` 的来源、写入位置、清理规则，避免实现方误把字段只写入 `accountId`。
- [x] 1.4 在 `openspec/changes/sync-yunxiao-credentials-and-task-urls/specs/yunxiao-task-read-model/spec.md` 中修改 workitem 映射 requirement，明确 `Req/Task/Bug` 三类 URL 规则，并删除“第一阶段可为空”的旧语义。
- [x] 1.5 在 `openspec/changes/sync-yunxiao-credentials-and-task-urls/specs/task-chat-bridge/spec.md` 与 `specs/task-panel/spec.md` 中把真实云效任务从“允许没有 URL”改成“应当携带并复用构造后的 URL”，避免其他 agent 继续沿用过期前提。

## 2. 云效连接成功后的 `userId` 持久化补齐

- [x] 2.1 检查 `electron/main/services/integration/provider-service.ts` 中 `connectProvider(providerId, credentials)` 的云效分支，确认当前顺序仍是：`saveCredentials(providerId, credentials)` → `getYunxiaoUser()` / `listOrganizations()` → `saveConnection(...)`。
- [x] 2.2 在 `connectProvider()` 的 `provider.id === "yunxiao"` 成功路径中，新增对当前 credentials 的合并回写逻辑，写入目标必须是 `electron/main/infra/storage/provider-credential-store.ts` 的 `saveCredentials("yunxiao", ...)`，不得创建新文件或新 store。
- [x] 2.3 回写时必须把以下字段一并保留下来：
  - `"x-yunxiao-token"`：来自本次 `credentials`
  - `userId`：来自 `getYunxiaoUser()` 返回的 `user.id`
  - `organizationId`：优先沿用 `loadCredentials("yunxiao")["organizationId"]`；若为空，则回退 `user.lastOrganization`；再为空则回退 `listOrganizations()[0]?.id`
    不得只写 `{ userId }` 覆盖整文件。
- [x] 2.4 保持 `saveConnection({...})` 的现有字段不变：
  - `providerId: "yunxiao"`
  - `state: "connected"`
  - `accountId: user.id`
  - `accountName: user.email || user.username || user.name`
  - `credentialPreview: toPreview(credentials)`
    实现时不要因为补写 `userId` 而改动 connection 记录结构。
- [x] 2.5 保持 `catch` 分支的失败回滚语义：若 `getYunxiaoUser()` 或 `listOrganizations()` 失败，仍然调用 `clearCredentials(providerId)`，避免留下只写入 token、却没有通过校验的半成品 credentials。
- [x] 2.6 不要把“老数据补齐”塞进 `probeProvider(providerId)`：`electron/main/services/integration/provider-service.ts` 的 `probeProvider("yunxiao")` 本次只保留连接状态探测与 connection 更新，不增加 `saveCredentials(...userId...)` 自愈逻辑。

## 3. 云效断开连接时的字段清理

- [x] 3.1 检查 `electron/main/services/integration/yunxiao-service.ts` 中 `disconnectYunxiao()` 当前调用：
      `saveYunxiaoCredentials({ "x-yunxiao-token": undefined, organizationId: undefined })`
- [x] 3.2 将 `disconnectYunxiao()` 的 patch 扩展为同时清理 `userId`，即该函数最终必须确保 `electron/main/infra/storage/yunxiao-credentials/index.ts` 再读取时：
  - `getYunxiaoToken() === ""`
  - `getYunxiaoUserId() === ""`
  - `getYunxiaoOrganizationId() === ""`
- [x] 3.3 保持 `disconnectYunxiao()` 最后仍调用 `disconnectProvider("yunxiao")`，不要把断开逻辑只停留在 `saveYunxiaoCredentials()` 层，否则 `connections.json` 记录会残留。
- [x] 3.4 若实现方发现 `disconnectProvider("yunxiao")` 已经会删除整个 `yunxiao.json` 文件，也不要删除 `saveYunxiaoCredentials(...)` 这层语义包装；本 change 只要求把 `userId` 清理补齐，不授权重构断开链路。

## 4. 云效任务 URL 构造函数与映射规则

- [x] 4.1 在 `electron/main/services/task/adapters/yunxiao-task-adapter.ts` 中新增一个纯函数，建议命名为 `buildWorkitemUrl(category, workitem)` 或等价语义名称；函数输入必须至少包含：
  - `category: "Req" | "Task" | "Bug"`
  - `workitem.id`
  - `workitem.space.id`
- [x] 4.2 将 URL 基础前缀固定写死为 `https://devops.aliyun.com/projex/project/`，不要从 renderer、env、配置文件或其他 store 读取。
- [x] 4.3 在该函数中严格实现以下映射，不允许自由发挥：
  - `category === "Req"` → `https://devops.aliyun.com/projex/project/${workitem.space.id}/req/${workitem.id}`
  - `category === "Task"` → `https://devops.aliyun.com/projex/project/${workitem.space.id}/task/${workitem.id}`
  - `category === "Bug"` → `https://devops.aliyun.com/projex/project/${workitem.space.id}/bug/${workitem.id}`
- [x] 4.4 不要使用以下字段参与 URL 拼接：
  - `spaceId` 参数字符串之外的其他 project 标识
  - `serialNumber`
  - `status.id`
  - `workitemType`
  - `resourceId`
    用户已经明确 URL 只依赖 `<space.id>` 和 `<id>`。
- [x] 4.5 在 `mapToTaskItem(projectId, spaceId, category, workitem)` 中把 `sourceMeta.url` 从“留空/不写”改为写入上述构造函数结果；同时继续保留：
  - `sourceMeta.source = "yunxiao"`
  - `sourceMeta.key = workitem.serialNumber`
  - `sourceMeta.issueType` 从 `Req/Task/Bug` 映射到 `"需求" / "任务" / "缺陷"`
- [x] 4.6 保持以下映射不变，不要因为本次补 URL 顺手改动：
  - `TaskItem.id = yunxiao:<spaceId>:<workitem.id>`
  - `TaskItem.projectId = projectId`
  - `TaskItem.title = workitem.subject`
  - `TaskItem.description = workitem.description ?? ""`
  - `TaskItem.status = "open"`
  - `TaskItem.labels = [space.name, issueType, status.displayName]`
  - `createdAt` / `updatedAt` 的回退规则

## 5. 共享类型与前端复用点校验

- [x] 5.1 检查 `shared/types/task.ts` 中 `YunxiaoTaskMeta` 当前是否已声明 `url?: string`；若字段已存在，则不要新增重复字段或改成必填类型，避免扩大类型影响面。
- [x] 5.2 检查 `frontend/src/pages/task.vue` 的 `buildTaskPrompt(task)`，确认当前逻辑仍是：
  - 外部任务且 `task.sourceMeta.url` 存在时追加 ` (${task.sourceMeta.url})`
  - URL 不存在时不输出空括号
    本次通常不需要改这里的实现，只需要让后端真实传入 URL。
- [x] 5.3 检查 `frontend/src/utils/task.ts` 的 `buildSourceDisplay(task)`，保持真实云效任务继续优先显示 `云效 <sourceMeta.key>`；本次不要把来源展示改成 URL、本地化标题或其他格式。
- [x] 5.4 检查 `frontend/src/components/task/TaskCard.vue` 对 `externalUrl` / “任务来源”按钮的现有判定；如果它本来就是“有 URL 才显示按钮”，则本次无需改 UI 逻辑，只需确保真实云效任务不再拿到空 URL。
- [x] 5.5 若任务页或卡片测试中存在“真实云效任务没有 URL，因此不显示按钮”的旧断言，需要连同 spec 一起改掉，避免实现方只修后端导致前端测试仍按旧语义失败。

## 6. 测试补充：provider 连接与凭据写入

- [x] 6.1 在 `electron/main/__tests__/ipc/integration.spec.ts` 中补充或修改“connect provider”断言：当通过 `integrations:providers:connect` 连接 `providerId = "yunxiao"` 成功后，除返回 `accountId = "user-1"` 外，还必须读取 `provider-credential-store` 中的 `yunxiao` credentials，并断言其中包含：
  - `"x-yunxiao-token": "token-new"`（或测试输入值）
  - `userId: "user-1"`
  - `organizationId: "org-1"`（若当前测试 mock 返回该值）
- [x] 6.2 在同一测试文件中补充断言：连接成功后 `connections.json` 中的 `accountId` 仍然存在，证明本次不是把 `accountId` 挪到 credentials，而是两边都按各自职责保存。
- [x] 6.3 在同一测试文件中补充断言：执行 disconnect 后，再读取 `loadCredentials("yunxiao")` 或云效包装层读取结果时，`userId` 不应残留。
- [x] 6.4 若现有 IPC 测试只验证 `ok: true` 和 `accountName`，需要把持久化断言写到磁盘级读取，而不是只看 handler 返回值；否则无法防止实现方只改返回对象、不改真实存储。

## 7. 测试补充：云效任务 URL 映射

- [x] 7.1 在 `electron/main/__tests__/services/task/yunxiao-task-adapter.spec.ts` 中修改现有“queries req task bug and maps them into task items”用例，不再断言 `sourceMeta` 没有 `url`，改为分别断言三类 workitem 的 URL：
  - `Req` → `https://devops.aliyun.com/projex/project/space-1/req/101`
  - `Task` → `https://devops.aliyun.com/projex/project/space-1/task/102`
  - `Bug` → `https://devops.aliyun.com/projex/project/space-1/bug/103`
- [x] 7.2 在同一测试文件中新增一个更细粒度用例，直接覆盖 URL 构造函数或 `mapToTaskItem()` 的三类分支，避免后续有人误把 `Req` / `Task` / `Bug` 的路径段写混。
- [x] 7.3 保留并继续断言以下既有行为没有回归：
  - `labels` 顺序仍是 `[space.name, issueType, status.displayName]`
  - `assignedTo` 缺失时 `assignee` 省略
  - `updatedAt` 优先 `gmtModified`，其次 `updateStatusAt`
  - `assignedTo` 查询条件仍从 `getYunxiaoUserId()` 读取
- [x] 7.4 若测试 fixture 中 `space.id`、`workitem.id`、`serialNumber` 不够直观，调整 fixture 命名，使其他 agent 一眼能看出 URL 是基于哪两个字段构造，而不是基于 `serialNumber`。

## 8. 测试补充：任务页与聊天桥接

- [x] 8.1 在 `frontend/src/__tests__/pages/task.spec.ts` 中查找当前关于“yunxiao prompt 不应出现空 URL 占位”的用例；如果该用例名称或断言仍是“builds prompt without empty url placeholder for yunxiao tasks”，改成“builds prompt with source url for yunxiao tasks”或等价语义。
- [x] 8.2 在上述任务页测试中构造一条真实云效任务 fixture，至少包含：
  - `source: "yunxiao"`
  - `sourceMeta.source = "yunxiao"`
  - `sourceMeta.key = "YX-102"`
  - `sourceMeta.url = "https://devops.aliyun.com/projex/project/space-1/task/102"`
    然后断言 `buildTaskPrompt()` 生成的来源行包含 `云效 YX-102 (https://devops.aliyun.com/projex/project/space-1/task/102)`。
- [x] 8.3 在 `frontend/src/__tests__/components/task-card.spec.ts` 或相关卡片测试中，补充真实云效任务 fixture 的 URL 场景，断言当 `sourceMeta.url` 存在时，“任务来源”按钮应可见；不要再沿用“真实云效任务默认没有 URL”的 fixture。
- [x] 8.4 若前端测试里还有 mock 云效任务使用空 URL，但其目的不是测试“空 URL 语义”而只是通用渲染，请把 fixture 更新为更接近真实后端输出，避免后续实现者被测试误导。

## 9. 实施后的验证标准

- [x] 9.1 至少运行与本 change 直接相关的测试文件，优先包括：
  - `electron/main/__tests__/ipc/integration.spec.ts`
  - `electron/main/__tests__/services/task/yunxiao-task-adapter.spec.ts`
  - `frontend/src/__tests__/pages/task.spec.ts`
  - `frontend/src/__tests__/components/task-card.spec.ts`（若该文件覆盖来源按钮）
- [x] 9.2 若可以运行更大范围验证，补跑 `pnpm test`；若当前环境无法执行，必须在实现说明中明确写出“未执行哪些测试、原因是什么”，不能省略。
- [x] 9.3 最终实现说明必须显式回答下面 4 个验收点：
  - 新连接云效成功后，`credentials/yunxiao.json` 是否包含 `userId`
  - disconnect 后，`userId` 是否被清空
  - `Req/Task/Bug` 三类 URL 是否分别命中 `req/task/bug` 路径
  - 任务 prompt 与任务卡片是否已经复用真实 URL，而不是继续把云效视为无 URL 来源
