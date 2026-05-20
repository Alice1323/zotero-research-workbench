const test = require("node:test");
const assert = require("node:assert/strict");

const { createProviderSettingsController } = require("../src/core/providerSettingsController");

test("provider settings save values, show Chinese success message, and reload non-secret fields", () => {
  const store = new Map();
  const storage = {
    get(key) {
      return store.get(key);
    },
    set(key, value) {
      store.set(key, value);
    }
  };

  const document = createFakeDocument({
    baseUrl: "https://api.example.test/v1",
    apiKey: "sk-test-secret",
    model: "moonshot-v1"
  });

  const controller = createProviderSettingsController({ document, storage });
  controller.init();
  document.saveButton.click();

  assert.equal(store.get("extensions.zotero-research-workbench.provider.baseUrl"), "https://api.example.test/v1");
  assert.equal(store.get("extensions.zotero-research-workbench.provider.apiKey"), "sk-test-secret");
  assert.equal(store.get("extensions.zotero-research-workbench.provider.model"), "moonshot-v1");
  assert.equal(store.get("extensions.zotero-research-workbench.provider.timeoutMs"), 15000);
  assert.equal(store.get("extensions.zotero-research-workbench.provider.requestsPerMinute"), 20);
  assert.equal(store.get("extensions.zotero-research-workbench.provider.maxInputTokensPerTask"), 12000);
  assert.equal(document.status.textContent, "设置已保存");
  assert.equal(document.errorDetails.hidden, true);
  assert.equal(document.errorDetailText.textContent, "");

  const reloadedDocument = createFakeDocument({ baseUrl: "", apiKey: "", model: "" });
  createProviderSettingsController({ document: reloadedDocument, storage }).init();

  assert.equal(reloadedDocument.baseUrl.value, "https://api.example.test/v1");
  assert.equal(reloadedDocument.model.value, "moonshot-v1");
  assert.equal(reloadedDocument.timeoutMs.value, "15000");
  assert.equal(reloadedDocument.requestsPerMinute.value, "20");
  assert.equal(reloadedDocument.maxInputTokensPerTask.value, "12000");
  assert.equal(reloadedDocument.apiKey.value, "");
  assert.equal(reloadedDocument.apiKey.placeholder, "已保存，留空则保持不变");
});

test("provider settings save and reload bounded advanced numeric settings", () => {
  const store = new Map();
  const storage = {
    get(key) {
      return store.get(key);
    },
    set(key, value) {
      store.set(key, value);
    }
  };

  const document = createFakeDocument({
    baseUrl: "https://api.example.test/v1",
    apiKey: "sk-test-secret",
    model: "moonshot-v1",
    timeoutMs: "45000",
    requestsPerMinute: "60",
    maxInputTokensPerTask: "32000"
  });

  createProviderSettingsController({ document, storage }).init();
  document.saveButton.click();

  assert.equal(store.get("extensions.zotero-research-workbench.provider.timeoutMs"), 45000);
  assert.equal(store.get("extensions.zotero-research-workbench.provider.requestsPerMinute"), 60);
  assert.equal(store.get("extensions.zotero-research-workbench.provider.maxInputTokensPerTask"), 32000);

  const reloadedDocument = createFakeDocument({ baseUrl: "", apiKey: "", model: "" });
  createProviderSettingsController({ document: reloadedDocument, storage }).init();

  assert.equal(reloadedDocument.timeoutMs.value, "45000");
  assert.equal(reloadedDocument.requestsPerMinute.value, "60");
  assert.equal(reloadedDocument.maxInputTokensPerTask.value, "32000");
});

