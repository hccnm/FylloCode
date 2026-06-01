## Context

当前迁移模块位于 `electron/main/migrations/`，其中 `runner.ts`、`store.ts`、`types.ts` 是框架代码，`20260601_001_config-options-camel-case.ts` 和 `20260601_002_installed-at-iso.ts` 是具体历史迁移脚本，`index.ts` 同时负责启动编排和手动注册所有迁移。启动入口 `electron/main/bootstrap/index.ts` 只通过 `@main/migrations` 调用 `runAllMigrations()`，因此可以在不影响启动调用方的前提下整理迁移目录内部结构。

`openspec/specs/data-migration/spec.md` 当前声明脚本在 `electron/main/infra/migrations/`，但实际实现和 `guidelines/DataModel.md` 使用 `electron/main/migrations/`。本次变更需要用 delta spec 明确新的脚本位置，避免后续新增迁移时出现两个相互冲突的路径约定。

## Goals / Non-Goals

**Goals:**

- 将具体迁移脚本集中到 `electron/main/migrations/scripts/`，让迁移框架代码和迁移历史脚本分层清晰。
- 让 `electron/main/migrations/scripts/index.ts` 成为唯一迁移注册位置，对外导出 `migrations: Migration[]`。
- 让 `electron/main/migrations/index.ts` 继续作为 `@main/migrations` 的公开入口，只导入 `migrations` 数组并调用 `runMigrations`。
- 修正 OpenSpec 与 guideline 中关于迁移脚本路径的约定，确保实现、规范和开发指引一致。
- 保持 `data/migrations.json` 格式、迁移 ID、执行顺序和启动行为不变。

**Non-Goals:**

- 不引入自动文件扫描或动态 import；Electron 打包环境下继续使用静态 import。
- 不修改 `runMigrations` 的跳过、失败、baseline 或日志语义。
- 不新增新的数据迁移脚本，也不改变现有两个迁移脚本的业务逻辑。
- 不移动 `runner.ts`、`store.ts`、`types.ts` 到 `infra/`，本次只修正规范中的错误路径并整理当前目录内部结构。

## Decisions

**决策 1：新增 `electron/main/migrations/scripts/` 存放所有具体迁移脚本。**

具体迁移脚本会持续增长，放在 `scripts/` 子目录能让根目录只承载迁移框架和公开入口。相比把脚本继续放在根目录，这个方案降低新增迁移时误改 `runner/store/types` 的概率；相比迁移到 `electron/main/infra/migrations/`，它不扩大改动范围，也与当前 `@main/migrations` 入口和 `guidelines/DataModel.md` 更一致。

**决策 2：由 `scripts/index.ts` 导出 `migrations: Migration[]`，根 `index.ts` 直接导入。**

`scripts/index.ts` 负责静态 import 和数组顺序，示例结构如下：

```ts
import { migrate as migrate001 } from "./20260601_001_config-options-camel-case";
import { migrate as migrate002 } from "./20260601_002_installed-at-iso";
import type { Migration } from "../types";

export const migrations: Migration[] = [
  { id: "20260601_001_config-options-camel-case", migrate: migrate001 },
  { id: "20260601_002_installed-at-iso", migrate: migrate002 },
];
```

`electron/main/migrations/index.ts` 保留 `runAllMigrations()`，改为 `import { migrations } from "./scripts";`。这样启动入口 `@main/migrations` 不变，后续新增迁移只需要改脚本目录和 `scripts/index.ts`。

**决策 3：不改变迁移 ID。**

迁移执行记录使用文件名不含扩展名作为 ID。移动文件路径不应改变 ID，否则已执行记录会失效并导致旧迁移被重复判定为新迁移。因此 `migrations` 数组中的 `id` 必须继续保持原值：`20260601_001_config-options-camel-case`、`20260601_002_installed-at-iso`。

**决策 4：用测试覆盖注册顺序，而不是运行时扫描。**

新增测试读取 `electron/main/migrations/scripts` 下符合 `YYYYMMDD_NNN_*.ts` 的脚本文件名，排除 `index.ts`，并断言 `migrations.map((m) => m.id)` 与文件名字母序去扩展名后的列表完全一致。该测试保留手动静态注册，同时防止漏注册、乱序注册或 ID 与文件名不一致。

## Risks / Trade-offs

- 路径移动可能遗漏相对 import 更新 → 在移动脚本后显式把 `import type { MigrationContext } from "./types"` 改为 `../types`，并运行 typecheck。
- 规范和 guideline 若只更新其中一个会继续产生冲突 → tasks 必须同时更新 `openspec/specs/data-migration/spec.md` 的 delta 和 `guidelines/DataModel.md`。
- 新增顺序测试依赖文件系统读取源码目录 → 测试只读取仓库内 `electron/main/migrations/scripts`，不读取用户数据目录，不影响迁移运行时。
- 手动注册仍可能被忘记 → 顺序测试在 CI 或本地测试中失败，提示开发者补齐 `scripts/index.ts`。

## Migration Plan

这是代码组织和开发约定迁移，不需要用户数据迁移。实施时移动 TypeScript 文件、修正 import 和测试即可；`data/migrations.json` 中已有 `executed[].id` 与 `baselineId` 不因路径移动而变化。

若实施后需要回滚，可将脚本移回 `electron/main/migrations/`，把 `migrations` 数组恢复到根 `index.ts`，并回滚对应 spec/guideline 更新。由于持久化格式未变，回滚不需要处理用户数据。

## Open Questions

无。
