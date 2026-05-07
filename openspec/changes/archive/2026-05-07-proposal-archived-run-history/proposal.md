## Why

Proposal 详情页已经在 `applying` 状态下集成了 SidePanel 与运行日志，但 proposal 归档后，用户仍需要从详情页回看这次实施的运行历史。当前 archived 详情页既没有查看入口，也无法在没有运行记录时给出明确反馈。

## What Changes

- 在 archived proposal 详情页增加一个轻量按钮，允许用户手动打开 SidePanel 查看运行历史
- archived proposal 打开运行历史时，前端继续直接传递当前详情页的 `changeId`，由主线程兼容 archived proposal id 与历史 apply run 目录名不一致的情况
- 当未找到 run 元数据或历史消息时，SidePanel 展示 EmptyState，而不是静默不显示面板

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `proposal-detail`: archived proposal 详情页增加运行历史入口，并在没有运行记录时展示空态
- `proposal-ipc`: proposal run 读取接口在主线程归一化 archived `changeId`，兼容历史 apply run 目录

## Impact

- `frontend/src/pages/proposal/[id].vue`
- `frontend/src/components/proposal/ProposalDetailHeader.vue`
- `frontend/src/components/proposal/ProposalApplySidePanel.vue`
- `frontend/src/stores/proposal-run.ts`
- `electron/main/ipc/proposal-apply.ts`
- `electron/main/infra/storage/apply-run-store.ts`
- `electron/main/services/proposal/`
- `frontend/src/__tests__/components/pages/`
- `frontend/src/__tests__/components/proposal/`
- `electron/main/__tests__/`
