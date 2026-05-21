# V0.3 AI Task Workspace Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v0.3 Slice 1 AI Task Workspace: current-selection AI jobs, a visible provider queue, confirmation gates, provider concurrency, retry/skip/diagnosis, and manual resume after restart.

**Architecture:** Pure CommonJS core modules own AI Job/Task state, provider failure classification, queue execution, and persistence records. The Zotero runtime adds one Research Panel adapter that creates draft plans from the current selection, blocks execution until explicit confirmation, runs provider calls with visible controls, and stores resumable state in the Workbench Local Store without automatic background resume.

**Tech Stack:** CommonJS core modules, Node `node:test`, Zotero XHTML plus vanilla browser JavaScript, existing OpenAI-compatible provider runtime, Workbench Local Store schema-v1 JSON snapshot, PowerShell XPI packaging.

---

## Existing V0.3 Framework

This plan implements the existing v0.3 framework from:

- `CONTEXT.md`
- `docs/adr/0001-user-confirmed-document-import-modes.md`
- `docs/adr/0002-ai-job-plans-require-confirmation-before-side-effects.md`
- `docs/adr/0003-ai-jobs-allow-partial-failure-with-diagnosis-thresholds.md`
- `docs/adr/0004-external-connectors-stay-lawful-and-generic.md`
- `docs/superpowers/specs/2026-05-21-v03-ai-task-workspace-design.md`

Slice 1 is intentionally limited to current Zotero selection. It must not add connector import, external literature discovery, Zotero-native write batching, or a visible right-click menu entry.

## File Structure

- Create `src/core/providerRequestPolicy.js`.
  - Normalize provider concurrency limits.
  - Classify transient, recoverable, and systemic provider failures.
  - Calculate Job Failure Diagnosis trigger thresholds.
  - Export both CommonJS and `window.WorkbenchProviderRequestPolicy`.
- Create `tests/provider-request-policy.test.js`.
  - Cover provider failure classification, diagnosis thresholds, and concurrency normalization.
- Create `src/core/aiTaskWorkspace.js`.
  - Own AI Job and AI Task state constants.
  - Create current-selection AI Job Plans from natural-language input.
  - Confirm plans without starting execution.
  - Run provider task queues with a per-provider concurrency limit.
  - Apply retry twice, Task Skip, cancellation, pause, and diagnosis rules.
  - Export both CommonJS and `window.WorkbenchAiTaskWorkspace`.
- Create `tests/ai-task-workspace.test.js`.
  - Cover plan creation, state transitions, queue concurrency, retry/skip, diagnosis, cancellation, and manual resume state.
- Modify `src/core/workbenchSnapshot.js`.
  - Preserve v0.3 arrays in schema-v1 snapshots:
    `aiJobs`, `aiTasks`, `aiTaskResults`, `aiTaskFailures`, `aiTaskSkips`, `aiJobDiagnoses`.
- Modify `tests/workbench-snapshot.test.js`.
  - Assert export/import preserves v0.3 AI Task Workspace records and still redacts Secret Material.
- Modify `src/core/workbenchLocalStoreTransaction.js`.
  - Add transaction functions for AI Job Plan creation, confirmation, queue result recording, and manual resume marking.
- Modify `tests/workbench-local-store-transaction.test.js`.
  - Assert transactions update only Workbench Local Store records and append Task Ledger entries after local state changes.
- Modify `src/core/researchPanelOrchestrator.js`.
  - Add pure panel workflows for AI Task Workspace plan creation, confirmation, queue result persistence, and read-model creation.
- Modify `tests/research-panel-orchestrator.test.js`.
  - Cover the new orchestrator workflows without Zotero runtime APIs.
- Modify `src/core/index.js`.
  - Export `WorkbenchProviderRequestPolicy` and `WorkbenchAiTaskWorkspace`.
- Modify `chrome/content/researchPanel.xhtml`.
  - Add the AI Task Workspace section: natural-language input, plan preview, confirmation controls, queue list, progress summary, diagnosis panel, and manual resume list.
  - Add script tags for the new core and runtime modules.
- Create `chrome/content/aiTaskWorkspace.js`.
  - Wire the Research Panel controls to core workflows and existing provider/runtime adapters.
  - Keep provider execution behind the confirmation button.
  - Persist pause/cancel/resume state through the Workbench Local Store.
- Modify `tests/ui-localization.test.js`.
  - Assert Chinese UI labels and runtime wiring for the new task workspace.
- Modify `scripts/build-xpi.ps1`.
  - Package `providerRequestPolicy.js`, core `aiTaskWorkspace.js` as `aiTaskWorkspaceCore.js`, and runtime `chrome/content/aiTaskWorkspace.js`.
- Modify `tests/package.test.js`.
  - Assert package contents and load order.
- Modify `package.json`.
  - Add new files to `npm run check`.
- Modify `manifest.json` and `package.json`.
  - Bump version to `0.3.0-beta.1`.
- Modify `README.md`.
  - Update the current slice and package artifact name to v0.3.

## Task 1: Preserve AI Task Workspace Records In Snapshots

**Files:**
- Modify: `src/core/workbenchSnapshot.js`
- Modify: `tests/workbench-snapshot.test.js`

- [ ] **Step 1: Add failing snapshot tests**

Append these tests to `tests/workbench-snapshot.test.js`:

```js
test("normalizeSnapshotForImport preserves ai task workspace records", () => {
  const snapshot = normalizeSnapshotForImport({
    schemaVersion: 1,
    exportedAt: "2026-05-22T00:00:00.000Z",
    aiJobs: [{ id: "job-1", state: "paused", resumeRequired: true }],
    aiTasks: [{ id: "task-1", jobId: "job-1", state: "queued" }],
    aiTaskResults: [{ taskId: "task-1", content: "summary" }],
    aiTaskFailures: [{ taskId: "task-2", errorReason: "PDF unreadable" }],
    aiTaskSkips: [{ taskId: "task-2", reason: "recoverable-failure" }],
    aiJobDiagnoses: [{ jobId: "job-1", reason: "systemic-provider-failure" }]
  });

  assert.deepEqual(snapshot.aiJobs, [{ id: "job-1", state: "paused", resumeRequired: true }]);
  assert.deepEqual(snapshot.aiTasks, [{ id: "task-1", jobId: "job-1", state: "queued" }]);
  assert.deepEqual(snapshot.aiTaskResults, [{ taskId: "task-1", content: "summary" }]);
  assert.deepEqual(snapshot.aiTaskFailures, [{ taskId: "task-2", errorReason: "PDF unreadable" }]);
  assert.deepEqual(snapshot.aiTaskSkips, [{ taskId: "task-2", reason: "recoverable-failure" }]);
  assert.deepEqual(snapshot.aiJobDiagnoses, [{ jobId: "job-1", reason: "systemic-provider-failure" }]);
});

test("createWorkbenchExportPackage redacts secret material inside ai task workspace records", () => {
  const exported = createWorkbenchExportPackage({
    exportedAt: "2026-05-22T00:01:00.000Z",
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      aiJobs: [{ id: "job-1", requestText: "summarize", apiKey: "<redacted>" }],
      aiTaskFailures: [{ taskId: "task-1", authorization: "<redacted>" }]
    }
  });

  assert.equal(exported.snapshot.aiJobs[0].apiKey, SECRET_PLACEHOLDER);
  assert.equal(exported.snapshot.aiTaskFailures[0].authorization, SECRET_PLACEHOLDER);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests\workbench-snapshot.test.js
```

