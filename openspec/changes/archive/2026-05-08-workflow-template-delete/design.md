## Context

workflow 模板删除的后端链路（IPC handler、service、store 方法）已完整实现。缺少的是前端两处入口：Sidebar 卡片的 hover 菜单和详情页顶部的删除按钮。改动范围仅限三个前端文件，无新增依赖、无数据模型变更。

## Goals / Non-Goals

**Goals:**

- Sidebar 自定义模板卡片 hover 时显示 more icon，点击弹出含"删除"项的 dropdown menu
- 详情页顶部操作区仅保留删除和保存按钮，取消按钮移除
- 删除按钮采用 neutral 基底，hover 时切换为 danger/error 风格
- 删除后重置视图状态（退出编辑器，清空选中）

**Non-Goals:**

- 删除确认弹窗（当前不引入，保持与其他删除操作一致的直接删除风格）
- 内置模板删除入口
- Sidebar 内置模板卡片的 hover 菜单

## Decisions

**决策 1：Sidebar 使用 hover 显示 more icon + UDropdownMenu**

沿用项目中 `SessionItem.vue` 的已有模式：`group` class + `group-hover:opacity-100` 控制 more icon 可见性，`UDropdownMenu` 承载菜单项。菜单项结构与项目现有用法一致（`label`、`icon`、`color`、`onSelect`）。

备选方案：右键 context menu——交互不直观，放弃。

**决策 2：详情页删除按钮独立放置，不合并进 dropdown**

删除是高频且明确的操作，独立按钮比隐藏在菜单里更易发现。按钮默认使用 `color="neutral"` + `variant="ghost"`，在 hover 时切换为 danger/error 视觉提示，以兼顾日常界面克制感与危险操作识别度。取消按钮从顶部操作区移除，右侧仅保留删除和保存两个动作。

**决策 3：删除事件由 workflow.vue 统一处理**

`WorkflowSidebar` 和 `WorkflowDetail` 均通过 emit 向上传递 `delete` 事件，由 `workflow.vue` 调用 store 并处理删除后的视图重置（`cancelEditing()`）。保持子组件无副作用，符合现有架构分层。

## Risks / Trade-offs

- [无确认弹窗] 误操作后无法撤销 → 当前阶段接受此风险，与项目其他删除操作保持一致；后续可统一引入确认机制
- [hover 交互] 触控设备无 hover 状态 → 当前应用为桌面端 Electron，不考虑触控场景
