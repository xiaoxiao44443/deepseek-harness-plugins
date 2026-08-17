# DeepSeek Harness Plugins

个人维护的 DeepSeek Harness 插件集合。仓库使用 pnpm workspace 管理，每个插件都保留独立的 `package.json`、README、版本号、构建和测试脚本。

## 插件

- [`dsh-archive-manager`](plugins/archive-manager)：按项目查看已归档对话，支持取消归档和永久删除。
- [`dsh-wallpaper`](plugins/wallpaper)：为 Harness 设置可配置图片背景，支持多种适应模式、模糊、遮罩和界面透明度。

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
