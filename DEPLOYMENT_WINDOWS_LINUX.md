# OpenClaw Windows 与 Linux 部署说明（实测可用）

本文档基于当前工作目录实测整理，目标是保证：
- 能编译
- 能部署
- 能启动
- 浏览器可访问
- 能在浏览器聊天

适用范围：
- Windows 10/11（已实测）
- Linux（同流程）

---

## 1. 当前运行基线

- 源码目录：`D:\OpenClaw\Develop\openclaw`
- 部署目录：`D:\OpenClaw\deploy`
- 运行目录：`D:\OpenClaw\deploy\openclaw-runtime-next\package`
- 网关地址：`http://127.0.0.1:18789`

---

## 2. Windows 部署流程

### 2.1 编译

```powershell
Set-Location "D:\OpenClaw\Develop\openclaw"
pnpm install
pnpm ui:build
pnpm build:docker
```

### 2.2 打包

```powershell
pnpm pack --pack-destination D:\OpenClaw\deploy --config.ignore-scripts=true
```

### 2.3 解压到运行目录

```powershell
$deploy = "D:\OpenClaw\deploy"
$tgz = Join-Path $deploy "openclaw-2026.3.13.tgz"
$runtime = Join-Path $deploy "openclaw-runtime-next"

if (Test-Path $runtime) { Remove-Item -Recurse -Force $runtime }
New-Item -ItemType Directory -Path $runtime | Out-Null
tar -xf $tgz -C $runtime

Set-Location (Join-Path $runtime "package")
pnpm install --prod --ignore-scripts
```

### 2.4 同步 UI 资源（避免 Control UI 丢失）

```powershell
$src = "D:\OpenClaw\Develop\openclaw\dist\control-ui"
$dst = "D:\OpenClaw\deploy\openclaw-runtime-next\package\dist\control-ui"

if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
New-Item -ItemType Directory -Path $dst | Out-Null
Copy-Item -Recurse -Force (Join-Path $src "*") $dst
```

---

## 3. 网关启动与访问

```powershell
Set-Location "D:\OpenClaw\deploy\openclaw-runtime-next\package"
node .\openclaw.mjs gateway run --port 18789 --verbose
```

浏览器访问：
- `http://127.0.0.1:18789`

如需 token：

```powershell
node .\openclaw.mjs dashboard --no-open
```

验证：

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:18789" -UseBasicParsing
```

---

## 4. 阿里云百炼接入（重点）

### 4.1 最小可用配置

```powershell
Set-Location "D:\OpenClaw\deploy\openclaw-runtime-next\package"

node .\openclaw.mjs config set models.mode merge
node .\openclaw.mjs config set models.providers.bailian.baseUrl "https://dashscope.aliyuncs.com/compatible-mode/v1"
node .\openclaw.mjs config set models.providers.bailian.api "openai-completions"
node .\openclaw.mjs config set models.providers.bailian.apiKey "<YOUR_API_KEY>"

