# Workbench Snapshot Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract Workbench Local Store snapshot export/import behavior into `src/core/workbenchSnapshot.js` while preserving the existing `src/core/index.js` Interface.

**Architecture:** The new Module owns JSON export packages, ZIP payloads, snapshot normalization, and redaction during export. `src/core/index.js` imports and re-exports the Module functions so existing callers remain unchanged. Runtime duplicated functions in `chrome/content/paperSummary.js` are left untouched for this core-only slice.

**Tech Stack:** Node.js CommonJS, `node:test`, Zotero plugin core modules.

---

### Task 1: Add Interface-Level Snapshot Tests

**Files:**
- Create: `tests/workbench-snapshot.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SECRET_PLACEHOLDER,
  createWorkbenchExportPackage,
  createWorkbenchZipExportPayload,
  importWorkbenchExportPackage,
  importWorkbenchZipExportPayload,
  normalizeSnapshotForImport
} = require("../src/core/workbenchSnapshot");

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

test("workbench snapshot module rejects unsupported snapshot schema", () => {
  assert.throws(() => normalizeSnapshotForImport({ schemaVersion: 2 }), /Unsupported workbench snapshot schema/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests\workbench-snapshot.test.js`

Expected: FAIL because `../src/core/workbenchSnapshot` does not exist.

### Task 2: Extract Snapshot Module

**Files:**
- Create: `src/core/workbenchSnapshot.js`
- Modify: `src/core/index.js`

- [ ] **Step 1: Create `src/core/workbenchSnapshot.js`**

Move these functions from `src/core/index.js` into the new file:

```js
const SECRET_PLACEHOLDER = "<redacted>";

function redactSecretMaterial(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecretMaterial(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const redacted = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSecretKey(key) && entry) {
      redacted[key] = SECRET_PLACEHOLDER;
    } else {
      redacted[key] = redactSecretMaterial(entry);
    }
  }
  return redacted;
}

function isSecretKey(key) {
  const value = String(key || "");
  return (
    /^(apiKey|api_key|api-key|password|passwd|pwd|authorization|secret|token)$/i.test(value) ||
    /(^|[_-])(api[_-]?key|password|passwd|pwd|authorization|secret|token)([_-]|$)/i.test(value) ||
    /Token$/.test(value)
  );
}

function createWorkbenchExportPackage({ snapshot, exportedAt } = {}) {
  const timestamp = exportedAt || new Date().toISOString();
  return {
    packageKind: "zotero-research-workbench-export",
    packageVersion: 1,
    exportedAt: timestamp,
    snapshot: normalizeSnapshotForExport(snapshot, timestamp)
  };
}

function importWorkbenchExportPackage(input) {
  let parsed;
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input;
  } catch (_error) {
    throw new Error("Invalid workbench export package JSON");
  }

  if (parsed?.packageKind !== "zotero-research-workbench-export" || parsed?.packageVersion !== 1) {
    throw new Error("Unsupported workbench export package");
  }

  return normalizeSnapshotForImport(parsed.snapshot);
}

function createWorkbenchZipExportPayload({ snapshot, exportedAt } = {}) {
  const timestamp = exportedAt || new Date().toISOString();
  const manifest = {
    packageKind: "zotero-research-workbench-zip-export",
    packageVersion: 1,
    exportedAt: timestamp,
    snapshotPath: "snapshot.json"
  };
  return {
    packageKind: manifest.packageKind,
    packageVersion: manifest.packageVersion,
    exportedAt: timestamp,
    files: {
      "manifest.json": manifest,
      "snapshot.json": createWorkbenchExportPackage({ snapshot, exportedAt: timestamp })
    }
  };
}

function importWorkbenchZipExportPayload(payload) {
  if (payload?.packageKind !== "zotero-research-workbench-zip-export" || payload?.packageVersion !== 1) {
    throw new Error("不支持的 ZIP 工作台导出包");
  }
  const manifest = payload.files?.["manifest.json"];
  if (manifest?.packageKind !== "zotero-research-workbench-zip-export" || manifest?.packageVersion !== 1) {
    throw new Error("不支持的 ZIP 工作台导出包");
  }
  const snapshotPath = manifest.snapshotPath || "snapshot.json";
  const snapshotPackage = payload.files?.[snapshotPath];
  if (!snapshotPackage) {
    throw new Error("ZIP 导出包缺少 snapshot.json");
  }
  return importWorkbenchExportPackage(snapshotPackage);
}

function normalizeSnapshotForExport(snapshot, exportedAt) {
  const normalized = normalizeSnapshotForImport(snapshot);
  normalized.exportedAt = exportedAt || normalized.exportedAt || new Date().toISOString();
  return redactSecretMaterial(normalized);
}

function normalizeSnapshotForImport(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1) {
    throw new Error("Unsupported workbench snapshot schema");
  }

  return {
    schemaVersion: 1,
    exportedAt: snapshot.exportedAt || new Date().toISOString(),
    providers: Array.isArray(snapshot.providers) ? snapshot.providers : [],
    promptTemplates: Array.isArray(snapshot.promptTemplates) ? snapshot.promptTemplates : [],
    promptOverrides: Array.isArray(snapshot.promptOverrides) ? snapshot.promptOverrides : [],
    providerProvenance: Array.isArray(snapshot.providerProvenance) ? snapshot.providerProvenance : [],
    researchNoteDrafts: Array.isArray(snapshot.researchNoteDrafts) ? snapshot.researchNoteDrafts : [],
    graphSeeds: Array.isArray(snapshot.graphSeeds) ? snapshot.graphSeeds : [],
    citationRelations: Array.isArray(snapshot.citationRelations) ? snapshot.citationRelations : [],
    taskLedger: Array.isArray(snapshot.taskLedger) ? snapshot.taskLedger : []
  };
}

module.exports = {
  SECRET_PLACEHOLDER,
  createWorkbenchExportPackage,
  createWorkbenchZipExportPayload,
  importWorkbenchExportPackage,
  importWorkbenchZipExportPayload,
  normalizeSnapshotForExport,
  normalizeSnapshotForImport,
  redactSecretMaterial
};
```