Expected: FAIL because the normalized snapshot does not yet include the six v0.3 arrays.

- [ ] **Step 3: Extend snapshot normalization**

In `src/core/workbenchSnapshot.js`, update the object returned by `normalizeSnapshotForImport` so it includes:

```js
    aiJobs: Array.isArray(snapshot.aiJobs) ? snapshot.aiJobs : [],
    aiTasks: Array.isArray(snapshot.aiTasks) ? snapshot.aiTasks : [],
    aiTaskResults: Array.isArray(snapshot.aiTaskResults) ? snapshot.aiTaskResults : [],
    aiTaskFailures: Array.isArray(snapshot.aiTaskFailures) ? snapshot.aiTaskFailures : [],
    aiTaskSkips: Array.isArray(snapshot.aiTaskSkips) ? snapshot.aiTaskSkips : [],
    aiJobDiagnoses: Array.isArray(snapshot.aiJobDiagnoses) ? snapshot.aiJobDiagnoses : []
```

- [ ] **Step 4: Run focused snapshot tests**

Run:

```powershell
node --test tests\workbench-snapshot.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit snapshot envelope**

Run:

```powershell
git add src/core/workbenchSnapshot.js tests/workbench-snapshot.test.js
git commit -m "feat: preserve ai task workspace snapshot records"
```

## Task 2: Add Provider Request Policy Core

**Files:**
- Create: `src/core/providerRequestPolicy.js`
- Create: `tests/provider-request-policy.test.js`
- Modify: `src/core/index.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing provider policy tests**

Create `tests/provider-request-policy.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyProviderFailure,
  createJobFailureDiagnosis,
  normalizeProviderConcurrencyLimit,
  shouldTriggerJobFailureDiagnosis
} = require("../src/core/providerRequestPolicy");
const core = require("../src/core");

test("core index exports provider request policy module", () => {
  assert.equal(typeof core.WorkbenchProviderRequestPolicy.classifyProviderFailure, "function");
});

test("normalizeProviderConcurrencyLimit clamps invalid values to a visible safe range", () => {
  assert.equal(normalizeProviderConcurrencyLimit(undefined), 1);
  assert.equal(normalizeProviderConcurrencyLimit(0), 1);
  assert.equal(normalizeProviderConcurrencyLimit(3), 3);
  assert.equal(normalizeProviderConcurrencyLimit(20), 8);
});

test("classifyProviderFailure marks auth and quota failures as systemic", () => {
  assert.deepEqual(classifyProviderFailure({ status: 401, message: "bad key" }), {
    kind: "systemic-provider-failure",
    retryable: false,
    skipAllowed: false,
    userMessage: "服务商认证失败，请检查 API 密钥或账户权限"
  });
  assert.deepEqual(classifyProviderFailure({ status: 429, message: "quota" }), {
    kind: "systemic-provider-failure",
    retryable: false,
    skipAllowed: false,
    userMessage: "服务商额度或频率限制触发，请检查额度、模型和并发设置"
  });
});

test("classifyProviderFailure marks network 502 and 503 as transient retryable failures", () => {
  assert.equal(classifyProviderFailure({ status: 502 }).kind, "transient-provider-failure");
  assert.equal(classifyProviderFailure({ status: 502 }).retryable, true);
  assert.equal(classifyProviderFailure({ status: 503 }).retryable, true);
});

test("classifyProviderFailure marks unreadable source text as recoverable per-paper failure", () => {
  const failure = classifyProviderFailure({ code: "source-text-unreadable", message: "no text" });

  assert.equal(failure.kind, "recoverable-task-failure");
  assert.equal(failure.retryable, true);
  assert.equal(failure.skipAllowed, true);
  assert.equal(failure.userMessage, "当前文献缺少可读文本，可跳过该任务并保留其他结果");
});

test("shouldTriggerJobFailureDiagnosis follows v0.3 thresholds", () => {
  assert.equal(shouldTriggerJobFailureDiagnosis({ totalTasks: 9, failureCount: 2, consecutiveFailures: 2 }), false);
  assert.equal(shouldTriggerJobFailureDiagnosis({ totalTasks: 9, failureCount: 3, consecutiveFailures: 2 }), true);
  assert.equal(shouldTriggerJobFailureDiagnosis({ totalTasks: 10, failureCount: 2, consecutiveFailures: 2 }), false);
  assert.equal(shouldTriggerJobFailureDiagnosis({ totalTasks: 10, failureCount: 3, consecutiveFailures: 2 }), true);
  assert.equal(shouldTriggerJobFailureDiagnosis({ totalTasks: 100, failureCount: 29, consecutiveFailures: 4 }), false);
  assert.equal(shouldTriggerJobFailureDiagnosis({ totalTasks: 100, failureCount: 30, consecutiveFailures: 4 }), true);
  assert.equal(shouldTriggerJobFailureDiagnosis({ totalTasks: 100, failureCount: 1, consecutiveFailures: 5 }), true);
  assert.equal(
    shouldTriggerJobFailureDiagnosis({
      totalTasks: 100,
      failureCount: 1,
      consecutiveFailures: 1,
      latestFailureKind: "systemic-provider-failure"
    }),
    true
  );
});

test("createJobFailureDiagnosis returns a user-facing summary, not raw logs", () => {
  const diagnosis = createJobFailureDiagnosis({
    jobId: "job-1",
    providerId: "provider-1",
    model: "model-a",
    totalTasks: 10,
    failedTasks: [
      { taskId: "task-1", sourceTitle: "Paper A", failureKind: "systemic-provider-failure" },
      { taskId: "task-2", sourceTitle: "Paper B", failureKind: "systemic-provider-failure" }
    ],
    createdAt: "2026-05-22T00:10:00.000Z"
  });

  assert.equal(diagnosis.jobId, "job-1");
  assert.equal(diagnosis.providerId, "provider-1");
  assert.equal(diagnosis.reason, "systemic-provider-failure");
  assert.match(diagnosis.summary, /服务商或模型配置可能存在系统性问题/);
  assert.deepEqual(diagnosis.affectedTaskIds, ["task-1", "task-2"]);
  assert.doesNotMatch(diagnosis.summary, /stack/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests\provider-request-policy.test.js
```

