## Why

新建会话时（无消息记录），Chat 主区域完全空白，用户没有明确的引导知道该选哪个 Agent 才能开始。同时 footer 的 `ChatAgentSelect` 下拉选择器入口隐蔽、无法展示 Agent 详情，也无法在同一界面安装新 Agent。

## What Changes

- **新增** Chat 空态占位页面 `ChatEmptyAgentPicker`：标题 "Pick an Agent to Start"，展示最多 4 个已安装 Agent 的方块卡片（`InstalledAgentTile`），以及一个 "More Agents" / "N+ Agents Available" 入口卡片（`MoreAgentsTile`）
- **新增** Agent 选择弹窗 `AgentPickerModal`：含搜索框、已安装区（可选中）、未安装区（含安装按钮）、footer 取消/确定
- **新增** 弹窗内复用卡片 `AgentPickerCard`：按 installed 状态分两种渲染
- **移除** `ChatPromptPanel` footer 中的 `ChatAgentSelect` 组件引用（**BREAKING**：`ChatAgentSelect` 不再在 footer 渲染；文件本体暂留，后续可删）
- **修改** `ChatContainer`：`messages.length === 0` 时渲染 `ChatEmptyAgentPicker` 替代 `ChatMessageList`
- **修改** `useSessionStore` watcher：将依赖项从单一 `effectiveAgentId` 扩展为 `[effectiveAgentId, projectId]` 元组，修复启动时项目就绪后 probe 未触发的 bug
- **修改** `chat-interface` spec：移除"ChatAgentSelect 在 agent 锁定时隐藏"requirement，改为"Chat 空态展示 Agent 选择器"
- **修改** `chat-agent-selection` spec：移除"ChatAgentSelect 展示已安装 ACP agent 列表"requirement，新增空态 Agent Picker 的选择行为规范
- **修改** `chat-session-probe` spec：补充"projectId 就绪后补发 probe"场景

## Capabilities

### New Capabilities

- `chat-empty-agent-picker`：Chat 空态 Agent 选择器 UI，含占位页、方块卡片、More Agents 入口、弹窗（搜索/安装/选择）

### Modified Capabilities

- `chat-interface`：移除 `ChatAgentSelect 在 agent 锁定时隐藏` requirement，新增空态渲染 requirement
- `chat-agent-selection`：移除 `ChatAgentSelect 展示已安装 ACP agent 列表` requirement，新增空态 picker 的 agent 选择行为
- `chat-session-probe`：补充 projectId 就绪触发 probe 的场景

## Impact

- `frontend/src/components/chat/ChatContainer.vue`：新增空态分支
- `frontend/src/components/chat/prompt/ChatPromptPanel.vue`：移除 `ChatAgentSelect` 引用
- `frontend/src/components/chat/ChatAgentSelect.vue`：不再被引用（可后续删除）
- `frontend/src/components/chat/empty/`：新增 5 个组件文件
- `frontend/src/stores/session.ts`：watcher deps 扩展
- `frontend/src/__tests__/components/chat-prompt-panel.spec.ts`：需更新，移除对 `ChatAgentSelect` 的断言
