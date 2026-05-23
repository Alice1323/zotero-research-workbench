# 首次运行人工验收手册

适用对象：Zotero 8/9，`Zotero 研究工作台` 第一版 XPI。

本手册只描述人工验收步骤，不要求修改代码、测试、README、active profile 或 XPI。

## 写入边界总览

验收前先明确数据边界：

- 会写 Zotero 原生笔记：点击 `确认并写入 Zotero 笔记`。该动作会在当前选中的 Zotero 条目下创建 child note，或为多篇共同点笔记创建 standalone note。
- 会写 Zotero 原生条目/附件：v0.4 文献发现流水线中，只有用户显式创建导入计划并运行 `Zotero 写入队列` 后，才会串行创建 Zotero 条目和附件。
- 只读 Zotero：选中文献信息、PDF 附件检测、阅读器选中文本读取、引用关系图谱检查、作品身份线索检查、重复作品候选检查。
- 只写 Workbench Local Store：研究主题、发现计划、候选文献、导入计划、写入队列记录、研究笔记草稿、任务记录、图谱种子、图谱种子复核状态、生成的本地引用关系、提示词模板覆盖、导入的工作台快照。
- 写 Zotero preferences，但不写 Zotero 条目：LLM Provider 设置、WebDAV 设置、Workbench Local Store 快照。
- 写本地文件或远端文件：`导出工作台状态` 写本地 JSON；`导出 ZIP` 写本地 ZIP；`上传 JSON 到 WebDAV` 写远端脱敏 JSON。

## 前置条件

1. 准备 Zotero 8/9。
2. 准备 XPI：通常为 `dist/zotero-research-workbench-0.1.0.xpi` 或当前构建产物。
3. 准备至少一篇带题名、作者、年份、摘要的 Zotero 文献；最好有一个 PDF 子附件。
4. 准备可用的 OpenAI-compatible LLM Provider：接口地址、API 密钥、模型名称。
5. 如需验收 WebDAV，准备 WebDAV 地址、用户名、密码或应用密码、远端目录。坚果云可使用 Nutstore WebDAV 地址与应用密码。

## 1. 安装 XPI

1. 打开 Zotero。
2. 打开 `Tools` / `工具` -> `Add-ons` / `附加组件`。
3. 选择从文件安装插件，选择 XPI 文件。
4. 按提示确认安装并重启 Zotero。
5. 回到附加组件列表，确认插件启用。

验收点：

- 插件列表中能看到 `zotero-research-workbench@local` 或对应名称。
- 插件处于启用状态。
- 此步骤只安装插件，不应创建 Zotero 笔记、标签、附件或条目字段。

## 2. 打开 Zotero 研究工作台

1. 在 Zotero 主窗口中选中一篇文献条目。
2. 从插件菜单或上下文入口点击 `打开研究工作台`。
3. 确认打开标题为 `Zotero 研究工作台` 的面板。
4. 点击 `刷新当前上下文`。

验收点：

- `选中文献` 区域显示题名、作者/年份/来源、摘要。
- 如果文献有 PDF 子附件，`PDF 附件` 显示检测到的本地路径或附件标题。
- 该步骤只读当前 Zotero 选择，不写 Zotero 原生笔记，也不写 Zotero 条目元数据。

## 3. 配置 LLM Provider 并测试连接

1. 在 `LLM 服务商设置` 中填写：
   - `接口地址`
   - `API 密钥`
   - `模型名称`
   - `请求超时（毫秒）`
   - `每分钟请求数`
   - `单任务输入 Token 上限`
2. 点击 `保存设置`。
3. 点击 `测试连接`。

验收点：

- 保存后显示 `设置已保存`。
- 重新打开面板后，接口地址、模型名称、超时、每分钟请求数、Token 上限会回填。
- API 密钥输入框应保持空白，并提示已保存时留空保持不变。
- 连接成功时显示 `连接成功` 或等价成功提示。
- 失败时显示中文错误，例如 API 密钥无效、模型不可用、接口地址不可用、请求超时；展开 `技术细节` 可查看脱敏后的诊断信息。
- 该步骤写 Zotero preferences 中的 provider 配置，不写 Zotero 原生笔记或条目元数据。

## 4. 总结选中文献

1. 保持 Zotero 主窗口中选中一篇文献。
2. 在研究工作台点击 `总结选中文献`。
3. 等待 `生成结果` 区域出现中文总结。
4. 查看 `草稿状态` 与 `最近草稿`。

