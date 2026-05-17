## MODIFIED Requirements

### Requirement: 任务 prompt 格式在不同来源间保持一致

系统 SHALL 使用一致的 prompt 模板，无论任务来源（local、yunxiao、github）。来源特定信息 SHALL 作为上下文包含在同一模板结构中。对于外部任务，当存在 `sourceMeta.url` 时，prompt SHALL 包含来源显示标签与 URL；当 `sourceMeta.url` 为空时，prompt SHALL 仅包含来源显示标签，SHALL NOT 输出空括号或空 URL 占位。

#### Scenario: 外部任务 prompt 带 URL

- **WHEN** 生成一条带有 `sourceMeta.url` 的外部任务 prompt
- **THEN** prompt 的来源行格式为 `**来源**: <sourceDisplay> (<sourceUrl>)`

#### Scenario: 真实云效任务 prompt 无 URL

- **WHEN** 生成一条真实云效任务 prompt，且其 `sourceMeta.url` 为空
- **THEN** prompt 的来源行格式为 `**来源**: <sourceDisplay>`
- **AND** prompt 中不出现空括号
