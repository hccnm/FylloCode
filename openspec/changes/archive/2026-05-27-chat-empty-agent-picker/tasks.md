## 1. 新增空态组件

- [x] 1.1 新增 `frontend/src/components/chat/empty/InstalledAgentTile.vue`：方块卡片，props: `agentId`, `name`, `icon?`, `selected?`；点击 emit `select(agentId)`；选中态显示 primary 描边 + 右上角 check icon（`i-lucide-check`）
- [x] 1.2 新增 `frontend/src/components/chat/empty/MoreAgentsTile.vue`：入口卡片，props: `variant: "more" | "promo"`, `totalCount: number`；点击 emit `click`；promo 变体显示 primary 配色 + sparkles 图标 + "N+ Agents Available" 文案
- [x] 1.3 新增 `frontend/src/components/chat/empty/AgentPickerCard.vue`：弹窗内卡片，props: `agent: AcpAgentEntry`, `icon?`, `agentStatus?`, `installProgress?`, `selected?`, `selectable?`, `installDisabled?`；已安装且 `selectable` 时点击 emit `select(agentId)`；未安装时显示安装按钮 emit `install(agentId)`；安装中显示 spinner
- [x] 1.4 新增 `frontend/src/components/chat/empty/AgentPickerModal.vue`：`UModal`，`v-model:open`，prop `currentAgentId?`，emit `confirm(agentId)`；内含搜索框（`UInput`）、已安装区（`AgentPickerCard selectable`）、未安装区（`AgentPickerCard`）、footer 取消/确定；打开时初始化 `stagedAgentId = currentAgentId`，搜索框清空；确定时 emit confirm 并关闭
- [x] 1.5 新增 `frontend/src/components/chat/empty/ChatEmptyAgentPicker.vue`：容器组件，从 `useAcpAgentsStore` 取 `installedAgentIds`（前 4 项）、`registry.agents.length`、`icons`；从 `useSessionStore` 取 `effectiveAgentId`（`activeSession?.agentId ?? draftAgentId`）；有已安装时渲染 5 列网格（4 个 `InstalledAgentTile` + 1 个 `MoreAgentsTile variant="more"`），无已安装时渲染 `MoreAgentsTile variant="promo"`；点击 tile 调用 `setDraftAgent` 或 `setSessionAgent`；点击 MoreAgentsTile 打开 `AgentPickerModal`

## 2. 修改 ChatContainer

- [x] 2.1 修改 `frontend/src/components/chat/ChatContainer.vue`：新增 `isEmpty = computed(() => (activeSession?.messages.length ?? 0) === 0)`；在消息区用 `v-if="isEmpty"` 渲染 `ChatEmptyAgentPicker`，`v-else` 渲染 `ChatMessageList`；导入 `ChatEmptyAgentPicker`；外层容器加 `h-full` 使空态能垂直居中

## 3. 修改 ChatPromptPanel

- [x] 3.1 修改 `frontend/src/components/chat/prompt/ChatPromptPanel.vue`：移除 `import ChatAgentSelect from "../ChatAgentSelect.vue"`；移除 `isAgentLocked` computed；移除 template 中 `<ChatAgentSelect v-if="!isAgentLocked" v-model="agent" />`；将 `agent` computed 改为只读（去掉 setter，仅保留 getter `activeSession?.agentId ?? draftAgentId ?? undefined`）

## 4. 修复 session store watcher

- [x] 4.1 修改 `frontend/src/stores/session.ts`：将 probe watcher 依赖项从 `() => effectiveAgentId.value` 改为 `() => [effectiveAgentId.value, useProjectStore().currentProject?.id ?? null] as const`；watcher 回调签名改为 `([nextAgentId, projectId], oldValues)`，`previousAgentId` 从 `oldValues?.[0]` 取；`refreshCapabilities` 和 `closeDraftProbe` 仅在 `nextAgentId !== previousAgentId` 时触发；`ensureDraftProbe` 条件加入 `!draftProbeByAgent.value.has(nextAgentId)` 防重复

## 5. 更新测试

- [x] 5.1 修改 `frontend/src/__tests__/components/chat-prompt-panel.spec.ts`：移除对 `ChatAgentSelect` 渲染的断言；补充"footer 不渲染 ChatAgentSelect"断言；确认 `pnpm test` 通过

## 6. 清理死代码（可选，后续统一处理）

- [x] 6.1 确认 `frontend/src/components/chat/ChatAgentSelect.vue` 无其他引用后可删除（已删除）
