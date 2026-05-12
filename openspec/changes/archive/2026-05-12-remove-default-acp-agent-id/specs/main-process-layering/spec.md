# main-process-layering delta

## MODIFIED Requirements

### Requirement: 默认值通过 shared/constants 集中声明

跨模块复用的默认值（默认 session 标题、UI 常量等）SHALL 集中定义在 `shared/constants/` 下对应的文件中，禁止在多处 handler / service 里硬编码相同字符串。

主进程 SHALL NOT 维护系统级 "默认 ACP agentId"。`agentId` 是会话/请求级别的必要参数，必须由调用方在请求边界显式提供。具体地：

- `createSessionInputSchema.agentId` SHALL 为 `z.string().min(1)`（必填），缺失时由 schema validate 阶段抛 `VALIDATION_ERROR`。
- `chat.streamMessage` handler 在 `inputAgentId` 与持久化 `meta.agentId` 都为空时 SHALL 抛 `VALIDATION_ERROR("agentId is required")`，不得回退到任何系统级默认值。
- `proposal.stageStream` handler 在 `stage.agent` 为空时 SHALL 抛 `VALIDATION_ERROR("stage.agent is required for stage ${stageIndex}")`，不得回退到任何系统级默认值。

代码库中 SHALL NOT 存在面向"未指定 agent 时的兜底 agentId"用途的共享常量；具体来说，`shared/constants/agents.ts` 与导出符号 `DEFAULT_ACP_AGENT_ID` SHALL 被移除。

#### Scenario: 不存在系统级默认 agentId 常量

- **WHEN** 在代码库中搜索字符串字面量 `"claude-acp"` 或符号 `DEFAULT_ACP_AGENT_ID`
- **THEN** 在 `shared/`、`electron/`、`frontend/` 的产品代码中均无该字面量或符号引用
- **AND** 文件 `shared/constants/agents.ts` 不存在

#### Scenario: createSession 缺 agentId 直接拒绝

- **WHEN** IPC 调用 `chat.createSession` 时 `input.agentId` 缺失或为空字符串
- **THEN** schema 校验抛 `VALIDATION_ERROR`
- **AND** 不创建任何 SessionMeta

#### Scenario: streamMessage 缺 agentId 直接拒绝

- **WHEN** IPC 调用 `chat.streamMessage` 时 `inputAgentId` 缺失且持久化的 `meta.agentId` 也为空
- **THEN** handler 抛 `VALIDATION_ERROR("agentId is required")`
- **AND** 不创建 `AcpSession` 实例

#### Scenario: stageStream 缺 stage.agent 直接拒绝

- **WHEN** IPC 调用 `proposal.stageStream` 时所选 stage 的 `agent` 字段为空
- **THEN** handler 抛 `VALIDATION_ERROR("stage.agent is required for stage ${stageIndex}")`
- **AND** 不创建 `AcpSession` 实例
