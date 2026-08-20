# @dfy-plugins/dsh-media-blocks

DeepSeek Harness 的可扩展媒体引用层。对话日志只保存轻量 `dfy-media` 块和资源引用，二进制内容留在资源存储中；聊天界面再把引用投影成可预览的媒体卡片。

当前内置了完整的图片链路：

- 选择、拖入和粘贴图片继续使用 Harness 官方输入框交互。
- 发送后把官方草稿图片保存进 `ctx.attachments`，持久化为自定义媒体块。
- 聊天记录使用与 rc.8 附件槽兼容的内置图片画廊；不再依赖 rc.8 已停止导出的私有 `ImageGallery` 组件。
- 请求多模态模型时，临时投影成官方 `image` block，模型直接接收像素。
- 请求文本模型时，由 `@dfy-plugins/dsh-vision` 把同一引用投影成工具提示；主聊天不展示内部引用。
- 因为历史记录里没有持久化官方 `image` block，新会话可在多模态模型和文本模型之间切换。

## 扩展协议

`MediaResourceMap` 可通过 TypeScript declaration merging 增加 `audio`、`video`、`canvas`、`code` 或业务自定义格式；`registerReferenceAdapter(kind, adapter)` 决定某类资源如何进入不原生支持它的模型上下文。这样视觉插件只负责把 `image` 引用转换成视觉工具调用，不再负责输入框、存储或聊天渲染。

音频、视频、沙箱 HTML/Canvas 和代码运行卡片会复用这一协议，但执行能力必须由独立 Host 插件提供：媒体块只描述和展示资源，不在 WebView 里直接执行任意代码。

## 本地安装

```bash
dsh plugin --profile web add /path/to/dfy-dsh-plugins/plugins/media-blocks
```

文本模型要自动分析聊天媒体块时需要同时安装 `@dfy-plugins/dsh-vision`。视觉插件本身也可独立处理工作区图片和受控资源引用；两个插件没有安装顺序要求。

## 构建与测试

```bash
pnpm run typecheck
pnpm test
pnpm run build
```

需要 DeepSeek Harness `0.1.0-rc.8` 或更高版本。
