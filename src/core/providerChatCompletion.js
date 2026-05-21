function buildOpenAIChatCompletionsUrl(baseUrl) {
  return `${cleanString(baseUrl).replace(/\/+$/, "")}/chat/completions`;
}

function buildOpenAIModelsUrl(baseUrl) {
  return `${cleanString(baseUrl).replace(/\/+$/, "")}/models`;
}

function createOpenAICompatibleModelsRequest({ settings, signal } = {}) {
  const options = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${cleanString(settings?.apiKey)}`
    }
  };
  if (signal) {
    options.signal = signal;
  }

  return {
    url: buildOpenAIModelsUrl(settings?.baseUrl),
    options
  };
}

function createOpenAICompatibleChatCompletionRequest({ settings, prompt, temperature, maxTokens, signal } = {}) {
  const body = {
    model: cleanString(settings?.model),
    messages: [{ role: "user", content: cleanString(prompt) }],
    temperature
  };
  const normalizedMaxTokens = Number(maxTokens);
  if (Number.isFinite(normalizedMaxTokens) && normalizedMaxTokens > 0) {
    body.max_tokens = Math.round(normalizedMaxTokens);
  }

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cleanString(settings?.apiKey)}`
    },
    body: JSON.stringify(body)
  };
  if (signal) {
    options.signal = signal;
  }

  return {
    url: buildOpenAIChatCompletionsUrl(settings?.baseUrl),
    options
  };
}

async function requestOpenAICompatibleModelsResponse({
  settings,
  fetchImpl,
  signal
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("当前环境不支持网络请求");
  }

  const request = createOpenAICompatibleModelsRequest({
    settings,
    signal
  });
  return fetchImpl(request.url, request.options);
}

async function requestOpenAICompatibleChatCompletionResponse({
  settings,
  prompt,
  temperature,
  maxTokens,
  fetchImpl,
  signal
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("当前环境不支持网络请求");
  }

  const request = createOpenAICompatibleChatCompletionRequest({
    settings,
    prompt,
    temperature,
    maxTokens,
    signal
  });
  return fetchImpl(request.url, request.options);
}

async function requestOpenAICompatibleChatCompletion({
  settings,
  prompt,
  temperature,
  maxTokens,
  fetchImpl,
  signal,
  failureMessage = "LLM 请求失败"
} = {}) {
  const response = await requestOpenAICompatibleChatCompletionResponse({
    settings,
    prompt,
    temperature,
    maxTokens,
    fetchImpl,
    signal
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("API 密钥无效");
    }
    if (response.status === 408 || response.status === 504) {
      throw new Error("请求超时");
    }
    throw new Error(`${failureMessage}（HTTP ${response.status}）`);
  }

  return parseChatCompletionText(parseJsonResponseText(await readResponseText(response)));
}

function parseChatCompletionText(body) {
  const text = body?.choices?.[0]?.message?.content;
  if (!cleanString(text)) {
    throw new Error("LLM 响应为空");
  }
  return text.trim();
}

async function readResponseText(response) {
  if (typeof response?.text === "function") {
    return response.text();
  }
  if (typeof response?.json === "function") {
    try {
      return JSON.stringify(await response.json());
    } catch (_error) {
      return "";
    }
  }
  return "";
}

function parseJsonResponseText(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error("LLM 服务返回了无法解析的响应，请检查接口地址是否为 OpenAI 兼容地址");
  }
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

const WorkbenchProviderChatCompletion = {
  buildOpenAIChatCompletionsUrl,
  buildOpenAIModelsUrl,
  createOpenAICompatibleChatCompletionRequest,
  createOpenAICompatibleModelsRequest,
  parseChatCompletionText,
  requestOpenAICompatibleChatCompletionResponse,
  requestOpenAICompatibleModelsResponse,
  requestOpenAICompatibleChatCompletion
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchProviderChatCompletion;
}

if (typeof window !== "undefined") {
  window.WorkbenchProviderChatCompletion = WorkbenchProviderChatCompletion;
}
