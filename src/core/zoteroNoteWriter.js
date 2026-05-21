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

const WorkbenchZoteroNoteWriter = {
  writeZoteroChildNote
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchZoteroNoteWriter;
}

if (typeof window !== "undefined") {
  window.WorkbenchZoteroNoteWriter = WorkbenchZoteroNoteWriter;
}
