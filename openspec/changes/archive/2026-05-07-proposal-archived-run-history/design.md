## Context

Proposal 详情页当前只会在 `proposal.status === "applying"` 时自动恢复 apply run，并且 SidePanel 只有在 `runMeta` 存在时才会渲染。归档后的 proposal 会切换到 `openspec/changes/archive/<date>-<changeId>/` 目录名，而 apply run 仍按原始 `changeId` 存在 `apply-runs/<changeId>/` 下，因此 archived 详情页不能直接按当前 `changeId` 读取历史 run。

## Goals / Non-Goals

**Goals:**

- 在 archived proposal 详情页提供明确的“查看运行历史”入口
- 复用现有 `loadRun` / `loadRunMessages` 能力读取历史日志，不新增 IPC 契约
- 将 archived `changeId` 的归一化逻辑集中在主线程，避免前端依赖目录命名细节
- 当没有历史记录时保留 SidePanel，并展示明确空态

**Non-Goals:**

- 不修改 apply run 的持久化目录结构
- 不新增 archived proposal 的自动打开或自动恢复行为
- 不扩展新的 proposal run IPC channel

## Decisions

1. Archived 运行历史入口放在 proposal 详情页 header。
   理由：这是 archived proposal 唯一稳定的用户进入点，也能复用当前详情页的 SidePanel 布局。
   备选方案：在 markdown 区域增加独立 tab 或自动打开 SidePanel。前者会分散入口，后者会在 archived 页面制造不必要的打断，因此不采用。

2. 前端始终直接传递当前详情页的 `changeId`，主线程在读取 apply run 时统一归一化 archived `changeId`。
   理由：归档目录命名和 apply run 存储键的映射属于存储/IPC 边界问题，放在主线程更稳定，也避免前端耦合 `YYYY-MM-DD-` 前缀规则。
   备选方案：由前端先尝试当前 `changeId`，失败后再推导原始 `changeId`。该方案把归档命名约定泄漏到 renderer，后续命名规则变化时需要同步修改前端，因此不采用。

3. SidePanel 改为允许在“已打开但无 run 数据”时渲染 EmptyState。
   理由：用户点击 archived 入口后需要确定反馈，空态比静默关闭更符合详情页行为预期。
   备选方案：无历史时不打开 SidePanel，仅 toast 提示。该方案会让用户失去上下文，不便理解当前状态，因此不采用。

## Risks / Trade-offs

- [Risk] 主线程归一化逻辑依赖 archived 目录命名约定。 → Mitigation：该约定已由现有 `proposal-ipc` spec 定义，并由主线程集中实现，后续命名变化只需改一处。
- [Risk] “无消息”与“加载失败”都可能表现为面板内容为空。 → Mitigation：保留现有错误日志处理；只有在 API 返回成功但缺少 run/meta/messages 时才展示 EmptyState。
