## 1. 共享层（types / channels / schemas）

- [x] 1.1 在 `shared/types/channels.ts` 的 `AcpAgentChannels` 中新增两个字段：`uninstall: "acp:uninstall"`、`uninstallProgress: "acp:uninstallProgress"`。验收：`grep "acp:uninstall"` 能在 channels.ts 命中两处。
- [x] 1.2 在 `shared/types/acp-agent.ts` 中新增 `AcpUninstallProgress` 接口：`{ agentId: string; status: "uninstalling" | "done" | "error"; message?: string }`，并在该文件的导出列表中导出该类型。
- [x] 1.3 在 `shared/schemas/ipc/acp-agents.ts` 中新增 `uninstallAgentInputSchema = z.string().min(1)`。验收：与 `installAgentInputSchema` 形态一致。

## 2. 主进程：domain / storage 工具

- [x] 2.1 在 `electron/main/infra/storage/agent-capability-store.ts` 中新增导出函数 `removeAgentCapabilities(agentId: string): Promise<void>`，实现：调用 `loadCache()` 拿到 agents map，`delete agents[agentId]`，然后调用 `writeCacheDocument({ version: CACHE_VERSION, agents })`。验收：传入不存在的 agentId 不抛错，写回的文件中无该 key。
- [x] 2.2 在 `electron/main/domain/acp/detector.ts` 中新增导出函数 `removeInstalledRecord(agentId: string): Promise<void>`，实现：调用 `readInstalledRecords()`，`delete records[agentId]`，调用 `writeInstalledRecords(records)`。验收：传入不存在的 agentId 不抛错。

## 3. 主进程：installer 卸载实现

- [x] 3.1 在 `electron/main/services/acp-agent/installer.ts` 顶部，将变量 `activeInstallAgentId: string | null` 重命名为 `activeMutationAgentId: string | null`，并把 `installAgent` 函数中所有 `activeInstallAgentId` 引用同步替换。错误码保留 `INSTALL_BUSY` 但消息文案改为 `"请等待当前操作完成"`。
- [x] 3.2 在 `installer.ts` 中新增内部函数 `uninstallNpx(agent, onProgress)`：检查 `agent.distribution.npx`；调用 `findCommandPath("npm")`，找不到则抛 `ENV_MISSING("需要先安装 Node.js")`；推送 `{ agentId, status: "uninstalling", message: "正在卸载..." }`；执行 `runStreamingCommand(npmPath, ["uninstall", "-g", distribution.package], distribution.env)`；非 0 退出码抛 `UNINSTALL_FAILED(summarizeCommandOutput(stdout, stderr))`。
- [x] 3.3 在 `installer.ts` 中新增内部函数 `uninstallUvx(agent, onProgress)`：与 3.2 同结构，命令为 `uv tool uninstall <package>`，环境检查 `uv`，错误消息为"需要先安装 uv"。
- [x] 3.4 在 `installer.ts` 中新增内部函数 `uninstallBinary(agent, onProgress)`：计算 `targetDir = join(getDataSubPath("acp"), "bin", agent.id)`；在执行前断言 `/^[A-Za-z0-9_-]+$/.test(agent.id)`，否则抛 `INVALID_AGENT_ID`；推送 `uninstalling`；执行 `await fs.rm(targetDir, { recursive: true, force: true })`；捕获非 ENOENT 错误抛 `UNINSTALL_FAILED`。
- [x] 3.5 在 `installer.ts` 中新增并导出 `uninstallAgent(agent: AcpAgentEntry, installMethod: AcpInstallMethod, onProgress: ProgressHandler): Promise<void>`：检查并设置 `activeMutationAgentId`（已被占用抛 `INSTALL_BUSY`）；按 `installMethod` 分发到 `uninstallNpx` / `uninstallUvx` / `uninstallBinary`；成功后推送 `{ agentId, status: "done" }`；catch 时推送 `{ agentId, status: "error", message }` 并 rethrow；finally 释放 `activeMutationAgentId = null`。
- [x] 3.6 验收：`installer.ts` 编译通过；`activeInstallAgentId` 不再出现；导出包含 `installAgent` 与 `uninstallAgent`。

