## Context

当前系统仅在 `done` 事件中传递 `totalTokens`（来自 ACP `result.usage?.outputTokens`），缺少 `inputTokens`。`TokenUsage` 类型已存在但 store 中写死为 mock 数据。`SessionMeta` 不包含 token 用量信息，应用重启后丢失。

更重要的是，ACP 协议会通过 `sessionUpdate === "usage_update"` 事件实时推送 context 消耗变化：

```json
{
  "cost": { "amount": 0.145305, "currency": "USD" },
  "size": 1000000,
  "used": 29017,
  "sessionUpdate": "usage_update"
}
```

当前主进程的 `acp-mapper.ts` 未处理此类型，直接丢弃。

此外，token 消耗是**会话级属性**，当前却维护在 chat store（`stores/chat.ts` 中的 `tokenUsage` ref），导致切换 session 时 token 数据不跟随 session 变化，语义错误。

## Goals / Non-Goals

**Goals:**

- 在输入框 footer 区域以**环形进度条**展示当前 session 的 context 消耗百分比（used / size）
- **Hover 时以 tooltip 展示详细信息**：used、size、剩余量、cost（如有）
- 新增 ACP `usage_update` 事件处理链路，实时推送 context 消耗到渲染进程
- 将 token 消耗从 chat store 迁移到 session store：`Session` 对象承载 `tokenUsage`
- **每收到 `usage_update` 即更新 session 元数据（含 cost，如有）并持久化到磁盘**
- 加载 session 时恢复历史 token 用量

**Non-Goals:**

- 显示预估费用计算逻辑（cost 字段透传展示，不做额外计算）
- 修改 ACP 协议本身（仅消费已有字段）

## Decisions

### 1. 使用 ACP `usage_update` 事件作为 token 消耗数据源

- **Rationale**: ACP 已提供实时 `usage_update` 推送，无需等待 `done` 事件，用户体验更好（流式过程中即可看到消耗变化）
- **Alternative**: 仅在 `done` 时从 `result.usage` 提取 → 延迟显示，且 ACP 可能不返回完整 usage → 拒绝

### 2. `SessionEvent` 新增 `usage_update` 类型：`{ type: "usage_update"; used: number; size: number; cost?: { amount: number; currency: string } }`

- **Rationale**: 与现有事件类型体系一致，通过同一 MessagePort 通道推送；完整透传 ACP 的 `cost`/`size`/`used` 字段
- **Alternative**: 单独 IPC 通道 → 增加复杂度，无收益 → 拒绝

### 3. `MessageChunkData` 新增 `usage_update` kind

- **Rationale**: 渲染进程的流式回调体系（`onChunk`/`onDone`/`onError`）已成熟，复用 `onChunk` 处理 usage 更新最自然
- **Alternative**: 新增 `onUsageUpdate` 回调 → 增加 API 面，无必要 → 拒绝

### 4. token 消耗归属从 chat store 迁移到 session store

- **Rationale**: token 消耗是 session 的属性，不是 chat 操作的状态。当前 chat store 的 `tokenUsage` ref 在切换 session 时不跟随变化，导致显示错误
- **迁移方式**: chat store 移除 `tokenUsage` ref；`Session` 接口新增 `tokenUsage: { used: number; size: number; cost?: { amount: number; currency: string } }`；session store 在 `loadSessions`/`createSession`/`selectSession` 时管理该字段

### 5. UI 采用环形进度条 + Tooltip

- **Rationale**: 环形进度条占用空间小，适合放在输入框 footer 区域；hover 时展示详细信息不占用常驻空间
- **视觉设计**:
  - 环形进度条：内径约 16-20px，stroke-width 约 2-3px
  - 背景色：低对比度灰色轨道
  - 进度色：根据百分比渐变——低（<50%）绿色、中（50-80%）黄色、高（>80%）红色
  - 中心可显示简短百分比数字或仅图标
  - 位置：`UChatPrompt` footer slot 中，Agent 选择器左侧
- **Tooltip 内容**:
  - Context: X / Y tokens (Z%)
  - Remaining: Y - X tokens
  - Cost: $amount USD（如有 cost 字段）

### 6. `SessionMeta` 新增 `tokenUsage: { used: number; size: number; cost?: { amount: number; currency: string } }` 字段

- **Rationale**: 持久化 context 消耗与 ACP 返回的累计费用信息，确保切换 session 或重启应用后 tooltip 仍能展示 cost
- **Migration**: 旧 session 元数据无此字段，加载时默认 `{ used: 0, size: 0 }`；旧 session 元数据无 `cost` 时保持 `cost` 为 `undefined`

### 7. 每收到 `usage_update` 即实时持久化到磁盘

- **Rationale**: 用户要求 usage 信息都记录到 session meta 文件中，确保数据不丢失
- **实现**: `ipc/chat.ts` 的 `usage_update` case 中直接调用 `saveSessionMeta` 更新 `tokenUsage` 为 `{ used, size, cost }`
- **Trade-off**: 增加 I/O 频率，但 usage_update 推送频率通常不高（每轮对话几次），可接受

### 8. `usage_update` 的 `used` 映射为 `used`，`size` 映射为 `size`，`cost` 透传

- **Rationale**: ACP `usage_update` 的字段语义清晰——`used` 是已使用量，`size` 是 context window 容量，`cost` 是费用信息。直接透传，不做转换

## Risks / Trade-offs

- **[Risk]** ACP `usage_update` 推送频率可能较高 → **Mitigation**: 已决定每收到即持久化，与 I/O 开销权衡后接受；如实际频率过高可改为节流（debounce 500ms）
- **[Risk]** `SessionMeta` 结构变更导致旧数据解析问题 → **Mitigation**: `loadSessionMeta` 用 `?.tokenUsage ?? { used: 0, size: 0 }` 兼容旧数据，`cost` 缺失时按可选字段处理
- **[Trade-off]** 每轮 usage_update 都写磁盘增加 I/O → 用户明确要求实时记录，接受此开销
- **[Risk]** `cost` 字段可能不存在或格式变化 → **Mitigation**: `cost` 设为可选字段，不存在时 tooltip 不显示费用行
