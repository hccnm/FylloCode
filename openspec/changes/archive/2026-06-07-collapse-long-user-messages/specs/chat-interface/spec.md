## MODIFIED Requirements

### Requirement: Chat 主区域与 Proposal SidePanel 共享 UIMessage 列表组件

系统 SHALL 将 `UIMessageList` 组件通过 `type: "chat" | "side"` prop 标识使用场景，并新增可选 `agentId?: string` prop 用于在 `type="chat"` 时解析 assistant 头像。`ChatContainer.vue` 与 `ProposalApplySidePanel.vue` 的消息列表部分 SHALL 都通过该组件渲染，不再各自编写 `v-for message / v-for part` 的渲染逻辑。

共享组件的必要 props：

- `messages: UIMessage<MessageMeta>[]`
- `status: ChatStatus`
- `type: "chat" | "side"`
- `agentId?: string`（可选，仅在 `type="chat"` 时用于解析 assistant 头像）

组件内部 SHALL 使用 `ai` 包的 `isReasoningUIPart` / `isTextUIPart` / `isToolUIPart` 派发到对应子组件：`UChatMessages` 承载消息容器、`UChatTool` 承载工具调用；assistant text part 与 reasoning part 中的 markdown 文本 SHALL 统一交由项目内统一的 markdown 渲染组件渲染（输入语义为 `content: string` 与 `isStreaming: boolean`），保持与当前 chat 主区域一致的渲染通路。该 markdown 渲染组件的具体实现细节由代码层决定，spec 不绑定具体组件名或第三方库。

`message.role === 'user'` 分支 SHALL 在 text part 之外，通过 `isUserImagePart(part)` 与 `isUserFilePart(part)`（`src/renderer/src/utils/chat-message-parts.ts` 提供）派发：

- `isUserImagePart(part)` 命中 → 渲染图片缩略图卡片（`<img>` 的 `src` SHALL 从 `part.url` 解析；当 `part.url` 为 `file://` URI 时，组件 SHALL 通过 `chatApi.readAttachmentDataUrl(part.url, part.mediaType)` 获取 data URL，并使用返回的 `dataUrl` 作为 `src`；沿用 `AttachmentCard.vue` 图片分支样式）
- `isUserFilePart(part)` 命中 → 渲染文件名片（图标 + `part.filename` + 扩展标签，沿用 `AttachmentCard.vue` 文件分支样式）
- `isTextUIPart(part)` 命中 → 普通 user text 渲染（含 system-reminder 跳过逻辑）；当该 text part 的渲染内容高度超过固定最大高度时，系统 SHALL 默认折叠该 text part，并提供展开/收起控制

普通 user text part 的折叠行为 SHALL 满足：

- 每个可见 text part 独立维护展开状态，同一条 user message 内多个 text part 不得互相影响。
- 默认状态为折叠；折叠态 SHALL 设置固定最大高度并隐藏溢出内容。
- 仅当 text part 内容实际超过折叠最大高度时，才显示展开/收起控制。
- 点击展开控制后，当前 text part SHALL 完整显示；点击收起控制后，当前 text part SHALL 回到折叠态。
- 展开状态 SHALL 只存在于当前渲染实例内，不写入 `UIMessage`、session metadata 或持久化存储。

当 `type="chat"` 且 `agentId` 提供时，assistant 头像 SHALL 显示该 agent 对应的 ACP agent icon（来自 `useAcpAgentsStore.icons`）。若 `agentId` 未提供或对应 icon 不存在，则不显示头像（保持与 `type="side"` 一致的行为）。

渲染端 SHALL 使用 `UIMessage.id` 作为 `v-for :key`；该 id 在流式活跃期间为渲染进程生成的临时 id，在 resume 后为磁盘加载的 id，系统 SHALL NOT 做跨进程 id 匹配。

在 `message.role === 'user'` 的 text part 渲染分支中，系统 SHALL 通过 `isSystemReminderPart(part)` 工具函数识别 system-reminder 内容并**跳过渲染**。识别规则：`part.type === "text"` 且 `part.text` 经过 trim 后以 `<system-reminder>` 开头、以 `</system-reminder>` 结尾。该工具函数位于 `src/renderer/src/utils/system-reminder.ts`，`UIMessageList.vue` 直接调用。类型 `system-reminder` 的 part 仅在磁盘与 `UIMessage.parts` 数据中保留，UI 不展示，也不显示折叠控制。

#### Scenario: Chat 主区域使用共享组件渲染消息列表并显示 agent 头像

- **WHEN** 用户打开 chat 页面
- **THEN** `ChatContainer.vue` 通过 `<UIMessageList :messages :status type="chat" :agentId />` 渲染 `activeSession.messages`
- **AND** assistant 消息的头像显示当前 session 对应 ACP agent 的 icon
- **AND** 渲染结果与当前 chat 消息表现一致（text / tool / reasoning 分派保持现状）

#### Scenario: Proposal SidePanel 使用共享组件保持现有行为

- **WHEN** 用户打开 proposal 详情页，SidePanel 展开
- **THEN** `ProposalApplySidePanel.vue` 通过 `<UIMessageList :messages :status type="side" />` 渲染 `messages`
- **AND** SidePanel 外壳保持现状
- **AND** 消息列表渲染通路与 chat 一致

#### Scenario: user 消息含图片 part

