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

function extractReaderSelectionPopupContext(reader, createdAt) {
  const internalReader = reader?._internalReader || reader?._internalReaderProxy || reader?.internalReader || reader;
  const state = internalReader?._state || internalReader?.state || {};
  const popup = state.primaryViewSelectionPopup || state.secondaryViewSelectionPopup || null;
  const annotation = popup?.annotation || {};
  return normalizeReadingContext({
    text: annotation.text,
    source: "reader-selection-popup",
    itemKey: cleanText(reader?.item?.key || reader?._item?.key || reader?.itemKey),
    pageLabel: annotation.pageLabel,
    createdAt
  });
}

function cleanSelectedText(value) {
  return cleanText(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

module.exports = {
  extractReaderSelectionPopupContext,
  normalizeReadingContext,
  selectBestReadingContext
};
