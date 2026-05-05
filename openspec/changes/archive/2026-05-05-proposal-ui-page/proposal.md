## Why

FylloCode 的 OpenSpec 工作流目前只能通过 CLI 操作，缺少可视化界面让用户在应用内浏览和管理 proposal 的生命周期。需要在 FylloCode 中新增 Proposal 页面，提供列表概览、状态筛选和详情查看能力，让开发者无需离开应用即可追踪变更进度。

## What Changes

- 新增 Proposal 路由壳与列表页（`/proposal`），其中路由壳承载默认子路由，列表页展示概览统计、状态筛选和 proposal 卡片列表
- 新增 Proposal 详情页（`/proposal/:id`），展示基础信息和 proposal.md / design.md / tasks.md 的 markdown 渲染
- 主进程新增 IPC handler，基于文件系统读取当前 project 目录下的 `openspec/changes/` 目录，提取 proposal 元数据
- 渲染进程新增 proposal store，通过 IPC 获取数据并管理状态

## Capabilities

### New Capabilities

- `proposal-list`: Proposal 列表页能力。包括概览统计（总数、进行中、已归档）、状态筛选（全部/创建中/草稿/实现中/已归档）、卡片列表（标题、why 摘要、任务进度、创建日期）、时间倒序排列。
- `proposal-detail`: Proposal 详情页能力。包括基础信息展示（名称、状态、日期、任务进度）、markdown 文件 tab 渲染（proposal.md / design.md / tasks.md，文件不存在时不渲染对应 tab）。
- `proposal-ipc`: 主进程 IPC 能力。基于文件系统读取 project 目录下的 `openspec/changes/` 目录，提取 `.openspec.yaml` 元数据、解析 proposal.md 的 Why 段落、统计 tasks.md 的任务完成数，推断 proposal 状态（`archive/` 子目录 = archived，根目录下按 yaml status 字段判断）。

### Modified Capabilities

- `app-shell-routing`: 需要新增 `/proposal` 和 `/proposal/:id` 路由的保护规则（需要 project 上下文）。

## Impact

- **前端页面**: 新增 `frontend/src/pages/proposal.vue`（路由壳）、`frontend/src/pages/proposal/index.vue`（列表页）、`frontend/src/pages/proposal/[id].vue`（详情页）
- **Store 层**: 新增 `frontend/src/stores/proposal.ts`
- **类型层**: 新增 `shared/types/proposal.ts`
- **主进程**: 新增 `electron/main/handlers/proposal.ts` IPC handler
- **Preload**: 扩展 `window.api` 暴露 proposal 相关接口
- **路由/导航**: `frontend/src/pages/index.vue` 更新 protectedRoutes
- **依赖**: 无新增外部依赖
