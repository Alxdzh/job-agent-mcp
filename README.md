# 求职管家 MCP 版

这是一个供外部成熟 Agent 调用的本地 MCP 执行端。它本身不是聊天机器人，也不负责理解用户的自然语言对话；它通过标准 MCP 协议提供资料、配置、登录、状态、JD 判断和招聘平台投递工具，由接入它的 Agent 负责讨论、规划并决定何时调用这些工具。

需要直接打开一个网页工作台、手填资料并自己点击开始投递，请使用配套的 [求职管家独立版](https://github.com/Alxdzh/job-agent-standalone)。两个仓库功能定位相连，但启动入口不同。

## 这个版本能做什么

MCP 服务向外部 Agent 提供以下能力：

- **读取工作流和真实状态**：读取当前任务、目标数、剩余数、已扫描、成功、跳过原因、平台冷却、浏览器 URL/页面状态、投递统计和云端模型 API 是否就绪。
- **管理投递配置**：读取或修改城市、目标职位、薪资、平台启用状态、公司排除词和岗位风险排除词；默认修改长期配置，只有明确要求时才使用临时覆盖。
- **管理运行策略**：读取或修改可见/静默浏览器选项、每日投递开始/结束时间、随机批次数量、随机批次休息和岗位间隔。
- **管理资料和简历**：读取用户资料、保存已确认的简历版本，并在用户明确确认后请求同步到 BOSS。
- **登录和投递**：打开指定平台的可见原生 Chrome 完成登录；启动定量任务、启动不限数量的持续任务、暂停、恢复、停止并保留任务证据。
- **读取本地记录**：列出实际保存到本地数据库的投递记录，区分平台、岗位和结果。

支持的平台是 BOSS 直聘、智联招聘、51job（前程无忧）和猎聘。每个平台有独立的启用状态、登录态、搜索条件、页面适配和冷却计时。城市、关键词、筛选、详情和投递由浏览器页面上的真实控件完成，不用城市码或查询 URL 代替点击。

## 外部 Agent 应该怎么工作

外部 Agent 的推荐调用顺序是：

1. 先调用 `job_get_workflow`，了解投递和写入规则。
2. 用户问“现在投了多少”“为什么没投”或“卡在哪里”时，先调用 `job_get_status`，再根据返回的证据回答，不能凭猜测声称任务正在运行。
3. 用户改变城市、职位或薪资时，先调用 `job_get_delivery_config`，确认后调用 `job_update_delivery_preferences`；没有说“只这一次”时按长期配置处理。
4. 用户说“投一个/投 30 个”时，调用 `job_start_hunt` 并传入明确数量；用户说“开始持续投递”时，调用 `job_start_continuous_hunt`。启动服务本身不会投递。
5. 用户说停止或暂停时，调用对应的停止/暂停工具，再用 `job_get_status` 确认实际状态。
6. 遇到登录失效、验证码、风控、城市错位、弹窗或页面异常时，告诉用户查看可见浏览器；人工处理后，只有得到确认才调用恢复工具。

MCP 工具不会提供聊天、HR 回复、QQ 或微信连接，也不会把外部 Agent 的模型自动转交给后台 worker。后台无人值守读取 JD 和匹配判断，需要用户在工作台设置中填写自己的云端模型 API；外部 Agent 的模型负责对话、研究和规划。

## 安装和接入

### 共同准备

需要 Node.js 22.12+、系统 Google Chrome，以及本仓库 `daemon` 目录的 npm 依赖。GitHub 源码仓库不提交 `node_modules`，首次安装需要网络执行 npm 安装；安装时会使用系统 Chrome，不额外下载 Chromium。

在仓库根目录执行：

#### Windows PowerShell

```powershell
Set-Location .\daemon
$env:PUPPETEER_SKIP_DOWNLOAD = "1"
npm install
```

#### macOS / Linux

```bash
cd daemon
export PUPPETEER_SKIP_DOWNLOAD=1
npm install
```

### 配置 MCP 客户端

1. 复制 `daemon/mcp-config.example.json`。
2. 把 `<absolute-path-to-job-agent>` 换成仓库解压后的绝对路径。Windows 推荐在 JSON 中使用正斜杠，例如 `C:/Tools/job-agent-mcp`，避免反斜杠转义问题。
3. 将配置导入支持 MCP 的外部 Agent，重新连接该 MCP 服务。
4. 让外部 Agent 调用 `job_get_status` 或 `job_get_workflow` 验证连接。

配置示例：

```json
{
  "mcpServers": {
    "job-agent": {
      "command": "node",
      "args": ["C:/Tools/job-agent-mcp/daemon/mcp-server.mjs"]
    }
  }
}
```

如果 MCP 客户端找不到 `node`，把 `command` 换成 Node.js 的绝对路径，例如 Windows 的 `C:/Program Files/nodejs/node.exe`。不要把 API Key、Cookies 或浏览器用户目录写进 MCP 配置文件。

### 手动测试 MCP 服务

在仓库根目录执行：

```bash
node daemon/mcp-server.mjs
```

这是 stdio 服务，正常运行时不会把业务输出打印到 stdout；让 MCP 客户端启动它即可。若希望先用网页工作台填写资料、检查登录和查看状态，可运行本仓库附带的 `one-click-start.bat`（Windows）或 `node daemon/index.mjs`；这只是工作台入口，不会自动开始投递。

## 登录、投递和停止

- 登录由外部 Agent 调用 `job_open_boss_login`（参数可指定 `boss`、`zhilian`、`job51` 或 `liepin`），随后用户在弹出的可见 Chrome 中扫码或登录。
- 定量投递使用 `job_start_hunt`，必须传入 `maxJobs`；持续投递使用 `job_start_continuous_hunt`，不接受固定数量，按每日时间窗和平台节奏运行。
- `job_pause_hunt` 暂停当前任务并保留剩余数；`job_resume_hunt` 继续保存的剩余任务；`job_stop_continuous_hunt` 停止不限量任务。
- 每个平台在自己的批次后进入随机冷却，其他已登录且可投递的平台可以在此期间运行；到达每日结束时间后不再启动新岗位。
- 默认浏览器可见；“静默模式”只有用户主动设置后才生效。验证码、风控和异常页面需要人工处理，MCP 不承诺或执行验证码绕过。

## 数据与安全

本仓库是脱敏模板，不包含 API Key、个人资料、简历、历史投递记录、Cookies、浏览器登录态或本地数据库。首次运行时配置和运行数据保存在当前用户目录及 `daemon/state`、`daemon/log`。换电脑需要重新登录；不要将这些运行目录提交到 GitHub。

## 第三方声明

本仓库保留了 `@geekgeekrun/puppeteer-extra-plugin-laodeng` 浏览器插件源码。它来自第三方项目 [geekgeekrun](https://github.com/geekgeekrun/geekgeekrun)，随附包元数据没有声明许可证，不属于本项目 MIT 许可证的授权范围，本项目也没有将它重新授权。公开发布或分发包含该源码的版本前，请先获得上游授权，具体边界见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 相关版本

- [求职管家独立版](https://github.com/Alxdzh/job-agent-standalone)：不接入外部 Agent，用户直接在本地工作台填写和操作。
- [`README-MCP.md`](README-MCP.md)：MCP 接入的快速说明。

## 许可证

本项目自有代码按 [`LICENSE`](LICENSE) 发布。第三方组件不自动适用本项目许可证，请同时阅读 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) 和 [`SECURITY.md`](SECURITY.md)。
