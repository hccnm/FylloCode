## MODIFIED Requirements

### Requirement: useSessionStore 维护 draftProbeByAgent 内存态

`frontend/src/stores/session.ts` 的 `useSessionStore` SHALL 暴露：

- 状态：`draftProbeByAgent: Ref<Map<string, DraftProbeState>>`（响应式，pinia ref）
- getter：`activeDraftProbe: ComputedRef<DraftProbeState | null>`，返回 `draftProbeByAgent.value.get(draftAgentId.value)` 或 `null`（当 `draftAgentId.value` 为 `null` 时）
- action：`ensureDraftProbe(agentId: string, projectId: string): Promise<void>`
- action：`closeDraftProbe(agentId: string): Promise<void>`
- action：`setDraftConfigOption(input: { agentId: string; configId: string; type: "select" | "boolean"; value: string | boolean }): Promise<void>`
- action：`applyProbeUpdate(agentId: string, snapshot: ProbeSnapshot | null): void`（由 `chat:probe:update` 监听器调用）
- 启动钩子：`subscribeProbeUpdates(): () => void`，在 `App.vue` 初始化阶段调用一次，返回 unsubscribe（卸载时调用）

`DraftProbeState` 类型定义为：

```ts
type DraftProbeStatus = "starting" | "ready" | "failed";

interface DraftProbeState {
  agentId: string;
  status: DraftProbeStatus;
  acpSessionId: string | null;
  configOptions: AcpSessionConfigOption[];
  availableCommands: AcpAvailableCommand[];
  error?: { code: string; message: string };
}
```

`availableCommands` 字段 SHALL 与 `configOptions` 并列，类型为 `@shared/types/chat` 导出的 `AcpAvailableCommand[]`。`setDraftProbe(agentId, snapshot)`（内部写入 `draftProbeByAgent` 的方法）SHALL 把 `snapshot.availableCommands` 一并映射到 `DraftProbeState.availableCommands`；occupied 占位（`status === "starting"`）与失败（`status === "failed"`）entry 的 `availableCommands` SHALL 为空数组 `[]`。

`ensureDraftProbe(agentId, projectId)` 行为：

1. 调用 `chatApi.probeEnsure({ agentId, projectId })`。
2. 成功：把响应快照写入 `draftProbeByAgent.value.set(agentId, snapshot)`（含 `availableCommands`）。
3. 失败：写入 `{ status: "failed", error, availableCommands: [] }` 占位条目。
4. 不抛错；UI 通过 `activeDraftProbe.value.status` 决定渲染。

`closeDraftProbe(agentId)` 行为：

1. **立即** `draftProbeByAgent.value.delete(agentId)`（同步执行，UI 在下一 tick 反应）。
2. 异步调用 `chatApi.probeClose({ agentId })`，结果忽略（成功失败均不重写本地状态）。

`setDraftConfigOption({ agentId, configId, type, value })` 行为（与 `chat.setConfigOption` 对称的乐观更新逻辑）：

1. 找到 `draftProbeByAgent.value.get(agentId)` 的 `configOptions` 中 `id === configId` 的项，记录 `previousValue`。
2. 立即把 `currentValue` 更新为目标 `value`（乐观更新）。
3. 通过 `useChatStore` 的 `markConfigOptionPending(configId)` 标记 pending（复用现有 pendingConfigIds Set，不引入新结构）。
4. 调 `chatApi.probeSetConfigOption({ agentId, configId, type, value })`：
   - 成功：把响应 `configOptions` 替换到当前 entry。
   - 失败：把 `currentValue` 回滚为 `previousValue`；用 `useToast()` 提示错误。
5. `finally` 调 `clearConfigOptionPending(configId)`。

`applyProbeUpdate(agentId, snapshot)` 行为：

- `snapshot === null` SHALL `draftProbeByAgent.value.delete(agentId)`。
- 否则 SHALL `draftProbeByAgent.value.set(agentId, snapshot)`（含 `availableCommands`）。

