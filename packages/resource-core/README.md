# @dfy-plugins/resource-core

普通 npm 公共库，不是 Harness 插件。提供版本化不透明资源引用、provider 所有权隔离、进程内资源注册表和纯文本降级。

`getProcessResourceRegistry()` 通过稳定的 `Symbol.for` ABI 共享注册表，因此独立发布或各自打包依赖的插件仍可在同一个 Harness 进程中交换短期资源，而不把字节放进 JSON。
