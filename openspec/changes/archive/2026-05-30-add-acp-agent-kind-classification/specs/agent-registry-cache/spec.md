## ADDED Requirements

### Requirement: Registry 数据出口注入 FylloCode 元数据

主进程 `electron/main/infra/storage/acp-registry-cache.ts` 中暴露的 registry 数据出口 `getRegistry()` 与 `refreshRegistry()` SHALL 在返回前对 `data.agents` 每个条目注入 `__fyllo.kind`，值由 FylloCode 内置 `AgentKindMap` 解析得到。注入 SHALL 是**纯函数式**的不可变映射，不修改入参，不产生副作用，不写入磁盘缓存。

#### Scenario: getRegistry 出口注入分类

- **WHEN** 任意主进程模块调用 `getRegistry()`
- **THEN** 返回值 `AcpRegistry.agents` 中每个 entry SHALL 携带 `__fyllo: { kind }`，且 `kind` 与 `resolveAgentKind(entry.id)` 一致

#### Scenario: refreshRegistry 出口注入分类

- **WHEN** 主进程调用 `refreshRegistry()`
- **THEN** 返回值 `AcpRegistry.agents` 中每个 entry SHALL 携带 `__fyllo: { kind }`，且 `kind` 与 `resolveAgentKind(entry.id)` 一致

#### Scenario: 磁盘缓存保持上游原始数据

- **WHEN** 主进程刷新 registry 并通过 `writeRegistryCache` 写入 `registry-cache.json`
- **THEN** 文件中的 `data.agents` 条目 SHALL **不**包含 `__fyllo` 字段
- **AND** 旧版本写入的、不含 `__fyllo` 的缓存文件 SHALL 仍可被 `readRegistryCache` 正常读取

#### Scenario: 分类映射变更立即生效

- **WHEN** FylloCode 升级后 `AgentKindMap` 内容发生变化（例如新增 bridge 条目）
- **THEN** 下一次 `getRegistry()` 调用即可返回新的分类
- **AND** 不需要等待 24h TTL 过期或手动刷新缓存