Expected: FAIL with `Cannot find module '../src/core/providerRequestPolicy'`.

- [ ] **Step 3: Create provider request policy module**

Create `src/core/providerRequestPolicy.js` with these public functions:

```js
function normalizeProviderConcurrencyLimit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  return Math.min(8, Math.max(1, Math.round(numeric)));
}

function classifyProviderFailure(error = {}) {
  const status = Number(error.status || error.statusCode);
  const code = cleanText(error.code);
  if (status === 401 || status === 403 || code === "auth-error") {
    return {
      kind: "systemic-provider-failure",
      retryable: false,
      skipAllowed: false,
      userMessage: "服务商认证失败，请检查 API 密钥或账户权限"
    };
  }
  if (status === 429 || code === "quota-exceeded" || code === "rate-limited") {
    return {
      kind: "systemic-provider-failure",
      retryable: false,
      skipAllowed: false,
      userMessage: "服务商额度或频率限制触发，请检查额度、模型和并发设置"
    };
  }
  if ([502, 503, 504, 408].includes(status) || code === "network-error" || code === "timeout") {
    return {
      kind: "transient-provider-failure",
      retryable: true,
      skipAllowed: false,
      userMessage: "服务商暂时不可用，任务将按重试策略继续"
    };
  }
  if (code === "source-text-unreadable" || code === "pdf-unreadable" || code === "missing-readable-text") {
    return {
      kind: "recoverable-task-failure",
      retryable: true,
      skipAllowed: true,
      userMessage: "当前文献缺少可读文本，可跳过该任务并保留其他结果"
    };
  }
  return {
    kind: "unknown-task-failure",
    retryable: true,
    skipAllowed: true,
    userMessage: cleanText(error.userMessage) || cleanText(error.message) || "任务失败，可重试或跳过"
  };
}

function shouldTriggerJobFailureDiagnosis({
  totalTasks,
  failureCount,
  consecutiveFailures,
  latestFailureKind
} = {}) {
  if (latestFailureKind === "systemic-provider-failure" || latestFailureKind === "systemic-connector-failure") {
    return true;
  }
  const total = Math.max(0, Number(totalTasks) || 0);
  const failures = Math.max(0, Number(failureCount) || 0);
  const consecutive = Math.max(0, Number(consecutiveFailures) || 0);
  if (consecutive >= 5) {
    return true;
  }
  if (total < 10) {
    return failures >= 3;
  }
  return total > 0 && failures / total >= 0.3;
}

function createJobFailureDiagnosis({
  jobId,
  providerId,
  model,
  totalTasks,
  failedTasks,
  createdAt
} = {}) {
  const failures = Array.isArray(failedTasks) ? failedTasks : [];
  const reason = failures.some((failure) => failure.failureKind === "systemic-provider-failure")
    ? "systemic-provider-failure"
    : "task-failure-threshold";
  return {
    id: `diagnosis-${cleanText(jobId) || "unknown"}-${createStableTimestamp(createdAt)}`,
    jobId: cleanText(jobId),
    reason,
    providerId: cleanText(providerId),
    model: cleanText(model),
    totalTasks: Math.max(0, Number(totalTasks) || 0),
    failedTaskCount: failures.length,
    affectedTaskIds: failures.map((failure) => cleanText(failure.taskId)).filter(Boolean),
    summary:
      reason === "systemic-provider-failure"
        ? "服务商或模型配置可能存在系统性问题。请检查 API 密钥、模型名称、额度、接口地址和并发设置，然后手动继续。"
        : "失败数量达到诊断阈值。请检查失败任务的来源文本、PDF 可读性和服务商响应，再决定继续、重试或跳过。",
    recommendedActions:
      reason === "systemic-provider-failure"
        ? ["检查服务商设置", "降低并发限制", "测试连接", "手动继续任务"]
        : ["查看失败任务", "重试失败任务", "跳过可恢复失败", "取消任务"],
    createdAt: cleanText(createdAt) || new Date().toISOString()
  };
}

function createStableTimestamp(value) {
  return cleanText(value).replace(/[^0-9A-Za-z]+/g, "-").replace(/^-+|-+$/g, "") || "now";
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const WorkbenchProviderRequestPolicy = {
  classifyProviderFailure,
  createJobFailureDiagnosis,
  normalizeProviderConcurrencyLimit,
  shouldTriggerJobFailureDiagnosis
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchProviderRequestPolicy;
}

if (typeof window !== "undefined") {
  window.WorkbenchProviderRequestPolicy = WorkbenchProviderRequestPolicy;
}
```

- [ ] **Step 4: Export module from core index**

In `src/core/index.js`, add:

```js
const WorkbenchProviderRequestPolicy = require("./providerRequestPolicy");
```

and include this property in the exported object:

```js
  WorkbenchProviderRequestPolicy,
```

- [ ] **Step 5: Add syntax check entry**

In `package.json`, add this command segment to `scripts.check` before `workbenchLocalStoreTransaction.js`:

```text
node --check src/core/providerRequestPolicy.js
```

- [ ] **Step 6: Run provider policy tests**

Run:

```powershell
node --test tests\provider-request-policy.test.js
node --check src\core\providerRequestPolicy.js
node --check src\core\index.js
```

Expected: PASS.

- [ ] **Step 7: Commit provider policy**

Run:

```powershell
git add src/core/providerRequestPolicy.js src/core/index.js tests/provider-request-policy.test.js package.json
git commit -m "feat: add provider request policy"
```

## Task 3: Add AI Job And AI Task Core Model

