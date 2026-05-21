const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  SNAPSHOT_PREF_KEY,
  createEmptyWorkbenchSnapshot,
  createWorkbenchRuntimeStore
} = require("../src/core/workbenchRuntimeStore");

const root = path.resolve(__dirname, "..");

test("workbench runtime store returns an empty schema v1 snapshot when prefs are missing", () => {
  const store = createWorkbenchRuntimeStore({
    getPref: () => "",
    now: () => "2026-05-21T01:00:00.000Z"
  });

  assert.deepEqual(store.loadSnapshot(), {
    schemaVersion: 1,
    exportedAt: "2026-05-21T01:00:00.000Z",
    providers: [],
    promptTemplates: [],
    researchNoteDrafts: [],
    graphSeeds: [],
    citationRelations: [],
    taskLedger: []
  });
});

test("workbench runtime store returns an empty snapshot for invalid or unsupported stored data", () => {
  const store = createWorkbenchRuntimeStore({
    getPref: () => "{",
    now: () => "2026-05-21T01:01:00.000Z"
  });
  const unsupportedStore = createWorkbenchRuntimeStore({
    getPref: () => JSON.stringify({ schemaVersion: 2, researchNoteDrafts: [{ id: "draft-a" }] }),
    now: () => "2026-05-21T01:02:00.000Z"
  });

  assert.equal(store.loadSnapshot().exportedAt, "2026-05-21T01:01:00.000Z");
  assert.deepEqual(unsupportedStore.loadSnapshot().researchNoteDrafts, []);
});

test("workbench runtime store preserves valid schema v1 snapshots as stored", () => {
  const storedSnapshot = {
    schemaVersion: 1,
    exportedAt: "2026-05-20T10:00:00.000Z",
    researchNoteDrafts: [{ id: "draft-a" }],
    extensionField: { keep: true }
  };
  const store = createWorkbenchRuntimeStore({
    getPref: () => JSON.stringify(storedSnapshot)
  });

  assert.deepEqual(store.loadSnapshot(), storedSnapshot);
});

test("workbench runtime store saves snapshots through the configured Zotero pref key", () => {
  const writes = [];
  const store = createWorkbenchRuntimeStore({
    getPref: () => "",
    setPref: (key, value) => writes.push([key, value]),
    snapshotPrefKey: "custom.snapshot.key"
  });
  const snapshot = createEmptyWorkbenchSnapshot({ now: () => "2026-05-21T01:03:00.000Z" });

  assert.equal(store.saveSnapshot(snapshot), snapshot);
  assert.deepEqual(writes, [["custom.snapshot.key", JSON.stringify(snapshot)]]);
});

test("workbench runtime store updates the loaded snapshot and persists the result", () => {
  let storedValue = JSON.stringify({
    schemaVersion: 1,
    exportedAt: "2026-05-20T10:00:00.000Z",
    researchNoteDrafts: []
  });
  const store = createWorkbenchRuntimeStore({
    getPref: (key) => {
      assert.equal(key, SNAPSHOT_PREF_KEY);
      return storedValue;
    },
    setPref: (key, value) => {
      assert.equal(key, SNAPSHOT_PREF_KEY);
      storedValue = value;
    }
  });

  const updated = store.updateSnapshot((snapshot) => ({
    ...snapshot,
    researchNoteDrafts: [{ id: "draft-b" }]
  }));

  assert.deepEqual(updated.researchNoteDrafts, [{ id: "draft-b" }]);
  assert.deepEqual(JSON.parse(storedValue).researchNoteDrafts, [{ id: "draft-b" }]);
});

test("workbench runtime store exposes the same interface to browser runtime scripts", () => {
  const source = fs.readFileSync(path.join(root, "src/core/workbenchRuntimeStore.js"), "utf8");
  const context = {
    Date,
    Error,
    JSON,
    Object,
    String,
    window: {}
  };

  vm.runInNewContext(source, context, { filename: "workbenchRuntimeStore.js" });

  assert.equal(typeof context.window.WorkbenchRuntimeStore.createWorkbenchRuntimeStore, "function");
  const store = context.window.WorkbenchRuntimeStore.createWorkbenchRuntimeStore({
    getPref: () => "",
    now: () => "2026-05-21T01:04:00.000Z"
  });

  assert.equal(store.loadSnapshot().schemaVersion, 1);
  assert.equal(store.loadSnapshot().exportedAt, "2026-05-21T01:04:00.000Z");
});
