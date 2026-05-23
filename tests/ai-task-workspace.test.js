const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AI_JOB_STATES,
  AI_TASK_STATES,
  cancelAiJob,
  confirmAiJobPlan,
  createAiTaskWorkspaceReadModel,
  classifyCurrentSelectionTaskRequest,
  createCurrentSelectionAiJobPlan,
  createManualResumeReadModel,
  pauseAiJob,
  resumeAiJob,
  runAiTaskQueue
} = require("../src/core/aiTaskWorkspace");
const core = require("../src/core");

function createPaper(key, title) {
  return {
    key,
    title,
    authors: "Li Wang",
    year: "2026",
    publicationTitle: "Journal",
    abstractNote: "Abstract",
    doi: `10.1000/${key.toLowerCase()}`
  };
}

function createQueuedTask(jobId, key, index) {
  return {
    id: `${jobId}-task-${String(index).padStart(3, "0")}`,
    jobId,
    state: AI_TASK_STATES.queued,
    taskType: "test-task",
    source: {
      kind: "test-source",
      zoteroItemKey: key,
      title: `Paper ${key}`
    },
    inputScope: { requestText: "test", title: `Paper ${key}` },
    promptTemplateId: "test-template",
    providerId: "provider",
    model: "model",
    retryCount: 0,
    maxRetries: 2,
    queuedAt: "2026-05-22T02:00:00.000Z",
    startedAt: null,
    completedAt: null,
    errorReason: null
  };
}

async function waitForCondition(predicate, message) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(message);
}

test("core index exports ai task workspace module", () => {
  assert.equal(typeof core.WorkbenchAiTaskWorkspace.createCurrentSelectionAiJobPlan, "function");
});

test("classifyCurrentSelectionTaskRequest detects commonality and per-paper summary intent", () => {
  assert.deepEqual(
    classifyCurrentSelectionTaskRequest({
      requestText: "请找出这些文献的共通点",
      selectedPaperCount: 3
    }),
    {
      taskMode: "multi-paper-commonality-note",
      source: "local-keyword",
      confidence: 0.9,
      reason: "用户请求包含共同点、共性、综合、比较或关系类表达"
    }
  );

  assert.deepEqual(
    classifyCurrentSelectionTaskRequest({
      requestText: "请分别总结每一篇文章",
      selectedPaperCount: 3
    }),
    {
      taskMode: "per-paper-summary",
      source: "local-keyword",
      confidence: 0.9,
      reason: "用户请求包含分别、逐篇、每篇或一篇一篇类表达"
    }
  );

  assert.equal(
    classifyCurrentSelectionTaskRequest({
      requestText: "请总结这些文献",
      selectedPaperCount: 3
    }).taskMode,
    "needs-ai-classification"
  );
});

test("createCurrentSelectionAiJobPlan creates a draft job plan without execution consent", () => {
  const plan = createCurrentSelectionAiJobPlan({
    requestText: "请找出当前选中文献的共同点",
    selectedPapers: [createPaper("ITEM1", "Paper A"), createPaper("ITEM2", "Paper B")],
    provider: { id: "openai-compatible", model: "model-a" },
    concurrencyLimit: 2,
    createdAt: "2026-05-22T01:00:00.000Z"
  });

  assert.equal(plan.job.id, "ai-job-2026-05-22T01-00-00-000Z");
  assert.equal(plan.job.state, AI_JOB_STATES.draft);
  assert.equal(plan.job.requestText, "请找出当前选中文献的共同点");
  assert.equal(plan.job.discoveryScope.kind, "current-selection");
  assert.equal(plan.job.discoveryScope.itemCount, 2);
  assert.equal(plan.job.provider.id, "openai-compatible");
  assert.equal(plan.job.provider.model, "model-a");
  assert.equal(plan.job.providerConcurrencyLimit, 1);
  assert.deepEqual(plan.job.expectedSideEffects, {
    providerCalls: 1,
    workbenchLocalStoreWrites: true,
    zoteroNativeWrites: 0,
    documentImports: 0,
    externalDiscovery: false
  });
  assert.equal(plan.confirmation.required, true);
  assert.equal(plan.confirmation.confirmedAt, null);
  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.tasks[0].state, AI_TASK_STATES.queued);
  assert.equal(plan.tasks[0].taskType, "multi-paper-commonality-note");
  assert.equal(plan.tasks[0].source.kind, "zotero-current-selection-set");
  assert.equal(plan.tasks[0].source.itemCount, 2);
  assert.deepEqual(
    plan.tasks[0].inputScope.selectedPapers.map((paper) => paper.zoteroItemKey),
    ["ITEM1", "ITEM2"]
  );
  assert.equal(plan.tasks[0].promptTemplateId, "multi-paper-commonality-note");
  assert.match(plan.confirmation.summary, /1 个共同点笔记任务/);
});

