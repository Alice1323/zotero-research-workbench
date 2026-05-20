# ZIP Export Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local ZIP export/import as a wrapper around the existing redacted Workbench JSON export package.

**Architecture:** Core helpers build an abstract two-file ZIP payload (`manifest.json`, `snapshot.json`) and parse it back through the existing JSON package validator. Zotero runtime turns the payload into a `.zip` file and reads it back with chrome ZIP APIs, while existing JSON export/import stays compatible.

**Tech Stack:** Zotero chrome JavaScript, CommonJS core helpers, Node `node:test`, existing PowerShell XPI packaging.

---

### Task 1: Core ZIP Payload Helpers

**Files:**
- Modify: `src/core/index.js`
- Test: `tests/core.test.js`

- [ ] **Step 1: Write failing tests**

Add imports:

```js
createWorkbenchZipExportPayload,
importWorkbenchZipExportPayload
```

Add a test that creates a snapshot with secret fields, calls `createWorkbenchZipExportPayload({ snapshot, exportedAt })`, and asserts:

```js
assert.equal(payload.packageKind, "zotero-research-workbench-zip-export");
assert.equal(payload.files["manifest.json"].packageKind, "zotero-research-workbench-zip-export");
assert.equal(payload.files["manifest.json"].snapshotPath, "snapshot.json");
assert.equal(payload.files["snapshot.json"].snapshot.providers[0].apiKey, SECRET_PLACEHOLDER);
```

Add a test that calls `importWorkbenchZipExportPayload(payload)` and restores `researchNoteDrafts`, `graphSeeds`, and `taskLedger`.

Add a test that omits `snapshot.json` and expects `ZIP 导出包缺少 snapshot.json`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/core.test.js
```

Expected: failure because ZIP helpers are not exported.

- [ ] **Step 3: Implement core helpers**

Add:

```js
function createWorkbenchZipExportPayload({ snapshot, exportedAt } = {}) { ... }
function importWorkbenchZipExportPayload(payload) { ... }
```

Use `createWorkbenchExportPackage()` for `snapshot.json` and `importWorkbenchExportPackage()` for import. Export both helpers.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
node --test tests/core.test.js
```

Expected: all core tests pass.

### Task 2: Panel ZIP Buttons And Runtime Wiring

**Files:**
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `chrome/content/paperSummary.js`
- Test: `tests/ui-localization.test.js`

- [ ] **Step 1: Write failing UI tests**

Assert panel contains:

```text
导出 ZIP
导入 ZIP
export-workbench-zip
import-workbench-zip
```

Assert runtime contains:

```text
function exportWorkbenchZip
function importWorkbenchZip
createWorkbenchZipExportPayload
importWorkbenchZipExportPayload
writeZipExportFile
readZipExportFile
export-workbench-zip").addEventListener("click", exportWorkbenchZip)
import-workbench-zip").addEventListener("click", importWorkbenchZip)
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/ui-localization.test.js
```

Expected: failure because ZIP buttons/runtime are absent.

- [ ] **Step 3: Add panel controls**

Add `导出 ZIP` and `导入 ZIP` next to the existing JSON export/import buttons.

- [ ] **Step 4: Add runtime functions**

Implement:

- `exportWorkbenchZip()`;
- `importWorkbenchZip()`;
- `writeZipExportFile(targetFile, payload)`;
- `readZipExportFile(sourceFile)`.

Runtime should preserve the current file picker fallback behavior. If ZIP APIs are unavailable, report `当前 Zotero 环境不可用 ZIP 文件接口`.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node --test tests/ui-localization.test.js
```

Expected: UI tests pass.

### Task 3: Documentation, Verification, Package, Checkpoint

**Files:**
- Modify: `README.md`
- Append checkpoint: `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径\2026-05-18_2005_zotero-research-workbench_checkpoint.md`

- [ ] **Step 1: Update README**

Document ZIP export/import and its boundaries: ZIP contains only redacted `manifest.json` and `snapshot.json`, no attachments or encrypted secrets.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run check
npm run package
```

Expected: all pass and XPI is generated.

- [ ] **Step 3: Install and inspect active XPI**

Copy dist XPI to active Zotero profile when Zotero is not running. Verify hashes match and XPI contains ZIP runtime strings.

- [ ] **Step 4: Append checkpoint**

Record changed files, verification output, XPI hash, and manual Zotero UI checks.
