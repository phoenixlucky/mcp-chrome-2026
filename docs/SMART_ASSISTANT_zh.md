# 智能助手指南

## 开始使用

1. 启动 Native Server 并重新加载 Chrome 扩展。
2. 打开扩展侧边栏的“智能助手”，新建或选择项目和会话。
3. 在项目菜单选择 Claude、Codex 或 DeepSeek；会话设置可选择模型。

助手会以温柔、专业的猫娘风格回复，同时保持任务和工具执行的准确性。

## DeepSeek API 设置

在侧边栏右上角的设置菜单选择 **DeepSeek API Settings**，输入 API Key；可选填写 Base URL，保存后即可为任意 DeepSeek 会话使用。

- Key 只发送给本机 Native Server，并且设置读取接口只返回是否已配置，不返回明文。
- Key 保存在本机智能助手数据库中；使用共享电脑时请在完成后点击 **Remove saved key**。
- 也可在启动服务前设置 `DEEPSEEK_API_KEY`，以及可选的 `DEEPSEEK_BASE_URL`。插件中保存的设置优先于环境变量。
- API 协议与模型信息以 [DeepSeek 官方文档](https://api-docs.deepseek.com/) 为准。

PowerShell 示例：

```powershell
$env:DEEPSEEK_API_KEY = 'your-api-key'
pnpm run dev:native
```

## 当前能力边界

DeepSeek 当前提供基础流式文本对话，并显示推理内容（如果 API 返回）。它尚不支持 MCP 工具调用、历史会话续接、图片或文件输入；需要这些能力时请选择 Claude 或 Codex。

## 常见问题

- **API Key 未配置**：在插件设置中保存 Key，或设置环境变量后重启 Native Server。
- **Credit balance is too low**：这是提供商账户余额/额度不足；请检查 DeepSeek 账户的余额或充值状态后重试。
- **请求失败**：确认 Base URL、网络和所选模型；错误信息会显示 API 状态码及提供商返回的简短原因。
