# @dfy-plugins/image-protocol

普通 npm 公共库，不是 Harness 插件。建立在 `@dfy-plugins/resource-core` 上，统一 DeepSeek Harness 0.1.0-rc.8 官方图片块、Attachment 图片引用、图片格式识别与安全文本降级。

media-blocks、vision、生图插件和浏览器适配层可复用它，但任何一个插件都不需要依赖另一个插件才能理解基础图片结果。
