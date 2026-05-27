## ADDED Requirements

### Requirement: draftAgentId watcher 响应 projectId 变化

`useSessionStore` 中监听 `effectiveAgentId` 的 watcher SHALL 将依赖项扩展为 `[effectiveAgentId, projectStore.currentProject?.id]` 元组，使得 projectId 从 null 变为有效值时也能触发 probe 发起。

具体行为：

- watcher 依赖 `() => [effectiveAgentId.value, useProjectStore().currentProject?.id ?? null] as const`
- 当 `nextAgentId` 与 `previousAgentId`（元组第一维的旧值）不同时，才触发 `refreshCapabilities` 和 `closeDraftProbe`（避免仅 projectId 变化时误关 probe）
- 当 `isDraft && nextAgentId && projectId` 均满足，且 `draftProbeByAgent.value.has(nextAgentId)` 为 false 时，才发起 `ensureDraftProbe`（防止 agent 切去切回时重复 probe）
- 若 `projectId` 为 null，直接 return，不发起 probe

#### Scenario: 启动后选择项目触发 probe

- **WHEN** 应用启动，`draftAgentId` 已就绪（第一个已安装 agent），但 `projectId` 为 null
- **AND** 用户选择一个项目，`projectId` 从 null 变为有效值
- **THEN** watcher 触发（projectId 维度变化）
- **AND** `ensureDraftProbe(draftAgentId, projectId)` 在 200ms 后被调用
- **AND** probe 就绪后 `ConfigOptionsBar` 正常渲染

#### Scenario: 仅 projectId 变化不触发 refreshCapabilities 和 closeDraftProbe

- **WHEN** `effectiveAgentId` 不变，仅 `projectId` 从 null 变为有效值
- **THEN** `refreshCapabilities` 不被调用（agent 未变）
- **AND** `closeDraftProbe` 不被调用（agent 未变）
- **AND** 仅 `ensureDraftProbe` 在条件满足时被调用

#### Scenario: agent 切去切回不重复 probe

- **WHEN** 草稿态下 `draftAgentId` 从 A 切到 B，再切回 A
- **AND** A 的 probe 已在 `draftProbeByAgent` 中（`has(A) === true`）
- **THEN** 切回 A 时 watcher 不重复调用 `ensureDraftProbe("A", projectId)`
