# dsh-archive-manager

DeepSeek Harness 归档会话管理插件：在「设置」里新增「归档管理」页，
按项目列出已归档的对话，并支持取消归档或永久删除。

- Host 半区：注册列表、取消归档和删除三个 HTTP 路由，读取 `$DSH_HOME/sessions`、
  工作区信息与会话投影缓存；状态变更通过 Harness 工作区注册表实时发布
- Client 半区：注册 `settings.section` 设置页（id: `archives`，标签「归档管理」）

## 构建与测试

```bash
pnpm install
pnpm run typecheck   # host + client 类型检查
pnpm run build       # tsc -> lib/index.js + esbuild 打包 -> lib/client.js
pnpm test            # node --test（归档逻辑，基于临时目录）
```

## 安装

```bash
dsh plugin --profile web add /path/to/dsh-archive-manager
```

`dsh.bundle.patch` 让插件加入 Profile 层栈；`dsh.client` 让浏览器端扫描并加载
`./client` bundle。重启 DeepSeek Harness 后生效。

## 使用

设置 →「归档管理」：按项目查看对话标题和最后活动时间；点击「取消归档」可立即
恢复到原项目与原位置，点击垃圾桶并确认后永久删除。删除只针对**已归档**对话；
未归档对话会被拒绝。永久删除会保留不可见的归档标记，防止当前 Host 内存中的旧
索引短暂显示为无法打开的对话；归档页会按磁盘记录过滤，不会再次显示该条目。
