## Why

自定义 workflow 模板目前只能新建，无法删除，用户无法清理不再需要的模板。后端删除 IPC 接口与 store 方法已存在，缺少的是前端入口。

## What Changes

- Sidebar 自定义模板卡片 hover 时显示 more icon，点击弹出 dropdown menu，包含"删除"操作
- workflow 详情页顶部操作区保留删除和保存按钮，取消按钮移除
- workflow 详情页顶部删除按钮采用 neutral 基底，hover 时切换为 danger/error 风格
- workflow.vue 主页面新增 `deleteTemplate` 处理函数，负责调用 store 并处理删除后的视图状态重置
- 保存成功（含复制并保存）和删除成功后，通过 nuxt/ui toast 向用户显示操作成功提示

## Capabilities

### New Capabilities

无新增 capability，本次改动属于对现有 `workflow-templates` capability 的需求扩展。

### Modified Capabilities

- `workflow-templates`：新增"删除自定义模板"需求——用户可从 Sidebar 卡片菜单或详情页顶部按钮删除自定义模板；内置模板不显示删除入口。
- `workflow-templates`：新增"删除自定义模板"需求——用户可从 Sidebar 卡片菜单或详情页顶部按钮删除自定义模板；内置模板不显示删除入口，详情页不再提供取消按钮。

## Impact

- `frontend/src/components/workflow/WorkflowSidebar.vue`：新增 hover 交互与 dropdown menu
- `frontend/src/components/workflow/WorkflowDetail.vue`：顶部操作区调整为删除和保存按钮，`delete` emit 保留
- `frontend/src/pages/workflow.vue`：新增 `deleteTemplate` 处理函数，处理删除后视图重置
- 无新增依赖，无 IPC/store/类型变更
