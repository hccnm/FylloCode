## Context

FylloCode 是纯 prompt 驱动的 harness，自身没有执行能力。所有对用户项目的分析和修改都依赖 agent，且 agent 只能通过文件工具（Read/Edit/Write）操作磁盘，无法直接调用 FylloCode 的 IPC 通道。

当前 `meta.json`（`ProjectMeta`）只存储 id、name、path、createdAt、lastOpenedAt 五个字段，没有任何健康度信息。`meta.json` 路径在 userData 目录（`<userData>/data/projects/<encodedPath>/meta.json`），与用户项目目录完全隔离。AppHeader 中央区域只有 ProjectSelector，右侧只有 Bell 和主题切换按钮。

健康检查的执行路径：FylloCode 提供入口 → 用户确认 → 自动发起新 chat session（预置消息）→ agent 评估 + 给出改进建议 → 用户对齐 → agent 调用 `create-proposal` → apply 阶段 agent 修改用户项目内的工程配置 + 编辑 `meta.json` 写入 `healthScore` → 下次用户点击 icon 时刷新读取最新值。

## Goals / Non-Goals

**Goals:**

- `meta.json` / `ProjectMeta` / `ProjectInfo` 新增 `healthScore: number`（可选，默认 0）
- `ProjectInfo` 新增 `metaPath: string`，向前端暴露 `meta.json` 绝对路径，用于 reminder 注入
- AppHeader 中央区域 ProjectSelector 旁新增健康度 icon，颜色随分值变化
- 点击 icon 弹出 Popover，用户确认后自动发起健康检查 chat session
- 自动发起的 session 预置两条消息：system-reminder（前端隐藏）+ 用户口吻消息
- system-reminder 包含完整评分规范（4+3+3 共 10 维度）+ 工作流 + proposal 输出契约
- 健康检查 session 必须形成"评估 + 改进 + apply"闭环，与 FylloCode 标准 proposal 流程对接

**Non-Goals:**

- FylloCode 自身不做任何项目文件扫描，所有评估由 agent 执行
- 不新增 IPC 通道（agent 通过 Edit/Write 直接修改 `meta.json` 文件，前端通过现有 `project:getById` 重读）
- 不修改 system-reminder-injection 的主进程路径（健康检查 session 的 system-reminder 由前端动态注入）
- 不绑定特定技术栈：维度判定的是"工程能力是否实现"，工具映射由 agent 根据项目栈自行决定
- **本次 change 不解决"约束实际生效"问题**：本 change 只衡量项目对 agent 的硬约束**配置完备度**，不保证这些配置在 apply 阶段一定会被触发。让 lint/test/hook 真正卡住 agent 需要 FylloCode apply 流程引入 quality gate（自动跑 lint/test、强制 commit 触发 hook 等），属于后续 change 范围

## v1 定位与已知局限

本次 change 是健康检查机制的 v1，定位为 **"项目对 agent 的硬约束完备度的可见度 + 配置补齐工具"**：

- **能做到的**：让用户与 agent 都能看到项目缺哪些工程硬约束、引导 agent 走标准 proposal 流程帮用户补齐配置
- **做不到的**：保证这些配置在 apply 阶段一定会被触发并失败时阻断流程

具体来说，v1 不解决以下三类问题，作为已知局限暴露：

1. **配置存在不等于 agent 受约束**：husky pre-commit 仅在 git commit 时触发，apply 阶段如果不 commit 则形同虚设
2. **healthScore 是快照**：用户或 agent 后续删除/弱化某项配置，分数不会自动降级，需重新触发健康检查才能反映现状
3. **判定依赖 agent 自律**：reminder 通过"最佳实践基线 + 反面示例 + 强制附判定理由"压低刷分概率，但不可能完全杜绝

后续可由独立 change 引入 apply 阶段的 quality gate 机制，把"配置存在"升级为"配置真实卡住 agent"。

## Decisions

**决策 1：healthScore 存在 meta.json，不引入新文件**

- 理由：用户明确要求不在用户项目内增加 `.fyllo` 等文件；`meta.json` 在 userData 目录，与用户项目完全隔离
- 备选方案：`.fyllo/governance-state.json` 放在用户项目内 → 被否决

**决策 2：healthScore 由 agent 通过编辑 meta.json 写入，不调用 IPC**

- 背景：agent 在 apply 阶段没有 IPC 调用能力，FylloCode 对 agent 的全部调度通过 prompt 完成
- 实现：前端在 `ProjectInfo` 上暴露 `metaPath`（`meta.json` 绝对路径），通过 system-reminder 注入给 agent；agent 在 apply 阶段使用 Edit/Write 工具编辑该路径，将 `healthScore` 字段设为目标值
- 风险：agent 可能跳过该任务 → 缓解：reminder 中明确要求 tasks.md 必须包含此条收尾任务，且 changeName 命名规则（`health-check-` 前缀）在 archive 时可被识别
- 风险：FylloCode 主进程也会写 meta.json（如 `lastOpenedAt`），与 agent 编辑可能冲突 → 当前不引入文件锁，发生冲突时以最后一次写入为准；考虑到健康检查 apply 与日常项目使用并发概率极低，作为已知风险接受

**决策 3：健康检查 session 的 system-reminder 由前端动态注入，不走 chat.txt 模板**

