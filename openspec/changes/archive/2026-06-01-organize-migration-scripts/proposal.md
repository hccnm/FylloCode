## Why

当前迁移框架代码与具体迁移脚本都放在 `electron/main/migrations/` 根目录下，随着迁移数量增加会让执行引擎、账本读写和历史脚本混在一起，降低新增迁移时的可读性。现有 `data-migration` 规范还把脚本位置写为 `electron/main/infra/migrations/`，与当前代码和 `guidelines/DataModel.md` 不一致，需要借本次整理统一约定。

## What Changes

- 将具体迁移脚本移动到 `electron/main/migrations/scripts/`，保留 `runner.ts`、`store.ts`、`types.ts`、`index.ts` 作为迁移框架层。
- 在 `electron/main/migrations/scripts/index.ts` 中静态导入每个迁移脚本并导出 `migrations: Migration[]`，由 `electron/main/migrations/index.ts` 直接导入该数组。
- 保持迁移执行语义不变：迁移 ID、执行顺序、baseline、失败记录、跳过规则和启动时调用位置均不改变。
- 更新 `data-migration` OpenSpec 与 `guidelines/DataModel.md`，把新增迁移的权威位置统一为 `electron/main/migrations/scripts/`。
- 增加测试或静态断言，验证导出的迁移数组顺序与脚本文件名字母序一致。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `data-migration`: 修改迁移脚本约定，将具体迁移脚本与迁移数组注册入口从迁移框架根目录拆分到 `electron/main/migrations/scripts/`。

## Impact

- 影响主进程迁移模块：`electron/main/migrations/index.ts`、现有迁移脚本路径、迁移脚本内部类型导入路径、新增 `electron/main/migrations/scripts/index.ts`。
- 影响测试：新增或调整 `electron/main/__tests__/migrations/**` 下的测试，覆盖迁移注册数组顺序。
- 影响文档与规范：更新 `openspec/specs/data-migration/spec.md` 的 delta，并更新 `guidelines/DataModel.md` 中新增迁移脚本的位置说明。
- 不影响外部 API、IPC channel、持久化 schema、`data/migrations.json` 结构或用户数据迁移行为。
