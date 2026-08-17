# DeepSeek Harness Plugins

个人维护的 DeepSeek Harness 插件集合。仓库使用 pnpm workspace 管理，每个插件都保留独立的 `package.json`、README、版本号、构建和测试脚本。

## 插件

- [`dsh-archive-manager`](plugins/archive-manager)：按项目查看已归档对话，支持取消归档和永久删除。

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