**Files:**
- Create: `src/core/aiTaskWorkspace.js`
- Create: `tests/ai-task-workspace.test.js`
- Modify: `src/core/index.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing AI Task Workspace model tests**

Create the first part of `tests/ai-task-workspace.test.js`:

```js
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
  resumeAiJob
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests\ai-task-workspace.test.js
```

Expected: FAIL with `Cannot find module '../src/core/aiTaskWorkspace'`.

- [ ] **Step 3: Create core constants and plan functions**

Create `src/core/aiTaskWorkspace.js` with these public exports:

```js
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
```

Implement:

```js
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
```

Also implement `confirmAiJobPlan`, `pauseAiJob`, `resumeAiJob`, `cancelAiJob`, and `createManualResumeReadModel` using the states asserted by the tests.

- [ ] **Step 4: Wire provider policy dependency**

At the top of `src/core/aiTaskWorkspace.js`, resolve provider policy in both Node and browser runtimes:

```js
const ProviderRequestPolicy =
  typeof require === "function"
    ? require("./providerRequestPolicy")
    : typeof window !== "undefined"
      ? window.WorkbenchProviderRequestPolicy
      : null;

const { normalizeProviderConcurrencyLimit } = ProviderRequestPolicy || {
  normalizeProviderConcurrencyLimit: (value) => Math.min(8, Math.max(1, Math.round(Number(value) || 1)))
};
```

- [ ] **Step 5: Export AI Task Workspace from core index**

In `src/core/index.js`, add:

```js
const WorkbenchAiTaskWorkspace = require("./aiTaskWorkspace");
```

and include:

```js
  WorkbenchAiTaskWorkspace,