- [ ] **Step 2: Update `src/core/index.js` imports and exports**

At the top, import the snapshot Module:

```js
const {
  SECRET_PLACEHOLDER,
  createWorkbenchExportPackage,
  createWorkbenchZipExportPayload,
  importWorkbenchExportPackage,
  importWorkbenchZipExportPayload,
  normalizeSnapshotForExport,
  normalizeSnapshotForImport,
  redactSecretMaterial
} = require("./workbenchSnapshot");
```

Remove the duplicate local definitions for:

- `SECRET_PLACEHOLDER`
- `redactSecretMaterial`
- `isSecretKey`
- `createWorkbenchExportPackage`
- `importWorkbenchExportPackage`
- `createWorkbenchZipExportPayload`
- `importWorkbenchZipExportPayload`
- `normalizeSnapshotForExport`
- `normalizeSnapshotForImport`

Keep `module.exports` names unchanged, and add `normalizeSnapshotForExport` / `normalizeSnapshotForImport` to exports only if tests import them through `../src/core`.

- [ ] **Step 3: Run target tests**

Run: `node tests\workbench-snapshot.test.js`

Expected: PASS.

Run: `node tests\core.test.js`

Expected: PASS.

### Task 3: Wire Validation Commands

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add syntax check for the new Module**

Update `npm run check` to include:

```powershell
node --check src/core/workbenchSnapshot.js
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run check
```

Expected:

- `npm test`: all tests pass, including new `tests/workbench-snapshot.test.js`.
- `npm run check`: exit 0.

### Task 4: Record Checkpoint

**Files:**
- Modify: `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径\2026-05-18_2005_zotero-research-workbench_checkpoint.md`

- [ ] **Step 1: Append checkpoint**

Append a new entry with:

- spec path
- plan path
- files changed
- tests run
- current next step
- risks, especially runtime/core duplication remaining for later v0.2

- [ ] **Step 2: Do not package or install**

Do not run `npm run package` for this core-only architecture slice unless a later request asks for a release or active Zotero install.
