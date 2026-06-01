## Why

FylloCode 的持久化 JSON 文件随版本迭代会出现字段重命名、类型变更等不兼容改动（如 `config_options` → `configOptions`、`installedAt` 从数字改为 ISO 字符串）。目前没有任何机制保证用户升级后旧数据能自动修复，只能靠代码里散落的兼容性 if-else，长期维护成本极高。需要一套类似 Flyway / Prisma Migrate 的数据迁移框架，在 App 启动时自动将用户数据升级到当前版本所需的格式。

## What Changes

- 新增 `data-migration` 能力：主进程启动时自动扫描并执行未执行过的迁移脚本，执行记录持久化到 `data/migrations.json`
- 每条迁移为一个独立 TypeScript 文件，文件名格式 `YYYYMMDD_NNN_<description>.ts`，按文件名顺序执行，执行过的不再重复执行
- 迁移失败时记录错误状态，App 仍可启动（降级策略），但在日志中输出警告
- 新增 `baselineId` 机制区分新安装与老用户升级，新安装时跳过所有历史迁移

## Capabilities

### New Capabilities

- `data-migration`：主进程数据迁移框架，定义迁移文件约定、执行引擎、执行记录持久化和失败处理策略

### Modified Capabilities

- `app-bootstrap`：主进程启动流程需在窗口创建前执行数据迁移（新增主进程侧 bootstrap 约束）

## Impact

- 新增目录 `electron/main/migrations/`：存放迁移引擎（`types.ts`、`store.ts`、`runner.ts`、`index.ts`）和所有迁移脚本
- 修改 `electron/main/bootstrap/index.ts`：在 `app.whenReady()` 后、`createMainWindow()` 前调用迁移引擎
- 新增 `data/migrations.json`（运行时生成）：记录 `baselineId` 和已执行迁移的 ID、执行时间、状态
- 新增 guideline：在 `guidelines/DataModel.md` 补充迁移框架使用规范
