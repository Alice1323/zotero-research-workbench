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
