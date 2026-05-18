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
  assert.equal(document.status.textContent, "设置已保存");

  const reloadedDocument = createFakeDocument({ baseUrl: "", apiKey: "", model: "" });
  createProviderSettingsController({ document: reloadedDocument, storage }).init();

  assert.equal(reloadedDocument.baseUrl.value, "https://api.example.test/v1");
  assert.equal(reloadedDocument.model.value, "moonshot-v1");
  assert.equal(reloadedDocument.apiKey.value, "");
  assert.equal(reloadedDocument.apiKey.placeholder, "已保存，留空则保持不变");
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
});

function createFakeDocument(values) {
  const elements = {
    "provider-base-url": { value: values.baseUrl, placeholder: "" },
    "provider-api-key": { value: values.apiKey, placeholder: "" },
    "provider-model": { value: values.model, placeholder: "" },
    "provider-status": { textContent: "" },
    "provider-save": createButton(),
    "provider-test": createButton()
  };

  return {
    baseUrl: elements["provider-base-url"],
    apiKey: elements["provider-api-key"],
    model: elements["provider-model"],
    status: elements["provider-status"],
    saveButton: elements["provider-save"],
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
      this.listener();
    }
  };
}