## 4. 主进程：service 与 IPC 注册

- [x] 4.1 在 `electron/main/services/acp-agent/acp-agent-service.ts` 中新增 `broadcastUninstallProgress(progress: AcpUninstallProgress): void`，结构与 `broadcastInstallProgress` 对称，向所有窗口广播 `AcpAgentChannels.uninstallProgress`。
- [x] 4.2 在同一文件中新增并导出 `uninstallAgentById(agentId: string): Promise<void>`：先 `await loadAgentRegistry()`，找到 `agent`，找不到抛 `ipcError(IpcErrorCodes.AGENT_NOT_FOUND, "未知 Agent: ${agentId}")`；再 `await readInstalledRecords()`，取 `records[agentId]`，不存在抛 `AGENT_NOT_FOUND("Agent ${agentId} is not installed")`；调用 `installer.uninstallAgent(agent, record.installMethod, broadcastUninstallProgress)`；成功后调用 `removeInstalledRecord(agentId)` 与 `removeAgentCapabilities(agentId)`。
- [x] 4.3 在 `electron/main/ipc/acp-agents.ts` 的 `registerAcpAgentHandlers` 中新增 handler：`ipcMain.handle(AcpAgentChannels.uninstall, (_event, input) => wrapHandler(async () => { const agentId = validate(uninstallAgentInputSchema, input); await uninstallAgentById(agentId); }))`。从 `acp-agent-service` 导入 `uninstallAgentById`，从 schemas 导入 `uninstallAgentInputSchema`。
- [x] 4.4 验收：`pnpm typecheck` 通过；新通道在主进程注册；service 暴露 `uninstallAgentById`。

## 5. Preload bridge

- [x] 5.1 在 `electron/preload/api/acp-agents.ts` 的 `acpAgentsApi` 对象中新增 `uninstall(agentId: string): Promise<IpcResponse<void>>`，实现 `return ipcRenderer.invoke(AcpAgentChannels.uninstall, agentId)`。
- [x] 5.2 在同一对象中新增 `onUninstallProgress(listener: (progress: AcpUninstallProgress) => void): () => void`，使用现有 `subscribeToChannel(AcpAgentChannels.uninstallProgress, listener)` 实现。
- [x] 5.3 验收：`grep "uninstall" electron/preload/api/acp-agents.ts` 命中两处导出方法；`pnpm typecheck` 通过。

## 6. 渲染层 API 与 Store

- [x] 6.1 在 `frontend/src/api/acp-agents.ts` 中新增 `uninstall(agentId: string)` 方法，实现 `return window.api.acpAgents.uninstall(agentId)`。
- [x] 6.2 在 `frontend/src/stores/acp-agents.ts` 中新增 ref：`const uninstallProgress = ref<Record<string, AcpUninstallProgress>>({})`。
- [x] 6.3 在 `ensureAgentListeners()` 中新增 `stopUninstallProgressListener` 注册：监听 `acpAgentsApi.onUninstallProgress`，将 progress 按 `agentId` 写入 `uninstallProgress.value`。
- [x] 6.4 在 store 中新增并导出 `uninstallAgent(agentId: string): Promise<void>`：调用 `acpAgentsApi.uninstall(agentId)`；失败时把 `uninstallProgress[agentId] = { agentId, status: "error", message: response.error.message }`；成功后 `await refreshStatus()`，并设置 `uninstallProgress[agentId] = { agentId, status: "done" }`。
- [x] 6.5 在 store `return` 对象中暴露 `uninstallProgress`、`uninstallAgent`。
- [x] 6.6 验收：`grep "uninstallAgent" frontend/src/stores/acp-agents.ts` 命中导出与实现；`pnpm typecheck` 通过。

## 7. UI：AgentCard 卸载按钮与确认对话框

