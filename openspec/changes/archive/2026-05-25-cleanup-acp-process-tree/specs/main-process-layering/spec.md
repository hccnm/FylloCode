## MODIFIED Requirements

### Requirement: 长期运行资源通过 lifecycle 注册为 disposable

`bootstrap/lifecycle.ts` SHALL 提供 `registerDisposable(d: Disposable)` 与 `disposeAll()` API。任何在主进程持续存在的资源（子进程池、会话注册中心、定时器、文件监听、registry 刷新 promise）必须注册为 disposable。应用退出时 `app.on("before-quit")` 调用 `disposeAll()` 按逆序释放。

`disposeAll()` 单个 disposable 的总超时 SHALL 为 8 秒（不再是 5 秒），以容纳 ACP 进程池的 graceful close → SIGTERM grace → SIGKILL 三段级联清理。超时后该 disposable 被跳过，剩余 disposable 继续按逆序释放。

#### Scenario: before-quit 有序释放

- **WHEN** 用户执行 Cmd+Q 或 `app.quit()` 触发 `before-quit`
- **THEN** bootstrap 拦截默认行为，按注册逆序 await 每个 disposable 的 `dispose()`
- **AND** 全部完成后或单 disposable 8 秒超时后调用 `app.exit(0)`

#### Scenario: ACP 进程池可释放（释放整棵进程树）

- **WHEN** `disposeAll()` 执行到 acp-process-pool 的 disposable
- **THEN** pool 内每个 entry 先经 `connection.closeSession()`（每个 session 上限 300ms）与 `child.stdin.end()` 触发 graceful 退出，并等待 child `close` 事件（最多 500ms）
- **AND** 在 POSIX 平台（macOS / Linux），随后调用 `process.kill(-child.pid, "SIGTERM")` 对该 entry 所在的 process group 整组发送终止信号，等待 500ms 后若进程仍存在，则调用 `process.kill(-child.pid, "SIGKILL")` 强制终止整组
- **AND** 在 Windows 平台，跳过 SIGTERM/SIGKILL 阶段，改为 `child_process.spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"])` 递归终止整棵子进程树
- **AND** 上述清理完成后，pool 内所有 ACP agent 直接子进程及其派生的 MCP 孙进程 SHALL NOT 在系统进程列表中残留
- **AND** 所有清理动作被 `try/catch` 包裹，单 entry 清理失败仅 `logger.warn` 记录，不阻塞其他 entry 的清理
- **AND** `process.kill` 抛出 `ESRCH`（进程已不存在）SHALL 被视为成功并吞掉

#### Scenario: 退出窗口期不再触发自动重启

- **WHEN** `disposeAll()` 进入 acp-process-pool 的 dispose 流程
- **THEN** 模块内部的 `shuttingDown` 标志被置为 true
- **AND** 即便 child 在退出窗口期触发 `exit` 事件，pool 也 SHALL NOT 启动 backoff 重启逻辑
