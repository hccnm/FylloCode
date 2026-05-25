## Why

FylloCode 通过 guidelines 文档对 agent 提出软约束，但 agent 可能不严格执行。相对地，工程层面的硬约束（eslint、test runner、git hooks、CI）是 agent 躲不开的：跑 lint 就必须改、跑 test 就必须过、commit 就必须满足 hook。一次配置几乎终身受用。

打开用户项目时，FylloCode 当前无法感知该项目对 agent 的硬约束完备度，用户也缺乏主动入口去补齐这些配置。结果是：项目长期停留在"靠 guidelines 提醒 agent"的状态，无法升级为可执行的硬约束。

本次 change 是健康检查机制的 v1，定位为 **"项目对 agent 的硬约束完备度的可见度 + 配置补齐工具"**：让用户看到项目缺什么、并通过标准 proposal 流程帮用户补齐。本 change **不解决"约束实际生效"问题**（即 apply 阶段是否真的会触发这些配置并失败时阻断），那需要后续 apply quality gate change。详见 `design.md` 中的"v1 定位与已知局限"。

## What Changes

- `meta.json` 新增 `healthScore` 字段（number，0–100），记录项目对 agent 的工程硬约束完备度
- `ProjectInfo` 新增 `metaPath: string`，向前端暴露 `meta.json` 绝对路径，供前端在 system-reminder 中告知 agent 应编辑的目标文件
- AppHeader 中央区域 ProjectSelector 旁新增健康度 icon，圆形边框，颜色随 `healthScore` 三档变化（灰/橙/绿）
- 进入项目时 icon 颜色基于 `currentProject.healthScore` 同步渲染；点击 icon 时同步打开 Popover，并发调用 `project:getById` 拉取最新分数刷新 UI；失败时保留旧值，Popover 不关闭
- 点击 Popover 中的"开始健康检查"按钮，FylloCode 自动创建新 chat session，预置两条消息：
  1. system-reminder（前端隐藏展示）：4 个一级分块（角色 / 评分规范 / 工作流 / proposal 输出契约），其中评分规范固定为三类十维度（静态 40 / 测试 30 / 流程 30），工具与语言由 agent 自行映射。每个维度的判定基线为"该生态广泛认可的工程最佳实践"而非"配置存在 + 非空"；reminder 同时给出反面示例（echo ok 的 test / 仅 1 条规则的 eslint / `|| true` 的 CI / coverage 阈值为 0 等）自动判 0 分，并要求 agent 输出每个维度的判定理由与所引用的配置片段
  2. 用户口吻消息：「帮我根据当前项目技术栈检查：静态约束、测试约束、流程约束的配置情况并完善」
- agent 必须形成"评估 + 改进 + apply"闭环：评分 → 对未达标维度给出具体改进建议 → 用户对齐后调用 `mcp__fyllo_specs__create-proposal`（changeName 以 `health-check-` 开头）→ apply 阶段修改用户项目内的工程配置 + 编辑 `meta.json` 写入目标分 Y
- agent 通过文件 Edit/Write 工具直接修改 `meta.json`（不调用 IPC），路径由 reminder 注入；FylloCode 在用户下次点击 icon 时通过 `project:getById` 重读最新值

## Capabilities

### New Capabilities

- `project-health-check-ui`：AppHeader 健康度 icon 的展示与交互逻辑，包括颜色映射、进入项目读取、点击并发刷新、Popover 确认、新 session 启动
- `health-check-session-bootstrap`：自动发起健康检查 chat session 的消息预置逻辑（system-reminder 4 分块结构 + 评分规范十维度 + 评估改进闭环 + proposal 输出契约 + 用户消息格式）

### Modified Capabilities

- `project-store-persistence`：`meta.json` / `ProjectMeta` / `ProjectInfo` 新增 `healthScore` 字段，`ProjectInfo` 新增 `metaPath` 绝对路径字段；`toProjectInfo` 透传 `healthScore` 并基于 `id` 拼接 `metaPath`
- `app-header-layout`：中央区域 ProjectSelector 旁新增健康度 icon 元素，右侧布局规则不变

## Impact

- `shared/types/project.ts` — `ProjectMeta` / `ProjectInfo` 类型扩展（`healthScore` + `metaPath`）
- `electron/main/infra/storage/project-store.ts` — `toProjectInfo` 透传 `healthScore` + 拼接 `metaPath`
- `electron/main/services/project/project-service.ts` — `updateProject.patch` 接受 `healthScore`
- `frontend/src/stores/project.ts` — 新增 `refreshCurrentProject()` 仅就地合并字段
- `frontend/src/components/layout/AppHeader.vue` — 健康度 icon、Popover、`@click` 同步开 + 并发 fetch、新 session 启动逻辑
- `frontend/src/constants/health-check-reminder.ts`（新文件） — system-reminder 模板常量（4 个分块 + 十维度评分规范 + 防刷分原则）
- `electron/main/services/chat/system-reminder/chat.txt` — 无需修改，健康检查 reminder 由前端动态注入，不走常规 reminder 注入路径
- 无新增 IPC 通道，复用 `project:getById`（读）+ agent Edit/Write `meta.json`（写）

## Follow-ups

- **apply quality gate（独立 change）**：本 change 只衡量"配置完备度"，不保证 apply 阶段一定触发这些配置。后续可由独立 change 在 FylloCode apply 流程中引入 quality gate（apply 完成时自动跑项目的 lint / typecheck / test，失败则不能 archive；或在 task 完成后强制 commit 触发 git hook）。届时配置才会真正"卡住 agent"，与本 change 的 healthScore 形成完整闭环。该工作不在本 change 范围内
