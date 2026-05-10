## 1. Shared Types

- [x] 1.1 Create `shared/types/task.ts` with `TaskItem`, `TaskSource`, `TaskStatus`, `TaskUser`, `TaskLabel`, `TaskSourceMeta`, `LocalTaskMeta`, `YunxiaoTaskMeta`, `GithubTaskMeta`, `CreateLocalTaskInput`
- [x] 1.2 Export new types from `shared/types/index.ts` (or equivalent entry point)

## 2. Main Process - Storage Layer

- [x] 2.1 Create `electron/main/infra/storage/task-store.ts` with `loadTasks(projectPath)`, `saveTasks(projectPath, tasks)`, `ensureTasksDir(projectPath)` functions
- [x] 2.2 Implement file path resolution: `tasksPath(projectPath)` returning `data/projects/<encodedPath>/tasks/tasks.json`
- [x] 2.3 Implement data normalization on read (safe defaults for missing optional fields)
- [x] 2.4 Add schema version field (`version: 1`) to storage format
- [x] 2.5 Add unit tests for task-store read/write operations

## 3. Main Process - Service Layer

- [x] 3.1 Create `electron/main/services/task/task-service.ts` with `listTasks(projectPath)`, `createTask(projectPath, input)`, `updateTask(projectPath, taskId, updates)`, `deleteTask(projectPath, taskId)`
- [x] 3.2 Implement `createTask` with ID generation using `generateId()` from `ai` package
- [x] 3.3 Implement `createTask` with timestamp auto-population (`createdAt`, `updatedAt`)
- [x] 3.4 Implement `createTask` with default values (`status: "open"`, `description: ""`, `labels: []`)
- [x] 3.5 Implement `updateTask` with partial updates and `updatedAt` refresh
- [x] 3.6 Implement `deleteTask` with existence check (return error if task not found)
- [x] 3.7 Add unit tests for task-service CRUD operations

## 4. Main Process - Adapter Layer (Future-Proofing)

- [x] 4.1 Create `electron/main/services/task/adapters/task-adapter.ts` with `TaskAdapter` interface defining `list(projectId): Promise<TaskItem[]>`, `get(taskId, projectId): Promise<TaskItem | null>`
- [x] 4.2 Create `electron/main/services/task/adapters/local-task-adapter.ts` implementing `TaskAdapter` using task-service functions
- [x] 4.3 Create `electron/main/services/task/adapters/yunxiao-task-adapter.ts` implementing `TaskAdapter` with stub methods (return empty arrays, throw "Not implemented")
- [x] 4.4 Create `electron/main/services/task/adapters/github-task-adapter.ts` implementing `TaskAdapter` with stub methods (return empty arrays, throw "Not implemented")
- [x] 4.5 Create `electron/main/services/task/task-aggregator.ts` that aggregates results from all adapters based on requested source filter

## 5. Main Process - IPC Layer

- [x] 5.1 Add task channel definitions to `shared/types/channels.ts`: `task:list`, `task:create`, `task:update`, `task:delete`
- [x] 5.2 Create `electron/main/ipc/task.ts` with IPC handlers for all four channels
- [x] 5.3 Implement `task:list` handler accepting `{ projectId, source? }` and returning `TaskItem[]`
- [x] 5.4 Implement `task:create` handler accepting `CreateLocalTaskInput` and `projectId`
- [x] 5.5 Implement `task:update` handler accepting `taskId`, partial updates, and `projectId`
- [x] 5.6 Implement `task:delete` handler accepting `taskId` and `projectId`
- [x] 5.7 Register task IPC handlers in the main process bootstrap
- [x] 5.8 Add IPC type definitions for task channels in preload script

## 6. Frontend - API Layer

- [x] 6.1 Create `frontend/src/api/task.ts` with `listTasks(projectId, source?)`, `createTask(projectId, input)`, `updateTask(projectId, taskId, updates)`, `deleteTask(projectId, taskId)`
- [x] 6.2 Wrap all API calls with `IpcResponse<T>` pattern consistent with other API modules

## 7. Frontend - Store Layer

- [x] 7.1 Create `frontend/src/stores/task.ts` Pinia store with `tasks`, `loading`, `error` refs
- [x] 7.2 Implement `loadTasks(source?: TaskSource)` action calling `taskApi.listTasks`
- [x] 7.3 Implement `createTask(input)` action calling `taskApi.createTask` and updating local state
- [x] 7.4 Implement `updateTask(taskId, updates)` action calling `taskApi.updateTask` and updating local state
- [x] 7.5 Implement `deleteTask(taskId)` action calling `taskApi.deleteTask` and removing from local state
- [x] 7.6 Implement computed `filteredTasks` for status filtering (open/closed)
- [x] 7.7 Implement computed `tasksBySource` for source filtering (all/local/yunxiao/github)

