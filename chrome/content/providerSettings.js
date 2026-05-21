(function () {
  const PREFS = {
    baseUrl: "extensions.zotero-research-workbench.provider.baseUrl",
    apiKey: "extensions.zotero-research-workbench.provider.apiKey",
    model: "extensions.zotero-research-workbench.provider.model",
    timeoutMs: "extensions.zotero-research-workbench.provider.timeoutMs",
    requestsPerMinute: "extensions.zotero-research-workbench.provider.requestsPerMinute",
    maxInputTokensPerTask: "extensions.zotero-research-workbench.provider.maxInputTokensPerTask"
  };
  const NUMERIC_SETTINGS = {
    timeoutMs: { defaultValue: 15000, min: 1000, max: 120000 },
    requestsPerMinute: { defaultValue: 20, min: 1, max: 600 },
    maxInputTokensPerTask: { defaultValue: 12000, min: 1000, max: 200000 }
  };
  const SECRET_PLACEHOLDER = "<redacted>";

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

  function showStatus(message) {
    const status = getField("provider-status");
    if (status) {
      status.textContent = message;
    }
    clearErrorDetails();
  }

  function showLayeredError(fallbackMessage, error) {
    const notice = createLayeredErrorNotice(error, fallbackMessage);
    const status = getField("provider-status");
    if (status) {
      status.textContent = notice.userMessage;
    }

    const container = getField("provider-error-details");
    const body = getField("provider-error-detail-text");
    if (!container || !body) {
      return;
    }
    body.textContent = notice.technicalDetail;
    container.removeAttribute("hidden");
    container.hidden = false;
  }

  function clearErrorDetails() {
    const container = getField("provider-error-details");
    const body = getField("provider-error-detail-text");
    if (!container || !body) {
      return;
    }
    body.textContent = "";
    container.open = false;
    container.setAttribute("hidden", "hidden");
    container.hidden = true;
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
    loadNumericField("timeoutMs", "provider-timeout-ms");
    loadNumericField("requestsPerMinute", "provider-requests-per-minute");
    loadNumericField("maxInputTokensPerTask", "provider-max-input-tokens");
  }

  function saveSettings() {
    const baseUrl = getField("provider-base-url").value.trim();
    const model = getField("provider-model").value.trim();
    const apiKey = getField("provider-api-key").value.trim();
    const advancedSettings = readAdvancedSettingsFromFields();

    if (!baseUrl || !model) {
      showStatus("请填写接口地址和模型名称");
      return;
    }

    try {
      setPref(PREFS.baseUrl, baseUrl);
      setPref(PREFS.model, model);
      setPref(PREFS.timeoutMs, advancedSettings.timeoutMs);
      setPref(PREFS.requestsPerMinute, advancedSettings.requestsPerMinute);
      setPref(PREFS.maxInputTokensPerTask, advancedSettings.maxInputTokensPerTask);
      writeAdvancedSettingsToFields(advancedSettings);
      if (apiKey) {
        setPref(PREFS.apiKey, apiKey);
        getField("provider-api-key").value = "";
        getField("provider-api-key").placeholder = "已保存，留空则保持不变";
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
    const connection = window.WorkbenchProviderConnection;
    if (!connection?.testOpenAICompatibleConnection) {
      showLayeredError(
        "测试连接未配置",
        createProviderStatusError("测试连接未配置", new Error("provider connection test module unavailable"))
      );
      return;
    }

    showStatus("正在测试连接...");
    const settings = {
      baseUrl: getPref(PREFS.baseUrl) || getField("provider-base-url").value.trim(),
      apiKey: getPref(PREFS.apiKey) || getField("provider-api-key").value.trim(),
      model: getPref(PREFS.model) || getField("provider-model").value.trim(),
      ...readAdvancedSettings()
    };

    try {
      const result = await connection.testOpenAICompatibleConnection(settings, { timeoutMs: settings.timeoutMs });
      if (result?.ok) {
        showStatus(result.message);
        return;
      }
      showLayeredError(result?.message || "测试连接失败", createProviderConnectionFailure(result, settings));
    } catch (error) {
      showLayeredError("测试连接失败", createProviderStatusError("测试连接失败", error, settings));
    }
  }

  function loadNumericField(name, fieldId) {
    const field = getField(fieldId);
    if (!field) {
      return;
    }
    const storedValue = getPref(PREFS[name]);
    if (hasStoredValue(storedValue) || !field.value) {
      field.value = String(normalizeProviderNumber(storedValue, NUMERIC_SETTINGS[name]));
    }
  }

  function readAdvancedSettings() {
    return {
      timeoutMs: readAdvancedSetting("timeoutMs", "provider-timeout-ms"),
      requestsPerMinute: readAdvancedSetting("requestsPerMinute", "provider-requests-per-minute"),
      maxInputTokensPerTask: readAdvancedSetting("maxInputTokensPerTask", "provider-max-input-tokens")
    };
  }

  function readAdvancedSetting(name, fieldId) {
    const storedValue = getPref(PREFS[name]);
    const rawValue = hasStoredValue(storedValue) ? storedValue : getField(fieldId)?.value;
    return normalizeProviderNumber(rawValue, NUMERIC_SETTINGS[name]);
  }

  function readAdvancedSettingsFromFields() {
    return {
      timeoutMs: normalizeProviderNumber(getField("provider-timeout-ms")?.value, NUMERIC_SETTINGS.timeoutMs),
      requestsPerMinute: normalizeProviderNumber(
        getField("provider-requests-per-minute")?.value,
        NUMERIC_SETTINGS.requestsPerMinute
      ),
      maxInputTokensPerTask: normalizeProviderNumber(
        getField("provider-max-input-tokens")?.value,
        NUMERIC_SETTINGS.maxInputTokensPerTask
      )
    };
  }

  function writeAdvancedSettingsToFields(settings) {
    const mapping = {
      timeoutMs: "provider-timeout-ms",
      requestsPerMinute: "provider-requests-per-minute",
      maxInputTokensPerTask: "provider-max-input-tokens"
    };
    for (const [name, fieldId] of Object.entries(mapping)) {
      const field = getField(fieldId);
      if (field) {
        field.value = String(settings[name]);
      }
    }
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
    error.userMessage = result?.message || "测试连接失败";
    if (result?.details) {
      error.technicalDetail = result.details;
    }
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

  function createLayeredErrorNotice(error, fallbackMessage = "操作失败") {
    const rawUserMessage = cleanString(error?.userMessage) || cleanString(error?.message) || cleanString(fallbackMessage) || "操作失败";
    const userMessage = sanitizeSecretText(rawUserMessage) || cleanString(fallbackMessage) || "操作失败";
    const technicalDetail = sanitizeSecretText(formatTechnicalErrorDetail(error) || rawUserMessage).slice(0, 4000);
    return {
      userMessage,
      technicalDetail
    };
  }

  function formatTechnicalErrorDetail(error) {
    if (error === undefined || error === null) {
      return "";
    }
    if (typeof error !== "object") {
      return String(error);
    }

    const parts = [];
    if (cleanString(error.technicalDetail)) {
      parts.push(error.technicalDetail);
    }
    if (error.name) {
      parts.push(`name: ${error.name}`);
    }
    if (error.message) {
      parts.push(`message: ${error.message}`);
    }
    if (error.stack) {
      parts.push(`stack:\n${error.stack}`);
    }

    const metadata = {};
    for (const key of Object.keys(error)) {
      if (key === "technicalDetail") {
        continue;
      }
      metadata[key] = error[key];
    }
    if (Object.keys(metadata).length) {
      parts.push(`metadata:\n${safeStringify(redactSecretMaterial(metadata))}`);
    }

    return parts.join("\n\n");
  }

  function redactSecretMaterial(value) {
    if (Array.isArray(value)) {
      return value.map((item) => redactSecretMaterial(item));
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    const redacted = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isSecretKey(key) && entry) {
        redacted[key] = SECRET_PLACEHOLDER;
      } else {
        redacted[key] = redactSecretMaterial(entry);
      }
    }
    return redacted;
  }

  function isSecretKey(key) {
    const value = String(key || "");
    return (
      /^(apiKey|api_key|api-key|password|passwd|pwd|authorization|secret|token)$/i.test(value) ||
      /(^|[_-])(api[_-]?key|password|passwd|pwd|authorization|secret|token)([_-]|$)/i.test(value) ||
      /Token$/.test(value)
    );
  }

  function sanitizeSecretText(value) {
    return String(value)
      .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, `$1${SECRET_PLACEHOLDER}`)
      .replace(/\b(Basic\s+)[A-Za-z0-9+/=]+/gi, `$1${SECRET_PLACEHOLDER}`)
      .replace(/\bsk-[A-Za-z0-9._-]+/g, SECRET_PLACEHOLDER)
      .replace(/\b(apiKey|password|token|secret)\b\s*([:=])\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi, (_match, key, separator) => {
        return `${key}${separator}${SECRET_PLACEHOLDER}`;
      });
  }

  function safeStringify(value) {
    const seen = new WeakSet();
    return JSON.stringify(
      value,
      (_key, entry) => {
        if (!entry || typeof entry !== "object") {
          return entry;
        }
        if (seen.has(entry)) {
          return "[Circular]";
        }
        seen.add(entry);
        return entry;
      },
      2
    );
  }

  function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
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
