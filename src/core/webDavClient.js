function createWebDavClient({ fetchImpl } = {}) {
  const requestAdapter = typeof fetchImpl === "function" ? fetchImpl : null;

  return {
    async requestWebDav(url, options) {
      if (!requestAdapter) {
        throw new Error("当前 Zotero 环境不支持 WebDAV 请求");
      }
      return requestAdapter(url, options);
    }
  };
}

const WorkbenchWebDavClient = {
  createWebDavClient
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchWebDavClient;
}

if (typeof window !== "undefined") {
  window.WorkbenchWebDavClient = WorkbenchWebDavClient;
}
