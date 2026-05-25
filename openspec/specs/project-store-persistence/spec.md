# project-store-persistence 规范

## Purpose

项目持久化规范定义项目元数据文件存储、项目列表加载、启动预热、按 ID 查询以及目录缺失处理行为。

## Requirements

### Requirement: Project 元数据持久化到文件系统

系统 SHALL 将每个 project 的元数据（id、name、path、createdAt、lastOpenedAt、可选的 healthScore）存储为 `data/projects/{encodedPath}/meta.json`，与 session 数据共用同一子目录结构。`ProjectInfo` SHALL 额外暴露该文件的绝对路径 `metaPath`，用于前端将外部代理（如 agent）的写入目标传递出去。

#### Scenario: 创建 project 写入 meta 文件

- **WHEN** 用户创建或打开一个新 project
- **THEN** 系统在 `data/projects/{encodedPath}/meta.json` 写入 project 元数据
- **AND** 文件包含 id、name、path、createdAt、lastOpenedAt 字段
- **AND** healthScore 字段仅在被显式写入后才出现

#### Scenario: 更新 project 元数据（含 healthScore）

- **WHEN** 前端调用 `project:update` 并传入 `patch: { healthScore: 80 }`
- **THEN** 系统读取现有 meta，合并 patch 字段（包含 healthScore），写回文件
- **AND** 返回的 `ProjectInfo.healthScore === 80`

#### Scenario: agent 直接编辑 meta.json 文件后主进程能读取

- **WHEN** agent 在 apply 阶段使用 Edit/Write 工具直接修改 `meta.json` 中的 `healthScore` 字段
- **AND** 用户随后触发 `project:getById`
- **THEN** 主进程从磁盘重新解析 `meta.json`，返回的 `ProjectInfo.healthScore` 反映 agent 写入的最新值

### Requirement: openFolder 通过系统对话框选择目录

系统 SHALL 通过 Electron dialog 让用户选择本地目录，并将其注册为 project。

#### Scenario: 用户选择已有目录

- **WHEN** 前端调用 `project:openFolder`
- **THEN** 系统弹出系统目录选择对话框
- **AND** 用户选择目录后，系统以目录名为 project name、目录路径为 project path，用 encodeProjectPath 生成 id，查找已有 meta 或创建新 meta，更新 lastOpenedAt
- **AND** 返回 ProjectInfo

#### Scenario: 用户取消选择

- **WHEN** 用户在目录选择对话框中点击取消
- **THEN** 系统返回 null，不创建任何 project

### Requirement: 打开项目时检测目录存在性

系统 SHALL 在打开项目时检测对应目录是否存在，不存在时提示用户，不自动移除记录。

#### Scenario: 目录不存在时提示用户

- **WHEN** 用户尝试打开一个目录已被移动或删除的 project
- **THEN** 系统检测到目录不存在，在返回的 ProjectInfo 中附加 pathMissing: true 标记
- **AND** 前端显示提示告知用户目录不存在
- **AND** 不切换当前项目，不自动移除该 project 记录

### Requirement: meta.json 存储 healthScore 字段

`ProjectMeta` 接口 SHALL 新增可选字段 `healthScore?: number`，取值范围 0–100，默认不存在时视为 0。`ProjectInfo` 接口 SHALL 同步新增 `healthScore?: number` 字段。`toProjectInfo` 函数 SHALL 将 `meta.healthScore` 透传到 `ProjectInfo.healthScore`。

#### Scenario: 新建项目 meta.json 不含 healthScore

- **WHEN** 用户创建或打开新项目
- **THEN** `meta.json` 不包含 `healthScore` 字段
- **AND** `ProjectInfo.healthScore` 为 `undefined`

#### Scenario: agent 通过编辑文件写入 healthScore 后可读取

- **WHEN** agent 在 apply 阶段直接编辑 `meta.json` 绝对路径文件，将 `healthScore` 设为 75
- **THEN** 下次前端调用 `project:getById` 时，返回的 `ProjectInfo.healthScore === 75`

### Requirement: ProjectInfo 暴露 meta.json 绝对路径

`ProjectInfo` 接口 SHALL 新增字段 `metaPath: string`，值为该项目 `meta.json` 的绝对路径，由主进程 `toProjectInfo` 在转换时基于 `id` 拼接 `getDataSubPath("projects")/{id}/meta.json` 得到。前端 SHALL 在向 agent 注入 system-reminder 时，使用此字段告知 agent 应编辑的目标文件路径。

#### Scenario: project:list 返回的每个项目都包含 metaPath

- **WHEN** 前端调用 `project:list`
- **THEN** 返回的每个 `ProjectInfo` 均包含 `metaPath` 字段
- **AND** `metaPath` 为绝对路径
- **AND** 路径形如 `<userData>/data/projects/<encodedPath>/meta.json`

#### Scenario: project:getById 返回的项目包含 metaPath

- **WHEN** 前端调用 `project:getById` 并传入有效 id
- **THEN** 返回的 `ProjectInfo` 包含 `metaPath` 字段
