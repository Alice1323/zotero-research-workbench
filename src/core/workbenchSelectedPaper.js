function createWorkbenchSelectedPaperRuntime({ getZotero, console } = {}) {
  const zoteroProvider = typeof getZotero === "function" ? getZotero : () => null;
  const consoleAdapter = console || null;

  function readSelectedPaperContext() {
    return readSelectedPaperContexts()[0] || null;
  }

  function readSelectedPaperContexts() {
    const items = getSelectedRegularItems();
    if (!items.length) {
      return [];
    }

    return items.map((item) =>
      normalizePaperContext({
        key: item.key,
        itemType: item.itemType || item.getField?.("itemType"),
        title: item.getField?.("title"),
        abstractNote: item.getField?.("abstractNote"),
        doi: item.getField?.("DOI"),
        publicationTitle: item.getField?.("publicationTitle") || item.getField?.("bookTitle"),
        date: item.getField?.("date"),
        creators: item.getCreators?.() || [],
        pdfAttachment: readSelectedPaperPdfAttachment(item)
      })
    );
  }

  function getSelectedRegularItems() {
    const Zotero = zoteroProvider();
    const win = Zotero?.getMainWindow?.();
    const selectedItems = win?.ZoteroPane?.getSelectedItems?.() || Zotero?.Pane?.getSelectedItems?.() || [];
    if (!Array.isArray(selectedItems)) {
      return [];
    }
    return selectedItems.filter((entry) => entry && !entry.isNote?.() && !entry.isAttachment?.());
  }

  function getSelectedRegularItem() {
    return getSelectedRegularItems()[0] || null;
  }

  function readSelectedPaperPdfAttachment(item) {
    try {
      const Zotero = zoteroProvider();
      const attachmentIds = item?.getAttachments?.() || [];
      const attachments = attachmentIds
        .map((id) => Zotero?.Items?.get?.(id))
        .filter(Boolean)
        .map((attachment) => ({
          title:
            attachment.getField?.("title") ||
            attachment.getField?.("filename") ||
            attachment.attachmentFilename ||
            attachment.key ||
            "",
          path: readAttachmentPath(attachment),
          contentType:
            attachment.attachmentContentType ||
            attachment.getField?.("contentType") ||
            attachment.contentType ||
            ""
        }));
      return selectBestPdfAttachment(attachments);
    } catch (error) {
      consoleAdapter?.warn?.("[zotero-research-workbench] failed to read selected paper PDF attachment", error);
      return selectBestPdfAttachment([]);
    }
  }

  return {
    getSelectedRegularItem,
    getSelectedRegularItems,
    readSelectedPaperContext,
    readSelectedPaperContexts,
    readSelectedPaperPdfAttachment
  };
}

function normalizePaperContext(input) {
  const pdfAttachment = input.pdfAttachment || selectBestPdfAttachment(input.pdfAttachments || []);
  return {
    key: cleanText(input.key),
    itemType: cleanText(input.itemType),
    title: cleanText(input.title) || "未命名条目",
    authors: cleanText(input.authors) || formatCreators(input.creators),
    year: cleanText(input.year) || extractYear(input.date),
    publicationTitle: cleanText(input.publicationTitle) || "未记录",
    abstractNote: cleanText(input.abstractNote) || "未记录摘要",
    doi: cleanText(input.doi) || "未记录",
    pdfAttachment
  };
}

function selectBestPdfAttachment(attachments) {
  const candidates = Array.isArray(attachments) ? attachments : [];
  for (const attachment of candidates) {
    const normalized = normalizePdfAttachment(attachment);
    if (isPdfAttachment(normalized)) {
      return {
        available: true,
        title: normalized.title,
        path: normalized.path,
        contentType: normalized.contentType
      };
    }
  }
  return {
    available: false,
    title: "",
    path: "",
    contentType: ""
  };
}

function normalizePdfAttachment(attachment) {
  return {
    title: cleanDisplayText(attachment?.title || attachment?.filename || attachment?.name),
    path: cleanDisplayText(attachment?.path || attachment?.filePath),
    contentType: cleanDisplayText(attachment?.contentType || attachment?.mimeType)
  };
}

function isPdfAttachment(attachment) {
  const contentType = attachment.contentType.toLowerCase();
  const path = attachment.path.toLowerCase();
  const title = attachment.title.toLowerCase();
  return contentType === "application/pdf" || path.endsWith(".pdf") || title.endsWith(".pdf");
}

function readAttachmentPath(attachment) {
  const candidates = [
    safeCallString(() => attachment?.getFilePath?.()),
    attachment?.attachmentPath,
    attachment?.path,
    attachment?.filePath
  ];
  return candidates.find((value) => typeof value === "string" && value.trim()) || "";
}

function safeCallString(callback) {
  try {
    const value = callback();
    return typeof value === "string" ? value : "";
  } catch (_error) {
    return "";
  }
}

function formatCreators(creators) {
  if (!Array.isArray(creators) || creators.length === 0) {
    return "未记录";
  }

  const names = creators
    .map((creator) => {
      if (cleanText(creator.name)) {
        return cleanText(creator.name);
      }
      return [creator.firstName, creator.lastName].map(cleanText).filter(Boolean).join(" ");
    })
    .filter(Boolean);
  return names.length ? names.join("；") : "未记录";
}

function extractYear(date) {
  const value = cleanText(date);
  if (!value) {
    return "未记录";
  }
  const match = value.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
  return match ? match[1] : "未记录";
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDisplayText(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "object" || typeof value === "function") {
    return "";
  }
  return String(value).trim();
}

function createBrowserSelectedPaperRuntime({ window, getZotero, console } = {}) {
  const windowAdapter = window || {};
  return createWorkbenchSelectedPaperRuntime({
    console,
    getZotero:
      getZotero ||
      (() => windowAdapter.arguments?.[0]?.Zotero || windowAdapter.opener?.Zotero || windowAdapter.Zotero)
  });
}

const WorkbenchSelectedPaperRuntime = {
  createBrowserSelectedPaperRuntime,
  createWorkbenchSelectedPaperRuntime,
  normalizePaperContext,
  selectBestPdfAttachment
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchSelectedPaperRuntime;
}

if (typeof window !== "undefined") {
  window.WorkbenchSelectedPaperRuntime = WorkbenchSelectedPaperRuntime;
}
