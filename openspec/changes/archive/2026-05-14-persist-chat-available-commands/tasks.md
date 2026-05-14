## 1. Shared Types And Storage

- [x] 1.1 在 `electron/main/infra/storage/session-store.ts` 的 `SessionMeta` 中新增 `available_commands?: AcpAvailableCommand[]`，从 `@shared/types/chat` 引入类型。
- [x] 1.2 扩展 `normalizeSessionMeta`，仅当 raw `available_commands` 为数组时保留；缺失或非法值归一为 `undefined`，并保持 `[]` 不被折叠。
- [x] 1.3 确认 `saveSessionMeta` 写出的 JSON 使用 `available_commands` 作为落盘 key，不写 `availableCommands`。
- [x] 1.4 为 session-store 增补 round-trip 单测，覆盖有命令、空数组、缺失字段三个场景。

## 2. Main Process Session Mapping

- [x] 2.1 在 `electron/main/services/chat/chat-service.ts#toSession` 中将 `meta.available_commands` 映射为 `Session.availableCommands`。
- [x] 2.2 确认 `listSessions` 返回的 `Session[]` 保留 `availableCommands`，历史 session 缺失字段时返回 `undefined`。
- [x] 2.3 补充 chat-service 或 IPC 层测试，断言 `chat:listSessions` 能返回持久化 commands，且空数组语义保留。

## 3. Chat Stream Persistence

- [x] 3.1 修改 `electron/main/ipc/chat.ts` 的 `available_commands_update` 分支：继续 `sink.sendChunk(toMessageChunk(ev))`，同时更新当前 session meta 的 `available_commands`。
- [x] 3.2 持久化逻辑应读取当前 meta 后覆盖 `available_commands: ev.commands`，并保留既有 `tokenUsage`、`title`、`acpSessionId` 等字段。
- [x] 3.3 `commands: []` 时仍写入空数组；meta 不存在或写入失败时记录日志但不阻断 stream。
- [x] 3.4 更新 `electron/main/__tests__/ipc/chat.spec.ts` 中“available_commands_update 不写 session meta”的测试为“透传并写 session meta”，并补充空数组持久化断言。
- [x] 3.5 检查 `done`、`usage_update`、`session_info_update` 分支保存 meta 时不会丢失已有 `available_commands`。

## 4. Renderer Session Normalization

- [x] 4.1 调整 `frontend/src/stores/session.ts` 的 `SerializedSession` 类型，不再从序列化 session 中排除 `availableCommands`。
- [x] 4.2 确认 `normalizeSession` 保留 IPC 返回的 `availableCommands`，同时保持缺失字段为 `undefined`、空数组为 `[]`。
- [x] 4.3 补充 session store 测试，覆盖 `loadSessions` 后保留 commands、选择 session 后 `activeSession.availableCommands` 回显。

## 5. Validation

- [x] 5.1 运行相关定向测试：`pnpm test -- electron/main/__tests__/infra/storage/session-store.spec.ts electron/main/__tests__/ipc/chat.spec.ts frontend/src/__tests__/stores/session.spec.ts`（按实际测试文件名调整）。
- [x] 5.2 运行 `pnpm typecheck`，确认共享类型、IPC 返回类型和 renderer store 类型一致。
- [x] 5.3 若定向测试文件不存在，创建或更新最贴近现有测试结构的覆盖用例，并记录实际执行命令。
