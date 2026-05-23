const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function getFunctionBody(source, functionName) {
  const match = new RegExp(`function ${functionName}\\([^)]*\\) \\{`).exec(source);
  assert.ok(match, `${functionName} should exist`);
  let depth = 1;
  let index = match.index + match[0].length;
  const start = index;
  while (index < source.length) {
    const character = source[index];
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index);
      }
    }
    index += 1;
  }
  assert.fail(`${functionName} body should close`);
}

test("manifest presents Chinese product name and description", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

  assert.equal(manifest.name, "Zotero 研究工作台");
  assert.equal(manifest.description, "面向 Zotero 8/9 的多篇文献综合与研究笔记工作流插件。");
});

test("Zotero tools menu uses Chinese label", () => {
  const plugin = fs.readFileSync(path.join(root, "chrome/content/workbenchPlugin.mjs"), "utf8");

  assert.match(plugin, /打开研究工作台/);
  assert.doesNotMatch(plugin, /Open Research Workbench/);
});

test("research panel exposes Chinese LLM provider settings", () => {
  const panel = fs.readFileSync(path.join(root, "chrome/content/researchPanel.xhtml"), "utf8");

  for (const text of [
    "Zotero 研究工作台",
    "研究面板",
    "选中文献",
    "AI 任务工作台",
    "任务需求",
    "请找出当前选中文献的共同点，并生成一篇独立研究笔记",
    "生成任务计划",
    "计划预览",
    "确认并开始",
    "暂停任务",
    "继续任务",
    "取消任务",
    "并发上限",
    "任务队列",
    "任务生成结果",
    "失败诊断",
    "可继续任务",
    "研究主题",
    "三段式流水线",
    "启动",
    "复核",
    "写入",
    "文献发现",
    "候选文献",
    "来源选择",
    "OpenAlex",
    "Crossref",
    "Unpaywall",
    "HTTP Connector",
    "生成发现计划",
    "确认并搜索",
    "批量加入写入计划",
    "异常候选需单独复核",
    "Zotero 写入队列",
    "Ethereal Reference",
    "关系网络将在 v0.5 启用",
    "成功",
    "跳过",
    "失败",
    "PDF 附件",
    "未找到 PDF 附件",
    "阅读上下文",
    "刷新阅读上下文",
    "暂无阅读器选中文本",
    "刷新当前上下文",
    "总结选中文献",
    "翻译阅读上下文",
    "生成结果",
    "复制结果",
    "确认并写入 Zotero 笔记",
    "草稿状态",
    "当前结果尚未保存",
    "最近草稿",
    "暂无草稿",
    "图谱种子",
    "目标论文或作品线索",
    "关系类型",
    "置信度",
    "捕获图谱种子",
    "全局入口",
    "导出工作台状态",
    "导入工作台状态",
    "导出 ZIP",
    "导入 ZIP",
    "刷新记录",
    "提示词模板",
    "模板任务",
    "允许变量",
    "模板内容",
    "保存提示词模板",
    "重置为默认模板",
    "WebDAV 导出目标",
    "服务器地址",
    "用户名",
    "密码",
    "远端目录",
    "保存 WebDAV 设置",
    "测试 WebDAV",
    "上传 JSON 到 WebDAV",
    "Nutstore/坚果云",
    "最近图谱种子",
    "暂无图谱种子",
    "最近任务记录",
    "暂无任务记录",
    "作品身份线索",
    "身份范围",
    "身份筛选",
    "全部身份",
    "刷新身份线索",
    "暂无作品身份线索",
    "重复作品候选",
    "候选范围",
    "匹配原因",
    "共享 DOI",
    "共享 Zotero 条目键",
    "标题相似",
    "刷新重复候选",
    "暂无重复作品候选",
    "引用关系图谱",
    "关系范围",
    "质量筛选",
    "当前作品",
    "全部关系",
    "全部质量",
    "刷新关系图谱",
    "暂无引用关系",
    "图谱种子复核队列",
    "复核状态",
    "服务商筛选",
    "仅当前作品",
    "查看选项说明",
    "当前作品：只显示当前选中文献对应的数据。",
    "全部线索：显示本地工作台中记录过的全部作品身份线索。",
    "身份筛选只显示需要对应复查提示的本地作品身份线索。",
    "高：DOI 或 Zotero 条目键完全相同，优先复查。",
    "中：标题归一化后相同，仅作为人工判断提示。",
    "共享 Zotero 条目键：多个作品记录指向同一个 Zotero 条目键。",
    "待复核：尚未人工确认或拒绝的图谱种子。",
    "AI 推断：由模型或规则推断，必须复核后再使用。",
    "质量筛选只显示需要对应复查提示的本地引用关系。",
    "已确认图谱种子可生成关系；已生成关系会显示为本地引用关系。",
    "生成关系",
    "已生成关系",
    "暂无待复核图谱种子",
    "仅导出脱敏 JSON/ZIP，不包含 API 密钥或 WebDAV 密码。",
    "LLM 服务商设置",
    "接口地址",
    "API 密钥",
    "模型名称",
    "请求超时（毫秒）",
    "每分钟请求数",
    "单任务输入 Token 上限",
    "保存设置",
    "测试连接"
  ]) {
    assert.match(panel, new RegExp(text));
  }

  assert.match(panel, /type="password"/);
  assert.match(panel, /class="result-header"/);
  assert.match(panel, /class="section-header"/);
  assert.match(panel, /class="option-help-toggle"/);
  assert.match(panel, /id="selected-paper-pdf"/);
  assert.match(panel, /id="ai-task-workspace"/);
  assert.match(panel, /id="ai-job-request"/);
  assert.match(panel, /id="ai-job-concurrency-limit"/);
  assert.match(panel, /id="ai-job-create-plan"/);
  assert.match(panel, /id="ai-job-plan-preview"/);
  assert.match(panel, /id="ai-job-confirm-start"/);
  assert.match(panel, /id="ai-job-pause"/);
  assert.match(panel, /id="ai-job-resume"/);
  assert.match(panel, /id="ai-job-cancel"/);
  assert.match(panel, /id="ai-job-progress"/);
  assert.match(panel, /id="ai-task-queue-list"/);
  assert.match(panel, /id="ai-task-results-list"/);
  assert.match(panel, /id="ai-task-results-summary"/);
  assert.match(panel, /id="ai-job-diagnosis"/);
  assert.match(panel, /id="ai-job-resume-list"/);
  for (const id of [
    "research-topic-title",
    "research-topic-description",
    "pipeline-lane-launch",
    "pipeline-lane-review",
    "pipeline-lane-write",
    "literature-discovery-request",
    "literature-discovery-create-plan",
    "literature-discovery-confirm-search",
    "document-candidate-list",
    "document-candidate-review-status",
    "zotero-import-plan-create",
    "zotero-write-queue-list",
    "ethereal-reference-placeholder"
  ]) {
    assert.match(panel, new RegExp(`id="${id}"`));
  }
  assert.match(panel, /id="save-paper-summary-note"/);
  assert.match(panel, /class="primary-action"/);
  assert.match(panel, /id="refresh-reading-context"/);
  assert.match(panel, /id="translate-reading-context"/);
  assert.match(panel, /id="reading-context-output"/);
  assert.match(panel, /id="graph-seed-target"/);
  assert.match(panel, /id="graph-seed-relation"/);
  assert.match(panel, /id="graph-seed-confidence"/);
  assert.match(panel, /id="capture-graph-seed"/);
  assert.match(panel, /id="graph-seed-status"/);
  assert.match(panel, /id="graph-seed-error-details"/);
  assert.match(panel, /id="graph-seed-error-detail-text"/);
  assert.match(panel, /id="export-workbench-state"/);
  assert.match(panel, /id="import-workbench-state"/);
  assert.match(panel, /id="export-workbench-zip"/);
  assert.match(panel, /id="import-workbench-zip"/);
  assert.match(panel, /id="workbench-export-status"/);
  assert.match(panel, /id="workbench-error-details"/);
  assert.match(panel, /id="workbench-error-detail-text"/);
  assert.match(panel, /id="refresh-workbench-records"/);
  assert.match(panel, /id="prompt-template-selector"/);
  assert.match(panel, /id="prompt-template-variables"/);
  assert.match(panel, /id="prompt-template-body"/);
  assert.match(panel, /id="prompt-template-save"/);
  assert.match(panel, /id="prompt-template-reset"/);
  assert.match(panel, /id="prompt-template-status"/);
  assert.match(panel, /id="prompt-template-error-details"/);
  assert.match(panel, /id="prompt-template-error-detail-text"/);
  assert.match(panel, /id="webdav-server-url"/);
  assert.match(panel, /id="webdav-username"/);
  assert.match(panel, /id="webdav-password"/);
  assert.match(panel, /id="webdav-remote-directory"/);
  assert.match(panel, /id="webdav-save"/);
  assert.match(panel, /id="webdav-test"/);
  assert.match(panel, /id="webdav-upload-json"/);
  assert.match(panel, /id="webdav-status"/);
  assert.match(panel, /id="webdav-error-details"/);
  assert.match(panel, /id="webdav-error-detail-text"/);
  assert.match(panel, /id="paper-error-details"/);
  assert.match(panel, /id="paper-error-detail-text"/);
  assert.match(panel, /id="provider-status" class="status"/);
  assert.match(panel, /id="provider-timeout-ms"/);
  assert.match(panel, /id="provider-requests-per-minute"/);
  assert.match(panel, /id="provider-max-input-tokens"/);
  assert.match(panel, /id="provider-error-details"/);
  assert.match(panel, /id="provider-error-detail-text"/);
  assert.match(panel, /技术细节/);
  assert.match(panel, /id="graph-seeds-list"/);
  assert.match(panel, /id="task-ledger-list"/);
  assert.match(panel, /id="work-identity-scope-filter"/);
  assert.match(panel, /id="work-identity-status-filter"/);
  assert.match(panel, /id="refresh-work-identity-inspector"/);
  assert.match(panel, /id="work-identity-inspector-list"/);
  assert.match(panel, /id="duplicate-work-scope-filter"/);
  assert.match(panel, /id="duplicate-work-confidence-filter"/);
  assert.match(panel, /id="duplicate-work-reason-filter"/);
  assert.match(panel, /id="refresh-duplicate-work-candidates"/);
  assert.match(panel, /id="duplicate-work-candidates-list"/);
  assert.match(panel, /id="citation-graph-scope-filter"/);
  assert.match(panel, /id="citation-graph-quality-filter"/);
  assert.match(panel, /id="refresh-citation-graph-inspector"/);
  assert.match(panel, /id="citation-graph-inspector-list"/);
  assert.match(panel, /id="graph-seed-review-state-filter"/);
  assert.match(panel, /id="graph-seed-provider-filter"/);
  assert.match(panel, /id="graph-seed-confidence-filter"/);
  assert.match(panel, /id="graph-seed-relation-filter"/);
  assert.match(panel, /id="graph-seed-kind-filter"/);
  assert.match(panel, /id="graph-seed-current-work-only"/);
  assert.match(panel, /id="graph-seed-review-list"/);
  assert.match(panel, /id="refresh-graph-seed-review"/);
  assert.match(panel, /readingContext\.js/);
  assert.match(panel, /id="recent-drafts-list"/);
  assert.match(panel, /align-items:\s*center/);
  assert.doesNotMatch(panel, /Current item actions will appear here/);
  assert.doesNotMatch(panel, /Global Entry Point/);
  assert.doesNotMatch(panel, />Work Identity Inspector</);
  assert.doesNotMatch(panel, />Duplicate Work Candidates</);
  assert.doesNotMatch(panel, />Citation Graph Inspector</);
  assert.doesNotMatch(panel, />暂无 Citation Relation</);
  assert.doesNotMatch(panel, />共享 Zotero Key</);
  assert.doesNotMatch(panel, /本地 Citation Relation/);
});

