## MODIFIED Requirements

### Requirement: 任务面板显示任务来源标识

每张任务卡片 SHALL 显示来源特定的标识，标明任务的来源系统（如“本地”“云效 YX-1024”“example/repo#88”）。标识 SHALL 包含代表来源系统的图标。对于真实云效任务，系统 SHALL 使用 `sourceMeta.key` 渲染来源标识，并 SHALL 复用 `sourceMeta.url` 作为“任务来源”按钮的跳转目标；该 URL 由主进程 `yunxiao-task-adapter` 按 workitem 类型规则构造，而不是由 renderer 自行猜测。

#### Scenario: 显示真实云效任务来源标识与跳转按钮

- **WHEN** 页面显示一条真实云效任务且该任务包含 `sourceMeta.key` 与 `sourceMeta.url`
- **THEN** 卡片显示“云效 <key>”作为来源标识
- **AND** 卡片显示“任务来源”按钮
- **AND** 点击“任务来源”按钮后，系统使用该任务的 `sourceMeta.url` 打开对应云效详情页
