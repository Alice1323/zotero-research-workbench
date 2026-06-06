const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { createWorkbenchSelectedPaperRuntime } = require("../src/core/workbenchSelectedPaper");

const root = path.resolve(__dirname, "..");

function createItem({ key = "item-1", fields = {}, creators = [], attachments = [] } = {}) {
  return {
    id: 42,
    key,
    itemType: fields.itemType || "journalArticle",
    getField(name) {
      return fields[name] || "";
    },
    getCreators() {
      return creators;
    },
    getAttachments() {
      return attachments;
    },
    isNote() {
      return false;
    },
    isAttachment() {
      return false;
    }
  };
}

test("selected paper runtime reads the first regular Zotero item and normalizes paper context", () => {
  const item = createItem({
    key: "ABC123",
    fields: {
      title: "  A Paper  ",
      abstractNote: "  Abstract text  ",
      DOI: " 10.1000/example ",
      publicationTitle: " Journal ",
      date: "2024-03-01"
    },
    creators: [{ firstName: "Ada", lastName: "Lovelace" }]
  });
  const note = { isNote: () => true, isAttachment: () => false };
  const runtime = createWorkbenchSelectedPaperRuntime({
    getZotero: () => ({
      getMainWindow: () => ({ ZoteroPane: { getSelectedItems: () => [note, item] } })
    })
  });

  assert.deepEqual(runtime.readSelectedPaperContext(), {
    id: 42,
    key: "ABC123",
    itemType: "journalArticle",
    title: "A Paper",
    authors: "Ada Lovelace",
    year: "2024",
    publicationTitle: "Journal",
    abstractNote: "Abstract text",
    doi: "10.1000/example",
    pdfAttachment: {
      available: false,
      title: "",
      path: "",
      contentType: ""
    }
  });
});

test("selected paper runtime preserves DOI values stored in Extra when DOI field is empty", () => {
  const item = createItem({
    key: "EXTRA123",
    fields: {
      title: "Extra DOI Paper",
      DOI: "",
      extra: "DOI: 10.1371/journal.pone.0000308",
      date: "2024"
    }
  });
  const runtime = createWorkbenchSelectedPaperRuntime({
    getZotero: () => ({
      getMainWindow: () => ({ ZoteroPane: { getSelectedItems: () => [item] } })
    })
  });

  const context = runtime.readSelectedPaperContext();
  assert.equal(context.doi, "10.1371/journal.pone.0000308");
  assert.match(context.extra, /DOI: 10.1371\/journal\.pone\.0000308/);
});

test("selected paper runtime reads all selected regular Zotero items in selection order", () => {
  const first = createItem({
    key: "ITEM1",
    fields: {
      title: "First Paper",
      abstractNote: "First abstract",
      DOI: "10.1000/first",
      publicationTitle: "Journal A",
      date: "2024"
    },
    creators: [{ firstName: "Ada", lastName: "Lovelace" }]
  });
  const second = createItem({
    key: "ITEM2",
    fields: {
      title: "Second Paper",
      abstractNote: "Second abstract",
      DOI: "10.1000/second",
      publicationTitle: "Journal B",
      date: "2025"
    },
    creators: [{ firstName: "Grace", lastName: "Hopper" }]
  });
  const note = { isNote: () => true, isAttachment: () => false };
  const attachment = { isNote: () => false, isAttachment: () => true };
  const runtime = createWorkbenchSelectedPaperRuntime({
    getZotero: () => ({
      getMainWindow: () => ({ ZoteroPane: { getSelectedItems: () => [note, first, attachment, second] } })
    })
  });

  assert.deepEqual(
    runtime.readSelectedPaperContexts().map((paper) => ({
      key: paper.key,
      title: paper.title,
      authors: paper.authors,
      year: paper.year,
      doi: paper.doi
    })),
    [
      {
        key: "ITEM1",
        title: "First Paper",
        authors: "Ada Lovelace",
        year: "2024",
        doi: "10.1000/first"
      },
      {
        key: "ITEM2",
        title: "Second Paper",
        authors: "Grace Hopper",
        year: "2025",
        doi: "10.1000/second"
      }
    ]
  );
});

test("selected paper runtime detects the best PDF child attachment", () => {
  const item = createItem({ key: "ABC123", fields: { title: "A Paper" }, attachments: [1, 2] });
  const runtime = createWorkbenchSelectedPaperRuntime({
    getZotero: () => ({
      Pane: { getSelectedItems: () => [item] },
      Items: {
        get(id) {
          if (id === 1) {
            return {
              getField(name) {
                return name === "title" ? "Supplement" : "";
              },
              attachmentContentType: "text/plain",
              attachmentPath: "C:\\tmp\\supplement.txt"
            };
          }
          return {
            getField(name) {
              return name === "filename" ? "paper.pdf" : "";
            },
            getFilePath() {
              return "C:\\tmp\\paper.pdf";
            },
            attachmentContentType: "application/pdf"
          };
        }
      }
    })
  });

  assert.deepEqual(runtime.readSelectedPaperPdfAttachment(item), {
    available: true,
    title: "paper.pdf",
    path: "C:\\tmp\\paper.pdf",
    contentType: "application/pdf"
  });
});

test("selected paper runtime exposes the same interface to browser runtime scripts", () => {
  const source = fs.readFileSync(path.join(root, "src/core/workbenchSelectedPaper.js"), "utf8");
  const context = { window: {} };

  vm.runInNewContext(source, context, { filename: "workbenchSelectedPaper.js" });

  assert.equal(typeof context.window.WorkbenchSelectedPaperRuntime.createWorkbenchSelectedPaperRuntime, "function");
  assert.equal(typeof context.window.WorkbenchSelectedPaperRuntime.createBrowserSelectedPaperRuntime, "function");
  assert.equal(typeof context.window.WorkbenchSelectedPaperRuntime.createWorkbenchSelectedPaperRuntime().readSelectedPaperContexts, "function");
});
