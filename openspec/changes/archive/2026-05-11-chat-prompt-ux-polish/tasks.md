## 1. ChatAgentSelect 隐藏逻辑

- [x] 1.1 在 `ChatContainer.vue` 中将 `<ChatAgentSelect :disabled="isAgentLocked" />` 改为 `<ChatAgentSelect v-if="!isAgentLocked" v-model="agent" />`

## 2. ContextUsageRing token 格式化

- [x] 2.1 在 `ContextUsageRing.vue` 中新增 `formatK(value: number): string` 函数，将数值转为 k 单位（保留一位小数，如 `12.3k`）
- [x] 2.2 将 `tooltipRows` 中 `Context` 和 `Remaining` 的 `formatNumber` 调用替换为 `formatK`

## 3. UChatPromptSubmit stop 支持

- [x] 3.1 在 `chat.ts` store 中，将 `chatApi.streamMessage` 返回的 cancel 函数存入 store 内部 ref（`cancelFn`），并暴露 `cancelStream()` 方法
- [x] 3.2 在 `ChatContainer.vue` 中为 `<UChatPromptSubmit>` 添加 `@stop="store.cancelStream()"` 事件处理