test("read-only visual sections expose prominent option help toggles", () => {
  const panel = fs.readFileSync(path.join(root, "chrome/content/researchPanel.xhtml"), "utf8");

  for (const title of ["作品身份线索", "重复作品候选", "引用关系图谱", "图谱种子复核队列"]) {
    const titleIndex = panel.indexOf(`<strong>${title}</strong>`);
    assert.notEqual(titleIndex, -1, `${title} title should exist`);
    const nextChunk = panel.slice(titleIndex, titleIndex + 700);
    assert.match(nextChunk, /<summary class="option-help-toggle">查看选项说明<\/summary>/);
  }
});

test("research panel runtime wires reading context translation action", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");

  assert.match(runtime, /function translateReadingContext/);
  assert.match(runtime, /requestReadingContextTranslation/);
  assert.match(runtime, /createReadingTranslationDraftInput/);
  assert.match(
    getFunctionBody(runtime, "saveReadingTranslationDraft"),
    /ResearchPanelOrchestrator\.createReadingTranslationDraftWorkflow/
  );
  assert.match(runtime, /translate-reading-context"\)\.addEventListener\("click", translateReadingContext\)/);
});

test("research panel runtime wires selected paper PDF attachment status", () => {
  const panel = fs.readFileSync(path.join(root, "chrome/content/researchPanel.xhtml"), "utf8");
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");

  assert.match(panel, /workbenchSelectedPaper\.js/);
  assert.ok(panel.indexOf("workbenchSelectedPaper.js") < panel.indexOf("paperSummary.js"));
  assert.match(runtime, /WorkbenchSelectedPaperRuntime/);
  assert.match(runtime, /createBrowserSelectedPaperRuntime/);
  assert.match(runtime, /normalizePaperContext/);
  assert.match(runtime, /selectBestPdfAttachment/);
  assert.match(runtime, /readSelectedPaperContext/);
  assert.match(runtime, /readSelectedPaperContexts/);
  assert.match(runtime, /WorkbenchSelectedPapers/);
  assert.match(runtime, /function renderSelectedPaperContexts/);
  assert.match(runtime, /readSelectedPaperPdfAttachment/);
  assert.match(runtime, /function renderPaperPdfAttachment/);
  assert.match(runtime, /selected-paper-pdf/);
  assert.doesNotMatch(runtime, /function readSelectedPaperPdfAttachment/);
  assert.doesNotMatch(runtime, /function getSelectedRegularItem/);
  assert.doesNotMatch(runtime, /function readAttachmentPath/);
  assert.doesNotMatch(runtime, /function normalizePdfAttachment/);
  assert.doesNotMatch(runtime, /function isPdfAttachment/);
  assert.doesNotMatch(runtime, /ZoteroPane\?\.getSelectedItems/);
  assert.doesNotMatch(runtime, /Zotero\?\.Items\?\.get/);
});

