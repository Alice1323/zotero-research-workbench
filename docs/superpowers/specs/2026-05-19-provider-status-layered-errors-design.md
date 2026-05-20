# Provider Status Layered Errors Design

## 目标

将 LLM 服务商设置区的 `provider-status` 迁移到统一分层错误模式：状态栏继续显示简短中文提示，失败时下方 `技术细节` 抽屉显示脱敏后的排查信息。

## 范围

- 覆盖 `保存设置` 的 Zotero Prefs/storage 写入失败。
- 覆盖 `测试连接` 的缺少测试模块、连接返回失败结果、测试函数抛异常。
- 保留普通校验、进行中、成功提示为纯状态文本，并清空旧技术细节。
- 技术细节必须脱敏，不显示 API key、Bearer token、Authorization header、password、token、secret 等 Secret Material。
- 不改变 provider settings 存储键、连接测试协议、模型验证策略或主研究面板的 LLM 调用路径。

## 交互

LLM 服务商设置区在 `provider-status` 下方新增默认折叠的 `<details>`：

- `provider-error-details`
- `provider-error-detail-text`

普通状态示例：

- `请填写接口地址和模型名称`
- `设置已保存`
- `正在测试连接...`
- `连接成功`

失败状态示例：

- 保存异常：状态栏显示 `设置保存失败，请重启 Zotero 后再试`，技术细节包含脱敏异常。
- 连接测试返回失败：状态栏显示连接测试返回的中文 message，例如 `API 密钥无效`、`模型不可用`、`接口地址不可用`；技术细节记录 `provider connection test failed`、脱敏后的 base URL/model/settings 摘要和 message。
- 连接测试抛异常：状态栏显示 `测试连接失败`，技术细节包含脱敏异常。

## 架构

核心测试控制器 `src/core/providerSettingsController.js` 增加本地 `showStatus` / `showLayeredError` / `clearErrorDetails` helper，并复用 `createLayeredErrorNotice` 生成用户提示与技术细节。Zotero runtime `chrome/content/providerSettings.js` 镜像同样的轻量 DOM helper 与脱敏逻辑，避免把独立 provider 设置脚本绑到 `paperSummary.js` 的内部函数上。

连接测试返回 `{ ok: false, message }` 不会被当作 JS 异常抛出，但 UI 会为它构造一个包含脱敏 metadata 的 Error-like 对象，这样用户看到业务友好的中文 message，抽屉里仍能看到可排查的失败上下文。

## 测试

- `tests/provider-settings.test.js` 覆盖：
  - 保存失败会显示简短中文提示并打开脱敏技术细节。
  - 普通成功或校验提示会隐藏并清空旧技术细节。
  - 连接测试返回失败会显示返回 message，技术细节不泄漏 API key。
  - 连接测试抛异常会显示 `测试连接失败` 并脱敏异常内容。
- `tests/ui-localization.test.js` 覆盖：
  - provider 设置区存在 `provider-error-details` 和 `provider-error-detail-text`。
  - `providerSettings.js` 定义 `showLayeredError` / `createLayeredErrorNotice`，并在保存失败、连接失败路径接入。
