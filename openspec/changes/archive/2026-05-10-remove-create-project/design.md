## Context

FylloCode 当前在 WelcomeView 和 AppHeader 的项目切换器中都提供了"创建项目"入口。用户可以通过模态框输入项目名称、选择存储路径、选择模板类型（空项目/Git 克隆）来创建新项目。创建后系统会创建目录、写入元数据、更新当前项目上下文并跳转到工作区。

然而，FylloCode 的设计哲学是"打开现有代码文件夹即开始工作"，创建项目功能与这一理念冲突。且目前用户完全可以通过"打开文件夹"完成所有工作流，创建项目功能没有不可替代的价值。

## Goals / Non-Goals

**Goals:**

- 从所有 UI 入口移除"创建项目"功能
- 删除 `CreateProjectModal` 组件及相关状态管理
- 清理 `project:create` IPC 通道及前后端所有关联代码
- 删除 `CreateProjectForm`、`ProjectTemplate` 等共享类型定义
- 更新相关 spec，标记被移除的 requirements

**Non-Goals:**

- 不修改"打开文件夹"功能的任何行为
- 不修改项目持久化存储格式（meta.json 结构保持不变）
- 不修改最近项目列表的展示逻辑
- 不引入新的功能替代创建项目

## Decisions

**1. 完全删除而非禁用**

- **决策**: 直接删除所有创建项目相关代码，而不是通过条件渲染隐藏。
- **理由**: 该功能不会再被启用，保留死代码会增加维护成本。如果未来需要恢复，可以从 git 历史中找回。

**2. 同步清理 IPC、共享类型和主进程服务**

- **决策**: 一次性删除 `project:create` channel、preload API、前端 store action、主进程 handler 和服务函数。
- **理由**: 这些组件构成一个端到端功能链，部分删除会导致编译错误或运行时错误。必须完整清理。

**3. `createProjectMeta` 工具函数保留**

- **决策**: `electron/main/infra/storage/project-store.ts` 中的 `createProjectMeta` 保留。
- **理由**: 该函数被 `adoptExistingFolder`（打开文件夹）和 `updateProject` 继续使用，不是创建项目功能专属。

**4. `useWelcomeStore` 整个删除**

- **决策**: 删除 `useWelcomeStore` Pinia store 及其类型定义。
- **理由**: 该 store 的唯一职责是管理 `CreateProjectModal` 的显示状态。模态框删除后，store 无存在的必要。

**5. `ensureDefaultPath` 和 `defaultProjectPath` 一并删除**

- **决策**: 从 `useProjectStore` 中移除 `defaultProjectPath` ref 和 `ensureDefaultPath` 方法。
- **理由**: 这两个成员的唯一用途是为创建项目模态框提供默认存储路径。没有其他调用方。

## Risks / Trade-offs

- **[Risk]** 用户可能习惯于点击"创建项目"来开始工作。→ **Mitigation**: "打开文件夹"按钮将占据 WelcomeView 的完整宽度，成为更明显的入口。
- **[Risk]** 删除共享类型可能影响 TypeScript 编译。→ **Mitigation**: 逐步删除，每次删除后检查编译是否通过，确保没有遗漏的引用。
- **[Risk]** 测试中的 mock 对象引用了被删除的方法。→ **Mitigation**: 同步更新 `project.spec.ts` 中的 mock。
