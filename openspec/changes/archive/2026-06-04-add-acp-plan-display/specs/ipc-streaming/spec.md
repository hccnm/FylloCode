## ADDED Requirements

### Requirement: MessageChunkData 包含 plan_update 分支

`MessageChunkData` 联合类型 SHALL 新增 `plan_update` 分支，用于流式协议在 turn 进行中传递 ACP 执行计划的全量替换。该分支结构 SHALL 为：

```typescript
{ kind: "plan_update"; entries: PlanEntry[] }
```

`PlanEntry` 类型由 `shared/types/chat.ts` 导出（脱 SDK 类型，不依赖 `@agentclientprotocol/sdk` 导入到 shared / preload / renderer），字段为 `content: string`、`priority: "high" | "medium" | "low"`、`status: "pending" | "in_progress" | "completed"`。

`session-event-mapper.toMessageChunk` SHALL 处理 `SessionEvent { type: "plan_update", entries }`，返回 `{ kind: "plan_update", entries }`，让 `chat:stream:message` handler 可以通过 `sink.sendChunk` 透传给 renderer。

所有消费 `MessageChunkData` 的 switch/分支 SHALL 处理 `plan_update` 分支；TypeScript 穷尽检查 SHALL 在编译期发现漏处理。`useUIMessageAssembler.applyChunk` 与现有 `available_commands_update`/`config_options_update` 一样将 `plan_update` 归入"忽略（不组装进 message parts）"的分支。

#### Scenario: 接收 plan_update chunk

- **WHEN** main 进程从 `AcpSession` 收到 `plan_update` 事件，`entries` 含 3 项
- **THEN** 通过 port1 发送 `{ type: "chunk", data: { kind: "plan_update", entries: [<3 项>] } }`
- **AND** preload 层调用 `callbacks.onChunk({ kind: "plan_update", entries })` 回调

#### Scenario: 空数组的 plan_update 仍透传

- **WHEN** `AcpSession` emit `plan_update` 且 `entries.length === 0`
- **THEN** main 仍通过 port1 发送对应 chunk
- **AND** preload 仍触发 `onChunk`

#### Scenario: proposal 流不发送 plan_update

- **WHEN** `proposal:stageStream` 或 `proposal:archive` handler 从其 `AcpSession` 收到 `plan_update`
- **THEN** handler 显式忽略，不调用 `sink.sendChunk`
- **AND** renderer 不会从 proposal 流收到 `plan_update` chunk

#### Scenario: assembler 忽略 plan_update

- **WHEN** `useUIMessageAssembler.applyChunk` 收到 `{ kind: "plan_update", entries }`
- **THEN** 不修改 `messages`，不创建或更新任何 message part
- **AND** TypeScript 穷尽检查通过（`plan_update` 被显式纳入忽略分支）