`subscribeProbeUpdates()` 行为：

- 注册 `chatApi.onProbeUpdate(handler)`，handler 内部调 `applyProbeUpdate`。
- 同时监听 `useAcpAgentsStore` 的 `agentUnavailable` 事件，对应 agentId 调 `applyProbeUpdate(agentId, null)`。
- 返回 unsubscribe，撤销 IPC 监听与事件监听。

#### Scenario: ensureDraftProbe 写入 ready snapshot

- **WHEN** 调用 `ensureDraftProbe("claude-code", projectId)`，IPC 返回 `{ ok: true, data: { status: "ready", acpSessionId: "sess-A", configOptions: [...], availableCommands: [...] } }`
- **THEN** `draftProbeByAgent.value.get("claude-code")` 存在
- **AND** 该 entry 的 `acpSessionId === "sess-A"`，`configOptions` 与 `availableCommands` 与响应一致

#### Scenario: closeDraftProbe 立即清空本地态

- **WHEN** `draftProbeByAgent` 中存在 `claude-code` 的 entry，调用 `closeDraftProbe("claude-code")`
- **THEN** 同步调用结束后 `draftProbeByAgent.value.has("claude-code") === false`
- **AND** UI 在下一 tick 不再渲染 claude-code 的 configOptions

#### Scenario: probe 异步推送命令后 draftProbe 更新

- **WHEN** `draftProbeByAgent` 中已有 claude-code 的 ready entry（`availableCommands === []`）
- **AND** renderer 通过 `chatApi.onProbeUpdate` 收到 `{ agentId: "claude-code", snapshot: { status: "ready", acpSessionId: "sess-A", configOptions: [...], availableCommands: [{ name: "init", ... }] } }`
- **THEN** `applyProbeUpdate` 把该 snapshot 写入 `draftProbeByAgent`
- **AND** `activeDraftProbe.value.availableCommands` 变为 `[{ name: "init", ... }]`

### Requirement: chat store sendMessage 在草稿态首条消息携带 probe acpSessionId

`frontend/src/stores/chat.ts` 的 `sendMessage(parts)` SHALL 在草稿态创建 fyllo session 后、调用 `streamSessionMessage` 之前，根据 `useSessionStore().activeDraftProbe` 决定是否携带 `acpSessionId`：

1. 拿到草稿态对应的 `draftAgentIdSnapshot`（与 `createSession` 入参一致）。
2. 读取 `useSessionStore().draftProbeByAgent.get(draftAgentIdSnapshot)` 得到 `probeBeforeCreate`。
3. 当 `probeBeforeCreate?.status === "ready" && probeBeforeCreate.acpSessionId` 时，构造 `carryProbe = { configOptions: <深拷贝 probeBeforeCreate.configOptions>, availableCommands: <深拷贝 probeBeforeCreate.availableCommands>, acpSessionId: probeBeforeCreate.acpSessionId }`，并把 `configOptions`、`availableCommands`、不传则省略的方式一并传入 `createSession`（见 chat-session-probe 的 `chat:createSession` 入参 requirement）。
4. 调 `streamSessionMessage(activeSession, projectId, parts, sessionStore, streamRunId, options)`，其中 `options.acpSessionId` 仅当 `carryProbe` 存在时传入。
5. **不要在 `streamSessionMessage` 启动后再读 probe**——`createSession` 与 stream 之间存在异步窗口，必须使用 `probeBeforeCreate` 的快照。
6. **必须**在写入 `chatApi.streamMessage(...)` 之前**同步**调用 `useSessionStore().applyProbeUpdate(draftAgentIdSnapshot, null)` 清空对应 draftProbe 内存态——主进程 handler 会 `takeFor` consume，renderer 不应再认为它存在。

`streamSessionMessage` 函数签名 SHALL 改为：

