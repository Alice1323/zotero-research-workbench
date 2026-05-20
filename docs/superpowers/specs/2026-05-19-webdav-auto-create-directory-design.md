# WebDAV Auto-Create Directory Design

## 目标

让 WebDAV JSON 上传在远端目录不存在时自动逐级创建目录，兼容坚果云等标准 WebDAV 服务，避免用户必须先手动建 `zotero/workbench`。

## 范围

- 仅在 `上传 JSON 到 WebDAV` 前执行自动建目录。
- `测试 WebDAV` 仍只做连接/目录探测，不创建远端目录。
- 目录创建使用 WebDAV `MKCOL`，按父到子的顺序逐级请求。
- `201 Created` 视为创建成功；`405 Method Not Allowed` 视为目录已存在并继续。
- `401/403/404/409/5xx` 等其它状态作为失败进入既有分层错误抽屉。
- 不实现远端目录删除、重命名、同步、冲突处理或自动 WebDAV 导入。

## 架构

核心层新增 `buildWebDavDirectoryRequests(target)`，复用 `normalizeWebDavExportTarget` 生成已脱敏可测试的 `MKCOL` 请求序列。Runtime `uploadWorkbenchJsonToWebDav` 在 `PUT` 前调用 `ensureWebDavRemoteDirectory(target)`，逐个执行请求。

## 测试

- Core 测试验证 `zotero/workbench` 生成两个 `MKCOL` 请求。
- UI runtime 测试验证上传路径调用 `ensureWebDavRemoteDirectory`，并接受 `201` / `405`。
