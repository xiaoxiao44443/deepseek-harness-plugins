# @dfy-plugins/dsh-wallpaper

DeepSeek Harness 图片壁纸插件。它只创建一层覆盖整个视口的背景和一层颜色遮罩，
再把 Harness 的大面积基础背景 token 设为透明，因此侧栏、对话区和详情区看到的
始终是同一张连续图片。

## 功能

- 从本机选择图片；原图保存在 `$DSH_HOME/storages/dfy-plugins/wallpaper/assets/current`
- 覆盖、完整显示、拉伸、适应宽度、适应高度、原始居中和平铺七种模式
- 九宫格背景位置，以及随窗口缩放的横向、纵向百分比偏移微调
- 图片透明度和 0–40px 模糊
- 可配置遮罩颜色与遮罩强度
- 可配置弹窗、菜单、输入框等二级表面的填充透明度
- 无遮罩的非模态悬浮设置面板，可拖动且不妨碍操作主界面
- 设置实时预览，支持临时关闭与恢复
- 插件卸载时移除背景节点、样式和写入 body 的 CSS 变量

## 构建与测试

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm test
```

## 安装

```bash
dsh plugin --profile web add /path/to/dfy-dsh-plugins/plugins/wallpaper
```

重启 DeepSeek Harness 后，在「设置 → 壁纸」中选择图片。配置保存在
`$DSH_HOME/storages/dfy-plugins/wallpaper/config.json`；图片只写入本机 Harness 数据目录，
不会上传到外部网络。插件升级或重新安装不会覆盖这些运行时文件。
