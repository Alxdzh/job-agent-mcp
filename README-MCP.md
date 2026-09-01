# MCP 接入说明

本仓库把求职工作台接入 Agent。安装后，Agent 可以调用本地工具读取状态、修改投递设置、打开浏览器和执行投递。

## 安装

Windows：

```powershell
.\install-mcp.bat --client auto
```

macOS / Linux：

先安装 Node.js 22.12+ 和 Google Chrome，再执行：

```bash
sh install-mcp.sh --client auto
```

`auto` 会注册本机已安装的客户端。也可以把它换成 `codex`、`claude`、`opencode` 或 `workbuddy`。

如果仓库还没有下载：

```bash
git clone https://github.com/Alxdzh/job-agent-mcp.git
cd job-agent-mcp
```

然后按系统执行上面的安装命令。

## 让 Agent 从 GitHub 安装

把下面整段消息发给可以执行本地终端命令的 Agent。它会先从 GitHub 拉取仓库，再完成 MCP 注册，不要求当前目录已经有项目：

```text
请直接从 GitHub 安装 Job Agent MCP，不要假设当前目录已经有仓库。

仓库地址：https://github.com/Alxdzh/job-agent-mcp.git
安装目录：当前用户主目录下的 job-agent-mcp

Windows PowerShell 请执行：
$dir = Join-Path $env:USERPROFILE 'job-agent-mcp'
if (Test-Path (Join-Path $dir '.git')) { git -C $dir pull --ff-only } else { git clone https://github.com/Alxdzh/job-agent-mcp.git $dir }
Set-Location $dir
.\install-mcp.bat --client auto

macOS/Linux 请执行：
dir="$HOME/job-agent-mcp"
if [ -d "$dir/.git" ]; then git -C "$dir" pull --ff-only; else git clone https://github.com/Alxdzh/job-agent-mcp.git "$dir"; fi
cd "$dir"
sh install-mcp.sh --client auto

如果安装目录存在但不是这个仓库，不要覆盖，先报告冲突路径。安装完成后验证 job-agent MCP 已注册并列出可用工具。安装和连接不会自动开始投递。
```

## WorkBuddy 自动注册

WorkBuddy 没有可依赖的 MCP 命令行工具，安装器会直接写入：

```text
~/.workbuddy/mcp.json
```

可以在仓库根目录执行：

```bash
node tools/install-mcp.mjs --client workbuddy
```

也可以使用 `--client auto` 自动识别 WorkBuddy。写入的配置包含 Node 可执行文件、`mcp-server.mjs`、`cwd`，以及 `JOB_AGENT_CONFIG_DIR`、`JOB_AGENT_STORAGE_DIR`、`BOSS_DAEMON_STATE`、`BOSS_CHROME_PATH` 四个环境变量。

如果 WorkBuddy 正在运行并锁定配置文件，安装器不会中断安装，而是打印完整配置块。重启 WorkBuddy 后重新运行安装，或将配置块粘贴到 WorkBuddy 的“自定义连接器”并点“信任”即可。

## 常用工具顺序

```text
job_get_workflow
  -> job_get_status
  -> job_get_delivery_config
  -> job_update_delivery_preferences
  -> job_open_boss_login
  -> job_start_hunt 或 job_start_continuous_hunt
  -> job_get_status
  -> job_pause_hunt / job_resume_hunt / job_stop_continuous_hunt
```

定量投递使用 `job_start_hunt`；持续投递使用 `job_start_continuous_hunt`。服务启动和 MCP 连接不会自动投递。

## 工作台

需要填写投递资料、登录平台或查看浏览器状态时，Windows 双击桌面快捷方式或 `start.bat`；macOS/Linux 执行 `npm start`。

默认使用可见 Chrome 页面，平台操作通过页面控件完成。

## 手动配置

没有客户端 CLI 时运行：

```bash
node tools/install-mcp.mjs --print
```

将输出内容添加到客户端的 MCP 配置即可。

## 相关版本

- [独立版](https://github.com/Alxdzh/job-agent-standalone)
- [完整说明](README.md)

## 第三方声明

本仓库包含来自 [geekgeekrun](https://github.com/geekgeekrun/geekgeekrun) 的 `laodeng` 第三方源码，详情见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
