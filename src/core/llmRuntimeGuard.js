(function () {
const LLM_RUNTIME_LIMITS = {
  requestsPerMinute: { defaultValue: 20, min: 1, max: 600 },
  maxInputTokensPerTask: { defaultValue: 12000, min: 1000, max: 200000 },
  windowMs: 60_000
};

function assertLlmRuntimeRequestAllowed({ prompt, settings, taskType, runtimeGuard }) {
  const maxInputTokensPerTask = normalizeRuntimeLimit(
    settings?.maxInputTokensPerTask,
    LLM_RUNTIME_LIMITS.maxInputTokensPerTask
  );
  const estimatedTokens = estimatePromptTokens(prompt);
  if (estimatedTokens > maxInputTokensPerTask) {
    throw createLlmRuntimeError("输入内容超过单任务 Token 上限", {
      taskType,
      estimatedTokens,
      maxInputTokensPerTask
    });
  }

  runtimeGuard?.assertRequestAllowed?.({
    taskType,
    requestsPerMinute: settings?.requestsPerMinute
  });
}

function createLlmRuntimeGuard({ now } = {}) {
  const clock = typeof now === "function" ? now : () => Date.now();
  const requestTimestamps = [];
  return {
    assertRequestAllowed({ taskType, requestsPerMinute } = {}) {
      const limit = normalizeRuntimeLimit(requestsPerMinute, LLM_RUNTIME_LIMITS.requestsPerMinute);
      const current = Number(clock());
      const cutoff = current - LLM_RUNTIME_LIMITS.windowMs;
      while (requestTimestamps.length && requestTimestamps[0] <= cutoff) {
        requestTimestamps.shift();
      }
      if (requestTimestamps.length >= limit) {
        throw createLlmRuntimeError("请求过于频繁，请稍后再试", {
          taskType,
          requestsInWindow: requestTimestamps.length,
          requestsPerMinute: limit,
          windowMs: LLM_RUNTIME_LIMITS.windowMs
        });
      }
      requestTimestamps.push(current);
      return {
        requestsInWindow: requestTimestamps.length,
        requestsPerMinute: limit,
        windowMs: LLM_RUNTIME_LIMITS.windowMs
      };
    }
  };
}

function estimatePromptTokens(prompt) {
  const value = cleanDisplayText(prompt);
  if (!value) {
    return 0;
  }
  const cjkPattern = /[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/g;
  const cjkCount = (value.match(cjkPattern) || []).length;
  const nonCjkCharacters = value.replace(cjkPattern, "").replace(/\s+/g, "").length;
  return cjkCount + Math.ceil(nonCjkCharacters / 4);
}

function normalizeRuntimeLimit(value, rule) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return rule.defaultValue;
  }
  return Math.min(rule.max, Math.max(rule.min, Math.round(numeric)));
}

function createLlmRuntimeError(message, metadata) {
  const error = new Error(message);
  error.name = "LlmRuntimeGuardError";
  Object.assign(error, metadata);
  return error;
}

function cleanDisplayText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const WorkbenchLlmRuntimeGuard = {
  LLM_RUNTIME_LIMITS,
  assertLlmRuntimeRequestAllowed,
  createLlmRuntimeGuard,
  estimatePromptTokens
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchLlmRuntimeGuard;
}

if (typeof window !== "undefined") {
  window.WorkbenchLlmRuntimeGuard = WorkbenchLlmRuntimeGuard;
}
})();
