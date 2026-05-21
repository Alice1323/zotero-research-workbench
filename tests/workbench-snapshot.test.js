const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  SECRET_PLACEHOLDER,
  createWorkbenchExportPackage,
  createWorkbenchZipExportPayload,
  importWorkbenchExportPackage,
  importWorkbenchZipExportPayload,
  normalizeSnapshotForImport
} = require("../src/core/workbenchSnapshot");

const root = path.resolve(__dirname, "..");

test("workbench snapshot module exports redacted JSON packages", () => {
  const exported = createWorkbenchExportPackage({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "2026-05-20T10:00:00.000Z",
      providers: [{ id: "provider-a", apiKey: "sk-live-secret", headers: { Authorization: "Bearer runtime-token" } }],
      promptTemplates: [],
      promptOverrides: [],
      providerProvenance: [{ password: "webdav-password" }],
      researchNoteDrafts: [{ id: "draft-a" }],
      graphSeeds: [{ id: "seed-a" }],
      citationRelations: [{ id: "relation-a" }],
      taskLedger: [{ id: "task-a", errorNotice: { token: "task-token" } }]
    },
    exportedAt: "2026-05-20T11:00:00.000Z"
  });

  assert.equal(exported.packageKind, "zotero-research-workbench-export");
  assert.equal(exported.packageVersion, 1);
  assert.equal(exported.snapshot.exportedAt, "2026-05-20T11:00:00.000Z");
  assert.equal(exported.snapshot.providers[0].apiKey, SECRET_PLACEHOLDER);
  assert.equal(exported.snapshot.providers[0].headers.Authorization, SECRET_PLACEHOLDER);
  assert.equal(exported.snapshot.providerProvenance[0].password, SECRET_PLACEHOLDER);
  assert.equal(exported.snapshot.taskLedger[0].errorNotice.token, SECRET_PLACEHOLDER);
});

test("workbench snapshot module imports package strings into normalized arrays", () => {
  const restored = importWorkbenchExportPackage(
    JSON.stringify({
      packageKind: "zotero-research-workbench-export",
      packageVersion: 1,
      exportedAt: "2026-05-20T11:00:00.000Z",
      snapshot: {
        schemaVersion: 1,
        researchNoteDrafts: [{ id: "draft-a" }]
      }
    })
  );

  assert.equal(restored.schemaVersion, 1);
  assert.equal(restored.researchNoteDrafts[0].id, "draft-a");
  assert.deepEqual(restored.providers, []);
  assert.deepEqual(restored.graphSeeds, []);
  assert.deepEqual(restored.citationRelations, []);
  assert.deepEqual(restored.taskLedger, []);
});

test("workbench snapshot module wraps ZIP payloads around JSON export packages", () => {
  const payload = createWorkbenchZipExportPayload({
    snapshot: {
      schemaVersion: 1,
      providers: [{ id: "provider-a", apiKey: "sk-live-secret" }],
      promptTemplates: [],
      promptOverrides: [],
      providerProvenance: [],
      researchNoteDrafts: [],
      graphSeeds: [],
      citationRelations: [{ id: "relation-a" }],
      taskLedger: []
    },
    exportedAt: "2026-05-20T11:00:00.000Z"
  });

  assert.deepEqual(Object.keys(payload.files).sort(), ["manifest.json", "snapshot.json"]);
  assert.equal(payload.files["manifest.json"].snapshotPath, "snapshot.json");
  assert.equal(payload.files["snapshot.json"].packageKind, "zotero-research-workbench-export");
  assert.equal(payload.files["snapshot.json"].snapshot.providers[0].apiKey, SECRET_PLACEHOLDER);
  assert.equal(payload.files["snapshot.json"].snapshot.citationRelations[0].id, "relation-a");
});

test("workbench snapshot module imports ZIP payloads through JSON package validation", () => {
  const payload = createWorkbenchZipExportPayload({
    snapshot: {
      schemaVersion: 1,
      providers: [],
      promptTemplates: [],
      promptOverrides: [],
      providerProvenance: [],
      researchNoteDrafts: [{ id: "draft-a" }],
      graphSeeds: [{ id: "seed-a" }],
      citationRelations: [{ id: "relation-a" }],
      taskLedger: [{ id: "task-a" }]
    },
    exportedAt: "2026-05-20T11:00:00.000Z"
  });

  const restored = importWorkbenchZipExportPayload(payload);

  assert.equal(restored.researchNoteDrafts[0].id, "draft-a");
  assert.equal(restored.graphSeeds[0].id, "seed-a");
  assert.equal(restored.citationRelations[0].id, "relation-a");
  assert.equal(restored.taskLedger[0].id, "task-a");
});

test("workbench snapshot module rejects missing ZIP snapshot entries", () => {
  assert.throws(
    () =>
      importWorkbenchZipExportPayload({
        packageKind: "zotero-research-workbench-zip-export",
        packageVersion: 1,
        files: {
          "manifest.json": {
            packageKind: "zotero-research-workbench-zip-export",
            packageVersion: 1,
            snapshotPath: "snapshot.json"
          }
        }
      }),
    /ZIP 导出包缺少 snapshot\.json/
  );
});

test("workbench snapshot module keeps import errors localized for runtime callers", () => {
  assert.throws(() => importWorkbenchExportPackage("{"), /导入文件不是有效 JSON/);
  assert.throws(
    () =>
      importWorkbenchExportPackage({
        packageKind: "unknown",
        packageVersion: 1,
        snapshot: { schemaVersion: 1 }
      }),
    /不支持的工作台导出文件/
  );
  assert.throws(() => normalizeSnapshotForImport({ schemaVersion: 2 }), /不支持的工作台快照版本/);
});

test("workbench snapshot module rejects unsupported snapshot schema", () => {
  assert.throws(() => normalizeSnapshotForImport({ schemaVersion: 2 }), /不支持的工作台快照版本/);
});

test("workbench snapshot module exposes the same interface to browser runtime scripts", () => {
  const source = fs.readFileSync(path.join(root, "src/core/workbenchSnapshot.js"), "utf8");
  const context = {
    Date,
    JSON,
    RegExp,
    String,
    window: {}
  };

  vm.runInNewContext(source, context, { filename: "workbenchSnapshot.js" });

  assert.equal(typeof context.window.WorkbenchSnapshot.createWorkbenchExportPackage, "function");
  assert.equal(typeof context.window.WorkbenchSnapshot.importWorkbenchZipExportPayload, "function");

  const payload = context.window.WorkbenchSnapshot.createWorkbenchZipExportPayload({
    snapshot: {
      schemaVersion: 1,
      providers: [{ id: "provider-a", apiKey: "sk-live-secret" }],
      researchNoteDrafts: [{ id: "draft-a" }]
    },
    exportedAt: "2026-05-21T01:00:00.000Z"
  });

  assert.equal(payload.files["snapshot.json"].snapshot.providers[0].apiKey, SECRET_PLACEHOLDER);
  assert.equal(context.window.WorkbenchSnapshot.importWorkbenchZipExportPayload(payload).researchNoteDrafts[0].id, "draft-a");
});
