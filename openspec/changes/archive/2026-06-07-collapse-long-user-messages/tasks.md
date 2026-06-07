## 1. UserMessage 折叠实现

- [x] 1.1 修改 `src/renderer/src/components/chat/message/UserMessage.vue`，为普通 user text part 增加局部展开状态，状态 key 使用 `message.id`、`part.type` 和 `index` 组合，确保同一条消息多个 text part 独立展开/收起。
- [x] 1.2 在 `UserMessage.vue` 的普通 text part 气泡上保留现有样式，并在折叠态增加固定最大高度与 `overflow-hidden`；展开态移除最大高度限制，完整显示 `part.text`。
- [x] 1.3 在 `UserMessage.vue` 中通过 DOM 高度检测判断 text part 是否超过折叠最大高度；仅超过时显示展开/收起控制，短文本不显示控制。
- [x] 1.4 在 `UserMessage.vue` 的展开/收起控制中使用可访问的按钮语义，文案为 `展开` / `收起`，并设置 `aria-expanded`；点击控制只切换当前 text part，不影响图片卡片、文件卡片或其他 text part。
- [x] 1.5 确认 `isSystemReminderPart(part)` 命中的 text part 仍完全跳过渲染，不创建文本气泡、不参与高度检测、不显示展开/收起控制。

## 2. 测试

- [x] 2.1 更新 `test/renderer/src/components/shared/ui-message-list.spec.ts`，增加 user 长文本用例：mock 对应文本元素的 `scrollHeight > clientHeight`，断言默认折叠类或状态存在，并显示 `展开` 控制。
- [x] 2.2 在同一测试文件增加展开/收起交互用例：点击 `展开` 后当前 text part 完整展开并显示 `收起`，再次点击后回到折叠态。
- [x] 2.3 在同一测试文件增加短文本用例：mock `scrollHeight <= clientHeight`，断言不显示 `展开` / `收起` 控制。
- [x] 2.4 在同一测试文件增加多 text part 用例：两个长 text part 同时存在时，只展开第一个，第二个仍保持折叠态。
- [x] 2.5 保持现有 system-reminder、图片附件和文件附件断言通过；如测试 stub 需要支持 `UButton` 或 `button`，只补充最小 stub，不引入真实 overlay 或 Nuxt UI 复杂行为。

## 3. 验证

- [x] 3.1 运行 `pnpm vitest run test/renderer/src/components/shared/ui-message-list.spec.ts`，确认新增和既有消息列表测试通过。
- [x] 3.2 运行 `pnpm vitest run test/renderer/src/**/*.{test,spec}.{ts,vue}`，确认 renderer 组件相关测试无回归。
- [x] 3.3 运行 `pnpm typecheck:web`，确认 Vue/TypeScript 类型检查通过。

## 4. 文档与规范

- [x] 4.1 不更新 `guidelines/RendererProcess.md`：本变更只细化 chat-interface 的业务展示行为，不改变 renderer 分层、目录职责、store/API 访问规则或 UI 通用约束。
