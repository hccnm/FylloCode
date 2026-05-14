## Context

当前 `TaskDetailModal` 的编辑模式仅支持修改 `title` 和 `description`，spec 明确要求"不支持修改 status"。现在需要开放 status 编辑，同时在查看模式和 TaskCard 上展示状态。

`shared/types/task.ts` 中 `UpdateTaskInput` 已包含 `status` 字段，`taskStore.updateTask` 和 IPC `task:update` 均已支持。变更范围仅限前端 UI。

## Goals / Non-Goals

**Goals:**

- 查看模式展示任务状态（打开/关闭），使用 UBadge 与外层状态筛选器视觉一致
- 编辑模式支持通过 URadioGroup 修改状态，item 定义与外层筛选器保持一致
- 保存时同时提交 `status` 字段，保存成功后 toast "保存成功"并关闭弹窗
- TaskCard 展示状态指示器

**Non-Goals:**

- 不改变外部任务（云效/GitHub）的编辑行为（它们本就不支持编辑）
- 不改变已关闭任务的编辑能力（当前已支持）
- 不在 TaskCard 上提供修改状态的入口
- 不改变状态筛选器（过滤器）的行为

## Decisions

### 状态 UI 组件选择：URadioGroup（编辑模式） + UBadge（查看模式 / 卡片）

- 编辑模式使用 `URadioGroup`，与页面顶部状态筛选器使用同一组件、同一 item 定义、同一样式参数（`orientation="horizontal"`, `color="primary"`），保证视觉一致
- 查看模式使用 `UBadge` 展示当前状态，`open` 用 `success` 色、`closed` 用 `neutral` 色
- TaskCard 同样使用 `UBadge` 展示状态

### 状态 items 定义在组件本地

`statusItems` 在 `TaskDetailModal.vue` 中本地定义，与 `task.vue` 中的筛选器 items 值一致（`"打开"/"open"`, `"关闭"/"closed"`）。不复用外层的定义以避免跨组件耦合。

### Toast 在 page 层处理

保存逻辑由 `task.vue` 的 `handleSaveDetail` 统一处理，在其中调用 `useToast().add()` 展示成功反馈，然后关闭弹窗。遵循项目中 `workflow.vue`、`project.ts` 已有的 toast 使用模式。

## Risks / Trade-offs

- **状态 items 重复定义**：TaskDetailModal 和 task.vue 中各有一份 `statusItems`，但定义简单（2 项），重复成本低于抽取共享常量的复杂度。
- **测试更新**：现有测试 `"emits save with the expected payload"` 需要同步更新，因为 save payload 中新增了 `status` 字段。
