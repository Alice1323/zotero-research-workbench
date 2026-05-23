const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { writeZoteroChildNote, writeZoteroStandaloneNote } = require("../src/core/zoteroNoteWriter");

const root = path.resolve(__dirname, "..");

test("writes a Zotero child note and returns the saved note key", async () => {
  const calls = [];
  class FakeItem {
    constructor(type) {
      calls.push(["constructor", type]);
      this.key = "NOTE-KEY";
    }

    set parentItemID(value) {
      calls.push(["parentItemID", value]);
      this.parentId = value;
    }

    setNote(html) {
      calls.push(["setNote", html]);
      this.html = html;
    }

    async saveTx() {
      calls.push(["saveTx"]);
    }
  }

  const result = await writeZoteroChildNote({
    Zotero: { Item: FakeItem },
    parentItem: { id: 42 },
    html: "<p>confirmed note</p>"
  });

  assert.equal(result.noteKey, "NOTE-KEY");
  assert.deepEqual(calls, [
    ["constructor", "note"],
    ["parentItemID", 42],
    ["setNote", "<p>confirmed note</p>"],
    ["saveTx"]
  ]);
});

test("writes a Zotero standalone note without a parent item", async () => {
  const calls = [];
  class FakeItem {
    constructor(type) {
      calls.push(["constructor", type]);
      this.key = "STANDALONE-KEY";
    }

    set libraryID(value) {
      calls.push(["libraryID", value]);
      this.libraryId = value;
    }

    setNote(html) {
      calls.push(["setNote", html]);
      this.html = html;
    }

    async saveTx() {
      calls.push(["saveTx"]);
    }
  }

  const result = await writeZoteroStandaloneNote({
    Zotero: { Item: FakeItem, Libraries: { userLibraryID: 7 } },
    html: "<p>standalone note</p>"
  });

  assert.equal(result.noteKey, "STANDALONE-KEY");
  assert.deepEqual(calls, [
    ["constructor", "note"],
    ["libraryID", 7],
    ["setNote", "<p>standalone note</p>"],
    ["saveTx"]
  ]);
});

test("zotero note writer exposes the same interface to browser runtime scripts", () => {
  const source = fs.readFileSync(path.join(root, "src/core/zoteroNoteWriter.js"), "utf8");
  const context = {
    window: {}
  };

  vm.runInNewContext(source, context, { filename: "zoteroNoteWriter.js" });

  assert.equal(typeof context.window.WorkbenchZoteroNoteWriter.writeZoteroChildNote, "function");
  assert.equal(typeof context.window.WorkbenchZoteroNoteWriter.writeZoteroStandaloneNote, "function");
});
