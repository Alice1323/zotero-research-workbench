function createWorkbenchFetchRuntime({ window } = {}) {
  const windowAdapter = window || {};

  function getFetchAdapter() {
    return typeof windowAdapter.fetch === "function" ? windowAdapter.fetch.bind(windowAdapter) : null;
  }

  async function fetch(url, options) {
    const fetchAdapter = getFetchAdapter();
    if (!fetchAdapter) {
      throw new Error("当前 Zotero 环境不支持网络请求");
    }
    return fetchAdapter(url, options);
  }

  return {
    fetch
  };
}

function createBrowserFetchRuntime({ window } = {}) {
  return createWorkbenchFetchRuntime({
    window: window || (typeof globalThis !== "undefined" ? globalThis.window : null)
  });
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
