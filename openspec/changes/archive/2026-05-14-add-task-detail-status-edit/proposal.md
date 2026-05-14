## Why

当前任务详情弹窗的查看模式和编辑模式均不展示、不支持修改任务状态（打开/关闭）。用户关闭一个任务后无法从 UI 重新打开，也无法在详情中直观看到任务是否已关闭。这是任务管理的基础能力缺口。

## What Changes

- 任务详情弹窗查看模式中展示任务状态（打开/关闭），使用 nuxt/ui RadioGroup 与外层状态筛选器保持一致的外观
- 任务详情弹窗编辑模式中支持修改状态
- 保存成功后显示 toast "保存成功"并关闭弹窗
- 外部任务卡片展示状态指示器（不可编辑），补齐 spec 中已有但实现缺失的部分

## Capabilities

### New Capabilities

<!-- None -->

### Modified Capabilities

- `task-panel`: 修改"任务详情弹窗为本地任务提供编辑模式"需求 — 编辑模式 SHALL 支持修改 `status` 字段；新增查看模式展示状态的要求；新增保存成功 toast 反馈

## Impact

- `frontend/src/components/task/TaskDetailModal.vue` — 新增状态展示与编辑 UI
- `frontend/src/components/task/TaskCard.vue` — 新增状态指示器
- `frontend/src/pages/task.vue` — 新增保存成功 toast 逻辑
- `shared/types/task.ts` — 无变更（`UpdateTaskInput` 已支持 `status`）
- `frontend/src/__tests__/components/task-detail-modal.spec.ts` — 测试用例需同步更新
