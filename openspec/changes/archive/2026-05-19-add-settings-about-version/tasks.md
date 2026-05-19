## 1. 共享契约与 IPC

- [x] 1.1 修改 `shared/types/channels.ts`，新增 `SettingsChannels.getAppInfo = "settings:getAppInfo"`；同时更新 `shared/types/settings.ts`，定义只读类型 `AppAboutInfo`，包含 `version`、`releaseChannel`、`copyright`、`repositoryUrl`、`feedbackUrl` 字段。验收标准：主进程、preload、渲染层都能直接 import 同一份类型，且不依赖 renderer-only 代码。
- [x] 1.2 新建 `shared/schemas/ipc/settings.ts`，为 settings 域导出 schema，至少包含 `getAppInfo` 的空入参 schema；如果同文件中顺手收敛现有 `get` / `update` handler，也要为它们补齐 typed schema。验收标准：`electron/main/ipc/settings.ts` 中的新 handler 能通过 `validate(...)` 校验，而不是接受未校验输入。
- [x] 1.3 在 `electron/preload/api/settings.ts`、`electron/preload/index.d.ts` 和 `frontend/src/api/settings.ts` 中新增 `getAppInfo()`，返回类型为 `Promise<IpcResponse<AppAboutInfo>>`。验收标准：渲染层代码可以通过 `settingsApi.getAppInfo()` 读取 About 信息，而不需要直接访问 `window.api`。

## 2. 主进程 About 数据源

- [x] 2.1 新建 `electron/main/services/settings/settings-service.ts`，实现 `getAppAboutInfo()` 函数，返回 `app.getVersion()`、固定的 `Preview` 渠道标识、版权文案、仓库地址 `https://github.com/Fioooooooo/FylloCode`，以及反馈地址 `https://github.com/Fioooooooo/FylloCode/issues`。验收标准：About 元数据只有这一处主数据源，且该 service 不引入任何 renderer 依赖。
- [x] 2.2 重构 `electron/main/ipc/settings.ts`，让 `registerSettingsHandlers()` 通过 `wrapHandler + validate` 将新的 `settings:getAppInfo` 请求转发到 `getAppAboutInfo()`，并保持现有 `settings:get`、`settings:update` 注册逻辑不被破坏。验收标准：新 handler 符合 `guidelines/IPC.md` 中定义的 `validate -> call service -> return` 结构。

## 3. 渲染层状态与 About 面板

- [x] 3.1 扩展 `frontend/src/stores/settings.ts`，新增 `aboutInfo`、`aboutInfoLoading`、`aboutInfoError`，以及幂等的 `ensureAboutInfoLoaded()` action；该 action 通过 `settingsApi.getAppInfo()` 拉取数据，并按现有 store 模式建模 loading / error 回收。验收标准：打开 About tab 或多次重新进入 About tab 时，不会触发重复并发请求。
- [x] 3.2 新建 `frontend/src/components/settings/SettingsAbout.vue`，并明确复用 `frontend/src/components/settings/SettingsPreferences.vue` 的页面节奏：顶部标题说明区，下面一个 `UCard`；卡片内部使用 `divide-y divide-default` 拆成四行，按顺序渲染“版本”“版权”“GitHub 首页”“反馈”。验收标准：Apply 阶段不能将 About 做成独立 hero/landing 风格页面，且四行结构在模板层可直接辨认。
- [x] 3.3 在 `frontend/src/components/settings/SettingsAbout.vue` 的版本行中，右侧使用 `UBadge` 展示 `Preview` 渠道，并显示 `v${version}` 文本；版权行展示完整版权文案；GitHub 首页和反馈两行分别提供独立的外链操作按钮或链接。验收标准：用户进入 About 后，第一眼即可识别当前渠道和版本号，且两个外链操作不会合并成一个模糊的“更多信息”入口。
- [x] 3.4 为 `frontend/src/components/settings/SettingsAbout.vue` 的 GitHub 和反馈操作采用外部链接方式打开系统默认浏览器，复用 `electron/main/bootstrap/window.ts` 中现有的 `mainWindow.webContents.setWindowOpenHandler(... shell.openExternal ...)` 机制；不要为此新增 settings 专用“打开链接”IPC。验收标准：点击外链后应用当前路由仍停留在 `/settings`，且新窗口请求被系统浏览器接管。
- [x] 3.5 修改 `frontend/src/pages/settings.vue`，使其识别 `tab=about`，在左侧导航加入 `About`，并在内容区切换到 `SettingsAbout`；同时保持现有 `focus` 查询参数和默认 `Agents` tab 行为不变。验收标准：`/settings?tab=about` 可以直接打开 About tab，tab 切换仍然通过 `router.replace(...)` 驱动。

## 4. 验证

- [x] 4.1 修改 `frontend/src/__tests__/pages/settings.spec.ts`，覆盖 `tab=about` 深链打开和切换到 About 的行为，同时验证 `focus` 这类无关查询参数仍被保留。验收标准：settings 页测试能证明 About 参与了与现有 tab 相同的 query 驱动契约。
- [x] 4.2 新增 `frontend/src/__tests__/components/settings-about.spec.ts`，验证 `SettingsAbout.vue` 会渲染顶部说明区、单个 `UCard`、以及按顺序出现的四行内容（版本、版权、GitHub 首页、反馈）。验收标准：如果模板结构偏离既定四行卡片式布局，测试必须失败。
- [x] 4.3 在 `frontend/src/__tests__/components/settings-about.spec.ts` 或 `frontend/src/__tests__/stores/settings.spec.ts` 中补充数据态测试，验证渲染层会加载 `AppAboutInfo`、正确渲染 `Preview` 标识和版本号、显示两个独立外链入口，并在 IPC 失败时显示错误状态。验收标准：如果组件把版本信息写死、缺少加载/错误态，或把两个链接合并成单一入口，测试必须失败。
- [x] 4.4 在 `frontend/src/__tests__/components/settings-about.spec.ts` 中验证外链元素使用外部打开方式（例如 `target="_blank"` 或等效实现），从而复用主窗口的 `setWindowOpenHandler`；验收标准：测试能证明外链不会以应用内路由跳转方式离开 `/settings`。
- [x] 4.5 新增 `electron/main/__tests__/ipc/settings.spec.ts`，验证 `settings:getAppInfo` handler 返回 `ok: true` 的 `AppAboutInfo` 载荷，并保持标准 `IpcResponse` 包装形态。验收标准：如果 handler 直接抛错、跳过 `wrapHandler`，或遗漏任一必需 About 字段，测试能够捕获该回归。