```ts
function streamSessionMessage(
  activeSession: Session,
  projectId: string,
  parts: ChatPromptPart[],
  sessionStore: ReturnType<typeof useSessionStore>,
  streamRunId: number,
  options: { acpSessionId?: string }
): void;
```

`chatApi.streamMessage(...)` 调用 SHALL 把 `options.acpSessionId` 透传到第六个参数。

#### Scenario: 草稿态发首条消息，probe 已 ready

- **WHEN** 草稿态 `draftAgentId === "claude-code"`，`draftProbeByAgent` 中 claude-code entry `status === "ready", acpSessionId === "sess-A", availableCommands === [{ name: "init", ... }]`
- **AND** 用户调 `sendMessage([{ type: "text", text: "hi" }])`
- **THEN** chat store 调 `createSession({ ..., configOptions, availableCommands: [{ name: "init", ... }], acpSessionId: "sess-A" })` 创建 fyllo session
- **AND** 调 `chatApi.streamMessage(..., { acpSessionId: "sess-A" })`
- **AND** 同步调 `applyProbeUpdate("claude-code", null)`，`draftProbeByAgent` 移除 claude-code entry
- **AND** 新建 session 的 `availableCommands` 自创建响应带回，slash 入口在首条消息发出后即可基于 `activeSession.availableCommands` 渲染

#### Scenario: 草稿态发首条消息，probe 失败或未就绪

- **WHEN** 草稿态 `draftAgentId === "claude-code"`，`draftProbeByAgent` 中 claude-code entry `status === "failed"` 或 `status === "starting"` 或不存在
- **AND** 用户调 `sendMessage([...])`
- **THEN** chat store 调 `chatApi.streamMessage(...)` 不带 `acpSessionId`，`createSession` 不带 `availableCommands`
- **AND** SHALL NOT 调 `applyProbeUpdate(..., null)`（保留 failed/starting 态供后续重试或 UI 显示）

#### Scenario: 已建立 session 发消息不读 draftProbe

- **WHEN** `activeSessionId !== null`，用户发消息
- **THEN** chat store 调 `streamSessionMessage` 不传 `acpSessionId`
- **AND** SHALL NOT 读 `draftProbeByAgent`

### Requirement: ChatContainer 集成 slash 命令菜单

系统 SHALL 在 chat prompt 输入区（当前实现位于 `frontend/src/components/chat/prompt/ChatPromptPanel.vue`，历史 spec 文本指向 `ChatContainer.vue`，以实际承载 `UChatPrompt#footer` 的组件为准）的 `UChatPrompt` 组件内集成 slash 命令菜单，并在 footer 左侧渲染一个 slash 触发按钮，用于发现与使用当前 agent 声明的可用命令。

slash 命令的数据源 SHALL 为「双源回退」计算属性，与 `ConfigOptionsBar.vue` 的 `sourceOptions` 模式一致：

```ts
const availableCommands = computed<AcpAvailableCommand[]>(() => {
  if (activeSession.value) {
    return activeSession.value.availableCommands ?? [];
  }
  return activeDraftProbe.value?.status === "ready" ? activeDraftProbe.value.availableCommands : [];
});
```

即：存在 `activeSession` 时读 `activeSession.availableCommands`；草稿态（`activeSession` 为 `null`）时回退读 `activeDraftProbe`（ready 时取其 `availableCommands`，否则空数组）。这是 slash command 在「首条消息发送前」即可用的关键——草稿期 probe 抓到的命令通过此回退路径暴露给 slash 菜单。

具体要求：

- **按钮可见性**：在 `UChatPrompt` 的 footer 左侧渲染一个 slash 按钮，图标为 `i-lucide-slash-square`，可见条件 SHALL 改为基于上述 `availableCommands` 计算属性：`v-if="availableCommands.length > 0"`。`availableCommands` 为空数组时按钮不渲染。

