const test = require("node:test");
const assert = require("node:assert/strict");

const providerConnection = require("../src/core/providerConnection");
const { testOpenAICompatibleConnection } = providerConnection;

test("provider connection module leaves OpenAI request construction to provider chat completion module", () => {
  assert.equal(providerConnection.buildChatCompletionsUrl, undefined);
  assert.equal(providerConnection.buildModelsUrl, undefined);
});

test("connection test sends minimal OpenAI-compatible request and returns Chinese success", async () => {
  const calls = [];
  const result = await testOpenAICompatibleConnection(
    {
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-secret",
      model: "moonshot-v1"
    },
    {
      fetch: async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/models")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: "moonshot-v1" }] })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "ok" } }] })
        };
      }
    }
  );

  assert.deepEqual(result, { ok: true, message: "连接成功" });
  assert.equal(calls[0].url, "https://api.example.test/v1/models");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers.Authorization, "Bearer sk-secret");
  assert.equal(calls[1].url, "https://api.example.test/v1/chat/completions");
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.headers.Authorization, "Bearer sk-secret");
  assert.equal(JSON.parse(calls[1].options.body).model, "moonshot-v1");
});

test("connection test requires API key without echoing it", async () => {
  const result = await testOpenAICompatibleConnection({
    baseUrl: "https://api.example.test/v1",
    apiKey: "",
    model: "moonshot-v1"
  });

  assert.deepEqual(result, { ok: false, message: "请先填写并保存 API 密钥" });
});

test("connection test maps auth, model, network, and timeout failures to Chinese messages", async () => {
  assert.deepEqual(
    await testOpenAICompatibleConnection(
      { baseUrl: "https://api.example.test/v1", apiKey: "sk-secret", model: "bad-model" },
      { fetch: async () => ({ ok: false, status: 401, text: async () => "invalid key" }) }
    ),
    { ok: false, message: "API 密钥无效" }
  );

  const modelErrorResult = await testOpenAICompatibleConnection(
      { baseUrl: "https://api.example.test/v1", apiKey: "sk-secret", model: "bad-model" },
      { fetch: async () => ({ ok: false, status: 404, text: async () => "model not found" }) }
  );
  assert.equal(modelErrorResult.ok, false);
  assert.equal(modelErrorResult.message, "模型不可用");
  assert.match(modelErrorResult.details, /provider response HTTP 404/);
  assert.match(modelErrorResult.details, /model not found/);

  assert.deepEqual(
    await testOpenAICompatibleConnection(
      { baseUrl: "https://api.example.test/v1", apiKey: "sk-secret", model: "moonshot-v1" },
      {
        fetch: async () => {
          throw new Error("getaddrinfo ENOTFOUND");
        }
      }
    ),
    { ok: false, message: "接口地址不可用" }
  );

  assert.deepEqual(
    await testOpenAICompatibleConnection(
      { baseUrl: "https://api.example.test/v1", apiKey: "sk-secret", model: "moonshot-v1" },
      {
        fetch: async () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          throw error;
        }
      }
    ),
    { ok: false, message: "请求超时" }
  );
});

test("connection test accepts detectable model when /models omits alias but chat succeeds", async () => {
  const calls = [];
  const result = await testOpenAICompatibleConnection(
    {
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-secret",
      model: "provider-alias-model"
    },
    {
      fetch: async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/models")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ id: "moonshot-v1" }, { id: "deepseek-chat" }]
            })
          };
        }
        const body = JSON.parse(options.body);
        if (body.model.includes("invalid-model-probe")) {
          return {
            ok: false,
            status: 400,
            text: async () => "model invalid-model-probe not found"
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "ok" } }] })
        };
      }
    }
  );

  assert.deepEqual(result, { ok: true, message: "连接成功" });
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "https://api.example.test/v1/models",
      "https://api.example.test/v1/chat/completions",
      "https://api.example.test/v1/chat/completions"
    ]
  );
  assert.equal(JSON.parse(calls[1].options.body).model, "provider-alias-model");
  assert.match(JSON.parse(calls[2].options.body).model, /invalid-model-probe/);
});

test("connection test rejects model when chat response explicitly reports model error", async () => {
  const result = await testOpenAICompatibleConnection(
    {
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-secret",
      model: "definitely-not-a-real-model"
    },
    {
      fetch: async (url) => {
        if (url.endsWith("/models")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: "moonshot-v1" }] })
          };
        }
        return {
          ok: false,
          status: 400,
          text: async () => "model definitely-not-a-real-model not found"
        };
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.message, "模型不可用");
  assert.match(result.details, /provider response HTTP 400/);
  assert.match(result.details, /definitely-not-a-real-model/);
});