test("provider settings clamp invalid advanced numeric settings to safe defaults and bounds", () => {
  const store = new Map();
  const storage = {
    get(key) {
      return store.get(key);
    },
    set(key, value) {
      store.set(key, value);
    }
  };

  const document = createFakeDocument({
    baseUrl: "https://api.example.test/v1",
    apiKey: "sk-test-secret",
    model: "moonshot-v1",
    timeoutMs: "500",
    requestsPerMinute: "not-a-number",
    maxInputTokensPerTask: "999999"
  });

  createProviderSettingsController({ document, storage }).init();
  document.saveButton.click();

  assert.equal(store.get("extensions.zotero-research-workbench.provider.timeoutMs"), 1000);
  assert.equal(store.get("extensions.zotero-research-workbench.provider.requestsPerMinute"), 20);
  assert.equal(store.get("extensions.zotero-research-workbench.provider.maxInputTokensPerTask"), 200000);
  assert.equal(document.timeoutMs.value, "1000");
  assert.equal(document.requestsPerMinute.value, "20");
  assert.equal(document.maxInputTokensPerTask.value, "200000");
});

test("provider settings require base URL and model before saving", () => {
  const store = new Map();
  const storage = {
    get(key) {
      return store.get(key);
    },
    set(key, value) {
      store.set(key, value);
    }
  };
  const document = createFakeDocument({ baseUrl: "", apiKey: "sk-test-secret", model: "" });

  createProviderSettingsController({ document, storage }).init();
  document.saveButton.click();

  assert.equal(document.status.textContent, "请填写接口地址和模型名称");
  assert.equal(document.errorDetails.hidden, true);
  assert.equal(document.errorDetailText.textContent, "");
  assert.equal(store.size, 0);
});

test("provider settings do not show success when storage is unavailable", () => {
  const storage = {
    get() {
      return "";
    },
    set() {
      throw new Error("storage unavailable");
    }
  };
  const document = createFakeDocument({
    baseUrl: "https://api.example.test/v1",
    apiKey: "sk-test-secret",
    model: "moonshot-v1"
  });

  createProviderSettingsController({ document, storage }).init();
  document.saveButton.click();

  assert.equal(document.status.textContent, "设置保存失败，请重启 Zotero 后再试");
  assert.equal(document.errorDetails.hidden, false);
  assert.equal(document.errorDetails.hasAttribute("hidden"), false);
  assert.match(document.errorDetailText.textContent, /storage unavailable/);
  assert.doesNotMatch(document.errorDetailText.textContent, /sk-test-secret/);
});

test("provider settings test button reads saved settings and reports connection result", async () => {
  const store = new Map([
    ["extensions.zotero-research-workbench.provider.baseUrl", "https://api.example.test/v1"],
    ["extensions.zotero-research-workbench.provider.apiKey", "sk-test-secret"],
    ["extensions.zotero-research-workbench.provider.model", "moonshot-v1"],
    ["extensions.zotero-research-workbench.provider.timeoutMs", 45000],
    ["extensions.zotero-research-workbench.provider.requestsPerMinute", 60],
    ["extensions.zotero-research-workbench.provider.maxInputTokensPerTask", 32000]
  ]);
  const storage = {
    get(key) {
      return store.get(key);
    },
    set(key, value) {
      store.set(key, value);
    }
  };
  const document = createFakeDocument({ baseUrl: "", apiKey: "", model: "" });

  createProviderSettingsController({
    document,
    storage,
    testConnection: async (settings, options) => {
      assert.equal(settings.baseUrl, "https://api.example.test/v1");
      assert.equal(settings.apiKey, "sk-test-secret");
      assert.equal(settings.model, "moonshot-v1");
      assert.equal(settings.timeoutMs, 45000);
      assert.equal(settings.requestsPerMinute, 60);
      assert.equal(settings.maxInputTokensPerTask, 32000);
      assert.deepEqual(options, { timeoutMs: 45000 });
      return { ok: true, message: "连接成功" };
    }
  }).init();

  await document.testButton.click();

  assert.equal(document.status.textContent, "连接成功");
  assert.equal(document.errorDetails.hidden, true);
  assert.equal(document.errorDetailText.textContent, "");
});

