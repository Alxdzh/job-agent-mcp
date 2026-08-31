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

## 让 Agent 安装

```text
请在当前 job-agent-mcp 根目录完成安装：Windows 执行 .\\install-mcp.bat --client auto，macOS/Linux 执行 sh install-mcp.sh --client auto。安装完成后连接 job-agent MCP，并列出可用工具。
```

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

需要填写资料、登录平台或查看浏览器状态时，Windows 双击桌面快捷方式或 `start.bat`；macOS/Linux 执行 `npm start`。

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
