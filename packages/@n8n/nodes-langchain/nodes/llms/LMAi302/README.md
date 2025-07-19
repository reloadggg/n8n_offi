# AI_302 Language Model Node

这是一个为 n8n 设计的 AI_302 API 语言模型节点，支持与 langchain 集成。

## 特性

- 🔄 **自动格式适配**: 自动处理 302AI API 响应格式与 langchain 标准格式之间的差异
- 🛡️ **错误处理**: 智能错误检测和回退机制
- 🚀 **高性能**: 优先使用标准 langchain 客户端，仅在需要时使用自定义适配器
- 🔧 **灵活配置**: 支持自定义 API 端点、温度、最大tokens等参数
- 🔑 **安全认证**: 支持 API Key 认证

## 支持的响应格式

该节点能够适配以下 302AI API 响应格式：

### 标准 OpenAI 格式
```json
{
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello there!"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

### 302AI 数据字符串格式
```json
{
  "data": "Hello from 302AI!",
  "id": "response-id",
  "model": "gpt-3.5-turbo"
}
```

### 302AI 消息对象格式
```json
{
  "message": {
    "content": "Hello from 302AI message!"
  },
  "usage": {
    "prompt_tokens": 8,
    "completion_tokens": 6,
    "total_tokens": 14
  }
}
```

### 302AI 直接内容格式
```json
{
  "content": "Direct content from 302AI!"
}
```

### 302AI 纯字符串格式
```
"Simple string response from 302AI!"
```

## 使用方法

### 1. 配置凭据
首先在 n8n 中配置 AI_302 API 凭据：
- **API Key**: 您的 302AI API 密钥
- **Base URL**: API 基础URL（默认：https://api.302.ai/v1）

### 2. 使用节点
1. 在工作流中添加 "AI_302 Model" 节点
2. 选择要使用的模型（支持从API动态获取模型列表）
3. 配置可选参数：
   - **Base URL**: 覆盖默认的API端点
   - **Temperature**: 控制响应的随机性（0-1）
   - **Max Tokens**: 最大生成tokens数
   - **Frequency Penalty**: 频率惩罚（-2到2）
   - **Presence Penalty**: 存在惩罚（-2到2）
   - **Top P**: 核采样参数（0-1）
   - **Timeout**: 请求超时时间（毫秒）
   - **Max Retries**: 最大重试次数

### 3. 连接到其他节点
将 AI_302 节点连接到需要语言模型的节点，如：
- Chain LLM
- AI Agent
- Text Classifier
- 等其他 langchain 节点

## 技术实现

### 适配器工作原理
1. **优先使用标准客户端**: 首先尝试使用标准的 langchain OpenAI 客户端
2. **智能错误检测**: 如果遇到格式不兼容的错误，自动切换到自定义适配器
3. **格式转换**: 自定义适配器将 302AI 的响应格式转换为 langchain 期望的标准格式
4. **无缝集成**: 对上层应用透明，确保与所有 langchain 组件兼容

### 错误处理
适配器会自动检测以下错误类型并启用自定义处理：
- JSON 解析错误
- 格式不匹配错误
- HTTP 400/422 错误
- 其他格式相关错误

## 支持的模型

节点支持 302AI 平台上的所有模型，包括但不限于：
- GPT 系列（gpt-4o, gpt-4o-mini, gpt-4, gpt-3.5-turbo）
- Claude 系列（claude-3-sonnet, claude-3-haiku）
- Gemini 系列（gemini-1.5-pro, gemini-1.5-flash）
- 国产模型（qwen-turbo, qwen-plus, qwen-max, baichuan2-turbo, chatglm3-6b）
- 开源模型（llama-3, mistral, yi-34b-chat）

## 常见问题

### Q: 如何处理 API 响应格式不兼容的问题？
A: 节点内置了自动格式适配功能，会自动检测和转换不同的响应格式。

### Q: 支持流式响应吗？
A: 目前版本专注于标准的请求-响应模式，流式响应支持在后续版本中考虑。

### Q: 如何调试连接问题？
A: 检查 n8n 日志，适配器会记录详细的错误信息和调试信息。

## 开发和测试

### 运行测试
```bash
npm test -- --testPathPattern="Ai302Adapter.test.ts"
```

### 构建项目
```bash
npm run build
```

## 许可证

该项目遵循 n8n 的开源许可证。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个节点。

## 版本历史

- **v1.0.0**: 初始版本，支持基本的 302AI API 集成和格式适配
