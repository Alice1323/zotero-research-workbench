const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { createBrowserClipboardWriter, createClipboardWriter } = require("../src/core/clipboardWriter");

const root = path.resolve(__dirname, "..");

test("clipboard writer uses the injected async clipboard adapter when available", async () => {
  const calls = [];
  const writer = createClipboardWriter({
    writeText: async (text) => {
      calls.push(text);
    }
  });

  await writer.writeClipboardText("生成结果");

  assert.deepEqual(calls, ["生成结果"]);
});

test("clipboard writer falls back to a hidden textarea and document copy command", async () => {
  const calls = [];
  const textarea = {
    style: {},
    setAttribute(name, value) {
      calls.push(["setAttribute", name, value]);
    },
    select() {
      calls.push(["select"]);
    },
    remove() {
      calls.push(["remove"]);
    }
  };
  const documentAdapter = {
    body: {
      appendChild(node) {
        calls.push(["appendChild", node.value]);
      }
    },
    execCommand(command) {
      calls.push(["execCommand", command]);
      return true;
    }
  };
  const writer = createClipboardWriter({
    document: documentAdapter,
    createElement: () => textarea
  });

  await writer.writeClipboardText("复制内容");

  assert.equal(textarea.value, "复制内容");
  assert.equal(textarea.style.position, "fixed");
  assert.equal(textarea.style.inset, "-1000px auto auto -1000px");
  assert.deepEqual(calls, [
    ["setAttribute", "readonly", "readonly"],
    ["appendChild", "复制内容"],
    ["select"],
    ["execCommand", "copy"],
    ["remove"]
  ]);
});

test("clipboard writer reports fallback copy failures", async () => {
  const textarea = {
    style: {},
    setAttribute() {},
    select() {},
    remove() {}
  };
  const writer = createClipboardWriter({
    document: {
      body: {
        appendChild() {}
      },
      execCommand: () => false
    },
    createElement: () => textarea
  });

  await assert.rejects(() => writer.writeClipboardText("复制失败"), /copy failed/);
});

test("clipboard writer exposes the same interface to browser runtime scripts", () => {
  const source = fs.readFileSync(path.join(root, "src/core/clipboardWriter.js"), "utf8");
  const context = {
    window: {}
  };

  vm.runInNewContext(source, context, { filename: "clipboardWriter.js" });

  assert.equal(typeof context.window.WorkbenchClipboardWriter.createBrowserClipboardWriter, "function");
  assert.equal(typeof context.window.WorkbenchClipboardWriter.createClipboardWriter, "function");
});

test("browser clipboard writer reads the async clipboard adapter from navigator", async () => {
  const calls = [];
  const writer = createBrowserClipboardWriter({
    navigator: {
      clipboard: {
        writeText: async (text) => {
          calls.push(text);
        }
      }
    }
  });

  await writer.writeClipboardText("浏览器剪贴板");

  assert.deepEqual(calls, ["浏览器剪贴板"]);
});
