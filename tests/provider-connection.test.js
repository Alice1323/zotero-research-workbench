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
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "ok" } }] })
        };
      }
    }
  );

  assert.deepEqual(result, { ok: true, message: "连接成功" });
  assert.equal(calls[0].url, "https://api.example.test/v1/chat/completions");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer sk-secret");
  assert.equal(JSON.parse(calls[0].options.body).model, "moonshot-v1");
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
    { ok: false, message: "模型不可用或接口路径不兼容" }
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
