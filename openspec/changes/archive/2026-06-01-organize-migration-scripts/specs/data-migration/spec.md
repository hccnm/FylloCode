## MODIFIED Requirements

### Requirement: 迁移脚本约定

每条具体迁移 SHALL 是 `electron/main/migrations/scripts/` 目录下的一个 TypeScript 文件，文件名格式为 `YYYYMMDD_NNN_<kebab-case-description>.ts`（如 `20260601_001_config-options-camel-case.ts`）。每个迁移文件 SHALL 导出一个 `migrate(ctx: MigrationContext): Promise<void>` 函数，并 SHALL 通过 `electron/main/migrations/types.ts` 中的 `MigrationContext` 类型访问上下文。

`MigrationContext` SHALL 包含：

- `dataPath: string`：`userData` 下 `data/` 目录的绝对路径
- `logger: Logger`：主进程 logger 实例

所有已注册迁移 SHALL 在 `electron/main/migrations/scripts/index.ts` 中以有序数组形式静态声明并导出为 `migrations: Migration[]`。数组顺序即执行顺序，SHALL 与具体迁移脚本文件名字母序一致。`electron/main/migrations/index.ts` SHALL 作为公开运行入口导入该 `migrations` 数组并传递给迁移引擎。

#### Scenario: 新增迁移脚本

- **WHEN** 开发者新增迁移文件 `electron/main/migrations/scripts/20260601_003_foo.ts`
- **THEN** 该文件 SHALL 导出 `migrate(ctx: MigrationContext): Promise<void>`
- **AND** 开发者 SHALL 将其追加到 `electron/main/migrations/scripts/index.ts` 的 `migrations` 数组末尾
- **AND** `migrations` 数组中的迁移 ID SHALL 等于脚本文件名去掉 `.ts` 扩展名后的字符串

#### Scenario: 迁移运行入口加载注册数组

- **WHEN** 主进程调用 `@main/migrations` 导出的 `runAllMigrations()`
- **THEN** `electron/main/migrations/index.ts` SHALL 从 `electron/main/migrations/scripts/index.ts` 导入 `migrations` 数组
- **AND** SHALL 将该数组传递给 `runMigrations`
