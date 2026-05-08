## Why

当前 workflow 编辑器只能手写 YAML，stage 的 `type` 和 `agent` 字段一旦写错就会执行失败，且 `WorkflowDetail.vue` 组件承载了解析、渲染、编辑操作等多重职责，代码拥挤、难以维护。需要在保持 YAML 为主的前提下，提供有限的结构化辅助操作，同时完成组件拆分和逻辑分层。

## What Changes

- 左侧阶段预览区新增 **plus-icon 按钮**，点击弹出 dropdown，列出所有 stage type，选择后将对应预置 YAML 模板追加到当前 YAML 的 stages 末尾
- stage card 上新增 **delete icon 按钮**，点击后将当前 stage 从 YAML 的 stages 数组中移除
- stage card 上的 **agent 字段**改为可点击的 dropdown，列出已安装的 ACP agent，选择后更新对应 stage 的 `agent` 字段
- stage card 支持**拖拽排序**，拖拽结束后重排 YAML 中的 stages 顺序
- 所有结构化修改均通过 js-yaml parse → 修改 → stringify 回写，YAML 始终是唯一数据源
- `WorkflowDetail.vue` 拆分为 `StageCard.vue`（单个 stage 渲染与交互）和 `StageList.vue`（列表容器、拖拽、plus-icon）
- YAML 解析纯函数迁移到 `utils/workflow.ts`
- YAML 结构化修改操作提取为 `composables/useWorkflowEditor.ts`

## Capabilities

### New Capabilities

- `workflow-stage-quick-edit`: 通过 UI 辅助操作（追加/删除 stage 模板、切换 agent、拖拽排序）对 YAML 进行结构化修改，无需手写字段值

### Modified Capabilities

- `workflow-editor`: 左侧阶段预览区从纯只读渲染升级为支持有限结构化编辑操作（追加、agent 选择、拖拽排序）

## Impact

- **新增文件**：`frontend/src/components/workflow/StageCard.vue`、`StageList.vue`、`frontend/src/composables/useWorkflowEditor.ts`、`frontend/src/utils/workflow.ts`
- **修改文件**：`frontend/src/components/workflow/WorkflowDetail.vue`（大幅瘦身，逻辑迁出）
- **新增依赖**：`@vueuse/integrations`、`sortablejs`（拖拽排序）
- **无 IPC 变更**，无共享类型变更，无 store 结构变更
