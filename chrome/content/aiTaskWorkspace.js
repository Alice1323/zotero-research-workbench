(function () {
  const WorkbenchAiTaskWorkspace = window.WorkbenchAiTaskWorkspace;
  if (!WorkbenchAiTaskWorkspace) {
    throw new Error("WorkbenchAiTaskWorkspace runtime Module is unavailable");
  }
  const WorkbenchLocalStoreTransaction = window.WorkbenchLocalStoreTransaction;
  if (!WorkbenchLocalStoreTransaction) {
    throw new Error("WorkbenchLocalStoreTransaction runtime Module is unavailable");
  }
  const WorkbenchResearchPanelOrchestrator = window.WorkbenchResearchPanelOrchestrator;
  if (!WorkbenchResearchPanelOrchestrator) {
    throw new Error("WorkbenchResearchPanelOrchestrator runtime Module is unavailable");
  }
  const WorkbenchProviderChatCompletion = window.WorkbenchProviderChatCompletion;
  if (!WorkbenchProviderChatCompletion) {
    throw new Error("WorkbenchProviderChatCompletion runtime Module is unavailable");
  }
  const WorkbenchRuntimeStore = window.WorkbenchRuntimeStore;
  if (!WorkbenchRuntimeStore) {
    throw new Error("WorkbenchRuntimeStore runtime Module is unavailable");
  }
  const WorkbenchSelectedPaperRuntime = window.WorkbenchSelectedPaperRuntime;
  if (!WorkbenchSelectedPaperRuntime) {
    throw new Error("WorkbenchSelectedPaperRuntime runtime Module is unavailable");
  }

  const PREFS = {
    baseUrl: "extensions.zotero-research-workbench.provider.baseUrl",
    apiKey: "extensions.zotero-research-workbench.provider.apiKey",
    model: "extensions.zotero-research-workbench.provider.model",
    snapshot: "extensions.zotero-research-workbench.store.snapshot"
  };
  const HTML_NS = "http://www.w3.org/1999/xhtml";
  let currentPlan = null;
  let currentJobId = "";
  let currentQueueAbort = false;
  let currentAbortController = null;

  const ResearchPanelOrchestrator = WorkbenchResearchPanelOrchestrator.createResearchPanelOrchestrator({
    aiTaskWorkspaceModule: WorkbenchAiTaskWorkspace,
    transactionModule: WorkbenchLocalStoreTransaction,
    paperSummaryModule: createPaperSummaryReadModelAdapter(),
    graphReviewWorkflowModule: window.WorkbenchGraphReviewWorkflow
  });

  function createHtmlElement(tagName) {
    return document.createElementNS(HTML_NS, tagName);
  }

  function getField(id) {
    return document.getElementById(id);
  }

  function getZotero() {
    return window.arguments?.[0]?.Zotero || window.opener?.Zotero || window.Zotero;
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

  const WorkbenchLocalStore = WorkbenchRuntimeStore.createWorkbenchRuntimeStore({
    getPref,
    setPref,
    snapshotPrefKey: PREFS.snapshot
  });

  const selectedPaperRuntime = WorkbenchSelectedPaperRuntime.createBrowserSelectedPaperRuntime({
    getZotero,
    console: window.console
  });

  async function createDraftAiJobPlan() {
    try {
      const snapshot = WorkbenchLocalStore.loadSnapshot();
      const papers = await selectedPaperRuntime.readSelectedPaperContexts();
      const provider = readProviderSettings();
      const requestText = getField("ai-job-request").value;
      const taskClassification = await classifyAiTaskRequest({ requestText, papers, provider });
      const result = ResearchPanelOrchestrator.createAiTaskWorkspacePlanWorkflow({
        snapshot,
        requestText,
        selectedPapers: papers,
        taskClassification,
        provider: { id: "openai-compatible", model: provider.model },
        concurrencyLimit: getField("ai-job-concurrency-limit").value,
        createdAt: new Date().toISOString()
      });
      currentPlan = result.plan;
      currentJobId = result.plan.job.id;
      WorkbenchLocalStore.saveSnapshot(result.snapshot);
      renderAiTaskWorkspace(result.records.aiTaskWorkspace);
      getField("ai-job-confirm-start").disabled = false;
    } catch (error) {
      getField("ai-job-confirm-start").disabled = true;
      renderStatus(`AI 任务计划生成失败：${error?.userMessage || error?.message || "未知错误"}`);
    }
  }

  async function classifyAiTaskRequest({ requestText, papers, provider } = {}) {
    const localClassification = WorkbenchAiTaskWorkspace.classifyCurrentSelectionTaskRequest({
      requestText,
      selectedPaperCount: Array.isArray(papers) ? papers.length : 0
    });
    if (localClassification.taskMode !== "needs-ai-classification") {
      return localClassification;
    }
    return requestAiTaskClassification({ requestText, papers, provider });
  }

  async function requestAiTaskClassification({ requestText, papers, provider } = {}) {
    const content = await WorkbenchProviderChatCompletion.requestOpenAICompatibleChatCompletion({
      settings: provider,
      prompt: buildAiTaskClassificationPrompt({ requestText, papers }),
      temperature: 0,
      maxTokens: 500,
      fetchImpl: window.fetch.bind(window),
      failureMessage: "AI 任务类型识别失败"
    });
    return parseAiTaskClassificationResponse(content);
  }

  function buildAiTaskClassificationPrompt({ requestText, papers } = {}) {
    const selectedPapers = Array.isArray(papers) ? papers : [];
    return [
      "你是 Zotero 研究工作台的任务类型分类器。",
      "请判断用户当前选中文献任务应该如何执行。",
      "",
      "可选 taskMode：",
      "- per-paper-summary：用户想要分别、逐篇、每篇、各自总结或翻译。",
      "- multi-paper-commonality-note：用户想要共同点、共通点、比较、对比、综合、关系、归纳，或适合把多篇文献作为一组生成独立研究笔记。",
      "",
      "判断规则：",
      "1. 如果用户明确要求逐篇、分别、每篇或单独处理，选择 per-paper-summary。",
      "2. 如果用户要求共同点、共性、比较、对比、综合、关系或同一组阅读理由，选择 multi-paper-commonality-note。",
      "3. 如果用户只说“总结这些文献”且选择了多篇文献，请结合文献标题和摘要判断：更像一个研究主题集合时选择 multi-paper-commonality-note；更像批量处理清单时选择 per-paper-summary。",
      "4. 不要执行总结任务，只判断任务类型。",
      "",
      "只输出 JSON，不要输出 Markdown 或解释文字。JSON 格式：",
      "{\"taskMode\":\"per-paper-summary|multi-paper-commonality-note\",\"confidence\":0.0,\"reason\":\"一句中文原因\"}",
      "",
      `用户任务：${cleanText(requestText)}`,
      `选中文献数量：${selectedPapers.length}`,
      "",
      "选中文献：",
      selectedPapers.map(formatClassificationPaper).join("\n\n")
    ].join("\n");
  }

  function parseAiTaskClassificationResponse(content) {
    const parsed = parseJsonObjectFromText(content);
    const taskMode = cleanText(parsed.taskMode);
    if (!["per-paper-summary", "multi-paper-commonality-note"].includes(taskMode)) {
      throw new Error("任务类型识别失败：AI 未返回可用的 taskMode");
    }
    return {
      taskMode,
      source: "llm-classifier",
      confidence: normalizeConfidence(parsed.confidence),
      reason: cleanText(parsed.reason) || "AI 未提供判断原因"
    };
  }

  function parseJsonObjectFromText(text) {
    const normalized = cleanText(text);
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("任务类型识别失败：AI 未输出 JSON");
    }
    try {
      return JSON.parse(normalized.slice(start, end + 1));
    } catch (_error) {
      throw new Error("任务类型识别失败：AI 输出的 JSON 无法解析");
    }
  }

  function normalizeConfidence(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0.5;
    }
    return Math.max(0, Math.min(1, Math.round(numeric * 100) / 100));
  }

  function formatClassificationPaper(paper, index) {
    return [
      `文献 ${index + 1}`,
      `标题：${paper?.title || "未命名条目"}`,
      `作者：${paper?.authors || "未记录"}`,
      `年份：${paper?.year || "未记录"}`,
      `期刊/来源：${paper?.publicationTitle || "未记录"}`,
      `摘要：${paper?.abstractNote || "未记录摘要"}`
    ].join("\n");
  }

  async function confirmAndRunAiJob() {
    if (!currentPlan || !currentJobId) {
      return;
    }
    try {
      const confirmed = ResearchPanelOrchestrator.confirmAiTaskWorkspacePlanWorkflow({
        snapshot: WorkbenchLocalStore.loadSnapshot(),
        jobId: currentJobId,
        confirmedAt: new Date().toISOString()
      });
      WorkbenchLocalStore.saveSnapshot(confirmed.snapshot);
      currentQueueAbort = false;
      currentAbortController = typeof AbortController !== "undefined" ? new AbortController() : null;
      renderAiTaskWorkspace(confirmed.records.aiTaskWorkspace);
      const queueResult = await WorkbenchAiTaskWorkspace.runAiTaskQueue({
        job: confirmed.snapshot.aiJobs.find((job) => job.id === currentJobId),
        tasks: confirmed.snapshot.aiTasks.filter((task) => task.jobId === currentJobId),
        executeTask: runOpenAICompatibleSummaryTask,
        shouldPause: () => currentQueueAbort,
        onProgress: (progress) => {
          renderAiTaskWorkspace(createQueueProgressReadModel(progress));
        },
        now: () => new Date().toISOString()
      });
      const recorded = ResearchPanelOrchestrator.recordAiTaskWorkspaceQueueResultWorkflow({
        snapshot: WorkbenchLocalStore.loadSnapshot(),
        queueResult,
        recordedAt: new Date().toISOString()
      });
      WorkbenchLocalStore.saveSnapshot(recorded.snapshot);
      renderAiTaskWorkspace(recorded.records.aiTaskWorkspace);
      renderRecentDraftsFromPaperSummary();
      loadCreatedAiTaskDraft(recorded);
    } catch (error) {
      renderStatus(`AI 任务执行失败：${error?.userMessage || error?.message || "未知错误"}`);
    } finally {
      currentAbortController = null;
    }
  }

  function pauseCurrentAiJob() {
    currentQueueAbort = true;
    if (currentAbortController?.abort) {
      currentAbortController.abort();
    }
    renderStatus("任务已暂停，重新打开后需要手动继续");
  }

  function resumeCurrentAiJob() {
    currentQueueAbort = false;
    renderStatus("请确认后继续任务");
    getField("ai-job-confirm-start").disabled = false;
  }

  function cancelCurrentAiJob() {
    currentQueueAbort = true;
    if (currentAbortController?.abort) {
      currentAbortController.abort();
    }
    renderStatus("任务已取消");
  }

  async function runOpenAICompatibleSummaryTask(task) {
    const provider = readProviderSettings();
    const prompt =
      task.taskType === "multi-paper-commonality-note"
        ? buildMultiPaperCommonalityPrompt(task)
        : buildSinglePaperSummaryPrompt(task);
    const content = await WorkbenchProviderChatCompletion.requestOpenAICompatibleChatCompletion({
      settings: provider,
      prompt,
      temperature: 0.2,
      fetchImpl: window.fetch.bind(window),
      signal: currentAbortController?.signal,
      failureMessage: "AI 任务请求失败"
    });
    return {
      title: task.taskType === "multi-paper-commonality-note" ? createCommonalityResultTitle(task) : "",
      content
    };
  }

  function buildMultiPaperCommonalityPrompt(task) {
    const papers = Array.isArray(task.inputScope?.selectedPapers) ? task.inputScope.selectedPapers : [];
    return [
      "请把下面多篇 Zotero 文献作为一个整体来分析，找出它们的共通点，并输出一篇可以单独保存的中文研究笔记。",
      "",
      `用户任务：${task.inputScope?.requestText || ""}`,
      "",
      "必须做的事：",
      "1. 不要逐篇翻译或逐篇摘要。",
      "2. 先比较这些文献，再提炼共同研究主题、共同概念或机制、方法/对象/数据交集、趋同发现、差异或张力。",
      "3. 解释为什么这些文献可以被放进同一组阅读。",
      "4. 输出一个笔记标题和结构化正文。",
      "5. 不要编造原始记录未提供的信息；证据不足时明确写“原始记录未提供”。",
      "",
      "输出格式：",
      "标题：共同点笔记：...",
      "",
      "## 共同研究主题",
      "## 共享概念与机制",
      "## 方法、对象或数据交集",
      "## 趋同发现",
      "## 差异、张力与边界",
      "## 为什么它们属于同一组",
      "## 后续阅读问题",
      "",
      "文献集合：",
      papers.map(formatCommonalityPaper).join("\n\n")
    ].join("\n");
  }

  function buildSinglePaperSummaryPrompt(task) {
    return [
      "请用中文为下面这篇 Zotero 文献生成研究阅读摘要。",
      "",
      `用户任务：${task.inputScope?.requestText || ""}`,
      `标题：${task.inputScope?.title || "未命名条目"}`,
      `作者：${task.inputScope?.authors || "未记录"}`,
      `年份：${task.inputScope?.year || "未记录"}`,
      `期刊/来源：${task.inputScope?.publicationTitle || "未记录"}`,
      `DOI：${task.inputScope?.doi || "未记录"}`,
      `摘要：${task.inputScope?.abstractNote || "未记录摘要"}`,
      "",
      "要求：不要编造原始记录未提供的信息。"
    ].join("\n");
  }

  function formatCommonalityPaper(paper, index) {
    return [
      `文献 ${index + 1}`,
      `标题：${paper.title || "未命名条目"}`,
      `作者：${paper.authors || "未记录"}`,
      `年份：${paper.year || "未记录"}`,
      `期刊/来源：${paper.publicationTitle || "未记录"}`,
      `DOI：${paper.doi || "未记录"}`,
      `摘要：${paper.abstractNote || "未记录摘要"}`
    ].join("\n");
  }

  function createCommonalityResultTitle(task) {
    const papers = Array.isArray(task.inputScope?.selectedPapers) ? task.inputScope.selectedPapers : [];
    return papers.length ? `共同点笔记：${papers.map((paper) => paper.title).filter(Boolean).slice(0, 2).join(" / ")}` : "共同点笔记";
  }

  function readProviderSettings() {
    return {
      baseUrl: getPref(PREFS.baseUrl),
      apiKey: getPref(PREFS.apiKey),
      model: getPref(PREFS.model)
    };
  }

  function cleanText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function renderAiTaskWorkspace(readModel) {
    const model = readModel || WorkbenchAiTaskWorkspace.createAiTaskWorkspaceReadModel(WorkbenchLocalStore.loadSnapshot());
    renderStatus(model.activeJob ? `当前任务：${formatAiJobStateLabel(model.activeJob.state)}` : "尚未创建任务");
    renderPlanPreview(model.activeJob);
    renderQueue(model.activeTasks || []);
    renderAiTaskResults(model.activeResults || [], model.activeSkips || [], model.activeFailures || []);
    renderAiTaskDiagnoses(model.activeDiagnoses || []);
    renderResumeList(model.resumableJobs || []);
    getField("ai-job-pause").disabled = !model.activeJob || model.activeJob.state !== "running";
    getField("ai-job-resume").disabled = !model.activeJob || !model.activeJob.resumeRequired;
    getField("ai-job-cancel").disabled =
      !model.activeJob || ["completed", "completed-with-skips", "failed", "cancelled"].includes(model.activeJob.state);
  }

  function renderStatus(text) {
    getField("ai-job-progress").textContent = text;
  }

  function formatAiJobStateLabel(state) {
    const labels = {
      draft: "待确认",
      confirmed: "已确认",
      running: "运行中",
      paused: "已暂停",
      completed: "已完成",
      "completed-with-skips": "已完成（含跳过）",
      failed: "失败",
      cancelled: "已取消"
    };
    return labels[state] || state || "未知";
  }

  function formatAiTaskStateLabel(state) {
    const labels = {
      queued: "待执行",
      running: "运行中",
      retrying: "重试中",
      succeeded: "已完成",
      skipped: "已跳过",
      failed: "失败",
      cancelled: "已取消"
    };
    return labels[state] || state || "未知";
  }

  function renderPlanPreview(job) {
    const container = getField("ai-job-plan-preview");
    container.replaceChildren();
    const item = createHtmlElement("div");
    item.className = "record-item";
    item.textContent = job ? formatPlanPreviewText(job) : "计划预览：暂无任务计划";
    container.append(item);
  }

  function formatPlanPreviewText(job) {
    const taskMode = cleanText(job.taskClassification?.taskMode || job.taskMode);
    const isPerPaperSummary = taskMode === "per-paper-summary";
    const taskLabel = isPerPaperSummary ? "逐篇总结任务" : "共同点笔记任务";
    const recognizedLabel = isPerPaperSummary ? "逐篇总结" : "共同点综合";
    const sourceLabel = job.taskClassification?.source === "llm-classifier" ? "AI 识别" : "本地识别";
    const confidence =
      typeof job.taskClassification?.confidence === "number" ? `，置信度 ${job.taskClassification.confidence}` : "";
    const reason = cleanText(job.taskClassification?.reason);
    return [
      `计划预览：${job.discoveryScope?.itemCount || 0} 篇文献`,
      `识别为：${recognizedLabel}（${sourceLabel}${confidence}）`,
      `${job.expectedSideEffects?.providerCalls || 0} 个${taskLabel}`,
      `服务商 ${job.provider?.id || "未记录"}`,
      `模型 ${job.provider?.model || "未记录"}`,
      reason ? `原因：${reason}` : ""
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function renderQueue(tasks) {
    const container = getField("ai-task-queue-list");
    container.replaceChildren();
    if (!tasks.length) {
      const empty = createHtmlElement("div");
      empty.className = "record-item";
      empty.textContent = "暂无任务队列";
      container.append(empty);
      getField("ai-task-queue-summary").textContent = "成功 0 · 跳过 0 · 失败 0";
      return;
    }
    for (const task of tasks) {
      const item = createHtmlElement("div");
      item.className = "record-item";
      item.textContent = `${formatTaskTitle(task)} · ${formatAiTaskStateLabel(task.state)}`;
      container.append(item);
    }
    getField("ai-task-queue-summary").textContent =
      `成功 ${tasks.filter((task) => task.state === "succeeded").length} · ` +
      `跳过 ${tasks.filter((task) => task.state === "skipped").length} · ` +
      `失败 ${tasks.filter((task) => task.state === "failed").length}`;
  }

  function renderAiTaskResults(results, skips, failures) {
    const container = getField("ai-task-results-list");
    container.replaceChildren();
    const rows = [
      ...results.map((result) => ({ kind: "result", entry: result })),
      ...skips.map((skip) => ({ kind: "skip", entry: skip })),
      ...failures.map((failure) => ({ kind: "failure", entry: failure }))
    ];
    if (!rows.length) {
      const empty = createHtmlElement("div");
      empty.className = "record-item";
      empty.textContent = "暂无任务生成结果";
      container.append(empty);
      getField("ai-task-results-summary").textContent = "结果 0";
      return;
    }
    for (const row of rows) {
      const item = createHtmlElement("div");
      item.className = "record-item";
      item.textContent = formatAiTaskResultRow(row);
      container.append(item);
    }
    getField("ai-task-results-summary").textContent =
      `结果 ${results.length} · 跳过 ${skips.length} · 失败 ${failures.length}`;
  }

  function formatAiTaskResultRow(row) {
    const entry = row.entry || {};
    if (row.kind === "result") {
      return `${entry.title || entry.source?.title || entry.taskId || "任务"}\n${entry.content || "无生成内容"}`;
    }
    if (row.kind === "skip") {
      return `${entry.source?.title || entry.taskId || "任务"} · 已跳过\n${entry.reason || "未记录原因"}`;
    }
    return `${entry.sourceTitle || entry.taskId || "任务"} · 失败\n${entry.errorReason || "未记录原因"}`;
  }

  function formatTaskTitle(task) {
    if (task.taskType === "multi-paper-commonality-note") {
      return task.source?.title || `共同点笔记（${task.source?.itemCount || 0} 篇）`;
    }
    return task.source?.title || task.id;
  }

  function renderRecentDraftsFromPaperSummary() {
    if (window.WorkbenchPaperSummary?.renderRecentDrafts) {
      window.WorkbenchPaperSummary.renderRecentDrafts();
    }
  }

  function loadCreatedAiTaskDraft(recorded) {
    const draftId = Array.isArray(recorded?.createdDraftIds) ? recorded.createdDraftIds[0] : "";
    if (!draftId || !window.WorkbenchPaperSummary?.loadDraftIntoSummaryReader) {
      return;
    }
    const draft = (recorded.snapshot?.researchNoteDrafts || []).find((entry) => entry?.id === draftId);
    if (!draft) {
      return;
    }
    const isCommonalityDraft = draft.promptTaskTemplateId === "multi-paper-commonality-note";
    window.WorkbenchPaperSummary.loadDraftIntoSummaryReader(draft, {
      statusMessage: isCommonalityDraft ? "已自动载入共同点笔记草稿，可确认写入 Zotero 笔记" : "已自动载入任务生成草稿",
      draftStatusPrefix: isCommonalityDraft ? "已自动保存为共同点笔记草稿" : "已自动保存为任务草稿"
    });
  }

  function renderAiTaskDiagnoses(diagnoses) {
    const container = getField("ai-job-diagnosis");
    if (!diagnoses.length) {
      container.setAttribute("hidden", "hidden");
      container.replaceChildren();
      const empty = createHtmlElement("div");
      empty.className = "record-item";
      empty.textContent = "失败诊断：暂无";
      container.append(empty);
      return;
    }
    container.removeAttribute("hidden");
    container.replaceChildren();
    for (const diagnosis of diagnoses) {
      const item = createHtmlElement("div");
      item.className = "record-item";
      item.textContent = diagnosis.userMessage || diagnosis.reason || "失败诊断：未记录原因";
      container.append(item);
    }
  }

  function renderResumeList(jobs) {
    const container = getField("ai-job-resume-list");
    container.replaceChildren();
    const rows = jobs.length ? jobs : [{ requestText: "暂无可继续任务" }];
    for (const job of rows) {
      const item = createHtmlElement("div");
      item.className = "record-item";
      item.textContent = job.requestText || job.id;
      container.append(item);
    }
  }

  function createPaperSummaryReadModelAdapter() {
    return {
      buildZoteroNoteHtml: () => "",
      createReadingTranslationDraftInput: () => ({}),
      createSummaryDraftInput: () => ({}),
      listRecentGraphSeeds: () => [],
      listRecentSummaryDrafts: (snapshot) =>
        (Array.isArray(snapshot?.researchNoteDrafts) ? snapshot.researchNoteDrafts : [])
          .filter((draft) => draft?.confirmationState === "draft")
          .slice()
          .sort((left, right) => Date.parse(right.createdAt || "") - Date.parse(left.createdAt || "")),
      listRecentTaskLedger: () => []
    };
  }

  function createQueueProgressReadModel(progress) {
    const job = progress?.job || null;
    return {
      activeJob: job,
      activeTasks: Array.isArray(progress?.tasks) ? progress.tasks : [],
      activeResults: Array.isArray(progress?.results) ? progress.results : [],
      activeFailures: Array.isArray(progress?.failures) ? progress.failures : [],
      activeSkips: Array.isArray(progress?.skips) ? progress.skips : [],
      activeDiagnoses: Array.isArray(progress?.diagnoses) ? progress.diagnoses : [],
      resumableJobs: job?.resumeRequired ? [job] : []
    };
  }

  window.addEventListener("DOMContentLoaded", () => {
    getField("ai-job-create-plan").addEventListener("click", createDraftAiJobPlan);
    getField("ai-job-confirm-start").addEventListener("click", confirmAndRunAiJob);
    getField("ai-job-pause").addEventListener("click", pauseCurrentAiJob);
    getField("ai-job-resume").addEventListener("click", resumeCurrentAiJob);
    getField("ai-job-cancel").addEventListener("click", cancelCurrentAiJob);
    renderAiTaskWorkspace();
  });
})();
