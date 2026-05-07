## 1. Proposal Detail History Entry

- [x] 1.1 在 proposal 详情页和 header 中增加 archived proposal 的“查看运行历史”入口
- [x] 1.2 在主线程的 proposal run 读取链路中增加 archived `changeId` 归一化逻辑，前端继续直接传当前 `changeId`

## 2. SidePanel Feedback

- [x] 2.1 更新 ProposalApplySidePanel，在用户主动打开但没有历史 run 或消息时展示 EmptyState
- [x] 2.2 增加定向测试，覆盖 archived 入口、主线程历史读取归一化和空态展示
