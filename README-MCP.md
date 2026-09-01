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

如果仓库还没有下载，Windows 请在 PowerShell 中执行；不要在 Git Bash、Cygwin 或 MSYS2 中把 Windows 路径传给 `git -C`：

```powershell
$installRoot = Join-Path $env:USERPROFILE 'job-agent-mcp'
$repoMarker = Join-Path $installRoot '.git'
if (Test-Path -LiteralPath $repoMarker) {
  git -C $installRoot pull --ff-only
} elseif (Test-Path -LiteralPath $installRoot) {
  throw "安装目录已存在但不是 Job Agent 仓库：$installRoot"
} else {
  git clone -- https://github.com/Alxdzh/job-agent-mcp.git $installRoot
}
Set-Location -LiteralPath $installRoot
```

然后按系统执行上面的安装命令。

## 在 WorkBuddy 里直接安装

在 WorkBuddy 对话框直接发送下面这句话，让 WorkBuddy 自己完成 GitHub 拉取、插件安装和 MCP 启用：

```text
请从 GitHub 安装并启用 Job Agent MCP：
https://github.com/Alxdzh/job-agent-mcp

请使用仓库里的 WorkBuddy 插件清单完成安装，并在安装后验证 job-agent MCP 已连接、工具可以列出。如果需要先添加 GitHub 插件源，请自动完成。首次启动需要准备依赖时请自动完成，不要让我打开终端或手动填写配置。安装和连接完成后不要自动开始投递，等我明确下达投递指令。
```

仓库内置 `.workbuddy-plugin/plugin.json` 和 `.mcp.json`。WorkBuddy 会通过插件配置启动本地服务；服务首次启动时使用 WorkBuddy 自带的 Node.js 准备依赖，配置和运行数据写入当前用户目录。这个路径不需要改写 WorkBuddy 的配置文件，也不会依赖 Git Bash 的路径转换。

## 其他客户端从 GitHub 安装

如果使用的是 Codex、Claude Code 或 OpenCode，把下面这段消息发给客户端即可。它会先从 GitHub 拉取仓库，再完成 MCP 注册：

```text
请从 GitHub 安装 Job Agent MCP，不要假设当前目录已经有仓库。Windows 安装段使用 PowerShell。

仓库地址：https://github.com/Alxdzh/job-agent-mcp.git
安装目录：当前用户主目录下的 job-agent-mcp

Windows PowerShell 请执行：
$installRoot = Join-Path $env:USERPROFILE 'job-agent-mcp'
$repoMarker = Join-Path $installRoot '.git'
if (Test-Path -LiteralPath $repoMarker) {
  git -C $installRoot pull --ff-only
} elseif (Test-Path -LiteralPath $installRoot) {
  throw "安装目录已存在但不是 Job Agent 仓库：$installRoot"
} else {
  git clone -- https://github.com/Alxdzh/job-agent-mcp.git $installRoot
}
Set-Location -LiteralPath $installRoot
& (Join-Path $installRoot 'install-mcp.bat') --client auto

macOS/Linux 请执行：
dir="$HOME/job-agent-mcp"
if [ -d "$dir/.git" ]; then git -C "$dir" pull --ff-only; else git clone https://github.com/Alxdzh/job-agent-mcp.git "$dir"; fi
cd "$dir"
sh install-mcp.sh --client auto

如果安装目录存在但不是这个仓库，不要覆盖，先报告冲突路径。安装完成后验证 job-agent MCP 已注册并列出可用工具。安装和连接不会自动开始投递。
```

## WorkBuddy 备用注册

如果使用仓库安装脚本而不是 WorkBuddy 插件安装，安装器也支持直接写入 WorkBuddy 的用户级配置：

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

需要配置投递条件、登录平台或查看浏览器状态时，Windows 双击桌面快捷方式或 `start.bat`；macOS/Linux 执行 `npm start`。

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
