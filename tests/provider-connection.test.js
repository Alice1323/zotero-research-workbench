const test = require("node:test");
const assert = require("node:assert/strict");

const { testOpenAICompatibleConnection } = require("../src/core/providerConnection");

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

  assert.deepEqual(
    await testOpenAICompatibleConnection(
      { baseUrl: "https://api.example.test/v1", apiKey: "sk-secret", model: "bad-model" },
      { fetch: async () => ({ ok: false, status: 404, text: async () => "model not found" }) }
    ),
    { ok: false, message: "模型不可用" }
  );

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

  assert.deepEqual(result, { ok: false, message: "模型不可用" });
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
