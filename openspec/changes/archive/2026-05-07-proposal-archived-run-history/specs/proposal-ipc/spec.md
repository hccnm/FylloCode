## MODIFIED Requirements

### Requirement: Main process provides proposal apply IPC handlers

主进程 SHALL 注册 `proposal:apply`、`proposal:stageStream`、`proposal:stageStream:cancel`、`proposal:loadRun`、`proposal:loadRunMessages` IPC handler。

对于 `proposal:loadRun` 和 `proposal:loadRunMessages`，renderer SHALL 继续传递当前详情页拿到的 `changeId`。主进程在读取 apply run 持久化文件前 SHALL 负责判断该 `changeId` 是否为 archived proposal id；若是，则按归档命名规则解析出原始 `changeId`，并用该值读取 `apply-runs/<originalChangeId>/` 下的 `run.json` 与 `stage-{N}.messages.jsonl`。

#### Scenario: apply 成功

- **WHEN** 渲染进程调用 `proposal:apply`，传入合法的 `projectId`、`changeId`、`workflowId`
- **THEN** 返回 `{ ok: true, data: { runId: string, stages: WorkflowStage[] } }`

#### Scenario: workflow 不存在

- **WHEN** `workflowId` 对应的 workflow 找不到
- **THEN** 返回 `{ ok: false, error: { code: "WORKFLOW_NOT_FOUND", message: "..." } }`

#### Scenario: stageStream 发起成功

- **WHEN** 渲染进程调用 `proposal:stageStream`
- **THEN** main 进程通过 `event.sender.postMessage("proposal:stageStream:port", null, [port2])` 将 port 传给 renderer
- **AND** 等待 renderer 发送 `{ type: "ready" }` 后开始执行

#### Scenario: stageStream 取消

- **WHEN** 渲染进程调用 `proposal:stageStream:cancel`，传入 `{ runId }`
- **THEN** main 进程取消对应 `AcpSession`

#### Scenario: run.json 存在

- **WHEN** 渲染进程调用 `proposal:loadRun`，传入 `{ projectId, changeId }`
- **THEN** 主进程使用归一化后的 apply run 存储 key 读取 run 元数据
- **AND** 返回 `{ ok: true, data: ApplyRunMeta }`

#### Scenario: archived changeId maps to original apply run

- **WHEN** 渲染进程调用 `proposal:loadRun` 或 `proposal:loadRunMessages`，传入带 `YYYY-MM-DD-` 前缀的 archived `changeId`
- **THEN** 主进程识别该 archived proposal id
- **AND** 使用去除归档日期前缀后的原始 `changeId` 读取 `apply-runs/<originalChangeId>/` 下的历史 run 文件

#### Scenario: run.json 不存在

- **WHEN** 归一化后的 `apply-runs/<changeId>/run.json` 文件不存在
- **THEN** 返回 `{ ok: true, data: null }`

#### Scenario: messages 文件存在

- **WHEN** 渲染进程调用 `proposal:loadRunMessages`，传入合法参数
- **THEN** 主进程使用归一化后的 apply run 存储 key 读取消息文件
- **AND** 返回 `{ ok: true, data: UIMessage[] }`（可能为空数组）

#### Scenario: messages 文件不存在

- **WHEN** 归一化后的对应 `stage-{N}.messages.jsonl` 不存在
- **THEN** 返回 `{ ok: true, data: [] }`