node .\openclaw.mjs config set agents.defaults.model.primary "bailian/qwen3.5-plus"
node .\openclaw.mjs config set agents.defaults.models '{"bailian/qwen3.5-plus":{},"bailian/qwen3-coder-plus":{}}' --strict-json
```

### 4.2 重启生效

```powershell
node .\openclaw.mjs gateway stop
node .\openclaw.mjs gateway run --port 18789 --verbose
```

### 4.3 Web 侧切换与验证

```text
/models
/models bailian
/model bailian/qwen3.5-plus
```

如果使用你当前这套配置，`/model qwen-portal/...` 不会生效。

---

## 5. 本次故障根因与修复结论

### 5.1 启动不来（已解决）

根因：
- 系统服务（Scheduled Task）历史命令路径残留，可能指向旧目录。
- 非管理员权限下重装服务可能失败（`schtasks` 拒绝访问）。

结论：
- 直接在运行目录使用 `node .\openclaw.mjs gateway run ...` 可稳定启动。
- 如需修复系统服务，请使用管理员 PowerShell 执行：

```powershell
node .\openclaw.mjs gateway install --force --port 18789
node .\openclaw.mjs gateway start
```

### 5.2 百炼连接不上（已定位并解决）

根因：
- API Key 与 endpoint 类型不匹配。
- 本次实测中，该 key 对 `coding.dashscope.aliyuncs.com/v1` 返回 401，
  但对 `dashscope.aliyuncs.com/compatible-mode/v1` 可用。

结论：
- 将 `models.providers.bailian.baseUrl` 切到 `compatible-mode` 后恢复可聊天。

---

## 6. Endpoint 诊断脚本（建议保留）

当遇到 401 时，先执行以下脚本测试 key 对哪个端点生效：

```powershell
$key = "<YOUR_API_KEY>"
$body = @{ model='qwen3.5-plus'; messages=@(@{role='user';content='Reply exactly: ok'}); max_tokens=16; temperature=0 } | ConvertTo-Json -Depth 6
$urls = @(
  'https://coding.dashscope.aliyuncs.com/v1/chat/completions',
  'https://coding-intl.dashscope.aliyuncs.com/v1/chat/completions',
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions'
)
foreach ($u in $urls) {
  Write-Output "--- $u"
  try {
    $r = Invoke-RestMethod -Uri $u -Method Post -Headers @{ Authorization = "Bearer $key"; 'Content-Type'='application/json' } -Body $body -TimeoutSec 60
    Write-Output ("OK: " + $r.choices[0].message.content)
  } catch {
    Write-Output ("FAIL: " + $_.Exception.Message)
    if ($_.ErrorDetails.Message) { Write-Output $_.ErrorDetails.Message }
  }
}
```

---

## 7. Qwen Portal 插件（可选）

若你要用 Qwen OAuth provider（不是百炼 provider）：

```powershell
node .\openclaw.mjs plugins enable qwen-portal-auth
node .\openclaw.mjs gateway stop
node .\openclaw.mjs gateway run --port 18789 --verbose
node .\openclaw.mjs models auth login --provider qwen-portal --set-default
node .\openclaw.mjs models set qwen-portal/coder-model
```

Web：

```text
/models qwen-portal
/model qwen-portal/coder-model
```

---

## 8. 常用命令速查（插件/状态/排障）

### 8.1 网关与健康

```powershell
node .\openclaw.mjs gateway status
node .\openclaw.mjs gateway run --port 18789 --verbose
node .\openclaw.mjs gateway stop
node .\openclaw.mjs health --verbose
node .\openclaw.mjs status --deep
```

### 8.2 配置与模型

```powershell
node .\openclaw.mjs config file
node .\openclaw.mjs config validate
node .\openclaw.mjs config get models.providers.bailian
node .\openclaw.mjs config get agents.defaults.model.primary
node .\openclaw.mjs models list
node .\openclaw.mjs models status
node .\openclaw.mjs models set <provider/model>
```

### 8.3 插件管理

```powershell
node .\openclaw.mjs plugins list
node .\openclaw.mjs plugins list --json
node .\openclaw.mjs plugins info <plugin-id>
node .\openclaw.mjs plugins enable <plugin-id>
node .\openclaw.mjs plugins disable <plugin-id>
node .\openclaw.mjs plugins doctor
```

### 8.4 Web slash 命令

```text
/status
/models
/models <provider>
/model
/model <provider/model>
/help
```

---

## 9. 注意事项

- `bailian/...` 与 `qwen-portal/...` 是两套 provider，不可混用。
- `/model not allowed` 先检查 `agents.defaults.models` 白名单。
- 配置变更后一定重启 gateway。
- 若已改配置但行为不变，检查：
  - `C:\Users\<用户名>\.openclaw\openclaw.json`
  - `C:\Users\<用户名>\.openclaw\agents\main\agent\models.json`
- 不要在文档或仓库明文保存真实 API Key。

---

## 10. 机器人插件（robot-kinematic）启用与调试

目标：通过 `skills/robot-kinematic` 驱动本地 viewer：
- `D:/OpenClaw/Develop/openclaw/models/robot_kinematic_viewer.html`

### 10.1 启用检查

先确认插件配置包含并启用：

```powershell
Set-Location "D:\OpenClaw\deploy\openclaw-runtime-next\package"
node .\openclaw.mjs config get plugins.allow
node .\openclaw.mjs config get plugins.entries.robot-kinematic
```

期望值：
- `plugins.allow` 包含 `robot-kinematic`
- `plugins.entries.robot-kinematic.enabled = true`

### 10.2 正确启动顺序（避免端口冲突）

1. 只保留一个网关实例：

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'openclaw\.mjs gateway run' } |
  Select-Object ProcessId, CommandLine
```

2. 启动网关：

```powershell
Set-Location "D:\OpenClaw\deploy\openclaw-runtime-next\package"
node .\openclaw.mjs gateway run --port 18789 --verbose
```

3. 打开 viewer：
- `file:///D:/OpenClaw/Develop/openclaw/models/robot_kinematic_viewer.html`
- 点击页面里的“连接”（WS）

说明：viewer 已在连接成功后自动发送 `register`（包含 `robotId/instanceId`），
桥接可识别会话，`robot_control` 才能下发动作。

### 10.3 连通性验证

验证桥接状态（9877）：

```powershell
$resp = Invoke-WebRequest -Uri http://127.0.0.1:9877/status -UseBasicParsing -TimeoutSec 5
$obj = $resp.Content | ConvertFrom-Json
"totalSessions=$($obj.totalSessions)"
$obj.connected | ConvertTo-Json -Depth 6
```

期望：
- `totalSessions >= 1`
- `connected` 里能看到 `robotId` 与 `instanceId`

然后在 OpenClaw 中做最小动作验证（让 Agent 调一次 `robot_control`）：

```powershell
node .\openclaw.mjs agent --session-id robot-debug --message "请调用 robot_control，action=list_connections，并只输出工具结果。" --json --timeout 120
```

### 10.4 常见问题与修复

1. `EADDRINUSE 127.0.0.1:9877`
- 原因：已有 bridge 占用 9877，或重复启动多个网关/插件进程。
- 修复：

```powershell
Get-NetTCPConnection -LocalPort 9877 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, State, OwningProcess
```

定位后结束冲突进程，只保留一个网关实例。

