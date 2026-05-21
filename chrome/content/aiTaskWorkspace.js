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
    const snapshot = WorkbenchLocalStore.loadSnapshot();
    const paper = await selectedPaperRuntime.readSelectedPaperContext();
    const provider = readProviderSettings();
    const result = ResearchPanelOrchestrator.createAiTaskWorkspacePlanWorkflow({
      snapshot,
      requestText: getField("ai-job-request").value,
      selectedPapers: [paper],
      provider: { id: "openai-compatible", model: provider.model },
      concurrencyLimit: getField("ai-job-concurrency-limit").value,
      createdAt: new Date().toISOString()
    });
    currentPlan = result.plan;
    currentJobId = result.plan.job.id;
    WorkbenchLocalStore.saveSnapshot(result.snapshot);
    renderAiTaskWorkspace(result.records.aiTaskWorkspace);
    getField("ai-job-confirm-start").disabled = false;
  }

  async function confirmAndRunAiJob() {
    if (!currentPlan || !currentJobId) {
      return;
    }
    const confirmed = ResearchPanelOrchestrator.confirmAiTaskWorkspacePlanWorkflow({
      snapshot: WorkbenchLocalStore.loadSnapshot(),
      jobId: currentJobId,
      confirmedAt: new Date().toISOString()
    });
    WorkbenchLocalStore.saveSnapshot(confirmed.snapshot);
    currentQueueAbort = false;
    renderAiTaskWorkspace(confirmed.records.aiTaskWorkspace);
    const queueResult = await WorkbenchAiTaskWorkspace.runAiTaskQueue({
      job: confirmed.snapshot.aiJobs.find((job) => job.id === currentJobId),
      tasks: confirmed.snapshot.aiTasks.filter((task) => task.jobId === currentJobId),
      executeTask: runOpenAICompatibleSummaryTask,
      now: () => new Date().toISOString()
    });
    if (currentQueueAbort) {
      return;
    }
    const recorded = ResearchPanelOrchestrator.recordAiTaskWorkspaceQueueResultWorkflow({
      snapshot: WorkbenchLocalStore.loadSnapshot(),
      queueResult,
      recordedAt: new Date().toISOString()
    });
    WorkbenchLocalStore.saveSnapshot(recorded.snapshot);
    renderAiTaskWorkspace(recorded.records.aiTaskWorkspace);
  }

  function pauseCurrentAiJob() {
    currentQueueAbort = true;
    renderStatus("任务已暂停，重新打开后需要手动继续");
  }

  function resumeCurrentAiJob() {
    currentQueueAbort = false;
    renderStatus("请确认后继续任务");
    getField("ai-job-confirm-start").disabled = false;
  }

  function cancelCurrentAiJob() {
    currentQueueAbort = true;
    renderStatus("任务已取消");
  }

  async function runOpenAICompatibleSummaryTask(task) {
    const provider = readProviderSettings();
    const prompt = [
      "请用中文为下面这篇 Zotero 文献生成研究阅读摘要。",
      "",
      `用户任务：${task.inputScope.requestText}`,
      `标题：${task.inputScope.title || "未命名条目"}`,
      `作者：${task.inputScope.authors || "未记录"}`,
      `年份：${task.inputScope.year || "未记录"}`,
      `期刊/来源：${task.inputScope.publicationTitle || "未记录"}`,
      `DOI：${task.inputScope.doi || "未记录"}`,
      `摘要：${task.inputScope.abstractNote || "未记录摘要"}`,
      "",
      "要求：不要编造原始记录未提供的信息。"
    ].join("\n");
    const content = await WorkbenchProviderChatCompletion.requestOpenAICompatibleChatCompletion({
      settings: provider,
      prompt,
      temperature: 0.2,
      fetchImpl: window.fetch.bind(window),
      failureMessage: "AI 任务请求失败"
    });
    return { content };
  }

  function readProviderSettings() {
    return {
      baseUrl: getPref(PREFS.baseUrl),
      apiKey: getPref(PREFS.apiKey),
      model: getPref(PREFS.model)
    };
  }

  function renderAiTaskWorkspace(readModel) {
    const model = readModel || WorkbenchAiTaskWorkspace.createAiTaskWorkspaceReadModel(WorkbenchLocalStore.loadSnapshot());
    renderStatus(model.activeJob ? `当前任务：${model.activeJob.state}` : "尚未创建任务");
    renderPlanPreview(model.activeJob);
    renderQueue(model.activeTasks || []);
    renderResumeList(model.resumableJobs || []);
    getField("ai-job-pause").disabled = !model.activeJob || model.activeJob.state !== "running";
    getField("ai-job-resume").disabled = !model.activeJob || !model.activeJob.resumeRequired;
    getField("ai-job-cancel").disabled =
      !model.activeJob || ["completed", "completed-with-skips", "failed", "cancelled"].includes(model.activeJob.state);
  }

  function renderStatus(text) {
    getField("ai-job-progress").textContent = text;
  }

  function renderPlanPreview(job) {
    const container = getField("ai-job-plan-preview");
    container.replaceChildren();
    const item = createHtmlElement("div");
    item.className = "record-item";
    item.textContent = job
      ? `计划预览：${job.discoveryScope?.itemCount || 0} 个任务 · 服务商 ${job.provider?.id || "未记录"} · 模型 ${job.provider?.model || "未记录"}`
      : "计划预览：暂无任务计划";
    container.append(item);
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
      item.textContent = `${task.source?.title || task.id} · ${task.state}`;
      container.append(item);
    }
    getField("ai-task-queue-summary").textContent =
      `成功 ${tasks.filter((task) => task.state === "succeeded").length} · ` +
      `跳过 ${tasks.filter((task) => task.state === "skipped").length} · ` +
      `失败 ${tasks.filter((task) => task.state === "failed").length}`;
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
      listRecentSummaryDrafts: () => [],
      listRecentTaskLedger: () => []
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
