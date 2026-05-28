## Context

本次健康检查按照仓库已实现的评分规范，对 10 个维度逐项核查。结果显示：

- 类型检查 strict 已达标：Node/Web tsconfig 继承 `@electron-toolkit/tsconfig` 的 `strict: true`，并显式保留 `noImplicitAny: true`
- Linter 推荐基线已达标：已启用 `typescript-eslint` recommended 与 `eslint-plugin-vue` recommended
- Formatter、test runner、真实测试执行、git hooks、pre-commit、CI 均达标
- 未达标项仅有两项：
  1. `eslint.config.mjs` 仅使用 `tseslint.configs.recommended`，未启用 `recommendedTypeChecked`
  2. `vitest.config.mts` 仅输出 coverage 报告，没有任何 threshold

这两个缺口都属于“配置存在但还没有达到最佳实践基线”的典型情况，且都会直接影响 agent 是否会被工程约束挡住。因此本 change 只处理这两项，不扩展到新增测试、补覆盖率内容或引入新的 CI job。

## Goals / Non-Goals

**Goals:**

- 让仓库的 TypeScript/Vue lint 从语法级检查升级为类型感知检查
- 让 `pnpm test:coverage` 具备明确、非零、会阻断失败的 aggregate coverage 阈值
- 让 guideline 文档明确记录这两项约束及验证方式
- 让健康检查 Apply 完成后可将 `healthScore` 提升到 100

**Non-Goals:**

- 不新增或重构业务功能代码
- 不为了追求更高阈值而补测现有低覆盖模块
- 不新增独立的 CI workflow、hook 工具或测试框架
- 不改变健康检查评分模型本身

## Decisions

### 决策 1：ESLint 采用 `recommendedTypeChecked`，而不是继续停留在 `recommended`

`recommended` 已覆盖常规语法问题，但无法利用 TypeScript program 信息识别未处理 Promise、不安全断言、误用 `any` 等类型相关风险。本次改动直接在 `eslint.config.mjs` 中切到 `tseslint.configs.recommendedTypeChecked`，并为需要类型信息的源文件配置 project service。

备选方案：

- 保持 `recommended` 不变，只增加少量手写规则：问题是仍然缺少类型语义基础，无法满足“类型感知规则”这一评分维度
- 一次性引入更激进的 strict type-checked 全家桶：风险是短期噪声过大，Apply 阶段容易演变为大范围清债，不符合本次只补健康检查缺口的范围

### 决策 2：coverage threshold 采用“高于 0、低于当前实测值”的落地阈值

当前实测 aggregate coverage 为：

- Statements: 59.02%
- Branches: 49.59%
- Functions: 56.02%
- Lines: 59.83%

因此本次阈值应设置为一个当前仓库可以稳定通过、但又不是象征性数字的最低线。建议采用：

- statements: 50
- branches: 40
- functions: 50
- lines: 50

备选方案：

- 阈值设为 0 或 1：不满足健康检查评分规范，仍然按未达标处理
- 阈值直接设到 60/50/60/60 或更高：当前仓库会立即失败，Apply 阶段会被迫扩展为“补大量测试”，超出本 change 范围

### 决策 3：文档更新并入对应维度任务，不单拆额外维度任务

健康检查 reminder 要求“每个未达标维度对应一条改进任务”。因此 guideline 更新不单独拆成第 3 个改进维度，而是并入 ESLint 与 coverage 两个任务中，各自明确需要同步更新的 guideline 文件与验收条件。

## Risks / Trade-offs

- [类型感知 lint 可能暴露新的历史问题] → 将 type-checked 规则范围限定在实际源码文件，并在任务中要求复用现有 TS/Vue parser 配置，不扩大到生成文件和无关产物
- [coverage 阈值设置过高导致 proposal 无法 apply] → 以当前实测 coverage 作为阈值上界，先固化最低可接受线
- [文档与配置再次漂移] → 在每个实施任务里把 guideline 更新列为验收标准，而不是事后补写

## Migration Plan

1. 更新 `eslint.config.mjs` 到 type-checked 配置，并运行 `pnpm lint`
2. 更新 `vitest.config.mts` coverage threshold，并运行 `pnpm test:coverage`
3. 同步更新相关 guideline 文档，确保规则、命令与目标文件路径一致
4. Apply 阶段完成后，编辑项目 `meta.json`，写入 `healthScore: 100`

## Open Questions

- 无。当前范围、目标分和阈值策略已收敛。
