function createClipboardWriter({ writeText, document, createElement } = {}) {
  const asyncWriter = typeof writeText === "function" ? writeText : null;
  const documentAdapter = document || null;
  const elementFactory = typeof createElement === "function" ? createElement : null;

  return {
    async writeClipboardText(text) {
      const value = String(text || "");
      if (asyncWriter) {
        await asyncWriter(value);
        return;
      }
      if (!documentAdapter?.body || typeof documentAdapter.execCommand !== "function" || !elementFactory) {
        throw new Error("当前 Zotero 环境不支持剪贴板写入");
      }

      const textarea = elementFactory("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "readonly");
      textarea.style.position = "fixed";
      textarea.style.inset = "-1000px auto auto -1000px";
      documentAdapter.body.appendChild(textarea);
      textarea.select();
      const copied = documentAdapter.execCommand("copy");
      textarea.remove();
      if (!copied) {
        throw new Error("copy failed");
      }
    }
  };
}

function createBrowserClipboardWriter({ navigator, document, createElement } = {}) {
  return createClipboardWriter({
    writeText: navigator?.clipboard?.writeText ? navigator.clipboard.writeText.bind(navigator.clipboard) : null,
    document,
    createElement
  });
}

const WorkbenchClipboardWriter = {
  createBrowserClipboardWriter,
  createClipboardWriter
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchClipboardWriter;
}

if (typeof window !== "undefined") {
  window.WorkbenchClipboardWriter = WorkbenchClipboardWriter;
}
