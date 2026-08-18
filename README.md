# DeepSeek Harness Plugins

个人维护的 DeepSeek Harness 插件集合。仓库使用 pnpm workspace 管理，每个插件都保留独立的 `package.json`、README、版本号、构建和测试脚本。

## 插件

- [`@dfy-plugins/dsh-archive-manager`](plugins/archive-manager)：按项目查看已归档对话，支持取消归档和永久删除。
- [`@dfy-plugins/dsh-wallpaper`](plugins/wallpaper)：为 Harness 设置可配置图片背景，支持多种适应模式、模糊、遮罩和界面透明度。
- [`@dfy-plugins/dsh-media-blocks`](plugins/media-blocks)：提供外置资源引用、官方图片预览和可扩展的多媒体块协议。
- [`@dfy-plugins/dsh-vision`](plugins/vision)：通过独立视觉路由为文本模型分析图片，主会话只接收文字结果。

所有发布包使用 `@dfy-plugins` npm scope；运行时 ID、API、CSS 和持久化目录按各自的兼容性要求命名，
不会随包名做全局替换。新增或修改插件前请先阅读：

- [`DEVELOPMENT.md`](DEVELOPMENT.md)：客户端 HMR、样式和资源生命周期规范。
- [`NAMING.md`](NAMING.md)：发布包、运行时 ID、API、CSS 和数据目录命名规范。

## 开发

```bash
pnpm install
pnpm check
pnpm build
```

本地安装归档插件：

```bash
dsh plugin --profile web add ./plugins/archive-manager
```

本地安装壁纸插件：

```bash
dsh plugin --profile web add ./plugins/wallpaper
```

本地安装视觉插件：

```bash
dsh plugin --profile web add ./plugins/media-blocks
dsh plugin --profile web add ./plugins/vision
```
