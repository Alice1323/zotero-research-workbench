const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { createBrowserFetchRuntime, createWorkbenchFetchRuntime } = require("../src/core/workbenchFetchRuntime");

const root = path.resolve(__dirname, "..");

test("fetch runtime binds requests to the injected window fetch adapter", async () => {
  const calls = [];
  const windowAdapter = {
    marker: "window-adapter",
    fetch(url, options) {
      calls.push([this.marker, url, options.method]);
      return Promise.resolve({ ok: true, status: 200 });
    }
  };
  const runtime = createWorkbenchFetchRuntime({ window: windowAdapter });

  const response = await runtime.fetch("https://example.invalid/chat", { method: "POST" });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [["window-adapter", "https://example.invalid/chat", "POST"]]);
});

test("fetch runtime reports unsupported runtime when fetch is unavailable", async () => {
  const runtime = createWorkbenchFetchRuntime({ window: {} });

  await assert.rejects(
    runtime.fetch("https://example.invalid/chat", { method: "POST" }),
    /当前 Zotero 环境不支持网络请求/
  );
});

test("fetch runtime aborts requests after timeoutMs", async () => {
  let aborted = false;
  const runtime = createWorkbenchFetchRuntime({
    window: {
      AbortController,
      fetch(_url, options = {}) {
        options.signal.addEventListener("abort", () => {
          aborted = true;
        });
        return new Promise(() => {});
      }
    }
  });

  await assert.rejects(
    runtime.fetch("https://example.invalid/slow", { timeoutMs: 1 }),
    /请求超时/
  );
  assert.equal(aborted, true);
});

test("browser fetch runtime exposes the same interface to browser runtime scripts", () => {
  const source = fs.readFileSync(path.join(root, "src/core/workbenchFetchRuntime.js"), "utf8");
  const context = { window: { fetch() {} } };

  vm.runInNewContext(source, context, { filename: "workbenchFetchRuntime.js" });

  assert.equal(typeof context.window.WorkbenchFetchRuntime.createWorkbenchFetchRuntime, "function");
  assert.equal(typeof context.window.WorkbenchFetchRuntime.createBrowserFetchRuntime, "function");
});

test("browser fetch runtime reads fetch from the current window", async () => {
  const runtime = createBrowserFetchRuntime({
    window: {
      fetch() {
        return Promise.resolve({ ok: true, status: 204 });
      }
    }
  });

  const response = await runtime.fetch("https://example.invalid/ping", {});

  assert.equal(response.status, 204);
});

test("fetch runtime uses Zotero HTTP for requests with explicit Cookie headers", async () => {
  const calls = [];
  const runtime = createWorkbenchFetchRuntime({
    window: {
      fetch() {
        throw new Error("window.fetch should not receive Cookie headers");
      },
      Zotero: {
        HTTP: {
          async request(method, url, options = {}) {
            calls.push({ method, url, headers: options.headers, responseType: options.responseType });
            return {
              status: 200,
              statusText: "OK",
              responseText: "{\"ok\":true}",
              getResponseHeader(name) {
                return name.toLowerCase() === "content-type" ? "application/json" : "";
              }
            };
          }
        }
      }
    }
  });

  const response = await runtime.fetch("https://example.invalid/challenge", {
    headers: { Cookie: "acw_sc__v2=abc123" },
    timeoutMs: 5000
  });

  assert.deepEqual(calls, [{
    method: "GET",
    url: "https://example.invalid/challenge",
    headers: { Cookie: "acw_sc__v2=abc123" },
    responseType: "text"
  }]);
  assert.equal(response.ok, true);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.equal(await response.text(), "{\"ok\":true}");
  assert.deepEqual(await response.json(), { ok: true });
});
