const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  buildOpenAIChatCompletionsUrl,
  buildOpenAIModelsUrl,
  createOpenAICompatibleChatCompletionRequest,
  createOpenAICompatibleModelsRequest,
  parseChatCompletionText,
  requestOpenAICompatibleChatCompletionResponse,
  requestOpenAICompatibleModelsResponse,
  requestOpenAICompatibleChatCompletion
} = require("../src/core/providerChatCompletion");

const root = path.resolve(__dirname, "..");

test("provider chat completion module builds OpenAI-compatible requests", () => {
  const signal = { aborted: false };
  const request = createOpenAICompatibleChatCompletionRequest({
    settings: {
      baseUrl: "https://api.example.test/v1/",
      apiKey: "sk-secret",
      model: "model-a"
    },
    prompt: "请总结",
    temperature: 0.2,
    maxTokens: 16,
    signal
  });
  const modelsRequest = createOpenAICompatibleModelsRequest({
    settings: {
      baseUrl: "https://api.example.test/v1/",
      apiKey: "sk-secret"
    },
    signal
  });

  assert.equal(buildOpenAIChatCompletionsUrl("https://api.example.test/v1/"), "https://api.example.test/v1/chat/completions");
  assert.equal(buildOpenAIModelsUrl("https://api.example.test/v1/"), "https://api.example.test/v1/models");
  assert.equal(request.url, "https://api.example.test/v1/chat/completions");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["Content-Type"], "application/json");
  assert.equal(request.options.headers.Authorization, "Bearer sk-secret");
  assert.equal(request.options.signal, signal);
  assert.deepEqual(JSON.parse(request.options.body), {
    model: "model-a",
    messages: [{ role: "user", content: "请总结" }],
    temperature: 0.2,
    max_tokens: 16
  });
  assert.equal(modelsRequest.url, "https://api.example.test/v1/models");
  assert.equal(modelsRequest.options.method, "GET");
  assert.equal(modelsRequest.options.headers.Authorization, "Bearer sk-secret");
  assert.equal(modelsRequest.options.signal, signal);
});

test("provider chat completion module exposes raw provider response helpers for connection probes", async () => {
  const calls = [];
  const signal = { aborted: false };

  const modelsResponse = await requestOpenAICompatibleModelsResponse({
    settings: {
      baseUrl: "https://api.example.test/v1/",
      apiKey: "sk-secret"
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200 };
    },
    signal
  });
  const chatResponse = await requestOpenAICompatibleChatCompletionResponse({
    settings: {
      baseUrl: "https://api.example.test/v1/",
      apiKey: "sk-secret",
      model: "model-a"
    },
    prompt: "ping",
    temperature: 0,
    maxTokens: 1,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200 };
    },
    signal
  });

  assert.equal(modelsResponse.status, 200);
  assert.equal(chatResponse.status, 200);
  assert.equal(calls[0].url, "https://api.example.test/v1/models");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers.Authorization, "Bearer sk-secret");
  assert.equal(calls[1].url, "https://api.example.test/v1/chat/completions");
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    model: "model-a",
    messages: [{ role: "user", content: "ping" }],
    temperature: 0,
    max_tokens: 1
  });
});

test("provider chat completion module posts through the fetch adapter and extracts assistant text", async () => {
  let requestedUrl = "";
  let requestedBody = null;

  const result = await requestOpenAICompatibleChatCompletion({
    settings: {
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-secret",
      model: "model-a"
    },
    prompt: "Prompt body",
    temperature: 0.1,
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: "  中文结果  " } }] })
      };
    }
  });

  assert.equal(requestedUrl, "https://api.example.test/v1/chat/completions");
  assert.equal(requestedBody.model, "model-a");
  assert.equal(requestedBody.messages[0].content, "Prompt body");
  assert.equal(result, "中文结果");
});

test("provider chat completion module maps provider failures to localized errors", async () => {
  await assert.rejects(
    () =>
      requestOpenAICompatibleChatCompletion({
        settings: { baseUrl: "https://api.example.test/v1", apiKey: "bad", model: "model-a" },
        prompt: "Prompt body",
        temperature: 0.2,
        failureMessage: "总结生成失败",
        fetchImpl: async () => ({ ok: false, status: 401, text: async () => "invalid key" })
      }),
    /API 密钥无效/
  );

  await assert.rejects(
    () =>
      requestOpenAICompatibleChatCompletion({
        settings: { baseUrl: "https://api.example.test/v1", apiKey: "sk-secret", model: "model-a" },
        prompt: "Prompt body",
        temperature: 0.2,
        failureMessage: "总结生成失败",
        fetchImpl: async () => ({ ok: false, status: 504, text: async () => "timeout" })
      }),
    /请求超时/
  );

  await assert.rejects(
    () =>
      requestOpenAICompatibleChatCompletion({
        settings: { baseUrl: "https://api.example.test/v1", apiKey: "sk-secret", model: "model-a" },
        prompt: "Prompt body",
        temperature: 0.2,
        failureMessage: "总结生成失败",
        fetchImpl: async () => ({ ok: false, status: 429, text: async () => "rate limited" })
      }),
    /总结生成失败（HTTP 429）/
  );
});

test("provider chat completion module reports invalid JSON and empty assistant messages", async () => {
  await assert.rejects(
    () =>
      requestOpenAICompatibleChatCompletion({
        settings: { baseUrl: "https://api.example.test/v1", apiKey: "sk-secret", model: "model-a" },
        prompt: "Prompt body",
        temperature: 0.2,
        fetchImpl: async () => ({ ok: true, status: 200, text: async () => "<html>gateway</html>" })
      }),
    /LLM 服务返回了无法解析的响应/
  );

  assert.throws(() => parseChatCompletionText({ choices: [{ message: { content: "" } }] }), /LLM 响应为空/);
});

test("provider chat completion module exposes the same interface to browser runtime scripts", () => {
  const source = fs.readFileSync(path.join(root, "src/core/providerChatCompletion.js"), "utf8");
  const context = {
    Error,
    JSON,
    Object,
    String,
    window: {}
  };

  vm.runInNewContext(source, context, { filename: "providerChatCompletion.js" });

  assert.equal(typeof context.window.WorkbenchProviderChatCompletion.requestOpenAICompatibleChatCompletion, "function");
  assert.equal(typeof context.window.WorkbenchProviderChatCompletion.requestOpenAICompatibleChatCompletionResponse, "function");
  assert.equal(typeof context.window.WorkbenchProviderChatCompletion.requestOpenAICompatibleModelsResponse, "function");
  assert.equal(
    context.window.WorkbenchProviderChatCompletion.buildOpenAIChatCompletionsUrl("https://api.example.test/v1/"),
    "https://api.example.test/v1/chat/completions"
  );
  assert.equal(
    context.window.WorkbenchProviderChatCompletion.buildOpenAIModelsUrl("https://api.example.test/v1/"),
    "https://api.example.test/v1/models"
  );
});