```

- [ ] **Step 6: Add syntax check entry**

In `package.json`, add this command segment to `scripts.check` after `providerRequestPolicy.js`:

```text
node --check src/core/aiTaskWorkspace.js
```

- [ ] **Step 7: Run focused model tests**

Run:

```powershell
node --test tests\ai-task-workspace.test.js
node --check src\core\aiTaskWorkspace.js
node --check src\core\index.js
```

Expected: PASS.

- [ ] **Step 8: Commit AI task model**

Run:

```powershell
git add src/core/aiTaskWorkspace.js src/core/index.js tests/ai-task-workspace.test.js package.json
git commit -m "feat: add ai task workspace model"
```

## Task 4: Add Queue Execution, Retry, Skip, And Diagnosis

**Files:**
- Modify: `src/core/aiTaskWorkspace.js`
- Modify: `tests/ai-task-workspace.test.js`

- [ ] **Step 1: Add failing queue execution tests**

Append these tests to `tests/ai-task-workspace.test.js`:

```js
const {
  runAiTaskQueue
} = require("../src/core/aiTaskWorkspace");

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
  await Promise.resolve();
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests\ai-task-workspace.test.js
```

Expected: FAIL because `runAiTaskQueue` is not exported.

- [ ] **Step 3: Implement queue runner**

In `src/core/aiTaskWorkspace.js`, add:

```js
async function runAiTaskQueue({ job, tasks, executeTask, classifyFailure, now } = {}) {
  if (typeof executeTask !== "function") {
    throw new Error("AI Task Queue 缺少任务执行器");
  }
  const timestamp = typeof now === "function" ? now : () => new Date().toISOString();
  const failureClassifier =
    classifyFailure ||
    ProviderRequestPolicy?.classifyProviderFailure ||
    ((error) => ({ kind: "unknown-task-failure", retryable: true, skipAllowed: true, userMessage: cleanText(error?.message) || "任务失败" }));
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
```

- [ ] **Step 4: Export queue runner**

Add `runAiTaskQueue` to `WorkbenchAiTaskWorkspace`.

- [ ] **Step 5: Run focused queue tests**

Run:

```powershell
node --test tests\ai-task-workspace.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit queue core**

Run:

```powershell
git add src/core/aiTaskWorkspace.js tests/ai-task-workspace.test.js
git commit -m "feat: run ai task queue with retry and diagnosis"
```

## Task 5: Add Local Store Transactions For AI Jobs

**Files:**
- Modify: `src/core/workbenchLocalStoreTransaction.js`
- Modify: `tests/workbench-local-store-transaction.test.js`

- [ ] **Step 1: Add failing transaction tests**

Append these imports to `tests/workbench-local-store-transaction.test.js`:

```js
  confirmAiJobPlanTransaction,
  createAiJobPlanTransaction,
  markRunningAiJobsForManualResumeTransaction,
  recordAiTaskQueueResultTransaction,
```

Append these tests:

```js
test("createAiJobPlanTransaction stores draft job plan and task records", () => {
  const result = createAiJobPlanTransaction({
    snapshot: { schemaVersion: 1, exportedAt: "old", aiJobs: [], aiTasks: [], taskLedger: [] },
    plan: {
      job: { id: "job-1", state: "draft", requestText: "summarize" },
      tasks: [{ id: "task-1", jobId: "job-1", state: "queued" }]
    },
    createdAt: "2026-05-22T03:00:00.000Z"
  });

  assert.equal(result.status, "ai-job-plan-created");
  assert.equal(result.snapshot.aiJobs.length, 1);
  assert.equal(result.snapshot.aiTasks.length, 1);
  assert.equal(result.snapshot.taskLedger.at(-1).workflowStep, "create-ai-job-plan");
});

test("confirmAiJobPlanTransaction marks draft job confirmed", () => {
  const result = confirmAiJobPlanTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      aiJobs: [{ id: "job-1", state: "draft" }],
      aiTasks: [{ id: "task-1", jobId: "job-1", state: "queued" }],
      taskLedger: []
    },
    jobId: "job-1",
    confirmedAt: "2026-05-22T03:01:00.000Z"
  });

  assert.equal(result.status, "ai-job-confirmed");
  assert.equal(result.snapshot.aiJobs[0].state, "confirmed");
  assert.equal(result.snapshot.aiJobs[0].confirmedAt, "2026-05-22T03:01:00.000Z");
  assert.equal(result.snapshot.taskLedger.at(-1).workflowStep, "confirm-ai-job-plan");
});

test("recordAiTaskQueueResultTransaction stores results failures skips and diagnosis", () => {
  const result = recordAiTaskQueueResultTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      aiJobs: [{ id: "job-1", state: "confirmed" }],
      aiTasks: [{ id: "task-1", jobId: "job-1", state: "queued" }],
      aiTaskResults: [],
      aiTaskFailures: [],
      aiTaskSkips: [],
      aiJobDiagnoses: [],
      taskLedger: []
    },
    queueResult: {
      job: { id: "job-1", state: "completed-with-skips" },
      tasks: [{ id: "task-1", jobId: "job-1", state: "skipped" }],
      results: [],
      failures: [{ taskId: "task-1", jobId: "job-1", errorReason: "missing text" }],
      skips: [{ taskId: "task-1", jobId: "job-1", reason: "missing text" }],
      diagnoses: [{ id: "diagnosis-1", jobId: "job-1", reason: "task-failure-threshold" }]
    },
    recordedAt: "2026-05-22T03:02:00.000Z"
  });

  assert.equal(result.status, "ai-task-queue-recorded");
  assert.equal(result.snapshot.aiJobs[0].state, "completed-with-skips");
  assert.equal(result.snapshot.aiTasks[0].state, "skipped");
  assert.equal(result.snapshot.aiTaskFailures.length, 1);
  assert.equal(result.snapshot.aiTaskSkips.length, 1);
  assert.equal(result.snapshot.aiJobDiagnoses.length, 1);
  assert.equal(result.snapshot.taskLedger.at(-1).workflowStep, "run-ai-task-queue");
});

test("markRunningAiJobsForManualResumeTransaction pauses interrupted jobs without auto resume", () => {
  const result = markRunningAiJobsForManualResumeTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      aiJobs: [
        { id: "job-1", state: "running", resumeRequired: false },
        { id: "job-2", state: "completed", resumeRequired: false }
      ],
      aiTasks: [
        { id: "task-1", jobId: "job-1", state: "running" },
        { id: "task-2", jobId: "job-2", state: "succeeded" }
      ],
      taskLedger: []
    },
    interruptedAt: "2026-05-22T03:03:00.000Z"
  });

  assert.equal(result.status, "ai-jobs-marked-for-manual-resume");
  assert.equal(result.snapshot.aiJobs[0].state, "paused");
  assert.equal(result.snapshot.aiJobs[0].resumeRequired, true);
  assert.equal(result.snapshot.aiTasks[0].state, "queued");
  assert.equal(result.snapshot.aiJobs[1].state, "completed");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests\workbench-local-store-transaction.test.js
```

Expected: FAIL because the four transaction functions do not exist.

- [ ] **Step 3: Implement transaction helpers**

In `src/core/workbenchLocalStoreTransaction.js`, add functions that:

```js
function createAiJobPlanTransaction({ snapshot, plan, createdAt } = {}) {
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  const next = normalizeTransactionSnapshot(snapshot);
  const job = clonePlain(plan?.job);
  const tasks = Array.isArray(plan?.tasks) ? plan.tasks.map((task) => clonePlain(task)) : [];
  if (!cleanText(job.id)) {
    throw new Error("AI Job id 不能为空");
  }
  next.aiJobs = next.aiJobs.filter((entry) => cleanText(entry?.id) !== job.id);
  next.aiJobs.push(job);
  next.aiTasks = next.aiTasks.filter((entry) => cleanText(entry?.jobId) !== job.id);
  next.aiTasks.push(...tasks);
  next.taskLedger.push({
    id: `task-${job.id}-create-ai-job-plan`,
    workflowStep: "create-ai-job-plan",
    state: "completed",
    providerId: cleanText(job.provider?.id) || null,
    promptTaskTemplateId: null,
    outputLocation: { aiJobId: job.id },
    errorNotice: null,
    startedAt: timestamp,
    completedAt: timestamp,
    provenance: { source: "explicit-user-action", writeTarget: "local-snapshot-only" }
  });
  next.exportedAt = timestamp;
  return { status: "ai-job-plan-created", jobId: job.id, snapshot: next };
}
```

Implement `confirmAiJobPlanTransaction`, `recordAiTaskQueueResultTransaction`, and `markRunningAiJobsForManualResumeTransaction` with the state updates asserted in Step 1. These functions must use `normalizeTransactionSnapshot(snapshot)` and `clonePlain` so source snapshots are not mutated.

- [ ] **Step 4: Extend transaction snapshot normalization**

In `normalizeTransactionSnapshot`, ensure these arrays always exist:

```js
  next.aiJobs = Array.isArray(next.aiJobs) ? next.aiJobs : [];
  next.aiTasks = Array.isArray(next.aiTasks) ? next.aiTasks : [];
  next.aiTaskResults = Array.isArray(next.aiTaskResults) ? next.aiTaskResults : [];
  next.aiTaskFailures = Array.isArray(next.aiTaskFailures) ? next.aiTaskFailures : [];
  next.aiTaskSkips = Array.isArray(next.aiTaskSkips) ? next.aiTaskSkips : [];
  next.aiJobDiagnoses = Array.isArray(next.aiJobDiagnoses) ? next.aiJobDiagnoses : [];
```

- [ ] **Step 5: Export transaction functions**

Add the four functions to `WorkbenchLocalStoreTransaction` and CommonJS exports.

- [ ] **Step 6: Run transaction tests**

Run:

```powershell
node --test tests\workbench-local-store-transaction.test.js tests\workbench-snapshot.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit transaction support**

Run:

```powershell
git add src/core/workbenchLocalStoreTransaction.js tests/workbench-local-store-transaction.test.js
git commit -m "feat: persist ai task workspace state"
```

## Task 6: Add Research Panel Orchestrator Workflows

**Files:**
- Modify: `src/core/researchPanelOrchestrator.js`
- Modify: `tests/research-panel-orchestrator.test.js`

- [ ] **Step 1: Add failing orchestrator tests**

Append this test to `tests/research-panel-orchestrator.test.js`:

```js
test("ai task workspace workflows create confirm and record a current-selection job", () => {
  const orchestrator = createResearchPanelOrchestrator();
  const snapshot = createSnapshot();

  const draft = orchestrator.createAiTaskWorkspacePlanWorkflow({
    snapshot,
    requestText: "请总结当前选中的文献",
    selectedPapers: [
      {
        key: "ITEM1",
        title: "Task Paper",
        authors: "Li Wang",
        year: "2026",
        publicationTitle: "Journal",
        abstractNote: "abstract",
        doi: "10.1000/task"
      }
    ],
    provider: { id: "provider", model: "model" },
    concurrencyLimit: 1,
    createdAt: "2026-05-22T04:00:00.000Z"
  });

  assert.equal(draft.status, "aiJobPlanCreated");
  assert.equal(draft.plan.job.state, "draft");
  assert.equal(draft.snapshot.aiJobs.length, 1);
  assert.equal(draft.records.aiTaskWorkspace.activeJob.id, draft.plan.job.id);

  const confirmed = orchestrator.confirmAiTaskWorkspacePlanWorkflow({
    snapshot: draft.snapshot,
    jobId: draft.plan.job.id,
    confirmedAt: "2026-05-22T04:01:00.000Z"
  });

  assert.equal(confirmed.status, "aiJobConfirmed");
  assert.equal(confirmed.snapshot.aiJobs[0].state, "confirmed");

  const recorded = orchestrator.recordAiTaskWorkspaceQueueResultWorkflow({
    snapshot: confirmed.snapshot,
    queueResult: {
      job: { ...confirmed.snapshot.aiJobs[0], state: "completed" },
      tasks: [{ ...confirmed.snapshot.aiTasks[0], state: "succeeded" }],
      results: [{ jobId: draft.plan.job.id, taskId: confirmed.snapshot.aiTasks[0].id, content: "summary" }],
      failures: [],
      skips: [],
      diagnoses: []
    },
    recordedAt: "2026-05-22T04:02:00.000Z"
  });

  assert.equal(recorded.status, "aiTaskQueueRecorded");
  assert.equal(recorded.records.aiTaskWorkspace.activeJob.state, "completed");
  assert.equal(recorded.records.aiTaskWorkspace.progress.succeeded, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests\research-panel-orchestrator.test.js
```

Expected: FAIL because AI Task Workspace orchestrator functions are not exposed.

- [ ] **Step 3: Resolve AI Task Workspace module in orchestrator**

In `src/core/researchPanelOrchestrator.js`, add module resolution:

```js
const aiTaskWorkspaceModule = resolveAiTaskWorkspaceModule(dependencies.aiTaskWorkspaceModule);
```

Add `resolveAiTaskWorkspaceModule` that uses `require("./aiTaskWorkspace")` in Node and `window.WorkbenchAiTaskWorkspace` in browser.

- [ ] **Step 4: Add orchestrator workflows**

Inside `createResearchPanelOrchestrator`, add:

```js
function createAiTaskWorkspacePlanWorkflow({
  snapshot,
  requestText,
  selectedPapers,
  provider,
  concurrencyLimit,
  createdAt
} = {}) {
  const plan = aiTaskWorkspaceModule.createCurrentSelectionAiJobPlan({
    requestText,
    selectedPapers,
    provider,
    concurrencyLimit,
    createdAt
  });
  const result = transactionModule.createAiJobPlanTransaction({
    snapshot,
    plan,
    createdAt
  });
  return {
    status: "aiJobPlanCreated",
    plan,
    snapshot: result.snapshot,
    records: createPanelRecords(result.snapshot, {})
  };
}

function confirmAiTaskWorkspacePlanWorkflow({ snapshot, jobId, confirmedAt } = {}) {
  const result = transactionModule.confirmAiJobPlanTransaction({ snapshot, jobId, confirmedAt });
  return {
    status: "aiJobConfirmed",
    jobId,
    snapshot: result.snapshot,
    records: createPanelRecords(result.snapshot, {})
  };
}

function recordAiTaskWorkspaceQueueResultWorkflow({ snapshot, queueResult, recordedAt } = {}) {
  const result = transactionModule.recordAiTaskQueueResultTransaction({ snapshot, queueResult, recordedAt });
  return {
    status: "aiTaskQueueRecorded",
    snapshot: result.snapshot,
    records: createPanelRecords(result.snapshot, {})
  };
}
```

- [ ] **Step 5: Add AI Task Workspace read model**

Extend `createPanelRecords` with:

```js
        aiTaskWorkspace: aiTaskWorkspaceModule.createAiTaskWorkspaceReadModel(snapshot),
```

Implement `createAiTaskWorkspaceReadModel` in `src/core/aiTaskWorkspace.js` if it is not already present:

```js
function createAiTaskWorkspaceReadModel(snapshot = {}) {
  const jobs = Array.isArray(snapshot.aiJobs) ? snapshot.aiJobs : [];
  const tasks = Array.isArray(snapshot.aiTasks) ? snapshot.aiTasks : [];
  const activeJob = jobs.slice().reverse().find((job) => !["completed", "completed-with-skips", "failed", "cancelled"].includes(job.state)) || jobs.at(-1) || null;
  const activeTasks = activeJob ? tasks.filter((task) => task.jobId === activeJob.id) : [];
  return {
    activeJob,
    activeTasks,
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
```

- [ ] **Step 6: Assert module functions**

Update orchestrator assertions so `assertTransactionModule` requires:

```js
    "confirmAiJobPlanTransaction",
    "createAiJobPlanTransaction",
    "recordAiTaskQueueResultTransaction"
```

and `assertAiTaskWorkspaceModule` requires:

```js
    "createAiTaskWorkspaceReadModel",
    "createCurrentSelectionAiJobPlan"
```

- [ ] **Step 7: Run orchestrator tests**

Run:

```powershell
node --test tests\research-panel-orchestrator.test.js tests\ai-task-workspace.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit orchestrator workflows**

Run:

```powershell
git add src/core/researchPanelOrchestrator.js src/core/aiTaskWorkspace.js tests/research-panel-orchestrator.test.js tests/ai-task-workspace.test.js
git commit -m "feat: add ai task workspace orchestrator workflows"
```

## Task 7: Add Research Panel AI Task Workspace UI

**Files:**
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `tests/ui-localization.test.js`

- [ ] **Step 1: Add failing UI localization assertions**

In `tests/ui-localization.test.js`, extend the `research panel exposes Chinese LLM provider settings` text list with:

```js
    "AI 任务工作台",
    "任务需求",
    "生成任务计划",
    "计划预览",
    "确认并开始",
    "暂停任务",
    "继续任务",
    "取消任务",
    "并发上限",
    "任务队列",
    "失败诊断",
    "可继续任务",
    "成功",
    "跳过",
    "失败"
```

Add ID assertions:

```js
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
  assert.match(panel, /id="ai-job-diagnosis"/);
  assert.match(panel, /id="ai-job-resume-list"/);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests\ui-localization.test.js
```

Expected: FAIL because the panel does not contain AI Task Workspace UI.

- [ ] **Step 3: Add panel markup**

In `chrome/content/researchPanel.xhtml`, insert this section after the selected-paper section and before current single-paper action buttons:

```html
      <section id="ai-task-workspace">
        <div class="section-header">
          <strong>AI 任务工作台</strong>
          <span id="ai-job-progress" class="status">尚未创建任务</span>
        </div>
        <label>
          任务需求
          <textarea id="ai-job-request" rows="4" placeholder="例如：请总结当前选中的文献，并保留失败或跳过原因"></textarea>
        </label>
        <div class="field-grid compact-fields">
          <label>
            并发上限
            <input id="ai-job-concurrency-limit" type="number" min="1" max="8" value="1" />
          </label>
        </div>
        <div class="actions">
          <button id="ai-job-create-plan" type="button">生成任务计划</button>
          <button id="ai-job-confirm-start" type="button" class="primary-action" disabled="disabled">确认并开始</button>
          <button id="ai-job-pause" type="button" disabled="disabled">暂停任务</button>
          <button id="ai-job-resume" type="button" disabled="disabled">继续任务</button>
          <button id="ai-job-cancel" type="button" disabled="disabled">取消任务</button>
        </div>
        <div id="ai-job-plan-preview" class="record-list" aria-live="polite">
          <div class="record-item">计划预览：暂无任务计划</div>
        </div>
        <div class="section-header">
          <strong>任务队列</strong>
          <span id="ai-task-queue-summary" class="status">成功 0 · 跳过 0 · 失败 0</span>
        </div>
        <div id="ai-task-queue-list" class="record-list">
          <div class="record-item">暂无任务队列</div>
        </div>
        <div id="ai-job-diagnosis" class="record-list" hidden="hidden">
          <div class="record-item">失败诊断：暂无</div>
        </div>
        <div class="section-header">
          <strong>可继续任务</strong>
        </div>
        <div id="ai-job-resume-list" class="record-list">
          <div class="record-item">暂无可继续任务</div>
        </div>
      </section>
```

- [ ] **Step 4: Add compact field CSS**

In the `<style>` block, add:

```css
      .compact-fields {
        grid-template-columns: repeat(auto-fit, minmax(120px, 180px));
        align-items: end;
      }
```

- [ ] **Step 5: Run UI tests**

Run:

```powershell
node --test tests\ui-localization.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit UI markup**

Run:

```powershell
git add chrome/content/researchPanel.xhtml tests/ui-localization.test.js
git commit -m "feat: add ai task workspace panel"
```

## Task 8: Add Runtime Adapter For Current Selection Jobs

**Files:**
- Create: `chrome/content/aiTaskWorkspace.js`
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `tests/ui-localization.test.js`
- Modify: `package.json`

- [ ] **Step 1: Add failing runtime wiring test**

Append this test to `tests/ui-localization.test.js`:

```js
test("ai task workspace runtime wires plan confirmation queue controls and persistence", () => {
  const panel = fs.readFileSync(path.join(root, "chrome/content/researchPanel.xhtml"), "utf8");
  const runtime = fs.readFileSync(path.join(root, "chrome/content/aiTaskWorkspace.js"), "utf8");

  assert.match(panel, /aiTaskWorkspaceCore\.js/);
  assert.match(panel, /providerRequestPolicy\.js/);
  assert.match(panel, /aiTaskWorkspace\.js/);
  assert.ok(panel.indexOf("providerRequestPolicy.js") < panel.indexOf("aiTaskWorkspaceCore.js"));
  assert.ok(panel.indexOf("aiTaskWorkspaceCore.js") < panel.indexOf("aiTaskWorkspace.js"));
  assert.ok(panel.indexOf("aiTaskWorkspace.js") < panel.indexOf("paperSummary.js"));
  assert.match(runtime, /WorkbenchAiTaskWorkspace/);
  assert.match(runtime, /createDraftAiJobPlan/);
  assert.match(runtime, /confirmAndRunAiJob/);
  assert.match(runtime, /pauseCurrentAiJob/);
  assert.match(runtime, /resumeCurrentAiJob/);
  assert.match(runtime, /cancelCurrentAiJob/);
  assert.match(runtime, /runOpenAICompatibleSummaryTask/);
  assert.match(runtime, /ResearchPanelOrchestrator\.createAiTaskWorkspacePlanWorkflow/);
  assert.match(runtime, /ResearchPanelOrchestrator\.confirmAiTaskWorkspacePlanWorkflow/);
  assert.match(runtime, /ResearchPanelOrchestrator\.recordAiTaskWorkspaceQueueResultWorkflow/);
  assert.doesNotMatch(runtime, /confirmAndRunAiJob\(\);/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests\ui-localization.test.js
```

Expected: FAIL because `chrome/content/aiTaskWorkspace.js` does not exist and script tags are missing.

- [ ] **Step 3: Add runtime script tags**

In `chrome/content/researchPanel.xhtml`, add these scripts before `paperSummary.js` and after existing core dependencies:

```html
    <script src="providerRequestPolicy.js"></script>
    <script src="aiTaskWorkspaceCore.js"></script>
    <script src="aiTaskWorkspace.js"></script>
```

Keep `providerRequestPolicy.js` before `aiTaskWorkspaceCore.js`, and keep `aiTaskWorkspace.js` before `paperSummary.js`.

- [ ] **Step 4: Create runtime adapter skeleton**

Create `chrome/content/aiTaskWorkspace.js`:

```js
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
    getField("ai-job-cancel").disabled = !model.activeJob || ["completed", "completed-with-skips", "failed", "cancelled"].includes(model.activeJob.state);
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
```

- [ ] **Step 5: Add syntax check entry**

In `package.json`, add this command segment to `scripts.check` before `chrome/content/paperSummary.js`:

```text
node --check chrome/content/aiTaskWorkspace.js
```

- [ ] **Step 6: Run runtime checks**

Run:

```powershell
node --test tests\ui-localization.test.js
node --check chrome\content\aiTaskWorkspace.js
```

Expected: PASS.

- [ ] **Step 7: Run package-boundary static checks**

Run:

```powershell
node --test tests\ui-localization.test.js tests\package.test.js
```

Expected: PASS for UI runtime assertions and build-script package-boundary assertions. The built-XPI package assertion may skip until `npm run package` creates the v0.3 XPI.

- [ ] **Step 8: Commit runtime adapter**

Run:

```powershell
git add chrome/content/aiTaskWorkspace.js chrome/content/researchPanel.xhtml tests/ui-localization.test.js package.json
git commit -m "feat: wire ai task workspace runtime"
```

## Task 9: Package New Runtime Modules

**Files:**
- Modify: `scripts/build-xpi.ps1`
- Modify: `tests/package.test.js`

- [ ] **Step 1: Add failing package assertions**

In `tests/package.test.js`, add build-script assertions:

```js
  assert.match(script, /src\/core\/providerRequestPolicy\.js/);
  assert.match(script, /providerRequestPolicy\.js/);
  assert.match(script, /src\/core\/aiTaskWorkspace\.js/);
  assert.match(script, /aiTaskWorkspaceCore\.js/);
  assert.match(script, /chrome\/content\/aiTaskWorkspace\.js/);
```

In the built XPI test, add listing assertions:

```js
    assert.match(listing, /chrome\/content\/providerRequestPolicy\.js/);
    assert.match(listing, /chrome\/content\/aiTaskWorkspaceCore\.js/);
    assert.match(listing, /chrome\/content\/aiTaskWorkspace\.js/);
```

Add load-order assertions:

```js
    assert.ok(panel.indexOf("providerRequestPolicy.js") < panel.indexOf("aiTaskWorkspaceCore.js"));
    assert.ok(panel.indexOf("aiTaskWorkspaceCore.js") < panel.indexOf("aiTaskWorkspace.js"));
    assert.ok(panel.indexOf("aiTaskWorkspace.js") < panel.indexOf("paperSummary.js"));
```

- [ ] **Step 2: Run package test to verify it fails**

Run:

```powershell
node --test tests\package.test.js
```

Expected: FAIL on missing build-script packaging assertions.

- [ ] **Step 3: Update build script**

In `scripts/build-xpi.ps1`, add:

```powershell
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/providerRequestPolicy.js") -Destination (Join-Path $packageDir "chrome/content/providerRequestPolicy.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/aiTaskWorkspace.js") -Destination (Join-Path $packageDir "chrome/content/aiTaskWorkspaceCore.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "chrome/content/aiTaskWorkspace.js") -Destination (Join-Path $packageDir "chrome/content")
```

Place these before copying `chrome/content/paperSummary.js`.

- [ ] **Step 4: Run package test without XPI**

Run:

```powershell
node --test tests\package.test.js
```

Expected: PASS for build-script assertions. The built-XPI test may skip if the new v0.3 XPI has not been built.

- [ ] **Step 5: Build package**

Run:

```powershell
npm run package
```

Expected: creates `dist/zotero-research-workbench-0.3.0-beta.1.xpi`.

- [ ] **Step 6: Run package test against XPI**

Run:

```powershell
node --test tests\package.test.js
```

Expected: PASS with the built XPI present.

- [ ] **Step 7: Commit package wiring**

Run:

```powershell
git add scripts/build-xpi.ps1 tests/package.test.js dist
git commit -m "build: package ai task workspace runtime"
```

## Task 10: Bump Version And Update Docs

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Add package/version expectations**

In `tests/package.test.js`, add:

```js
test("manifest and package version track v0.3 beta", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

  assert.equal(manifest.version, "0.3.0-beta.1");
  assert.equal(packageJson.version, "0.3.0-beta.1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests\package.test.js
```

Expected: FAIL while files still show `0.21.0-beta.1`.

- [ ] **Step 3: Update versions**

Set both files to:

```json
"version": "0.3.0-beta.1"
```

- [ ] **Step 4: Update README current slice**

In `README.md`, update `## Current Slice` so it includes:

```markdown
- an AI Task Workspace for current-selection jobs;
- natural-language task request entry in the Research Panel;
- AI Job Plan preview with explicit confirmation before provider calls;
- visible AI Task Queue with provider concurrency limit;
- retry twice, visible Task Skip, Job Failure Diagnosis, pause/resume/cancel controls;
- manual resume display for interrupted jobs without automatic background continuation;
```

Update the package command sentence to:

```markdown
The package command writes `dist/zotero-research-workbench-0.3.0-beta.1.xpi`.
```

- [ ] **Step 5: Run docs/package tests**

Run:

```powershell
node --test tests\package.test.js tests\ui-localization.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit version and docs**

Run:

```powershell
git add manifest.json package.json README.md tests/package.test.js
git commit -m "docs: describe v03 ai task workspace slice"
```

## Task 11: Full Verification

**Files:**
- No source edits unless verification exposes a failing assertion.

- [ ] **Step 1: Run focused core tests**

Run:

```powershell
node --test tests\provider-request-policy.test.js tests\ai-task-workspace.test.js tests\workbench-snapshot.test.js tests\workbench-local-store-transaction.test.js tests\research-panel-orchestrator.test.js
```

Expected: PASS.

- [ ] **Step 2: Run UI and package tests**

Run:

```powershell
node --test tests\ui-localization.test.js tests\package.test.js
```

Expected: PASS.

- [ ] **Step 3: Run all tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 4: Run syntax checks**

Run:

```powershell
npm run check
```

Expected: PASS.

- [ ] **Step 5: Build XPI**

Run:

```powershell
npm run package
```

Expected: creates `dist/zotero-research-workbench-0.3.0-beta.1.xpi`.

- [ ] **Step 6: Verify package contents**

Run:

```powershell
tar -tf dist\zotero-research-workbench-0.3.0-beta.1.xpi
```

Expected output includes:

```text
chrome/content/providerRequestPolicy.js
chrome/content/aiTaskWorkspaceCore.js
chrome/content/aiTaskWorkspace.js
chrome/content/paperSummary.js
```

- [ ] **Step 7: Run all tests after packaging**

Run:

```powershell
npm test
```

Expected: PASS, including built-XPI assertions in `tests/package.test.js`.

## Manual QA Checklist

- [ ] Install `dist/zotero-research-workbench-0.3.0-beta.1.xpi` into a Zotero 8/9 profile with a backup.
- [ ] Open `工具 -> 打开研究工作台`.
- [ ] Select one Zotero item and enter `请总结当前选中的文献`.
- [ ] Click `生成任务计划`.
- [ ] Confirm the plan preview shows current-selection scope, one provider call, provider/model, no Zotero-native writes, no document imports, and no external discovery.
- [ ] Confirm no provider request is sent before clicking `确认并开始`.
- [ ] Click `确认并开始` and verify the queue shows queued, running, and succeeded states.
- [ ] Force an unreadable source text error and verify retry twice, then visible `跳过`, and final job state `completed-with-skips`.
- [ ] Force provider 401 and verify the job pauses, `失败诊断` explains provider settings, and no additional tasks keep running.
- [ ] Restart Zotero after pausing a job and verify `可继续任务` lists the job without automatic execution.
- [ ] Confirm `暂停任务`, `继续任务`, and `取消任务` update visible state and persisted snapshot records.
- [ ] Confirm no Zotero item, attachment, note, relation, tag, or metadata write happens from AI Task Workspace Slice 1.

## Scope Guardrails

- No hidden launch surfaces.
- No automatic background resume after restart.
- No Zotero-native write concurrency.
- No external connector UI.
- No document import modes in Slice 1.
- No source-specific blocked literature connectors or documentation.
- No treatment of natural-language intent as consent for provider calls or writes.
