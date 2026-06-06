(function () {
function createWorkbenchFetchRuntime({ window } = {}) {
  const windowAdapter = window || {};

  function getFetchAdapter() {
    return typeof windowAdapter.fetch === "function" ? windowAdapter.fetch.bind(windowAdapter) : null;
  }

  async function fetch(url, options) {
    if (hasExplicitCookieHeader(options?.headers)) {
      const zoteroHttpAdapter = getZoteroHttpAdapter();
      if (zoteroHttpAdapter) {
        return fetchWithZoteroHttp(zoteroHttpAdapter, url, options);
      }
    }

    const fetchAdapter = getFetchAdapter();
    if (!fetchAdapter) {
      throw new Error("当前 Zotero 环境不支持网络请求");
    }
    const timeoutMs = normalizeTimeoutMs(options?.timeoutMs);
    if (!timeoutMs) {
      return fetchAdapter(url, options);
    }

    const controller = createAbortController();
    if (!controller) {
      const { timeoutMs: _timeoutMs, ...forwardedOptions } = options || {};
      return fetchAdapter(url, forwardedOptions);
    }

    const { timeoutMs: _timeoutMs, signal: existingSignal, ...forwardedOptions } = options || {};
    if (existingSignal?.addEventListener) {
      existingSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    let didTimeout = false;
    let timer = null;
    const timeoutPromise = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        didTimeout = true;
        controller.abort();
        reject(new Error(`请求超时：${timeoutMs}ms`));
      }, timeoutMs);
    });
    const requestPromise = fetchAdapter(url, {
      ...forwardedOptions,
      signal: controller.signal
    });
    try {
      return await Promise.race([requestPromise, timeoutPromise]);
    } catch (error) {
      if (didTimeout) {
        throw new Error(`请求超时：${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function createAbortController() {
    const Controller = windowAdapter.AbortController ||
      (typeof AbortController !== "undefined" ? AbortController : null);
    return Controller ? new Controller() : null;
  }

  function getZoteroHttpAdapter() {
    const Zotero = windowAdapter.Zotero || windowAdapter.arguments?.[0]?.Zotero || windowAdapter.opener?.Zotero;
    return typeof Zotero?.HTTP?.request === "function" ? Zotero.HTTP.request.bind(Zotero.HTTP) : null;
  }

  return {
    fetch
  };
}

async function fetchWithZoteroHttp(zoteroHttpRequest, url, options = {}) {
  const method = normalizeHttpMethod(options.method);
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const requestOptions = {
    responseType: "text",
    headers: normalizeHeadersObject(options.headers)
  };
  if (timeoutMs) {
    requestOptions.timeout = timeoutMs;
  }
  const xhr = await zoteroHttpRequest(method, url, requestOptions);
  return createFetchLikeResponseFromXhr(xhr);
}

function createFetchLikeResponseFromXhr(xhr = {}) {
  const status = normalizeStatus(xhr.status);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: cleanText(xhr.statusText),
    headers: {
      get(name) {
        return getXhrResponseHeader(xhr, name);
      }
    },
    async text() {
      return typeof xhr.responseText === "string" ? xhr.responseText : "";
    },
    async json() {
      const text = typeof xhr.responseText === "string" ? xhr.responseText : "";
      return JSON.parse(text);
    }
  };
}

function hasExplicitCookieHeader(headers) {
  if (!headers) {
    return false;
  }
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return Boolean(headers.get("cookie"));
  }
  if (Array.isArray(headers)) {
    return headers.some(([key, value]) => /^cookie$/i.test(String(key || "")) && cleanText(value));
  }
  if (typeof headers === "object") {
    return Object.entries(headers).some(([key, value]) => /^cookie$/i.test(key) && cleanText(value));
  }
  return false;
}

function normalizeHeadersObject(headers) {
  if (!headers) {
    return {};
  }
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const result = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  if (Array.isArray(headers)) {
    return headers.reduce((result, [key, value]) => {
      const textKey = cleanText(key);
      if (textKey) {
        result[textKey] = cleanText(value);
      }
      return result;
    }, {});
  }
  if (typeof headers === "object") {
    return Object.fromEntries(
      Object.entries(headers)
        .map(([key, value]) => [cleanText(key), cleanText(value)])
        .filter(([key]) => key)
    );
  }
  return {};
}

function getXhrResponseHeader(xhr, name) {
  if (typeof xhr?.getResponseHeader === "function") {
    return cleanText(xhr.getResponseHeader(name));
  }
  const headers = xhr?.headers;
  if (!headers) {
    return "";
  }
  if (typeof headers.get === "function") {
    return cleanText(headers.get(name));
  }
  const match = Object.keys(headers).find((key) => key.toLowerCase() === String(name || "").toLowerCase());
  return match ? cleanText(headers[match]) : "";
}

function normalizeHttpMethod(method) {
  const text = cleanText(method).toUpperCase();
  return text || "GET";
}

function normalizeStatus(status) {
  const value = Number(status);
  return Number.isFinite(value) ? value : 0;
}

function createBrowserFetchRuntime({ window } = {}) {
  return createWorkbenchFetchRuntime({
    window: window || (typeof globalThis !== "undefined" ? globalThis.window : null)
  });
}

function normalizeTimeoutMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }
  return Math.max(1, Math.min(Math.trunc(number), 120000));
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const WorkbenchFetchRuntime = {
  createBrowserFetchRuntime,
  createWorkbenchFetchRuntime
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchFetchRuntime;
}

if (typeof window !== "undefined") {
  window.WorkbenchFetchRuntime = WorkbenchFetchRuntime;
}
})();
