## MODIFIED Requirements

### Requirement: 应用提供统一的非阻塞 bootstrap 入口

系统 SHALL 在前端应用启动后提供统一的 bootstrap 入口，用于执行不阻塞主流程的异步初始化任务。

主进程 SHALL 在 `app.whenReady()` 后、`createMainWindow()` 前完成数据迁移（调用迁移引擎），确保窗口打开前持久化数据已升级到当前版本所需格式。数据迁移 SHALL 在 `syncShellPath()` 之后执行。

#### Scenario: app 挂载后触发 bootstrap

- **WHEN** 前端应用完成 `mount("#app")`
- **THEN** 系统启动 bootstrap runner 执行已注册任务
- **AND** 不等待 bootstrap 完成才渲染主界面

#### Scenario: 主进程启动时执行数据迁移

- **WHEN** 主进程 `app.whenReady()` 触发，`syncShellPath()` 完成后
- **THEN** 主进程 SHALL 调用迁移引擎执行所有未执行的迁移
- **AND** 迁移完成后（无论成功或失败）才调用 `createMainWindow()`
