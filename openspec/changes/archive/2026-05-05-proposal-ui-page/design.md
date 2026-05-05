## Context

FylloCode 是基于 Electron + Vue 3 的桌面 IDE，使用 electron-vite 构建，前端采用 vue-router/auto 文件系统路由，主进程与渲染进程通过 IPC 通信。

当前 `/proposal` 路由是一个占位页面。OpenSpec 的变更数据存储在 project 目录下的 `openspec/changes/` 文件系统中，每个 change 是一个子目录，包含 `.openspec.yaml`、`proposal.md`、`tasks.md`，以及可选的 `design.md`。

## Goals / Non-Goals

**Goals:**

- 渲染进程：列表页 + 独立详情路由，通过 IPC 获取数据
- 主进程：读取文件系统，提取 proposal 元数据（状态推断、Why 解析、任务计数）
- markdown 内容通过 IPC 按需读取，不一次性全量加载

**Non-Goals:**

- 不支持创建、编辑、删除 proposal（只读）
- 不实时监听文件系统变化（手动刷新即可）
- 不支持跨 project 查看 proposal

## Decisions

### 列表页与详情页使用路由壳 + 默认子路由

使用 `frontend/src/pages/proposal.vue` 作为 Proposal 路由壳，在其中渲染 `<RouterView />`；列表内容放在 `frontend/src/pages/proposal/index.vue`，详情页继续使用 `frontend/src/pages/proposal/[id].vue`。

**理由**：`vue-router/auto` 会将同级目录下的 `index.vue` 和动态子路由组织为父子路由。把列表页放到默认子路由里，既能保留 `/proposal` 作为入口，又能让 `/proposal/:id` 在同一壳层内切换，不需要在单页里手写分支判断。

### 详情页使用独立路由而非 query 参数

使用 `frontend/src/pages/proposal/[id].vue` 文件系统路由，而非在 `proposal.vue` 内用 `?id=` query 参数切换视图。

**理由**：独立路由支持浏览器历史导航、URL 直接分享、页面级状态隔离；query 参数方案在原型阶段可行，但随着详情页复杂度增加会导致单文件膨胀。

### 状态推断基于目录位置 + yaml status 字段

- `archive/` 子目录下的 change → `archived`
- 根目录下的 change，读取 `.openspec.yaml` 的 `status` 字段：`creating` / `draft` / `applying`
- yaml 无 status 字段时默认 `draft`

**理由**：`archive/` 目录是 openspec CLI 归档操作的产物，是最可靠的 archived 信号。根目录下的状态由 yaml 管理，便于 CLI 工具写入。

### markdown 内容按需 IPC 读取

详情页进入时，通过独立 IPC 调用读取对应 change 目录下的 markdown 文件内容，而非在列表数据中一并返回。

**理由**：列表页只需元数据（标题、状态、why 摘要、任务计数），全量返回 markdown 内容会增加不必要的 IPC 传输量。

### Why 摘要提取规则

解析 `proposal.md`，提取 `## Why` 标题下第一段非空文本，截断至 300 字符。

### 任务计数解析规则

解析 `tasks.md`，统计 `- [x]`（完成）和 `- [ ]`（未完成）的数量，两者之和为总任务数。

## Risks / Trade-offs

- **文件系统读取性能**：change 数量较多时，列表加载需逐目录读取 yaml 和 proposal.md。当前 project 规模下可接受，未来可加缓存。→ 暂不优化，按需加载
- **yaml status 字段缺失**：早期 change 的 yaml 只有 `schema` 和 `created` 字段，无 `status`。→ 默认降级为 `draft`
- **proposal.md 格式不一致**：Why 段落可能不存在或格式不标准。→ 解析失败时 why 字段返回空字符串，不影响列表渲染

## Open Questions

- 无
