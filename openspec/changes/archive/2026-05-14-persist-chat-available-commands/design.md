## Context

当前 `Session.availableCommands` 已存在于共享类型和前端 session store 中，但规范将它定义为纯内存态：`available_commands_update` 只从 main 透传到 renderer，不写 `SessionMeta`。这导致命令列表只能在当前渲染进程生命周期内保留，重新加载 session 后 slash 菜单无法回显。

现有数据边界是：

- ACP mapper 产出 `SessionEvent { type: "available_commands_update", commands }`，commands 已经过字段过滤，只包含 `name`、`description`、可选 `hint`。
- `chat:stream:message` 当前在 `available_commands_update` 分支直接 `sink.sendChunk(...)`。
- `electron/main/infra/storage/session-store.ts` 负责 session meta JSON 的读写和 normalize。
- `electron/main/services/chat/chat-service.ts#toSession` 将 `SessionMeta` 映射为 renderer 使用的 `Session`。
- renderer 已有 `setSessionAvailableCommands`，流式收到 chunk 时可更新当前会话对象。

## Goals / Non-Goals

**Goals:**

- 在 chat 流收到 `available_commands_update` 时，把 commands 持久化到当前 session meta 的 `available_commands` 字段。
- 从 session meta 构建 `Session` 时，把 `available_commands` 映射为 `availableCommands`，缺失时保持 `undefined`，空数组保持 `[]`。
- renderer 加载 session 后保留 `availableCommands`，切换会话时自然回显 slash 菜单。
- 保持现有 MessagePort chunk 透传行为，确保在线流式过程中 UI 仍即时更新。

**Non-Goals:**

- 不改变 ACP `AvailableCommand` 的字段过滤规则。
- 不改变 proposal apply/archive 流对 `available_commands_update` 的忽略行为。
- 不新增 IPC channel 或错误码。
- 不改变 slash 菜单交互规则。

## Decisions

1. 落盘字段使用 `available_commands`，对外 `Session` 字段继续使用 `availableCommands`。

   这样遵守需求中指定的 meta key，同时保持 renderer 现有类型和组件逻辑不需要改名。`SessionMeta` 类型承载 snake_case 字段，`toSession` 做边界映射。

2. 持久化发生在 `chat:stream:message` 的 `available_commands_update` 分支。

   该分支是 main 进程首次拿到已过滤命令列表的位置，紧邻现有透传行为。实现上应读取当前 meta，存在时写入 `{ ...meta, available_commands: ev.commands, updatedAt: new Date().toISOString() }`；meta 不存在时记录错误或跳过，不应阻断 stream。

3. `session-store` normalize 负责兜底和兼容。

   `normalizeSessionMeta` 应校验 `available_commands` 是否为数组并保留数组；字段缺失或非法时归一为 `undefined`。历史 meta 文件无需迁移，读取后自然返回 `undefined`。

4. renderer normalize 不再排除 `availableCommands`。

   当前 `SerializedSession` 排除了 `availableCommands`，适用于旧的纯内存态。变更后 IPC 返回的 `availableCommands` 应被 `normalizeSession` 原样保留，确保 `loadSessions` 后和切换会话时可回显。

5. 空数组语义必须保留。

   `undefined` 表示尚未收到 agent 声明；`[]` 表示 agent 明确声明无命令。持久化、IPC 映射和 renderer normalize 均不得把 `[]` 转为 `undefined`。

## Risks / Trade-offs

- [Risk] `available_commands_update` 落盘失败会造成重启后回显缺失。→ Mitigation：落盘失败应记录日志但不阻断流式回复；在线 UI 仍通过 chunk 更新。
- [Risk] 更新 `updatedAt` 可能影响 session 列表排序。→ Mitigation：该字段代表 session 级状态更新时间，允许排序刷新；若实现阶段发现产品不希望命令更新改变排序，应在实现前回到 spec 调整。
- [Risk] 旧 meta 中可能存在非法 `available_commands`。→ Mitigation：normalize 时仅接受数组，其余视为 `undefined`。
