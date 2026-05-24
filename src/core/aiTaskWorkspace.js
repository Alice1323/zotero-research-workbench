(function () {
const ProviderRequestPolicy =
  typeof require === "function"
    ? require("./providerRequestPolicy")
    : typeof window !== "undefined"
      ? window.WorkbenchProviderRequestPolicy
      : null;

const { normalizeProviderConcurrencyLimit: normalizeConcurrencyLimit } = ProviderRequestPolicy || {
  normalizeProviderConcurrencyLimit: (value) => Math.min(8, Math.max(1, Math.round(Number(value) || 1)))
};

const AI_JOB_STATES = {
  draft: "draft",
  confirmed: "confirmed",
  running: "running",
  paused: "paused",
  completed: "completed",
  completedWithSkips: "completed-with-skips",
  failed: "failed",
  cancelled: "cancelled"
};

const AI_TASK_STATES = {
  queued: "queued",
  running: "running",
  retrying: "retrying",
  succeeded: "succeeded",
  skipped: "skipped",
  failed: "failed",
  cancelled: "cancelled"
};

const TASK_MODES = {
  commonality: "multi-paper-commonality-note",
  perPaperSummary: "per-paper-summary",
  needsAiClassification: "needs-ai-classification"
};

function createCurrentSelectionAiJobPlan({
  requestText,
  selectedPapers,
  provider,
  concurrencyLimit,
  createdAt,
  taskClassification
} = {}) {
  const normalizedRequest = cleanText(requestText);
  if (!normalizedRequest) {
    throw new Error("任务需求不能为空");
  }
  const papers = Array.isArray(selectedPapers) ? selectedPapers.filter((paper) => cleanText(paper?.key || paper?.title)) : [];
  if (!papers.length) {
    throw new Error("当前选择中没有可执行的文献");
  }
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  const jobId = `ai-job-${createStableTimestamp(timestamp)}`;
  const normalizedProvider = {
    id: cleanText(provider?.id) || "default-provider",
    model: cleanText(provider?.model) || "未记录"
  };
  const classification = normalizeTaskClassification(
    taskClassification || classifyCurrentSelectionTaskRequest({ requestText: normalizedRequest, selectedPaperCount: papers.length })
  );
  const tasks =
    classification.taskMode === TASK_MODES.perPaperSummary
      ? createPerPaperSummaryTasks({ papers, jobId, normalizedRequest, normalizedProvider, timestamp })
      : createCommonalityTasks({ papers, jobId, normalizedRequest, normalizedProvider, timestamp });
  const limit = Math.min(normalizeConcurrencyLimit(concurrencyLimit), tasks.length);
  return {
    job: {
      id: jobId,
      state: AI_JOB_STATES.draft,
      requestText: normalizedRequest,
      taskMode: classification.taskMode,
      taskClassification: classification,
      discoveryScope: { kind: "current-selection", itemCount: papers.length },
      provider: normalizedProvider,
      providerConcurrencyLimit: limit,
      expectedSideEffects: {
        providerCalls: tasks.length,
        workbenchLocalStoreWrites: true,
        zoteroNativeWrites: 0,
        documentImports: 0,
        externalDiscovery: false
      },
      createdAt: timestamp,
      confirmedAt: null,
      startedAt: null,
      completedAt: null,
      resumeRequired: false
    },
    tasks,
    confirmation: {
      required: true,
      confirmedAt: null,
      summary: createTaskPlanConfirmationSummary({
        paperCount: papers.length,
        taskCount: tasks.length,
        classification,
        provider: normalizedProvider
      })
    }
  };
}

function classifyCurrentSelectionTaskRequest({ requestText, selectedPaperCount } = {}) {
  const text = cleanText(requestText).toLowerCase();
  const count = Number(selectedPaperCount) || 0;
  if (matchesAny(text, [/共同点/, /共通点/, /共性/, /相同/, /共同主题/, /综合/, /比较/, /对比/, /关系/, /关联/, /放在同一组/, /归纳/])) {
    return {
      taskMode: TASK_MODES.commonality,
      source: "local-keyword",
      confidence: 0.9,
      reason: "用户请求包含共同点、共性、综合、比较或关系类表达"
    };
  }
  if (matchesAny(text, [/分别/, /逐篇/, /每篇/, /每一篇/, /一篇一篇/, /各自/, /单独/, /individual/, /separate/, /one by one/])) {
    return {
      taskMode: TASK_MODES.perPaperSummary,
      source: "local-keyword",
      confidence: 0.9,
      reason: "用户请求包含分别、逐篇、每篇或一篇一篇类表达"
    };
  }
  if (count <= 1) {
    return {
      taskMode: TASK_MODES.perPaperSummary,
      source: "single-selection-default",
      confidence: 0.8,
      reason: "当前只选择了一篇文献，默认按单篇总结处理"
    };
  }
  return {
    taskMode: TASK_MODES.needsAiClassification,
    source: "needs-ai-classification",
    confidence: 0.3,
    reason: "请求未明确说明逐篇处理或共同点综合，需要 AI 判断任务类型"
  };
}

function createCommonalityTasks({ papers, jobId, normalizedRequest, normalizedProvider, timestamp }) {
  const selectedPaperInputs = papers.map(normalizeSelectedPaperForTask);
  return [
    createTaskBase({
      id: `${jobId}-task-001`,
      jobId,
      taskType: "multi-paper-commonality-note",
      source: {
        kind: "zotero-current-selection-set",
        itemCount: selectedPaperInputs.length,
        title: `选中文献共同点笔记（${selectedPaperInputs.length} 篇）`,
        zoteroItemKeys: selectedPaperInputs.map((paper) => paper.zoteroItemKey).filter(Boolean),
        titles: selectedPaperInputs.map((paper) => paper.title).filter(Boolean)
      },
      inputScope: {
        requestText: normalizedRequest,
        selectedPapers: selectedPaperInputs
      },
      promptTemplateId: "multi-paper-commonality-note",
      normalizedProvider,
      timestamp
    })
  ];
}

function createPerPaperSummaryTasks({ papers, jobId, normalizedRequest, normalizedProvider, timestamp }) {
  return papers.map((paper, index) => {
    const normalized = normalizeSelectedPaperForTask(paper);
    return createTaskBase({
      id: `${jobId}-task-${String(index + 1).padStart(3, "0")}`,
      jobId,
      taskType: "single-paper-summary",
      source: {
        kind: "zotero-current-selection",
        zoteroItemKey: normalized.zoteroItemKey,
        title: normalized.title,
        doi: normalized.doi
      },
      inputScope: {
        requestText: normalizedRequest,
        title: normalized.title,
        authors: normalized.authors,
        year: normalized.year,
        publicationTitle: normalized.publicationTitle,
        abstractNote: normalized.abstractNote,
        doi: normalized.doi
      },
      promptTemplateId: "single-paper-chinese-summary",
      normalizedProvider,
      timestamp
    });
  });
}

function createTaskBase({
  id,
  jobId,
  taskType,
  source,
  inputScope,
  promptTemplateId,
  normalizedProvider,
  timestamp
}) {
  return {
    id,
    jobId,
    state: AI_TASK_STATES.queued,
    taskType,
    source,
    inputScope,
    promptTemplateId,
    providerId: normalizedProvider.id,
    model: normalizedProvider.model,
    retryCount: 0,
    maxRetries: 2,
    queuedAt: timestamp,
    startedAt: null,
    completedAt: null,
    errorReason: null
  };
}

function confirmAiJobPlan({ plan, confirmedAt } = {}) {
  const timestamp = cleanText(confirmedAt) || new Date().toISOString();
  const currentPlan = clonePlain(plan);
  return {
    ...currentPlan,
    job: {
      ...currentPlan.job,
      state: AI_JOB_STATES.confirmed,
      confirmedAt: timestamp
    },
    tasks: normalizeTasks(currentPlan.tasks),
    confirmation: {
      ...(currentPlan.confirmation || {}),
      required: true,
      confirmedAt: timestamp
    }
  };
}

function pauseAiJob({ job, pausedAt } = {}) {
  const timestamp = cleanText(pausedAt) || new Date().toISOString();
  return {
    ...(clonePlain(job) || {}),
    state: AI_JOB_STATES.paused,
    pausedAt: timestamp,
    resumeRequired: true
  };
}

function resumeAiJob({ job, resumedAt } = {}) {
  const timestamp = cleanText(resumedAt) || new Date().toISOString();
  return {
    ...(clonePlain(job) || {}),
    state: AI_JOB_STATES.running,
    resumedAt: timestamp,
    resumeRequired: false
  };
}

function cancelAiJob({ job, tasks, cancelledAt } = {}) {
  const timestamp = cleanText(cancelledAt) || new Date().toISOString();
  return {
    job: {
      ...(clonePlain(job) || {}),
      state: AI_JOB_STATES.cancelled,
      cancelledAt: timestamp,
      completedAt: timestamp,
      resumeRequired: false
    },
    tasks: normalizeTasks(tasks).map((task) =>
      isTerminalTaskState(task.state)
        ? task
        : {
            ...task,
            state: AI_TASK_STATES.cancelled,
            completedAt: timestamp
          }
    )
  };
}

function createManualResumeReadModel({ aiJobs, aiTasks } = {}) {
  const tasks = normalizeTasks(aiTasks);
  const resumableJobs = (Array.isArray(aiJobs) ? aiJobs : [])
    .filter((job) => job?.resumeRequired || job?.state === AI_JOB_STATES.paused)
    .map((job) => ({
      ...clonePlain(job),
      taskCount: tasks.filter((task) => task.jobId === job.id).length,
      autoResumeAllowed: false
    }));
  return {
    resumableJobs,
    autoResumeAllowed: false
  };
}

function createAiTaskWorkspaceReadModel(snapshot = {}) {
  const jobs = Array.isArray(snapshot.aiJobs) ? snapshot.aiJobs : [];
  const tasks = Array.isArray(snapshot.aiTasks) ? snapshot.aiTasks : [];
  const results = Array.isArray(snapshot.aiTaskResults) ? snapshot.aiTaskResults : [];
  const failures = Array.isArray(snapshot.aiTaskFailures) ? snapshot.aiTaskFailures : [];
  const skips = Array.isArray(snapshot.aiTaskSkips) ? snapshot.aiTaskSkips : [];
  const diagnoses = Array.isArray(snapshot.aiJobDiagnoses) ? snapshot.aiJobDiagnoses : [];
  const activeJob = selectLatestAiJob(jobs);
  const activeTasks = activeJob ? tasks.filter((task) => task.jobId === activeJob.id) : [];
  const activeJobId = cleanText(activeJob?.id);
  return {
    activeJob,
    activeTasks,
    activeResults: activeJobId ? results.filter((entry) => cleanText(entry?.jobId) === activeJobId).map(clonePlain) : [],
    activeFailures: activeJobId ? failures.filter((entry) => cleanText(entry?.jobId) === activeJobId).map(clonePlain) : [],
    activeSkips: activeJobId ? skips.filter((entry) => cleanText(entry?.jobId) === activeJobId).map(clonePlain) : [],
    activeDiagnoses: activeJobId ? diagnoses.filter((entry) => cleanText(entry?.jobId) === activeJobId).map(clonePlain) : [],
    progress: {
      total: activeTasks.length,
      queued: activeTasks.filter((task) => task.state === "queued").length,
      running: activeTasks.filter((task) => task.state === "running" || task.state === "retrying").length,
      succeeded: activeTasks.filter((task) => task.state === "succeeded").length,
      skipped: activeTasks.filter((task) => task.state === "skipped").length,
      failed: activeTasks.filter((task) => task.state === "failed").length,
      cancelled: activeTasks.filter((task) => task.state === "cancelled").length
    },
    resumableJobs: createManualResumeReadModel({ aiJobs: jobs, aiTasks: tasks }).resumableJobs
  };
}

function selectLatestAiJob(jobs) {
  if (!Array.isArray(jobs) || !jobs.length) {
    return null;
  }
  return jobs.reduce((latest, job, index) => {
    if (!latest) {
      return { job, score: getAiJobActivityScore(job), index };
    }
    const score = getAiJobActivityScore(job);
    if (score > latest.score || (score === latest.score && index > latest.index)) {
      return { job, score, index };
    }
    return latest;
  }, null).job;
}

function getAiJobActivityScore(job) {
  const candidates = [job?.completedAt, job?.cancelledAt, job?.pausedAt, job?.interruptedAt, job?.startedAt, job?.confirmedAt, job?.createdAt];
  const scores = candidates
    .map((value) => Date.parse(cleanText(value)))
    .filter((value) => Number.isFinite(value));
  return scores.length ? Math.max(...scores) : 0;
}

async function runAiTaskQueue({ job, tasks, executeTask, classifyFailure, now, onProgress, shouldPause } = {}) {
  if (typeof executeTask !== "function") {
    throw new Error("AI Task Queue 缺少任务执行器");
  }
  const progressReporter = typeof onProgress === "function" ? onProgress : null;
  const pauseRequested = typeof shouldPause === "function" ? shouldPause : () => false;
  const timestamp = typeof now === "function" ? now : () => new Date().toISOString();
  const failureClassifier =
    classifyFailure ||
    ProviderRequestPolicy?.classifyProviderFailure ||
    ((error) => ({
      kind: "unknown-task-failure",
      retryable: true,
      skipAllowed: true,
      userMessage: cleanText(error?.message) || "任务失败"
    }));
  const nextJob = { ...job, state: AI_JOB_STATES.running, startedAt: job?.startedAt || timestamp(), resumeRequired: false };
  const nextTasks = tasks.map((task) => ({ ...task }));
  const results = [];
  const failures = [];
  const skips = [];
  const diagnoses = [];
  const limit = normalizeConcurrencyLimit(nextJob.providerConcurrencyLimit);
  let cursor = 0;
  let stopped = false;
  let consecutiveFailures = 0;

  function reportProgress() {
    if (!progressReporter) {
      return;
    }
    progressReporter({
      job: clonePlain(nextJob),
      tasks: nextTasks.map(clonePlain),
      results: results.map(clonePlain),
      failures: failures.map(clonePlain),
      skips: skips.map(clonePlain),
      diagnoses: diagnoses.map(clonePlain)
    });
  }

  function pauseQueue(pausedAt = timestamp()) {
    stopped = true;
    nextJob.state = AI_JOB_STATES.paused;
    nextJob.pausedAt = pausedAt;
    nextJob.resumeRequired = true;
  }

  async function worker() {
    while (!stopped && cursor < nextTasks.length) {
      if (pauseRequested()) {
        pauseQueue();
        reportProgress();
        return;
      }
      const task = nextTasks[cursor];
      cursor += 1;
      if (task.state !== AI_TASK_STATES.queued && task.state !== AI_TASK_STATES.retrying) {
        continue;
      }
      await runOneTask(task);
    }
  }

  async function runOneTask(task) {
    if (pauseRequested()) {
      task.state = AI_TASK_STATES.queued;
      task.resumeRequired = true;
      pauseQueue();
      reportProgress();
      return;
    }
    task.state = task.retryCount > 0 ? AI_TASK_STATES.retrying : AI_TASK_STATES.running;
    task.startedAt = task.startedAt || timestamp();
    reportProgress();
    try {
      const output = await executeTask(task);
      task.state = AI_TASK_STATES.succeeded;
      task.completedAt = timestamp();
      consecutiveFailures = 0;
      results.push({
        jobId: task.jobId,
        taskId: task.id,
        source: task.source,
        inputScope: task.inputScope,
        promptTemplateId: task.promptTemplateId,
        taskType: task.taskType,
        providerId: task.providerId,
        model: task.model,
        status: "succeeded",
        content: cleanText(output?.content),
        title: cleanText(output?.title),
        createdAt: task.completedAt
      });
      reportProgress();
    } catch (error) {
      if (pauseRequested() && isAbortError(error)) {
        task.state = AI_TASK_STATES.queued;
        task.resumeRequired = true;
        task.errorReason = null;
        pauseQueue();
        reportProgress();
        return;
      }
      const classified = failureClassifier(error);
      consecutiveFailures += 1;
      failures.push({
        jobId: task.jobId,
        taskId: task.id,
        sourceTitle: task.source?.title || "",
        failureKind: classified.kind,
        errorReason: classified.userMessage,
        retryCount: task.retryCount,
        createdAt: timestamp()
      });
      if (classified.kind === "systemic-provider-failure") {
        task.state = AI_TASK_STATES.failed;
        task.errorReason = classified.userMessage;
        stopped = true;
        nextJob.state = AI_JOB_STATES.paused;
        nextJob.resumeRequired = true;
        diagnoses.push(
          ProviderRequestPolicy.createJobFailureDiagnosis({
            jobId: nextJob.id,
            providerId: nextJob.provider?.id,
            model: nextJob.provider?.model,
            totalTasks: nextTasks.length,
            failedTasks: failures,
            createdAt: timestamp()
          })
        );
        reportProgress();
        return;
      }
      if (classified.retryable && task.retryCount < task.maxRetries) {
        task.retryCount += 1;
        if (pauseRequested()) {
          task.state = AI_TASK_STATES.queued;
          task.resumeRequired = true;
          pauseQueue();
          reportProgress();
          return;
        }
        reportProgress();
        await runOneTask(task);
        return;
      }
      if (classified.skipAllowed) {
        task.state = AI_TASK_STATES.skipped;
        task.completedAt = timestamp();
        task.errorReason = classified.userMessage;
        skips.push({
          jobId: task.jobId,
          taskId: task.id,
          source: task.source,
          reason: classified.userMessage,
          retryCount: task.retryCount,
          createdAt: task.completedAt
        });
        reportProgress();
        return;
      }
      task.state = AI_TASK_STATES.failed;
      task.completedAt = timestamp();
      task.errorReason = classified.userMessage;
      if (
        ProviderRequestPolicy?.shouldTriggerJobFailureDiagnosis?.({
          totalTasks: nextTasks.length,
          failureCount: failures.length,
          consecutiveFailures,
          latestFailureKind: classified.kind
        })
      ) {
        stopped = true;
        nextJob.state = AI_JOB_STATES.paused;
        nextJob.resumeRequired = true;
        diagnoses.push(
          ProviderRequestPolicy.createJobFailureDiagnosis({
            jobId: nextJob.id,
            providerId: nextJob.provider?.id,
            model: nextJob.provider?.model,
            totalTasks: nextTasks.length,
            failedTasks: failures,
            createdAt: timestamp()
          })
        );
      }
      reportProgress();
    }
  }

  reportProgress();
  await Promise.all(Array.from({ length: Math.min(limit, nextTasks.length) }, () => worker()));
  if (nextJob.state === AI_JOB_STATES.running) {
    nextJob.state = skips.length ? AI_JOB_STATES.completedWithSkips : AI_JOB_STATES.completed;
    nextJob.completedAt = timestamp();
  }
  reportProgress();
  return { job: nextJob, tasks: nextTasks, results, failures, skips, diagnoses };
}

function normalizeTasks(tasks) {
  return Array.isArray(tasks) ? clonePlain(tasks) : [];
}

function normalizeSelectedPaperForTask(paper) {
  return {
    zoteroItemKey: cleanText(paper?.key),
    title: cleanText(paper?.title) || "未命名条目",
    authors: cleanText(paper?.authors),
    year: cleanText(paper?.year),
    publicationTitle: cleanText(paper?.publicationTitle),
    abstractNote: cleanText(paper?.abstractNote),
    doi: cleanText(paper?.doi)
  };
}

function normalizeTaskClassification(classification) {
  const requestedMode = cleanText(classification?.taskMode);
  const taskMode =
    requestedMode === TASK_MODES.perPaperSummary || requestedMode === TASK_MODES.commonality
      ? requestedMode
      : TASK_MODES.commonality;
  return {
    taskMode,
    source: cleanText(classification?.source) || "fallback",
    confidence: normalizeConfidence(classification?.confidence),
    reason: cleanText(classification?.reason) || "未记录任务类型判断原因"
  };
}

function createTaskPlanConfirmationSummary({ paperCount, taskCount, classification, provider }) {
  const label = classification.taskMode === TASK_MODES.perPaperSummary ? "逐篇总结" : "共同点综合";
  const source = classification.source === "llm-classifier" ? "AI 识别" : "本地识别";
  const taskLabel = classification.taskMode === TASK_MODES.perPaperSummary ? `${taskCount} 个逐篇总结任务` : `${taskCount} 个共同点笔记任务`;
  return [
    `识别为：${label}（${source}，置信度 ${classification.confidence}）`,
    `原因：${classification.reason}`,
    `将对当前选中的 ${paperCount} 篇文献生成 ${taskLabel}`,
    `服务商 ${provider.id} / ${provider.model}`
  ].join("；");
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, Math.round(numeric * 100) / 100));
}

function isTerminalTaskState(state) {
  return [AI_TASK_STATES.succeeded, AI_TASK_STATES.skipped, AI_TASK_STATES.failed, AI_TASK_STATES.cancelled].includes(state);
}

function createStableTimestamp(value) {
  return cleanText(value).replace(/[^0-9A-Za-z]+/g, "-").replace(/^-+|-+$/g, "") || "now";
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isAbortError(error) {
  return cleanText(error?.name) === "AbortError" || /aborted|abort/i.test(cleanText(error?.message));
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

const WorkbenchAiTaskWorkspace = {
  AI_JOB_STATES,
  AI_TASK_STATES,
  cancelAiJob,
  classifyCurrentSelectionTaskRequest,
  createAiTaskWorkspaceReadModel,
  confirmAiJobPlan,
  createCurrentSelectionAiJobPlan,
  createManualResumeReadModel,
  pauseAiJob,
  resumeAiJob,
  runAiTaskQueue
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchAiTaskWorkspace;
}

if (typeof window !== "undefined") {
  window.WorkbenchAiTaskWorkspace = WorkbenchAiTaskWorkspace;
}
})();
