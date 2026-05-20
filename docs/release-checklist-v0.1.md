# v0.1 发布前检查清单

适用版本：`zotero-research-workbench` `0.1.0`。

本清单用于第一版发布前的最后核验。默认只读取和记录结果；除非步骤明确要求并且 Zotero 已关闭，不修改 active profile、XPI、用户数据、测试夹具或 README。

## 0. 安全边界

- [ ] 当前仓库路径正确：

```powershell
cd "C:\Users\44199\水银灯的书库\水银灯的代码库\归档项目\zotero-ai-literature-assistant-v1"
git rev-parse --show-toplevel
```

- [ ] 只允许修改发布记录或检查文档；不要在发布检查中改代码、测试、README、active profile 或 XPI。
- [ ] 不回退其他 worker 的改动。若工作区已有未提交改动，只记录状态，不执行 `git reset`、`git checkout --` 或覆盖式清理。
- [ ] 不在报告、终端截图、checkpoint、issue、PR 描述中粘贴真实 API key、WebDAV 密码、SMTP 授权码、`Authorization` header、Bearer token 或 gateway token。
- [ ] 报告中的秘密材料必须写成 `<redacted>`，只允许记录字段名、风险类别和检查结论。

## 1. 仓库状态

- [ ] 记录当前提交和工作区状态：

```powershell
git status --short
git rev-parse HEAD
```

- [ ] 确认 `package.json` 仍声明 `version` 为 `0.1.0`、`private` 为 `true`、Node 要求为 `>=20`。
- [ ] 确认 README 的产品边界仍是 Zotero 8/9-only；不支持 Zotero 7。
- [ ] 确认 README 没有承诺未实现能力：不支持 full Citation Graph UI、Visual Workflow Builder、batch processing UI、Sci-Hub provider、Google Scholar scraping、arbitrary user scripts、Zotero-native relation writing、live cloud sync。

## 2. 自动化核验

- [ ] 运行测试：

```powershell
npm test
```

通过标准：退出码为 `0`，所有 `tests/*.test.js` 通过。

- [ ] 运行语法检查：

```powershell
npm run check
```

通过标准：退出码为 `0`，`bootstrap.js`、`chrome/content/*.js|*.mjs`、`src/core/*.js` 均通过 `node --check`。

- [ ] 重新打包 XPI：

```powershell
npm run package
```

通过标准：退出码为 `0`，生成 `dist\zotero-research-workbench-0.1.0.xpi`。

- [ ] 记录 dist XPI 哈希：

```powershell
Get-FileHash -Algorithm SHA256 ".\dist\zotero-research-workbench-0.1.0.xpi"
```

通过标准：记录完整 SHA256；不要把哈希和任何秘密材料写在同一段日志中。

- [ ] 检查 XPI 内容清单，不解压覆盖仓库文件：

```powershell
tar -tf ".\dist\zotero-research-workbench-0.1.0.xpi"
```

通过标准：包含 `manifest.json`、`bootstrap.js`、`chrome/content/` 运行期文件；不包含本地配置、导出样本、profile 文件、日志、`.git`、`tmp`、`docs/superpowers/plans`。当前 v0.1 XPI 不直接打包 `src/core/`，其逻辑已随 `chrome/content/` 运行期文件进入插件包。

## 3. Active Profile XPI

- [ ] 覆盖 active profile XPI 前必须确认 Zotero 已关闭：

```powershell
tasklist /FI "IMAGENAME eq zotero.exe"
```

通过标准：输出中没有正在运行的 `zotero.exe`。如果 Zotero 正在运行，停止本节所有写入步骤，只记录“active profile 未更新”。

- [ ] 仅在 Zotero 已关闭、且发布负责人明确要求安装时，才允许覆盖 active profile XPI。不要在例行检查中自动复制。
- [ ] 覆盖前记录目标路径，并先备份现有 active profile XPI 到同目录 `.bak` 或带时间戳路径。
- [ ] 覆盖后比较 dist XPI 与 active profile XPI 的 SHA256：