test("connection test reports model unavailable when listed models exclude it and chat returns generic provider error", async () => {
  const result = await testOpenAICompatibleConnection(
    {
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-secret",
      model: "wrong-model-name"
    },
    {
      fetch: async (url) => {
        if (url.endsWith("/models")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: "moonshot-v1" }, { id: "deepseek-chat" }] })
          };
        }
        return {
          ok: false,
          status: 503,
          text: async () => JSON.stringify({
            error: {
              message: "Service temporarily unavailable",
              type: "api_error"
            }
          })
        };
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.message, "模型不可用");
  assert.match(result.details, /provider response HTTP 503/);
  assert.match(result.details, /Service temporarily unavailable/);
});

test("connection test can pass when /models endpoint is unsupported but chat succeeds", async () => {
  const result = await testOpenAICompatibleConnection(
    {
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-secret",
      model: "chat-only-model"
    },
    {
      fetch: async (url, options) => {
        if (url.endsWith("/models")) {
          return { ok: false, status: 404, text: async () => "not found" };
        }
        const body = JSON.parse(options.body);
        if (body.model.includes("invalid-model-probe")) {
          return {
            ok: false,
            status: 400,
            text: async () => "model invalid-model-probe not found"
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "ok" } }] })
        };
      }
    }
  );

  assert.deepEqual(result, { ok: true, message: "连接成功（模型列表不可用，已通过实际请求验证）" });
});

test("connection test rejects HTTP 200 responses without OpenAI chat completion content", async () => {
  const result = await testOpenAICompatibleConnection(
    {
      baseUrl: "https://api.example.test/not-openai",
      apiKey: "sk-secret",
      model: "moonshot-v1"
    },
    {
      fetch: async (url) => {
        if (url.endsWith("/models")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: "moonshot-v1" }] })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: "ok", message: "not an OpenAI-compatible response" }),
          text: async () => JSON.stringify({ status: "ok", message: "not an OpenAI-compatible response" })
        };
      }
    }
  );

  assert.deepEqual(result, {
    ok: false,
    message: "接口返回格式不是 OpenAI 兼容响应，请检查接口地址"
  });
});

test("connection test keeps provider response details for generic HTTP failures", async () => {
  const result = await testOpenAICompatibleConnection(
    {
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-secret",
      model: "moonshot-v1"
    },
    {
      fetch: async (url) => {
        if (url.endsWith("/models")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: "moonshot-v1" }] })
          };
        }
        return {
          ok: false,
          status: 503,
          text: async () => JSON.stringify({
            error: {
              message: "upstream overloaded for bearer sk-secret",
              type: "server_overloaded"
            }
          })
        };
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.message, "连接失败（HTTP 503）");
  assert.match(result.details, /HTTP 503/);
  assert.match(result.details, /upstream overloaded/);
  assert.match(result.details, /server_overloaded/);
  assert.doesNotMatch(result.details, /sk-secret/);
});

test("connection test uses timeout from provider settings when no option override is supplied", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let timeoutDelay = null;
  let clearedHandle = null;

  globalThis.setTimeout = (_callback, delay) => {
    timeoutDelay = delay;
    return "provider-timeout-handle";
  };
  globalThis.clearTimeout = (handle) => {
    clearedHandle = handle;
  };

  try {
    const result = await testOpenAICompatibleConnection(
      {
        baseUrl: "https://api.example.test/v1",
        apiKey: "sk-secret",
        model: "moonshot-v1",
        timeoutMs: 42000
      },
      {
        fetch: async (url) => {
          if (url.endsWith("/models")) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ data: [{ id: "moonshot-v1" }] })
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content: "ok" } }] })
          };
        }
      }
    );

    assert.deepEqual(result, { ok: true, message: "连接成功" });
    assert.equal(timeoutDelay, 42000);
    assert.equal(clearedHandle, "provider-timeout-handle");
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("connection test warns instead of failing when provider accepts an impossible sentinel model", async () => {
  const result = await testOpenAICompatibleConnection(
    {
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-secret",
      model: "definitely-not-a-real-model"
    },
    {
      fetch: async (url) => {
        if (url.endsWith("/models")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: "moonshot-v1" }] })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "ok" } }] })
        };
      }
    }
  );

  assert.deepEqual(result, {
    ok: true,
    warning: true,
    message: "连接可用，但接口未校验模型名称，请确认模型名称已填写正确"
  });
});