- [x] 7.1 在 `frontend/src/components/settings/AgentCard.vue` 的 `<script setup>` 中：新增 `defineEmits` 项 `uninstall: [agentId: string]`；新增 `const showUninstallModal = ref(false)`；新增 computed `uninstallCommandLabel`、`uninstallCommandText`、`uninstallLeadText`、`uninstallFootnote`、`uninstallButtonLabel`、`uninstallButtonColor`，按 `props.agentStatus.managedBy × props.agentStatus.installMethod` 派生（如 design.md 第 4 节文案矩阵）。`installMethod` 来源：`agentStatus.installMethod` 或派生自 `agent.distribution`（npx 优先，uvx 次之，否则 binary）。`<package>` 取自 `agent.distribution.npx?.package` 或 `agent.distribution.uvx?.package`。
- [x] 7.2 在 AgentCard.vue 的 `<script setup>` 中新增方法 `function requestUninstall(): void { showUninstallModal.value = true }` 与 `function confirmUninstall(): void { showUninstallModal.value = false; emit("uninstall", props.agent.id) }`。
- [x] 7.3 在 AgentCard.vue 模板中：在 `canUpdate === true` 分支与 `agentStatus?.installed === true` 分支中追加一个 `UButton`：`size="xs"`、`variant="ghost"`、`color="neutral"`、`icon="i-lucide-trash-2"`、`:disabled="actionDisabled"`、`title` 在禁用时为"其他 Agent 正在处理中"，文案"卸载"，`@click="requestUninstall"`。已安装且无更新时，按钮在"已安装"徽章下方；可更新时，在"更新"按钮右侧。
- [x] 7.4 在 AgentCard.vue 模板尾部新增 `<UModal v-model:open="showUninstallModal">`，结构参照现有 `showTakeoverModal`：警告图标 + `<h3>` 标题为 `"卸载 " + agent.name + "？"` + 段落 `uninstallLeadText` + 命令展示 `<div class="flex items-center gap-2 mt-3"><span class="text-muted">{{ uninstallCommandLabel }}</span><code class="px-2 py-1 border rounded-md bg-muted text-sm font-mono">{{ uninstallCommandText }}</code></div>` + `<p class="text-xs text-muted mt-3">{{ uninstallFootnote }}</p>` + 底部按钮组：取消（ghost neutral）+ 主按钮（颜色 `uninstallButtonColor`，文案 `uninstallButtonLabel`）触发 `confirmUninstall`。
- [x] 7.5 binary 的 `<userData>/acp/bin/<agent.id>` 路径展示需要真实 userData 路径。新增（或复用）IPC 暴露 `app:getUserDataPath`：在 `electron/main/ipc/` 找到合适的 channel 文件（若无现成则在 `electron/main/ipc/acp-agents.ts` 中新增 `acp:getUserDataPath` 通道返回 `app.getPath("userData")`），preload + store 同步暴露。AgentCard 在 `onMounted` 时拉取并缓存到一个 store 字段，模板中拼接 `${userDataPath}/acp/bin/${agent.id}`。验收：binary 卸载弹窗中展示的路径与主进程实际删除的目录字符串完全一致。
- [x] 7.6 在 `frontend/src/components/settings/SettingsAgents.vue` 模板的 `<AgentCard>` 上新增监听 `@uninstall="store.uninstallAgent"`。
- [x] 7.7 在 SettingsAgents.vue 中扩展 `currentInstallAgentId` 计算逻辑：把"正在卸载中"也并入"全局繁忙"判断——新增 `currentMutatingAgentId` computed，覆盖 `installProgress` 与 `uninstallProgress`，传给 AgentCard 的 `actionDisabled` 与 `isInstalling`（卸载中也使用同一 spinner UI 但消息显示 `uninstallProgress[agentId].message`）。
- [x] 7.8 验收：手动测试三种 distribution × 两种 managedBy 共六种组合的对话框文案与命令展示均符合 spec.md 中"卸载二次确认对话框"的 6 个 Scenario；点击取消不发起 IPC 调用；点击主按钮触发 `acp:uninstall` 并在 spinner 中显示进度。

## 8. 测试

