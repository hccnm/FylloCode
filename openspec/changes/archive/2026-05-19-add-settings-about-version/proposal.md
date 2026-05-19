## Why

FylloCode 已经发布了预览版，但应用内目前没有稳定、明确的位置让用户查看当前运行版本。这会直接增加问题反馈、预览版验收和发布确认时的沟通成本。

## What Changes

- 在 `Settings` 中新增一个 `About` tab，作为全局、非项目作用域的应用信息入口。
- 在 `About` tab 中展示当前应用版本号和预览版渠道标识。
- 在 `About` tab 中展示版权信息。
- 在 `About` tab 中展示 GitHub 首页链接，以及指向仓库 issue tracker 的反馈链接。
- `About` tab 的前端展示沿用现有 `Settings` 页的视觉语言：顶部为标题说明区，主体为单个 `UCard` 信息卡片，卡片内按行展示版本、版权和外链操作。
- 由主进程暴露只读的应用信息载荷，让渲染进程展示打包应用的真实版本元数据，而不是硬编码字符串。

## Capabilities

### New Capabilities

- `settings-about-panel`：在 `Settings` 内提供只读 About 面板，用于展示应用版本、发布渠道、版权信息和项目相关链接。

### Modified Capabilities

- `settings-page`：扩展 Settings 页的 tab 导航，加入 `About` tab，同时保持现有共享 `/settings` 布局和默认 tab 行为不变。

## Impact

- 受影响的 spec：`settings-page`，以及新增的 `settings-about-panel`
- 受影响的主进程 / preload / 渲染进程边界：settings IPC 通道集合、preload API、渲染层 settings API/store、Settings 页 tab 组合逻辑，以及 About 外链的浏览器打开方式
- 可能涉及的代码区域：`shared/types/channels.ts`、`shared/types/settings.ts`、`electron/main/ipc/settings.ts`、`electron/preload/api/settings.ts`、`frontend/src/api/settings.ts`、`frontend/src/stores/settings.ts`、`frontend/src/pages/settings.vue`，以及新的 settings About 组件
