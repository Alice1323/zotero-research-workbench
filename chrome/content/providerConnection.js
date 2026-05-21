(function () {
  const {
    requestOpenAICompatibleChatCompletionResponse,
    requestOpenAICompatibleModelsResponse
  } = window.WorkbenchProviderChatCompletion;

  async function testOpenAICompatibleConnection(settings, options = {}) {
    const baseUrl = (settings.baseUrl || "").trim();
    const apiKey = (settings.apiKey || "").trim();
    const model = (settings.model || "").trim();
    const fetchImpl = options.fetch || window.fetch?.bind(window);
    const timeoutMs = normalizeTimeoutMs(options.timeoutMs ?? settings.timeoutMs);

    if (!baseUrl || !model) {
      return { ok: false, message: "请先保存接口地址和模型名称" };
    }
    if (!apiKey) {
      return { ok: false, message: "请先填写并保存 API 密钥" };
    }
    if (!fetchImpl) {
      return { ok: false, message: "当前环境不支持网络请求" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const providerSettings = { baseUrl, apiKey, model };
      const modelCheck = await inspectModelList({
        settings: providerSettings,
        fetchImpl,
        signal: controller.signal
      });
      if (modelCheck.fatal) {
        return { ok: false, message: modelCheck.message };
      }

      const response = await requestChatCompletion({ settings: providerSettings, fetchImpl, signal: controller.signal });

      if (response.ok) {
        if (!(await hasOpenAIChatCompletionContent(response))) {
          return { ok: false, message: "接口返回格式不是 OpenAI 兼容响应，请检查接口地址" };
        }
        if (!modelCheck.modelListed) {
          const probeCheck = await verifyImpossibleModelIsRejected({
            settings: providerSettings,
            fetchImpl,
            signal: controller.signal
          });
          if (!probeCheck.ok) {
            return probeCheck;
          }
          if (probeCheck.warning) {
            return probeCheck;
          }
        }
        return {
          ok: true,
          message: modelCheck.listAvailable ? "连接成功" : "连接成功（模型列表不可用，已通过实际请求验证）"
        };
      }
      if (response.status === 401 || response.status === 403) {
        return { ok: false, message: "API 密钥无效" };
      }
      if (response.status === 408 || response.status === 504) {
        return { ok: false, message: "请求超时" };
      }
      const bodyText = await readResponseText(response);
      if (isModelErrorResponse(response.status, bodyText)) {
        return { ok: false, message: "模型不可用", details: createProviderResponseDetails(response.status, bodyText) };
      }
      if (modelCheck.listAvailable && !modelCheck.modelListed) {
        return { ok: false, message: "模型不可用", details: createProviderResponseDetails(response.status, bodyText) };
      }
      return {
        ok: false,
        message: `连接失败（HTTP ${response.status}）`,
        details: createProviderResponseDetails(response.status, bodyText)
      };
    } catch (error) {
      if (error && error.name === "AbortError") {
        return { ok: false, message: "请求超时" };
      }
      return { ok: false, message: "接口地址不可用" };
    } finally {
      clearTimeout(timer);
    }
  }

  async function requestChatCompletion({ settings, fetchImpl, signal }) {
    return requestOpenAICompatibleChatCompletionResponse({
      settings,
      prompt: "ping",
      temperature: 0,
      maxTokens: 1,
      fetchImpl,
      signal
    });
  }

  async function inspectModelList({ settings, fetchImpl, signal }) {
    const response = await requestOpenAICompatibleModelsResponse({
      settings,
      fetchImpl,
      signal
    });

    if (response.status === 401 || response.status === 403) {
      return { fatal: true, message: "API 密钥无效" };
    }
    if (!response.ok) {
      return { fatal: false, listAvailable: false };
    }

    const body = await readResponseJson(response);
    if (!body) {
      return { fatal: false, listAvailable: false };
    }
    const modelIds = Array.isArray(body.data)
      ? body.data.map((entry) => entry && entry.id).filter(Boolean)
      : [];
    return { fatal: false, listAvailable: true, modelListed: modelIds.includes(settings.model) };
  }

  async function verifyImpossibleModelIsRejected({ settings, fetchImpl, signal }) {
    const response = await requestChatCompletion({
      settings: {
        ...settings,
        model: "zotero-research-workbench-invalid-model-probe"
      },
      fetchImpl,
      signal
    });

    if (response.ok) {
      return {
        ok: true,
        warning: true,
        message: "连接可用，但接口未校验模型名称，请确认模型名称已填写正确"
      };
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "API 密钥无效" };
    }
    if (response.status === 408 || response.status === 504) {
      return { ok: false, message: "请求超时" };
    }
    if ([400, 404, 422].includes(response.status)) {
      return { ok: true };
    }
    const bodyText = await readResponseText(response);
    return {
      ok: false,
      message: `模型验证失败（HTTP ${response.status}）`,
      details: createProviderResponseDetails(response.status, bodyText)
    };
  }

  async function hasOpenAIChatCompletionContent(response) {
    const body = await readResponseJson(response);
    return Boolean(cleanString(body?.choices?.[0]?.message?.content));
  }

  async function readResponseJson(response) {
    try {
      return await response.json();
    } catch (_error) {
      return null;
    }
  }

  async function readResponseText(response) {
    try {
      return await response.text();
    } catch (_error) {
      return "";
    }
  }

  function isModelErrorResponse(status, bodyText) {
    if (![400, 404, 422].includes(status)) {
      return false;
    }
    const text = String(bodyText || "").toLowerCase();
    const mentionsModel = text.includes("model") || text.includes("模型");
    const saysUnavailable = [
      "not found",
      "does not exist",
      "not exist",
      "invalid",
      "unknown",
      "unsupported",
      "not supported",
      "不存在",
      "未找到",
      "不可用",
      "无效",
      "不支持"
    ].some((marker) => text.includes(marker));
    return mentionsModel && saysUnavailable;
  }

  function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeTimeoutMs(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 15000;
    }
    return Math.round(numeric);
  }

  function createProviderResponseDetails(status, bodyText) {
    const normalizedBody = cleanString(bodyText);
    if (!normalizedBody) {
      return `provider response HTTP ${status}`;
    }
    return `provider response HTTP ${status}:\n${sanitizeSecretText(normalizedBody)}`;
  }

  function sanitizeSecretText(value) {
    return String(value)
      .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1<redacted>")
      .replace(/\b(Basic\s+)[A-Za-z0-9+/=]+/gi, "$1<redacted>")
      .replace(/\bsk-[A-Za-z0-9._-]+/g, "<redacted>")
      .replace(/\b(apiKey|password|token|secret)\b\s*([:=])\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi, (_match, key, separator) => {
        return `${key}${separator}<redacted>`;
      });
  }

  window.WorkbenchProviderConnection = {
    testOpenAICompatibleConnection
  };
})();