验收点：

- 请求使用已保存的 Provider、请求频率限制和单任务 Token 上限。
- 结果显示在 `生成结果`。
- 新结果先保存为 Workbench Local Store 中的 Research Note Draft，并记录任务记录。
- 此时不应出现新的 Zotero child note。
- 如果请求频率超限，应显示 `请求过于频繁，请稍后再试`。
- 如果输入超过单任务 Token 上限，应显示 `输入内容超过单任务 Token 上限`。
- 失败时可展开 `技术细节`，其中不应暴露 API 密钥、bearer token 或授权头。

## 5. 翻译阅读上下文

1. 在 Zotero PDF Reader 或文档窗口中选中一段文本。
2. 回到研究工作台点击 `刷新阅读上下文`。
3. 确认 `阅读上下文` 显示选中文本。
4. 点击 `翻译阅读上下文`。
5. 等待 `生成结果` 区域出现中文翻译。

验收点：

- `刷新阅读上下文` 只读取当前 Reader/window selection。
- 未选中文本时显示 `暂无阅读器选中文本`。
- 翻译结果先保存为 Workbench Local Store 中的 Research Note Draft，并记录任务记录。
- 此步骤不自动写 Zotero 原生笔记、标签、附件或条目字段。

## 6. 确认写入 Zotero 笔记

1. 完成文献总结或阅读上下文翻译，确保 `生成结果` 非空。
2. 点击 `确认并写入 Zotero 笔记`。
3. 回到 Zotero 主窗口，展开当前选中文献条目。
4. 检查是否出现新的 child note。

验收点：

- 面板显示 `已确认并写入 Zotero 笔记`。
- 当前 Zotero 文献下新增一条原生 child note。
- Workbench Local Store 中对应 draft 被标记为 confirmed，并记录 Zotero note key。
- 这是本手册中预期会写 Zotero 原生笔记的确认动作。
- 该动作不应修改 Zotero 条目字段、标签、附件或 Zotero-native relations。

## 7. 捕获并复核图谱种子

1. 在 `图谱种子` 区域填写 `目标论文或作品线索`。
2. 选择 `关系类型`：相关、支持、对比、引用。
3. 选择 `置信度`：中、低、高。
4. 点击 `捕获图谱种子`。
5. 在 `最近图谱种子` 或 `图谱种子复核队列` 点击刷新。
6. 使用复核队列筛选项检查：
   - 复核状态：待复核、全部、已确认、已拒绝
   - 服务商筛选
   - 置信度
   - 关系类型
   - 种子来源
   - 仅当前作品
7. 对待复核种子执行确认或拒绝。

验收点：

- 捕获后显示 `已捕获图谱种子`。
- 新图谱种子写入 Workbench Local Store，并生成任务记录。
- 复核确认/拒绝只更新 Workbench Local Store 中的 review state，并记录 `review-graph-seed` 任务。
- 确认图谱种子不等于写入 Zotero 关系，也不修改 Zotero 条目元数据。
- 失败时展开 `技术细节`，确认敏感信息已脱敏。

## 8. v0.4 文献发现与导入流水线

1. 点击 Zotero toolbar `研究工作台` 按钮；如果 toolbar 按钮没有出现，从 Tools menu 点击 `打开研究工作台`。
2. 确认 Research Panel 打开，并显示 `研究主题`、`三段式流水线`、`启动`、`复核`、`写入`。
3. 输入研究主题标题、描述和文献发现请求。
4. 选择 OpenAlex、Crossref、Unpaywall；HTTP Connector 仅在已配置合法 endpoint 时选择。
5. 点击 `生成发现计划`。
6. 确认计划预览写明来源、最多候选数量，并说明 `不会自动写入 Zotero`。
7. 点击 `确认并搜索`。
8. 确认候选文献出现，且每条显示来源与异常标签。
9. 选择一个无异常候选，点击 `批量加入写入计划`。
10. 确认 `Zotero 写入队列` 显示待写入条目和附件数量。
11. 点击队列中的 `运行写入队列`。
12. 回到 Zotero 主窗口，确认创建了预期 Zotero 条目；如候选含可导入 PDF 附件，确认附件被创建在对应条目下。
13. 右键 Zotero item，选择 `从选中文献发现相关文献`；确认打开的是 draft discovery plan flow，而不是立即搜索或写入。

验收点：

