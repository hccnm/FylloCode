## 1. 数据层扩展

- [ ] 1.1 修改 `shared/types/project.ts`：`ProjectMeta` 新增 `healthScore?: number`；`ProjectInfo` 新增 `healthScore?: number` 与 `metaPath: string`（必填）
- [ ] 1.2 修改 `electron/main/infra/storage/project-store.ts`：`toProjectInfo` 透传 `meta.healthScore` 并基于 `meta.id` 拼接 `metaPath`（复用文件内已有的 `metaPath(id)` 内部函数语义，导出为 `getProjectMetaPath(id)` 或就地内联）；`createProjectMeta` 不主动写入 `healthScore`（保持可选）
- [ ] 1.3 修改 `electron/main/services/project/project-service.ts`：`updateProject` 的 `patch` 类型新增 `healthScore?: number`，合并逻辑中透传该字段到 `ProjectMeta`
- [ ] 1.4 在 `frontend/src/stores/project.ts` 中新增 `refreshCurrentProject()`：当 `currentProject` 为 null 时直接返回；否则调用 `projectApi.getById(currentProject.value.id)`，成功时通过 `upsertProject` 与就地合并更新 `currentProject.value`（仅刷新字段，不调用 `setCurrentProject`，避免触发 session 重载）；失败时直接抛错，由调用方决定是否处理

## 2. AppHeader 健康度 icon

- [ ] 2.1 修改 `frontend/src/components/layout/AppHeader.vue`：在中央区域 ProjectSelector div 右侧（`UDropdownMenu` 外部）新增健康度 icon 按钮，使用 `UPopover` 包裹，仅在 `projectStore.currentProject` 非 null 时渲染
- [ ] 2.2 在 `AppHeader.vue` 中实现颜色映射 computed：基于 `projectStore.currentProject.healthScore` 计算，`undefined`/0 → `text-muted`，1–59 → `text-orange-500`，60–100 → `text-green-500`；icon 使用 `i-lucide-heart-pulse` 或 `i-lucide-activity`；进入/切换项目时由响应式自动渲染
- [ ] 2.3 在 `AppHeader.vue` 中实现 UPopover 内容：显示当前健康度状态说明文字（未检查 / 上次得分 N 分）+ "开始健康检查"按钮；按钮点击后关闭 Popover 并调用 `startHealthCheck()`
- [ ] 2.4 在 `AppHeader.vue` 中绑定健康度 icon 的 `@click`：同步打开 UPopover（基于当前 `healthScore` 渲染），并发触发 `projectStore.refreshCurrentProject()`；catch 失败时静默吞掉错误，不弹 toast、不关闭 Popover

## 3. 健康检查 session 启动逻辑

