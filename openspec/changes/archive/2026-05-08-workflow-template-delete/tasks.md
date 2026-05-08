## 1. WorkflowSidebar — hover 菜单

- [x] 1.1 在 `WorkflowSidebar.vue` 的 `defineEmits` 中新增 `delete: [id: string]` 事件
- [x] 1.2 新增 `getMenuItems(template)` 函数，返回含"删除"项的 dropdown items 数组
- [x] 1.3 将自定义模板卡片 `<button>` 改为相对定位容器，添加 `group` class
- [x] 1.4 在卡片内添加 `UDropdownMenu`，触发器为 hover 时显示的 more icon 按钮（`group-hover:opacity-100`）
- [x] 1.5 阻止 more icon 点击事件冒泡，避免触发卡片的 `select` 事件

## 2. WorkflowDetail — 顶部删除按钮

- [x] 2.1 在 `WorkflowDetail.vue` 的 `defineEmits` 中新增 `delete: []` 事件
- [x] 2.2 在顶部操作区新增删除按钮，`v-if="!isBuiltIn"`，`color="neutral"`，`variant="ghost"`，hover 时呈现 danger/error 视觉
- [x] 2.3 删除按钮点击时 emit `delete` 事件

## 3. workflow.vue — 删除处理

- [x] 3.1 新增 `deleteTemplate(id: string)` 异步函数，调用 `workflowStore.deleteTemplate(name)`
- [x] 3.2 删除成功后调用 `cancelEditing()` 重置视图状态，并通过 `toast.add` 显示删除成功提示
- [x] 3.3 删除失败时通过 `toast.add` 显示错误提示
- [x] 3.4 在 `<WorkflowSidebar>` 上监听 `@delete` 事件，调用 `deleteTemplate`
- [x] 3.5 在 `<WorkflowDetail>` 上监听 `@delete` 事件，以当前选中模板 name 调用 `deleteTemplate`
- [x] 3.6 在 `saveTemplate` 成功后通过 `toast.add` 显示保存成功提示（区分"复制并保存"和"保存 YAML"两种文案）
