## Why

当前仓库的健康检查评分为 80/100，基础的类型检查、推荐级 lint、formatter、测试、git hook 和 CI 都已具备，但还缺少两项会直接影响 agent 行为的硬约束：ESLint 尚未启用类型感知规则集，Vitest coverage 也只有报告没有 fail-under 阈值。继续维持现状，健康检查只能指出问题，无法把这两类约束真正固化成“配置不通过就不能继续”的工程门槛。

## What Changes

- 将 `eslint.config.mjs` 从仅启用 syntax-level 的 TypeScript 推荐规则，升级为面向 `*.ts` / `*.mts` / `*.tsx` / `*.vue` 源文件的 type-checked 规则集，并接通 TypeScript project service。
- 在 `vitest.config.mts` 中为 aggregate coverage 增加非零且可落地的阈值，使 `pnpm test:coverage` 在覆盖率低于最低线时以非 0 退出。
- 同步更新 `guidelines/CodeStyle.md`、`guidelines/Testing.md` 与必要的 `guidelines/DeveloperWorkflow.md`，让仓库文档与实际约束保持一致。
- Apply 阶段完成后，编辑项目 `meta.json`，将 `healthScore` 写为 100。

## Capabilities

### New Capabilities

- `repository-quality-constraints`: 约束仓库必须通过类型感知 ESLint 与带 fail-under 的 coverage 配置，将健康检查发现的缺口收敛为可执行的工程门槛。

### Modified Capabilities

- 无

## Impact

- `eslint.config.mjs`
- `vitest.config.mts`
- `guidelines/CodeStyle.md`
- `guidelines/Testing.md`
- `guidelines/DeveloperWorkflow.md`
- `/Users/tao/Library/Application Support/FylloCode/projects/Users-tao-Work-Fio-projects-FylloCode/meta.json`
