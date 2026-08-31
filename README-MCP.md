# MCP 接入快速说明

本仓库是给外部成熟 Agent 使用的 MCP 执行端，不是独立聊天 Agent。外部 Agent 负责理解用户的话、讨论方向和决定调用时机；本服务负责真实读取本地状态、修改已确认的配置、打开可见浏览器和执行投递。

## 接入步骤

1. 安装 Node.js 22.12+ 和系统 Google Chrome。
2. 在仓库根目录的 `daemon` 文件夹安装依赖：

   ```bash
   cd daemon
   export PUPPETEER_SKIP_DOWNLOAD=1
   npm install
   ```

   Windows PowerShell 将 `export` 换成 `$env:PUPPETEER_SKIP_DOWNLOAD = "1"`。

3. 复制 `daemon/mcp-config.example.json`，把占位路径改为本机绝对路径。
4. 把配置导入外部 Agent，重新连接后先调用 `job_get_workflow` 或 `job_get_status`。

Windows 示例：

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

如果客户端没有找到 Node.js，把 `command` 改成 `node.exe` 的绝对路径。不要在配置文件中写 API Key、Cookies 或浏览器目录。

## 常用调用顺序

```text
job_get_workflow
  -> job_get_status
  -> job_get_delivery_config
  -> job_update_delivery_preferences（用户确认改长期方向后）
  -> job_open_boss_login（需要登录时）
  -> job_start_hunt 或 job_start_continuous_hunt
  -> job_get_status（查询真实进度）
  -> job_pause_hunt / job_resume_hunt / job_stop_continuous_hunt
```

定量投递必须传入明确数量；持续投递不传固定数量，按每个平台独立的随机批次、冷却和每日时间窗运行。服务启动、MCP 连接或读取状态都不会自动投递。

## 工具分组

- 状态：`job_get_workflow`、`job_get_status`、`job_get_runtime_settings`、`job_list_applications`
- 配置：`job_get_delivery_config`、`job_update_delivery_preferences`、`job_update_runtime_settings`
- 任务：`job_start_hunt`、`job_start_continuous_hunt`、`job_pause_hunt`、`job_resume_hunt`、`job_stop_continuous_hunt`
- 资料：`job_get_profile`、`job_update_profile`、`job_list_resumes`、`job_save_resume_version`、`job_sync_resume_to_boss`
- 登录：`job_open_boss_login`

当前没有聊天、HR 回复、QQ 或微信工具。后台自动读取 JD 需要在工作台设置用户自己的云端模型 API；外部 Agent 的模型不会自动注入后台 worker。

## 可见浏览器和人工处理

默认使用系统原生 Chrome 的可见窗口。城市、关键词、筛选、职位详情和投递都通过页面真实控件完成；不使用城市码或查询 URL 代替页面操作。用户可以配置静默模式，但遇到验证码、风控、登录失效、弹窗或异常页面时，应暂停并检查可见浏览器，确认处理完成后再恢复。

## 与独立版的关系

如果不需要外部 Agent，请使用 [求职管家独立版](https://github.com/Alxdzh/job-agent-standalone)，直接在网页工作台填写资料并启动投递。本 MCP 仓库适合已有 MCP 客户端、希望用自然语言让外部 Agent 规划和调用投递能力的用户。

## 第三方和许可证

本仓库保留 `@geekgeekrun/puppeteer-extra-plugin-laodeng` 第三方源码。它来自 [geekgeekrun](https://github.com/geekgeekrun/geekgeekrun)，随附元数据没有声明许可证，不属于本项目 MIT 许可证范围，也没有被本项目重新授权。分发前请阅读 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
