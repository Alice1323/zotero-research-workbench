# Zotero Research Workbench 项目说明

## 项目定位

当前主代码项目。实际产品名是 Zotero Research Workbench / Zotero 研究工作台，是面向 Zotero 8/9 的中文研究工作流插件。

## 当前状态

- `v0.2.0` 已作为稳定版本保留并发布。
- `0.21.0-beta.1` / V0.21 beta 架构加固快照已推送到 GitHub `master`。
- V0.3 的产品决策、ADR、设计文档和 Slice 1 实施计划已进入 `docs/`，作为下一阶段开发基线。
- 当前目录是后续继续开发、测试、打包、发布的主入口。

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
- V0.21 架构切口：local store transaction、graph review workflow、research panel orchestrator。

## 不要误用

- 不要把这个目录当纯资料归档；这里是主代码工作树。
- 不要随意删除 `dist/`、`.scratch/` 或未提交文件，里面可能有当前 beta 产物和审计材料。
- 不要从旧 `zoteroai项目/` 继续开发，除非是在做历史对照。

## 下一步建议

1. 先核对 `git status --short --branch`。
2. 若要继续 V0.3，先读 `docs/README.md`、V0.3 spec、ADR 和 Slice 1 plan。
3. 实施 V0.3 前保持 `dist/` 发布包、`.scratch/` 自检草稿和代码提交分开处理。
