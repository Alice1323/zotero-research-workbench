(function () {
async function writeZoteroItemFromIntent({ Zotero, intent, libraryId } = {}) {
  if (!Zotero?.Item) {
    throw new Error("无法创建 Zotero 条目");
  }
  const fields = intent?.itemFields || {};
  const itemType = cleanText(fields.itemType) || "journalArticle";
  const item = new Zotero.Item(itemType);
  const resolvedLibraryId = Number(libraryId || Zotero?.Libraries?.userLibraryID || fields.libraryId || 0);
  if (Number.isFinite(resolvedLibraryId) && resolvedLibraryId > 0) {
    item.libraryID = resolvedLibraryId;
  }

  for (const [key, value] of Object.entries(fields)) {
    if (key === "itemType" || key === "creators" || value === undefined || value === null || value === "") {
      continue;
    }
    item.setField?.(key, value);
  }
  if (Array.isArray(fields.creators)) {
    item.setCreators?.(fields.creators);
  }
  if (typeof item.saveTx !== "function") {
    throw new Error("无法保存 Zotero 条目");
  }
  await item.saveTx();
  return { zoteroItemKey: cleanText(item.key), zoteroItemId: item.id || null };
}

async function writeZoteroAttachmentFromIntent({ Zotero, intent, parentItemId, parentItemKey } = {}) {
  if (!Zotero?.Attachments) {
    throw new Error("无法创建 Zotero 附件");
  }
  const attachment = intent?.attachment || {};
  const parentItemID = Number(parentItemId || intent?.parentItemId || 0) || undefined;
  const parentKey = cleanText(parentItemKey || intent?.parentItemKey);

  if (attachment.kind === "local-file") {
    if (typeof Zotero.Attachments.importFromFile !== "function") {
      throw new Error("无法创建 Zotero 附件");
    }
    const saved = await Zotero.Attachments.importFromFile({
      file: attachment.path,
      parentItemID,
      title: cleanText(attachment.title)
    });
    return { zoteroAttachmentKey: cleanText(saved?.key), zoteroAttachmentId: saved?.id || null, parentItemKey: parentKey };
  }

  if (attachment.kind === "open-access-pdf-url" || attachment.kind === "connector-file-reference") {
    if (typeof Zotero.Attachments.importFromURL !== "function") {
      throw new Error("无法创建 Zotero 附件");
    }
    const saved = await Zotero.Attachments.importFromURL({
      url: cleanText(attachment.url || attachment.fileUrl),
      parentItemID,
      title: cleanText(attachment.title),
      contentType: cleanText(attachment.contentType) || "application/pdf"
    });
    return { zoteroAttachmentKey: cleanText(saved?.key), zoteroAttachmentId: saved?.id || null, parentItemKey: parentKey };
  }

  throw new Error("附件类型不支持");
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const WorkbenchZoteroItemWriter = {
  cleanText,
  writeZoteroAttachmentFromIntent,
  writeZoteroItemFromIntent
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchZoteroItemWriter;
}

if (typeof window !== "undefined") {
  window.WorkbenchZoteroItemWriter = WorkbenchZoteroItemWriter;
}
})();
