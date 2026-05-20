# Local Export Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-release local JSON export/import for Zotero Research Workbench state without exporting secret material.

**Architecture:** Keep package validation and redaction in the Node-testable core module. The Zotero panel only reads the local snapshot pref, writes a selected JSON file, reads a selected JSON file, and updates the snapshot pref after validation.

**Tech Stack:** Zotero chrome XHTML/JavaScript, CommonJS core tests with `node:test`, local JSON export files.

---

### Task 1: Core Export Package

**Files:**
- Modify: `src/core/index.js`
- Modify: `tests/core.test.js`

- [ ] **Step 1: Write failing tests**

Add tests that call `createWorkbenchExportPackage()` and `importWorkbenchExportPackage()` with providers, drafts, graph seeds, task ledger records, prompt overrides, and provider provenance. The exported JSON must redact `apiKey`, `password`, `token`, `authorization`, and `secret` fields, and import must restore the non-secret snapshot arrays.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/core.test.js`

Expected: FAIL because `createWorkbenchExportPackage` is not exported.

- [ ] **Step 3: Implement core functions**

Add:

```js
function createWorkbenchExportPackage({ snapshot, exportedAt }) {
  return {
    packageKind: "zotero-research-workbench-export",
    packageVersion: 1,
    exportedAt: exportedAt || new Date().toISOString(),
    snapshot: normalizeSnapshotForExport(snapshot, exportedAt)
  };
}

function importWorkbenchExportPackage(input) {
  const parsed = typeof input === "string" ? JSON.parse(input) : input;
  if (parsed?.packageKind !== "zotero-research-workbench-export" || parsed?.packageVersion !== 1) {
    throw new Error("Unsupported workbench export package");
  }
  return normalizeSnapshotForImport(parsed.snapshot);
}
```

Export both functions from `src/core/index.js`.

- [ ] **Step 4: Run focused test**

Run: `node --test tests/core.test.js`

Expected: PASS.

### Task 2: Research Panel File Actions

**Files:**
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `chrome/content/paperSummary.js`
- Modify: `tests/ui-localization.test.js`

- [ ] **Step 1: Write failing UI tests**

Assert the panel contains:

```html
id="export-workbench-state"
id="import-workbench-state"
id="workbench-export-status"
```

Assert runtime script contains:

```js
exportWorkbenchState
importWorkbenchState
createWorkbenchExportPackage
importWorkbenchExportPackage
```

- [ ] **Step 2: Run UI test**

Run: `node --test tests/ui-localization.test.js`

Expected: FAIL because the buttons and runtime functions do not exist.

- [ ] **Step 3: Add UI controls**

In the global entry section, add export/import buttons and a status paragraph.

- [ ] **Step 4: Add runtime file actions**

Implement `exportWorkbenchState()` and `importWorkbenchState()` in `chrome/content/paperSummary.js` using Zotero-compatible file picker and file IO helpers. JSON export is the first shipped path; ZIP/WebDAV remain deferred.

- [ ] **Step 5: Run UI test**

Run: `node --test tests/ui-localization.test.js`

Expected: PASS.

### Task 3: Package And Verification

**Files:**
- Modify: `tests/package.test.js`
- Modify: `README.md`

- [ ] **Step 1: Extend package test**

Assert `paperSummary.js` remains in the XPI package boundary and that README documents local export/import.

- [ ] **Step 2: Run all verification**

Run:

```powershell
npm test
npm run check
npm run package
```

Expected: all exit 0.

- [ ] **Step 3: Write progress checkpoint**

Append a concise checkpoint under `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径` with changed files, verification evidence, and next steps.