test("research panel loads v0.4 literature discovery runtime modules", () => {
  const panel = fs.readFileSync(path.join(root, "chrome/content/researchPanel.xhtml"), "utf8");

  for (const scriptName of [
    "researchTopic.js",
    "documentCandidateProtocol.js",
    "literatureDiscovery.js",
    "literatureSourceAdapters.js",
    "documentCandidateReview.js",
    "zoteroWriteQueue.js",
    "zoteroItemWriter.js",
    "etherealReferenceGraph.js"
  ]) {
    assert.match(panel, new RegExp(`src="${scriptName}"`));
  }

  assert.ok(panel.indexOf("documentCandidateProtocol.js") < panel.indexOf("literatureDiscovery.js"));
  assert.ok(panel.indexOf("documentCandidateProtocol.js") < panel.indexOf("literatureSourceAdapters.js"));
  assert.ok(panel.indexOf("researchTopic.js") < panel.indexOf("workbenchLocalStoreTransaction.js"));
  assert.ok(panel.indexOf("documentCandidateReview.js") < panel.indexOf("researchPanelOrchestrator.js"));
  assert.ok(panel.indexOf("zoteroWriteQueue.js") < panel.indexOf("researchPanelOrchestrator.js"));
  assert.ok(panel.indexOf("zoteroItemWriter.js") < panel.indexOf("paperSummary.js"));
  assert.ok(panel.indexOf("etherealReferenceGraph.js") < panel.indexOf("researchPanelOrchestrator.js"));
});

test("research panel runtime wires v0.4 pipeline skeleton actions", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");

  assert.match(runtime, /function createLiteratureDiscoveryPlan/);
  assert.match(runtime, /function renderDocumentCandidateReview/);
  assert.match(runtime, /function renderZoteroWriteQueue/);
  assert.match(runtime, /literature-discovery-create-plan"\)\.addEventListener\("click", createLiteratureDiscoveryPlan\)/);
});

