(function () {
  function getField(id) {
    return document.getElementById(id);
  }

  function getZotero() {
    return window.arguments?.[0]?.Zotero || window.opener?.Zotero || window.Zotero;
  }

  function refreshReadingContext() {
    const context = readReadingContext();
    window.WorkbenchReadingContext = context;
    renderReadingContext(context);
    return context;
  }

  function readReadingContext() {
    const Zotero = getZotero();
    const reader = getActiveReader(Zotero);
    const itemKey = getReaderItemKey(reader);
    const createdAt = new Date().toISOString();
    const context = selectBestReadingContext([
      extractReaderSelectionPopupContext(reader, createdAt),
      {
        text: readReaderWindowSelection(reader),
        source: "reader-selection",
        itemKey,
        pageLabel: getReaderPageLabel(reader),
        createdAt
      },
      {
        text: readMainWindowSelection(Zotero),
        source: "window-selection",
        itemKey,
        pageLabel: getReaderPageLabel(reader),
        createdAt
      }
    ]);
    window.WorkbenchReadingContextDiagnostics = createReadingContextDiagnostics({ Zotero, reader, context });
    return context;
  }

  function getActiveReader(Zotero) {
    const win = Zotero?.getMainWindow?.();
    const selectedReader =
      win?.Zotero_Tabs?.selectedID && Zotero?.Reader?.getByTabID
        ? Zotero.Reader.getByTabID(win.Zotero_Tabs.selectedID)
        : null;
    if (selectedReader) {
      return selectedReader;
    }

    const readers = Zotero?.Reader?._readers;
    if (Array.isArray(readers)) {
      return readers.find((entry) => entry && !entry.closed) || readers[0] || null;
    }
    if (readers && typeof readers === "object") {
      return Object.values(readers).find((entry) => entry && !entry.closed) || null;
    }
    return null;
  }

  function readReaderWindowSelection(reader) {
    return cleanText(
      reader?._internalReader?._primaryView?._iframeWindow?.getSelection?.().toString?.() ||
        reader?._internalReader?._secondaryView?._iframeWindow?.getSelection?.().toString?.() ||
        reader?._iframeWindow?.getSelection?.().toString?.() ||
        reader?.iframeWindow?.getSelection?.().toString?.() ||
        reader?.window?.getSelection?.().toString?.()
    );
  }

  function readMainWindowSelection(Zotero) {
    const win = Zotero?.getMainWindow?.();
    return cleanText(win?.getSelection?.().toString?.());
  }

  function getReaderItemKey(reader) {
    return cleanText(reader?.item?.key || reader?._item?.key || reader?.itemKey);
  }

  function getReaderPageLabel(reader) {
    return cleanText(
      reader?.state?.pageLabel ||
        reader?._state?.pageLabel ||
        reader?.state?.pageIndex?.toString?.() ||
        reader?._state?.pageIndex?.toString?.()
    );
  }

  function renderReadingContext(context) {
    const meta = getField("reading-context-meta");
    const output = getField("reading-context-output");
    if (!meta || !output) {
      return;
    }

    if (!context) {
      meta.textContent = formatEmptyReadingContextMessage(window.WorkbenchReadingContextDiagnostics);
      output.textContent = "暂无阅读器选中文本";
      return;
    }

    const sourceLabel = context.source === "window-selection" ? "窗口选中文本" : "阅读器选中文本";
    const page = context.pageLabel ? `｜页码 ${context.pageLabel}` : "";
    meta.textContent = `${sourceLabel}${page}`;
    output.textContent = context.text;
  }

  function extractReaderSelectionPopupContext(reader, createdAt) {
    const internalReader = reader?._internalReader || reader?._internalReaderProxy || reader?.internalReader || reader;
    const state = internalReader?._state || internalReader?.state || {};
    const popup = state.primaryViewSelectionPopup || state.secondaryViewSelectionPopup || null;
    const annotation = popup?.annotation || {};
    return normalizeReadingContext({
      text: annotation.text,
      source: "reader-selection-popup",
      itemKey: getReaderItemKey(reader),
      pageLabel: annotation.pageLabel,
      createdAt
    });
  }

  function normalizeReadingContext(input) {
    const text = cleanSelectedText(input?.text);
    if (!text) {
      return null;
    }

    return {
      source: cleanText(input?.source) || "reader-selection",
      text,
      itemKey: cleanText(input?.itemKey),
      pageLabel: cleanText(input?.pageLabel),
      createdAt: cleanText(input?.createdAt) || new Date().toISOString()
    };
  }

  function selectBestReadingContext(candidates) {
    if (!Array.isArray(candidates)) {
      return null;
    }

    for (const candidate of candidates) {
      const context = normalizeReadingContext(candidate);
      if (context) {
        return context;
      }
    }
    return null;
  }

  function cleanSelectedText(value) {
    return cleanText(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  }

  function cleanText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function createReadingContextDiagnostics({ Zotero, reader, context }) {
    const internalReader = reader?._internalReader || reader?._internalReaderProxy || reader?.internalReader || null;
    const state = internalReader?._state || internalReader?.state || {};
    return {
      hasZotero: !!Zotero,
      hasReader: !!reader,
      hasInternalReader: !!internalReader,
      hasPrimarySelectionPopup: !!state.primaryViewSelectionPopup,
      hasSecondarySelectionPopup: !!state.secondaryViewSelectionPopup,
      hasReaderIframeSelection: !!readReaderWindowSelection(reader),
      hasMainWindowSelection: !!readMainWindowSelection(Zotero),
      selectedSource: context?.source || ""
    };
  }

  function formatEmptyReadingContextMessage(diagnostics) {
    if (!diagnostics?.hasZotero) {
      return "无法访问 Zotero 上下文";
    }
    if (!diagnostics.hasReader) {
      return "暂无活动阅读器";
    }
    if (!diagnostics.hasInternalReader) {
      return "阅读器尚未初始化";
    }
    if (!diagnostics.hasPrimarySelectionPopup && !diagnostics.hasSecondarySelectionPopup) {
      return "已找到阅读器，但没有检测到文本选择弹窗";
    }
    return "暂无阅读器选中文本";
  }

  function init() {
    getField("refresh-reading-context")?.addEventListener("click", refreshReadingContext);
    refreshReadingContext();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.WorkbenchReadingContextApi = {
    extractReaderSelectionPopupContext,
    normalizeReadingContext,
    readReadingContext,
    refreshReadingContext,
    renderReadingContext,
    selectBestReadingContext
  };
})();