- 发现计划确认前，不应调用 OpenAlex、Crossref、Unpaywall 或 HTTP connector。
- 搜索结果只写 Workbench Local Store 的 `documentCandidates` 和任务记录，不写 Zotero 原生条目或附件。
- 异常候选不能被快速加入写入计划，必须单独复核。
- 写入计划创建后仍不写 Zotero，只有运行 `Zotero 写入队列` 才写 Zotero。
- Zotero 写入队列一次只运行一个 item 或 attachment 写入。
- 附件写入失败时，已创建的条目应保留，失败 entry 应在本地队列结果中可见。
- 不应出现 Sci-Hub、盗版源、Google Scholar scraping 或本地命令 connector 执行入口。
- Ethereal Reference 占位区可见，但不应渲染关系网络图或 force-directed layout。

## 9. 生成引用关系

1. 在 `图谱种子复核队列` 中筛选 `已确认`。
2. 找到已确认且未生成关系的种子。
3. 点击 `生成关系`。
4. 打开或刷新 `引用关系图谱`。

验收点：

- 面板显示 `已生成引用关系`。
- `引用关系图谱` 中出现对应本地关系。
- 该动作写 Workbench Local Store 的 `citationRelations`，并记录 `promote-graph-seed-to-citation-relation` 任务。
- 该动作不写 Zotero-native relations，不改 Zotero 条目字段、标签或笔记。

## 10. 引用关系质量筛选

1. 在 `引用关系图谱` 中点击 `刷新关系图谱`。
2. 切换 `关系范围`：当前作品、全部关系。
3. 切换 `质量筛选`：
   - 全部质量
   - 缺少目标
   - 缺少证据
   - 低置信度
   - 缺少来源种子

验收点：

- 列表按筛选条件更新。
- 行内显示来源作品、目标线索、关系类型、置信度、证据、来源图谱种子 id、质量标签。
- 质量筛选只是本地检视辅助，不写 Zotero，也不修改 Workbench Local Store 中的关系内容。

## 11. 作品身份线索状态筛选

1. 在 `作品身份线索` 点击 `刷新身份线索`。
2. 切换 `身份范围`：当前作品、全部线索。
3. 切换 `身份筛选`：
   - 全部身份
   - 无 DOI
   - 多来源
   - 有引用关系
   - 孤立线索

验收点：

- 列表展示本地快照中聚合出的 work id、title、DOI、Zotero item key、记录数量和最近出现时间。
- 状态标签来自本地 drafts、graph seeds、citation relations 的聚合结果。
- 该视图只读 Workbench Local Store；不会合并作品、查询外部服务、创建 Zotero 条目或写 Zotero 元数据。

## 12. 重复作品候选

1. 在 `重复作品候选` 点击 `刷新重复候选`。
2. 切换 `候选范围`：全部关系、当前作品。
3. 切换 `置信度`：全部、高、中。
4. 切换 `匹配原因`：
   - 全部
   - 共享 DOI
   - 共享 Zotero 条目键
   - 标题相似
5. 对候选行展开 `查看证据`。

验收点：

- 候选来自 Workbench Local Store 中的本地 work identities。
- 高置信通常对应共享 DOI 或共享 Zotero 条目键；中置信通常对应归一化标题相同。
- 证据只显示产生重复信号的草稿、图谱种子或引用关系。
- 该功能不合并作品、不改 Zotero 条目、不重写 work id、不删除记录、不调用外部身份服务。

## 13. 导出和导入 JSON

1. 点击 `导出工作台状态`。
2. 选择保存位置，保存 JSON。
3. 打开导出的 JSON，抽查内容。
4. 点击 `导入工作台状态`，选择刚导出的 JSON。
5. 点击 `刷新记录`，查看最近草稿、图谱种子和任务记录。

验收点：

- JSON package 类型为工作台导出快照。
- 导出内容包含 Workbench Local Store 快照：researchTopics、documentCandidates、literatureDiscoveryJobs、zoteroImportPlans、zoteroWriteQueues、drafts、graphSeeds、citationRelations、taskLedger、prompt templates/overrides、provider 设置结构和 provenance。
- API 密钥、WebDAV 密码、bearer token、authorization header、secret 字段应显示为 `<redacted>`，不能明文出现。
- 导入只恢复 Workbench Local Store 快照到 Zotero preferences；不创建 Zotero 笔记、条目、标签或附件。
- 无效 JSON 或不支持的 package 会显示中文错误，并可展开 `技术细节`。

## 14. 导出和导入 ZIP

