## Context

FylloCode 的持久化数据存储在用户 `userData` 目录下的 JSON 文件中（`data/` 目录）。随着版本迭代，这些文件的字段名、类型或结构会发生变化。目前没有任何自动升级机制，旧版本用户升级后可能遭遇数据格式不兼容问题。

主进程入口为 `electron/main/bootstrap/index.ts` 的 `startApp()`，在 `app.whenReady()` 后依次执行：`syncShellPath()` → `registerAllHandlers()` → `createMainWindow()`。迁移框架需要插入在 `syncShellPath()` 之后、`createMainWindow()` 之前，确保窗口打开前数据已就绪。

## Goals / Non-Goals

**Goals:**

- 提供一套迁移引擎，App 启动时自动执行未执行过的迁移脚本
- 迁移脚本按文件名排序顺序执行，执行记录持久化，已执行的不重复执行
- 迁移失败时记录错误、打印日志，但不阻止 App 启动（降级策略）
- 提供第一批迁移脚本，修复 `persist-field-naming-conventions` change 引入的不兼容数据

**Non-Goals:**

- 不支持迁移回滚（JSON 文件迁移难以原子回滚，失败时保留原文件）
- 不提供 CLI 工具（无需像 Prisma 那样手动 `migrate deploy`）
- 不迁移 `data/` 以外的数据（如系统配置、注册表）

## Decisions

**决策 1：迁移 ID 使用 `YYYYMMDD_NNN_<description>` 格式，不使用 app 版本号**

版本号不是单调递增的迁移标识：用户可能跳版本升级（中间迁移必须全部补跑）、同一版本可能有多次数据变更、开发环境切分支时版本号可能回退。时间戳前缀 + 序号保证全局唯一且天然有序，与 Flyway 的 `V1__` 前缀策略等价。

**决策 2：执行记录存 `data/migrations.json`，结构为 `{ baselineId?: string; executed: MigrationRecord[] }`**

```ts
type MigrationRecord = {
  id: string; // 迁移文件名（不含 .ts 扩展名）
  executedAt: string; // ISO 8601 字符串
  status: "success" | "failed";
  error?: string; // 失败时的错误摘要
};

type MigrationStore = {
  baselineId?: string; // 低于或等于此 ID 的迁移视为已执行，无需运行
  executed: MigrationRecord[];
};
```

选择 JSON 而非 SQLite，与现有持久化风格一致，无需引入新依赖。

**决策 6：用 `baselineId` 区分新安装与老用户升级**

新用户首次启动时 `migrations.json` 不存在，但老用户从一个没有迁移框架的旧版本升级时同样如此——两者无法通过文件是否存在来区分。若把"文件不存在"一律当新安装处理，老用户会跳过所有历史迁移，数据不会被修复；若一律执行，新用户会跑一堆对自己无意义的旧迁移（虽然幂等，但不优雅）。

解法：借鉴 Flyway 的 baseline 概念。`migrations.json` 新增可选字段 `baselineId`，表示"低于或等于此 ID 的迁移视为已执行，直接跳过"。

- **新安装**：`migrations.json` 不存在，迁移引擎首次运行时将当前注册的最新迁移 ID 写为 `baselineId`，不执行任何迁移（新数据天然符合最新格式）
- **老用户升级（有迁移框架）**：`migrations.json` 已存在，`baselineId` 已设置，引擎只执行 ID 大于 `baselineId` 且未在 `executed` 中的迁移
- **老用户升级（无迁移框架，首次引入）**：`migrations.json` 不存在，但用户数据目录中已有其他文件（如 `data/acp/installed.json` 或 `data/projects/`）——此时不应设置 baseline，应执行所有历史迁移

判断"是否为新安装"的信号：检查 `data/projects/` 目录和 `data/acp/installed.json` 是否存在。两者均不存在 → 新安装，写入 baseline；任一存在 → 老用户升级，不写 baseline，执行所有历史迁移。

**决策 3：迁移脚本为 TypeScript 文件，导出 `migrate(context: MigrationContext)` 函数**

```ts
// electron/main/migrations/20260601_001_config-options-camel-case.ts
export async function migrate(ctx: MigrationContext): Promise<void> {
  // ctx 提供 dataPath、logger 等工具
}
```

迁移函数接收 `MigrationContext`，其中包含 `dataPath`（`userData` 下 `data/` 目录的绝对路径）和 `logger`，不直接 import 全局单例，便于测试。

**决策 4：迁移引擎在构建时静态 import 所有迁移文件，不做运行时动态扫描**

Electron 打包后无法可靠地扫描文件系统中的迁移文件。改为在 `electron/main/migrations/index.ts` 中维护一个有序数组，手动 import 每个迁移模块。新增迁移时需同步更新该数组——这是唯一的"注册"步骤。

**决策 5：迁移失败不阻止 App 启动**

迁移失败通常意味着数据格式异常，强制阻止启动会让用户完全无法使用 App。降级策略：记录失败状态到 `migrations.json`，打印 `logger.error`，继续启动。失败的迁移在下次启动时**不会重试**（避免每次启动都失败卡顿），需要开发者发布修复版本。

## Risks / Trade-offs

- **[风险] 迁移脚本操作文件失败（如权限问题）** → 捕获异常，记录 `status: "failed"`，App 继续启动，用户数据保持原样
- **[风险] 迁移数组顺序被手动打乱** → 在 CI 中加 lint 规则或注释约定，要求数组按文件名字母序排列
- **[Trade-off] 静态 import 而非动态扫描** → 新增迁移需手动注册，但打包兼容性更好，且迁移数量预计不多

## Migration Plan

迁移框架本身无需数据迁移。第一批迁移脚本（`20260601_001`、`20260601_002`）在框架实现后随同发布，用户升级后首次启动时自动执行。