test("createCurrentSelectionAiJobPlan creates per-paper tasks when request asks for separate summaries", () => {
  const plan = createCurrentSelectionAiJobPlan({
    requestText: "请分别总结当前选中的每一篇文献",
    selectedPapers: [createPaper("ITEM1", "Paper A"), createPaper("ITEM2", "Paper B")],
    provider: { id: "openai-compatible", model: "model-a" },
    concurrencyLimit: 2,
    createdAt: "2026-05-22T01:00:10.000Z"
  });

  assert.equal(plan.job.taskMode, "per-paper-summary");
  assert.equal(plan.job.taskClassification.source, "local-keyword");
  assert.equal(plan.job.providerConcurrencyLimit, 2);
  assert.equal(plan.job.expectedSideEffects.providerCalls, 2);
  assert.equal(plan.tasks.length, 2);
  assert.deepEqual(
    plan.tasks.map((task) => task.taskType),
    ["single-paper-summary", "single-paper-summary"]
  );
  assert.deepEqual(
    plan.tasks.map((task) => task.source.zoteroItemKey),
    ["ITEM1", "ITEM2"]
  );
  assert.equal(plan.tasks[0].promptTemplateId, "single-paper-chinese-summary");
  assert.match(plan.confirmation.summary, /识别为：逐篇总结/);
});

test("createCurrentSelectionAiJobPlan uses explicit AI task classification for ambiguous requests", () => {
  const plan = createCurrentSelectionAiJobPlan({
    requestText: "请总结这些文献",
    selectedPapers: [createPaper("ITEM1", "Paper A"), createPaper("ITEM2", "Paper B")],
    provider: { id: "openai-compatible", model: "model-a" },
    taskClassification: {
      taskMode: "multi-paper-commonality-note",
      source: "llm-classifier",
      confidence: 0.74,
      reason: "用户说这些文献，适合先做综合"
    },
    createdAt: "2026-05-22T01:00:20.000Z"
  });

  assert.equal(plan.job.taskMode, "multi-paper-commonality-note");
  assert.deepEqual(plan.job.taskClassification, {
    taskMode: "multi-paper-commonality-note",
    source: "llm-classifier",
    confidence: 0.74,
    reason: "用户说这些文献，适合先做综合"
  });
  assert.equal(plan.tasks.length, 1);
  assert.match(plan.confirmation.summary, /AI 识别/);
  assert.match(plan.confirmation.summary, /用户说这些文献/);
});

test("createCurrentSelectionAiJobPlan rejects empty request and empty current selection", () => {
  assert.throws(
    () =>
      createCurrentSelectionAiJobPlan({
        requestText: "",
        selectedPapers: [createPaper("ITEM1", "Paper A")],
        provider: { id: "provider", model: "model" }
      }),
    /任务需求不能为空/
  );
  assert.throws(
    () =>
      createCurrentSelectionAiJobPlan({
        requestText: "summarize",
        selectedPapers: [],
        provider: { id: "provider", model: "model" }
      }),
    /当前选择中没有可执行的文献/
  );
});

test("confirmAiJobPlan marks a plan confirmed without starting provider calls", () => {
  const plan = createCurrentSelectionAiJobPlan({
    requestText: "summarize",
    selectedPapers: [createPaper("ITEM1", "Paper A")],
    provider: { id: "provider", model: "model" },
    createdAt: "2026-05-22T01:01:00.000Z"
  });

  const confirmed = confirmAiJobPlan({ plan, confirmedAt: "2026-05-22T01:02:00.000Z" });

  assert.equal(confirmed.job.state, AI_JOB_STATES.confirmed);
  assert.equal(confirmed.confirmation.confirmedAt, "2026-05-22T01:02:00.000Z");
  assert.equal(confirmed.tasks[0].state, AI_TASK_STATES.queued);
});

