## 1. 类型与契约扩展

- [x] 1.1 扩展 `shared/types/chat.ts`：为 `Session` 接口新增 `tokenUsage: { used: number; size: number; cost?: { amount: number; currency: string } }` 字段；`TokenUsage` 接口保留但标记为废弃或简化
- [x] 1.2 扩展 `electron/main/domain/chat/session-events.ts`：新增 `usage_update` 事件类型 `{ type: "usage_update"; used: number; size: number; cost?: { amount: number; currency: string } }`
- [x] 1.3 扩展 `shared/types/ipc.ts`：`MessageChunkData` 新增 `usage_update` kind：`{ kind: "usage_update"; used: number; size: number; cost?: { amount: number; currency: string } }`
- [x] 1.4 扩展 `electron/main/infra/storage/session-store.ts`：为 `SessionMeta` 接口新增 `tokenUsage: { used: number; size: number; cost?: { amount: number; currency: string } }` 字段

## 2. 主进程 usage_update 事件处理

- [x] 2.1 修改 `electron/main/services/chat/acp-mapper.ts`：在 `switch` 中新增 `case "usage_update"`，映射为 `SessionEvent: { type: "usage_update", used, size, cost }`
- [x] 2.2 修改 `electron/main/services/chat/session-event-mapper.ts`：在 `toMessageChunk` 中新增 `usage_update` case，返回 `MessageChunkData`
- [x] 2.3 修改 `electron/main/ipc/chat.ts`：在 `event` handler 的 `switch` 中新增 `usage_update` case，透传给 sink **并实时更新 `SessionMeta` 的 `tokenUsage`（含 cost，如有）后持久化到磁盘**
- [x] 2.4 修改 `electron/main/ipc/chat.ts`：在 `done` case 中更新 `SessionMeta` 的 `tokenUsage`（累加 `totalTokens` 到 `used`）并持久化到磁盘

## 3. 前端 token 消耗迁移到 session store

- [x] 3.1 修改 `frontend/src/stores/chat.ts`：移除 `tokenUsage` ref 及其相关逻辑；在 `onChunk` 中新增 `usage_update` 处理分支，更新 `activeSession.tokenUsage`
- [x] 3.2 修改 `frontend/src/stores/session.ts`：`Session` 对象新增 `tokenUsage` 字段管理；`loadSessions` 时从 IPC 响应恢复 `tokenUsage`；`createSession` 时初始化为 `{ used: 0, size: 0 }`；`mergeSessionMeta` 同步 `tokenUsage`
- [x] 3.3 修改 `frontend/src/api/chat.ts`：`StreamCallbacks` 的 `onChunk` 类型需支持 `usage_update` kind（通过 `MessageChunkData` 联合类型自动支持）

## 4. 前端 UI 实现

- [x] 4.1 创建 `frontend/src/components/chat/ContextUsageRing.vue`：环形进度条组件
  - Props: `{ used: number; size: number; cost?: { amount: number; currency: string } }`
  - SVG 环形进度条，直径约 20px，stroke-width 约 2.5px
  - 进度色根据百分比渐变：
    - < 50%: `text-success` (绿色)
    - 50% - 80%: `text-warning` (黄色/橙色)
    - > 80%: `text-error` (红色)
  - 中心显示简短百分比数字（如 "29%"）或留空
  - 使用 `@nuxt/ui` 的 `UTooltip` 组件包裹
  - Tooltip 内容：
    - Context: X / Y tokens (Z%)
    - Remaining: Y - X tokens
    - Cost: $amount USD（如有 cost 字段）
- [x] 4.2 修改 `frontend/src/components/chat/ChatContainer.vue`：在 `UChatPrompt` 的 footer slot 中，Agent 选择器左侧插入 `ContextUsageRing`；绑定 `activeSession?.tokenUsage`；草稿态时隐藏

## 5. 测试与验证

- [x] 5.1 运行 `pnpm typecheck` 确保类型检查通过
- [x] 5.2 运行 `pnpm lint` 确保无 lint 错误
- [x] 5.3 运行 `pnpm test` 确保现有测试通过
- [x] 5.4 手动验证：
  - 创建新 session → 发送消息 → 观察输入框 footer 是否显示环形进度条
  - 流式过程中环形进度条是否实时更新
  - hover 时 tooltip 是否正确显示 used/size/remaining/cost
  - 多轮对话后百分比是否正确累加
  - 切换 session 后环形进度条是否显示对应 session 的数据
  - 重启应用后数值是否从 meta 文件恢复
  - 检查 session meta 文件是否包含实时更新的 `tokenUsage` 字段
