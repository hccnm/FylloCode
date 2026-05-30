## Why

ACP registry 中的 `claude-acp`、`codex-acp`、`pi-acp` 三个条目在用户视角上行为差异很大：`claude-acp` 与 `codex-acp` 是**独立适配层**，自带完整实现、不依赖本地 `claude` / `codex` CLI；`pi-acp` 则是**桥接层**，运行时通过 `spawn` 调用本地 `pi` CLI 完成工作。当前 FylloCode 的卡片 UI 把三者与原生 ACP agent 混合呈现，唯一的状态信号是「已安装 / 未安装」，导致用户产生两类典型困惑：

1. 用户安装了 Claude Code 或 Codex，认为 FylloCode 应当识别为「已安装」，怀疑检测有 bug；
2. 用户装好 `pi-acp` 后预期可立即使用，实际因本地缺少 `pi` CLI 而在首次发送消息时失败。

ACP registry 官方 schema 不区分这三类形态，FylloCode 需要在自己这一层补上**分类元数据**，并把它一致地注入 registry 数据出口，让所有消费方（设置页 Agents 列表、Chat 空态选择卡片、AgentPickerModal 弹窗）都能基于同一份信息做差异化展示。

## What Changes

- 在 `shared/types/acp-agent.ts` 中新增类型 `AcpAgentKind = "native" | "adapter" | "bridge"`，并在 `AcpAgentEntry` 上扩展可选命名空间字段 `__fyllo?: { kind: AcpAgentKind }`，作为 FylloCode 自有元数据的预留入口
- 新增内置常量 `AgentKindMap`（FylloCode 源码维护，按 `agent.id` 索引），目前明确分类：
  - `adapter`: `claude-acp`、`codex-acp`、`amp-acp`
  - `bridge`: `pi-acp`
  - 其余 agent.id 不在映射 → 默认 `native`
- 在 `electron/main/infra/storage/acp-registry-cache.ts` 的 `getRegistry()` / `refreshRegistry()` 出口前合并分类字段；磁盘缓存 `registry-cache.json` 保持上游原始数据，不写入 `__fyllo`
- UI 表达统一为「图标 + tooltip」：
  - `native`: 不显示图标
  - `adapter`: `i-lucide-layers` 图标，tooltip = **「适配器 · 自带完整实现，可与已安装的对应 Agent 共享配置」**
  - `bridge`: `i-lucide-cable` 图标，tooltip = **「桥接器 · 与 Agent 桥接打通，需要先安装对应的 Agent」**
- 卡片侧改造：
  - `frontend/src/components/settings/AgentCard.vue`：在名称行追加分类徽章
  - `frontend/src/components/chat/empty/AgentPickerCard.vue`：在名称行追加分类徽章
  - **不**改造 `InstalledAgentTile.vue`：tile 视觉极小（仅图标 + 名称两行），加图标会与「选中态对勾角标」争抢同一区域并污染极简形态；分类引导留给 `AgentPickerModal` 中的 `AgentPickerCard` 承担即可
- 新增 `guidelines/Domain.md`，作为 FylloCode 产品词汇与判定标准的常驻 source of truth：录入 `native` / `adapter` / `bridge` 三类 agent 的定义、判定准则（含「用户心智锚点」准则）、当前已知归类示例（含被刻意归类为 `native` 的边界案例如 `glm-acp-agent`、`agoragentic-acp`），以及"新增/重新分类时必须双向同步 `Domain.md` 与 `electron/main/domain/acp/agent-kind-map.ts`"的纪律

## Capabilities

### New Capabilities

- `acp-agent-kind-classification`: 定义 FylloCode 在 ACP registry 之上叠加的 agent 分类元数据契约 —— 命名空间字段、分类来源、注入时机、未匹配兜底策略与新增 bridge 时的同步纪律

### Modified Capabilities

- `agent-registry-cache`: registry 数据出口需在返回前注入分类字段；磁盘缓存语义保持「上游原始 snapshot」不变
- `agent-status-panel`: 设置页 Agent 卡片需根据 `__fyllo.kind` 展示分类图标 + tooltip
- `chat-agent-selection`: Chat 空态 `AgentPickerModal` 中的卡片需根据 `__fyllo.kind` 展示分类图标 + tooltip；`InstalledAgentTile` 不变

## Impact

- **代码改动**：
  - `shared/types/acp-agent.ts`：类型扩展
  - `electron/main/domain/acp/`：新增 `agent-kind-map.ts`（或同等位置）放置 `AgentKindMap` 常量
  - `electron/main/infra/storage/acp-registry-cache.ts`：在 `getRegistry()` / `refreshRegistry()` 出口前合并字段
  - `frontend/src/components/settings/AgentCard.vue`、`frontend/src/components/chat/empty/AgentPickerCard.vue`：UI 渲染分类标识
- **数据兼容性**：`__fyllo` 是新增可选字段，老缓存可直接读取；磁盘 snapshot 不变，无需迁移
- **不涉及**：detector 检测逻辑、IPC channel 形状、安装/卸载流程、auth / API key 机制
- **工程纪律 / 文档**：新增 `guidelines/Domain.md` 作为产品词汇与判定标准的 source of truth；root `CLAUDE.md` 的「文档归类」段落追加 Domain 索引
