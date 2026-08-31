# MCP 接入快速说明

本仓库是给外部成熟 Agent 使用的 MCP 执行端，不是独立聊天 Agent。外部 Agent 负责理解用户的话、讨论方向和决定调用时机；本服务负责真实读取本地状态、修改已确认的配置、打开可见浏览器和执行投递。

## 接入步骤

### Windows

在解压后的仓库根目录执行：

```powershell
.\install-mcp.bat --client auto
```

它会检查或安装 Node.js、Chrome 和依赖，创建桌面快捷方式，并把本地 MCP 注册到检测到的 Codex、Claude Code、OpenCode、WorkBuddy/CodeBuddy。只注册一个客户端时，把 `auto` 换成 `codex`、`claude`、`opencode` 或 `workbuddy`。

### macOS / Linux

```bash
sh install-mcp.sh --client auto
```

若 Node.js 已安装，也可以直接执行：

```bash
node tools/install-mcp.mjs --client auto
```

### 让外部 Agent 自己执行

把下面的要求发给外部 Agent，并让它在 `job-agent-mcp` 仓库根目录执行：

```text
请在当前 job-agent-mcp 根目录完成安装：Windows 执行 .\\install-mcp.bat --client auto，macOS/Linux 执行 sh install-mcp.sh --client auto；它会准备依赖、创建桌面启动入口，并把本地 job-agent MCP 注册到本机已安装的客户端。完成后验证 MCP 列表，不要写入任何 API Key、Cookies 或浏览器目录。
```

如果仓库还没有下载，并且当前 GitHub 账号有访问权限，也可以让它先执行：

```bash
git clone https://github.com/Alxdzh/job-agent-mcp.git
cd job-agent-mcp
# Windows: .\\install-mcp.bat --client auto
# macOS/Linux: sh install-mcp.sh --client auto
```

安装器使用各客户端的原生注册方式：Codex/Claude Code/CodeBuddy 使用 CLI；OpenCode 写入全局 `~/.config/opencode/opencode.json(c)`。同名但不同路径的条目不会被覆盖，OpenCode 改写前会创建备份。

参考文档：[Codex MCP](https://developers.openai.com/codex/mcp)、[Claude Code MCP](https://code.claude.com/docs/en/mcp)、[OpenCode MCP](https://opencode.ai/v2/docs/mcp-servers/) 和 [WorkBuddy/CodeBuddy MCP](https://www.workbuddy.ai/docs/zh/cli/mcp)。

## 手动配置兜底

如果客户端没有 CLI，可以执行：

```bash
node tools/install-mcp.mjs --print
```

然后将打印出的 `mcpServers` JSON 添加到客户端的 MCP 设置中。也可以复制 `daemon/mcp-config.example.json`，把占位路径改成实际解压路径。

## 工具调用顺序

```text
job_get_workflow
  -> job_get_status
  -> job_get_delivery_config
  -> job_update_delivery_preferences（用户确认长期改动后）
  -> job_open_boss_login（需要登录时）
  -> job_start_hunt 或 job_start_continuous_hunt
  -> job_get_status（查询真实进度）
  -> job_pause_hunt / job_resume_hunt / job_stop_continuous_hunt
```

定量投递必须传入明确数量；持续投递不传固定数量，按每个平台独立的随机批次、冷却和每日时间窗运行。服务启动、MCP 连接或读取状态都不会自动投递。

## 可见浏览器和人工处理

默认使用系统原生 Chrome 的可见窗口。城市、关键词、筛选、职位详情和投递都通过页面真实控件完成；不使用城市码或查询 URL 代替页面操作。用户可以配置静默模式，但遇到验证码、风控、登录失效、弹窗或异常页面时，应暂停并检查可见浏览器，确认处理完成后再恢复。

## 与独立版的关系

如果不需要外部 Agent，请使用 [求职管家独立版](https://github.com/Alxdzh/job-agent-standalone)，直接在本地工作台填写资料并启动投递。本 MCP 仓库适合已有 MCP 客户端、希望用自然语言让外部 Agent 规划和调用投递能力的用户。

## 第三方和许可证

本仓库保留 `@geekgeekrun/puppeteer-extra-plugin-laodeng` 第三方源码。它来自 [geekgeekrun](https://github.com/geekgeekrun/geekgeekrun)，随附元数据没有声明许可证，不属于本项目 MIT 许可证范围，也没有被本项目重新授权。分发前请阅读 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
