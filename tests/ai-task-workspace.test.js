const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AI_JOB_STATES,
  AI_TASK_STATES,
  cancelAiJob,
  confirmAiJobPlan,
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

test("createCurrentSelectionAiJobPlan creates a draft job plan without execution consent", () => {
  const plan = createCurrentSelectionAiJobPlan({
    requestText: "请总结当前选中的文献",
    selectedPapers: [createPaper("ITEM1", "Paper A"), createPaper("ITEM2", "Paper B")],
    provider: { id: "openai-compatible", model: "model-a" },
    concurrencyLimit: 2,
    createdAt: "2026-05-22T01:00:00.000Z"
  });

  assert.equal(plan.job.id, "ai-job-2026-05-22T01-00-00-000Z");
  assert.equal(plan.job.state, AI_JOB_STATES.draft);
  assert.equal(plan.job.requestText, "请总结当前选中的文献");
  assert.equal(plan.job.discoveryScope.kind, "current-selection");
  assert.equal(plan.job.provider.id, "openai-compatible");
  assert.equal(plan.job.provider.model, "model-a");
  assert.equal(plan.job.providerConcurrencyLimit, 2);
  assert.deepEqual(plan.job.expectedSideEffects, {
    providerCalls: 2,
    workbenchLocalStoreWrites: true,
    zoteroNativeWrites: 0,
    documentImports: 0,
    externalDiscovery: false
  });
  assert.equal(plan.confirmation.required, true);
  assert.equal(plan.confirmation.confirmedAt, null);
  assert.equal(plan.tasks.length, 2);
  assert.equal(plan.tasks[0].state, AI_TASK_STATES.queued);
  assert.equal(plan.tasks[0].taskType, "single-paper-summary");
  assert.equal(plan.tasks[0].source.zoteroItemKey, "ITEM1");
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

test("runAiTaskQueue respects provider concurrency limit and stores task results", async () => {
  const plan = confirmAiJobPlan({
    plan: createCurrentSelectionAiJobPlan({
      requestText: "summarize",
      selectedPapers: [createPaper("ITEM1", "A"), createPaper("ITEM2", "B"), createPaper("ITEM3", "C")],
      provider: { id: "provider", model: "model" },
      concurrencyLimit: 2,
      createdAt: "2026-05-22T02:00:00.000Z"
    }),
    confirmedAt: "2026-05-22T02:01:00.000Z"
  });
  let active = 0;
  let maxActive = 0;
  const release = [];

  const running = runAiTaskQueue({
    job: plan.job,
    tasks: plan.tasks,
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
