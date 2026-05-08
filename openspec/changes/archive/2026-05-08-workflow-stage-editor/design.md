## Context

`WorkflowDetail.vue` 当前承载了 YAML 解析、stage 渲染、保存校验等多重职责，约 340 行，难以维护。左侧阶段预览区是纯只读渲染，用户必须手写 YAML 才能修改 stage 的 `type` 和 `agent` 字段，容易出错。

本次改动在保持 YAML 为唯一数据源的前提下，通过组件拆分和逻辑分层提升可维护性，并在左侧视图增加有限的结构化辅助操作。

## Goals / Non-Goals

**Goals:**

- 拆分 `WorkflowDetail.vue`，职责单一化
- 提供 stage type 预置模板追加、stage 快速删除、agent 快速切换、拖拽排序四个辅助操作
- 所有 UI 操作最终都转化为 YAML 字符串修改，不引入独立的结构化状态

**Non-Goals:**

- 完整的双向绑定可视化编辑器（注释丢失问题无好的解法）
- stage 内部字段（prompt、mcp、skills 等）的 UI 编辑
- 新增 IPC 通道或修改共享类型

## Decisions

### 1. YAML 修改策略：js-yaml parse → 修改 → dump

**决策**：所有结构化操作（追加、删除、修改 agent、重排）均通过 `js-yaml` 的 `load` + `dump` 完成，不做字符串正则替换。

**理由**：字符串替换在 YAML 缩进不规范或有注释时容易出错；`js-yaml` 已是项目依赖，parse/dump 是安全的结构化操作。

**代价**：`dump` 会丢失用户手写的注释和自定义格式（空行、缩进风格）。这是可接受的 trade-off——只有用户主动触发 UI 操作时才发生，且有明确的操作语义。

**替代方案**：yaml-ast-parser 做 AST 级修改可保留注释，但复杂度高、维护成本大，当前阶段不值得。

### 2. 拖拽方案：@vueuse/integrations + sortablejs

**决策**：引入 `@vueuse/integrations` 和 `sortablejs`，使用 `useSortable` composable。

**理由**：`@vueuse/core` 已是项目依赖，`integrations` 是自然延伸；`sortablejs` 是业界标准拖拽库，触摸支持好；原生 HTML5 drag & drop API 在跨浏览器和触摸设备上有兼容性问题。

**替代方案**：`vuedraggable` 封装过重且维护活跃度低，不选。

### 3. 组件拆分层次

```
WorkflowDetail.vue          # 布局容器、header、保存逻辑
├── StageList.vue           # 阶段列表、拖拽容器、plus-icon
│   └── StageCard.vue       # 单个 stage 渲染、agent dropdown
└── YamlEditor.vue          # 不变
```

**决策**：拆两层，`StageList` 持有拖拽逻辑和追加操作，`StageCard` 只负责单个 stage 的渲染和 agent 选择。

**理由**：`StageCard` 是纯展示 + 单字段交互，职责清晰；`StageList` 持有列表级操作（顺序、追加），与 `StageCard` 职责不重叠。

### 4. 逻辑分层

| 逻辑                                                            | 归属                               | 理由                                                         |
| --------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| `parseWorkflowYaml`、`parseStageType`、`toStringValue` 等纯函数 | `utils/workflow.ts`                | 无响应式依赖，纯函数不需要 composable 包装                   |
| YAML 结构化修改（追加、修改 agent、重排）                       | `composables/useWorkflowEditor.ts` | 操作围绕同一个响应式 YAML 字符串，composable 封装状态 + 操作 |
| 模板列表、保存、删除                                            | workflow store（现有，不变）       | 全局共享状态，已有合适位置                                   |

### 5. stage type 预置模板

前端维护一个 `STAGE_TEMPLATES` 常量 map，key 为 `WorkflowStageType`，value 为对应的预置 stage 对象（含 id、name、type、prompt 占位符）。追加时 `load` 当前 YAML → push 模板对象 → `dump` 回写。删除时按 stage id 从 `stages` 数组中过滤目标元素，再 `dump` 回写。

## Risks / Trade-offs

- **注释丢失**：用户手写的 YAML 注释在触发 UI 操作后会被 `dump` 覆盖。缓解：在 UI 操作按钮附近加提示文案，告知用户此操作会重新格式化 YAML。
- **dump 格式差异**：`js-yaml dump` 的默认输出格式（缩进、引号风格）可能与用户手写风格不同。缓解：配置 `dump` 选项（`indent: 2`、`lineWidth: -1`）尽量贴近常见风格。
- **sortablejs 与 Vue 响应式冲突**：sortablejs 直接操作 DOM，可能与 Vue 的虚拟 DOM diff 冲突。缓解：`useSortable` 已处理此问题，拖拽结束后通过回调更新数据而非依赖 DOM 状态。