- **按钮组件**：统一使用 `UButton variant="ghost" size="sm"` 包裹 `UIcon name="i-lucide-slash-square"`；不使用 `USlot` / `UChip` 等其他组件。

- **菜单组件**：点击按钮打开命令菜单。首选 `@nuxt/ui` 的 `UCommandPalette`（支持搜索、键盘导航、回车选中、ESC 关闭）；若其与 `UChatPrompt` 内嵌布局冲突，降级为 `UPopover` + `UListbox` + `UInput` 的组合，保持键盘导航 / 回车选中 / ESC 关闭 / 鼠标点击选中四项能力。菜单项展示两行：
  - 主文本：`/<command.name>`
  - 副文本：`<command.description>`

- **菜单交互**：SHALL 支持键盘上下方向键导航、回车选中、ESC 关闭；支持鼠标点击选中。菜单打开时焦点落在菜单搜索输入或首个选项；菜单关闭后焦点回到输入框当前位置。

- **`/` 键触发条件**：当用户在输入框按下 `/` 键、输入框聚焦、且光标处于"行首"（定义见下）、且 `availableCommands.length > 0`（读上述计算属性，覆盖草稿态）时，菜单 SHALL 在下一个 tick 打开。

  **"行首"定义**：设 `text = textarea.value`、`cursor = textarea.selectionStart`，令 `prefix = text.slice(0, cursor)`；若 `prefix` 不包含 `\n`，则其中仅有空白字符（空格或 tab）或为空串时视为行首；若 `prefix` 包含 `\n`，则取最后一个 `\n` 之后到 cursor 之间的子串，该子串仅有空白字符或为空串时视为行首。此定义支持多行输入的第二行起继续唤起菜单。

- **`/` 键不阻止默认**：keydown handler SHALL NOT 调用 `event.preventDefault()`。浏览器会把 `/` 写入 textarea，菜单在 input/keyup 后打开；当用户随后选中命令时，组件负责替换该 `/`（见插入规则）。当用户按 ESC 或点外侧关闭菜单且未选择命令时，已写入的 `/` 保留在输入框中（由用户决定是否删除）。

- **插入规则**：选中命令后：
  - 若菜单由 `/` 键触发（由组件内部状态标记），组件需找到当前光标位置向左的第一个 `/` 字符（保证它就是触发菜单那一个），将其替换为 `/<name> `（末尾含一个 ASCII 空格）。若因用户在菜单打开后继续输入删除了该 `/`，则降级为"在当前光标位置插入 `/<name> `"。
  - 若菜单由按钮点击触发，直接在当前光标位置插入 `/<name> `；若光标位置左侧最末非空白字符恰为非空格（例如 `hello`），插入前 SHALL 自动补一个空格，即实际插入 `/<name>`；否则直接插入 `/<name> `。
  - 插入完成后光标置于新末尾，焦点回到输入框，菜单关闭。

- **Hint placeholder 行为**：选中命令后若 `command.hint` 为非空字符串，组件 SHALL：
  1. 记录基准值 `baseline = textarea.value`（即命令插入完成后的值）；
  2. 将 `UChatPrompt` 的 `placeholder` prop 临时覆盖为 `command.hint`；
  3. 监听 textarea 的 `input` 事件：当 `textarea.value !== baseline` 时恢复默认 `placeholder`，取消监听；
  4. 监听 textarea 的 `blur` 事件：一旦触发恢复默认 `placeholder`，取消监听；
  5. 若再次选中另一个带 hint 的命令，新 hint 覆盖旧 hint，基准值更新。
     若 `command.hint` 为 `undefined` 或空串，不修改 placeholder，也不监听 input / blur。

- **菜单关闭状态管理**：菜单关闭不清空输入框当前内容；菜单重开时重置搜索词为空、焦点回到第一项。

