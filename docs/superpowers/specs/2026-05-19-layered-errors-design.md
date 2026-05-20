# Layered User-Facing Errors Design

## 目标

在 Zotero 研究工作台中，将失败提示分成两层：状态栏显示安全、简短的中文用户提示；旁边的“技术细节”抽屉显示脱敏后的错误信息，便于排查 WebDAV、导入导出、LLM 请求、Zotero 笔记写入等问题。

## 范围

- 覆盖研究面板主状态、工作台导入导出状态、WebDAV 状态、图谱种子状态。
- 技术细节必须脱敏，不显示 API key、WebDAV 密码、Bearer token、Authorization header、字段名包含 token/password/secret/apiKey/authorization 的值。
- 普通成功、进行中、取消提示会清空并隐藏技术细节。
- 不新增全局日志框架、遥测、远程错误上报、WebDAV 自动同步或导入。

## 交互

每个高风险状态区域下方增加一个默认折叠的 `<details>`：

- `paper-error-details`
- `workbench-error-details`
- `webdav-error-details`
- `graph-seed-error-details`

失败时状态栏显示中文摘要，例如“WebDAV 上传失败”；抽屉 summary 固定为“技术细节”，内容为最多 4000 字符的脱敏文本。

## 架构

核心层新增 `createLayeredErrorNotice(error, fallbackMessage)`，负责把任意错误对象转换成 `{ userMessage, technicalDetail }`。运行时使用同名轻量 helper，并通过 `showStatus` / `showLayeredError` 更新 DOM。这样测试覆盖脱敏规则，运行时只负责 UI 写入。

## 测试

- 核心测试验证错误消息、堆栈、嵌套对象中的密钥都会脱敏。
- UI 本地化测试验证四个技术细节抽屉存在。
- 运行时测试验证统一错误显示 helper 与关键失败路径已接入。
