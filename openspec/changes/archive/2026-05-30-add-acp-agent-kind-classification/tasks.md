## 1. 类型与常量

- [x] 1.1 在 `shared/types/acp-agent.ts` 中新增类型 `AcpAgentKind = "native" | "adapter" | "bridge"` 与接口 `AcpFylloMeta { kind: AcpAgentKind }`，并在 `AcpAgentEntry` 上扩展可选字段 `__fyllo?: AcpFylloMeta`
  - 验收：`shared/types/acp-agent.ts` 的导出新增上述类型；`AcpAgentEntry` 包含可选 `__fyllo` 字段；项目 `pnpm typecheck` 通过
- [x] 1.2 创建 `electron/main/domain/acp/agent-kind-map.ts`，导出常量 `ADAPTER_AGENT_IDS = new Set(["claude-acp", "codex-acp", "amp-acp"])`、`BRIDGE_AGENT_IDS = new Set(["pi-acp"])` 与函数 `resolveAgentKind(agentId: string): AcpAgentKind`，文件顶部注释明确「判定准则与已知归类的 source of truth 是 `guidelines/Domain.md`；新增或重新分类必须双向同步该 guideline 与本文件」
  - 验收：函数对 `claude-acp` / `codex-acp` / `amp-acp` 返回 `"adapter"`，对 `pi-acp` 返回 `"bridge"`，对其他 id 返回 `"native"`

## 2. Registry 出口注入分类

- [x] 2.1 在 `electron/main/infra/storage/acp-registry-cache.ts` 中新增私有 helper `enrichRegistry(data: AcpRegistry): AcpRegistry`，对 `data.agents` 做不可变映射，逐个调用 `resolveAgentKind` 注入 `__fyllo.kind`，返回新对象，不修改入参
  - 验收：helper 不修改入参（input 等价对比保持不变）；返回值的每个 agent 携带 `__fyllo.kind`
- [x] 2.2 修改 `getRegistry()` 与 `refreshRegistry()` 的所有 return 路径（包括 TTL 内命中缓存返回、过期返回旧缓存、网络刷新成功返回新数据），在最终返回前统一通过 `enrichRegistry` 包裹
  - 验收：所有 return 都经过 `enrichRegistry`；磁盘写入函数 `writeRegistryCache` 仍写入未注入 `__fyllo` 的原始 `data`
- [x] 2.3 新增/补充单元测试 `electron/main/infra/storage/__tests__/acp-registry-cache.test.ts`（按项目实际测试目录约定）：
  - 用例 a：`getRegistry` 返回的 agents 中 `claude-acp`、`codex-acp`、`amp-acp` 的 `__fyllo.kind === "adapter"`，`pi-acp === "bridge"`，其它 `=== "native"`
  - 用例 b：`refreshRegistry` 同上
  - 用例 c：mock `writeRegistryCache` 的入参，断言写入磁盘的对象不包含 `__fyllo` 字段
  - 用例 d：旧版本无 `__fyllo` 的缓存内容能被 `readRegistryCache` 正常读取，并在 `getRegistry` 返回时被注入
  - 验收：`pnpm test` 通过，覆盖以上四个用例

## 3. 共用徽章组件

- [x] 3.1 创建 `frontend/src/components/acp/AgentKindBadge.vue`，输入 prop `kind: AcpAgentKind | undefined`，输出：
  - `kind === "adapter"`：`<UTooltip text="适配器 · 自带完整实现，可与已安装的对应 Agent 共享配置"><UIcon name="i-lucide-layers" /></UTooltip>`
  - `kind === "bridge"`：`<UTooltip text="桥接器 · 与 Agent 桥接打通，需要先安装对应的 Agent"><UIcon name="i-lucide-cable" /></UTooltip>`
  - `kind === "native"` 或 undefined：渲染 `null`
  - 图标尺寸与卡片信息行视觉对齐（参考现有 `text-muted` 调色），不抢主标题视觉
  - 验收：组件文件存在；三种 kind 行为符合上述描述；与 @nuxt/ui v4 `UTooltip` API 一致

## 4. 卡片接入

- [x] 4.1 修改 `frontend/src/components/settings/AgentCard.vue`，在名称行（`<p class="text-sm font-medium text-highlighted truncate">{{ agent.name }}</p>` 之后）插入 `<AgentKindBadge :kind="agent.__fyllo?.kind" />`，保持 `truncate` 行为
  - 验收：手动渲染 `claude-acp`、`codex-acp`、`amp-acp`、`pi-acp` 与任一 native agent，徽章显示符合规范
- [x] 4.2 修改 `frontend/src/components/chat/empty/AgentPickerCard.vue`，在名称行（`<p class="text-sm font-medium text-highlighted truncate">{{ agent.name }}</p>` 旁、版本号 `v{{ agent.version }}` 同 flex 容器内）插入 `<AgentKindBadge :kind="agent.__fyllo?.kind" />`
  - 验收：弹窗中三类 agent 卡片视觉差异符合规范
