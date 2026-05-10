## Context

当前 `/task` 路由渲染一个静态占位页面，仅显示"任务管理功能即将上线"。ActivityBar 中已注册了 `/task` 导航入口，图标为 `i-lucide-list-checks`。项目使用 vue-router/auto 文件系统路由，页面位于 `frontend/src/pages/task.vue`。

Electron 主进程已有云效集成基础（`yunxiao/projex` 模块实现了工作项搜索/创建/更新，含完整 `Workitem` 类型），但尚未与 task 功能关联。数据持久化采用文件系统模式（JSON/JSONL），项目级数据存储在 `data/projects/<encodedPath>/` 下。

Chat 系统已成熟：`ChatStore.sendMessage(content)` 自动处理会话创建、消息发送、流式响应；`SessionStore.createSession()` 需要 `projectId` 和 `agentId`。Task 面板的核心价值是成为"任务 → AI 讨论"的快捷入口。

## Goals / Non-Goals

**Goals:**

- 提供轻量任务面板，聚合展示任务卡片
- 支持本地任务的 CRUD（MVP 阶段）
- 点击任务卡片一键跳转聊天并自动填充初始 prompt
- UI 支持渠道切换（本地 / 云效 / GitHub），本地渠道支持 CRUD，云效和 GitHub 渠道展示预置 mock 数据以验证多源聚合的视觉效果
- 定义 `UnifiedTask` schema，统一抽象多渠道任务模型
- 主进程创建空的 `YunxiaoTaskAdapter` 接口，预留扩展点

**Non-Goals:**

- 完整的任务管理系统（状态机、工作流、子任务、评论等）
- 云效/GitHub 任务的实时同步（下一阶段实现）
- 任务详情页（点击直接进聊天，不进入任务编辑详情）
- 本地与外部任务的关联映射
- 任务的分配、截止日期、优先级编辑等高级功能
- 看板视图（MVP 仅列表视图）

## Decisions

### 1. 统一 Schema 采用「核心统一 + 渠道扩展」模式

**决策**: 定义 `TaskItem` 作为前端唯一依赖的统一类型，所有渠道特有数据放在 `sourceMeta` discriminated union 中。

**理由**: 前端不需要为每个渠道写不同渲染逻辑，筛选排序基于统一字段。与项目中已有的 `Message` discriminated union 模式一致。

**替代方案**: 完全松散 schema（每个渠道存原始数据）—— 拒绝，因为筛选排序逻辑会爆炸。

### 2. 状态仅保留二态（open / closed）

**决策**: 不将云效的"待处理/处理中/已完成/已挂起"或 GitHub 的"open/closed/merged/draft"映射为复杂状态机，统一为 `open` / `closed` 二态。

**理由**: 任务面板的核心价值是"快速进聊天"，不是任务状态跟踪。二态足够区分"还在关注"和"已结束"的视觉层次。下一阶段接入云效时再评估是否需要更细的状态映射。

**替代方案**: 五态映射（todo/in-progress/done/blocked/closed）—— 拒绝，过度设计，MVP 不需要。

### 3. 本地任务存储采用单文件 JSON（tasks.json）

**决策**: 每个项目目录下 `tasks/tasks.json` 存储所有本地任务，与 `project-store.ts` / `session-store.ts` 的存储模式一致。

**理由**: 本地任务数量预期不大（<100），单文件读写足够。与现有存储层风格保持一致，无需引入数据库。

**替代方案**: 每个任务一个 JSON 文件 —— 拒绝，增加文件句柄开销，无收益。

### 4. Task → Chat 衔接使用直接 Store 调用

**决策**: Task 页面点击"发起讨论"时，先调用 `sessionStore.beginDraftSession()` 创建草稿会话，再调用 `chatStore.sendMessage(prompt)`，最后 `router.push('/chat')`。

**理由**: `sendMessage()` 内部检查当前是否有 active session，若无则基于 draft agent 创建新会话。`beginDraftSession()` 确保 draft agent 已准备好。流式响应在 Pinia store 中持续，跳转后 ChatContainer 直接显示。chat store 新增 `buildFallbackSessionTitle` 函数，从 prompt 中提取 `**标题**:` 作为会话 fallback 标题。

**替代方案**: 通过路由 query 参数（`/chat?prompt=xxx`）—— 拒绝，需要修改 chat 页面增加参数解析，增加不必要的耦合。

### 5. 前端渠道切换展示预置 mock 数据

**决策**: 前端渲染渠道 Tabs（本地 / 云效 / GitHub）。本地渠道使用真实数据（支持 CRUD），云效和 GitHub 渠道展示预置的 mock 数据（各 3 条），以演示多源聚合的视觉效果。

**理由**: 用户明确要求"前端先做渠道切换效果"。预置 mock 数据比纯空态更有说服力，能验证 TaskCard 组件对不同 sourceMeta 的渲染能力。下一阶段接入真实 API 时，只需替换 adapter 实现，无需修改前端 UI。

### 6. 外部渠道 Adapter 返回空数组，前端用 mock 数据填充

**决策**: 主进程 `YunxiaoTaskAdapter` 和 `GithubTaskAdapter` 实现 `TaskAdapter` 接口，方法返回空数组。前端 `task.vue` 在云效和 GitHub tab 下直接渲染预置 mock 数据，不走 store/API 层。

**理由**: Adapter 层保持契约完整，前端 mock 数据独立维护，下一阶段接入真实 API 时只需：1) 填充 adapter 方法体；2) 删除前端 mock 数据，切换为 store 加载模式。

## Risks / Trade-offs

| 风险                                                                       | 缓解措施                                                                                                    |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `UnifiedTask` schema 在未来接入云效/GitHub 时发现字段缺失                  | schema 中预留 `sourceMeta` 扩展字段；每个渠道 Adapter 负责映射，前端只依赖核心字段                          |
| 本地任务数量增长后单文件读写性能下降                                       | 当前预期 <100 条，单文件足够。若未来超过 500 条，可迁移到按状态分片存储                                     |
| `chatStore.sendMessage()` 在 task 页面调用时，用户跳转前看不到流式响应开始 | 可接受的 UX 权衡。发送和跳转几乎是同时的，chat 页面加载后立刻能看到消息                                     |
| 多个页面同时调用 `sendMessage()` 可能产生竞态                              | `sendMessage()` 内部已检查 `chatStatus`，处于非 ready 状态时会忽略。Task 页面的调用时机是用户点击，天然串行 |
| 下一阶段的云效状态映射可能与用户预期不一致                                 | 二态策略降低映射复杂度。下一阶段接入时再细化状态规则                                                        |

## Open Questions

以下问题已与产品方确认：

1. **本地任务描述格式**：纯文本 textarea，不支持 Markdown。
2. **Proposal 关联展示**：TaskCard 上若 `proposalId` 存在则显示（如"已关联 Proposal #5"），纯文本展示，暂不支持点击跳转。
3. **渠道连接状态**：MVP 不判断外部系统连接状态，渠道切换只做 UI 效果。云效/GitHub Tab 始终可点击，显示空态提示即可。
