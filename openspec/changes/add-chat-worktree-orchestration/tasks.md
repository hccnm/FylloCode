## 1. 模板变量白名单扩展

- [x] 1.1 修改 `electron/main/services/chat/system-reminder/providers/shared.ts`：将 `ALLOWED_VARIABLES` 数组从 `["changeId", "stageIndex", "runId", "projectPath"]` 扩展为 `["changeId", "stageIndex", "runId", "projectPath", "worktreePath", "mainProjectPath"]`；同步更新 `AllowedVariable` 类型推导。
- [x] 1.2 在同一文件的 `getVariableValue` 函数中，为新增的两个字段补 case：
  - `case "worktreePath": return ctx.worktreePath;`
  - `case "mainProjectPath": return ctx.projectPath;`（别名，与 `projectPath` 取同一字段）
- [x] 1.3 验收：`pnpm typecheck` 通过；`grep "ALLOWED_VARIABLES" providers/shared.ts` 输出含全部 6 个字段。

## 2. chat.txt 模板新增 worktree 编排段

- [x] 2.1 修改 `electron/main/services/chat/system-reminder/templates/chat.txt`：在 `</rules>` 闭合标签之前、`<critical priority="must-not-violate">` 开始标签之前，插入完整的 `<worktree>` 段。段落文本严格按 design.md 第 "chat.txt worktree 编排子段" 节的设计文本写入（含 6 步编排：non-git 自检 / .gitignore 维护 / worktree add / 调 create-proposal / 多 change 语义 / 路径口径）。
- [x] 2.2 文本中所有 `{{mainProjectPath}}` 占位符必须严格使用此名称（不要写成 `{{projectPath}}`，避免与 `<critical>` 段中既有的 `projectPath` 叙述混淆）；`<changeName>` 用尖括号包裹的字面量保留（让 agent 知道这是占位符）。
- [ ] 2.3 验收：手动启动 FylloCode（`pnpm dev`）后，新建 chat 触发首次 prompt，从主进程 logger 中确认 chat reminder 文本含 `<worktree>` 段；用户在 chat 内确认 propose 后，agent 调用 Bash 执行 `git worktree add ...`，并把 `targetPath` 设为 `<projectPath>/.worktrees/<changeName>` 调 `mcp__fyllo_specs__create-proposal`，工具返回成功。

## 3. apply.txt 模板新增 worktree 段

- [x] 3.1 修改 `electron/main/services/chat/system-reminder/templates/apply.txt`：在 `</context>` 闭合标签之后、`<rules>` 开始标签之前，插入完整的 `<worktree>` 段。段落文本严格按 design.md 第 "apply.txt worktree 子段" 节的设计文本写入。
- [x] 3.2 文本必须含 `{{worktreePath}}` 与 `{{mainProjectPath}}` 两个占位符；明确说明"空字符串代表当前 stage 的 cwd 是主仓库"；明确说明"业务代码改动产生的 commit 由 agent 自己完成"。
- [ ] 3.3 验收：在 FylloCode 仓库本地，先用 P1 完成的 typecheck 通过的代码跑一次 stage stream（ApplyRunMeta.worktreePath 此时仍为 undefined），从主进程 logger 中确认 apply reminder 文本含 `<worktree>` 段，且 `{{worktreePath}}` 渲染为空字符串。

## 4. 模板渲染单测扩展

- [x] 4.1 在 `electron/main/__tests__/services/chat/system-reminder/` 创建 `shared.spec.ts`，覆盖：
  - 4.1.1 `worktreePath` 占位符：传入 `worktreePath: "/abs/.worktrees/foo"` → 渲染后字符串包含 `/abs/.worktrees/foo`。
  - 4.1.2 `worktreePath` 为 `undefined` → 渲染后 `{{worktreePath}}` 被替换为空字符串。
  - 4.1.3 `mainProjectPath` 占位符：传入 `projectPath: "/abs/myapp"` → `{{mainProjectPath}}` 渲染为 `/abs/myapp`，且与同模板内 `{{projectPath}}` 渲染结果完全一致。
  - 4.1.4 `worktreePath` 含 `<` 字符 → `renderSystemReminderTemplate` 返回 `null`；`logger.warn` 被调用且字段含 `worktreePath`、对应 `owner`、`fylloSessionId`。
  - 4.1.5 `mainProjectPath` 含 `>` 字符 → `renderSystemReminderTemplate` 返回 `null`；同样命中告警。
  - 4.1.6 非白名单占位符 `{{otherField}}` → 渲染后保持字面量 `{{otherField}}`。
