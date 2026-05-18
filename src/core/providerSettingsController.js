const PROVIDER_PREFS = {
  baseUrl: "extensions.zotero-research-workbench.provider.baseUrl",
  apiKey: "extensions.zotero-research-workbench.provider.apiKey",
  model: "extensions.zotero-research-workbench.provider.model"
};

function createProviderSettingsController({ document, storage }) {
  const fields = {
    baseUrl: document.getElementById("provider-base-url"),
    apiKey: document.getElementById("provider-api-key"),
    model: document.getElementById("provider-model"),
    status: document.getElementById("provider-status"),
    saveButton: document.getElementById("provider-save"),
    testButton: document.getElementById("provider-test")
  };

  function init() {
    load();
    fields.saveButton.addEventListener("click", save);
    fields.testButton.addEventListener("click", () => {
      fields.status.textContent = "测试连接将在下一步接入";
    });
  }

  function load() {
    const baseUrl = storage.get(PROVIDER_PREFS.baseUrl);
    const model = storage.get(PROVIDER_PREFS.model);
    const apiKey = storage.get(PROVIDER_PREFS.apiKey);

    if (baseUrl) {
      fields.baseUrl.value = baseUrl;
    }
    if (model) {
      fields.model.value = model;
    }
    if (apiKey) {
      fields.apiKey.value = "";
      fields.apiKey.placeholder = "已保存，留空则保持不变";
    }
  }

  function save() {
    const baseUrl = fields.baseUrl.value.trim();
    const model = fields.model.value.trim();
    const apiKey = fields.apiKey.value.trim();

    if (!baseUrl || !model) {
      fields.status.textContent = "请填写接口地址和模型名称";
      return;
    }

    try {
      storage.set(PROVIDER_PREFS.baseUrl, baseUrl);
      storage.set(PROVIDER_PREFS.model, model);
      if (apiKey) {
        storage.set(PROVIDER_PREFS.apiKey, apiKey);
        fields.apiKey.value = "";
        fields.apiKey.placeholder = "已保存，留空则保持不变";
      }
    } catch (_error) {
      fields.status.textContent = "设置保存失败，请重启 Zotero 后再试";
      return;
    }
    fields.status.textContent = "设置已保存";
  }

  return { init, load, save };
}

module.exports = {
  PROVIDER_PREFS,
  createProviderSettingsController
};
