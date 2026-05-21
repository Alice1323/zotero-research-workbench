const ProviderRequestPolicy =
  typeof require === "function"
    ? require("./providerRequestPolicy")
    : typeof window !== "undefined"
      ? window.WorkbenchProviderRequestPolicy
      : null;

const { normalizeProviderConcurrencyLimit } = ProviderRequestPolicy || {
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

function createCurrentSelectionAiJobPlan({ requestText, selectedPapers, provider, concurrencyLimit, createdAt } = {}) {
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
  const limit = normalizeProviderConcurrencyLimit(concurrencyLimit);
  const tasks = papers.map((paper, index) => ({
    id: `${jobId}-task-${String(index + 1).padStart(3, "0")}`,
    jobId,
    state: AI_TASK_STATES.queued,
    taskType: "single-paper-summary",
    source: {
      kind: "zotero-current-selection",
      zoteroItemKey: cleanText(paper.key),
      title: cleanText(paper.title) || "未命名条目",
      doi: cleanText(paper.doi)
    },
    inputScope: {
      requestText: normalizedRequest,
      title: cleanText(paper.title),
      authors: cleanText(paper.authors),
      year: cleanText(paper.year),
      publicationTitle: cleanText(paper.publicationTitle),
      abstractNote: cleanText(paper.abstractNote),
      doi: cleanText(paper.doi)
    },
    promptTemplateId: "single-paper-chinese-summary",
    providerId: normalizedProvider.id,
    model: normalizedProvider.model,
    retryCount: 0,
    maxRetries: 2,
    queuedAt: timestamp,
    startedAt: null,
    completedAt: null,
    errorReason: null
  }));
  return {
    job: {
      id: jobId,
      state: AI_JOB_STATES.draft,
      requestText: normalizedRequest,
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
      summary: `将对当前选中的 ${tasks.length} 篇文献调用服务商 ${normalizedProvider.id} / ${normalizedProvider.model}`
    }
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

async function runAiTaskQueue({ job, tasks, executeTask, classifyFailure, now } = {}) {
  if (typeof executeTask !== "function") {
    throw new Error("AI Task Queue 缺少任务执行器");
  }
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
  const limit = normalizeProviderConcurrencyLimit(nextJob.providerConcurrencyLimit);
  let cursor = 0;
  let stopped = false;
  let consecutiveFailures = 0;

  async function worker() {
    while (!stopped && cursor < nextTasks.length) {
      const task = nextTasks[cursor];
      cursor += 1;
      if (task.state !== AI_TASK_STATES.queued && task.state !== AI_TASK_STATES.retrying) {
        continue;
      }
      await runOneTask(task);
    }
  }

  async function runOneTask(task) {
    task.state = task.retryCount > 0 ? AI_TASK_STATES.retrying : AI_TASK_STATES.running;
    task.startedAt = task.startedAt || timestamp();
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
        providerId: task.providerId,
        model: task.model,
        status: "succeeded",
        content: cleanText(output?.content),
        createdAt: task.completedAt
      });
    } catch (error) {
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
        return;
      }
      if (classified.retryable && task.retryCount < task.maxRetries) {
        task.retryCount += 1;
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
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, nextTasks.length) }, () => worker()));
  if (nextJob.state === AI_JOB_STATES.running) {
    nextJob.state = skips.length ? AI_JOB_STATES.completedWithSkips : AI_JOB_STATES.completed;
    nextJob.completedAt = timestamp();
  }
  return { job: nextJob, tasks: nextTasks, results, failures, skips, diagnoses };
}

function normalizeTasks(tasks) {
  return Array.isArray(tasks) ? clonePlain(tasks) : [];
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

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

const WorkbenchAiTaskWorkspace = {
  AI_JOB_STATES,
  AI_TASK_STATES,
  cancelAiJob,
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
