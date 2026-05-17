## MODIFIED Requirements

### Requirement: Provider 连接表单支持 API Token 与 OAuth 两种形态

对于使用 API Token 认证的 provider，系统 SHALL 在卡片展开后显示带标签输入字段的表单，每个字段 SHALL 包含帮助文本与帮助链接，并提供"测试连接"与"连接"按钮。对于使用 OAuth 认证的 provider，系统 SHALL 显示"通过 {Provider 名称} 连接"按钮作为入口。对于本次真实实现的 `providerId = "yunxiao"`，连接成功后系统 SHALL 在 `{userData}/integrations/credentials/yunxiao.json` 中至少持久化以下字段：`"x-yunxiao-token"`、`userId`、以及已存在或本次推断得到的 `organizationId`（若可得）；其中 `userId` MUST 来自连接时 `getUser()` 返回的 `user.id`，而不是 `connections.json` 中的 `accountId` 回读结果。

#### Scenario: API Token 形态的 provider 连接流程

- **WHEN** 用户展开一张未连接的 API Token 类型 provider 卡片
- **THEN** 卡片内显示该 provider 所需凭据的输入字段
- **AND** 每个字段带有标签、帮助文本和帮助链接
- **AND** 提供"测试连接"与"连接"按钮

#### Scenario: OAuth 形态的 provider 连接入口

- **WHEN** 用户展开一张未连接的 OAuth 类型 provider 卡片
- **THEN** 卡片内显示"通过 {Provider 名称} 连接"按钮

#### Scenario: 云效 provider 连接成功并补齐云效身份字段

- **WHEN** 用户为 `providerId = "yunxiao"` 输入有效凭据并点击"连接"
- **THEN** 主进程验证通过后将凭证写入 `{userData}/integrations/credentials/yunxiao.json`
- **AND** 同一文件中写入 `userId = getUser().id`
- **AND** 若已存在 `organizationId` 或本次可由 `user.lastOrganization` / `listOrganizations()` 推断出组织 ID，则保留或写入该 `organizationId`
- **AND** 在 `{userData}/integrations/connections.json` 中以 `providerId = "yunxiao"` 记录连接状态
- **AND** connection 记录中的 `accountId` 继续等于 `getUser().id`
- **AND** 卡片状态变为"已连接"，并展示已识别到的账户标识（如登录名或邮箱）

#### Scenario: 连接失败

- **WHEN** 用户输入无效凭据并点击"连接"
- **THEN** 主进程验证失败，不写入任何凭证或连接记录
- **AND** 表单下方显示具体错误信息（如"令牌无效""令牌已过期"）
- **AND** 卡片保持"未连接"状态

### Requirement: 已连接 Provider 支持凭证回显与断开

对于已连接的 provider，系统 SHALL 在卡片展开区显示脱敏后的凭证回显（如 `pt-0fh3****0484`）、已识别到的账户标识，并提供"断开连接"按钮。点击"断开连接" SHALL 清除该 provider 的 credentials 文件内容与 connections 记录。对于 `providerId = "yunxiao"`，这同时意味着系统 SHALL 删除或清空 `{userData}/integrations/credentials/yunxiao.json` 中的 `"x-yunxiao-token"`、`userId`、`organizationId`，而不是只清空 token。

#### Scenario: 重启后凭证状态回显

- **WHEN** 用户重启应用后打开集成提供方视图
- **THEN** 系统从 connections.json 读取已连接 provider 列表
- **AND** 每张已连接 provider 卡片显示"已连接"
- **AND** 展开后显示脱敏的凭证回显值

#### Scenario: 用户断开云效 Provider 连接

- **WHEN** 用户点击已连接的 `providerId = "yunxiao"` provider 的"断开连接"按钮
- **THEN** 主进程删除或清空 `{userData}/integrations/credentials/yunxiao.json` 中的 `"x-yunxiao-token"`、`userId`、`organizationId`
- **AND** 主进程删除 `{userData}/integrations/connections.json` 中对应的 `providerId = "yunxiao"` 记录
- **AND** 卡片状态更新为"未连接"
- **AND** 所有项目中引用该 provider 的资源选择项继续以"已选"状态展示，但被标注为"provider 未连接"不可用