test("pause resume and cancel preserve visible job states", () => {
  const plan = confirmAiJobPlan({
    plan: createCurrentSelectionAiJobPlan({
      requestText: "summarize",
      selectedPapers: [createPaper("ITEM1", "Paper A")],
      provider: { id: "provider", model: "model" },
      createdAt: "2026-05-22T01:03:00.000Z"
    }),
    confirmedAt: "2026-05-22T01:04:00.000Z"
  });

  const paused = pauseAiJob({ job: { ...plan.job, state: AI_JOB_STATES.running }, pausedAt: "2026-05-22T01:05:00.000Z" });
  const resumed = resumeAiJob({ job: paused, resumedAt: "2026-05-22T01:06:00.000Z" });
  const cancelled = cancelAiJob({
    job: resumed,
    tasks: plan.tasks,
    cancelledAt: "2026-05-22T01:07:00.000Z"
  });

  assert.equal(paused.state, AI_JOB_STATES.paused);
  assert.equal(paused.resumeRequired, true);
  assert.equal(resumed.state, AI_JOB_STATES.running);
  assert.equal(resumed.resumeRequired, false);
  assert.equal(cancelled.job.state, AI_JOB_STATES.cancelled);
  assert.equal(cancelled.tasks[0].state, AI_TASK_STATES.cancelled);
});

test("createManualResumeReadModel lists paused and interrupted jobs without auto resume", () => {
  const readModel = createManualResumeReadModel({
    aiJobs: [
      { id: "job-1", state: "paused", resumeRequired: true, requestText: "summarize" },
      { id: "job-2", state: "completed", resumeRequired: false, requestText: "done" }
    ],
    aiTasks: [{ id: "task-1", jobId: "job-1", state: "queued" }]
  });

  assert.equal(readModel.resumableJobs.length, 1);
  assert.equal(readModel.resumableJobs[0].id, "job-1");
  assert.equal(readModel.resumableJobs[0].autoResumeAllowed, false);
});

test("createAiTaskWorkspaceReadModel exposes active job results and failure records", () => {
  const readModel = createAiTaskWorkspaceReadModel({
    aiJobs: [
      { id: "job-old", state: "completed", requestText: "old" },
      { id: "job-1", state: "completed", requestText: "summarize" }
    ],
    aiTasks: [{ id: "task-1", jobId: "job-1", state: "succeeded" }],
    aiTaskResults: [{ jobId: "job-1", taskId: "task-1", content: "结果 A" }],
    aiTaskFailures: [{ jobId: "job-1", taskId: "task-2", errorReason: "失败 A" }],
    aiTaskSkips: [{ jobId: "job-1", taskId: "task-3", reason: "跳过 A" }],
    aiJobDiagnoses: [{ jobId: "job-1", reason: "systemic-provider-failure" }]
  });

  assert.equal(readModel.activeJob.id, "job-1");
  assert.deepEqual(readModel.activeResults.map((entry) => entry.content), ["结果 A"]);
  assert.deepEqual(readModel.activeFailures.map((entry) => entry.errorReason), ["失败 A"]);
  assert.deepEqual(readModel.activeSkips.map((entry) => entry.reason), ["跳过 A"]);
  assert.deepEqual(readModel.activeDiagnoses.map((entry) => entry.reason), ["systemic-provider-failure"]);
});

