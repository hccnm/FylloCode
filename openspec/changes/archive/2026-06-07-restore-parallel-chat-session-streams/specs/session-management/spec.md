## MODIFIED Requirements

### Requirement: Session 条目支持选择和操作

系统 SHALL 高亮当前选中的 session，并在悬停时显示更多操作菜单（重命名、删除）。选择 session 时 SHALL 从磁盘加载该 session 的历史消息；如果该 session 已在内存中加载过消息，则直接显示内存中的最新消息。选择 session SHALL NOT 停止、取消或失效其他 session 的运行中 stream，也 SHALL NOT 阻止其他 session 后台接收后续 stream 回调。

#### Scenario: 选择 session 并加载历史消息

- **WHEN** 用户点击 session 条目
- **THEN** 该 session 以高亮背景被选中，其历史消息从磁盘加载并显示在 Chat 区域
- **AND** 若 session 元数据包含 `tokenUsage`，则恢复该值到 session 对象
- **AND** 若 session 元数据的 `tokenUsage` 包含 `cost`，则恢复 `cost` 到 session 对象

#### Scenario: 已加载消息的 session 不重复加载

- **WHEN** 用户切换到一个已加载过消息的 session
- **THEN** 直接显示已有消息，不重新从磁盘读取
- **AND** 若该 session 在后台 stream 期间已更新内存消息，则显示该内存最新状态

#### Scenario: 切换到其他 session 不停止后台 stream

- **WHEN** session A 的 `status` 为 `running`
- **AND** 用户点击 session B 条目
- **THEN** `activeSessionId` 切换为 session B
- **AND** session A 的运行中 stream 不被取消
- **AND** session A 后续收到的 stream chunk 继续更新 session A 的内存态

#### Scenario: 切回后台完成的 session

- **WHEN** 用户从 session A 切到 session B 后，session A 在后台收到 done 并更新为 `ended`
- **AND** 用户再次点击 session A
- **THEN** Chat 区域显示 session A 在后台接收完成后的内存消息
- **AND** session A 不因已加载而丢失后台接收的 assistant 内容

#### Scenario: Session 更多操作菜单

- **WHEN** 用户悬停在 session 条目上并点击三点菜单
- **THEN** 下拉菜单出现，包含重命名或删除 session 的选项