- [ ] 3.1 在 `AppHeader.vue` 中实现 `startHealthCheck()`：调用 `sessionStore.createSession({ projectId, agentId, title: "项目健康检查" })`，导航到 chat 页面
- [ ] 3.2 在 `startHealthCheck()` 中，session 创建成功后，调用 `chatApi.streamMessage` 发送 system-reminder 消息（内容由 3.3 模板渲染），该消息以 `<system-reminder>` 标签包裹，前端 `isSystemReminderPart` 工具函数会自动隐藏
- [ ] 3.3 新增 `frontend/src/constants/health-check-reminder.ts`：导出 `buildHealthCheckReminder(project: ProjectInfo): string`，按 4 分块结构渲染（角色 / 评分规范 / 工作流 / proposal 输出契约），并注入 `project.path` 与 `project.metaPath`。模板正文（包裹在 `<system-reminder>` 标签内）：

  ```
  ## 你的角色

  本次 chat 是项目健康检查 session。任务：评估当前项目对 agent 的工程硬约束完备度（即"靠配置就能强制 agent 行为"的程度），并通过 FylloCode 标准 proposal 流程帮用户补齐缺口。

  当前项目根目录：{projectPath}
  当前项目 meta.json 绝对路径：{metaPath}

  ## 评分规范

  healthScore = 静态约束(40) + 测试约束(30) + 流程约束(30)，满分 100。

  每个维度的判定基线是"该生态广泛认可的工程最佳实践"，不是"配置存在 + 非空"。

  静态约束（40 分，4 维各 10 分）：
  - 类型检查 strict：开启该语言的严格类型检查模式，且未通过大量豁免（批量 // @ts-ignore、tsconfig 中 strict 子项被关闭、mypy 大段 ignore_missing_imports 等）削弱
  - Linter 规则达到生态推荐基线：启用了该生态认可的 recommended 规则集（如 eslint:recommended、ruff 默认规则集、clippy::pedantic 等），不是仅 1–2 条最低规则
  - Formatter 已配置且使用社区主流配置：使用主流默认或合理覆盖，避免空配置或全部禁用
  - 启用语义或类型感知规则：Linter 跑了需要类型或 AST 信息才能跑的规则集（如 typescript-eslint type-checked、mypy strict_optional 等）

  测试约束（30 分，3 维各 10 分）：
  - Test runner 已配置：使用该生态主流测试框架，不是自制脚本或仅 echo
  - Test 命令真实运行测试套件且失败会以非 0 退出：命令真正调用 runner 跑测试，断言失败传播为命令失败；不接受 `echo ok && exit 0`、`|| true`、`continue-on-error` 等屏蔽手段
  - Coverage 阈值合理：coverage 工具配置 fail-under 阈值且阈值非 0

  流程约束（30 分，3 维各 10 分）：
  - Git hooks 工具已配置且真实安装：hook 工具实际 install（husky install / lefthook install / pre-commit install 等），不是仅在 package.json 列出依赖
  - pre-commit hook 真实触发检查命令：hook 脚本调用了 lint / typecheck / format / test 中至少一项的真实命令，调用方式不会被静默吞掉（不是 echo、不是 exit 0、不是被注释或 || true）
  - CI 配置真实运行 lint + test 且失败阻断：CI 配置文件存在；job 在主分支推送或 PR 时触发，命令失败时 job 以失败状态终止（不接受 continue-on-error: true / 全局 || true / always-succeed 脚本）

  防刷分原则（必须严格遵守）：
  1. 配置存在 ≠ 得分：必须达到该工具的工程最佳实践基线，不是最低限度的合规外形
  2. 不限定工具与语言：维度问的是"能力是否实现"，工具由你根据项目栈自行映射
  3. 拿不准就不给分：无法明确判定时该维度按 0 计
  4. 下列反面示例自动判 0 分（无论其他配置如何）：
     - test 命令为 `echo ok && exit 0` 之类的桩命令
     - linter 配置仅 1–2 条规则且未 extends 任何 recommended 规则集
     - hook 脚本仅 echo 或 exit 0 或被整体注释
     - CI job 使用 `|| true`、`continue-on-error: true`、捕获失败但仍以 0 退出的脚本
     - coverage 阈值设为 0 或近乎 0（如 1%）
     - tsconfig `strict: true` 但 `noImplicitAny`、`strictNullChecks` 等子项被显式关闭
  5. 每个维度的得分必须附判定理由 + 引用的配置文件路径与关键行片段，不允许只输出分数

  ## 工作流

  1. 读取项目根目录的配置文件，按上述 10 维度逐项判定，输出当前分数 X 与每个维度的状态（满分 / 部分得分 / 未达标 + 判定理由 + 引用配置片段）
  2. 对未达标维度，给出具体可执行的改进建议（指明工具、命令、目标文件位置）
  3. 在 chat 中与用户对齐改进范围；得到用户认可后，再调用 mcp__fyllo_specs__create-proposal
  4. proposal 的 changeName 必须以 `health-check-` 开头
  5. proposal apply 完成后，目标分数 Y 应 ≥ X
  6. 即使当前已满分（X = 100），仍需创建 proposal，tasks.md 中只保留写入 healthScore 的收尾任务

  ## proposal 输出契约

  proposal 的 tasks.md 必须满足：

  - 为每个未达标维度生成对应的配置改进任务（一条任务 = 一个维度），任务文本指明要修改的文件路径与目标配置
  - 在 tasks.md 末尾追加一条收尾任务，文本格式严格如下：
    > 编辑 `{metaPath}`，将 JSON 中的 `healthScore` 字段更新为 Y（保持其他字段不变）。
  - healthScore 写入只能通过 Edit/Write 文件工具完成，不要假设可调用任何 IPC 通道
  ```

- [ ] 3.4 system-reminder 消息发送完成后，立即发送用户口吻消息："帮我根据当前项目技术栈检查：静态约束、测试约束、流程约束的配置情况并完善"

## 4. 验证

- [ ] 4.1 TypeScript 类型检查通过（`pnpm typecheck`）
- [ ] 4.2 AppHeader 在有/无活跃项目时健康度 icon 的显示/隐藏行为正确
- [ ] 4.3 颜色映射三档（灰/橙/绿）在不同 healthScore 值下渲染正确
- [ ] 4.4 点击 icon 时 Popover 立即打开（不等待 fetch）；fetch 成功后颜色与文案同步更新；fetch 失败时颜色保留旧值且 Popover 保持打开
- [ ] 4.5 `ProjectInfo.metaPath` 在 `project:list` 与 `project:getById` 返回值中均为绝对路径，且实际指向磁盘上的 `meta.json` 文件
- [ ] 4.6 健康检查 session 中渲染的 system-reminder 文本：包含 4 个一级标题（角色 / 评分规范 / 工作流 / proposal 输出契约）；包含完整的 4+3+3 共 10 维度；包含 5 条防刷分原则（含反面示例自动判 0、强制附判定理由）；占位符 `{projectPath}` / `{metaPath}` 已被实际值替换
