## Context

FylloCode 已经把 `Settings` 作为一个全局入口暴露出来，即使当前没有打开项目，用户仍然可以访问它。现在应用内缺少一个面向用户的稳定位置来展示打包构建元数据，例如当前运行版本。Electron 主进程已经可以通过 `app.getVersion()` 获取版本号，但目前还没有对渲染进程开放这类数据的 API。

## Goals / Non-Goals

**Goals:**

- 增加一个符合常规认知的 `About` 信息面板，而不引入新的顶级路由。
- 确保界面展示的版本号来自主进程中的真实打包应用元数据。
- 将首版范围收紧在版本号、预览版渠道、版权信息、GitHub 首页和反馈链接。
- 明确前端呈现结构和外链交互方式，避免 Apply 阶段在 UI 结构上自行发挥。

**Non-Goals:**

- 自动更新、发布说明、changelog UI 或更新检查
- 完整许可证正文展示或第三方声明浏览器
- 在顶栏或欢迎页重复展示版本号

## Decisions

使用 `Settings` 中的第四个 tab，而不是单独新增一个路由。
理由：`Settings` 已经是应用级配置和信息的统一入口。把 About 放在这里，既符合用户心智，也不需要引入新的导航概念。

通过现有的 `settings` IPC 域暴露应用元数据。
理由：这批数据是只读的、应用级的，并且与现有的全局设置面板语义相邻。相比新建一个 IPC 域，增加一个小型的 `getAppInfo` 方法更直接、改动面更小。

在 `shared/types/settings.ts` 中新增一个专用的共享载荷类型 `AppAboutInfo`。
理由：渲染层、preload 和主进程已经在这里共享 settings 相关类型。增加一个独立类型，可以避免把只读的应用信息错误地塞进 `PreferencesConfig` 这类可编辑偏好数据结构中。

在新的主进程 service 模块 `electron/main/services/settings/settings-service.ts` 中实现应用信息读取逻辑，并让 `electron/main/ipc/settings.ts` 只负责校验和转发。
理由：项目规范要求业务逻辑放在 service 层，而不是直接写在 IPC handler 中。即使首版逻辑只是返回若干常量加上 `app.getVersion()`，放进 service 仍然能保持分层一致，并为后续扩展链接或渠道元数据预留稳定位置。

渲染一个紧凑、只读的 About 面板。
理由：当前需要展示的是信息，不是可交互配置。卡片式只读面板已经足够，也能避免让用户误以为 About 与偏好持久化有关。

About 面板沿用现有 `SettingsPreferences.vue` 的视觉结构，而不是做成独立品牌落地页。
理由：现有 Settings 页面已经形成了“标题说明区 + `UCard` + 行级信息项”的视觉语言。沿用这套结构可以降低实现分歧，并让 About 在现有设置页中看起来是自然延展，而不是另一套页面系统。

About 内容固定为一个标题说明区加一个单独的 `UCard` 信息卡片，卡片内分四行展示。
理由：这样可以把“显示什么”和“如何排列”写成稳定契约。四行分别为：

1. 版本行：左侧显示“版本”和简短说明，右侧显示 `Preview` 的 `UBadge` 与版本号文本（例如 `v0.1.0`）。
2. 版权行：左侧显示“版权”，右侧显示版权文案。
3. GitHub 首页行：左侧显示标题与说明，右侧显示一个打开 GitHub 的操作按钮。
4. 反馈行：左侧显示标题与说明，右侧显示一个打开 issue tracker 的操作按钮。

About 外链通过常规外部链接方式打开系统浏览器，并复用 `electron/main/bootstrap/window.ts` 中现有的 `setWindowOpenHandler(... shell.openExternal ...)` 行为，不新增专门的“打开外链”IPC。
理由：项目已经在窗口层统一处理新窗口跳转到系统浏览器。About 复用这一既有机制即可，既减少 IPC 面扩张，也避免在 settings 域混入与窗口行为强耦合的命令式 API。

将反馈链接映射到 GitHub issue tracker。
理由：`README.md` 已经把仓库作为公开主页暴露出来，而当前没有单独记录其他反馈入口。

## Risks / Trade-offs

[Settings tab 数量增加] -> 缓解方式：将 About 保持为一个轻量的第四个 tab，而不是继续引入嵌套分组或二级页面。

[反馈入口后续可能变化] -> 缓解方式：把 About 使用的链接值收敛到主进程 app-info 载荷中，未来即使更换反馈地址，也不需要在渲染层模板里分散修改。

[预览版与正式版标签可能混淆] -> 缓解方式：在 app-info 载荷中加入显式的 `releaseChannel` 字段，并与语义化版本号一起渲染。

[settings 域当前缺少 schema 覆盖] -> 缓解方式：在本次 change 中补齐 `shared/schemas/ipc/settings.ts`，并让新的 `settings:getAppInfo` handler 即使在空入参场景下也统一经过 `validate`。

[About 展示风格容易被做成另一套页面] -> 缓解方式：在 spec 和 tasks 中明确要求复用现有 Settings 卡片式布局，禁止扩展成独立 hero/landing 式页面。