```powershell
Get-FileHash -Algorithm SHA256 ".\dist\zotero-research-workbench-0.1.0.xpi"
Get-FileHash -Algorithm SHA256 "<active-profile-extension-xpi-path>"
```

通过标准：两个 SHA256 完全一致。若不一致，恢复备份并记录失败。

- [ ] 不直接编辑 active profile 中的 `extensions.json`、`prefs.js` 或数据库来强行启用插件。
- [ ] 若 Zotero 把 sideloaded XPI 标记为 `foreignInstall` 或 `userDisabled`，通过 Zotero 插件 UI 或隔离开发 profile 处理，不在发布清单中绕过。

## 4. Zotero 手动冒烟

- [ ] 只在隔离测试 profile 或已授权的 active profile 中验证；不要使用含真实密钥和重要文库数据的生产 profile。
- [ ] 启动 Zotero 8/9，确认插件 ID 和版本：

```text
id: zotero-research-workbench@local
version: 0.1.0
active: True
userDisabled: False
appDisabled: False
```

- [ ] 确认启动偏好被写入：

```text
extensions.zotero.extensions.zotero-research-workbench.lastStartup
```

- [ ] 打开 Research Panel，确认中文界面可见。
- [ ] 验证 `刷新阅读上下文` 只读取 Reader 选中文本；无选中文本时显示 `暂无阅读器选中文本`。
- [ ] 验证 `总结选中文献` 只发送当前选中文献元数据和配置的任务输入，不自动创建 Zotero 笔记、标签、附件或 item 字段。
- [ ] 验证 `确认并写入 Zotero 笔记` 是唯一写入 Zotero child note 的显式动作。
- [ ] 验证 PDF 附件检测只显示路径或标题，不下载、不创建附件、不打开文件、不抽取 PDF 全文。

## 5. Secret Material 脱敏

- [ ] 代码和文档扫描不应出现真实秘密材料。可用模式扫描可疑字段，人工判断测试假值和真实值：

```powershell
rg -n --hidden "Authorization|Bearer|apiKey|password|secret|token|SMTP|sk-[A-Za-z0-9]" .
```

通过标准：只允许测试假值、字段名、设计说明或 `<redacted>`；不得出现真实 API key、WebDAV 密码、Authorization header、Bearer token、SMTP 授权码。

- [ ] 分层错误详情必须脱敏：错误 message、stack、嵌套字段、`authorization`、`password`、`token`、`secret`、`apiKey` 中的值不能出现在 UI 技术详情。
- [ ] Provider API key 输入框重开面板时保持空白，placeholder 显示已保存含义；不得回显密钥。
- [ ] WebDAV password 输入框重开面板时保持空白；留空保存只保留已存密码，不导出、不显示。
- [ ] 所有报告中只写 `<redacted>`，不要写真实值的前缀、后缀、长度或截图。

## 6. JSON / ZIP 导出安全

- [ ] 在隔离 profile 中执行 `导出工作台状态`，得到 JSON 后检查内容：

```powershell
rg -n "Authorization|Bearer|apiKey|password|secret|token|sk-" "<export-json-path>"
```

通过标准：秘密字段值为 `<redacted>`；不得包含真实 API key、WebDAV 密码、Authorization header、Bearer token、SMTP 授权码。

- [ ] JSON 导出只包含 Workbench Local Store snapshot：research note drafts、graph seeds、task ledger records、prompt templates、prompt overrides、provider settings structure、provider provenance。
- [ ] JSON 导出不得包含 attachments、PDFs、Zotero item metadata dumps、logs、credentials、encrypted secrets、live cloud/WebDAV sync material。
- [ ] 在隔离 profile 中执行 `导出 ZIP`，检查 ZIP 内容：

```powershell
tar -tf "<export-zip-path>"
```

通过标准：只包含 `manifest.json` 和 `snapshot.json`。

- [ ] 从 ZIP 读取 `snapshot.json` 并扫描秘密材料：

```powershell
tar -xOf "<export-zip-path>" snapshot.json | rg -n "Authorization|Bearer|apiKey|password|secret|token|sk-"
```

