# proposal-apply-run delta

## MODIFIED Requirements

### Requirement: Stage 流式执行通过 MessagePort 传输 chunk

系统 SHALL 在收到 `proposal:stageStream` IPC 时，main 进程根据 `stage.type` 构造 prompt，启动 `AcpSession`，通过 `MessageChannelMain` 将 `SessionEvent` chunk 推给 renderer。

prompt 构造规则（策略 Map，按 `stage.type` 分发）：

- `proposal-apply`：`加载 skill fyllo-apply-change，实现 {changeId}`
- 其他 type：抛出错误，code 为 `STAGE_TYPE_NOT_IMPLEMENTED`

`agentId` SHALL 取自 `stages[stageIndex].agent`。若 `stage.agent` 为空（`undefined` / `null` / 空字符串），handler SHALL 抛 `ipcError(IpcErrorCodes.VALIDATION_ERROR, "stage.agent is required for stage ${stageIndex}")`，且 SHALL NOT 创建 `AcpSession`、SHALL NOT 写入任何 stage 文件。系统 SHALL NOT 维护 workflow / 主进程级 "默认 agentId" 兜底。

#### Scenario: 发起 stage stream

- **WHEN** renderer 调用 `proposal:stageStream`，传入 `{ runId, stageIndex, projectId, changeId }`
- **AND** `stages[stageIndex].agent` 为非空字符串
- **THEN** main 进程通过策略 Map 构造 prompt
- **AND** 创建 `AcpSession`，通过 `MessageChannelMain` 将 port2 传给 renderer
- **AND** 等待 renderer 发送 `{ type: "ready" }` 后调用 `session.start(prompt)`
- **AND** 将 `acpSessionId` 记录到 `run.json` 的 `stageAcpSessionIds[stageIndex]`

#### Scenario: Stage 缺少 agent 直接拒绝

- **WHEN** renderer 调用 `proposal:stageStream`，所选 stage 的 `agent` 字段为空
- **THEN** handler 在创建 `AcpSession` 之前抛 `VALIDATION_ERROR`，错误 message 包含 stage 索引信息
- **AND** 不向 `stage-{stageIndex}.messages.jsonl` 写入任何记录
- **AND** 不调用 `sessionRegistry.register`

#### Scenario: 不支持的 stage type

- **WHEN** `stages[stageIndex].type` 不在策略 Map 中
- **THEN** port 发送 `{ type: "error", data: { code: "STAGE_TYPE_NOT_IMPLEMENTED", message: "..." } }`

#### Scenario: 取消 stage stream

- **WHEN** renderer 调用 `proposal:stageStream:cancel`, 传入 `{ runId }`
- **THEN** main 进程调用对应 `AcpSession.cancel()`
- **AND** 从活跃 session Map 中移除该 runId
