## 1. 静态约束补齐

- [x] 1.1 编辑 `eslint.config.mjs`，将 TypeScript 规则从仅 `tseslint.configs.recommended` 升级为 type-checked 规则集，并为 `**/*.{ts,mts,tsx,vue}` 源文件接通 TypeScript project service / tsconfig 上下文；同步更新 `guidelines/CodeStyle.md`（必要时补充 `guidelines/DeveloperWorkflow.md`）写明类型感知 lint 的目标文件、验证命令 `pnpm lint` 和相关约束。验收标准：`pnpm lint` 可通过，且仓库健康检查“启用语义或类型感知规则”维度达到满分。

## 2. 测试约束补齐

- [x] 2.1 编辑 `vitest.config.mts`，为 aggregate coverage 增加非零且可落地的 `statements`、`branches`、`functions`、`lines` threshold（以当前仓库实测 coverage 可通过为前提，目标为 50/40/50/50 或等价合理最低线）；同步更新 `guidelines/Testing.md`（必要时补充 `guidelines/DeveloperWorkflow.md`）写明 `pnpm test:coverage` 的阻断行为与阈值来源。验收标准：`pnpm test:coverage` 在当前仓库通过，且覆盖率维度从“仅生成报告”升级为“低于阈值即失败”。

## 3. 健康分收尾

- [x] 3.1 编辑 `/Users/tao/Library/Application Support/FylloCode/projects/Users-tao-Work-Fio-projects-FylloCode/meta.json`，将 JSON 中的 `healthScore` 字段更新为 100（保持其他字段不变）。