- [x] 8.1 在 `electron/main/services/acp-agent/installer.test.ts`（若不存在则创建）中新增以下用例（mock `runStreamingCommand` 与 `findCommandPath`，使用 `tmp` 目录）：
  - npx 卸载成功：调用退出码 0 → 不抛错
  - npx 卸载失败：退出码非 0 → 抛 `UNINSTALL_FAILED`
  - npx 环境缺失：`findCommandPath` 返回 null → 抛 `ENV_MISSING`
  - uvx 卸载成功 / 失败 / 环境缺失（同上）
  - binary 卸载成功：删除目标目录后断言不存在
  - binary 目标已不存在：`fs.rm force:true` 不抛错
  - binary `agent.id` 含非法字符（如 `"../etc"`）：抛 `INVALID_AGENT_ID`，目标路径未被触碰
  - 并发互斥：在 `installAgent` 进行中调用 `uninstallAgent` 抛 `INSTALL_BUSY`；反向同样
- [x] 8.2 在 `electron/main/services/acp-agent/acp-agent-service.test.ts`（若不存在则创建）中新增：
  - 卸载成功后 `installed.json` 中该 agentId 不存在
  - 卸载成功后 `agent-capabilities.json` 中该 agentId 不存在
  - 卸载失败：`installed.json` 与 `agent-capabilities.json` 均保持原样
  - `installed.json` 中无该 agentId → 抛 `AGENT_NOT_FOUND`
- [x] 8.3 在 `frontend/src/stores/acp-agents.test.ts`（若不存在则创建）中新增 store 用例：
  - `uninstallAgent` 成功路径：`uninstallProgress[agentId].status === "done"`，`refreshStatus` 被调用
  - `uninstallAgent` 失败路径：`uninstallProgress[agentId].status === "error"` 且 message 为 IPC 返回的 message
- [x] 8.4 在 `frontend/src/components/settings/AgentCard.spec.ts`（若不存在则创建）中新增组件用例：
  - 已安装无更新时渲染卸载按钮；未安装时不渲染
  - 点击卸载按钮显示 modal；6 种 (managedBy, installMethod) 组合下，标题、命令展示文本、脚注、主按钮文案与 spec.md 中"卸载二次确认对话框"6 个 Scenario 完全一致（用快照或显式断言）
  - 点击取消关闭 modal 且不 emit `uninstall`
  - 点击确认 emit `uninstall(agentId)`
- [x] 8.5 验收：`pnpm test` 全绿；新增用例覆盖到 spec.md 中所有 ADDED scenario。

## 9. 文档与 guidelines

- [x] 9.1 评估是否需要更新 `guidelines/IPC.md` 与 `guidelines/MainProcess.md`：本次新增 `acp:uninstall` 和共用并发锁的模式与已有 `acp:install` 一致，**不需要**新增条款；但需要在 `guidelines/MainProcess.md` 的"ACP Agent 管理"章节（若存在）补充一行说明"安装/卸载共用 `activeMutationAgentId` 互斥锁"。如果该章节不存在则跳过此任务。
- [x] 9.2 验收：`pnpm lint` 与 `pnpm format --check` 通过；如修改了 markdown 文件，确保使用项目的中文标点风格保持一致。

## 10. 集成验证

- [x] 10.1 启动 `pnpm dev`，在设置页 ACP Agents 标签下完成端到端手动测试：
  - 安装一个 npx 类型 agent → 显示"已安装"与"卸载"按钮
  - 点击卸载 → 弹窗文案匹配"FylloCode 安装的 npx 类型 agent" Scenario → 确认 → 卸载成功 → 列表回到"未安装"
  - 取消按钮：弹窗关闭，状态不变
  - 卸载过程中再次点击其他 agent 的安装/卸载按钮被禁用
  - 卸载 binary 类型 agent，验证 `<userData>/acp/bin/<id>/` 目录被删除（在 macOS 通过 Finder 或 `ls` 验证）
- [x] 10.2 验证 `installed.json` 与 `agent-capabilities.json` 在卸载成功后均移除该 agent 条目；卸载失败（可临时把 npm 命令换错以触发）后两文件保持原样。
- [x] 10.3 任务完成判定：spec.md 中所有 ADDED + MODIFIED scenario 都有对应代码或测试覆盖；`pnpm build` 成功；手动测试 10.1 的所有路径符合预期。