- [x] 4.3 **回滚 `InstalledAgentTile` 的分类改动**：基于 UX 评审结论，tile 是极简切换入口，不承担分类教育职责；删除 `frontend/src/components/chat/empty/InstalledAgentTile.vue` 中的 `kind` prop、`AgentKindBadge` 引用与 `AcpAgentKind` import；同步从父组件 `ChatEmptyAgentPicker.vue` 中移除 `visibleInstalled` 的 `kind` 字段与传给 tile 的 `:kind` 绑定
  - 验收：`InstalledAgentTile.vue` 的 `defineProps` 仅含 `agentId / name / icon / selected`；tile 模板内不出现 `AgentKindBadge`；`ChatEmptyAgentPicker.vue` 中不出现 `__fyllo` 引用与 `:kind` 绑定；`pnpm typecheck` 与 `pnpm lint` 通过

## 5. 仓库 guidelines 同步

- [x] 5.1 新建 `guidelines/Domain.md`，遵循 `mcp__fyllo_skills__guidelines` write 契约的文档结构（Frontmatter + Purpose + Applicability + Sources of Truth + Rules + Examples + Verification + Maintenance），内容必须包含：
  - **Frontmatter**：`name: Domain`、`description` 简述本文档涵盖产品词汇与判定标准、`keywords: [domain, acp, agent-kind]`
  - **Purpose**：声明本文档存放 FylloCode 产品词汇、业务规则、判定标准；任何评估"某 ACP agent 算 native / adapter / bridge"的决策必须先读本文档
  - **Sources of Truth**：列出 `electron/main/domain/acp/agent-kind-map.ts`、`shared/types/acp-agent.ts`（`AcpAgentKind` 类型）、`electron/main/infra/storage/acp-registry-cache.ts`（注入位置）
  - **Rules**：
    - 三类 agent 定义（`native` / `adapter` / `bridge`），与 `specs/acp-agent-kind-classification/spec.md` 中文字一致
    - **adapter 判定准则（用户心智锚点）**：当且仅当存在用户视角下的对应官方 Agent / CLI（足以让用户产生「我装了它，FylloCode 是不是该识别」预期），且该 ACP 包自带完整实现、不 spawn 该 CLI 子进程时归为 adapter；没有这种锚点的纯 HTTP 实现归为 native
    - **bridge 判定准则**：运行时通过 spawn 等方式调用本地命令行工具完成工作
    - **MUST**：新增或重新分类 ACP agent 时，必须双向同步 `guidelines/Domain.md` 与 `electron/main/domain/acp/agent-kind-map.ts`
  - **Examples**：列出当前已知归类
    - `adapter`: `claude-acp`（Claude Code）、`codex-acp`（Codex CLI）、`amp-acp`（Amp CLI）
    - `bridge`: `pi-acp`（spawn 本地 `pi` CLI）
    - `native` 边界示例：`glm-acp-agent`（GLM 无官方 CLI 产品，纯 HTTP）、`agoragentic-acp`（marketplace SaaS，无对应 CLI 产品）
  - **Verification**：评估新 agent 时对照本文档判定准则，并运行 `pnpm typecheck && pnpm test` 验证 `agent-kind-map.ts` 修改无破坏
  - **Maintenance**：列出触发更新的事件（registry 出现新 agent、用户反馈某 agent 归类有误、上游协议增加新形态）
  - 验收：文件路径为 `guidelines/Domain.md`；frontmatter 三字段齐全；八个章节齐全；上述四类已知归类示例齐全
- [x] 5.2 在 root `CLAUDE.md` 的「文档归类」段落追加一行 `**领域词汇** - [Domain](guidelines/Domain.md)`，位置紧随 `Architecture` 之后（保持文档归类顺序：架构 → 领域 → 主进程 / 渲染进程 / 数据模型 …）
  - 验收：`grep -n "guidelines/Domain.md" CLAUDE.md` 命中一行，且不破坏其他行
- [x] 5.3 在 `electron/main/domain/acp/agent-kind-map.ts` 文件顶部添加注释，明确「判定准则与已知归类的 source of truth 是 `guidelines/Domain.md`；新增或重新分类时必须双向同步该 guideline 与本文件」（与 1.2 验收联动）
  - 验收：注释中出现路径 `guidelines/Domain.md`

## 6. 验证

- [x] 6.1 运行 `pnpm typecheck`，确认所有受影响的主进程与前端 TS 文件类型通过
- [x] 6.2 运行 `pnpm lint`，确认无新增 lint 错误
- [x] 6.3 运行 `pnpm test`，确认 2.3 中新增/修改的测试通过
- [x] 6.4 运行 `pnpm dev` 手动验证：
  - 设置页 Agents tab 中 `claude-acp` / `codex-acp` / `amp-acp` 显示 `i-lucide-layers` 图标，hover 弹出适配器文案
  - 设置页 `pi-acp` 显示 `i-lucide-cable` 图标，hover 弹出桥接器文案
  - `glm-acp-agent` / `agoragentic-acp` 等其它 agent 卡片不显示分类图标
  - Chat 空态 `AgentPickerModal` 中三类卡片表现一致；首屏 `InstalledAgentTile` **不**显示任何分类图标
- [x] 6.5 检查 `~/Library/Application Support/<app>/acp/registry-cache.json`（macOS 路径），确认 `data.agents[*]` 中 **不**包含 `__fyllo` 字段
