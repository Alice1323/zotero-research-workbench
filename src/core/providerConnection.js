async function testOpenAICompatibleConnection(settings, options = {}) {
  const baseUrl = (settings.baseUrl || "").trim();
  const apiKey = (settings.apiKey || "").trim();
  const model = (settings.model || "").trim();
  const fetchImpl = options.fetch || globalThis.fetch;
  const timeoutMs = options.timeoutMs || 15000;

  if (!baseUrl || !model) {
    return { ok: false, message: "请先保存接口地址和模型名称" };
  }
  if (!apiKey) {
    return { ok: false, message: "请先填写并保存 API 密钥" };
  }
  if (!fetchImpl) {
    return { ok: false, message: "当前环境不支持网络请求" };
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const modelCheck = await verifyModelIsAvailable({ baseUrl, apiKey, model, fetchImpl, signal: controller?.signal });
    if (!modelCheck.ok) {
      return modelCheck;
    }

    const response = await fetchImpl(buildChatCompletionsUrl(baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        temperature: 0
      }),
      signal: controller?.signal
    });

    if (response.ok) {
      return { ok: true, message: "连接成功" };
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "API 密钥无效" };
    }
    if (response.status === 404) {
      return { ok: false, message: "模型不可用或接口路径不兼容" };
    }
    if (response.status === 408 || response.status === 504) {
      return { ok: false, message: "请求超时" };
    }
    return { ok: false, message: `连接失败（HTTP ${response.status}）` };
  } catch (error) {
    if (error && error.name === "AbortError") {
      return { ok: false, message: "请求超时" };
    }
    return { ok: false, message: "接口地址不可用" };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function buildChatCompletionsUrl(baseUrl) {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function buildModelsUrl(baseUrl) {
  return `${baseUrl.replace(/\/+$/, "")}/models`;
}

async function verifyModelIsAvailable({ baseUrl, apiKey, model, fetchImpl, signal }) {
  const response = await fetchImpl(buildModelsUrl(baseUrl), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    signal
  });

  if (response.status === 401 || response.status === 403) {
    return { ok: false, message: "API 密钥无效" };
  }
  if (!response.ok) {
    return { ok: false, message: `模型列表读取失败（HTTP ${response.status}）` };
  }

  const body = await response.json();
  const modelIds = Array.isArray(body.data)
    ? body.data.map((entry) => entry && entry.id).filter(Boolean)
    : [];
  if (!modelIds.includes(model)) {
    return { ok: false, message: "模型不可用" };
  }
  return { ok: true, message: "模型可用" };
}

module.exports = {
  buildChatCompletionsUrl,
  buildModelsUrl,
  testOpenAICompatibleConnection
};