1. 点击 `导出 ZIP`。
2. 保存 `.zip` 文件。
3. 检查 ZIP 内只包含：
   - `manifest.json`
   - `snapshot.json`
4. 点击 `导入 ZIP`，选择刚导出的 ZIP。
5. 点击 `刷新记录`。

验收点：

- `snapshot.json` 是同一类脱敏 JSON 快照。
- ZIP 不包含 PDF、附件、Zotero 条目全量元数据、日志、凭据、加密秘密或 WebDAV 同步物料。
- ZIP 导入只恢复 Workbench Local Store 快照；不写 Zotero 原生笔记或条目元数据。

## 15. WebDAV 上传

1. 在 `WebDAV 导出目标` 填写：
   - `服务器地址`
   - `用户名`
   - `密码`
   - `远端目录`
2. 点击 `保存 WebDAV 设置`。
3. 点击 `测试 WebDAV`。
4. 点击 `上传 JSON 到 WebDAV`。
5. 到 WebDAV 服务端检查远端目录下是否出现 timestamped JSON 文件。

验收点：

- 保存后显示 `WebDAV 设置已保存`。
- 重新打开面板时，密码框保持空白；留空保存应保留已有密码。
- 测试成功显示 `WebDAV 连接成功`。
- 上传成功显示 `已上传 WebDAV JSON：...`。
- 上传的是与 `导出工作台状态` 相同的脱敏 JSON，不上传 ZIP。
- 插件会尝试用 WebDAV `MKCOL` 创建缺失的远端目录父级；账户无权限时应给出中文错误。
- WebDAV 功能是手动上传，不自动同步、不从 WebDAV 导入、不处理冲突。

## 16. 常见失败与技术细节复核

遇到失败时，先看中文状态，再展开对应区域的 `技术细节`：

- 文献总结/翻译失败：展开 `研究面板` 中生成结果附近的 `技术细节`。
- 图谱种子捕获失败：展开 `图谱种子` 附近的 `技术细节`。
- 文献发现、候选复核、写入队列失败：查看 `候选文献` / `Zotero 写入队列` 附近状态文本，并复核 Workbench Local Store 记录。
- 导入/导出/复核/生成关系失败：展开 `全局入口` 下的 `技术细节`。
- 提示词模板失败：展开 `提示词模板` 下的 `技术细节`。
- WebDAV 失败：展开 `WebDAV 导出目标` 下的 `技术细节`。
- Provider 测试失败：展开 `LLM 服务商设置` 下的 `技术细节`。

复核要求：

- 技术细节应帮助定位 HTTP 状态、超时、格式错误、文件读取/写入错误、ZIP 缺失项、WebDAV 认证失败等问题。
- 技术细节不得泄露 API 密钥、WebDAV 密码、bearer token、authorization header 或 secret 字段。
- 常见 Provider 失败包括：未配置、API 密钥无效、模型不可用、接口地址不可用、请求超时、模型名称未被接口校验。
- 常见导入失败包括：无效 JSON、不支持的工作台导出文件、不支持的 ZIP 包、ZIP 缺少 `snapshot.json`。
- 常见 v0.4 失败包括：未生成发现计划、未选择可执行来源、Unpaywall 缺少 DOI、HTTP connector endpoint 缺失或返回非 JSON、异常候选未复核、附件类型不支持、Zotero 附件写入失败。
- 常见 WebDAV 失败包括：URL 非 http(s)、缺少用户名或密码、认证失败、目录检查失败、目录创建失败、上传失败。

## 17. 最小验收记录模板

人工验收完成后可记录：

```text
日期：
Zotero 版本：
XPI 路径：
LLM Provider：
测试文献：

安装 XPI：通过/失败
打开研究工作台：通过/失败
Provider 保存与测试连接：通过/失败
总结选中文献：通过/失败
翻译阅读上下文：通过/失败
确认写入 Zotero 笔记：通过/失败
图谱种子捕获与复核：通过/失败
v0.4 文献发现与导入流水线：通过/失败
生成引用关系：通过/失败
引用关系质量筛选：通过/失败
作品身份线索状态筛选：通过/失败
重复作品候选：通过/失败
JSON 导出/导入：通过/失败
ZIP 导出/导入：通过/失败
WebDAV 上传：通过/失败/未测
技术细节脱敏：通过/失败

确认 Zotero 原生笔记写入只来自用户确认：
确认 Zotero 条目/附件写入只来自用户运行写入队列：
确认其他功能只读或只写 Workbench Local Store：
问题与截图：
```
