## Context

Chat 页面在无消息时（草稿态或已建空 session）主区域完全空白，只有底部 `ChatPromptPanel` 的 footer 里有一个 `ChatAgentSelect` 下拉选择器。该选择器入口隐蔽，无法展示 Agent 详情，也无法在同一界面安装新 Agent。

现有数据层已完备：

- `useAcpAgentsStore.installedAgentIds`：已安装 agent 列表（按 registry 顺序）
- `useAcpAgentsStore.registry.agents`：全量 agent 列表
- `useAcpAgentsStore.installAgent(agentId)`：安装入口，进度走 `installProgress[id]`
- `useSessionStore.setDraftAgent(agentId)` / `setSessionAgent(agentId)`：写入选定 agent
- `useSessionStore.effectiveAgentId`：当前生效的 agent（草稿态 = `draftAgentId`，已建 session = `activeSession.agentId`）

## Goals / Non-Goals

**Goals:**

- 空态时给用户清晰的 Agent 选择引导
- 即点即生效：点击已安装卡片立即写入 `draftAgentId` / `activeSession.agentId`，触发 session store watcher 自动发起 probe 和 capability 刷新
- 弹窗支持搜索、安装未安装 Agent、选择已安装 Agent（两步确认）
- 修复启动时序 bug：项目就绪后 probe 未触发

**Non-Goals:**

- 不改变已有消息的 session 的 Agent 切换逻辑
- 不删除 `ChatAgentSelect.vue` 文件（留给后续清理）
- 不改变 `ConfigOptionsBar` 的渲染逻辑（它仍依赖 draftAgentId / probe，与 picker 互补）

## Decisions

### 1. 空态替换 ChatMessageList，而非叠加

**决策**：`ChatContainer` 在 `messages.length === 0` 时用 `ChatEmptyAgentPicker` 完全替换 `ChatMessageList`，而非在消息列表上方叠加。

**理由**：空态和有消息态是互斥的，叠加会导致布局混乱；替换更简洁，`v-if / v-else` 即可。

### 2. 已安装卡片即点即生效，弹窗两步确认

**决策**：空态页面的 `InstalledAgentTile` 点击立即调用 `setDraftAgent` / `setSessionAgent`；弹窗内的已安装卡片需先选中再点"确定"才生效。

**理由**：空态页面卡片数量少（≤4），误触成本低，即点即生效体验更流畅；弹窗内已安装和未安装混排，需要防止误触，两步确认更安全。

### 3. MoreAgentsTile 兼任 promo 卡

**决策**：`MoreAgentsTile` 通过 `variant: "more" | "promo"` prop 区分两种状态：有已安装时显示 "More Agents"，无已安装时显示 "N+ Agents Available"。

**理由**：两种状态的交互行为完全相同（点击打开弹窗），复用一个组件减少维护成本。

### 4. watcher deps 扩展为 [effectiveAgentId, projectId] 元组

**决策**：`session.ts` 中的 probe watcher 将依赖项从 `effectiveAgentId` 单值改为 `[effectiveAgentId, projectStore.currentProject?.id]` 元组。

**理由**：原 watcher 在启动时 `effectiveAgentId` 已就绪但 `projectId` 为 null，直接 return；之后用户选择项目时 `effectiveAgentId` 没变，watcher 不再触发，导致 probe 永远不发起。扩展 deps 后，projectId 变化也会触发 watcher，补发 probe。

同时加入 `if (draftProbeByAgent.value.has(nextAgentId)) return` 防止 agent 切去切回时重复 probe。

### 5. 弹窗不复用 SettingsAgents.vue

**决策**：新建 `AgentPickerModal.vue`，内部复用 `AgentPickerCard.vue`（新建），不复用整页 `SettingsAgents.vue`。

**理由**：`SettingsAgents.vue` 包含刷新按钮、标签切换等设置页专属 UI，弹窗场景需要更紧凑的布局和"选中→确定"交互，复用会引入不必要的耦合。

## Risks / Trade-offs

- **[风险] `chat-prompt-panel.spec.ts` 断言失效** → 需同步更新测试，移除对 `ChatAgentSelect` 的断言，补充空态渲染断言
- **[风险] `ChatAgentSelect.vue` 成为死代码** → 文件暂留不删，proposal 阶段标注，后续统一清理
- **[取舍] 弹窗内未安装 Agent 不可选中** → 避免"选了但用不了"的歧义；用户需先安装再选择，安装完成后 agent 自动出现在已安装区