- [x] 4.2 验收：`pnpm test electron/main/__tests__/services/chat/system-reminder` 全过；新增的 shared.spec.ts 6 条用例全过。

## 5. 模板正文不会泄漏 system-reminder 标签

- [x] 5.1 在新建的 `shared.spec.ts` 增加一条用例：模拟将 chat.txt 完整文本作为 `body` 传入 `wrapAsSystemReminder`，断言不抛错（即模板正文中**没有**字面量 `<system-reminder>` 或 `</system-reminder>` 字符串）。
- [x] 5.2 同理对 apply.txt 跑一次 `wrapAsSystemReminder` 不抛错的断言。
- [x] 5.3 验收：上述两条用例通过；如果未来有人在 chat.txt / apply.txt 中误写 `<system-reminder>`，单测会立刻 fail。

## 6. dogfood 与零回归验证

- [ ] 6.1 在 FylloCode 自身仓库（git 项目）`pnpm dev` 启动开发环境；新建一个 chat session，让 agent 走完一次 propose 流程，确认：
  - 6.1.1 主仓库 `.gitignore` 出现 `.worktrees/` 行（如原本不存在）；该行通过一次 `chore: ignore .worktrees` commit 落到 main 当前分支。
  - 6.1.2 `<projectPath>/.worktrees/<changeName>/` 目录被创建；`git worktree list` 输出含该路径；分支名为 `proposal/<changeName>`。
  - 6.1.3 OpenSpec change scaffold 出现在 worktree 内的 `openspec/changes/<changeName>/`，**不在**主仓库的 `openspec/changes/`。
  - 6.1.4 chat session 自身 cwd 仍是主仓库（agent Read 主仓库相对路径文件不报错）。
- [ ] 6.2 在同一 chat session 内继续，让 agent 孵化第二个独立 change（不同 changeName）；确认：
  - 6.2.1 主仓库再多一个 worktree（路径 `<projectPath>/.worktrees/<另一个 changeName>/`）。
  - 6.2.2 之前的第一个 worktree 与 artifacts 完整保留。
  - 6.2.3 用户用模糊语言（"刚才那个 change 加一段 design"）追问时，agent 主动反问目标 worktree 而非自己猜。
- [ ] 6.3 用一个非 git 项目（用户在 FylloCode 创建的 `template: "empty"` 项目），跑一次 chat → propose 流程；确认 agent 的 `git rev-parse --is-inside-work-tree` 自检失败后跳过 worktree 编排；create-proposal 调用使用 `targetPath: <projectPath>` 即主仓库根；OpenSpec change 创建在 `<projectPath>/openspec/changes/<changeName>/`。
- [ ] 6.4 触发一次 apply（在 P1 已完成的 ApplyRunMeta 字段下，worktreePath 仍为 undefined），从 logger 看 apply reminder 含 `<worktree>` 段且 worktreePath 渲染为空——行为与 P1 一致，无回归。
- [x] 6.5 `pnpm build` 通过、`pnpm lint` 不引入新告警、`pnpm typecheck` 通过。
- [ ] 6.6 验收：6.1–6.5 全部通过；新建一个 PR 或 commit 描述记录 dogfood 结果。

## 7. 文档与下游对齐

- [x] 7.1 修改 `mcp-servers/fyllo-specs/src/prompts/create-proposal.md`：在文档"Input"段或开头注释中说明 `targetPath` 的推荐值——
  - git 项目：worktree 绝对路径（具体由 chat.txt system-reminder 引导 agent 创建并传入）。
  - non-git 项目：主仓库绝对路径（即 `FYLLO_PROJECT_PATH`）。
- [x] 7.2 验收：调整后 `pnpm test mcp-servers/fyllo-specs/__tests__/prompts.test.ts` 仍通过（如该测试断言文本片段，则同步更新断言）。

## 8. 验收总闸

- [ ] 8.1 1.1 - 7.2 全部勾选完成。
- [ ] 8.2 OpenSpec change 状态从 `applying` 准备进入 archive；archive 阶段（P4）尚未实现，本次 archive 仍按当前 `proposal-archive-action` spec 行为执行（agent 自己 commit + 走完归档移动；不做 merge / worktree remove）。
- [ ] 8.3 在 P3 / P4 落地之前，本次 archive **不会**自动清理 `.worktrees/<changeName>/` 目录——这部分留给 P4。本任务的 archive 步骤只负责让 OpenSpec 文件归档与 commit 落到 worktree 分支即可，worktree 目录保留在磁盘上属于预期。