- **空态隐藏**：当上述 `availableCommands` 计算属性为空数组时，按钮不渲染；`/` 键 keydown handler SHALL 读取最新 `availableCommands.length`，发现不满足条件时直接返回（不打开菜单），让 `/` 按普通字符输入；不需要 preventDefault。

#### Scenario: agent 推送命令后按钮出现

- **WHEN** 用户处于某 session，`activeSession.availableCommands` 从 `undefined` 变为 `[{ name: "review", ... }]`
- **THEN** `UChatPrompt` footer 左侧出现 slash 触发按钮
- **AND** 按钮点击可打开菜单，展示 "/review" 与其 description

#### Scenario: 草稿态 probe 抓到命令后按钮出现

- **WHEN** `activeSession` 为 `null`（草稿态），`activeDraftProbe.value.status === "ready"`，其 `availableCommands` 为 `[{ name: "init", description: "..." }]`
- **THEN** slash 触发按钮在首条消息发送前即渲染
- **AND** 输入框聚焦、内容为空时按 `/` 可打开菜单，展示 "/init" 与其 description

#### Scenario: 草稿态 probe 未就绪时按钮隐藏

- **WHEN** `activeSession` 为 `null`，`activeDraftProbe` 为 `null` 或 `status !== "ready"`
- **THEN** slash 按钮不渲染
- **AND** 按 `/` 不打开菜单，按普通字符输入

## ADDED Requirements

### Requirement: SlashCommandMenu 触发按钮具备与 ConfigOptionsBar 一致的划入动画

`frontend/src/components/chat/prompt/SlashCommandMenu.vue` 的触发按钮（`UPopover` 内 `#default` slot 中 `v-if="hasAvailableCommands"` 的 `UButton`）SHALL 在出现 / 消失时应用与 `ConfigOptionsBar.vue` 完全一致的 Vue `<Transition>` 过渡，使得命令从无到有（含草稿态 probe 异步抓到命令、或 agent 在会话中推送命令）时按钮以淡入+上移方式划入，而非瞬时出现。

过渡 SHALL 使用与 `ConfigOptionsBar.vue` 相同的类名常量：

- `enter-active-class="transition duration-150 ease-out"`
- `enter-from-class="opacity-0 translate-y-1"`
- `enter-to-class="opacity-100 translate-y-0"`
- `leave-active-class="transition duration-150 ease-out"`
- `leave-from-class="opacity-100 translate-y-0"`
- `leave-to-class="opacity-0 translate-y-1"`

实现约束：

- `<Transition>` SHALL 包裹触发按钮本身，按 `hasAvailableCommands` 控制其 `v-if`，保持「无命令不渲染按钮」的既有空态语义不变。
- 包裹后 SHALL 验证 `UPopover` 仍以该按钮为锚点正确定位（`:portal="false"`、`side: 'top'`、`align: 'start'`），过渡不得导致弹层定位漂移或在按钮卸载时报错。
- 过渡仅作用于触发按钮的出现 / 消失；SHALL NOT 改变 `UCommandPalette` 弹层自身的打开 / 关闭行为与既有交互（搜索、键盘导航、选中、ESC 关闭）。

#### Scenario: 命令从无到有时按钮划入

- **WHEN** slash 触发按钮原本不渲染（`hasAvailableCommands === false`），随后 `commands` 变为非空数组（例如草稿态 probe 异步抓到命令并经 `activeDraftProbe` 回填）
- **THEN** 按钮以 `opacity-0 translate-y-1` → `opacity-100 translate-y-0`、`duration-150 ease-out` 的过渡划入
- **AND** 过渡视觉与同区域 `ConfigOptionsBar` 的划入一致

#### Scenario: 命令清空时按钮划出

- **WHEN** slash 触发按钮正在显示，随后 `commands` 变为空数组（例如切换到无命令的 agent / session）
- **THEN** 按钮以 `opacity-100 translate-y-0` → `opacity-0 translate-y-1` 的过渡淡出后卸载
- **AND** `UPopover` 不因按钮卸载报错
