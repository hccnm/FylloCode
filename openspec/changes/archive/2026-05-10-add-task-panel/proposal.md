## Why

当前 `/task` 页面只是一个占位符，显示"任务管理功能即将上线"。用户在开发过程中经常需要面对各种任务（本地计划、云效工作项、GitHub Issue 等），但没有一个集中的入口可以快速查看任务并基于任务描述发起 AI 讨论。我们希望将 `/task` 页面建设成一个轻量任务面板——核心不是做任务管理系统，而是作为"任务 → AI 讨论 → Proposal"的快捷入口，降低从发现任务到开始实现的认知摩擦。

## What Changes

- 将 `/task` 占位页面替换为可交互的任务面板
- 新增本地任务的创建、展示、编辑、删除能力（MVP 阶段）
- 任务卡片支持一键跳转聊天，自动将任务描述填充为 chat 的初始 prompt
- 任务面板 UI 支持渠道切换（本地 / 云效 / GitHub），本地渠道支持 CRUD，云效和 GitHub 渠道显示预置 mock 数据以演示多源聚合效果
- 主进程创建空的 `YunxiaoTaskAdapter` 接口，为未来接入云效 API 预留扩展点
- 新增 `UnifiedTask` schema，统一抽象本地/云效/GitHub 三种渠道的任务模型
- 新增项目级任务存储（`tasks.json`），采用与 session-store 一致的文件存储模式

## Capabilities

### New Capabilities

- `task-panel`: 任务面板页面——卡片列表展示、状态筛选、渠道切换 UI、点击进聊天交互
- `task-local`: 本地任务管理——基于文件存储的 CRUD、IPC 接口、前端 store
- `task-chat-bridge`: 任务与聊天衔接——prompt 生成策略、路由跳转、自动创建会话

### Modified Capabilities

- `chat-interface`: 新增外部触发入口——task 面板通过 `sessionStore.beginDraftSession()` + `chatStore.sendMessage()` 自动创建会话并发送消息；chat store 新增 `buildFallbackSessionTitle` 支持从 task prompt 中提取标题作为会话名称
- `app-shell-routing`: `/task` 路由从静态占位组件替换为功能页面（非破坏性变更）

## Impact

- **前端**: 新增 `task.vue` 页面（替换占位符）、TaskCard 组件、CreateTaskModal 弹窗、task store、task API 封装
- **主进程**: 新增 `task-store.ts`（文件持久化）、`task-service.ts`（业务逻辑）、`task-adapter.ts`（统一接口）、`local-task-adapter.ts`（本地实现）、`yunxiao-task-adapter.ts`（空接口）、`github-task-adapter.ts`（空接口）、`task-aggregator.ts`（多源聚合）、`task.ts`（IPC handlers）
- **共享类型**: 新增 `shared/types/task.ts`（UnifiedTask schema）
- **IPC Channels**: 新增 `task:list`, `task:create`, `task:update`, `task:delete`
- **存储**: 每个项目目录下新增 `tasks/tasks.json`
- **依赖**: 无新增外部依赖