test("research panel runtime wires provider request guards", () => {
  const panel = fs.readFileSync(path.join(root, "chrome/content/researchPanel.xhtml"), "utf8");
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
  const guard = fs.readFileSync(path.join(root, "src/core/llmRuntimeGuard.js"), "utf8");

  assert.match(panel, /providerChatCompletion\.js/);
  assert.match(panel, /llmRuntimeGuard\.js/);
  assert.match(panel, /zoteroNoteWriter\.js/);
  assert.match(panel, /webDavClient\.js/);
  assert.match(panel, /clipboardWriter\.js/);
  assert.match(panel, /workbenchFileRuntime\.js/);
  assert.match(panel, /workbenchFileIo\.js/);
  assert.match(panel, /workbenchSelectedPaper\.js/);
  assert.match(panel, /workbenchFetchRuntime\.js/);
  assert.ok(panel.indexOf("providerChatCompletion.js") < panel.indexOf("providerConnection.js"));
  assert.ok(panel.indexOf("providerChatCompletion.js") < panel.indexOf("paperSummary.js"));
  assert.ok(panel.indexOf("llmRuntimeGuard.js") < panel.indexOf("paperSummary.js"));
  assert.ok(panel.indexOf("zoteroNoteWriter.js") < panel.indexOf("paperSummary.js"));
  assert.ok(panel.indexOf("webDavClient.js") < panel.indexOf("paperSummary.js"));
  assert.ok(panel.indexOf("clipboardWriter.js") < panel.indexOf("paperSummary.js"));
  assert.ok(panel.indexOf("workbenchFileRuntime.js") < panel.indexOf("paperSummary.js"));
  assert.ok(panel.indexOf("workbenchFileIo.js") < panel.indexOf("paperSummary.js"));
  assert.ok(panel.indexOf("workbenchSelectedPaper.js") < panel.indexOf("paperSummary.js"));
  assert.ok(panel.indexOf("workbenchFetchRuntime.js") < panel.indexOf("paperSummary.js"));
  assert.match(runtime, /WorkbenchProviderChatCompletion/);
  assert.match(runtime, /requestOpenAICompatibleChatCompletion/);
  assert.match(runtime, /WorkbenchFetchRuntime/);
  assert.match(runtime, /createBrowserFetchRuntime/);
  assert.match(runtime, /WorkbenchLlmRuntimeGuardModule/);
  assert.match(runtime, /WorkbenchLlmRuntimeGuard/);
  assert.match(runtime, /createLlmRuntimeGuard/);
  assert.match(runtime, /assertLlmRuntimeRequestAllowed/);
  assert.match(runtime, /WorkbenchZoteroNoteWriter/);
  assert.match(runtime, /writeZoteroChildNote/);
  assert.match(runtime, /writeZoteroStandaloneNote/);
  assert.match(runtime, /multi-paper-commonality-note/);
  assert.doesNotMatch(runtime, /new Zotero\.Item\("note"\)/);
  assert.doesNotMatch(runtime, /note\.saveTx\(\)/);
  assert.match(runtime, /WorkbenchClipboardWriter/);
  assert.match(runtime, /createBrowserClipboardWriter/);
  assert.doesNotMatch(runtime, /function writeClipboardText/);
  assert.doesNotMatch(runtime, /navigator\.clipboard/);
  assert.match(runtime, /WorkbenchFileRuntime/);
  assert.match(runtime, /createWorkbenchFileRuntime/);
  assert.match(runtime, /WorkbenchFileIo/);
  assert.match(runtime, /createBrowserWorkbenchFileIo/);
  assert.match(runtime, /estimatePromptTokens/);
  assert.match(guard, /输入内容超过单任务 Token 上限/);
  assert.match(guard, /请求过于频繁，请稍后再试/);
  assert.doesNotMatch(runtime, /settings\.baseUrl\.replace\(\/\\\/\+\$\/,\s*""\)\}\/chat\/completions/);
  assert.doesNotMatch(runtime, /Authorization:\s*`Bearer \$\{settings\.apiKey\}`/);
  assert.doesNotMatch(runtime, /function createLlmRuntimeGuard/);
  assert.doesNotMatch(runtime, /function assertLlmRuntimeRequestAllowed/);
  assert.doesNotMatch(runtime, /function estimatePromptTokens/);
  assert.doesNotMatch(runtime, /function createLlmRuntimeError/);
  assert.doesNotMatch(runtime, /window\.fetch\.bind\(window\)/);
});

test("research panel runtime wires graph seed capture action", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
  const captureBody = getFunctionBody(runtime, "captureGraphSeed");

  assert.match(runtime, /function captureGraphSeed/);
  assert.match(captureBody, /ResearchPanelOrchestrator\.captureGraphSeedWorkflow/);
  assert.doesNotMatch(captureBody, /captureGraphSeedTransaction/);
  assert.doesNotMatch(captureBody, /appendGraphSeedToSnapshot/);
  assert.match(runtime, /createGraphSeedInput/);
  assert.match(runtime, /capture-graph-seed"\)\.addEventListener\("click", captureGraphSeed\)/);
});

test("research panel runtime routes panel workflows through research panel orchestrator", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
  const saveSummaryBody = getFunctionBody(runtime, "saveSummaryDraft");
  const saveTranslationBody = getFunctionBody(runtime, "saveReadingTranslationDraft");
  const confirmBody = getFunctionBody(runtime, "saveGeneratedResultToZoteroNote");

  assert.match(saveSummaryBody, /ResearchPanelOrchestrator\.createSummaryDraftWorkflow/);
  assert.match(saveTranslationBody, /ResearchPanelOrchestrator\.createReadingTranslationDraftWorkflow/);
  assert.match(confirmBody, /ResearchPanelOrchestrator\.prepareZoteroNoteWrite/);
  assert.match(confirmBody, /ResearchPanelOrchestrator\.confirmDraftSavedToZoteroWorkflow/);
  assert.doesNotMatch(saveSummaryBody, /researchNoteDrafts\.push/);
  assert.doesNotMatch(saveTranslationBody, /researchNoteDrafts\.push/);
  assert.doesNotMatch(saveSummaryBody, /createResearchNoteDraftTransaction/);
  assert.doesNotMatch(saveTranslationBody, /createResearchNoteDraftTransaction/);
  assert.doesNotMatch(confirmBody, /confirmResearchNoteDraftSavedToZoteroTransaction/);
  assert.doesNotMatch(confirmBody, /markSummaryDraftSavedToZotero/);
});