## 8. Frontend - Components

- [x] 8.1 Create `frontend/src/components/task/TaskCard.vue` component
- [x] 8.2 TaskCard: display source icon, source label, title, description (2-3 line clamp), creation time
- [x] 8.3 TaskCard: display status badge (open = blue, closed = gray)
- [x] 8.4 TaskCard: display associated proposal info if `proposalId` exists (plain text, non-clickable)
- [x] 8.5 TaskCard: render "发起讨论" primary button with click handler
- [x] 8.6 TaskCard: render delete button for local tasks with confirmation dialog
- [x] 8.7 Create `frontend/src/components/task/CreateTaskModal.vue` component
- [x] 8.8 CreateTaskModal: title input field (required, with validation)
- [x] 8.9 CreateTaskModal: description textarea (optional)
- [x] 8.10 CreateTaskModal: submit and cancel buttons

## 9. Frontend - Page

- [x] 9.1 Rewrite `frontend/src/pages/task.vue` with full task panel layout
- [x] 9.2 Add page header: "任务面板" title + description + "新建任务" button
- [x] 9.3 Add channel filter tabs: "本地", "云效", "GitHub"
- [x] 9.4 Implement channel tab switching with `UTabs` (local / yunxiao / github)
- [x] 9.5 Add status filter radio group: "打开", "关闭" (visible only for "本地" tab)
- [x] 9.6 Implement status filter interaction
- [x] 9.7 Render TaskCard list: local tasks from store with status filter; yunxiao/github from mock data
- [x] 9.8 Implement loading state with spinner (local tab only)
- [x] 9.9 Implement error state display (local tab only)
- [x] 9.10 Implement empty state for no local tasks
- [x] 9.11 Pre-define mock Yunxiao tasks (3 items) with realistic `sourceMeta`
- [x] 9.12 Pre-define mock GitHub tasks (3 items) with realistic `sourceMeta`
- [x] 9.13 Wire "新建任务" button to open CreateTaskModal
- [x] 9.14 Wire TaskCard "发起讨论" button to `startChatFromTask(task)` function
- [x] 9.15 Implement `startChatFromTask(task)` calling `sessionStore.beginDraftSession()`, then `chatStore.sendMessage(prompt)`, then `router.push('/chat')`
- [x] 9.16 Implement prompt generation function with consistent template across sources
- [x] 9.17 Handle empty description in prompt generation (omit description section)
- [x] 9.18 Add external URL button on TaskCard for yunxiao/github tasks (opens in browser)
- [x] 9.19 Add proposal association display on TaskCard (non-clickable, plain text)
- [x] 9.20 Handle source tab auto-switch: after creating a task from yunxiao/github tab, switch back to local tab

## 10. Integration & Testing

- [ ] 10.1 Verify `/task` route renders correctly in app shell
- [ ] 10.2 Verify ActivityBar `/task` navigation still works (no regression)
- [ ] 10.3 Test create task → task appears in list → task card displays correctly
- [ ] 10.4 Test click "发起讨论" → navigates to `/chat` → session created with task prompt
- [ ] 10.5 Test channel filter tabs: "本地" shows real tasks with CRUD, "云效/GitHub" show mock data
- [ ] 10.6 Test status filter: "打开" shows open, "关闭" shows closed (local tab only)
- [ ] 10.7 Test delete task with confirmation
- [ ] 10.8 Test empty description task prompt generation (no description section)
- [x] 10.9 Run type check: `pnpm typecheck`
- [x] 10.10 Run linter: `pnpm lint`
- [x] 10.11 Run tests: `pnpm test`
- [ ] 10.12 Verify no regression on existing chat functionality
- [ ] 10.13 Verify TaskCard external URL button opens browser for yunxiao/github tasks
- [ ] 10.14 Verify `buildFallbackSessionTitle` extracts task title from prompt correctly

## 11. Cleanup

- [x] 11.1 Remove old placeholder task.vue content (backup not needed)
- [x] 11.2 Verify all new files follow project code style conventions
- [ ] 11.3 Update `.openspec.yaml` status to `ready`