- **WHEN** user 消息的 `parts` 含 `{ type: "file", mediaType: "image/png", url: "file:///tmp/截图 1.png", filename }`
- **THEN** `UIMessageList` 渲染图片缩略图卡片
- **AND** `<img>` 的 `src` 是 `chatApi.readAttachmentDataUrl` 返回的 data URL，而不是未处理的 `file:///tmp/截图 1.png`
- **AND** assistant 消息不渲染任何 file part

#### Scenario: user 消息含文件 part

- **WHEN** user 消息的 `parts` 含 `{ type: "file", mediaType: "application/pdf", url, filename }`
- **THEN** `UIMessageList` 渲染文件名片，包含 PDF 图标、文件名、扩展标签

#### Scenario: user 消息中的 system-reminder part 不在 UI 展示

- **WHEN** user 消息的 `parts` 首位为 system-reminder text part（`part.text` 经 trim 后以 `<system-reminder>` 开头并以 `</system-reminder>` 结尾）
- **THEN** `UIMessageList.vue` 的 `message.role === 'user'` 分支跳过该 part 的渲染
- **AND** 同条 user 消息的其余 part 正常渲染
- **AND** 数据层 `message.parts` 不做修改

#### Scenario: user 消息仅含 system-reminder 时不输出可见文本

- **WHEN** user 消息的 `parts` 全部为 system-reminder text part
- **THEN** 该消息气泡不渲染任何 text 内容
- **AND** 不抛错、不影响其他消息渲染

#### Scenario: user 长文本默认折叠并可展开

- **WHEN** user 消息包含一个普通 text part，且渲染后内容高度超过折叠最大高度
- **THEN** 该 text part 默认以固定最大高度显示并隐藏溢出内容
- **AND** 该 text part 显示展开控制
- **WHEN** 用户点击展开控制
- **THEN** 该 text part 完整显示
- **AND** 控制状态变为收起

#### Scenario: user 短文本不显示折叠控制

- **WHEN** user 消息包含一个普通 text part，且渲染后内容高度未超过折叠最大高度
- **THEN** 该 text part 按现有气泡样式完整显示
- **AND** 不显示展开/收起控制

#### Scenario: 同一 user 消息多个 text part 独立折叠

- **WHEN** user 消息包含两个超过折叠最大高度的普通 text part
- **AND** 用户只展开第一个 text part
- **THEN** 第一个 text part 完整显示
- **AND** 第二个 text part 仍保持折叠态

### Requirement: 附件用户消息渲染图片缩略图与文件名片

系统 SHALL 在 `src/renderer/src/utils/chat-message-parts.ts` 暴露：

```ts
isUserImagePart(part: UIMessage["parts"][number]): boolean
isUserFilePart(part: UIMessage["parts"][number]): boolean
```

判定规则：

- `isUserImagePart`：`part.type === "file" && typeof part.mediaType === "string" && part.mediaType.startsWith("image/")`
- `isUserFilePart`：`part.type === "file" && typeof part.mediaType === "string" && !part.mediaType.startsWith("image/")`

`UIMessageList` 在 `message.role === 'user'` 分支 SHALL 通过这两个 helper 派发：

- `isUserImagePart(part)` → 渲染缩略图卡片（`<img>` 的 `src` SHALL 从 `part.url` 解析；当 `part.url` 为 `file://` URI 时，组件 SHALL 通过 `chatApi.readAttachmentDataUrl(part.url, part.mediaType)` 获取 data URL，并使用返回的 `dataUrl` 作为 `src`；沿用 `AttachmentCard.vue` 风格的图片预览样式）
- `isUserFilePart(part)` → 渲染文件名片（图标 + 文件名 `part.filename` + 扩展标签，沿用 `AttachmentCard.vue` 文件分支样式）
- `isTextUIPart(part)` 与 `isSystemReminderPart(part)` 分支保持现状；普通 user text part 的长文本折叠行为由“Chat 主区域与 Proposal SidePanel 共享 UIMessage 列表组件” requirement 定义

assistant 分支 SHALL NOT 调这两个 helper（assistant 当前不渲染 file part）。

#### Scenario: user 消息含图片 part 渲染缩略图

- **WHEN** 历史 session 加载后，某条 user 消息 `parts` 含 `{ type: "file", mediaType: "image/png", url: "file:///abs/截图 1.png", filename: "截图 1.png" }`
- **THEN** `UIMessageList` 渲染该 part 为图片缩略图
- **AND** `<img>` 的 `src` 是 `chatApi.readAttachmentDataUrl` 返回的 data URL
- **AND** 数据层 `part.url` 仍保持为 `file:///abs/截图 1.png`

#### Scenario: user 消息含非 file URL 图片 part 渲染缩略图

- **WHEN** 某条 user 消息 `parts` 含 `{ type: "file", mediaType: "image/png", url: "data:image/png;base64,abc", filename: "x.png" }`
- **THEN** `UIMessageList` 渲染该 part 为图片缩略图
- **AND** `<img>` 的 `src` 为原始 `data:image/png;base64,abc`

#### Scenario: user 消息含文件 part 渲染名片

- **WHEN** user 消息 `parts` 含 `{ type: "file", mediaType: "application/pdf", url: "file:///abs/doc.pdf", filename: "doc.pdf" }`
- **THEN** 渲染包含文件图标、文件名 "doc.pdf"、扩展标签 "PDF" 的卡片
- **AND** 不展开 PDF 内容预览
