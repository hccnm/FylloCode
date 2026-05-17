## MODIFIED Requirements

### Requirement: 任务面板提供渠道筛选标签

系统 SHALL 在任务列表顶部渲染渠道筛选标签，其中“本地”标签固定存在，其他第三方标签 SHALL 由当前项目在 `/integration` 的 `project-management` 阶段已挂载的 provider 资源动态感知生成。仅当当前项目存在至少一条属于某 provider 的项目级挂载资源时，该 provider 的任务来源标签才 SHALL 出现在 `/task` 页。provider 的全局连接状态或凭证是否过期 SHALL NOT 影响标签是否出现。本次真实接入阶段中，“云效”标签 SHALL 在当前项目挂载至少一个 `yunxiao / projex-project` 资源时出现，并显示真实云效任务；未挂载时 SHALL NOT 显示“云效”标签。当前实现中的 GitHub 仍可继续保留为后续阶段能力，不要求本 change 同步接入真实数据。

#### Scenario: 当前项目未挂载云效项目

- **WHEN** 用户已连接云效 provider，但当前项目的 `project-management` 阶段没有任何 `yunxiao / projex-project` 挂载资源
- **THEN** `/task` 页面不显示“云效”标签

#### Scenario: 当前项目挂载了至少一个云效项目

- **WHEN** 当前项目的 `project-management` 阶段存在至少一条 `{ providerId: "yunxiao", resourceType: "projex-project" }` 挂载资源
- **THEN** `/task` 页面显示“云效”标签
- **AND** 点击该标签后页面加载真实云效任务，而非 mock 数据

#### Scenario: 云效已挂载但 provider 断开连接或凭证过期

- **WHEN** 当前项目仍保留云效挂载资源，但云效 provider 已断开连接或凭证过期
- **THEN** `/task` 页面仍显示“云效”标签
- **AND** 标签可见性不因 provider 当前可用性而变化

### Requirement: 任务面板以可滚动卡片列表渲染任务

系统 SHALL 在 `/task` 主内容区渲染垂直滚动的任务卡片列表。每张卡片 SHALL 显示任务标题、描述摘要、来源标识、创建时间和状态指示器。任务页顶部说明文案 SHALL 为“集中查看任务，并快速发起 AI 讨论。”。

#### Scenario: 任务页文案覆盖本地与第三方任务

- **WHEN** 用户导航至 `/task`
- **THEN** 页面顶部说明文案显示“集中查看任务，并快速发起 AI 讨论。”

#### Scenario: 云效来源下无可展示任务

- **WHEN** 用户切换到“云效”标签且最终没有任何可展示任务
- **THEN** 页面复用当前任务页已有的“暂无任务”空态结构
- **AND** 不区分“未挂载云效项目”与“已挂载但结果为 0”两种文案

### Requirement: 任务面板显示任务来源标识

每张任务卡片 SHALL 显示来源特定的标识，标明任务的来源系统（如“本地”“云效 YX-1024”“example/repo#88”）。标识 SHALL 包含代表来源系统的图标。对于第一阶段真实云效任务，系统 SHALL 使用 `sourceMeta.key` 渲染来源标识；`sourceMeta.url` 允许为空，因此“任务来源”按钮在无 URL 时 MAY 不显示。

#### Scenario: 显示真实云效任务来源标识

- **WHEN** 页面显示一条真实云效任务且该任务包含 `sourceMeta.key`
- **THEN** 卡片显示“云效 <key>”作为来源标识
- **AND** 若该任务未提供 `sourceMeta.url`，卡片不显示“任务来源”按钮