test("provider settings connection failures show layered technical details without secrets", async () => {
  const store = new Map([
    ["extensions.zotero-research-workbench.provider.baseUrl", "https://api.example.test/v1"],
    ["extensions.zotero-research-workbench.provider.apiKey", "sk-test-secret"],
    ["extensions.zotero-research-workbench.provider.model", "moonshot-v1"]
  ]);
  const storage = {
    get(key) {
      return store.get(key);
    },
    set(key, value) {
      store.set(key, value);
    }
  };
  const document = createFakeDocument({ baseUrl: "", apiKey: "", model: "" });

  createProviderSettingsController({
    document,
    storage,
    testConnection: async () => ({ ok: false, message: "API 密钥无效" })
  }).init();

  await document.testButton.click();

  assert.equal(document.status.textContent, "API 密钥无效");
  assert.equal(document.errorDetails.hidden, false);
  assert.equal(document.errorDetails.hasAttribute("hidden"), false);
  assert.match(document.errorDetailText.textContent, /provider connection test failed/);
  assert.doesNotMatch(document.errorDetailText.textContent, /sk-test-secret/);
});

test("provider settings connection exceptions show fallback message and redacted details", async () => {
  const store = new Map([
    ["extensions.zotero-research-workbench.provider.baseUrl", "https://api.example.test/v1"],
    ["extensions.zotero-research-workbench.provider.apiKey", "sk-test-secret"],
    ["extensions.zotero-research-workbench.provider.model", "moonshot-v1"]
  ]);
  const storage = {
    get(key) {
      return store.get(key);
    },
    set(key, value) {
      store.set(key, value);
    }
  };
  const document = createFakeDocument({ baseUrl: "", apiKey: "", model: "" });
  const error = new Error("network failed with sk-test-secret");
  error.authorization = "Bearer runtime-token-secret";

  createProviderSettingsController({
    document,
    storage,
    testConnection: async () => {
      throw error;
    }
  }).init();

  await document.testButton.click();

  assert.equal(document.status.textContent, "测试连接失败");
  assert.equal(document.errorDetails.hidden, false);
  assert.equal(document.errorDetails.hasAttribute("hidden"), false);
  assert.match(document.errorDetailText.textContent, /network failed/);
  assert.doesNotMatch(document.errorDetailText.textContent, /sk-test-secret/);
  assert.doesNotMatch(document.errorDetailText.textContent, /runtime-token-secret/);
});

function createFakeDocument(values) {
  const elements = {
    "provider-base-url": { value: values.baseUrl, placeholder: "" },
    "provider-api-key": { value: values.apiKey, placeholder: "" },
    "provider-model": { value: values.model, placeholder: "" },
    "provider-timeout-ms": { value: values.timeoutMs || "", placeholder: "" },
    "provider-requests-per-minute": { value: values.requestsPerMinute || "", placeholder: "" },
    "provider-max-input-tokens": { value: values.maxInputTokensPerTask || "", placeholder: "" },
    "provider-status": { textContent: "" },
    "provider-error-details": createDetails(),
    "provider-error-detail-text": { textContent: "" },
    "provider-save": createButton(),
    "provider-test": createButton()
  };

  return {
    baseUrl: elements["provider-base-url"],
    apiKey: elements["provider-api-key"],
    model: elements["provider-model"],
    timeoutMs: elements["provider-timeout-ms"],
    requestsPerMinute: elements["provider-requests-per-minute"],
    maxInputTokensPerTask: elements["provider-max-input-tokens"],
    status: elements["provider-status"],
    errorDetails: elements["provider-error-details"],
    errorDetailText: elements["provider-error-detail-text"],
    saveButton: elements["provider-save"],
    testButton: elements["provider-test"],
    getElementById(id) {
      return elements[id] || null;
    }
  };
}

function createButton() {
  return {
    listener: null,
    addEventListener(_event, listener) {
      this.listener = listener;
    },
    click() {
      return this.listener();
    }
  };
}

function createDetails() {
  return {
    hidden: true,
    open: false,
    attributes: new Set(["hidden"]),
    removeAttribute(name) {
      this.attributes.delete(name);
      if (name === "hidden") {
        this.hidden = false;
      }
    },
    setAttribute(name, _value) {
      this.attributes.add(name);
      if (name === "hidden") {
        this.hidden = true;
      }
    },
    hasAttribute(name) {
      return this.attributes.has(name);
    }
  };
}
