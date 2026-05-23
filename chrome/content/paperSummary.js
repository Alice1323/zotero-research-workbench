(function () {
  const PREFS = {
    baseUrl: "extensions.zotero-research-workbench.provider.baseUrl",
    apiKey: "extensions.zotero-research-workbench.provider.apiKey",
    model: "extensions.zotero-research-workbench.provider.model",
    requestsPerMinute: "extensions.zotero-research-workbench.provider.requestsPerMinute",
    maxInputTokensPerTask: "extensions.zotero-research-workbench.provider.maxInputTokensPerTask",
    snapshot: "extensions.zotero-research-workbench.store.snapshot",
    webdavServerUrl: "extensions.zotero-research-workbench.webdav.serverUrl",
    webdavUsername: "extensions.zotero-research-workbench.webdav.username",
    webdavPassword: "extensions.zotero-research-workbench.webdav.password",
    webdavRemoteDirectory: "extensions.zotero-research-workbench.webdav.remoteDirectory"
  };
  const WorkbenchSnapshot = window.WorkbenchSnapshot;
  if (!WorkbenchSnapshot) {
    throw new Error("WorkbenchSnapshot runtime Module is unavailable");
  }
  const {
    SECRET_PLACEHOLDER,
    createWorkbenchExportPackage,
    createWorkbenchZipExportPayload,
    importWorkbenchExportPackage,
    importWorkbenchZipExportPayload,
    redactSecretMaterial
  } = WorkbenchSnapshot;
  const WorkbenchProviderChatCompletion = window.WorkbenchProviderChatCompletion;
  if (!WorkbenchProviderChatCompletion) {
    throw new Error("WorkbenchProviderChatCompletion runtime Module is unavailable");
  }
  const { parseChatCompletionText, requestOpenAICompatibleChatCompletion } = WorkbenchProviderChatCompletion;
  const WorkbenchRuntimeStore = window.WorkbenchRuntimeStore;
  if (!WorkbenchRuntimeStore) {
    throw new Error("WorkbenchRuntimeStore runtime Module is unavailable");
  }
  const { createWorkbenchRuntimeStore } = WorkbenchRuntimeStore;
  const WorkbenchLocalStoreTransaction = window.WorkbenchLocalStoreTransaction;
  if (!WorkbenchLocalStoreTransaction) {
    throw new Error("WorkbenchLocalStoreTransaction runtime Module is unavailable");
  }
  const {
    removePromptOverrideTransaction,
    replaceWorkbenchSnapshotFromImportTransaction,
    upsertPromptOverrideTransaction
  } = WorkbenchLocalStoreTransaction;
  const WorkbenchGraphReviewWorkflow = window.WorkbenchGraphReviewWorkflow;
  if (!WorkbenchGraphReviewWorkflow) {
    throw new Error("WorkbenchGraphReviewWorkflow runtime Module is unavailable");
  }
  const {
    createGraphReviewReadModel,
    listGraphReviewDuplicateWorkCandidateEvidence
  } = WorkbenchGraphReviewWorkflow;
  const WorkbenchResearchPanelOrchestrator = window.WorkbenchResearchPanelOrchestrator;
  if (!WorkbenchResearchPanelOrchestrator) {
    throw new Error("WorkbenchResearchPanelOrchestrator runtime Module is unavailable");
  }
  const { createResearchPanelOrchestrator } = WorkbenchResearchPanelOrchestrator;
  const ResearchPanelOrchestrator = createResearchPanelOrchestrator({
    paperSummaryModule: {
      buildZoteroNoteHtml,
      createReadingTranslationDraftInput,
      createSummaryDraftInput,
      listRecentGraphSeeds,
      listRecentSummaryDrafts,
      listRecentTaskLedger
    },
    graphReviewWorkflowModule: WorkbenchGraphReviewWorkflow,
    transactionModule: WorkbenchLocalStoreTransaction
  });
  const WorkbenchLlmRuntimeGuardModule = window.WorkbenchLlmRuntimeGuard;
  if (!WorkbenchLlmRuntimeGuardModule) {
    throw new Error("WorkbenchLlmRuntimeGuard runtime Module is unavailable");
  }
  const {
    assertLlmRuntimeRequestAllowed,
    createLlmRuntimeGuard,
    estimatePromptTokens
  } = WorkbenchLlmRuntimeGuardModule;
  const WorkbenchZoteroNoteWriter = window.WorkbenchZoteroNoteWriter;
  if (!WorkbenchZoteroNoteWriter) {
    throw new Error("WorkbenchZoteroNoteWriter runtime Module is unavailable");
  }
  const { writeZoteroChildNote, writeZoteroStandaloneNote } = WorkbenchZoteroNoteWriter;
  const WorkbenchWebDavClient = window.WorkbenchWebDavClient;
  if (!WorkbenchWebDavClient) {
    throw new Error("WorkbenchWebDavClient runtime Module is unavailable");
  }
  const { createWebDavClient } = WorkbenchWebDavClient;
  const WorkbenchFetchRuntime = window.WorkbenchFetchRuntime;
  if (!WorkbenchFetchRuntime) {
    throw new Error("WorkbenchFetchRuntime runtime Module is unavailable");
  }
  const { createBrowserFetchRuntime } = WorkbenchFetchRuntime;
  const { fetch: workbenchFetch } = createBrowserFetchRuntime({ window });
  const { requestWebDav } = createWebDavClient({ fetchImpl: workbenchFetch });
  const WorkbenchClipboardWriter = window.WorkbenchClipboardWriter;
  if (!WorkbenchClipboardWriter) {
    throw new Error("WorkbenchClipboardWriter runtime Module is unavailable");
  }
  const { createBrowserClipboardWriter } = WorkbenchClipboardWriter;
  const { writeClipboardText } = createBrowserClipboardWriter({
    navigator,
    document,
    createElement: createHtmlElement
  });
  const WorkbenchFileRuntime = window.WorkbenchFileRuntime;
  if (!WorkbenchFileRuntime) {
    throw new Error("WorkbenchFileRuntime runtime Module is unavailable");
  }
  const { createWorkbenchFileRuntime } = WorkbenchFileRuntime;
  const WorkbenchFileIo = window.WorkbenchFileIo;
  if (!WorkbenchFileIo) {
    throw new Error("WorkbenchFileIo runtime Module is unavailable");
  }
  const { createBrowserWorkbenchFileIo } = WorkbenchFileIo;
  const WorkbenchSelectedPaperRuntime = window.WorkbenchSelectedPaperRuntime;
  if (!WorkbenchSelectedPaperRuntime) {
    throw new Error("WorkbenchSelectedPaperRuntime runtime Module is unavailable");
  }
  const {
    createBrowserSelectedPaperRuntime,
    normalizePaperContext,
    selectBestPdfAttachment
  } = WorkbenchSelectedPaperRuntime;
  const SAFE_TEMPLATE_VARIABLES = new Set([
    "selectedText",
    "itemTitle",
    "itemAuthors",
    "abstract",
    "year",
    "publicationTitle",
    "doi",
    "source",
    "pageLabel",
    "noteContent",
    "pdfPageText",
    "graphSeedsSummary",
    "paperCandidatesSummary",
    "userQuery"
  ]);
  const BUILT_IN_PROMPT_TEMPLATES = {
    "single-paper-chinese-summary": {
      id: "single-paper-chinese-summary",
      title: "单篇文献中文总结",
      purpose: "Create a structured Chinese research note draft for one Zotero item",
      requiredContext: ["itemTitle", "abstract"],
      template: [
        "请用中文为下面这篇 Zotero 文献生成研究阅读摘要。",
        "",
        "输出格式必须包含以下小标题：",
        "1. 研究问题",
        "2. 研究方法",
        "3. 主要发现",
        "4. 局限性",
        "5. 对后续阅读的建议",
        "",
        "文献信息：",
        "标题：{{itemTitle}}",
        "作者：{{itemAuthors}}",
        "年份：{{year}}",
        "期刊/来源：{{publicationTitle}}",
        "DOI：{{doi}}",
        "摘要：{{abstract}}",
        "",
        "要求：不要编造摘要中没有的信息；如果信息不足，请明确写出“原始记录未提供”。"
      ].join("\n"),
      outputExpectation: "structured Chinese research reading summary",
      defaultProviderCapability: "llm",
      version: "1.0.0",
      outputLanguageStrategy: "zh-CN"
    },
    "reading-context-chinese-translation": {
      id: "reading-context-chinese-translation",
      title: "阅读上下文中文翻译",
      purpose: "Translate selected Zotero Reader text into Chinese",
      requiredContext: ["selectedText"],
      template: [
        "请将下面的 Zotero 阅读器选中文本翻译成中文。",
        "",
        "要求：",
        "1. 忠实保留原意，不扩写、不总结。",
        "2. 专业术语使用中文学术表达；没有通用中文译法的术语保留英文。",
        "3. 保留段落结构。",
        "4. 只输出译文，不要添加解释。",
        "",
        "上下文信息：",
        "来源：{{source}}",
        "页码：{{pageLabel}}",
        "",
        "选中文本：",
        "{{selectedText}}"
      ].join("\n"),
      outputExpectation: "faithful Chinese translation",
      defaultProviderCapability: "llm",
      version: "1.0.0",
      outputLanguageStrategy: "zh-CN"
    }
  };
  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const WorkbenchLlmRuntimeGuard = createLlmRuntimeGuard();

  function getField(id) {
    return document.getElementById(id);
  }

  function createHtmlElement(tagName) {
    return document.createElementNS(HTML_NS, tagName);
  }

  function getZotero() {
    return window.arguments?.[0]?.Zotero || window.opener?.Zotero || window.Zotero;
  }

  function getComponents() {
    if (typeof Components === "undefined") {
      return null;
    }
    return Components;
  }

  function getPref(key) {
    return getZotero()?.Prefs?.get(key) || "";
  }

  function setPref(key, value) {
    const zotero = getZotero();
    if (!zotero?.Prefs?.set) {
      throw new Error("Zotero preferences are unavailable");
    }
    zotero.Prefs.set(key, value);
  }

  const WorkbenchLocalStore = createWorkbenchRuntimeStore({
    getPref,
    setPref,
    snapshotPrefKey: PREFS.snapshot
  });
  const {
    pickWorkbenchExportFile,
    pickDefaultWorkbenchExportFile
  } = createWorkbenchFileRuntime({
    getZotero,
    getComponents,
    window,
    console: window.console
  });
  const {
    readTextFile,
    readZipExportFile,
    writeTextFile,
    writeZipExportFile
  } = createBrowserWorkbenchFileIo({
    window,
    getComponents
  });
  const {
    getSelectedRegularItem,
    readSelectedPaperContext,
    readSelectedPaperContexts,
    readSelectedPaperPdfAttachment
  } = createBrowserSelectedPaperRuntime({
    window,
    getZotero,
    console: window.console
  });

  function showStatus(statusId, message) {
    const status = getField(statusId);
    if (status) {
      status.textContent = message;
    }
    clearErrorDetails(statusId);
  }

  function showLayeredError(statusId, fallbackMessage, error) {
    const notice = createLayeredErrorNotice(error, fallbackMessage);
    const status = getField(statusId);
    if (status) {
      status.textContent = notice.userMessage;
    }

    const details = getErrorDetailsElements(statusId);
    if (!details?.container || !details?.body) {
      return;
    }
    details.body.textContent = notice.technicalDetail;
    details.container.removeAttribute("hidden");
    details.container.hidden = false;
  }

  function clearErrorDetails(statusId) {
    const details = getErrorDetailsElements(statusId);
    if (!details?.container || !details?.body) {
      return;
    }
    details.body.textContent = "";
    details.container.open = false;
    details.container.setAttribute("hidden", "hidden");
    details.container.hidden = true;
  }

  function getErrorDetailsElements(statusId) {
    const ids = {
      "paper-summary-status": ["paper-error-details", "paper-error-detail-text"],
      "graph-seed-status": ["graph-seed-error-details", "graph-seed-error-detail-text"],
      "workbench-export-status": ["workbench-error-details", "workbench-error-detail-text"],
      "prompt-template-status": ["prompt-template-error-details", "prompt-template-error-detail-text"],
      "webdav-status": ["webdav-error-details", "webdav-error-detail-text"]
    }[statusId];
    if (!ids) {
      return null;
    }
    return {
      container: getField(ids[0]),
      body: getField(ids[1])
    };
  }

  function readProviderSettings() {
    return {
      baseUrl: getPref(PREFS.baseUrl),
      apiKey: getPref(PREFS.apiKey),
      model: getPref(PREFS.model),
      requestsPerMinute: getPref(PREFS.requestsPerMinute),
      maxInputTokensPerTask: getPref(PREFS.maxInputTokensPerTask)
    };
  }

  function validateProviderSettings(settings, statusId) {
    if (!settings.baseUrl || !settings.model) {
      showStatus(statusId, "请先保存接口地址和模型名称");
      return false;
    }
    if (!settings.apiKey) {
      showStatus(statusId, "请先填写并保存 API 密钥");
      return false;
    }
    return true;
  }

  async function refreshSelectedPaper() {
    const papers = readSelectedPaperContexts();
    const paper = papers[0] || null;
    window.WorkbenchSelectedPapers = papers;
    window.WorkbenchSelectedPaper = paper;

    if (!paper) {
      showStatus("paper-summary-status", "请先在 Zotero 中选中一篇文献");
      renderSelectedPaperContexts([]);
      return null;
    }

    renderSelectedPaperContexts(papers);
    showStatus("paper-summary-status", papers.length > 1 ? `已读取 ${papers.length} 篇选中文献` : "已读取选中文献");
    return paper;
  }

  async function summarizeSelectedPaper() {
    const output = getField("paper-summary-output");
    const paper = window.WorkbenchSelectedPaper || (await refreshSelectedPaper());
    if (!paper) {
      return;
    }

    const settings = readProviderSettings();
    if (!validateProviderSettings(settings, "paper-summary-status")) {
      return;
    }

    showStatus("paper-summary-status", "正在生成中文总结...");
    output.textContent = "";

    try {
      const summary = await requestPaperSummary({
        paper,
        settings,
        promptOverrides: loadWorkbenchSnapshot().promptOverrides,
        runtimeGuard: WorkbenchLlmRuntimeGuard,
        fetchImpl: workbenchFetch
      });
      output.textContent = summary;
      window.WorkbenchLastSummary = summary;
      const draft = saveSummaryDraft({ paper, summary, model: settings.model });
      showStatus("paper-summary-status", "总结已生成");
      renderDraftStatus(draft);
      renderRecentDrafts();
    } catch (error) {
      showLayeredError("paper-summary-status", "总结生成失败", error);
    }
  }

  async function translateReadingContext() {
    const output = getField("paper-summary-output");
    const context =
      window.WorkbenchReadingContext ||
      window.WorkbenchReadingContextApi?.refreshReadingContext?.() ||
      null;
    if (!context?.text) {
      showStatus("paper-summary-status", "请先在 Zotero 阅读器中选中文本，并刷新阅读上下文");
      return;
    }

    const settings = readProviderSettings();
    if (!validateProviderSettings(settings, "paper-summary-status")) {
      return;
    }

    const paper = window.WorkbenchSelectedPaper || readSelectedPaperContext() || {};
    showStatus("paper-summary-status", "正在翻译阅读上下文...");
    output.textContent = "";

    try {
      const translation = await requestReadingContextTranslation({
        context,
        settings,
        promptOverrides: loadWorkbenchSnapshot().promptOverrides,
        runtimeGuard: WorkbenchLlmRuntimeGuard,
        fetchImpl: workbenchFetch
      });
      output.textContent = translation;
      window.WorkbenchLastSummary = translation;
      const draft = saveReadingTranslationDraft({ context, paper, translation, model: settings.model });
      showStatus("paper-summary-status", "阅读上下文翻译已生成");
      renderDraftStatus(draft);
      renderRecentDrafts();
    } catch (error) {
      showLayeredError("paper-summary-status", "阅读上下文翻译失败", error);
    }
  }

  async function copyGeneratedResult() {
    const summary = cleanText(getField("paper-summary-output").textContent);
    if (!summary) {
      showStatus("paper-summary-status", "暂无可复制的生成结果");
      return;
    }

    const text = buildSummaryCopyText({
      paper: window.WorkbenchSelectedPaper || {},
      summary,
      draft: window.WorkbenchLastDraft || null
    });

    try {
      await writeClipboardText(text);
      showStatus("paper-summary-status", "生成结果已复制");
    } catch (_error) {
      showStatus("paper-summary-status", "复制失败，请手动选择生成结果");
    }
  }

  async function saveGeneratedResultToZoteroNote() {
    const summary = cleanText(getField("paper-summary-output").textContent);
    const existingDraft = window.WorkbenchLastDraft || null;
    const isStandaloneNote = existingDraft?.promptTaskTemplateId === "multi-paper-commonality-note";
    const paper = isStandaloneNote ? window.WorkbenchSelectedPaper : window.WorkbenchSelectedPaper || (await refreshSelectedPaper());
    if (!isStandaloneNote && !paper) {
      showStatus("paper-summary-status", "请先在 Zotero 中选中一篇文献");
      return;
    }
    if (!summary) {
      showStatus("paper-summary-status", "暂无可写入的生成结果");
      return;
    }

    const Zotero = getZotero();
    const parentItem = isStandaloneNote ? null : getSelectedRegularItem();
    if (!Zotero?.Item || (!isStandaloneNote && !parentItem?.id)) {
      showStatus("paper-summary-status", "无法读取 Zotero 选中文献");
      return;
    }

    const draft = isStandaloneNote ? existingDraft : ensureCurrentDraft({ paper, summary });
    const savedAt = new Date().toISOString();
    showStatus("paper-summary-status", "正在写入 Zotero 笔记...");

    try {
      const noteWrite = ResearchPanelOrchestrator.prepareZoteroNoteWrite({ draft, savedAt });
      const { noteKey } = isStandaloneNote
        ? await writeZoteroStandaloneNote({
            Zotero,
            html: noteWrite.html
          })
        : await writeZoteroChildNote({
            Zotero,
            parentItem,
            html: noteWrite.html
          });

      const result = ResearchPanelOrchestrator.confirmDraftSavedToZoteroWorkflow({
        snapshot: loadWorkbenchSnapshot(),
        draftId: draft.id,
        zoteroNoteKey: noteKey,
        savedAt: noteWrite.savedAt,
        selectedWorkId: currentSelectedWorkId(),
        filters: readGraphReviewFilters()
      });
      const snapshot = result.snapshot;
      saveWorkbenchSnapshot(snapshot);
      window.WorkbenchLastDraft = result.draft || snapshot.researchNoteDrafts.find((entry) => entry.id === draft.id) || draft;
      showStatus("paper-summary-status", "已写入 Zotero 笔记");
      getField("paper-draft-status").textContent = `已确认并写入 Zotero 笔记（${formatLocalTime(savedAt)}）`;
      renderRecentDrafts();
    } catch (error) {
      showLayeredError("paper-summary-status", "写入 Zotero 笔记失败", error);
    }
  }

  async function captureGraphSeed() {
    const paper = window.WorkbenchSelectedPaper || (await refreshSelectedPaper());
    if (!paper) {
      showStatus("graph-seed-status", "请先在 Zotero 中选中一篇文献");
      return;
    }

    try {
      const createdAt = new Date().toISOString();
      const seedInput = createGraphSeedInput({
        paper,
        target: getField("graph-seed-target").value,
        relationType: getField("graph-seed-relation").value,
        confidence: getField("graph-seed-confidence").value,
        evidenceText: getGraphSeedEvidenceText(),
        providerId: getPref(PREFS.model),
        seedKind: "user-confirmed",
        createdAt
      });
      const result = ResearchPanelOrchestrator.captureGraphSeedWorkflow({
        snapshot: loadWorkbenchSnapshot(),
        seedInput,
        createdAt,
        selectedWorkId: currentSelectedWorkId(),
        filters: readGraphReviewFilters()
      });
      const snapshot = result.snapshot;
      saveWorkbenchSnapshot(snapshot);
      showStatus("graph-seed-status", `已捕获图谱种子（${formatLocalTime(createdAt)}）`);
      getField("graph-seed-target").value = "";
      renderWorkbenchRecords();
      renderGraphSeedReviewQueue();
    } catch (error) {
      showLayeredError("graph-seed-status", "捕获图谱种子失败", error);
    }
  }

  async function exportWorkbenchState() {
    const exportedAt = new Date().toISOString();
    const defaultString = `zotero-research-workbench-${createStableTimestamp(exportedAt)}.json`;
    const exportPackage = createWorkbenchExportPackage({
      snapshot: loadWorkbenchSnapshot(),
      exportedAt
    });

    try {
      showStatus("workbench-export-status", "正在打开导出保存对话框...");
      const targetFile = await pickWorkbenchExportFile({
        mode: "save",
        defaultString
      });
      if (!targetFile) {
        showStatus("workbench-export-status", "已取消导出");
        return;
      }

      await writeTextFile(targetFile, JSON.stringify(exportPackage, null, 2));
      showStatus("workbench-export-status", `已导出工作台状态（${formatLocalTime(exportedAt)}）`);
    } catch (error) {
      try {
        const fallbackFile = await exportWorkbenchStateToDefaultFile({ defaultString, exportPackage });
        showStatus("workbench-export-status", `保存对话框不可用，已导出到：${describeFilePath(fallbackFile)}`);
      } catch (fallbackError) {
        showLayeredError("workbench-export-status", "导出工作台状态失败", fallbackError || error);
      }
    }
  }

  async function exportWorkbenchStateToDefaultFile({ defaultString, exportPackage }) {
    const fallbackFile = pickDefaultWorkbenchExportFile(defaultString);
    await writeTextFile(fallbackFile, JSON.stringify(exportPackage, null, 2));
    return fallbackFile;
  }

  async function importWorkbenchState() {
    try {
      showStatus("workbench-export-status", "正在打开导入文件选择框...");
      const sourceFile = await pickWorkbenchExportFile({ mode: "open" });
      if (!sourceFile) {
        showStatus("workbench-export-status", "已取消导入");
        return;
      }

      const raw = await readTextFile(sourceFile);
      const importedSnapshot = importWorkbenchExportPackage(raw);
      const result = replaceWorkbenchSnapshotFromImportTransaction({
        snapshot: importedSnapshot,
        importedAt: new Date().toISOString(),
        sourceKind: "json"
      });
      const snapshot = result.snapshot;
      saveWorkbenchSnapshot(snapshot);
      window.WorkbenchLastDraft = null;
      renderRecentDrafts();
      renderWorkbenchRecords();
      renderGraphSeedReviewQueue();
      showStatus("workbench-export-status", buildImportStatus(snapshot));
    } catch (error) {
      showLayeredError("workbench-export-status", "导入工作台状态失败", error);
    }
  }

  async function exportWorkbenchZip() {
    const exportedAt = new Date().toISOString();
    const defaultString = `zotero-research-workbench-${createStableTimestamp(exportedAt)}.zip`;
    const payload = createWorkbenchZipExportPayload({
      snapshot: loadWorkbenchSnapshot(),
      exportedAt
    });

    try {
      showStatus("workbench-export-status", "正在打开 ZIP 导出保存对话框...");
      const targetFile = await pickWorkbenchExportFile({
        mode: "save",
        defaultString,
        filterName: "ZIP",
        filterPattern: "*.zip"
      });
      if (!targetFile) {
        showStatus("workbench-export-status", "已取消 ZIP 导出");
        return;
      }

      await writeZipExportFile(targetFile, payload);
      showStatus("workbench-export-status", `已导出 ZIP 工作台状态（${formatLocalTime(exportedAt)}）`);
    } catch (error) {
      showLayeredError("workbench-export-status", "导出 ZIP 工作台状态失败", error);
    }
  }

  async function importWorkbenchZip() {
    try {
      showStatus("workbench-export-status", "正在打开 ZIP 导入文件选择框...");
      const sourceFile = await pickWorkbenchExportFile({
        mode: "open",
        filterName: "ZIP",
        filterPattern: "*.zip"
      });
      if (!sourceFile) {
        showStatus("workbench-export-status", "已取消 ZIP 导入");
        return;
      }

      const payload = await readZipExportFile(sourceFile);
      const importedSnapshot = importWorkbenchZipExportPayload(payload);
      const result = replaceWorkbenchSnapshotFromImportTransaction({
        snapshot: importedSnapshot,
        importedAt: new Date().toISOString(),
        sourceKind: "zip"
      });
      const snapshot = result.snapshot;
      saveWorkbenchSnapshot(snapshot);
      window.WorkbenchLastDraft = null;
      renderRecentDrafts();
      renderWorkbenchRecords();
      renderGraphSeedReviewQueue();
      showStatus("workbench-export-status", buildImportStatus(snapshot));
    } catch (error) {
      showLayeredError("workbench-export-status", "导入 ZIP 工作台状态失败", error);
    }
  }

  function loadPromptTemplateEditor() {
    try {
      const selector = getField("prompt-template-selector");
      const body = getField("prompt-template-body");
      const variables = getField("prompt-template-variables");
      if (!selector || !body || !variables) {
        return;
      }
      const templateId = selector.value;
      const snapshot = loadWorkbenchSnapshot();
      const template = resolvePromptTemplate(templateId, snapshot.promptOverrides);
      const builtIn = resolvePromptTemplate(templateId);
      body.value = template.template;
      variables.value = builtIn.variables.map((name) => `{{${name}}}`).join(" ");
      const hasOverride = Array.isArray(snapshot.promptOverrides)
        ? snapshot.promptOverrides.some((entry) => entry?.templateId === templateId)
        : false;
      showStatus("prompt-template-status", hasOverride ? "正在使用自定义提示词模板" : "正在使用默认提示词模板");
    } catch (error) {
      showLayeredError("prompt-template-status", "加载提示词模板失败", error);
    }
  }

  function savePromptTemplateOverride() {
    try {
      const selector = getField("prompt-template-selector");
      const body = getField("prompt-template-body");
      const resolved = resolvePromptTemplate(selector.value, [{
        templateId: selector.value,
        template: body.value
      }]);
      const result = upsertPromptOverrideTransaction({
        snapshot: loadWorkbenchSnapshot(),
        overrideInput: {
          templateId: resolved.id,
          template: resolved.template
        },
        updatedAt: new Date().toISOString()
      });
      const snapshot = result.snapshot;
      saveWorkbenchSnapshot(snapshot);
      loadPromptTemplateEditor();
      showStatus("prompt-template-status", "提示词模板已保存");
    } catch (error) {
      showLayeredError("prompt-template-status", "保存提示词模板失败", error);
    }
  }

  function resetPromptTemplateOverride() {
    try {
      const selector = getField("prompt-template-selector");
      const result = removePromptOverrideTransaction({
        snapshot: loadWorkbenchSnapshot(),
        templateId: selector.value,
        updatedAt: new Date().toISOString()
      });
      const snapshot = result.snapshot;
      saveWorkbenchSnapshot(snapshot);
      loadPromptTemplateEditor();
      showStatus("prompt-template-status", "已重置为默认提示词模板");
    } catch (error) {
      showLayeredError("prompt-template-status", "重置提示词模板失败", error);
    }
  }

  function loadWebDavSettings() {
    const settings = {
      serverUrl: getPref(PREFS.webdavServerUrl),
      username: getPref(PREFS.webdavUsername),
      password: getPref(PREFS.webdavPassword),
      remoteDirectory: getPref(PREFS.webdavRemoteDirectory)
    };
    getField("webdav-server-url").value = settings.serverUrl;
    getField("webdav-username").value = settings.username;
    getField("webdav-password").value = "";
    getField("webdav-password").placeholder = settings.password ? "已保存，留空则保持不变" : "";
    getField("webdav-remote-directory").value = settings.remoteDirectory;
    return settings;
  }

  function readWebDavFormSettings({ requireStoredPassword = false } = {}) {
    const passwordInput = getField("webdav-password").value.trim();
    const storedPassword = getPref(PREFS.webdavPassword);
    return {
      serverUrl: getField("webdav-server-url").value.trim(),
      username: getField("webdav-username").value.trim(),
      password: passwordInput || (requireStoredPassword ? storedPassword : passwordInput),
      remoteDirectory: getField("webdav-remote-directory").value.trim()
    };
  }

  function saveWebDavSettings() {
    try {
      const settings = readWebDavFormSettings({ requireStoredPassword: true });
      normalizeWebDavExportTarget(settings);
      setPref(PREFS.webdavServerUrl, settings.serverUrl);
      setPref(PREFS.webdavUsername, settings.username);
      setPref(PREFS.webdavRemoteDirectory, settings.remoteDirectory);
      if (getField("webdav-password").value.trim()) {
        setPref(PREFS.webdavPassword, getField("webdav-password").value.trim());
      }
      getField("webdav-password").value = "";
      getField("webdav-password").placeholder = "已保存，留空则保持不变";
      showStatus("webdav-status", "WebDAV 设置已保存");
    } catch (error) {
      showLayeredError("webdav-status", "保存 WebDAV 设置失败", error);
    }
  }

  async function testWebDavConnection() {
    try {
      const target = normalizeWebDavExportTarget(readWebDavFormSettings({ requireStoredPassword: true }));
      showStatus("webdav-status", "正在测试 WebDAV...");
      const response = await requestWebDav(target.uploadBaseUrl, {
        method: "PROPFIND",
        headers: {
          Authorization: `Basic ${encodeBasicAuth(target.username, target.password)}`,
          Depth: "0"
        }
      });
      if ([200, 204, 207].includes(response.status)) {
        showStatus("webdav-status", "WebDAV 连接成功");
        return;
      }
      if ([401, 403].includes(response.status)) {
        showLayeredError("webdav-status", "WebDAV 认证失败", new Error(`WebDAV 认证失败：HTTP ${response.status}`));
        return;
      }
      showLayeredError("webdav-status", "WebDAV 连接失败", new Error(`WebDAV 连接失败：HTTP ${response.status}`));
    } catch (error) {
      showLayeredError("webdav-status", "WebDAV 连接失败", error);
    }
  }

  async function uploadWorkbenchJsonToWebDav() {
    try {
      const exportedAt = new Date().toISOString();
      const target = normalizeWebDavExportTarget(readWebDavFormSettings({ requireStoredPassword: true }));
      const request = buildWebDavExportRequest({
        target,
        snapshot: loadWorkbenchSnapshot(),
        exportedAt
      });
      showStatus("webdav-status", "正在上传 WebDAV JSON...");
      const response = await retryWebDavUpload(request, target);
      if (!response.ok) {
        throw new Error(`WebDAV 上传失败：HTTP ${response.status}`);
      }
      showStatus("webdav-status", `已上传 WebDAV JSON：${request.filename}`);
    } catch (error) {
      showLayeredError("webdav-status", "WebDAV 上传失败", error);
    }
  }

  async function ensureWebDavRemoteDirectory(target) {
    const requests = buildWebDavDirectoryRequests(target);
    for (const request of requests) {
      const exists = await probeWebDavCollection(request.url, request.headers.Authorization);
      if (exists) {
        continue;
      }
      const response = await requestWebDav(request.url, {
        method: "MKCOL",
        headers: request.headers
      });
      if ([201, 405].includes(response.status)) {
        if (await probeWebDavCollection(request.url, request.headers.Authorization)) {
          continue;
        }
      }
      throw new Error(`WebDAV 目录创建失败：HTTP ${response.status}`);
    }
  }

  async function probeWebDavCollection(url, authorization) {
    const response = await requestWebDav(url, {
      method: "PROPFIND",
      headers: {
        Authorization: authorization,
        Depth: "0"
      }
    });
    if ([200, 207].includes(response.status)) {
      return true;
    }
    if (response.status === 404) {
      return false;
    }
    if ([401, 403].includes(response.status)) {
      throw new Error(`WebDAV 认证失败：HTTP ${response.status}`);
    }
    throw new Error(`WebDAV 目录检查失败：HTTP ${response.status}`);
  }

  async function retryWebDavUpload(request, target) {
    await ensureWebDavRemoteDirectory(target);
    let response = await requestWebDav(request.url, {
      method: "PUT",
      headers: request.headers,
      body: request.body
    });
    if (response.ok || response.status !== 404) {
      return response;
    }

    await ensureWebDavRemoteDirectory(target);
    response = await requestWebDav(request.url, {
      method: "PUT",
      headers: request.headers,
      body: request.body
    });
    return response;
  }

  function getGraphSeedEvidenceText() {
    return (
      cleanText(getField("paper-summary-output").textContent) ||
      cleanText(window.WorkbenchReadingContext?.text) ||
      cleanText(window.WorkbenchLastDraft?.content) ||
      "未记录"
    );
  }

  function renderSelectedPaperContexts(papers) {
    const selectedPapers = Array.isArray(papers) ? papers : [];
    renderPaperContext(selectedPapers[0] || null, selectedPapers);
  }

  function renderPaperContext(paper, selectedPapers = []) {
    const count = Array.isArray(selectedPapers) ? selectedPapers.length : paper ? 1 : 0;
    getField("selected-paper-title").textContent = paper?.title || "未选择文献";
    getField("selected-paper-meta").textContent = paper
      ? `${count > 1 ? `已选 ${count} 篇｜` : ""}${paper.authors}｜${paper.year}｜${paper.publicationTitle}`
      : "请在 Zotero 主窗口中选中一篇文献";
    renderPaperPdfAttachment(paper?.pdfAttachment);
    getField("selected-paper-abstract").textContent =
      count > 1 ? selectedPapers.map((entry, index) => `${index + 1}. ${entry.title}`).join("\n") : paper?.abstractNote || "";
  }

  function renderPaperPdfAttachment(pdfAttachment) {
    const node = getField("selected-paper-pdf");
    if (!node) {
      return;
    }
    if (!pdfAttachment?.available) {
      node.textContent = "PDF 附件：未找到 PDF 附件";
      return;
    }
    node.textContent = `PDF 附件：${pdfAttachment.path || pdfAttachment.title || "已找到 PDF 附件"}`;
  }

  function saveSummaryDraft({ paper, summary, model }) {
    const result = ResearchPanelOrchestrator.createSummaryDraftWorkflow({
      snapshot: loadWorkbenchSnapshot(),
      paper,
      summary,
      model,
      createdAt: new Date().toISOString(),
      selectedWorkId: currentSelectedWorkId(),
      filters: readGraphReviewFilters()
    });
    const snapshot = result.snapshot;
    const draft = result.draft;
    saveWorkbenchSnapshot(snapshot);
    window.WorkbenchLastDraft = draft;
    return draft;
  }

  function saveReadingTranslationDraft({ context, paper, translation, model }) {
    const result = ResearchPanelOrchestrator.createReadingTranslationDraftWorkflow({
      snapshot: loadWorkbenchSnapshot(),
      context,
      paper,
      translation,
      model,
      createdAt: new Date().toISOString(),
      selectedWorkId: currentSelectedWorkId(),
      filters: readGraphReviewFilters()
    });
    const snapshot = result.snapshot;
    const draft = result.draft;
    saveWorkbenchSnapshot(snapshot);
    window.WorkbenchLastDraft = draft;
    return draft;
  }

  function loadWorkbenchSnapshot() {
    return WorkbenchLocalStore.loadSnapshot();
  }

  function saveWorkbenchSnapshot(snapshot) {
    return WorkbenchLocalStore.saveSnapshot(snapshot);
  }

  function normalizeWebDavExportTarget(input = {}) {
    const serverUrl = cleanText(input.serverUrl);
    const username = cleanText(input.username);
    const password = cleanText(input.password);
    const remoteDirectory = normalizeRemoteDirectory(input.remoteDirectory);

    if (!serverUrl) {
      throw new Error("请填写 WebDAV 服务器地址");
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(serverUrl);
    } catch (_error) {
      throw new Error("WebDAV 服务器地址必须是 http(s) URL");
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("WebDAV 服务器地址必须是 http(s) URL");
    }
    if (!username) {
      throw new Error("请填写 WebDAV 用户名");
    }
    if (!password) {
      throw new Error("请填写 WebDAV 密码");
    }

    const normalizedServerUrl = serverUrl.replace(/\/+$/, "");
    const uploadBaseUrl = `${normalizedServerUrl}/${remoteDirectory ? `${remoteDirectory}/` : ""}`;
    return {
      serverUrl: normalizedServerUrl,
      username,
      password,
      remoteDirectory,
      uploadBaseUrl
    };
  }

  function buildWebDavExportRequest({ target, snapshot, exportedAt } = {}) {
    const normalizedTarget = normalizeWebDavExportTarget(target);
    const timestamp = cleanText(exportedAt) || new Date().toISOString();
    const filename = `zotero-research-workbench-${createStableTimestamp(timestamp)}.json`;
    const exportPackage = createWorkbenchExportPackage({ snapshot, exportedAt: timestamp });
    return {
      method: "PUT",
      url: new URL(encodeURIComponent(filename), normalizedTarget.uploadBaseUrl).toString(),
      filename,
      headers: {
        Authorization: `Basic ${encodeBasicAuth(normalizedTarget.username, normalizedTarget.password)}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(exportPackage, null, 2)
    };
  }

  function buildWebDavDirectoryRequests(target) {
    const normalizedTarget = normalizeWebDavExportTarget(target);
    if (!normalizedTarget.remoteDirectory) {
      return [];
    }

    const headers = {
      Authorization: `Basic ${encodeBasicAuth(normalizedTarget.username, normalizedTarget.password)}`
    };
    const parts = normalizedTarget.remoteDirectory.split("/").filter(Boolean);
    return parts.map((_part, index) => {
      const directory = parts.slice(0, index + 1).join("/");
      return {
        method: "MKCOL",
        url: `${normalizedTarget.serverUrl}/${directory}/`,
        headers
      };
    });
  }

  function buildImportStatus(snapshot) {
    return [
      "已导入工作台状态",
      `草稿 ${snapshot.researchNoteDrafts.length} 条`,
      `图谱种子 ${snapshot.graphSeeds.length} 条`,
      `任务记录 ${snapshot.taskLedger.length} 条`
    ].join("；");
  }

  function describeFilePath(file) {
    return file?.path || String(file || "");
  }

  function renderDraftStatus(draft) {
    getField("paper-draft-status").textContent = draft
      ? `已自动保存为草稿（${formatLocalTime(draft.createdAt)}）`
      : "当前结果尚未保存";
  }

  function renderRecentDrafts() {
    const list = getField("recent-drafts-list");
    if (!list) {
      return;
    }

    const drafts = listRecentSummaryDrafts(loadWorkbenchSnapshot());
    list.textContent = "";

    if (!drafts.length) {
      const empty = createHtmlElement("span");
      empty.className = "status";
      empty.textContent = "暂无草稿";
      list.appendChild(empty);
      return;
    }

    for (const draft of drafts) {
      const button = createHtmlElement("button");
      button.className = "draft-button";
      button.type = "button";
      button.addEventListener("click", () => loadRecentDraft(draft));

      const title = createHtmlElement("span");
      title.className = "draft-title";
      title.textContent = draft.title || "未命名草稿";

      const meta = createHtmlElement("span");
      meta.className = "draft-meta";
      meta.textContent = `${formatLocalTime(draft.createdAt)}${draft.model ? `｜${draft.model}` : ""}`;

      button.appendChild(title);
      button.appendChild(meta);
      list.appendChild(button);
    }
  }

  function loadRecentDraft(draft) {
    loadDraftIntoSummaryReader(draft, {
      statusMessage: "已载入最近草稿",
      draftStatusPrefix: "已载入草稿"
    });
  }

  function loadDraftIntoSummaryReader(draft, { statusMessage, draftStatusPrefix } = {}) {
    getField("paper-summary-output").textContent = draft.content || "";
    getField("paper-summary-status").textContent = statusMessage || "已载入草稿";
    getField("paper-draft-status").textContent = `${draftStatusPrefix || "已载入草稿"}（${formatLocalTime(draft.createdAt)}）`;
    window.WorkbenchLastSummary = draft.content || "";
    window.WorkbenchLastDraft = draft;
  }

  function renderWorkbenchRecords() {
    const snapshot = loadWorkbenchSnapshot();
    const records = ResearchPanelOrchestrator.createPanelRecords(snapshot, {
      selectedWorkId: currentSelectedWorkId(),
      filters: readGraphReviewFilters()
    });
    renderGraphSeedRecords(records.recentGraphSeeds);
    renderTaskLedgerRecords(records.recentTaskLedger);
    renderWorkIdentityInspector(records.graphReview);
    renderDuplicateWorkCandidates(records.graphReview, snapshot);
    renderCitationGraphInspector(records.graphReview);
  }

  function createCurrentGraphReviewReadModel(snapshot = loadWorkbenchSnapshot()) {
    return createGraphReviewReadModel({
      snapshot,
      selectedWorkId: currentSelectedWorkId(),
      filters: readGraphReviewFilters()
    });
  }

  function renderWorkIdentityInspector(graphReview = null) {
    const list = getField("work-identity-inspector-list");
    if (!list) {
      return;
    }
    const works = (graphReview || createCurrentGraphReviewReadModel()).workIdentities;
    list.textContent = "";

    if (!works.length) {
      appendEmptyRecord(list, "暂无作品身份线索");
      return;
    }

    for (const work of works) {
      const item = createRecordItem({
        title: work.title,
        meta: `${work.workId}｜DOI ${work.doi}｜Zotero ${work.zoteroItemKey}`,
        detail: `草稿 ${work.draftCount}｜图谱种子 ${work.graphSeedCount}｜关系 ${work.citationRelationCount}｜最近 ${formatLocalTime(work.lastSeenAt)}${formatWorkIdentityStatusTags(work.statusTags)}`
      });
      list.appendChild(item);
    }
  }

  function formatWorkIdentityStatusTags(statusTags) {
    const tags = Array.isArray(statusTags) ? statusTags.map(cleanText).filter(Boolean) : [];
    return tags.length ? `｜${tags.join("｜")}` : "";
  }

  function readWorkIdentityInspectorFilters() {
    return {
      scope: cleanText(getField("work-identity-scope-filter")?.value) || "current-work",
      statusTag: cleanText(getField("work-identity-status-filter")?.value) || "all",
      workId: currentSelectedWorkId()
    };
  }

  function renderDuplicateWorkCandidates(graphReview = null, sourceSnapshot = null) {
    const list = getField("duplicate-work-candidates-list");
    if (!list) {
      return;
    }
    const snapshot = sourceSnapshot || loadWorkbenchSnapshot();
    const candidates = (graphReview || createCurrentGraphReviewReadModel(snapshot)).duplicateWorkCandidates;
    list.textContent = "";

    if (!candidates.length) {
      appendEmptyRecord(list, "暂无重复作品候选");
      return;
    }

    for (const candidate of candidates) {
      const item = createRecordItem({
        title: `${formatDuplicateReason(candidate.reason)}｜${candidate.label}`,
        meta: `置信度 ${formatDuplicateConfidence(candidate.confidence)}｜${formatLocalTime(candidate.lastSeenAt)}`,
        detail: `作品：${candidate.workIds.join("；")}｜标题：${candidate.titles.join("；")}`
      });
      item.appendChild(createDuplicateWorkCandidateEvidenceDetails(snapshot, candidate));
      list.appendChild(item);
    }
  }

  function readDuplicateWorkCandidateFilters() {
    return {
      scope: cleanText(getField("duplicate-work-scope-filter")?.value) || "all",
      confidence: cleanText(getField("duplicate-work-confidence-filter")?.value) || "all",
      reason: cleanText(getField("duplicate-work-reason-filter")?.value) || "all",
      workId: currentSelectedWorkId()
    };
  }

  function renderCitationGraphInspector(graphReview = null) {
    const list = getField("citation-graph-inspector-list");
    if (!list) {
      return;
    }
    const relations = (graphReview || createCurrentGraphReviewReadModel()).citationRelations;
    list.textContent = "";

    if (!relations.length) {
      appendEmptyRecord(list, "暂无引用关系");
      return;
    }

    for (const relation of relations) {
      const item = createRecordItem({
        title: `${relation.sourceTitle} → ${relation.target}`,
        meta: `${relation.relationType}｜置信度 ${relation.confidence}｜${formatLocalTime(relation.createdAt)}`,
        detail: `证据：${relation.evidence}｜来源种子：${relation.graphSeedId}${formatCitationRelationQualityTags(relation.qualityTags)}`
      });
      list.appendChild(item);
    }
  }

  function readCitationGraphInspectorFilters() {
    return {
      scope: cleanText(getField("citation-graph-scope-filter")?.value) || "current-work",
      qualityTag: cleanText(getField("citation-graph-quality-filter")?.value) || "all",
      workId: currentSelectedWorkId()
    };
  }

  function readGraphReviewFilters() {
    return {
      graphSeedReview: readGraphSeedReviewFilters(),
      citationGraph: readCitationGraphInspectorFilters(),
      workIdentity: readWorkIdentityInspectorFilters(),
      duplicateWork: readDuplicateWorkCandidateFilters()
    };
  }

  function renderGraphSeedReviewQueue(graphReview = null) {
    const list = getField("graph-seed-review-list");
    if (!list) {
      return;
    }
    const seeds = (graphReview || createCurrentGraphReviewReadModel()).graphSeedReviewQueue;
    list.textContent = "";

    if (!seeds.length) {
      appendEmptyRecord(list, "暂无待复核图谱种子");
      return;
    }

    for (const seed of seeds) {
      const item = createRecordItem({
        title: `${seed.sourceTitle} → ${seed.target}`,
        meta: `${formatReviewState(seed.reviewState)}｜${seed.relationType}｜置信度 ${seed.confidence}｜${seed.seedKind}`,
        detail: `证据：${seed.evidence}｜服务商：${seed.provider}｜${formatLocalTime(seed.createdAt)}`
      });
      if (seed.reviewState === "pending") {
        const actions = createHtmlElement("div");
        actions.className = "actions";
        actions.appendChild(createReviewButton("确认", () => reviewGraphSeed(seed.id, "confirmed")));
        actions.appendChild(createReviewButton("拒绝", () => reviewGraphSeed(seed.id, "rejected")));
        item.appendChild(actions);
      } else {
        const reviewed = createHtmlElement("span");
        reviewed.className = "record-meta";
        reviewed.textContent = `复核时间：${formatLocalTime(seed.reviewedAt)}`;
        item.appendChild(reviewed);
        if (seed.reviewState === "confirmed" && !seed.promotedCitationRelationId) {
          const actions = createHtmlElement("div");
          actions.className = "actions";
          actions.appendChild(createReviewButton("生成关系", () => promoteGraphSeed(seed.id)));
          item.appendChild(actions);
        }
        if (seed.promotedCitationRelationId) {
          const promoted = createHtmlElement("span");
          promoted.className = "record-meta";
          promoted.textContent = `已生成关系：${seed.promotedCitationRelationId}`;
          item.appendChild(promoted);
        }
      }
      list.appendChild(item);
    }
  }

  function reviewGraphSeed(seedId, reviewState) {
    try {
      const result = ResearchPanelOrchestrator.reviewGraphSeedWorkflow({
        snapshot: loadWorkbenchSnapshot(),
        seedId,
        reviewState,
        reviewedAt: new Date().toISOString(),
        selectedWorkId: currentSelectedWorkId(),
        filters: readGraphReviewFilters()
      });
      const snapshot = result.snapshot;
      saveWorkbenchSnapshot(snapshot);
      showStatus("workbench-export-status", reviewState === "confirmed" ? "图谱种子已确认" : "图谱种子已拒绝");
      renderWorkbenchRecords();
      renderGraphSeedReviewQueue();
    } catch (error) {
      showLayeredError("workbench-export-status", "更新图谱种子复核状态失败", error);
    }
  }

  function promoteGraphSeed(seedId) {
    try {
      const result = ResearchPanelOrchestrator.promoteGraphSeedWorkflow({
        snapshot: loadWorkbenchSnapshot(),
        seedId,
        promotedAt: new Date().toISOString(),
        selectedWorkId: currentSelectedWorkId(),
        filters: readGraphReviewFilters()
      });
      if (result.status === "notConfirmed") {
        showStatus("workbench-export-status", "图谱种子尚未确认");
        return;
      }
      if (result.status === "missingSeed") {
        showStatus("workbench-export-status", "未找到图谱种子");
        return;
      }
      const snapshot = result.snapshot;
      saveWorkbenchSnapshot(snapshot);
      showStatus(
        "workbench-export-status",
        result.status === "alreadyPromoted" ? "引用关系已存在" : "已生成引用关系"
      );
      renderWorkbenchRecords();
      renderGraphSeedReviewQueue();
    } catch (error) {
      showLayeredError("workbench-export-status", "生成引用关系失败", error);
    }
  }

  function readGraphSeedReviewFilters() {
    return {
      reviewState: cleanText(getField("graph-seed-review-state-filter")?.value) || "pending",
      providerId: cleanText(getField("graph-seed-provider-filter")?.value),
      confidence: cleanText(getField("graph-seed-confidence-filter")?.value),
      relationType: cleanText(getField("graph-seed-relation-filter")?.value),
      seedKind: cleanText(getField("graph-seed-kind-filter")?.value),
      currentWorkOnly: Boolean(getField("graph-seed-current-work-only")?.checked),
      workId: currentSelectedWorkId()
    };
  }

  function initializeSegmentedFilters() {
    for (const group of Array.from(document.querySelectorAll(".segmented-filter[data-filter-target]"))) {
      const target = getField(group.dataset.filterTarget);
      if (!target) {
        continue;
      }
      syncSegmentedFilterButtons(group, target.value);
      for (const button of Array.from(group.querySelectorAll("button[data-filter-value]"))) {
        button.addEventListener("click", () => {
          selectSegmentedFilterOption(group, target, button.dataset.filterValue);
          renderSegmentedFilterTarget(group.dataset.filterTarget);
        });
      }
    }
  }

  function renderSegmentedFilterTarget(targetId) {
    switch (targetId) {
      case "work-identity-scope-filter":
      case "work-identity-status-filter":
        renderWorkIdentityInspector();
        break;
      case "duplicate-work-scope-filter":
        renderDuplicateWorkCandidates();
        break;
      case "duplicate-work-confidence-filter":
        synchronizeDuplicateWorkCandidateFilters(targetId);
        renderDuplicateWorkCandidates();
        break;
      case "duplicate-work-reason-filter":
        synchronizeDuplicateWorkCandidateFilters(targetId);
        renderDuplicateWorkCandidates();
        break;
      case "citation-graph-scope-filter":
        renderCitationGraphInspector();
        break;
      case "citation-graph-quality-filter":
        renderCitationGraphInspector();
        break;
      default:
        renderGraphSeedReviewQueue();
        break;
    }
  }

  function synchronizeDuplicateWorkCandidateFilters(changedTargetId) {
    const confidence = getField("duplicate-work-confidence-filter");
    const reason = getField("duplicate-work-reason-filter");
    if (!confidence || !reason) {
      return;
    }

    if (changedTargetId === "duplicate-work-reason-filter") {
      const impliedConfidence = duplicateConfidenceForReason(reason.value);
      if (impliedConfidence) {
        confidence.value = impliedConfidence;
        syncSegmentedFilterButtonsForTarget("duplicate-work-confidence-filter");
      }
      return;
    }

    if (changedTargetId === "duplicate-work-confidence-filter") {
      const impliedConfidence = duplicateConfidenceForReason(reason.value);
      if (impliedConfidence && impliedConfidence !== cleanText(confidence.value)) {
        reason.value = "all";
        syncSegmentedFilterButtonsForTarget("duplicate-work-reason-filter");
      }
    }
  }

  function syncSegmentedFilterButtonsForTarget(targetId) {
    const target = getField(targetId);
    if (!target) {
      return;
    }
    const group = document.querySelector(`.segmented-filter[data-filter-target="${targetId}"]`);
    if (group) {
      syncSegmentedFilterButtons(group, target.value);
    }
  }

  function selectSegmentedFilterOption(group, target, value) {
    target.value = cleanText(value);
    syncSegmentedFilterButtons(group, target.value);
  }

  function syncSegmentedFilterButtons(group, value) {
    const selectedValue = cleanText(value);
    for (const button of Array.from(group.querySelectorAll("button[data-filter-value]"))) {
      const isSelected = cleanText(button.dataset.filterValue) === selectedValue;
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    }
  }

  function currentSelectedWorkId() {
    const paper = window.WorkbenchSelectedPaper || readSelectedPaperContext();
    return paper ? createWorkId(normalizePaperContext(paper)) : "";
  }

  function createReviewButton(label, onClick) {
    const button = createHtmlElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function renderGraphSeedRecords(seeds) {
    const list = getField("graph-seeds-list");
    if (!list) {
      return;
    }
    list.textContent = "";

    if (!seeds.length) {
      appendEmptyRecord(list, "暂无图谱种子");
      return;
    }

    for (const seed of seeds) {
      const item = createRecordItem({
        title: `${seed.sourceTitle} → ${seed.target}`,
        meta: `${seed.relationType}｜置信度 ${seed.confidence}｜${seed.seedKind}｜${formatLocalTime(seed.createdAt)}`,
        detail: `证据：${seed.evidence}｜服务商：${seed.provider}`
      });
      list.appendChild(item);
    }
  }

  function renderTaskLedgerRecords(tasks) {
    const list = getField("task-ledger-list");
    if (!list) {
      return;
    }
    list.textContent = "";

    if (!tasks.length) {
      appendEmptyRecord(list, "暂无任务记录");
      return;
    }

    for (const task of tasks) {
      const item = createRecordItem({
        title: `${task.workflowStep}｜${task.state}`,
        meta: `${formatLocalTime(task.occurredAt)}｜${task.provider}｜${task.promptTaskTemplateId}`,
        detail:
          task.errorMessage === "无"
            ? `输出：${task.outputLocation}`
            : `输出：${task.outputLocation}｜错误：${task.errorMessage}`
      });
      list.appendChild(item);
    }
  }

  function createRecordItem({ title, meta, detail }) {
    const item = createHtmlElement("div");
    item.className = "record-item";

    const titleNode = createHtmlElement("span");
    titleNode.className = "record-title";
    titleNode.textContent = title;

    const metaNode = createHtmlElement("span");
    metaNode.className = "record-meta";
    metaNode.textContent = meta;

    const detailNode = createHtmlElement("span");
    detailNode.className = "record-meta";
    detailNode.textContent = detail;

    item.appendChild(titleNode);
    item.appendChild(metaNode);
    item.appendChild(detailNode);
    return item;
  }

  function createDuplicateWorkCandidateEvidenceDetails(snapshot, candidate) {
    const details = createHtmlElement("details");
    details.className = "record-meta";
    details.setAttribute("aria-label", "候选证据");

    const summary = createHtmlElement("summary");
    summary.textContent = "查看证据";
    details.appendChild(summary);

    const evidence = listGraphReviewDuplicateWorkCandidateEvidence({ snapshot, candidate });
    if (!evidence.length) {
      const empty = createHtmlElement("span");
      empty.className = "record-meta";
      empty.textContent = "证据来源：未找到匹配记录";
      details.appendChild(empty);
      return details;
    }

    const list = createHtmlElement("ul");
    list.className = "record-meta";
    for (const record of evidence) {
      const item = createHtmlElement("li");
      item.textContent = [
        `证据来源：${record.sourceLabel}`,
        `记录：${record.recordId}`,
        `作品：${record.workId}`,
        `字段：${formatDuplicateEvidenceField(record.matchedField)}=${record.matchedValue}`,
        `标题：${record.title}`,
        `DOI ${record.doi}`,
        `Zotero ${record.zoteroItemKey}`,
        `时间：${formatLocalTime(record.createdAt)}`
      ].join("｜");
      list.appendChild(item);
    }
    details.appendChild(list);
    return details;
  }

  function appendEmptyRecord(list, text) {
    const empty = createHtmlElement("span");
    empty.className = "status";
    empty.textContent = text;
    list.appendChild(empty);
  }

  function ensureCurrentDraft({ paper, summary }) {
    if (
      window.WorkbenchLastDraft?.confirmationState === "draft" &&
      cleanText(window.WorkbenchLastDraft.content) === cleanText(summary)
    ) {
      return window.WorkbenchLastDraft;
    }
    return saveSummaryDraft({
      paper,
      summary,
      model: getPref(PREFS.model)
    });
  }

  async function requestPaperSummary({ paper, settings, fetchImpl, promptOverrides, runtimeGuard }) {
    const prompt = renderPrompt(
      resolvePromptTemplate("single-paper-chinese-summary", promptOverrides),
      createPaperPromptContext(paper)
    );
    assertLlmRuntimeRequestAllowed({
      prompt,
      settings,
      taskType: "single-paper-chinese-summary",
      runtimeGuard
    });
    return requestOpenAICompatibleChatCompletion({
      settings,
      prompt,
      temperature: 0.2,
      fetchImpl,
      failureMessage: "总结生成失败"
    });
  }

  async function requestReadingContextTranslation({ context, settings, fetchImpl, promptOverrides, runtimeGuard }) {
    const prompt = renderPrompt(
      resolvePromptTemplate("reading-context-chinese-translation", promptOverrides),
      createReadingPromptContext(context)
    );
    assertLlmRuntimeRequestAllowed({
      prompt,
      settings,
      taskType: "reading-context-chinese-translation",
      runtimeGuard
    });
    return requestOpenAICompatibleChatCompletion({
      settings,
      prompt,
      temperature: 0.1,
      fetchImpl,
      failureMessage: "翻译生成失败"
    });
  }

  function buildChinesePaperSummaryPrompt(context) {
    return renderPrompt(resolvePromptTemplate("single-paper-chinese-summary"), createPaperPromptContext(context));
  }

  function buildChineseReadingContextTranslationPrompt(context) {
    return renderPrompt(resolvePromptTemplate("reading-context-chinese-translation"), createReadingPromptContext(context));
  }

  function createPaperPromptContext(input) {
    const paper = normalizePaperContext(input || {});
    return {
      itemTitle: paper.title,
      itemAuthors: paper.authors,
      abstract: paper.abstractNote,
      year: paper.year,
      publicationTitle: paper.publicationTitle,
      doi: paper.doi
    };
  }

  function createReadingPromptContext(context) {
    return {
      selectedText: cleanSelectedText(context?.text),
      pageLabel: cleanText(context?.pageLabel) || "未记录",
      source: cleanText(context?.source) || "reader-selection"
    };
  }

  function createPromptTaskTemplate(template) {
    const required = [
      "id",
      "purpose",
      "requiredContext",
      "template",
      "outputExpectation",
      "defaultProviderCapability",
      "version"
    ];
    for (const field of required) {
      if (!template || template[field] === undefined || template[field] === "") {
        throw new Error(`Prompt task template ${field} is required`);
      }
    }
    const variables = extractTemplateVariables(template.template);
    for (const variable of variables) {
      if (!SAFE_TEMPLATE_VARIABLES.has(variable)) {
        throw new Error(`Template variable ${variable} is not allowed`);
      }
    }
    return {
      ...template,
      requiredContext: [...template.requiredContext],
      outputLanguageStrategy: template.outputLanguageStrategy || "follow-ui-language",
      variables
    };
  }

  function renderPrompt(template, context) {
    const promptTaskTemplate = createPromptTaskTemplate(template);
    for (const field of promptTaskTemplate.requiredContext) {
      if (context[field] === undefined || context[field] === null || context[field] === "") {
        throw new Error(`Missing required context: ${field}`);
      }
    }
    return promptTaskTemplate.template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, name) => {
      if (!SAFE_TEMPLATE_VARIABLES.has(name)) {
        throw new Error(`Template variable ${name} is not allowed`);
      }
      return String(context[name] || "");
    });
  }

  function extractTemplateVariables(template) {
    return [...String(template || "").matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]);
  }

  function resolvePromptTemplate(templateId, promptOverrides = []) {
    const builtIn = BUILT_IN_PROMPT_TEMPLATES[templateId];
    if (!builtIn) {
      throw new Error(`Unknown prompt template: ${templateId}`);
    }
    const override = Array.isArray(promptOverrides)
      ? promptOverrides.find((entry) => entry?.templateId === templateId)
      : null;
    if (!override?.template) {
      return createPromptTaskTemplate(builtIn);
    }
    return createPromptTaskTemplate({
      ...builtIn,
      template: override.template
    });
  }

  function upsertPromptOverride(snapshot, override) {
    const templateId = cleanText(override?.templateId);
    const template = cleanText(override?.template);
    const resolved = resolvePromptTemplate(templateId, [{ templateId, template }]);
    const next = cloneSnapshot(snapshot);
    const overrides = Array.isArray(next.promptOverrides)
      ? next.promptOverrides.filter((entry) => entry?.templateId !== templateId)
      : [];
    overrides.push({ templateId: resolved.id, template: resolved.template });
    next.promptOverrides = overrides;
    return next;
  }

  function removePromptOverride(snapshot, templateId) {
    const next = cloneSnapshot(snapshot);
    next.promptOverrides = (Array.isArray(next.promptOverrides) ? next.promptOverrides : []).filter(
      (entry) => entry?.templateId !== templateId
    );
    return next;
  }

  function buildSummaryCopyText({ paper, summary, draft }) {
    const normalized = normalizePaperContext(paper || {});
    const lines = [
      draft?.promptTaskTemplateId === "reading-context-chinese-translation"
        ? "Zotero 研究工作台 - 阅读上下文翻译"
        : "Zotero 研究工作台 - 文献总结",
      "",
      `标题：${normalized.title}`,
      `作者：${normalized.authors}`,
      `年份：${normalized.year}`,
      `期刊/来源：${normalized.publicationTitle}`,
      `DOI：${normalized.doi}`
    ];
    if (draft?.promptTaskTemplateId === "reading-context-chinese-translation") {
      lines.push(`页码：${cleanText(draft?.inputContext?.pageLabel) || "未记录"}`, "", "原文：");
      lines.push(cleanSelectedText(draft?.inputContext?.selectedText) || "未记录");
    }
    lines.push("", "生成结果：", cleanText(summary));
    return lines.join("\n");
  }

  function buildZoteroNoteHtml({ draft, savedAt }) {
    const context = draft?.inputContext || {};
    const timestamp = cleanText(savedAt) || new Date().toISOString();
    const noteKind =
      draft?.promptTaskTemplateId === "multi-paper-commonality-note"
        ? "Zotero 研究工作台 - 共同点笔记"
        : draft?.promptTaskTemplateId === "reading-context-chinese-translation"
        ? "Zotero 研究工作台 - 阅读上下文翻译"
        : "Zotero 研究工作台 - 文献总结";
    const metadata = buildZoteroNoteMetadata({ context, draft });
    const lines = [
      `<h1>${escapeHtml(draft?.title || noteKind)}</h1>`,
      `<p><strong>${escapeHtml(noteKind)}</strong></p>`,
      "<ul>",
      ...metadata.map(([label, value]) => `<li>${escapeHtml(label)}：${escapeHtml(value || "未记录")}</li>`),
      `<li>模型：${escapeHtml(draft?.llmProviderId || "未记录")}</li>`,
      `<li>草稿时间：${escapeHtml(draft?.createdAt || "未记录")}</li>`,
      `<li>写入时间：${escapeHtml(timestamp)}</li>`,
      "</ul>",
      "<h2>生成结果</h2>",
      `<p>${formatNoteBody(draft?.content || "")}</p>`
    ];
    return lines.join("");
  }

  function buildZoteroNoteMetadata({ context, draft }) {
    if (draft?.promptTaskTemplateId === "multi-paper-commonality-note") {
      const papers = Array.isArray(context.selectedPapers) ? context.selectedPapers : [];
      return [
        ["任务", context.requestText || "共同点综合"],
        ["文献数量", papers.length ? String(papers.length) : "未记录"],
        ["来源文献", papers.map((paper) => cleanText(paper?.title)).filter(Boolean).join("；") || "未记录"]
      ];
    }
    if (draft?.promptTaskTemplateId === "reading-context-chinese-translation") {
      return [
        ["标题", context.title || draft?.title || "未命名条目"],
        ["来源", context.source || "未记录"],
        ["页码", context.pageLabel || "未记录"],
        ["原文", context.selectedText || "未记录"]
      ];
    }
    return [
      ["标题", context.title || draft?.title || "未命名条目"],
      ["作者", context.authors || "未记录"],
      ["年份", context.year || "未记录"],
      ["期刊/来源", context.publicationTitle || "未记录"],
      ["DOI", context.doi || "未记录"]
    ];
  }

  function markSummaryDraftSavedToZotero({ snapshot, draftId, zoteroNoteKey, savedAt }) {
    const timestamp = cleanText(savedAt) || new Date().toISOString();
    const next = cloneSnapshot(snapshot);
    const drafts = Array.isArray(next.researchNoteDrafts) ? next.researchNoteDrafts : [];
    const draft = drafts.find((entry) => entry?.id === draftId);
    if (!draft) {
      throw new Error(`草稿不存在：${draftId}`);
    }

    draft.confirmationState = "confirmed";
    draft.confirmedZoteroNoteKey = cleanText(zoteroNoteKey);
    draft.confirmedAt = timestamp;
    draft.provenance = {
      ...(draft.provenance || {}),
      writeTarget: "zotero-note"
    };

    next.taskLedger = Array.isArray(next.taskLedger) ? next.taskLedger : [];
    next.taskLedger.push({
      id: `task-${draft.id}-save-to-zotero-note`,
      workflowStep: "save-to-zotero-note",
      state: "completed",
      providerId: draft.llmProviderId || null,
      promptTaskTemplateId: draft.promptTaskTemplateId || null,
      outputLocation: { draftId: draft.id, zoteroNoteKey: cleanText(zoteroNoteKey) },
      errorNotice: null,
      startedAt: timestamp,
      completedAt: timestamp,
      provenance: {
        source: "explicit-user-action",
        writeTarget: "zotero-note"
      }
    });
    next.exportedAt = timestamp;
    return next;
  }

  function createGraphSeedInput({
    paper,
    target,
    relationType,
    confidence,
    evidenceText,
    providerId,
    seedKind,
    createdAt
  }) {
    const normalized = normalizePaperContext(paper || {});
    const targetText = cleanText(target);
    if (!targetText) {
      throw new Error("图谱种子目标不能为空");
    }
    const timestamp = cleanText(createdAt) || new Date().toISOString();
    return {
      id: `seed-${normalized.key || "unknown"}-${createStableTimestamp(timestamp)}`,
      workId: createWorkId(normalized),
      zoteroItemKey: normalized.key,
      source: {
        title: normalized.title,
        doi: normalized.doi
      },
      relationType: cleanText(relationType) || "related",
      target: {
        kind: "work-hint",
        text: targetText
      },
      evidence: {
        source: "workbench-generated-result",
        text: cleanText(evidenceText) || "未记录"
      },
      providerId: cleanText(providerId) || null,
      confidence: cleanText(confidence) || "low",
      seedKind: cleanText(seedKind) || "user-confirmed",
      createdAt: timestamp,
      provenance: {
        source: "explicit-user-action",
        writeTarget: "local-snapshot-only"
      }
    };
  }

  function appendGraphSeedToSnapshot({ snapshot, seedInput, createdAt }) {
    const timestamp = cleanText(createdAt) || new Date().toISOString();
    const next = cloneSnapshot(snapshot);
    next.graphSeeds = Array.isArray(next.graphSeeds) ? next.graphSeeds : [];
    next.taskLedger = Array.isArray(next.taskLedger) ? next.taskLedger : [];
    next.graphSeeds.push(seedInput);
    next.taskLedger.push({
      id: `task-${seedInput.id}-capture-graph-seed`,
      workflowStep: "capture-graph-seed",
      state: "completed",
      providerId: seedInput.providerId || null,
      promptTaskTemplateId: null,
      outputLocation: { graphSeedId: seedInput.id },
      errorNotice: null,
      startedAt: timestamp,
      completedAt: timestamp,
      provenance: {
        source: "explicit-user-action",
        writeTarget: "local-snapshot-only"
      }
    });
    next.exportedAt = timestamp;
    return next;
  }

  function createSummaryDraftInput({ paper, summary, model, createdAt }) {
    const normalized = normalizePaperContext(paper || {});
    const timestamp = cleanText(createdAt) || new Date().toISOString();
    return {
      id: `draft-${normalized.key || "unknown"}-${createStableTimestamp(timestamp)}`,
      zoteroItemKey: normalized.key,
      workId: createWorkId(normalized),
      title: `${normalized.title} - 中文总结`,
      content: cleanText(summary),
      promptTaskTemplateId: "single-paper-chinese-summary",
      llmProviderId: cleanText(model),
      inputContext: {
        title: normalized.title,
        authors: normalized.authors,
        year: normalized.year,
        publicationTitle: normalized.publicationTitle,
        doi: normalized.doi
      },
      createdAt: timestamp,
      provenance: {
        source: "zotero-selection",
        model: cleanText(model),
        writeTarget: "local-draft-only"
      }
    };
  }

  function createReadingTranslationDraftInput({ context, translation, model, createdAt, paper }) {
    const timestamp = cleanText(createdAt) || new Date().toISOString();
    const selectedText = cleanSelectedText(context?.text);
    const itemKey = cleanText(context?.itemKey) || cleanText(paper?.key);
    const normalizedPaper = normalizePaperContext({
      ...(paper || {}),
      key: itemKey || paper?.key
    });
    return {
      id: `draft-${itemKey || "unknown"}-translation-${createStableTimestamp(timestamp)}`,
      zoteroItemKey: itemKey,
      workId: createWorkId(normalizedPaper),
      title: `${normalizedPaper.title} - 阅读上下文翻译`,
      content: cleanText(translation),
      promptTaskTemplateId: "reading-context-chinese-translation",
      llmProviderId: cleanText(model),
      inputContext: {
        title: normalizedPaper.title,
        selectedText,
        source: cleanText(context?.source),
        pageLabel: cleanText(context?.pageLabel)
      },
      createdAt: timestamp,
      provenance: {
        source: "zotero-reader-selection",
        model: cleanText(model),
        writeTarget: "local-draft-only"
      }
    };
  }

  function listRecentSummaryDrafts(snapshot, limit = 5) {
    const maxItems = Number.isInteger(limit) && limit > 0 ? limit : 5;
    return (Array.isArray(snapshot?.researchNoteDrafts) ? snapshot.researchNoteDrafts : [])
      .filter(
        (draft) =>
          draft?.confirmationState === "draft" &&
          ["single-paper-chinese-summary", "reading-context-chinese-translation", "multi-paper-commonality-note"].includes(
            draft?.promptTaskTemplateId
          )
      )
      .slice()
      .sort((left, right) => Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""))
      .slice(0, maxItems)
      .map((draft) => ({
        id: cleanText(draft.id),
        title: cleanText(draft.title),
        content: cleanText(draft.content),
        createdAt: cleanText(draft.createdAt),
        model: cleanText(draft.llmProviderId),
        promptTaskTemplateId: cleanText(draft.promptTaskTemplateId),
        inputContext: cloneSnapshot(draft.inputContext || {}),
        confirmationState: cleanText(draft.confirmationState)
      }));
  }

  function listRecentGraphSeeds(snapshot, limit = 5) {
    const maxItems = Number.isInteger(limit) && limit > 0 ? limit : 5;
    return (Array.isArray(snapshot?.graphSeeds) ? snapshot.graphSeeds : [])
      .slice()
      .sort((left, right) => parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt))
      .slice(0, maxItems)
      .map((seed) => ({
        id: cleanDisplayText(seed?.id),
        sourceTitle: cleanDisplayText(seed?.source?.title || seed?.workId) || "未记录",
        relationType: cleanDisplayText(seed?.relationType) || "related",
        target: describeTarget(seed?.target),
        evidence: describeEvidence(seed?.evidence),
        provider: cleanDisplayText(seed?.providerId) || "未记录",
        confidence: cleanDisplayText(seed?.confidence) || "low",
        seedKind: cleanDisplayText(seed?.seedKind) || "ai-inferred",
        createdAt: cleanDisplayText(seed?.createdAt)
      }));
  }

  function listGraphSeedsForReview(snapshot, filters = {}) {
    return (Array.isArray(snapshot?.graphSeeds) ? snapshot.graphSeeds : [])
      .map(toGraphSeedReviewRecord)
      .filter((seed) => matchesGraphSeedReviewFilters(seed, filters))
      .sort((left, right) => parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt));
  }

  function markGraphSeedReviewed({ snapshot, seedId, reviewState, reviewedAt, reviewNote }) {
    const timestamp = cleanText(reviewedAt) || new Date().toISOString();
    const normalizedSeedId = cleanText(seedId);
    const normalizedReviewState = normalizeReviewState(reviewState);
    const next = cloneSnapshot(snapshot);
    next.graphSeeds = Array.isArray(next.graphSeeds) ? next.graphSeeds : [];
    const seedIndex = next.graphSeeds.findIndex((seed) => cleanText(seed?.id) === normalizedSeedId);
    if (seedIndex < 0) {
      throw new Error("未找到图谱种子");
    }

    next.graphSeeds[seedIndex] = {
      ...next.graphSeeds[seedIndex],
      reviewState: normalizedReviewState,
      reviewedAt: timestamp,
      reviewedBy: "user",
      reviewNote: cleanText(reviewNote)
    };
    next.taskLedger = Array.isArray(next.taskLedger) ? next.taskLedger : [];
    next.taskLedger.push({
      id: `task-${normalizedSeedId}-review-graph-seed-${createStableTimestamp(timestamp)}`,
      workflowStep: "review-graph-seed",
      state: "completed",
      providerId: cleanText(next.graphSeeds[seedIndex].providerId) || null,
      promptTaskTemplateId: null,
      outputLocation: { graphSeedId: normalizedSeedId, reviewState: normalizedReviewState },
      errorNotice: null,
      startedAt: timestamp,
      completedAt: timestamp,
      provenance: {
        source: "explicit-user-action",
        writeTarget: "local-snapshot-only"
      }
    });
    next.exportedAt = timestamp;
    return next;
  }

  function promoteGraphSeedToCitationRelation({ snapshot, seedId, promotedAt }) {
    const timestamp = cleanText(promotedAt) || new Date().toISOString();
    const normalizedSeedId = cleanText(seedId);
    const next = cloneSnapshot(snapshot);
    next.graphSeeds = Array.isArray(next.graphSeeds) ? next.graphSeeds : [];
    next.citationRelations = Array.isArray(next.citationRelations) ? next.citationRelations : [];
    next.taskLedger = Array.isArray(next.taskLedger) ? next.taskLedger : [];

    const seedIndex = next.graphSeeds.findIndex((seed) => cleanText(seed?.id) === normalizedSeedId);
    if (seedIndex < 0) {
      throw new Error("未找到图谱种子");
    }

    const seed = next.graphSeeds[seedIndex];
    if (normalizeReviewState(seed?.reviewState) !== "confirmed") {
      throw new Error("图谱种子尚未确认");
    }

    const relationId = cleanText(seed.promotedCitationRelationId) || `citation-relation-${normalizedSeedId}`;
    const existing = next.citationRelations.find((relation) => cleanText(relation?.id) === relationId);
    if (existing) {
      return next;
    }

    next.citationRelations.push({
      id: relationId,
      sourceWorkId: cleanText(seed.workId),
      source: clonePlain(seed.source || {}),
      relationType: cleanText(seed.relationType) || "related",
      target: clonePlain(seed.target || {}),
      evidence: clonePlain(seed.evidence || {}),
      confidence: cleanText(seed.confidence) || "low",
      graphSeedId: normalizedSeedId,
      createdAt: timestamp,
      provenance: {
        source: "confirmed-graph-seed",
        writeTarget: "local-snapshot-only"
      }
    });
    next.graphSeeds[seedIndex] = {
      ...seed,
      promotedCitationRelationId: relationId,
      promotedAt: timestamp
    };
    next.taskLedger.push({
      id: `task-${normalizedSeedId}-promote-graph-seed-to-citation-relation-${createStableTimestamp(timestamp)}`,
      workflowStep: "promote-graph-seed-to-citation-relation",
      state: "completed",
      providerId: cleanText(seed.providerId) || null,
      promptTaskTemplateId: null,
      outputLocation: { graphSeedId: normalizedSeedId, citationRelationId: relationId },
      errorNotice: null,
      startedAt: timestamp,
      completedAt: timestamp,
      provenance: {
        source: "explicit-user-action",
        writeTarget: "local-snapshot-only"
      }
    });
    next.exportedAt = timestamp;
    return next;
  }

  function listCitationRelationsForInspector(snapshot, filters = {}) {
    return (Array.isArray(snapshot?.citationRelations) ? snapshot.citationRelations : [])
      .map(toCitationRelationInspectorRecord)
      .filter((relation) => matchesCitationRelationInspectorFilters(relation, filters))
      .sort((left, right) => parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt));
  }

  function toCitationRelationInspectorRecord(relation) {
    const record = {
      id: cleanDisplayText(relation?.id),
      sourceWorkId: cleanDisplayText(relation?.sourceWorkId),
      sourceTitle: cleanDisplayText(relation?.source?.title || relation?.sourceWorkId) || "未记录",
      relationType: cleanDisplayText(relation?.relationType) || "related",
      target: cleanDisplayText(relation?.target?.text || relation?.target) || "未记录",
      evidence: cleanDisplayText(relation?.evidence?.text || relation?.evidence) || "未记录",
      confidence: cleanDisplayText(relation?.confidence) || "low",
      graphSeedId: cleanDisplayText(relation?.graphSeedId) || "未记录",
      createdAt: cleanDisplayText(relation?.createdAt)
    };
    return {
      ...record,
      qualityTags: createCitationRelationQualityTags(record)
    };
  }

  function createCitationRelationQualityTags(relation) {
    const tags = [];
    if (!cleanDisplayText(relation?.target) || relation.target === "未记录") {
      tags.push("缺少目标");
    }
    if (!cleanDisplayText(relation?.evidence) || relation.evidence === "未记录") {
      tags.push("缺少证据");
    }
    if (cleanDisplayText(relation?.confidence).toLowerCase() === "low") {
      tags.push("低置信度");
    }
    if (!cleanDisplayText(relation?.graphSeedId) || relation.graphSeedId === "未记录") {
      tags.push("缺少来源种子");
    }
    return tags;
  }

  function formatCitationRelationQualityTags(qualityTags) {
    const tags = Array.isArray(qualityTags) ? qualityTags.filter(Boolean) : [];
    return tags.length ? `｜${tags.join("｜")}` : "";
  }

  function matchesCitationRelationInspectorFilters(relation, filters) {
    if (filters.scope === "current-work" && cleanText(filters.workId)) {
      return relation.sourceWorkId === cleanText(filters.workId);
    }
    if (isActiveFilter(filters.qualityTag) && !relation.qualityTags.includes(cleanText(filters.qualityTag))) {
      return false;
    }
    return true;
  }

  function listWorkIdentitiesForInspector(snapshot, filters = {}) {
    const byWorkId = new Map();
    for (const draft of Array.isArray(snapshot?.researchNoteDrafts) ? snapshot.researchNoteDrafts : []) {
      addWorkIdentityRecord(byWorkId, {
        workId: draft?.workId,
        title: draft?.inputContext?.title || draft?.title,
        doi: draft?.inputContext?.doi,
        zoteroItemKey: draft?.zoteroItemKey,
        seenAt: draft?.createdAt,
        kind: "draft"
      });
    }
    for (const seed of Array.isArray(snapshot?.graphSeeds) ? snapshot.graphSeeds : []) {
      addWorkIdentityRecord(byWorkId, {
        workId: seed?.workId,
        title: seed?.source?.title,
        doi: seed?.source?.doi,
        zoteroItemKey: seed?.zoteroItemKey,
        seenAt: seed?.createdAt,
        kind: "graphSeed"
      });
    }
    for (const relation of Array.isArray(snapshot?.citationRelations) ? snapshot.citationRelations : []) {
      addWorkIdentityRecord(byWorkId, {
        workId: relation?.sourceWorkId,
        title: relation?.source?.title,
        doi: relation?.source?.doi,
        seenAt: relation?.createdAt,
        kind: "citationRelation"
      });
    }
    return Array.from(byWorkId.values())
      .map(finalizeWorkIdentity)
      .filter((work) => matchesWorkIdentityFilters(work, filters))
      .sort((left, right) => parseTimestamp(right.lastSeenAt) - parseTimestamp(left.lastSeenAt));
  }

  function listDuplicateWorkCandidates(snapshot, filters = {}) {
    const normalizedFilters = normalizeDuplicateCandidateFilters(filters);
    const works = listWorkIdentitiesForInspector(snapshot, normalizedFilters);
    const candidates = [];
    collectDuplicateCandidates(candidates, works, "doi", "shared-doi", "high", (value) => `DOI ${value}`);
    collectDuplicateCandidates(
      candidates,
      works,
      "zoteroItemKey",
      "shared-zotero-key",
      "high",
      (value) => `Zotero key ${value}`
    );
    collectDuplicateCandidates(
      candidates,
      works.map((work) => ({ ...work, normalizedTitle: normalizeTitleForDuplicateCheck(work.title) })),
      "normalizedTitle",
      "similar-title",
      "medium",
      (_value, group) => `标题 ${group[0].title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()}`
    );
    return candidates
      .filter((candidate) => candidate.workIds.length > 1)
      .filter((candidate) => matchesDuplicateCandidateFilters(candidate, normalizedFilters))
      .sort((left, right) => parseTimestamp(right.lastSeenAt) - parseTimestamp(left.lastSeenAt));
  }

  function collectDuplicateCandidates(candidates, works, field, reason, confidence, labelForValue) {
    const groups = new Map();
    for (const work of works) {
      const value = cleanDuplicateValue(work[field]);
      if (!value) {
        continue;
      }
      const group = groups.get(value) || [];
      group.push(work);
      groups.set(value, group);
    }

    for (const [value, group] of groups) {
      const uniqueWorkIds = new Set(group.map((work) => work.workId));
      if (uniqueWorkIds.size < 2) {
        continue;
      }
      const ordered = group.slice().sort((left, right) => parseTimestamp(right.lastSeenAt) - parseTimestamp(left.lastSeenAt));
      candidates.push({
        id: `duplicate-${duplicateReasonIdPrefix(reason)}-${createStableId(value)}`,
        reason,
        label: labelForValue(value, ordered),
        matchValue: value,
        confidence,
        workIds: ordered.map((work) => work.workId),
        titles: ordered.map((work) => work.title),
        lastSeenAt: ordered[0].lastSeenAt
      });
    }
  }

  function listDuplicateWorkCandidateEvidence(snapshot, candidate) {
    const workIds = new Set(Array.isArray(candidate?.workIds) ? candidate.workIds.map(cleanText).filter(Boolean) : []);
    const matchedField = duplicateCandidateMatchedField(candidate?.reason);
    const matchedValue = cleanText(candidate?.matchValue);
    if (!workIds.size || !matchedField || !matchedValue) {
      return [];
    }
    return [
      ...draftEvidenceRecords(snapshot, workIds, matchedField, matchedValue),
      ...graphSeedEvidenceRecords(snapshot, workIds, matchedField, matchedValue),
      ...citationRelationEvidenceRecords(snapshot, workIds, matchedField, matchedValue)
    ].sort((left, right) => parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt));
  }

  function draftEvidenceRecords(snapshot, workIds, matchedField, matchedValue) {
    return (Array.isArray(snapshot?.researchNoteDrafts) ? snapshot.researchNoteDrafts : [])
      .map((draft) => ({
        sourceType: "draft",
        sourceLabel: "草稿",
        recordId: cleanText(draft?.id) || "未记录",
        workId: cleanText(draft?.workId),
        title: cleanWorkIdentityTitle(draft?.inputContext?.title || draft?.title) || "未命名作品",
        doi: cleanDoi(draft?.inputContext?.doi) || doiFromWorkId(cleanText(draft?.workId)) || "未记录",
        zoteroItemKey: cleanText(draft?.zoteroItemKey) || zoteroKeyFromWorkId(cleanText(draft?.workId)) || "未记录",
        createdAt: cleanText(draft?.createdAt)
      }))
      .filter((record) => matchesCandidateEvidenceRecord(record, workIds, matchedField, matchedValue))
      .map((record) => addMatchFields(record, matchedField, matchedValue));
  }

  function graphSeedEvidenceRecords(snapshot, workIds, matchedField, matchedValue) {
    return (Array.isArray(snapshot?.graphSeeds) ? snapshot.graphSeeds : [])
      .map((seed) => ({
        sourceType: "graphSeed",
        sourceLabel: "图谱种子",
        recordId: cleanText(seed?.id) || "未记录",
        workId: cleanText(seed?.workId),
        title: cleanWorkIdentityTitle(seed?.source?.title) || "未命名作品",
        doi: cleanDoi(seed?.source?.doi) || doiFromWorkId(cleanText(seed?.workId)) || "未记录",
        zoteroItemKey: cleanText(seed?.zoteroItemKey) || zoteroKeyFromWorkId(cleanText(seed?.workId)) || "未记录",
        createdAt: cleanText(seed?.createdAt)
      }))
      .filter((record) => matchesCandidateEvidenceRecord(record, workIds, matchedField, matchedValue))
      .map((record) => addMatchFields(record, matchedField, matchedValue));
  }

  function citationRelationEvidenceRecords(snapshot, workIds, matchedField, matchedValue) {
    return (Array.isArray(snapshot?.citationRelations) ? snapshot.citationRelations : [])
      .map((relation) => ({
        sourceType: "citationRelation",
        sourceLabel: "引用关系",
        recordId: cleanText(relation?.id) || "未记录",
        workId: cleanText(relation?.sourceWorkId),
        title: cleanWorkIdentityTitle(relation?.source?.title) || "未命名作品",
        doi: cleanDoi(relation?.source?.doi) || doiFromWorkId(cleanText(relation?.sourceWorkId)) || "未记录",
        zoteroItemKey:
          cleanText(relation?.source?.zoteroItemKey) || zoteroKeyFromWorkId(cleanText(relation?.sourceWorkId)) || "未记录",
        createdAt: cleanText(relation?.createdAt)
      }))
      .filter((record) => matchesCandidateEvidenceRecord(record, workIds, matchedField, matchedValue))
      .map((record) => addMatchFields(record, matchedField, matchedValue));
  }

  function matchesCandidateEvidenceRecord(record, workIds, matchedField, matchedValue) {
    if (!workIds.has(record.workId)) {
      return false;
    }
    if (matchedField === "title") {
      return normalizeTitleForDuplicateCheck(record.title) === matchedValue;
    }
    return cleanDuplicateValue(record[matchedField]) === matchedValue;
  }

  function addMatchFields(record, matchedField, matchedValue) {
    return {
      ...record,
      matchedField,
      matchedValue
    };
  }

  function duplicateCandidateMatchedField(reason) {
    if (reason === "shared-doi") return "doi";
    if (reason === "shared-zotero-key") return "zoteroItemKey";
    if (reason === "similar-title") return "title";
    return "";
  }

  function formatDuplicateEvidenceField(field) {
    if (field === "doi") return "DOI";
    if (field === "zoteroItemKey") return "Zotero 条目键";
    if (field === "title") return "标题";
    return field || "未记录";
  }

  function addWorkIdentityRecord(byWorkId, input) {
    const workId = cleanText(input.workId);
    if (!workId) {
      return;
    }
    const existing =
      byWorkId.get(workId) ||
      {
        workId,
        title: "",
        doi: "",
        zoteroItemKey: "",
        draftCount: 0,
        graphSeedCount: 0,
        citationRelationCount: 0,
        lastSeenAt: ""
      };
    existing.title = existing.title || cleanWorkIdentityTitle(input.title);
    existing.doi = existing.doi || cleanDoi(input.doi) || doiFromWorkId(workId);
    existing.zoteroItemKey = existing.zoteroItemKey || cleanText(input.zoteroItemKey) || zoteroKeyFromWorkId(workId);
    if (input.kind === "draft") {
      existing.draftCount += 1;
    } else if (input.kind === "graphSeed") {
      existing.graphSeedCount += 1;
    } else if (input.kind === "citationRelation") {
      existing.citationRelationCount += 1;
    }
    existing.lastSeenAt = laterTimestamp(existing.lastSeenAt, input.seenAt);
    byWorkId.set(workId, existing);
  }

  function finalizeWorkIdentity(work) {
    const recordCount = work.draftCount + work.graphSeedCount + work.citationRelationCount;
    return {
      workId: work.workId,
      title: work.title || "未命名作品",
      doi: work.doi || "未记录",
      zoteroItemKey: work.zoteroItemKey || "未记录",
      draftCount: work.draftCount,
      graphSeedCount: work.graphSeedCount,
      citationRelationCount: work.citationRelationCount,
      recordCount,
      statusTags: createWorkIdentityStatusTags(work, recordCount),
      lastSeenAt: work.lastSeenAt
    };
  }

  function createWorkIdentityStatusTags(work, recordCount) {
    const sourceKinds = [work.draftCount, work.graphSeedCount, work.citationRelationCount].filter((count) => count > 0).length;
    const tags = [];
    if (!work.doi) {
      tags.push("无 DOI");
    }
    if (sourceKinds > 1) {
      tags.push("多来源");
    }
    if (work.citationRelationCount > 0) {
      tags.push("有引用关系");
    }
    if (recordCount === 1) {
      tags.push("孤立线索");
    }
    return tags;
  }

  function matchesWorkIdentityFilters(work, filters) {
    if (filters.scope === "current-work" && cleanText(filters.workId) && work.workId !== cleanText(filters.workId)) {
      return false;
    }
    if (isActiveFilter(filters.statusTag) && !work.statusTags.includes(cleanText(filters.statusTag))) {
      return false;
    }
    return true;
  }

  function matchesDuplicateCandidateFilters(candidate, filters) {
    if (isActiveFilter(filters.confidence) && candidate.confidence !== cleanText(filters.confidence)) {
      return false;
    }
    if (isActiveFilter(filters.reason) && candidate.reason !== cleanText(filters.reason)) {
      return false;
    }
    return true;
  }

  function normalizeDuplicateCandidateFilters(filters = {}) {
    const normalized = { ...filters };
    const impliedConfidence = duplicateConfidenceForReason(filters.reason);
    if (impliedConfidence) {
      normalized.confidence = impliedConfidence;
    }
    return normalized;
  }

  function duplicateConfidenceForReason(reason) {
    const value = cleanText(reason);
    if (value === "shared-doi" || value === "shared-zotero-key") return "high";
    if (value === "similar-title") return "medium";
    return "";
  }

  function cleanWorkIdentityTitle(value) {
    return cleanText(value).replace(/\s+-\s+中文总结$/, "");
  }

  function cleanDoi(value) {
    const text = cleanText(value);
    return text && text !== "未记录" ? text : "";
  }

  function cleanDuplicateValue(value) {
    const text = cleanText(value);
    return text && text !== "未记录" ? text : "";
  }

  function normalizeTitleForDuplicateCheck(value) {
    return cleanWorkIdentityTitle(value)
      .toLowerCase()
      .replace(/[\u2010-\u2015]/g, "-")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function createStableId(value) {
    return cleanText(value)
      .replace(/[\u2010-\u2015]/g, "-")
      .replace(/[^\p{L}\p{N}./]+/gu, "-")
      .replace(/^-+|-+$/g, "");
  }

  function duplicateReasonIdPrefix(reason) {
    if (reason === "shared-doi") return "doi";
    if (reason === "shared-zotero-key") return "zotero-key";
    if (reason === "similar-title") return "title";
    return "candidate";
  }

  function doiFromWorkId(workId) {
    return workId.startsWith("work:doi:") ? workId.slice("work:doi:".length) : "";
  }

  function zoteroKeyFromWorkId(workId) {
    return workId.startsWith("work:zotero:") ? workId.slice("work:zotero:".length) : "";
  }

  function laterTimestamp(left, right) {
    return parseTimestamp(right) > parseTimestamp(left) ? cleanText(right) : cleanText(left);
  }

  function toGraphSeedReviewRecord(seed) {
    return {
      id: cleanDisplayText(seed?.id),
      workId: cleanDisplayText(seed?.workId),
      sourceTitle: cleanDisplayText(seed?.source?.title || seed?.workId) || "未记录",
      relationType: cleanDisplayText(seed?.relationType) || "related",
      target: describeTarget(seed?.target),
      evidence: describeEvidence(seed?.evidence),
      provider: cleanDisplayText(seed?.providerId) || "未记录",
      confidence: cleanDisplayText(seed?.confidence) || "low",
      seedKind: cleanDisplayText(seed?.seedKind) || "user-confirmed",
      reviewState: normalizeReviewState(seed?.reviewState),
      reviewedAt: cleanDisplayText(seed?.reviewedAt) || "未复核",
      reviewNote: cleanDisplayText(seed?.reviewNote),
      promotedCitationRelationId: cleanDisplayText(seed?.promotedCitationRelationId),
      createdAt: cleanDisplayText(seed?.createdAt)
    };
  }

  function matchesGraphSeedReviewFilters(seed, filters) {
    if (isActiveFilter(filters.reviewState) && seed.reviewState !== filters.reviewState) return false;
    if (isActiveFilter(filters.providerId) && seed.provider !== filters.providerId) return false;
    if (isActiveFilter(filters.confidence) && seed.confidence !== filters.confidence) return false;
    if (isActiveFilter(filters.relationType) && seed.relationType !== filters.relationType) return false;
    if (isActiveFilter(filters.seedKind) && seed.seedKind !== filters.seedKind) return false;
    if (filters.currentWorkOnly && cleanText(filters.workId) && seed.workId !== cleanText(filters.workId)) {
      return false;
    }
    return true;
  }

  function isActiveFilter(value) {
    const text = cleanText(value);
    return Boolean(text && text !== "all");
  }

  function normalizeReviewState(value) {
    const text = cleanText(value);
    return ["pending", "confirmed", "rejected"].includes(text) ? text : "pending";
  }

  function listRecentTaskLedger(snapshot, limit = 5) {
    const maxItems = Number.isInteger(limit) && limit > 0 ? limit : 5;
    return (Array.isArray(snapshot?.taskLedger) ? snapshot.taskLedger : [])
      .slice()
      .sort((left, right) => parseTimestamp(taskTimestamp(right)) - parseTimestamp(taskTimestamp(left)))
      .slice(0, maxItems)
      .map((task) => ({
        id: cleanDisplayText(task?.id),
        workflowStep: cleanDisplayText(task?.workflowStep) || "未记录",
        state: cleanDisplayText(task?.state) || "unknown",
        provider: cleanDisplayText(task?.providerId) || "未记录",
        promptTaskTemplateId: cleanDisplayText(task?.promptTaskTemplateId) || "未记录",
        outputLocation: describeOutputLocation(task?.outputLocation),
        errorMessage: describeTaskError(task?.errorNotice),
        occurredAt: cleanDisplayText(taskTimestamp(task))
      }));
  }

  function formatCreators(creators) {
    if (!Array.isArray(creators) || creators.length === 0) {
      return "未记录";
    }

    const names = creators
      .map((creator) => {
        if (cleanText(creator.name)) {
          return cleanText(creator.name);
        }
        return [creator.firstName, creator.lastName].map(cleanText).filter(Boolean).join(" ");
      })
      .filter(Boolean);
    return names.length ? names.join("；") : "未记录";
  }

  function extractYear(date) {
    const value = cleanText(date);
    if (!value) {
      return "未记录";
    }
    const match = value.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
    return match ? match[1] : "未记录";
  }

  function cleanText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function cleanDisplayText(value) {
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "object" || typeof value === "function") {
      return "";
    }
    return String(value).trim();
  }

  function createLayeredErrorNotice(error, fallbackMessage = "操作失败") {
    const rawUserMessage = cleanDisplayText(error?.message) || cleanDisplayText(fallbackMessage) || "操作失败";
    const userMessage = sanitizeSecretText(rawUserMessage) || cleanDisplayText(fallbackMessage) || "操作失败";
    const technicalDetail = sanitizeSecretText(formatTechnicalErrorDetail(error) || rawUserMessage).slice(0, 4000);
    return {
      userMessage,
      technicalDetail
    };
  }

  function formatTechnicalErrorDetail(error) {
    if (error === undefined || error === null) {
      return "";
    }
    if (typeof error !== "object") {
      return String(error);
    }

    const parts = [];
    if (error.name) {
      parts.push(`name: ${error.name}`);
    }
    if (error.message) {
      parts.push(`message: ${error.message}`);
    }
    if (error.stack) {
      parts.push(`stack:\n${error.stack}`);
    }

    const metadata = {};
    for (const key of Object.keys(error)) {
      metadata[key] = error[key];
    }
    if (Object.keys(metadata).length) {
      parts.push(`metadata:\n${safeStringify(redactSecretMaterial(metadata))}`);
    }

    return parts.join("\n\n");
  }

  function sanitizeSecretText(value) {
    return String(value)
      .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, `$1${SECRET_PLACEHOLDER}`)
      .replace(/\b(Basic\s+)[A-Za-z0-9+/=]+/gi, `$1${SECRET_PLACEHOLDER}`)
      .replace(/\bsk-[A-Za-z0-9._-]+/g, SECRET_PLACEHOLDER)
      .replace(/\b(apiKey|password|token|secret)\b\s*([:=])\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi, (_match, key, separator) => {
        return `${key}${separator}${SECRET_PLACEHOLDER}`;
      });
  }

  function safeStringify(value) {
    const seen = new WeakSet();
    return JSON.stringify(
      value,
      (_key, entry) => {
        if (!entry || typeof entry !== "object") {
          return entry;
        }
        if (seen.has(entry)) {
          return "[Circular]";
        }
        seen.add(entry);
        return entry;
      },
      2
    );
  }

  function describeTarget(target) {
    if (!target || typeof target !== "object") {
      return cleanDisplayText(target) || "未记录";
    }
    return (
      cleanDisplayText(target.text) ||
      cleanDisplayText(target.title) ||
      cleanDisplayText(target.doi) ||
      cleanDisplayText(target.key) ||
      describeKeyValueObject(target)
    );
  }

  function describeEvidence(evidence) {
    if (!evidence || typeof evidence !== "object") {
      return cleanDisplayText(evidence) || "未记录";
    }
    return cleanDisplayText(evidence.text) || describeKeyValueObject(evidence);
  }

  function describeOutputLocation(outputLocation) {
    if (!outputLocation || typeof outputLocation !== "object") {
      return cleanDisplayText(outputLocation) || "未记录";
    }
    return describeKeyValueObject(outputLocation);
  }

  function describeTaskError(errorNotice) {
    if (!errorNotice) {
      return "无";
    }
    if (typeof errorNotice !== "object") {
      return cleanDisplayText(errorNotice) || "无";
    }
    return cleanDisplayText(errorNotice.message) || describeKeyValueObject(errorNotice);
  }

  function describeKeyValueObject(value) {
    const entries = Object.entries(value || {})
      .map(([key, entry]) => [cleanDisplayText(key), cleanDisplayText(entry)])
      .filter(([key, entry]) => key && entry);
    return entries.length ? entries.map(([key, entry]) => `${key}: ${entry}`).join("；") : "未记录";
  }

  function taskTimestamp(task) {
    return task?.completedAt || task?.startedAt || "";
  }

  function parseTimestamp(value) {
    const timestamp = Date.parse(cleanDisplayText(value));
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  function cleanSelectedText(value) {
    return cleanText(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  }

  function createWorkId(paper) {
    if (paper.doi && paper.doi !== "未记录") {
      return `work:doi:${paper.doi}`;
    }
    return `work:zotero:${paper.key || "unknown"}`;
  }

  function createStableTimestamp(value) {
    return value.replace(/[^0-9A-Za-z]+/g, "-").replace(/-$/, "");
  }

  function normalizeRemoteDirectory(value) {
    return cleanText(value)
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "")
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean)
      .join("/");
  }

  function encodeBasicAuth(username, password) {
    const value = `${username}:${password}`;
    if (typeof btoa === "function") {
      return btoa(unescape(encodeURIComponent(value)));
    }
    throw new Error("当前环境不支持 WebDAV 认证编码");
  }

  function cloneSnapshot(snapshot) {
    return JSON.parse(JSON.stringify(snapshot || {}));
  }

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function formatNoteBody(value) {
    return escapeHtml(cleanText(value)).replace(/\r?\n/g, "<br/>");
  }

  function escapeHtml(value) {
    return cleanText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatLocalTime(value) {
    try {
      return new Date(value).toLocaleString("zh-CN", { hour12: false });
    } catch (_error) {
      return value;
    }
  }

  function formatReviewState(value) {
    if (value === "confirmed") return "已确认";
    if (value === "rejected") return "已拒绝";
    return "待复核";
  }

  function formatDuplicateReason(value) {
    if (value === "shared-doi") return "DOI 重复";
    if (value === "shared-zotero-key") return "Zotero 条目键重复";
    if (value === "similar-title") return "标题相似";
    return "可能重复";
  }

  function formatDuplicateConfidence(value) {
    if (value === "high") return "高";
    if (value === "medium") return "中";
    return "低";
  }

  function init() {
    getField("refresh-paper-context").addEventListener("click", refreshSelectedPaper);
    getField("summarize-selected-paper").addEventListener("click", summarizeSelectedPaper);
    getField("translate-reading-context").addEventListener("click", translateReadingContext);
    getField("copy-paper-summary").addEventListener("click", copyGeneratedResult);
    getField("save-paper-summary-note").addEventListener("click", saveGeneratedResultToZoteroNote);
    getField("capture-graph-seed").addEventListener("click", captureGraphSeed);
    getField("export-workbench-state").addEventListener("click", exportWorkbenchState);
    getField("import-workbench-state").addEventListener("click", importWorkbenchState);
    getField("export-workbench-zip").addEventListener("click", exportWorkbenchZip);
    getField("import-workbench-zip").addEventListener("click", importWorkbenchZip);
    getField("webdav-save").addEventListener("click", saveWebDavSettings);
    getField("webdav-test").addEventListener("click", testWebDavConnection);
    getField("webdav-upload-json").addEventListener("click", uploadWorkbenchJsonToWebDav);
    getField("refresh-workbench-records").addEventListener("click", renderWorkbenchRecords);
    getField("refresh-work-identity-inspector").addEventListener("click", renderWorkIdentityInspector);
    getField("refresh-duplicate-work-candidates").addEventListener("click", renderDuplicateWorkCandidates);
    getField("refresh-citation-graph-inspector").addEventListener("click", renderCitationGraphInspector);
    getField("refresh-graph-seed-review").addEventListener("click", renderGraphSeedReviewQueue);
    getField("prompt-template-selector").addEventListener("change", loadPromptTemplateEditor);
    getField("prompt-template-save").addEventListener("click", savePromptTemplateOverride);
    getField("prompt-template-reset").addEventListener("click", resetPromptTemplateOverride);
    initializeSegmentedFilters();
    loadWebDavSettings();
    loadPromptTemplateEditor();
    renderRecentDrafts();
    renderWorkbenchRecords();
    renderGraphSeedReviewQueue();
    refreshSelectedPaper();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.WorkbenchPaperSummary = {
    buildChineseReadingContextTranslationPrompt,
    buildChinesePaperSummaryPrompt,
    buildSummaryCopyText,
    buildWebDavExportRequest,
    buildWebDavDirectoryRequests,
    buildZoteroNoteHtml,
    assertLlmRuntimeRequestAllowed,
    captureGraphSeed,
    createLlmRuntimeGuard,
    createWorkbenchExportPackage,
    createGraphSeedInput,
    createReadingTranslationDraftInput,
    createSummaryDraftInput,
    copyGeneratedResult,
    exportWorkbenchState,
    exportWorkbenchZip,
    estimatePromptTokens,
    importWorkbenchExportPackage,
    importWorkbenchState,
    importWorkbenchZip,
    createWorkbenchZipExportPayload,
    importWorkbenchZipExportPayload,
    listDuplicateWorkCandidates,
    listDuplicateWorkCandidateEvidence,
    listCitationRelationsForInspector,
    listGraphSeedsForReview,
    listWorkIdentitiesForInspector,
    listRecentGraphSeeds,
    listRecentSummaryDrafts,
    listRecentTaskLedger,
    loadWorkbenchSnapshot,
    loadDraftIntoSummaryReader,
    loadRecentDraft,
    loadWebDavSettings,
    normalizeWebDavExportTarget,
    normalizePaperContext,
    parseChatCompletionText,
    readSelectedPaperContext,
    readSelectedPaperPdfAttachment,
    renderRecentDrafts,
    renderGraphSeedReviewQueue,
    initializeSegmentedFilters,
    promoteGraphSeed,
    resolvePromptTemplate,
    requestReadingContextTranslation,
    requestPaperSummary,
    requestWebDav,
    readZipExportFile,
    saveGeneratedResultToZoteroNote,
    saveReadingTranslationDraft,
    saveWebDavSettings,
    saveSummaryDraft,
    savePromptTemplateOverride,
    selectBestPdfAttachment,
    testWebDavConnection,
    WorkbenchLocalStoreTransaction,
    uploadWorkbenchJsonToWebDav,
    writeZipExportFile
  };
})();
