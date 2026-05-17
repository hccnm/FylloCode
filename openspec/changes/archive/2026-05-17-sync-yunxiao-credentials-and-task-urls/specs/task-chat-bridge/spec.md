## MODIFIED Requirements

### Requirement: 任务 prompt 格式在不同来源间保持一致

系统 SHALL 使用一致的 prompt 模板，无论任务来源（local、yunxiao、github）。来源特定信息 SHALL 作为上下文包含在同一模板结构中。对于外部任务，当存在 `sourceMeta.url` 时，prompt SHALL 包含来源显示标签与 URL；当 `sourceMeta.url` 为空时，prompt SHALL 仅包含来源显示标签，SHALL NOT 输出空括号或空 URL 占位。对于真实云效任务，只要任务来自 `yunxiao-task-adapter` 的 workitem 映射结果，系统 SHALL 视其为“带 URL 的外部任务”，并在 prompt 来源行中包含构造出的云效详情 URL。

#### Scenario: 外部任务 prompt 带 URL

- **WHEN** 生成一条带有 `sourceMeta.url` 的外部任务 prompt
- **THEN** prompt 的来源行格式为 `**来源**: <sourceDisplay> (<sourceUrl>)`

#### Scenario: 真实云效任务 prompt 包含构造后的来源 URL

- **WHEN** 生成一条真实云效任务 prompt，且该任务的 `sourceMeta` 来自 `yunxiao-task-adapter` 映射结果
- **THEN** prompt 的来源行格式为 `**来源**: 云效 <key> (<sourceUrl>)`
- **AND** `<sourceUrl>` 使用云效任务类型规则构造得到的 `req` / `task` / `bug` URL
- **AND** prompt 中不出现空括号