2. `Cannot find module 'ws'`
- 原因：插件依赖未装完整。
- 修复（插件目录）：

```powershell
Set-Location "$env:USERPROFILE\.openclaw\extensions\robot-kinematic"
npm install
```

3. viewer 已连接但 `totalSessions=0`
- 原因：viewer 未完成 register（例如页面未点“连接”）。
- 修复：刷新页面并重新点击“连接”，再查 `/status`。

---

## 11. 飞书集成（接收/回复）

### 11.1 最小可用配置

文件：`C:\Users\<用户名>\.openclaw\openclaw.json`

建议确保：
- `channels.feishu.enabled = true`

- `channels.feishu.connectionMode = "websocket"`

- `channels.feishu.requireMention = false`（群里可按需改回 true）

- `channels.feishu.dmPolicy = "open"`（避免私聊反复进入配对门禁）

- `channels.feishu.allowFrom` 包含 `"*"`（测试阶段推荐）

  参考配置：

  `{`
    `"scopes": {`
      `"tenant": [`
        `"aily:file:read",`
        `"aily:file:write",`
        `"application:application.app_message_stats.overview:readonly",`
        `"application:application:self_manage",`
        `"application:bot.menu:write",`
        `"cardkit:card:write",`
        `"contact:user.employee_id:readonly",`
        `"corehr:file:download",`
        `"docs:document.content:read",`
        `"event:ip_list",`
        `"im:chat",`
        `"im:chat.access_event.bot_p2p_chat:read",`
        `"im:chat.members:bot_access",`
        `"im:message",`
        `"im:message.group_at_msg:readonly",`
        `"im:message.group_msg",`
        `"im:message.p2p_msg:readonly",`
        `"im:message:readonly",`
        `"im:message:send_as_bot",`
        `"im:resource",`
        `"sheets:spreadsheet",`
        `"wiki:wiki:readonly"`
      `],`
      `"user": [`
        `"aily:file:read",`
        `"aily:file:write",`
        `"im:chat.access_event.bot_p2p_chat:read"`
      `]`
    `}`
  `}`

说明：
- 若 `dmPolicy` 未设或为 `pairing`，私聊首条消息会返回 `access not configured` 和 pairing code。

### 11.2 运行态验证（实测）

1. 网关健康：

```powershell
Invoke-WebRequest http://127.0.0.1:18789/health -UseBasicParsing
```

2. 查看日志是否收到飞书消息：

```powershell
Select-String -Path "C:\Users\<用户名>\AppData\Local\Temp\openclaw\openclaw-*.log" -Pattern "feishu\[default\]: received message from"
```

出现 `received message from ...` 说明“接收链路”已打通。

3. 直连飞书 OpenAPI 发消息验证（排除 Agent 路由因素）：

```powershell
$cfg = Get-Content C:\Users\<用户名>\.openclaw\openclaw.json -Raw | ConvertFrom-Json
$token = (Invoke-RestMethod -Uri 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal' -Method Post -ContentType 'application/json' -Body (@{app_id=$cfg.channels.feishu.appId; app_secret=$cfg.channels.feishu.appSecret} | ConvertTo-Json)).tenant_access_token

$chatId = "<oc_xxx 聊天ID>"
$body = @{ receive_id=$chatId; msg_type='text'; content=(@{text='OpenClaw Feishu API test'} | ConvertTo-Json -Compress) } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id' -Method Post -Headers @{ Authorization="Bearer $token"; 'Content-Type'='application/json; charset=utf-8' } -Body $body
```

### 11.3 你这次问题的根因（已定位）

本次日志证据显示：
- 飞书消息已进入 OpenClaw（有 `received message from ...`）。
- 但曾被 `pairing` 门禁拦截，出现：
  - `OpenClaw: access not configured`
  - `Pairing code: ...`

因此核心不是“收不到飞书消息”，而是“未通过当前 DM 访问策略”。

### 11.4 pairing 模式下的快速放行

当收到 pairing code（如 `2ZELAFZA`）：

```powershell
node .\openclaw.mjs pairing approve feishu 2ZELAFZA
```

建议：
- 生产环境可保留 `pairing`（更安全）。
- 调试期建议设 `dmPolicy=open` 提高联调效率。

### 11.5 常见错误码与处理

1. `99991672`（权限不足）
- 含义：飞书应用缺少所需 scope。
- 本次出现过：
  - `im:chat:readonly, im:chat, im:chat.group_info:readonly, im:chat.members:read`
  - `docx:document, docx:document:create`
  - `wiki:wiki, wiki:wiki:readonly, wiki:space:retrieve`
- 处理：在飞书开放平台为应用开通对应权限并发布。

2. `99992356`（chat_id 非法）
- 含义：把 App ID（`cli_xxx`）误当成 chat_id 使用。
- 处理：发送消息必须使用 `oc_xxx`（chat_id）或 `ou_xxx`（open_id）。

3. `Action send requires a target`
- 含义：调用 message 工具时没有可推导目标（或非飞书会话中缺少 target）。
- 处理：显式提供 `target`（如 `chat:oc_xxx`）或在飞书原生会话中触发自动回路由。
