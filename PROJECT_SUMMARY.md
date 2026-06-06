# Zotero Research Workbench 项目说明

## 项目定位

当前主代码项目。实际产品名是 Zotero Research Workbench / Zotero 研究工作台，是面向 Zotero 8/9 的中文研究工作流插件。

GitHub 仓库名：`Alice1323/zotero-research-workbench`。

## 当前状态

- `v0.2.0`、`v0.3.0` 等早期发布产物已保留在 `dist/`。
- 当前本机主线版本是 `v0.4.0beta2`，对应 XPI 为 `dist/zotero-research-workbench-0.4.0beta2.xpi`。
- V0.4 文献发现与导入流水线已在本机 `master` 分支实现并打包：研究主题、Document Candidate protocol、OpenAlex/Crossref/Unpaywall/HTTP connector、候选复核、异常阻断、Zotero Write Queue、工具栏入口、右键菜单入口和 Ethereal Reference 预留区。
- 本机 `master` 曾显示比 `origin/master` 超前提交；继续交接前应重新核对 `git status --short --branch`。
- 自动化代码检查和 Node 测试是交接前基线；真实 Zotero 工具栏、右键菜单、item/attachment 写入仍需要手动运行时 QA。

## 关键入口

- `README.md`：项目功能、命令和行为说明。
- `CONTEXT.md`：项目领域语言和边界。
- `package.json`：Node 测试、检查、打包命令。
- `src/core/`：核心逻辑模块。
- `chrome/content/`：Zotero 插件运行时 UI 与接线。
- `tests/`：Node 测试。
- `dist/`：XPI 和导出样本等构建产物。
- `.scratch/architecture-debt/`：本地架构债、V0.21 自检材料；其中 V0.21 自检草稿默认不提交。

## 主要内容

- Zotero 8/9 插件外壳。
- 中文研究工作台面板。
- OpenAI-compatible Provider 设置、连接测试、摘要和翻译。
- Research Note Draft、显式写入 Zotero 笔记。
- Workbench Local Store、Task Ledger、Graph Seed。
- JSON/ZIP 导入导出和 WebDAV JSON 上传。
- 图谱种子复核、引用关系图谱、作品身份线索、重复作品候选。
- AI Task Workspace：自然语言任务、计划确认、队列、重试/跳过/诊断和手动恢复。
- V0.4 文献发现与导入流水线：研究主题、候选文献复核、导入计划和串行 Zotero 写入队列。

## 不要误用

- 不要把这个目录当纯资料归档；这里是主代码工作树。
- 不要随意删除 `dist/`、`.scratch/` 或未提交文件，里面可能有当前发布包、测试产物、架构债和审计材料。
- 不要从旧 `zoteroai项目/` 继续开发，除非是在做历史对照。
- 不要把 `zotero-ai-literature-assistant-v1/` 当成当前主入口；当前主入口是本目录根部。

## 下一步建议

1. 先核对 `git status --short --branch`。
2. 交接或发布前运行 `npm run check`、`npm test`、`npm run package` 和 `node --test tests\package.test.js`。
3. 在 Zotero 8/9 隔离 profile 中执行 `docs/first-run-manual-qa.md`，重点验证 V0.4 工具栏、右键菜单、发现计划确认、候选复核和 Zotero 写入队列。
4. 若继续下一阶段，先读 `docs/README.md`、V0.4 spec/plan、ADR 和 manual QA 记录，再决定是否推进 V0.5 Ethereal Reference 图谱。
