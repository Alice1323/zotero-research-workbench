const PROVIDER_PREFS = {
  baseUrl: "extensions.zotero-research-workbench.provider.baseUrl",
  apiKey: "extensions.zotero-research-workbench.provider.apiKey",
  model: "extensions.zotero-research-workbench.provider.model",
  timeoutMs: "extensions.zotero-research-workbench.provider.timeoutMs",
  requestsPerMinute: "extensions.zotero-research-workbench.provider.requestsPerMinute",
  maxInputTokensPerTask: "extensions.zotero-research-workbench.provider.maxInputTokensPerTask"
};

const PROVIDER_NUMERIC_SETTINGS = {
  timeoutMs: { defaultValue: 15000, min: 1000, max: 120000 },
  requestsPerMinute: { defaultValue: 20, min: 1, max: 600 },
  maxInputTokensPerTask: { defaultValue: 12000, min: 1000, max: 200000 }
};

const { createLayeredErrorNotice } = require("./index");

function createProviderSettingsController({ document, storage, testConnection }) {
  const fields = {
    baseUrl: document.getElementById("provider-base-url"),
    apiKey: document.getElementById("provider-api-key"),
    model: document.getElementById("provider-model"),
    timeoutMs: document.getElementById("provider-timeout-ms"),
    requestsPerMinute: document.getElementById("provider-requests-per-minute"),
    maxInputTokensPerTask: document.getElementById("provider-max-input-tokens"),
    status: document.getElementById("provider-status"),
    errorDetails: document.getElementById("provider-error-details"),
    errorDetailText: document.getElementById("provider-error-detail-text"),
    saveButton: document.getElementById("provider-save"),
    testButton: document.getElementById("provider-test")
  };

  function init() {
    load();
    fields.saveButton.addEventListener("click", save);
    fields.testButton.addEventListener("click", testSavedConnection);
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
    loadNumericField("timeoutMs");
    loadNumericField("requestsPerMinute");
    loadNumericField("maxInputTokensPerTask");
  }

  function save() {
    const baseUrl = fields.baseUrl.value.trim();
    const model = fields.model.value.trim();
    const apiKey = fields.apiKey.value.trim();
    const advancedSettings = readAdvancedSettingsFromFields();

    if (!baseUrl || !model) {
      showStatus("请填写接口地址和模型名称");
      return;
    }

    try {
      storage.set(PROVIDER_PREFS.baseUrl, baseUrl);
      storage.set(PROVIDER_PREFS.model, model);
      storage.set(PROVIDER_PREFS.timeoutMs, advancedSettings.timeoutMs);
      storage.set(PROVIDER_PREFS.requestsPerMinute, advancedSettings.requestsPerMinute);
      storage.set(PROVIDER_PREFS.maxInputTokensPerTask, advancedSettings.maxInputTokensPerTask);
      writeAdvancedSettingsToFields(advancedSettings);
      if (apiKey) {
        storage.set(PROVIDER_PREFS.apiKey, apiKey);
        fields.apiKey.value = "";
        fields.apiKey.placeholder = "已保存，留空则保持不变";
      }
    } catch (error) {
      showLayeredError(
        "设置保存失败，请重启 Zotero 后再试",
        createProviderStatusError("设置保存失败，请重启 Zotero 后再试", error, {
          baseUrl,
          apiKey,
          model,
          ...advancedSettings
        })
      );
      return;
    }
    showStatus("设置已保存");
  }

  async function testSavedConnection() {
    if (!testConnection) {
      showLayeredError(
        "测试连接未配置",
        createProviderStatusError("测试连接未配置", new Error("provider connection test module unavailable"))
      );
      return;
    }
    showStatus("正在测试连接...");
    const settings = {
      baseUrl: storage.get(PROVIDER_PREFS.baseUrl) || fields.baseUrl.value.trim(),
      apiKey: storage.get(PROVIDER_PREFS.apiKey) || fields.apiKey.value.trim(),
      model: storage.get(PROVIDER_PREFS.model) || fields.model.value.trim(),
      ...readAdvancedSettings()
    };

    try {
      const result = await testConnection(settings, { timeoutMs: settings.timeoutMs });
      if (result?.ok) {
        showStatus(result.message);
        return;
      }
      showLayeredError(result?.message || "测试连接失败", createProviderConnectionFailure(result, settings));
    } catch (error) {
      showLayeredError("测试连接失败", createProviderStatusError("测试连接失败", error, settings));
    }
  }

  function loadNumericField(name) {
    const field = fields[name];
    if (!field) {
      return;
    }
    const storedValue = storage.get(PROVIDER_PREFS[name]);
    if (hasStoredValue(storedValue) || !field.value) {
      field.value = String(normalizeProviderNumber(storedValue, PROVIDER_NUMERIC_SETTINGS[name]));
    }
  }

  function readAdvancedSettings() {
    return {
      timeoutMs: readAdvancedSetting("timeoutMs"),
      requestsPerMinute: readAdvancedSetting("requestsPerMinute"),
      maxInputTokensPerTask: readAdvancedSetting("maxInputTokensPerTask")
    };
  }

  function readAdvancedSetting(name) {
    const storedValue = storage.get(PROVIDER_PREFS[name]);
    const rawValue = hasStoredValue(storedValue) ? storedValue : fields[name]?.value;
    return normalizeProviderNumber(rawValue, PROVIDER_NUMERIC_SETTINGS[name]);
  }

  function readAdvancedSettingsFromFields() {
    return {
      timeoutMs: normalizeProviderNumber(fields.timeoutMs?.value, PROVIDER_NUMERIC_SETTINGS.timeoutMs),
      requestsPerMinute: normalizeProviderNumber(
        fields.requestsPerMinute?.value,
        PROVIDER_NUMERIC_SETTINGS.requestsPerMinute
      ),
      maxInputTokensPerTask: normalizeProviderNumber(
        fields.maxInputTokensPerTask?.value,
        PROVIDER_NUMERIC_SETTINGS.maxInputTokensPerTask
      )
    };
  }

  function writeAdvancedSettingsToFields(settings) {
    for (const name of Object.keys(PROVIDER_NUMERIC_SETTINGS)) {
      if (fields[name]) {
        fields[name].value = String(settings[name]);
      }
    }
  }

  function showStatus(message) {
    fields.status.textContent = message;
    clearErrorDetails();
  }

  function showLayeredError(fallbackMessage, error) {
    const notice = createLayeredErrorNotice(error, fallbackMessage);
    fields.status.textContent = notice.userMessage;
    if (!fields.errorDetails || !fields.errorDetailText) {
      return;
    }
    fields.errorDetailText.textContent = notice.technicalDetail;
    fields.errorDetails.removeAttribute?.("hidden");
    fields.errorDetails.hidden = false;
  }

  function clearErrorDetails() {
    if (!fields.errorDetails || !fields.errorDetailText) {
      return;
    }
    fields.errorDetailText.textContent = "";
    fields.errorDetails.open = false;
    fields.errorDetails.setAttribute?.("hidden", "hidden");
    fields.errorDetails.hidden = true;
  }

  return { init, load, save, testSavedConnection };
}

function normalizeProviderNumber(value, rule) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return rule.defaultValue;
  }
  return Math.min(rule.max, Math.max(rule.min, Math.round(numeric)));
}

function hasStoredValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function createProviderConnectionFailure(result, settings) {
  const error = new Error(result?.message || "测试连接失败");
  error.operation = "provider connection test failed";
  error.settings = settings;
  return error;
}

function createProviderStatusError(userMessage, error, settings) {
  const noticeError = new Error(userMessage);
  noticeError.originalError = normalizeErrorForDetail(error);
  if (settings) {
    noticeError.settings = settings;
  }
  return noticeError;
}

function normalizeErrorForDetail(error) {
  if (!error || typeof error !== "object") {
    return { message: String(error || "") };
  }

  const detail = {
    name: error.name || "Error",
    message: error.message || "",
    stack: error.stack || ""
  };
  for (const key of Object.keys(error)) {
    detail[key] = error[key];
  }
  return detail;
}

module.exports = {
  PROVIDER_PREFS,
  createProviderSettingsController
};