test("createAiTaskWorkspaceReadModel keeps the latest completed job visible over stale drafts", () => {
  const readModel = createAiTaskWorkspaceReadModel({
    aiJobs: [
      {
        id: "job-stale-draft",
        state: AI_JOB_STATES.draft,
        requestText: "older draft",
        createdAt: "2026-05-23T10:31:07.172Z"
      },
      {
        id: "job-latest-completed",
        state: AI_JOB_STATES.completed,
        requestText: "latest completed",
        createdAt: "2026-05-23T10:31:31.131Z",
        completedAt: "2026-05-23T10:33:01.307Z"
      }
    ],
    aiTasks: [
      { id: "task-stale-1", jobId: "job-stale-draft", state: AI_TASK_STATES.queued },
      { id: "task-latest-1", jobId: "job-latest-completed", state: AI_TASK_STATES.succeeded }
    ],
    aiTaskResults: [{ jobId: "job-latest-completed", taskId: "task-latest-1", content: "最新结果" }]
  });

  assert.equal(readModel.activeJob.id, "job-latest-completed");
  assert.equal(readModel.activeJob.state, AI_JOB_STATES.completed);
  assert.deepEqual(readModel.activeTasks.map((task) => task.id), ["task-latest-1"]);
  assert.deepEqual(readModel.activeResults.map((entry) => entry.content), ["最新结果"]);
});

test("runAiTaskQueue respects provider concurrency limit and stores task results", async () => {
  const job = {
    id: "ai-job-queue-test",
    state: AI_JOB_STATES.confirmed,
    provider: { id: "provider", model: "model" },
    providerConcurrencyLimit: 2
  };
  const tasks = [
    createQueuedTask(job.id, "ITEM1", 1),
    createQueuedTask(job.id, "ITEM2", 2),
    createQueuedTask(job.id, "ITEM3", 3)
  ];
  let active = 0;
  let maxActive = 0;
  const release = [];

  const running = runAiTaskQueue({
    job,
    tasks,
    executeTask: async (task) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => release.push(resolve));
      active -= 1;
      return { content: `summary:${task.source.zoteroItemKey}` };
    },
    now: () => "2026-05-22T02:02:00.000Z"
  });

  await Promise.resolve();
  assert.equal(maxActive, 2);
  release.splice(0).forEach((resolve) => resolve());
  await waitForCondition(() => release.length > 0, "third task should be waiting for release");
  release.splice(0).forEach((resolve) => resolve());
  const result = await running;

  assert.equal(result.job.state, AI_JOB_STATES.completed);
  assert.equal(result.results.length, 3);
  assert.deepEqual(result.results.map((entry) => entry.content), ["summary:ITEM1", "summary:ITEM2", "summary:ITEM3"]);
});

test("runAiTaskQueue reports progress while tasks leave queued and finish", async () => {
  const plan = confirmAiJobPlan({
    plan: createCurrentSelectionAiJobPlan({
      requestText: "summarize",
      selectedPapers: [createPaper("ITEM1", "A")],
      provider: { id: "provider", model: "model" },
      createdAt: "2026-05-22T02:05:00.000Z"
    }),
    confirmedAt: "2026-05-22T02:06:00.000Z"
  });
  const progressEvents = [];
  let release;

  const running = runAiTaskQueue({
    job: plan.job,
    tasks: plan.tasks,
    executeTask: async () => {
      await new Promise((resolve) => {
        release = resolve;
      });
      return { content: "summary:ITEM1" };
    },
    onProgress: (progress) => progressEvents.push(JSON.parse(JSON.stringify(progress))),
    now: () => "2026-05-22T02:07:00.000Z"
  });

  await waitForCondition(
    () => progressEvents.some((event) => event.tasks[0]?.state === AI_TASK_STATES.running),
    "task should report running before provider output resolves"
  );
  release();
  const result = await running;

  assert.equal(result.tasks[0].state, AI_TASK_STATES.succeeded);
  assert.ok(progressEvents.some((event) => event.tasks[0]?.state === AI_TASK_STATES.succeeded));
  assert.ok(progressEvents.some((event) => event.results[0]?.content === "summary:ITEM1"));
});

