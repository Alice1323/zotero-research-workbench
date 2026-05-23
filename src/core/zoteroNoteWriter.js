async function writeZoteroChildNote({ Zotero, parentItem, html } = {}) {
  if (!Zotero?.Item || !parentItem?.id) {
    throw new Error("无法读取 Zotero 选中文献");
  }

  const note = new Zotero.Item("note");
  note.parentItemID = parentItem.id;
  note.setNote(String(html || ""));
  await note.saveTx();

  return { noteKey: note.key || "" };
}

async function writeZoteroStandaloneNote({ Zotero, libraryId, html } = {}) {
  if (!Zotero?.Item) {
    throw new Error("无法写入 Zotero 笔记");
  }
  const normalizedLibraryId = Number(libraryId || Zotero?.Libraries?.userLibraryID);
  if (!Number.isFinite(normalizedLibraryId) || normalizedLibraryId <= 0) {
    throw new Error("无法确定 Zotero 文库");
  }

  const note = new Zotero.Item("note");
  note.libraryID = normalizedLibraryId;
  note.setNote(String(html || ""));
  await note.saveTx();

  return { noteKey: note.key || "" };
}

const WorkbenchZoteroNoteWriter = {
  writeZoteroChildNote,
  writeZoteroStandaloneNote
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchZoteroNoteWriter;
}

if (typeof window !== "undefined") {
  window.WorkbenchZoteroNoteWriter = WorkbenchZoteroNoteWriter;
}
