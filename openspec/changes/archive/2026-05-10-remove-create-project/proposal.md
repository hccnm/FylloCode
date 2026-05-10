## Why

FylloCode 的核心理念是"打开现有代码文件夹即开始工作"，而非传统 IDE 的"先创建项目再打开"。创建项目功能（空项目模板、Git 克隆模板）与这一理念不符，且目前用户可通过"打开文件夹"完成所有工作流。移除该功能可简化 Welcome 页面和项目切换器交互，减少维护成本。

## What Changes

- **BREAKING**: 从 WelcomeView 移除"创建项目"按钮
- **BREAKING**: 删除 `CreateProjectModal` 组件及其所有关联逻辑
- **BREAKING**: 从 AppHeader 项目切换器下拉菜单移除"创建新项目"选项
- **BREAKING**: 删除 `project:create` IPC channel 及主进程 handler
- **BREAKING**: 删除 `CreateProjectForm`、`ProjectTemplate` 共享类型和 `createProjectInputSchema` schema
- 删除 `useWelcomeStore`（仅用于管理创建项目模态框状态）
- 删除 `projectApi.create`、`projectStore.createProject`、`projectStore.ensureDefaultPath`
- 清理前端、preload、主进程中所有与创建项目相关的代码和类型引用

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `welcome-page`: 移除"创建项目"按钮及点击交互 scenario；调整空态提示文案
- `project-creation`: **整个 capability 被移除** — 创建项目模态框、表单校验、模板选择、创建后跳转等所有 requirements 不再适用
- `project-switcher`: 移除下拉菜单中"新建项目"选项

## Impact

- **前端**: `WelcomeView.vue`、`AppHeader.vue`、`CreateProjectModal.vue`、`useWelcomeStore`、`useProjectStore`（移除 `createProject`、`ensureDefaultPath`）
- **IPC**: 删除 `project:create` channel handler（`electron/main/ipc/project.ts`）
- **Preload**: 删除 `projectApi.create`（`electron/preload/api/project.ts`）
- **共享类型**: 删除 `CreateProjectForm`、`ProjectTemplate`、`createProjectInputSchema`
- **主进程服务**: 删除 `createProject` 函数（`electron/main/services/project/project-service.ts`）
- **测试**: 更新 `project.spec.ts` mock（移除 `create`、`getDefaultPath`）
