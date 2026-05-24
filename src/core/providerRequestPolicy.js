(function () {
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
})();
