(function () {
  const PREFS = {
    baseUrl: "extensions.zotero-research-workbench.provider.baseUrl",
    apiKey: "extensions.zotero-research-workbench.provider.apiKey",
    model: "extensions.zotero-research-workbench.provider.model"
  };

  function getField(id) {
    return document.getElementById(id);
  }

  function getZotero() {
    return window.arguments?.[0]?.Zotero || window.opener?.Zotero || window.Zotero;
  }

  function getPref(key) {
    return getZotero()?.Prefs?.get(key) || "";
  }

  function setPref(key, value) {
    const zotero = getZotero();
    if (!zotero?.Prefs?.set) {
      throw new Error("Zotero preferences are unavailable");
    }
    zotero.Prefs.set(key, value);
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

    try {
      setPref(PREFS.baseUrl, baseUrl);
      setPref(PREFS.model, model);
      if (apiKey) {
        setPref(PREFS.apiKey, apiKey);
        getField("provider-api-key").value = "";
        getField("provider-api-key").placeholder = "已保存，留空则保持不变";
      }
    } catch (_error) {
      status.textContent = "设置保存失败，请重启 Zotero 后再试";
      return;
    }
    status.textContent = "设置已保存";
  }

  async function testSavedConnection() {
    const status = getField("provider-status");
    const connection = window.WorkbenchProviderConnection;
    if (!connection?.testOpenAICompatibleConnection) {
      status.textContent = "测试连接未配置";
      return;
    }

    status.textContent = "正在测试连接...";
    const result = await connection.testOpenAICompatibleConnection({
      baseUrl: getPref(PREFS.baseUrl) || getField("provider-base-url").value.trim(),
      apiKey: getPref(PREFS.apiKey) || getField("provider-api-key").value.trim(),
      model: getPref(PREFS.model) || getField("provider-model").value.trim()
    });
    status.textContent = result.message;
  }

  function init() {
    loadSettings();
    getField("provider-save").addEventListener("click", saveSettings);
    getField("provider-test").addEventListener("click", testSavedConnection);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