- 理由：健康检查是一次性的特殊 session，内容与常规 chat reminder 不同；修改 chat.txt 会影响所有 chat session
- 实现：前端在发起新 session 时，将 system-reminder 作为第一条消息（`role: "user"`, `parts[0]` 为 reminder text block）直接写入，复用现有消息结构

**决策 4：颜色映射分三档**

- 0：灰色（未检查）
- 1–59：橙色/黄色（需改善）
- 60–100：绿色（健康）
- 理由：简单直观，避免过度设计

**决策 5：Popover 而非 Modal**

- 理由：操作轻量，不需要全屏打断；UPopover 是 @nuxt/ui 的标准组件

**决策 6：icon 颜色读取时机 — 进入项目时同步读取，点击时并发刷新**

- 进入/切换项目：颜色直接基于 `projectStore.currentProject.healthScore` 响应式渲染，不发额外请求
- 点击 icon：UPopover 同步打开（避免可感知延迟），并发调用 `project:getById` 拉取最新 `ProjectInfo`；成功后写回 store，icon 与 Popover 文案随响应式更新
- 失败兜底：保留 store 中的旧 `healthScore`，Popover 不关闭、不弹 toast、不阻断"开始健康检查"按钮的可用性
- 理由：点击是 UX 反馈优先；agent 通过编辑 `meta.json` 写入 `healthScore` 后，下次点击即可拉到最新值，无需轮询或额外的 watcher
- 实现：在 `project` store 新增 `refreshCurrentProject()` 仅就地合并字段，不走 `setCurrentProject`，避免触发 session 重载等副作用

**决策 7：评分规范固定为三类十维度，写死在 reminder 模板中**

- 类别权重：静态 40 / 测试 30 / 流程 30，每维 10 分
- 维度判定语言无关：问"工程能力是否实现"，工具栈由 agent 自行映射（参见 `health-check-session-bootstrap/spec.md`）
- 判定基线：每维要求达到该生态广泛认可的工程最佳实践基线，而非"配置存在 + 非空"
- 防刷分原则：① 配置存在 ≠ 得分（必须达到最佳实践基线）② 不限定工具与语言 ③ 拿不准就不给分 ④ 已枚举的反面示例（echo ok / 仅 1 条规则 / `|| true` / coverage 阈值为 0 等）自动判 0 分 ⑤ 每个维度的得分必须附判定理由 + 引用配置片段
- 选 reminder 内嵌而非 guidelines 文档：规范本身就是给 agent 的指令，沉淀为 guidelines 反而多绕一层；要演进时改前端常量即可
- Trade-off：演进时需改前端代码 + 重新发版。健康检查规范变化频率低，可接受

**决策 8：健康检查必须形成"评估 + 改进 + apply"闭环，对接标准 proposal 流程**

- agent 不能只评分后停止，必须给出具体改进建议、与用户对齐、调用 `create-proposal`
- changeName 强制以 `health-check-` 开头，便于 archive 阶段识别
- proposal apply 完成后写入目标分数 Y（≥ 当前分 X）
- 即使当前满分（X = 100），仍走 proposal 流程，tasks.md 仅含一条写入 healthScore 的任务，保持流程一致

**决策 9：apply 期间不写中间分数**

- 评估完不立即写 X；apply 全部任务完成后一次写 Y
- 理由：避免中间状态污染，与 FylloCode 整体"提议→应用→完成"节奏一致
- 用户在 icon 上看到的是改进后的分数，不是评估时的临时分

**决策 10：通过主进程 prompt 保证"必须用户认可才 create-proposal"**

- 该规则属于 FylloCode chat 阶段的全局契约，已由主进程在新会话开始时注入 agent 的系统 prompt
- system-reminder 不重复声明此规则，仅在工作流中提及"得到用户认可后再调用 create-proposal"
- 理由：避免规则重复维护，单一来源

**决策 11：reminder 不限定 agent 必须读取的具体配置文件**

- 仅给 10 维度表，由 agent 根据项目实际技术栈自行选择检查路径
- 理由：枚举配置文件会限制 agent 发挥，且无法覆盖所有语言生态；维度本身是语言无关的能力描述，agent 自行映射成本低、覆盖广

## Risks / Trade-offs

- **[风险] agent 写入 healthScore 不稳定** → 缓解：system-reminder 在 proposal 输出契约中明确要求 tasks.md 必含写入任务，且使用绝对路径 + 文件编辑措辞；即使漏写，icon 保持原值，用户可重新触发
- **[风险] 健康检查 session 的 system-reminder 绕过了主进程注入路径** → 可接受：这是前端主动发起的特殊 session，语义上属于"用户发起的带上下文消息"，不是常规 reminder 注入
- **[风险] meta.json 写入与主进程 lastOpenedAt 写入并发冲突** → 概率极低（apply 阶段用户不会同时切换项目），暂不引入锁；以最后一次写入为准
- **[风险] agent 评分主观偏差或刻意刷分** → 缓解：reminder 给出 4+3+3 共 10 维度的最佳实践基线 + 反面示例自动判 0 + 强制附判定理由与配置片段 + 防刷分原则；不同 agent / 不同次评估有偏差但量级可控
- **[风险] reminder 文本变长可能挤占上下文** → 评估：完整 reminder 约 1.5–2k tokens，与现有 chat.txt 量级相当，可接受
