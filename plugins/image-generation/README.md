# @dfy-plugins/dsh-image-generation

为 DeepSeek Harness 提供独立的图像生成与编辑能力：主对话模型先加载 `dfy-image-generation` Skill，再调用固定的 `dfy_image_generate` 工具；真正的图片模型只保存在插件设置中，不注册进主对话模型列表。

当前支持 OpenAI Images API 兼容路由：

- 无输入图片时调用 `POST /images/generations`。
- 带附件引用或工作区图片路径时调用 `POST /images/edits`。
- 结果保存为 Harness attachment，并在 Tool 卡片内显示官方图片预览。
- API Key 独立保存在 `dsh-credentials`，不进入插件设置和模型上下文，也不会在设置页回显。

## 安装

先安装媒体块，再安装图像生成插件：

```bash
dsh plugin --profile web add ./plugins/media-blocks
dsh plugin --profile web add ./plugins/image-generation
```

重启 Harness 后，在“设置 → 插件 → 图像生成”中填写：

- API Base URL，例如 `https://api.teamorouter.com/v1`
- API Key
- 图像模型，例如 `gpt-image-2`
- 默认质量与尺寸

设置页会把密钥写入此插件专用的 Harness 凭据项。再次打开时只显示“已配置”；留空会保留原值，输入新值会替换原值。
