## 1. 前端 UI 清理

- [x] 1.1 `WelcomeView.vue`: 移除 "创建项目" 按钮、`handleCreateProject` 函数、`useWelcomeStore` 和 `CreateProjectModal` 导入及组件引用
- [x] 1.2 `AppHeader.vue`: 移除项目切换器下拉中的 "创建新项目" 选项、`useWelcomeStore` 和 `CreateProjectModal` 导入及组件引用
- [x] 1.3 删除 `frontend/src/components/CreateProjectModal.vue` 文件

## 2. Store 和类型清理

- [x] 2.1 删除 `frontend/src/stores/welcome.ts`
- [x] 2.2 删除 `frontend/src/types/welcome.ts`
- [x] 2.3 `frontend/src/stores/index.ts`: 移除 `welcome` store 导出
- [x] 2.4 `frontend/src/stores/project.ts`: 移除 `CreateProjectForm` 导入、`createProject` action、`defaultProjectPath` ref、`ensureDefaultPath` 方法

## 3. IPC 与共享类型清理

- [x] 3.1 `frontend/src/api/project.ts`: 移除 `create` 方法和 `CreateProjectForm` 导入
- [x] 3.2 `electron/preload/api/project.ts`: 移除 `create` 方法和 `CreateProjectForm` 导入
- [x] 3.3 `shared/types/channels.ts`: 移除 `create: "project:create"` channel
- [x] 3.4 `shared/schemas/ipc/project.ts`: 移除 `createProjectInputSchema`
- [x] 3.5 `shared/types/project.ts`: 移除 `CreateProjectForm` 接口和 `ProjectTemplate` 类型

## 4. 主进程清理

- [x] 4.1 `electron/main/ipc/project.ts`: 移除 `createProjectInputSchema` 导入、`createProject` 函数导入、`ProjectChannels.create` handler
- [x] 4.2 `electron/main/services/project/project-service.ts`: 移除 `CreateProjectForm` 导入、`createProject` 函数

## 5. 测试与验证

- [x] 5.1 `frontend/src/__tests__/stores/project.spec.ts`: 更新 mock 对象，移除 `create` 和 `getDefaultPath`
- [x] 5.2 运行 `pnpm typecheck` 确认无类型错误
- [x] 5.3 运行 `pnpm test` 确认测试通过
