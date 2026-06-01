## 1. 迁移脚本目录重组

- [x] 1.1 新建 `electron/main/migrations/scripts/`，将 `electron/main/migrations/20260601_001_config-options-camel-case.ts` 和 `electron/main/migrations/20260601_002_installed-at-iso.ts` 移动到该目录；移动后两个文件名必须保持不变。
- [x] 1.2 修改两个迁移脚本中的类型导入，将 `import type { MigrationContext } from "./types";` 改为从 `../types` 导入；迁移函数名称、导出方式和业务逻辑不得改变。
- [x] 1.3 新建 `electron/main/migrations/scripts/index.ts`，静态导入两个迁移脚本的 `migrate` 函数，导出 `const migrations: Migration[]`；数组 ID 必须分别保持为 `20260601_001_config-options-camel-case` 和 `20260601_002_installed-at-iso`，顺序必须与文件名字母序一致。
- [x] 1.4 修改 `electron/main/migrations/index.ts`，删除对具体迁移脚本的直接导入和本地 `migrations` 数组定义，改为 `import { migrations } from "./scripts";`；保留 `runAllMigrations()` 的函数名、签名、路径计算和 `runMigrations(migrations, migrationsPath, dataPath)` 调用语义。

## 2. 规范与文档同步

- [x] 2.1 更新 `openspec/specs/data-migration/spec.md`，将“迁移脚本约定”中的脚本目录从 `electron/main/infra/migrations/` 修正为 `electron/main/migrations/scripts/`，并声明注册数组由 `electron/main/migrations/scripts/index.ts` 导出、根 `electron/main/migrations/index.ts` 负责导入并运行。
- [x] 2.2 更新 `guidelines/DataModel.md` 的迁移脚本规则，将新增迁移脚本位置改为 `electron/main/migrations/scripts/`，将注册位置改为 `electron/main/migrations/scripts/index.ts`，保留幂等、可测试和缓存文件无需迁移的约束。

## 3. 测试与验证

- [x] 3.1 新增 `electron/main/__tests__/migrations/scripts-index.spec.ts`，导入 `@main/migrations/scripts` 的 `migrations` 数组，读取 `electron/main/migrations/scripts` 下符合 `YYYYMMDD_NNN_*.ts` 的文件名并排除 `index.ts`，断言 `migrations.map((m) => m.id)` 与脚本文件名去掉 `.ts` 后的字母序列表完全一致。
- [x] 3.2 运行 `pnpm vitest run electron/main/__tests__/migrations/runner.spec.ts electron/main/__tests__/migrations/scripts-index.spec.ts`，确认迁移运行器现有行为和新增注册顺序测试通过。
- [x] 3.3 运行 `pnpm typecheck`，确认移动文件后的 TypeScript 路径和 `@main/migrations/scripts` 导入可解析。
- [x] 3.4 运行 `pnpm lint`，确认新增文件和移动后的迁移脚本符合仓库 ESLint 规则。