通过标准：秘密字段值为 `<redacted>`；不得包含真实秘密材料。

- [ ] WebDAV `上传 JSON 到 WebDAV` 只上传同一份 redacted JSON package；不上传 ZIP、不自动导入、不自动同步、不做冲突处理。

## 7. 功能边界

- [ ] 明确不支持 Zotero 7。若在 Zotero 7 中安装或启动失败，记录为预期边界，不作为 v0.1 阻断。
- [ ] `作品身份线索` 是只读检查视图；不得自动合并作品、改写 work id、创建 Zotero item 或查询外部身份服务。
- [ ] `重复作品候选` 只显示候选和证据；不得自动合并、删除记录、编辑 Zotero items 或写 Zotero 元数据。
- [ ] `引用关系图谱` 和 `图谱种子复核队列` 写入范围仅限 Workbench Local Store snapshot；不得写 Zotero item fields、tags、relations 或自动创建 Zotero-native relation。
- [ ] `生成关系` 只生成本地 `citationRelations` 记录和 task ledger；不写 Zotero 元数据。
- [ ] Prompt override 是非秘密用户配置；模板变量必须受 whitelist 限制，`{{apiKey}}` 等不安全变量必须被拒绝。
- [ ] Provider runtime guard 生效：超出请求频率显示 `请求过于频繁，请稍后再试`；超出单任务输入上限显示 `输入内容超过单任务 Token 上限`。

## 8. 测试夹具和回滚

- [ ] 优先使用 Node 测试夹具，不写 active profile：

```powershell
npm test
```

- [ ] 若手动 UI 验证需要 profile fixture，只在 Zotero 关闭且已备份后修改 active profile `prefs.js`。记录 fixture marker、备份路径、修改的 preference key。
- [ ] 夹具必须使用假数据：测试 DOI、测试 title、假 provider key、假 WebDAV password；不得写入真实密钥或生产文库内容。
- [ ] 夹具写入前备份：

```powershell
Copy-Item -LiteralPath "<active-profile>\prefs.js" -Destination "<active-profile>\prefs.js.bak-YYYYMMDD-HHMMSS"
```

- [ ] 回滚夹具时确认 Zotero 已关闭，再用备份覆盖或删除带 fixture marker 的 preference。回滚后重新检查 marker 不存在。
- [ ] 若 active profile XPI 被覆盖，回滚时确认 Zotero 已关闭，恢复备份 XPI，并重新记录 SHA256。
- [ ] 不把 fixture 生成的导出 JSON/ZIP 当作发布产物；检查后删除或移入明确标记的临时目录。

## 9. 发布记录

- [ ] 发布记录至少包含：
  - 仓库 HEAD；
  - `npm test` 结果；
  - `npm run check` 结果；
  - `npm run package` 结果；
  - dist XPI 路径和 SHA256；
  - active profile XPI 是否更新、目标路径、SHA256 是否一致；
  - Zotero 版本和 profile 类型；
  - JSON/ZIP 导出脱敏结论；
  - 是否使用 fixture、fixture marker、回滚状态；
  - 未完成的手动检查或已知边界。
- [ ] 发布记录不得包含真实秘密材料、完整请求 header、profile 中的真实账号信息、用户文库私密内容。

## 10. 阻断条件

- [ ] 任一自动化命令失败：阻断发布。
- [ ] XPI 未生成或 dist XPI 哈希无法记录：阻断发布。
- [ ] active profile XPI 与 dist XPI 哈希不一致且未回滚：阻断发布。
- [ ] Zotero 正在运行时发生 active profile 覆盖或 prefs 修改：阻断发布并回滚。
- [ ] JSON/ZIP 导出出现真实 secret：阻断发布。
- [ ] UI 错误详情、报告或日志出现真实 secret：阻断发布。
- [ ] 出现自动合并作品、自动写 Zotero 元数据、自动写 Zotero relations、自动导入/同步 WebDAV 的行为：阻断发布。
- [ ] README 或发布记录声称支持 Zotero 7：阻断发布。
