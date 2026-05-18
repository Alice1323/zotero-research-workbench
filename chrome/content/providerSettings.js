(function () {
  const PREFS = {
    baseUrl: "extensions.zotero-research-workbench.provider.baseUrl",
    apiKey: "extensions.zotero-research-workbench.provider.apiKey",
    model: "extensions.zotero-research-workbench.provider.model"
  };

  function getField(id) {
    return document.getElementById(id);
  }

  function getPref(key) {
    return window.Zotero?.Prefs?.get(key) || "";
  }

  function setPref(key, value) {
    window.Zotero?.Prefs?.set(key, value);
  }

  function loadSettings() {
    const baseUrl = getPref(PREFS.baseUrl);
    const model = getPref(PREFS.model);
    const apiKey = getPref(PREFS.apiKey);

    if (baseUrl) {
      getField("provider-base-url").value = baseUrl;
    }
    if (model) {
      getField("provider-model").value = model;
    }
    if (apiKey) {
      getField("provider-api-key").value = "";
      getField("provider-api-key").placeholder = "已保存，留空则保持不变";
    }
  }

  function saveSettings() {
    const baseUrl = getField("provider-base-url").value.trim();
    const model = getField("provider-model").value.trim();
    const apiKey = getField("provider-api-key").value.trim();
    const status = getField("provider-status");

    if (!baseUrl || !model) {
      status.textContent = "请填写接口地址和模型名称";
      return;
    }

    setPref(PREFS.baseUrl, baseUrl);
    setPref(PREFS.model, model);
    if (apiKey) {
      setPref(PREFS.apiKey, apiKey);
      getField("provider-api-key").value = "";
      getField("provider-api-key").placeholder = "已保存，留空则保持不变";
    }
    status.textContent = "设置已保存";
  }

  function init() {
    loadSettings();
    getField("provider-save").addEventListener("click", saveSettings);
    getField("provider-test").addEventListener("click", () => {
      getField("provider-status").textContent = "测试连接将在下一步接入";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