test("runAiTaskQueue pauses before scheduling remaining queued tasks", async () => {
  const job = {
    id: "ai-job-pause-test",
    state: AI_JOB_STATES.confirmed,
    provider: { id: "provider", model: "model" },
    providerConcurrencyLimit: 1
  };
  const tasks = [createQueuedTask(job.id, "ITEM1", 1), createQueuedTask(job.id, "ITEM2", 2)];
  let pauseRequested = false;
  const calls = [];

  const result = await runAiTaskQueue({
    job,
    tasks,
    executeTask: async (task) => {
      calls.push(task.source.zoteroItemKey);
      pauseRequested = true;
      return { content: `summary:${task.source.zoteroItemKey}` };
    },
    shouldPause: () => pauseRequested,
    now: () => "2026-05-22T02:09:00.000Z"
  });

  assert.deepEqual(calls, ["ITEM1"]);
  assert.equal(result.job.state, AI_JOB_STATES.paused);
  assert.equal(result.job.resumeRequired, true);
  assert.equal(result.tasks[0].state, AI_TASK_STATES.succeeded);
  assert.equal(result.tasks[1].state, AI_TASK_STATES.queued);
  assert.equal(result.results.length, 1);
});

test("runAiTaskQueue keeps an aborted paused task queued without recording failure", async () => {
  const plan = confirmAiJobPlan({
    plan: createCurrentSelectionAiJobPlan({
      requestText: "summarize",
      selectedPapers: [createPaper("ITEM1", "A")],
      provider: { id: "provider", model: "model" },
      createdAt: "2026-05-22T02:09:30.000Z"
    }),
    confirmedAt: "2026-05-22T02:09:45.000Z"
  });
  let pauseRequested = false;

  const result = await runAiTaskQueue({
    job: plan.job,
    tasks: plan.tasks,
    executeTask: async () => {
      pauseRequested = true;
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      throw error;
    },
    shouldPause: () => pauseRequested,
    now: () => "2026-05-22T02:10:00.000Z"
  });

  assert.equal(result.job.state, AI_JOB_STATES.paused);
  assert.equal(result.job.resumeRequired, true);
  assert.equal(result.tasks[0].state, AI_TASK_STATES.queued);
  assert.equal(result.tasks[0].resumeRequired, true);
  assert.equal(result.failures.length, 0);
  assert.equal(result.skips.length, 0);
});

test("runAiTaskQueue retries recoverable failures twice then records a visible skip", async () => {
  const plan = confirmAiJobPlan({
    plan: createCurrentSelectionAiJobPlan({
      requestText: "summarize",
      selectedPapers: [createPaper("ITEM1", "A")],
      provider: { id: "provider", model: "model" },
      createdAt: "2026-05-22T02:10:00.000Z"
    }),
    confirmedAt: "2026-05-22T02:11:00.000Z"
  });
  let calls = 0;

  const result = await runAiTaskQueue({
    job: plan.job,
    tasks: plan.tasks,
    executeTask: async () => {
      calls += 1;
      const error = new Error("PDF unreadable");
      error.code = "source-text-unreadable";
      throw error;
    },
    now: () => "2026-05-22T02:12:00.000Z"
  });

  assert.equal(calls, 3);
  assert.equal(result.job.state, AI_JOB_STATES.completedWithSkips);
  assert.equal(result.tasks[0].state, AI_TASK_STATES.skipped);
  assert.equal(result.skips[0].taskId, plan.tasks[0].id);
  assert.match(result.skips[0].reason, /缺少可读文本/);
});

test("runAiTaskQueue pauses and diagnoses systemic provider failures", async () => {
  const plan = confirmAiJobPlan({
    plan: createCurrentSelectionAiJobPlan({
      requestText: "summarize",
      selectedPapers: [createPaper("ITEM1", "A"), createPaper("ITEM2", "B")],
      provider: { id: "provider", model: "model" },
      createdAt: "2026-05-22T02:20:00.000Z"
    }),
    confirmedAt: "2026-05-22T02:21:00.000Z"
  });

  const result = await runAiTaskQueue({
    job: plan.job,
    tasks: plan.tasks,
    executeTask: async () => {
      const error = new Error("bad key");
      error.status = 401;
      throw error;
    },
    now: () => "2026-05-22T02:22:00.000Z"
  });

  assert.equal(result.job.state, AI_JOB_STATES.paused);
  assert.equal(result.job.resumeRequired, true);
  assert.equal(result.diagnoses.length, 1);
  assert.equal(result.diagnoses[0].reason, "systemic-provider-failure");
});