test("research panel runtime wires local export and import actions", () => {
  const panel = fs.readFileSync(path.join(root, "chrome/content/researchPanel.xhtml"), "utf8");
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
  const fileIo = fs.readFileSync(path.join(root, "src/core/workbenchFileIo.js"), "utf8");
  const importJsonBody = getFunctionBody(runtime, "importWorkbenchState");
  const importZipBody = getFunctionBody(runtime, "importWorkbenchZip");

  assert.match(panel, /workbenchSnapshot\.js/);
  assert.ok(panel.indexOf("workbenchSnapshot.js") < panel.indexOf("paperSummary.js"));
  assert.match(panel, /workbenchRuntimeStore\.js/);
  assert.ok(panel.indexOf("workbenchRuntimeStore.js") < panel.indexOf("paperSummary.js"));
  assert.match(panel, /workbenchLocalStoreTransaction\.js/);
  assert.ok(panel.indexOf("workbenchLocalStoreTransaction.js") < panel.indexOf("paperSummary.js"));
  assert.match(panel, /graphReviewWorkflow\.js/);
  assert.ok(panel.indexOf("workbenchLocalStoreTransaction.js") < panel.indexOf("graphReviewWorkflow.js"));
  assert.ok(panel.indexOf("graphReviewWorkflow.js") < panel.indexOf("paperSummary.js"));
  assert.match(panel, /researchPanelOrchestrator\.js/);
  assert.ok(panel.indexOf("graphReviewWorkflow.js") < panel.indexOf("researchPanelOrchestrator.js"));
  assert.ok(panel.indexOf("researchPanelOrchestrator.js") < panel.indexOf("paperSummary.js"));
  assert.match(runtime, /function exportWorkbenchState/);
  assert.match(runtime, /function importWorkbenchState/);
  assert.match(runtime, /WorkbenchSnapshot/);
  assert.match(runtime, /WorkbenchRuntimeStore/);
  assert.match(runtime, /WorkbenchLocalStoreTransaction/);
  assert.match(runtime, /WorkbenchGraphReviewWorkflow/);
  assert.match(runtime, /WorkbenchResearchPanelOrchestrator/);
  assert.match(runtime, /createWorkbenchRuntimeStore/);
  assert.match(runtime, /WorkbenchLocalStore/);
  assert.match(runtime, /createWorkbenchExportPackage/);
  assert.match(runtime, /importWorkbenchExportPackage/);
  assert.match(runtime, /function exportWorkbenchZip/);
  assert.match(runtime, /function importWorkbenchZip/);
  assert.match(runtime, /createWorkbenchZipExportPayload/);
  assert.match(runtime, /importWorkbenchZipExportPayload/);
  assert.match(importJsonBody, /replaceWorkbenchSnapshotFromImportTransaction/);
  assert.match(importZipBody, /replaceWorkbenchSnapshotFromImportTransaction/);
  assert.doesNotMatch(importJsonBody, /const snapshot = importWorkbenchExportPackage/);
  assert.doesNotMatch(importZipBody, /const snapshot = importWorkbenchZipExportPayload/);
  assert.match(runtime, /writeZipExportFile/);
  assert.match(runtime, /readZipExportFile/);
  assert.match(runtime, /writeTextFile/);
  assert.match(runtime, /readTextFile/);
  assert.match(fileIo, /ZIP 导出包为空或缺少 manifest\.json/);
  assert.match(fileIo, /ZIP 导出包为空或缺少 snapshot\.json/);
  assert.doesNotMatch(runtime, /function verifyZipExportFile/);
  assert.doesNotMatch(runtime, /function createZipWriter/);
  assert.doesNotMatch(runtime, /function createZipReader/);
  assert.doesNotMatch(runtime, /function createUtf8InputStream/);
  assert.doesNotMatch(runtime, /function readZipEntryText/);
  assert.doesNotMatch(runtime, /function readStreamBytes/);
  assert.doesNotMatch(runtime, /function resolveLocalFile/);
  assert.doesNotMatch(runtime, /PR_RDWR/);
  assert.doesNotMatch(runtime, /@mozilla\.org\/io\/string-input-stream;1/);
  assert.doesNotMatch(runtime, /setUTF8Data/);
  assert.doesNotMatch(runtime, /IOUtils/);
  assert.doesNotMatch(runtime, /OS\.File/);
  assert.doesNotMatch(runtime, /convertToInputStream/);
  assert.match(runtime, /pickWorkbenchExportFile/);
  assert.match(runtime, /pickDefaultWorkbenchExportFile/);
  assert.doesNotMatch(runtime, /function tryZoteroFilePicker/);
  assert.doesNotMatch(runtime, /function pickComponentsFile/);
  assert.doesNotMatch(runtime, /function showFilePicker/);
  assert.doesNotMatch(runtime, /function initFilePicker/);
  assert.doesNotMatch(runtime, /function filePickerParentCandidates/);
  assert.doesNotMatch(runtime, /parentWindow\?\.browsingContext/);
  assert.match(runtime, /exportWorkbenchStateToDefaultFile/);
  assert.doesNotMatch(runtime, /function getDesktopDirectory/);
  assert.match(runtime, /保存对话框不可用，已导出到/);
  assert.match(runtime, /export-workbench-state"\)\.addEventListener\("click", exportWorkbenchState\)/);
  assert.match(runtime, /import-workbench-state"\)\.addEventListener\("click", importWorkbenchState\)/);
  assert.match(runtime, /export-workbench-zip"\)\.addEventListener\("click", exportWorkbenchZip\)/);
  assert.match(runtime, /import-workbench-zip"\)\.addEventListener\("click", importWorkbenchZip\)/);
  assert.doesNotMatch(runtime, /function createWorkbenchExportPackage/);
  assert.doesNotMatch(runtime, /function importWorkbenchExportPackage/);
  assert.doesNotMatch(runtime, /function createWorkbenchZipExportPayload/);
  assert.doesNotMatch(runtime, /function importWorkbenchZipExportPayload/);
  assert.doesNotMatch(runtime, /function redactSecretMaterial/);
  assert.doesNotMatch(runtime, /function createEmptySnapshot/);
  assert.doesNotMatch(runtime, /setPref\(PREFS\.snapshot/);
});

test("research panel runtime wires WebDAV export target actions", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");

  assert.match(runtime, /webdavServerUrl/);
  assert.match(runtime, /webdavUsername/);
  assert.match(runtime, /webdavPassword/);
  assert.match(runtime, /webdavRemoteDirectory/);
  assert.match(runtime, /function loadWebDavSettings/);
  assert.match(runtime, /function saveWebDavSettings/);
  assert.match(runtime, /function testWebDavConnection/);
  assert.match(runtime, /function uploadWorkbenchJsonToWebDav/);
  assert.match(runtime, /function ensureWebDavRemoteDirectory/);
  assert.match(runtime, /function probeWebDavCollection/);
  assert.match(runtime, /function retryWebDavUpload/);
  assert.match(runtime, /buildWebDavDirectoryRequests/);
  assert.match(runtime, /method:\s*"MKCOL"/);
  assert.match(runtime, /method:\s*"PROPFIND"/);
  assert.match(runtime, /\[201,\s*405\]\.includes\(response\.status\)/);
  assert.match(runtime, /response\.status === 404/);
  assert.match(runtime, /WorkbenchWebDavClient/);
  assert.match(runtime, /createWebDavClient/);
  assert.match(runtime, /requestWebDav/);
  assert.doesNotMatch(runtime, /function requestWebDav/);
  assert.doesNotMatch(runtime, /if \(!window\.fetch\)/);
  assert.match(runtime, /normalizeWebDavExportTarget/);
  assert.match(runtime, /buildWebDavExportRequest/);
  assert.match(runtime, /method:\s*"PROPFIND"/);
  assert.match(runtime, /method:\s*"PUT"/);
  assert.match(runtime, /webdav-save"\)\.addEventListener\("click", saveWebDavSettings\)/);
  assert.match(runtime, /webdav-test"\)\.addEventListener\("click", testWebDavConnection\)/);
  assert.match(runtime, /webdav-upload-json"\)\.addEventListener\("click", uploadWorkbenchJsonToWebDav\)/);
});

test("research panel runtime wires prompt template override actions", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
  const saveBody = getFunctionBody(runtime, "savePromptTemplateOverride");
  const resetBody = getFunctionBody(runtime, "resetPromptTemplateOverride");

  assert.match(runtime, /function loadPromptTemplateEditor/);
  assert.match(runtime, /function savePromptTemplateOverride/);
  assert.match(runtime, /function resetPromptTemplateOverride/);
  assert.match(runtime, /function resolvePromptTemplate/);
  assert.match(saveBody, /const resolved = resolvePromptTemplate\(/);
  assert.ok(
    saveBody.indexOf("resolvePromptTemplate") < saveBody.indexOf("upsertPromptOverrideTransaction"),
    "prompt override save should validate template variables before writing to the local store"
  );
  assert.match(saveBody, /templateId: resolved\.id/);
  assert.match(saveBody, /template: resolved\.template/);
  assert.match(saveBody, /upsertPromptOverrideTransaction/);
  assert.match(resetBody, /removePromptOverrideTransaction/);
  assert.doesNotMatch(saveBody, /const snapshot = upsertPromptOverride\(/);
  assert.doesNotMatch(resetBody, /const snapshot = removePromptOverride\(/);
  assert.match(runtime, /prompt-template-selector"\)\.addEventListener\("change", loadPromptTemplateEditor\)/);
  assert.match(runtime, /prompt-template-save"\)\.addEventListener\("click", savePromptTemplateOverride\)/);
  assert.match(runtime, /prompt-template-reset"\)\.addEventListener\("click", resetPromptTemplateOverride\)/);
  assert.match(runtime, /showLayeredError\("prompt-template-status"/);
});

test("research panel runtime does not expose old local-store mutators", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
  const exportBody = runtime.slice(runtime.indexOf("window.WorkbenchPaperSummary = {"));

  assert.doesNotMatch(exportBody, /appendGraphSeedToSnapshot/);
  assert.doesNotMatch(exportBody, /markSummaryDraftSavedToZotero/);
  assert.doesNotMatch(exportBody, /markGraphSeedReviewed/);
  assert.doesNotMatch(exportBody, /promoteGraphSeedToCitationRelation/);
  assert.doesNotMatch(exportBody, /upsertPromptOverride/);
  assert.doesNotMatch(exportBody, /removePromptOverride/);
  assert.match(exportBody, /WorkbenchLocalStoreTransaction/);
});

test("research panel runtime routes high-risk failures through layered errors", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");

  assert.match(runtime, /function showLayeredError/);
  assert.match(runtime, /function createLayeredErrorNotice/);
  assert.match(runtime, /removeAttribute\("hidden"\)/);
  assert.match(runtime, /setAttribute\("hidden", "hidden"\)/);

  for (const statusId of [
    "paper-summary-status",
    "graph-seed-status",
    "workbench-export-status",
    "prompt-template-status",
    "webdav-status"
  ]) {
    assert.match(runtime, new RegExp(`showLayeredError\\("${statusId}"`));
  }

  for (const fallbackMessage of [
    "总结生成失败",
    "阅读上下文翻译失败",
    "写入 Zotero 笔记失败",
    "捕获图谱种子失败",
    "导出工作台状态失败",
    "导入工作台状态失败",
    "导出 ZIP 工作台状态失败",
    "导入 ZIP 工作台状态失败",
    "生成引用关系失败",
    "保存 WebDAV 设置失败",
    "WebDAV 连接失败",
    "WebDAV 上传失败"
  ]) {
    assert.match(runtime, new RegExp(`showLayeredError\\([^\\n]+${fallbackMessage}`));
  }
});

test("provider settings runtime routes failures through layered errors", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/providerSettings.js"), "utf8");

  assert.match(runtime, /function showStatus/);
  assert.match(runtime, /function showLayeredError/);
  assert.match(runtime, /function createLayeredErrorNotice/);
  assert.match(runtime, /removeAttribute\("hidden"\)/);
  assert.match(runtime, /setAttribute\("hidden", "hidden"\)/);
  assert.match(runtime, /provider-error-details/);
  assert.match(runtime, /provider-error-detail-text/);
  assert.match(runtime, /provider connection test failed/);
  assert.match(runtime, /showLayeredError\(\s*"设置保存失败，请重启 Zotero 后再试"/);
  assert.match(runtime, /showLayeredError\(result\?\.message \|\| "测试连接失败"/);
  assert.match(runtime, /createProviderStatusError\("测试连接失败", error, settings\)/);
});

test("WebDAV authentication failures keep technical details available", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");

  assert.doesNotMatch(runtime, /showStatus\("webdav-status", "WebDAV 认证失败"\)/);
  assert.match(runtime, /showLayeredError\("webdav-status", "WebDAV 认证失败"/);
});

test("research panel runtime wires read-only workbench record rendering", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
  const renderBody = getFunctionBody(runtime, "renderWorkbenchRecords");

  assert.match(runtime, /function renderWorkbenchRecords/);
  assert.match(renderBody, /ResearchPanelOrchestrator\.createPanelRecords/);
  assert.match(renderBody, /renderGraphSeedRecords\(records\.recentGraphSeeds\)/);
  assert.match(renderBody, /renderTaskLedgerRecords\(records\.recentTaskLedger\)/);
  assert.match(runtime, /refresh-workbench-records"\)\.addEventListener\("click", renderWorkbenchRecords\)/);
});

test("research panel runtime wires citation graph inspector", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
  const renderBody = getFunctionBody(runtime, "renderCitationGraphInspector");

  assert.match(runtime, /function renderCitationGraphInspector/);
  assert.match(renderBody, /createCurrentGraphReviewReadModel/);
  assert.match(renderBody, /\.citationRelations/);
  assert.match(runtime, /function formatCitationRelationQualityTags/);
  assert.match(runtime, /qualityTags/);
  assert.match(runtime, /证据：\$\{relation\.evidence\}｜来源种子：\$\{relation\.graphSeedId\}\$\{formatCitationRelationQualityTags\(relation\.qualityTags\)\}/);
  assert.match(runtime, /function readCitationGraphInspectorFilters/);
  assert.match(runtime, /qualityTag:\s*cleanText\(getField\("citation-graph-quality-filter"\)\?\.value\) \|\| "all"/);
  assert.match(runtime, /citation-graph-inspector-list/);
  assert.match(runtime, /refresh-citation-graph-inspector"\)\.addEventListener\("click", renderCitationGraphInspector\)/);
  assert.match(runtime, /renderCitationGraphInspector\(\)/);
});

test("research panel runtime wires work identity inspector", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
  const renderBody = getFunctionBody(runtime, "renderWorkIdentityInspector");

  assert.match(runtime, /function renderWorkIdentityInspector/);
  assert.match(renderBody, /createCurrentGraphReviewReadModel/);
  assert.match(renderBody, /\.workIdentities/);
  assert.match(runtime, /function formatWorkIdentityStatusTags/);
  assert.match(runtime, /statusTags/);
  assert.match(runtime, /function readWorkIdentityInspectorFilters/);
  assert.match(runtime, /statusTag:\s*cleanText\(getField\("work-identity-status-filter"\)\?\.value\) \|\| "all"/);
  assert.match(runtime, /work-identity-inspector-list/);
  assert.match(runtime, /refresh-work-identity-inspector"\)\.addEventListener\("click", renderWorkIdentityInspector\)/);
  assert.match(runtime, /renderWorkIdentityInspector\(\)/);
});

test("research panel runtime wires duplicate work candidates", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
  const renderBody = getFunctionBody(runtime, "renderDuplicateWorkCandidates");

  assert.match(runtime, /function renderDuplicateWorkCandidates/);
  assert.match(runtime, /function createDuplicateWorkCandidateEvidenceDetails/);
  assert.match(runtime, /function readDuplicateWorkCandidateFilters/);
  assert.match(runtime, /function synchronizeDuplicateWorkCandidateFilters/);
  assert.match(runtime, /function duplicateConfidenceForReason/);
  assert.match(renderBody, /createCurrentGraphReviewReadModel/);
  assert.match(runtime, /listGraphReviewDuplicateWorkCandidateEvidence/);
  assert.match(runtime, /duplicate-work-confidence-filter/);
  assert.match(runtime, /duplicate-work-reason-filter/);
  assert.match(runtime, /duplicate-work-candidates-list/);
  assert.match(runtime, /查看证据/);
  assert.match(runtime, /证据来源/);
  assert.match(runtime, /候选证据/);
  assert.match(runtime, /refresh-duplicate-work-candidates"\)\.addEventListener\("click", renderDuplicateWorkCandidates\)/);
  assert.match(runtime, /renderDuplicateWorkCandidates\(\)/);
});

test("research panel runtime wires graph seed review queue", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
  const renderBody = getFunctionBody(runtime, "renderGraphSeedReviewQueue");
  const reviewBody = getFunctionBody(runtime, "reviewGraphSeed");
  const promoteBody = getFunctionBody(runtime, "promoteGraphSeed");

  assert.match(runtime, /function renderGraphSeedReviewQueue/);
  assert.match(runtime, /function reviewGraphSeed/);
  assert.match(runtime, /function promoteGraphSeed/);
  assert.match(runtime, /const HTML_NS = "http:\/\/www\.w3\.org\/1999\/xhtml"/);
  assert.match(runtime, /function createHtmlElement/);
  assert.match(runtime, /document\.createElementNS\(HTML_NS, tagName\)/);
  assert.match(runtime, /createHtmlElement\("button"\)/);
  assert.doesNotMatch(runtime, /document\.createElement\("(?:button|div|span|textarea)"\)/);
  assert.match(renderBody, /createCurrentGraphReviewReadModel/);
  assert.match(reviewBody, /ResearchPanelOrchestrator\.reviewGraphSeedWorkflow/);
  assert.match(promoteBody, /ResearchPanelOrchestrator\.promoteGraphSeedWorkflow/);
  assert.doesNotMatch(reviewBody, /reviewGraphSeedTransaction/);
  assert.doesNotMatch(promoteBody, /promoteGraphSeedTransaction/);
  assert.match(runtime, /refresh-graph-seed-review"\)\.addEventListener\("click", renderGraphSeedReviewQueue\)/);
});

test("graph seed review filters avoid native select popups in Zotero XHTML", () => {
  const panel = fs.readFileSync(path.join(root, "chrome/content/researchPanel.xhtml"), "utf8");
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
  const reviewSection = panel.slice(
    panel.indexOf("<strong>图谱种子复核队列</strong>"),
    panel.indexOf('<div class="actions">\n          <button id="refresh-graph-seed-review"')
  );

  assert.match(panel, /class="segmented-filter"/);
  assert.match(panel, /data-filter-target="work-identity-status-filter"/);
  assert.match(panel, /id="work-identity-status-filter" type="hidden" value="all"/);
  assert.match(panel, /data-filter-value="all" aria-pressed="true">全部身份</);
  assert.match(panel, /data-filter-value="无 DOI" aria-pressed="false">无 DOI</);
  assert.match(panel, /data-filter-value="多来源" aria-pressed="false">多来源</);
  assert.match(panel, /data-filter-value="有引用关系" aria-pressed="false">有引用关系</);
  assert.match(panel, /data-filter-value="孤立线索" aria-pressed="false">孤立线索</);
  assert.match(panel, /data-filter-target="citation-graph-quality-filter"/);
  assert.match(panel, /id="citation-graph-quality-filter" type="hidden" value="all"/);
  assert.match(panel, /data-filter-value="all" aria-pressed="true">全部质量</);
  assert.match(panel, /data-filter-value="缺少目标" aria-pressed="false">缺少目标</);
  assert.match(panel, /data-filter-value="缺少证据" aria-pressed="false">缺少证据</);
  assert.match(panel, /data-filter-value="低置信度" aria-pressed="false">低置信度</);
  assert.match(panel, /data-filter-value="缺少来源种子" aria-pressed="false">缺少来源种子</);
  assert.match(panel, /data-filter-target="graph-seed-review-state-filter"/);
  assert.match(panel, /data-filter-target="graph-seed-confidence-filter"/);
  assert.match(panel, /data-filter-target="graph-seed-relation-filter"/);
  assert.match(panel, /data-filter-target="graph-seed-kind-filter"/);
  assert.match(panel, /id="graph-seed-review-state-filter" type="hidden" value="pending"/);
  assert.match(panel, /id="graph-seed-confidence-filter" type="hidden" value="all"/);
  assert.match(panel, /id="graph-seed-relation-filter" type="hidden" value="all"/);
  assert.match(panel, /id="graph-seed-kind-filter" type="hidden" value="all"/);
  assert.doesNotMatch(reviewSection, /<select id="graph-seed-(?:review-state|confidence|relation|kind)-filter"/);
  assert.match(runtime, /function initializeSegmentedFilters/);
  assert.match(runtime, /function selectSegmentedFilterOption/);
  assert.match(runtime, /renderGraphSeedReviewQueue\(\)/);
});

test("segmented filters refresh their owning read-only views", () => {
  const runtime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");

  assert.match(runtime, /function renderSegmentedFilterTarget/);
  assert.match(runtime, /renderSegmentedFilterTarget\(group\.dataset\.filterTarget\)/);
  assert.match(
    runtime,
    /case "work-identity-scope-filter":[\s\S]*case "work-identity-status-filter":[\s\S]*renderWorkIdentityInspector\(\)/
  );
  assert.match(runtime, /case "duplicate-work-scope-filter":\s*renderDuplicateWorkCandidates\(\)/);
  assert.match(
    runtime,
    /case "duplicate-work-confidence-filter":[\s\S]*synchronizeDuplicateWorkCandidateFilters\(targetId\);[\s\S]*renderDuplicateWorkCandidates\(\)/
  );
  assert.match(
    runtime,
    /case "duplicate-work-reason-filter":[\s\S]*synchronizeDuplicateWorkCandidateFilters\(targetId\);[\s\S]*renderDuplicateWorkCandidates\(\)/
  );
  assert.match(runtime, /case "citation-graph-scope-filter":\s*renderCitationGraphInspector\(\)/);
  assert.match(runtime, /case "citation-graph-quality-filter":\s*renderCitationGraphInspector\(\)/);
});

test("ai task workspace runtime wires plan confirmation queue controls and persistence", () => {
  const panel = fs.readFileSync(path.join(root, "chrome/content/researchPanel.xhtml"), "utf8");
  const runtime = fs.readFileSync(path.join(root, "chrome/content/aiTaskWorkspace.js"), "utf8");
  const paperSummaryRuntime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");

  assert.match(panel, /aiTaskWorkspaceCore\.js/);
  assert.match(panel, /providerRequestPolicy\.js/);
  assert.match(panel, /aiTaskWorkspace\.js/);
  assert.ok(panel.indexOf("providerRequestPolicy.js") < panel.indexOf("aiTaskWorkspaceCore.js"));
  assert.ok(panel.indexOf("aiTaskWorkspaceCore.js") < panel.indexOf("aiTaskWorkspace.js"));
  assert.ok(panel.indexOf("aiTaskWorkspace.js") < panel.indexOf("paperSummary.js"));
  assert.match(runtime, /WorkbenchAiTaskWorkspace/);
  assert.match(runtime, /createDraftAiJobPlan/);
  assert.match(runtime, /classifyAiTaskRequest/);
  assert.match(runtime, /requestAiTaskClassification/);
  assert.match(runtime, /classifyCurrentSelectionTaskRequest/);
  assert.match(runtime, /needs-ai-classification/);
  assert.match(runtime, /只输出 JSON/);
  assert.match(runtime, /taskClassification/);
  assert.match(runtime, /confirmAndRunAiJob/);
  assert.match(runtime, /createQueueProgressReadModel/);
  assert.match(runtime, /renderAiTaskResults/);
  assert.match(runtime, /formatAiJobStateLabel/);
  assert.match(runtime, /formatAiTaskStateLabel/);
  assert.match(runtime, /待确认/);
  assert.match(runtime, /待执行/);
  assert.match(runtime, /buildMultiPaperCommonalityPrompt/);
  assert.match(runtime, /不要逐篇翻译或逐篇摘要/);
  assert.match(runtime, /共同研究主题/);
  assert.match(runtime, /共同点笔记/);
  assert.match(runtime, /shouldPause:/);
  assert.match(runtime, /currentAbortController\.abort\(\)/);
  assert.match(runtime, /onProgress:/);
  assert.match(runtime, /pauseCurrentAiJob/);
  assert.match(runtime, /resumeCurrentAiJob/);
  assert.match(runtime, /cancelCurrentAiJob/);
  assert.match(runtime, /runOpenAICompatibleSummaryTask/);
  assert.match(runtime, /readSelectedPaperContexts/);
  assert.doesNotMatch(runtime, /selectedPapers:\s*\[paper\]/);
  assert.match(runtime, /ResearchPanelOrchestrator\.createAiTaskWorkspacePlanWorkflow/);
  assert.match(runtime, /ResearchPanelOrchestrator\.confirmAiTaskWorkspacePlanWorkflow/);
  assert.match(runtime, /ResearchPanelOrchestrator\.recordAiTaskWorkspaceQueueResultWorkflow/);
  assert.match(runtime, /loadCreatedAiTaskDraft/);
  assert.match(runtime, /createdDraftIds/);
  assert.match(runtime, /WorkbenchPaperSummary\.loadDraftIntoSummaryReader/);
  assert.match(paperSummaryRuntime, /function loadDraftIntoSummaryReader/);
  assert.match(paperSummaryRuntime, /loadDraftIntoSummaryReader/);
  assert.match(runtime, /AI 任务执行失败/);
  assert.doesNotMatch(runtime, /confirmAndRunAiJob\(\);/);
});
