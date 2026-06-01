## 1. 迁移框架基础设施

- [x] 1.1 新建 `electron/main/migrations/types.ts`：定义 `MigrationContext`（`{ dataPath: string; logger: Logger }`）、`Migration`（`{ id: string; migrate: (ctx: MigrationContext) => Promise<void> }`）、`MigrationRecord`（`{ id: string; executedAt: string; status: "success" | "failed"; error?: string }`）、`MigrationStore`（`{ baselineId?: string; executed: MigrationRecord[] }`）类型；`Logger` 类型从 `@main/infra/logger` 导入

- [x] 1.2 新建 `electron/main/migrations/store.ts`：实现 `readMigrationStore(dataPath: string): Promise<MigrationStore>` 和 `writeMigrationStore(dataPath: string, store: MigrationStore): Promise<void>`；文件路径为 `join(dataPath, "migrations.json")`；读取失败时返回 `{ executed: [] }`

- [x] 1.3 新建 `electron/main/migrations/runner.ts`
  1. 读取 `MigrationStore`
  2. 若 `migrations.json` 不存在（`readMigrationStore` 返回默认空值），检查 `join(dataPath, "projects")` 目录和 `join(dataPath, "acp", "installed.json")` 是否存在（用 `fs.access` 判断）：
     - 两者均不存在 → 新安装：将注册列表中最后一条迁移的 ID 写为 `baselineId`，写入 `migrations.json`（`executed: []`），直接返回，不执行任何迁移；若注册列表为空则写入 `{ executed: [] }` 不设 `baselineId`
     - 任一存在 → 老用户升级：不设置 `baselineId`，继续执行所有迁移
  3. 对每条迁移，按以下规则判断是否跳过（字母序比较 ID）：ID ≤ `baselineId` 则跳过；ID 已在 `executed` 中（无论 success/failed）则跳过；否则执行
  4. 每条迁移用 try/catch 包裹，成功追加 `{ id, executedAt: new Date().toISOString(), status: "success" }`，失败追加 `{ id, executedAt, status: "failed", error: err.message }` 并调用 `logger.error`
  5. 每条执行后立即写回 `MigrationStore`（不等全部完成再写，避免中途崩溃丢失记录）
  6. 所有迁移执行完毕后正常返回，不抛出异常

- [x] 1.4 新建 `electron/main/migrations/index.ts`：维护有序迁移数组 `const migrations: Migration[]`，初始为空数组；导出 `runAllMigrations(dataPath: string): Promise<void>`，内部调用 `runMigrations(migrations, dataPath)`；注释说明新增迁移时须将脚本文件追加到此数组末尾，且数组顺序须与文件名字母序一致

## 2. 接入主进程启动流程

- [x] 2.1 修改 `electron/main/bootstrap/index.ts`：在 `syncShellPath()` 之后、`registerAllHandlers()` 之前，调用 `await runAllMigrations(getDataSubPath(""))` 执行迁移；`getDataSubPath` 从 `@main/infra/paths` 导入，`runAllMigrations` 从 `@main/migrations` 导入；迁移调用本身已内部捕获异常，此处无需额外 try/catch

## 3. 测试

- [x] 3.1 新建 `electron/main/__tests__/migrations/runner.spec.ts`
  - 新安装（无 `migrations.json`、无 `data/projects/`、无 `data/acp/installed.json`）→ 不执行任何迁移，写入 `baselineId` 为最新迁移 ID
  - 老用户升级（无 `migrations.json`、但 `data/projects/` 存在）→ 执行所有迁移，不写 `baselineId`
  - `baselineId` 覆盖的迁移被跳过
  - 全部迁移成功
  - 单条迁移失败后继续执行后续迁移
  - 已执行的迁移（success）不重复执行
  - 失败迁移不重试
  - 使用临时目录（`os.tmpdir()` + 随机子目录）作为 `dataPath`，测试结束后清理

## 4. 更新 guideline

- [x] 4.1 在 `guidelines/DataModel.md` 的 Rules 章节末尾新增一条 MUST 规则
  - 当 proposal 涉及持久化文件 schema 的不兼容变更（字段重命名、类型变更、字段删除、结构调整）时，MUST 在 `electron/main/migrations/` 下新增一个独立的迁移脚本，文件名格式为 `YYYYMMDD_NNN_<kebab-case-description>.ts`，并将其追加到 `electron/main/migrations/index.ts` 的迁移数组末尾（数组顺序须与文件名字母序一致）
  - 迁移脚本 MUST 是幂等的：对目标字段/文件不存在、已是新格式等情况须静默跳过，不抛出异常，确保重复执行不产生副作用
  - 迁移脚本 MUST 通过 `MigrationContext.dataPath` 访问数据目录，不直接 import `getDataSubPath` 等全局路径单例，以保证可测试性
  - 纯缓存文件（`registry-cache.json`、`status-cache.json`）的格式变更无需迁移脚本，因其读取失败时有自动重建路径；账本类文件（`installed.json`、`sessions/*.json`）的格式变更 MUST 提供迁移脚本

- [x] 4.2 在 `guidelines/DataModel.md` 的 Maintenance 章节末尾追加迁移脚本同步更新说明
