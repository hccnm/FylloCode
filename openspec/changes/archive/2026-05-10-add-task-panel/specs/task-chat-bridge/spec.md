# task-chat-bridge Specification

## Purpose

定义任务面板与聊天系统之间的衔接契约——点击任务后如何自动生成 prompt、创建会话、路由跳转，以及 prompt 的生成策略。

## Requirements

### Requirement: 任务 prompt 生成包含任务元数据

系统 SHALL 从 `TaskItem` 生成聊天 prompt，包含任务标题、描述和来源信息。prompt SHALL 指示 AI 分析任务，并在适当时通过 OpenSpec proposal 提出实现步骤。

#### Scenario: 从本地任务生成 prompt

- **WHEN** 用户点击标题为"Fix memory leak"、描述为"The parser fails..."的本地任务上的"发起讨论"
- **THEN** 生成的 prompt 包含任务标题、描述，以及分析和创建 proposal 的请求

#### Scenario: 从外部任务生成 prompt

- **WHEN** 用户点击外部任务上的"发起讨论"（未来阶段）
- **THEN** 生成的 prompt 包含外部任务的标题、描述和来源引用

### Requirement: 任务到聊天的流程自动创建新会话

系统 SHALL 使用现有的 `ChatStore.sendMessage()` 机制创建新聊天会话并发送任务 prompt。会话 SHALL 使用当前项目的 draft agent 创建。

#### Scenario: 无活跃会话

- **WHEN** 用户点击"发起讨论"且没有活跃的聊天会话
- **THEN** 调用 `sessionStore.beginDraftSession()` 准备 draft agent
- **AND** `chatStore.sendMessage(prompt)` 使用 draft agent 创建新会话
- **AND** 任务 prompt 作为第一条用户消息发送
- **AND** 用户被导航至 `/chat`

#### Scenario: 存在活跃会话

- **WHEN** 用户点击"发起讨论"且已有活跃的聊天会话
- **THEN** 调用 `sessionStore.beginDraftSession()` 启动一个新的草稿会话
- **AND** `chatStore.sendMessage(prompt)` 在新会话中发送任务 prompt

### Requirement: 任务到聊天的导航发生在消息提交之后

系统 SHALL 在导航至 `/chat` 之前调用 `sendMessage()`，以便流式响应立即开始，聊天页面显示进行中的对话。

#### Scenario: 导航至带流式消息的聊天

- **WHEN** 用户点击"发起讨论"
- **THEN** 调用 `sessionStore.beginDraftSession()`
- **AND** 使用任务 prompt 调用 `sendMessage()`
- **AND** 调用 `router.push('/chat')`
- **AND** 聊天页面将任务 prompt 显示为用户消息，流式响应正在进行中

### Requirement: 任务 prompt 格式在不同来源间保持一致

系统 SHALL 使用一致的 prompt 模板，无论任务来源（local、yunxiao、github）。来源特定信息 SHALL 作为上下文包含在同一模板结构中。

#### Scenario: 本地任务 prompt 格式

- **WHEN** 生成本地任务 prompt
- **THEN** 格式为：

  ```
  请帮我分析并实现这个任务：

  **来源**: 本地
  **标题**: <title>

  **描述**:
  <description>

  请帮我：
  1. 分析这个任务的技术实现方案
  2. 如果合适，创建一个 OpenSpec proposal 来规划实现步骤
  ```

#### Scenario: 外部任务 prompt 格式

- **WHEN** 生成外部任务 prompt（未来阶段）
- **THEN** 格式包含来源派生的显示标签和 URL：

  ```
  请帮我分析并实现这个任务：

  **来源**: <sourceDisplay> (<sourceUrl>)
  **标题**: <title>

  **描述**:
  <description>

  请帮我：
  1. 分析这个任务的技术实现方案
  2. 如果合适，创建一个 OpenSpec proposal 来规划实现步骤
  ```

- **AND** `<sourceDisplay>` 从 `source` 和 `sourceMeta` 派生（例如，yunxiao 有 `key` 时为 `云效 YX-1024`，github 有 `repository` 和 `number` 时为 `example/repo#421`）

### Requirement: 缺失描述不破坏 prompt 生成

系统 SHALL 优雅地处理空或缺失描述的任务，从 prompt 中省略描述部分，而不是包含空内容。

#### Scenario: 无描述的任务

- **WHEN** 用户点击一条无描述的任务上的"发起讨论"
- **THEN** prompt 完全省略"**描述**:"部分
- **AND** prompt 保持连贯且可操作

### Requirement: 聊天会话标题从任务标题派生

系统 SHALL 使用任务标题（截断至合理长度）作为新创建聊天会话的 fallback 标题。

#### Scenario: 从任务获取会话标题

- **WHEN** 从标题为"Fix memory leak in parser"的任务创建聊天会话
- **THEN** 会话标题以"Fix memory leak in parser"开头（如需则截断）
