# 求职管家 MCP 版

把本地求职工作台接入 Agent。Agent 负责理解用户要求和调用时机，本服务负责读取状态、修改配置、打开可见浏览器和执行投递。

需要直接在网页工作台里填写资料和操作，请使用 [求职管家独立版](https://github.com/Alxdzh/job-agent-standalone)。

工作台界面只保留投递相关功能，不再提供简历版本库或旧式个人资料页。概览中的“投递资料”大文本框用于填写经历、优势和补充要求，并作为 JD 判断上下文；“设置 → 投递偏好”维护城市、关键词、薪资、启用状态和筛选词。

## 能做什么

- 读取投递状态、平台登录态、冷却、浏览器页面状态和历史记录。
- 在概览中保存投递资料，并在 JD 判断时作为匹配上下文。
- 修改城市、职位关键词、薪资、平台、公司排除词和岗位筛选条件。
- 修改投递时间窗、随机批次、休息时间和岗位间隔。
- 打开指定平台的可见 Chrome 登录页面。
- 启动指定数量投递或持续投递，暂停、恢复和停止任务。

支持 BOSS 直聘、智联招聘、51job（前程无忧）和猎聘。城市、关键词、筛选、详情和投递均通过网页控件完成。

## 安装

### Windows：下载 ZIP

解压后在仓库根目录执行：

```powershell
.\install-mcp.bat --client auto
```

安装器会准备运行环境、安装依赖、创建桌面启动快捷方式，并把 MCP 注册到本机检测到的 Agent。它不会开始投递。

也可以指定客户端：

```powershell
.\install-mcp.bat --client codex
.\install-mcp.bat --client claude
.\install-mcp.bat --client opencode
.\install-mcp.bat --client workbuddy
```

工作台单独安装使用 `install.bat`，启动使用桌面快捷方式或 `start.bat`。

### macOS / Linux

先安装 Node.js 22.12+ 和 Google Chrome，再执行：

```bash
sh install-mcp.sh --client auto
```

如果 Node.js 已经安装，也可以使用：

```bash
npm run setup
npm run mcp
```

启动工作台：

```bash
npm start
```

### 从 GitHub 安装

仓库已公开，无需额外 GitHub 权限。Windows 请在 **PowerShell** 中执行下面的命令；不要把这段 Windows 命令放进 Git Bash、Cygwin 或 MSYS2。这样可以避免 Git for Windows 把 Windows 盘符路径转换成错误的 `/c` 路径。

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
& (Join-Path $installRoot 'install-mcp.bat') --client auto
```

macOS/Linux 执行：

```bash
dir="$HOME/job-agent-mcp"
if [ -d "$dir/.git" ]; then git -C "$dir" pull --ff-only; else git clone https://github.com/Alxdzh/job-agent-mcp.git "$dir"; fi
cd "$dir"
sh install-mcp.sh --client auto
```

### 让 Agent 直接从 GitHub 安装

把下面整段消息发给可以执行本地终端命令的 Agent：

```text
请直接从 GitHub 安装 Job Agent MCP，不要假设当前目录已经有仓库。

仓库地址：https://github.com/Alxdzh/job-agent-mcp.git
请将仓库安装到当前用户主目录下的 job-agent-mcp。Windows 安装段必须使用 PowerShell，不要使用 Git Bash。

Windows PowerShell：
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

macOS/Linux：
dir="$HOME/job-agent-mcp"
if [ -d "$dir/.git" ]; then git -C "$dir" pull --ff-only; else git clone https://github.com/Alxdzh/job-agent-mcp.git "$dir"; fi
cd "$dir"
sh install-mcp.sh --client auto

如果安装目录存在但不是这个仓库，不要覆盖，先报告冲突路径。安装完成后验证 job-agent MCP 已注册并列出可用工具。安装和连接不会自动开始投递。
```

## 调用流程

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

用户说“投一个/投 30 个”时使用 `job_start_hunt` 并传入数量；用户说“开始持续投递”时使用 `job_start_continuous_hunt`。启动服务或连接 MCP 不会自动开始投递。

## 客户端注册

安装器使用客户端原生方式注册：

| 客户端 | 注册命令或位置 | 查看状态 |
| --- | --- | --- |
| Codex | `codex mcp add` | `codex mcp list` |
| Claude Code | `claude mcp add` | `claude mcp list` 或 `/mcp` |
| OpenCode | 全局 `opencode.json(c)` | `opencode mcp list` |
| WorkBuddy / CodeBuddy | `~/.workbuddy/mcp.json`（文件级注册，无需 CLI） | 客户端的 MCP 设置 |

同名服务已存在时，安装器不会覆盖原配置；OpenCode 修改配置前会生成备份。

## 手动配置

没有客户端 CLI 时，执行下面的命令输出标准配置：

```bash
node tools/install-mcp.mjs --print
```

也可以直接运行 MCP 服务：

```bash
node daemon/mcp-server.mjs
```

## 使用浏览器工作台

默认使用系统 Chrome 的可见窗口。需要登录或查看状态时，启动 `start.bat`（Windows）或 `npm start`。

## 相关版本

- [求职管家独立版](https://github.com/Alxdzh/job-agent-standalone)：直接使用网页工作台。
- [`README-MCP.md`](README-MCP.md)：MCP 快速说明。

## 第三方声明

本仓库包含 `@geekgeekrun/puppeteer-extra-plugin-laodeng` 第三方源码，来源为 [geekgeekrun](https://github.com/geekgeekrun/geekgeekrun)。该组件随附元数据未声明许可证，不属于本项目 MIT 许可证范围；详情见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 许可证

本项目自有代码按 [`LICENSE`](LICENSE) 发布；第三方组件按其自身授权情况使用。
