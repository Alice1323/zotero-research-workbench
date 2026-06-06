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
  const parentKey = cleanText(parentItemKey || intent?.parentItemKey);
  const parentItemID = resolveParentItemID({
    Zotero,
    parentItemId: parentItemId || intent?.parentItemId,
    parentItemKey: parentKey,
    libraryId: intent?.libraryId || attachment.libraryId
  });

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

  if (["open-access-pdf-url", "connector-file-reference", "sci-hub-resolved-url"].includes(attachment.kind)) {
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

function resolveParentItemID({ Zotero, parentItemId, parentItemKey, libraryId } = {}) {
  const explicitId = Number(parentItemId);
  if (Number.isFinite(explicitId) && explicitId > 0) {
    return explicitId;
  }
  const key = cleanText(parentItemKey);
  if (!key) {
    return undefined;
  }
  const libraries = [
    Number(libraryId),
    Number(Zotero?.Libraries?.userLibraryID)
  ].filter((value) => Number.isFinite(value) && value > 0);
  if (typeof Zotero?.Items?.getIDFromLibraryAndKey === "function") {
    for (const candidateLibraryId of libraries) {
      const resolvedId = Number(Zotero.Items.getIDFromLibraryAndKey(candidateLibraryId, key));
      if (Number.isFinite(resolvedId) && resolvedId > 0) {
        return resolvedId;
      }
    }
  }
  if (typeof Zotero?.Items?.getByLibraryAndKey === "function") {
    for (const candidateLibraryId of libraries) {
      const item = Zotero.Items.getByLibraryAndKey(candidateLibraryId, key);
      const resolvedId = Number(item?.id);
      if (Number.isFinite(resolvedId) && resolvedId > 0) {
        return resolvedId;
      }
    }
  }
  if (typeof Zotero?.Items?.get === "function") {
    const item = Zotero.Items.get(key);
    const resolvedId = Number(item?.id);
    if (Number.isFinite(resolvedId) && resolvedId > 0) {
      return resolvedId;
    }
  }
  throw new Error(`未找到目标 Zotero 条目：${key}`);
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const WorkbenchZoteroItemWriter = {
  cleanText,
  resolveParentItemID,
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
