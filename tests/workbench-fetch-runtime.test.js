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
