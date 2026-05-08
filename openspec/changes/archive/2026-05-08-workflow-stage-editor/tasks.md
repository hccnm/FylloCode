## 1. 依赖与工程准备

- [x] 1.1 安装 `@vueuse/integrations` 和 `sortablejs` 及其类型声明（`@types/sortablejs`）
- [x] 1.2 确认 `js-yaml` 的 `dump` 函数已可用（当前只引入了 `load`，需补充导入）

## 2. 逻辑提取：utils 和 composable

- [x] 2.1 创建 `frontend/src/utils/workflow.ts`，将 `WorkflowDetail.vue` 中的纯函数迁移进去：`toStringValue`、`toStringList`、`parseStageType`、`parseWorkflowYaml`，以及相关类型（`RawWorkflow`、`RawStage`、`ParsedWorkflow`）
- [x] 2.2 在 `utils/workflow.ts` 中新增 `STAGE_TEMPLATES` 常量，为每种 `WorkflowStageType` 定义预置 stage 对象（含 id、name、type、prompt 占位符）
- [x] 2.3 创建 `frontend/src/composables/useWorkflowEditor.ts`，接收响应式 YAML 字符串，暴露四个操作方法：`appendStage(type: WorkflowStageType)`、`removeStage(stageId: string)`、`updateStageAgent(stageId: string, agentId: string)`、`reorderStages(newOrder: string[])`，内部均通过 `load` → 修改 → `dump` 实现

## 3. 组件拆分

- [x] 3.1 创建 `frontend/src/components/workflow/StageCard.vue`：接收单个 `WorkflowStage` 和 `readonly` prop，渲染 stage 信息；右上角提供 delete icon；agent 字段在非只读时显示为可点击的 `UDropdownMenu`，列出已安装 agent，选择后 emit `update:agent` 事件，点击删除时 emit `remove`
- [x] 3.2 创建 `frontend/src/components/workflow/StageList.vue`：接收 `stages`、`readonly`、`modelValue`（YAML 字符串）prop；集成 `useSortable` 实现拖拽排序；顶部显示 plus-icon + `UDropdownMenu` 列出 stage type；内部使用 `useWorkflowEditor` 处理追加、删除和重排操作，通过 `emit("update:modelValue")` 回传新 YAML
- [x] 3.3 更新 `WorkflowDetail.vue`：移除已迁移的纯函数和类型，改用 `utils/workflow.ts`；将左侧阶段列表区域替换为 `StageList` 组件；保留 header、保存逻辑、`YamlEditor` 集成

## 4. StageCard agent dropdown 集成

- [x] 4.1 在 `StageCard.vue` 中引入 `useAcpAgentsStore`，构造 dropdown items（label 用 `getAgentLabel`，value 为 agent id）
- [x] 4.2 处理无已安装 agent 的空态：dropdown 显示"暂无已安装的 Agent"禁用项
- [x] 4.3 agent 字段在只读模式下渲染为普通文本，不可点击

## 5. StageList 拖拽排序集成

- [x] 5.1 使用 `useSortable` 绑定 stage 列表容器，配置 `animation` 和 `handle`（可选，避免与 dropdown 点击冲突）
- [x] 5.2 在 `onUpdate` 回调中获取新顺序的 stage id 数组，调用 `useWorkflowEditor` 的 `reorderStages` 方法更新 YAML
- [x] 5.3 内置模板时禁用拖拽（`disabled: true` 传给 `useSortable` options）

## 5.4 Stage 删除集成

- [x] 5.4 在 `StageCard.vue` 上添加 delete icon，仅在非只读时显示，并避免与拖拽/agent dropdown 交互冲突
- [x] 5.5 在 `StageList.vue` 中处理 `remove` 事件，调用 `useWorkflowEditor` 的 `removeStage` 方法更新 YAML
- [x] 5.6 删除最后一个 stage 时保持左侧空态与 YAML 同步刷新

## 6. 验证

- [x] 6.1 类型检查通过：`pnpm typecheck`
- [x] 6.2 手动验证：追加各 stage type 后 YAML 正确更新，左侧预览同步刷新
- [x] 6.3 手动验证：切换 agent 后 YAML 对应 stage 的 agent 字段正确更新
- [x] 6.4 手动验证：拖拽排序后 YAML stages 顺序正确，序号徽标更新
- [x] 6.5 手动验证：内置模板下 plus-icon、agent dropdown、拖拽均不可用
- [x] 6.6 手动验证：点击 delete icon 后对应 stage 从 YAML 中移除，左侧预览同步刷新
- [x] 6.7 手动验证：删除最后一个 stage 后 YAML `stages` 为空数组，左侧展示空态
- [x] 6.8 手动验证：内置模板下 delete icon 不显示或不可用
