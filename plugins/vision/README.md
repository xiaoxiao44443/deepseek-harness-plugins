# @dfy-plugins/dsh-vision

为 DeepSeek Harness 的文本模型提供隔离视觉能力。媒体输入、持久化和聊天预览由 `@dfy-plugins/dsh-media-blocks` 负责；本插件只把图片引用转换成视觉工具调用。图片仅发送给设置中选择的视觉模型，父模型只看到工具返回的文字分析结果。

## 工作方式

1. 在 Harness「模型」页面配置一条明确声明 `image` 输入能力的视觉路由。
2. 在「设置 → 插件配置 → 视觉分析」选择 provider、model 和最大输出 Token。
3. 插件验证路由后注册：
   - 工具：`dfy_vision_analyze`（对话中显示为 `DFY VISION ANALYZE`）
   - 用户可手动调用的 Skill：`xiao443-vision`
   - `image` 媒体引用适配器
4. 输入框选中的 PNG/JPEG/WebP/GIF 由媒体块插件保存到 Harness 官方 `ctx.attachments` 内容寻址存储；对话中不会出现裸 `<vision_image>` 文本。
5. 文本模型请求到达时，引用适配器才生成模型侧提示，让模型把引用交给工具；工作区已有图片也可以继续使用 `file_path`。
6. 工具通过 `ctx.llm.stream()` 进行一次独立视觉调用，父会话只收到 `<vision_analysis>` 文字结果。

当当前会话模型原生支持图片时，媒体块会直接投影为官方 `image` block，本插件不会让模型自动调用视觉 Skill 或工具。

插件不保存 API Key。认证、endpoint 和模型能力都来自 Harness 已有的模型/Provider 配置。

## 配置示例

自定义模型需要在模型设置中声明图片输入，例如：

```yaml
input:
  - text
  - image
```

未配置路由、插件被关闭，或所选模型没有明确声明 `image` 时，工具和 Skill 都不会出现在模型可用列表中。

## 构建与测试

```bash
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

## 本地安装

```bash
dsh plugin --profile web add /path/to/deepseek-harness-plugins/plugins/media-blocks
dsh plugin --profile web add /path/to/deepseek-harness-plugins/plugins/vision
```

需要 DeepSeek Harness `0.1.0-rc.7` 或更高版本。
