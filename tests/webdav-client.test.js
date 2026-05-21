const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { createWebDavClient } = require("../src/core/webDavClient");

const root = path.resolve(__dirname, "..");

test("WebDAV client sends requests through the injected fetch adapter", async () => {
  const calls = [];
  const response = { ok: true, status: 204 };
  const client = createWebDavClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response;
    }
  });

  const result = await client.requestWebDav("https://dav.example.test/zotero/state.json", {
    method: "PUT",
    headers: { Authorization: "Basic redacted" },
    body: "{}"
  });

  assert.equal(result, response);
  assert.deepEqual(calls, [
    {
      url: "https://dav.example.test/zotero/state.json",
      options: {
        method: "PUT",
        headers: { Authorization: "Basic redacted" },
        body: "{}"
      }
    }
  ]);
});

test("WebDAV client reports unsupported runtime when no fetch adapter exists", async () => {
  const client = createWebDavClient();

  await assert.rejects(
    () => client.requestWebDav("https://dav.example.test/", { method: "PROPFIND" }),
    /当前 Zotero 环境不支持 WebDAV 请求/
  );
});

test("WebDAV client exposes the same interface to browser runtime scripts", () => {
  const source = fs.readFileSync(path.join(root, "src/core/webDavClient.js"), "utf8");
  const context = {
    window: {}
  };

  vm.runInNewContext(source, context, { filename: "webDavClient.js" });

  assert.equal(typeof context.window.WorkbenchWebDavClient.createWebDavClient, "function");
});
