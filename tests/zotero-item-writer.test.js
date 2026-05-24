const test = require("node:test");
const assert = require("node:assert/strict");

const {
  writeZoteroItemFromIntent,
  writeZoteroAttachmentFromIntent
} = require("../src/core/zoteroItemWriter");
const core = require("../src/core");

test("writeZoteroItemFromIntent creates a Zotero item with mapped fields", async () => {
  const saved = [];
  function Item(type) {
    this.itemType = type;
    this.fields = {};
    this.creators = [];
    this.setField = (key, value) => {
      this.fields[key] = value;
    };
    this.setCreators = (creators) => {
      this.creators = creators;
    };
    this.saveTx = async () => {
      this.key = "ITEMKEY";
      saved.push(this);
    };
  }
  const result = await writeZoteroItemFromIntent({
    Zotero: { Item, Libraries: { userLibraryID: 1 } },
    intent: {
      itemFields: {
        itemType: "journalArticle",
        title: "Title",
        DOI: "10.1/a",
        creators: [{ creatorType: "author", name: "Chen A" }]
      }
    }
  });

  assert.equal(result.zoteroItemKey, "ITEMKEY");
  assert.equal(saved[0].fields.title, "Title");
  assert.deepEqual(saved[0].creators, [{ creatorType: "author", name: "Chen A" }]);
});

test("writeZoteroAttachmentFromIntent imports a local file attachment", async () => {
  const calls = [];
  const Zotero = {
    Attachments: {
      importFromFile: async (input) => {
        calls.push(input);
        return { key: "ATTACHKEY" };
      }
    }
  };
  const result = await writeZoteroAttachmentFromIntent({
    Zotero,
    parentItemId: 123,
    intent: { attachment: { kind: "local-file", path: "C:\\tmp\\paper.pdf", title: "paper.pdf" } }
  });

  assert.equal(result.zoteroAttachmentKey, "ATTACHKEY");
  assert.equal(calls[0].parentItemID, 123);
});

test("writeZoteroAttachmentFromIntent imports a URL attachment", async () => {
  const calls = [];
  const Zotero = {
    Attachments: {
      importFromURL: async (input) => {
        calls.push(input);
        return { key: "URLATTACH" };
      }
    }
  };
  const result = await writeZoteroAttachmentFromIntent({
    Zotero,
    parentItemId: 123,
    parentItemKey: "ITEMKEY",
    intent: {
      attachment: {
        kind: "open-access-pdf-url",
        url: "https://example.org/paper.pdf",
        contentType: "application/pdf"
      }
    }
  });

  assert.equal(result.zoteroAttachmentKey, "URLATTACH");
  assert.equal(result.parentItemKey, "ITEMKEY");
  assert.equal(calls[0].url, "https://example.org/paper.pdf");
});

test("writeZoteroAttachmentFromIntent attaches a URL PDF to an existing Zotero item", async () => {
  const calls = [];
  const Zotero = {
    Attachments: {
      importFromURL: async (input) => {
        calls.push(input);
        return { key: "ATTACH1", id: 456 };
      }
    }
  };

  const result = await writeZoteroAttachmentFromIntent({
    Zotero,
    intent: {
      parentItemId: 123,
      parentItemKey: "ABCD1234",
      attachment: { kind: "open-access-pdf-url", url: "https://example.org/a.pdf", title: "A PDF" }
    }
  });

  assert.equal(calls[0].parentItemID, 123);
  assert.equal(calls[0].url, "https://example.org/a.pdf");
  assert.equal(result.parentItemKey, "ABCD1234");
});

test("writeZoteroAttachmentFromIntent rejects unsupported attachments", async () => {
  await assert.rejects(
    () =>
      writeZoteroAttachmentFromIntent({
        Zotero: { Attachments: {} },
        intent: { attachment: { kind: "landing-page-url" } }
      }),
    /附件类型不支持/
  );
});

test("core index exports zotero item writer module", () => {
  assert.equal(typeof core.WorkbenchZoteroItemWriter.writeZoteroItemFromIntent, "function");
});
