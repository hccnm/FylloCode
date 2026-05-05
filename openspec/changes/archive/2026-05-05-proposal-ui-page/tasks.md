## 1. 类型定义与 Channels

- [x] 1.1 新增 `shared/types/proposal.ts`，定义 `ProposalStatus`（`creating | draft | applying | archived`）、`ProposalMeta`（id、title、status、why、totalTasks、doneTasks、hasDesign、date）
- [x] 1.2 在 `shared/types/channels.ts` 中新增 `ProposalChannels`，定义 `list: "proposal:list"`、`readFile: "proposal:readFile"` 两个 channel 常量

## 2. 主进程 IPC Handler

- [x] 2.1 新增 `electron/main/ipc/proposal.ts`，实现 `proposal:list` handler：接收 `{ projectId: string }`，调用 `loadProject(projectId)` 获取 `project.path`，分别遍历 `openspec/changes/`（根目录直接子目录）和 `openspec/changes/archive/`（归档子目录）；根目录下的 id 为目录名本身（如 `proposal-ui-page`），archive 下的 id 为带日期前缀的目录名（如 `2026-04-19-integrations-page`）；title 格式化规则：archive 下去掉 `YYYY-MM-DD-` 前缀后转 title case，根目录下直接转 title case；解析 `.openspec.yaml`、提取 Why 摘要、统计任务数，返回 `ProposalMeta[]` 按 date 倒序
- [x] 2.2 在 `proposal.ts` 中实现 `proposal:readFile` handler：接收 `{ projectId: string, changeId: string, filename: string }`，通过 `loadProject(projectId)` 获取项目路径，先在根目录下查找 `openspec/changes/<changeId>/`，不存在则在 `openspec/changes/archive/<changeId>/` 下查找，读取对应文件内容，文件不存在时返回 `null`
- [x] 2.3 在 `electron/main/ipc/index.ts` 中注册 proposal IPC handlers

## 3. Preload 层

- [x] 3.1 新增 `electron/preload/api/proposal.ts`，使用 `ProposalChannels` 常量，暴露 `list(projectId: string): Promise<IpcResponse<ProposalMeta[]>>` 和 `readFile(projectId: string, changeId: string, filename: string): Promise<IpcResponse<string | null>>`
- [x] 3.2 在 `electron/preload/index.ts` 中挂载 `proposal: proposalApi`
- [x] 3.3 在 `electron/preload/index.d.ts` 中扩展 `window.api` 类型声明，添加 `proposal` 字段

## 4. 前端 Store

- [x] 4.1 新增 `frontend/src/stores/proposal.ts` Pinia store，state 包含 `proposals: ProposalMeta[]`、`loading: boolean`、`error: string | null`；action `loadProposals()` 内部从 `projectStore.currentProject.id` 取 projectId，调用 `window.api.proposal.list(projectId)`，解包 `IpcResponse` 后写入 state

## 5. 列表页

- [x] 5.1 将 `frontend/src/pages/proposal.vue` 调整为 Proposal 路由壳，内部只保留布局容器和 `<RouterView />`
- [x] 5.2 新增 `frontend/src/pages/proposal/index.vue`，承接原列表原型：移除静态数据，接入 proposal store，`onMounted` 时调用 `store.loadProposals()`，其余 UI 逻辑（概览统计、状态筛选、卡片列表）保持原型结构不变。布局外层用 `flex-1 overflow-y-auto bg-default`，内容区用 `max-w-3xl mx-auto px-6 py-8`，与其他页面保持一致
- [x] 5.3 卡片点击跳转至 `/proposal/:id`（`:id` 为 `ProposalMeta.id`）

## 6. 详情页

- [x] 6.1 新增 `frontend/src/pages/proposal/[id].vue`，`route.params.id` 即为 changeId；进入时从 proposal store 中查找对应 `ProposalMeta`，若 store 为空则先调用 `store.loadProposals()` 再查找。布局：外层 `flex flex-col flex-1 overflow-hidden bg-default`，header 区 `shrink-0 border-b border-default`，tab 导航 `shrink-0`，内容区 `flex-1 overflow-y-auto`；header、tab、内容区各自用 `max-w-3xl mx-auto px-6` 约束宽度，使滚动条贴页面右侧
- [x] 6.2 详情页顶部展示标题、状态 badge、日期、任务进度；返回按钮跳转 `/proposal`
- [x] 6.3 详情页 `onMounted` 时调用 `window.api.proposal.readFile(projectStore.currentProject.id, route.params.id, filename)` 分别加载 `proposal.md`、`design.md`、`tasks.md` 三个文件内容（可并行），根据返回值是否为 `null` 动态决定渲染哪些 tab
- [x] 6.4 使用 `ChatComark` 组件渲染各 tab 的 markdown 内容
