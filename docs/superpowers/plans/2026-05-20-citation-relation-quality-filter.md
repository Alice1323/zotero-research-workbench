# Citation Relation Quality Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only quality filter to the Citation Graph Inspector and provide local fixture relations for manual verification.

**Architecture:** Reuse existing `qualityTags` on citation relation inspector records. Add one segmented XHTML filter and pass `qualityTag` through the runtime to the existing core/runtime list functions; inject manual test records only into the Workbench Local Store snapshot, never Zotero-native items.

**Tech Stack:** CommonJS core, Zotero XHTML runtime JavaScript, Node `node:test`, PowerShell profile file operations.

---

### Task 1: Core Quality Tag Filtering

**Files:**
- Modify: `src/core/graphSeed.js`
- Test: `tests/graph-seed.test.js`

- [ ] **Step 1: Write failing core test**

Verify `listCitationRelationsForInspector(snapshot, { qualityTag: "缺少证据" })` returns only matching relations, `qualityTag: "all"` returns all, and `qualityTag` can combine with `scope: "current-work"`.

- [ ] **Step 2: Verify RED**

Run: `node tests\graph-seed.test.js`
Expected: FAIL because `qualityTag` is not yet filtered.

- [ ] **Step 3: Implement core filter**

Update `matchesCitationRelationInspectorFilters()` to treat empty/all as inactive and otherwise require `relation.qualityTags.includes(filters.qualityTag)`.

- [ ] **Step 4: Verify GREEN**

Run: `node tests\graph-seed.test.js`
Expected: PASS.

### Task 2: UI Segmented Filter

**Files:**
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `chrome/content/paperSummary.js`
- Test: `tests/ui-localization.test.js`

- [ ] **Step 1: Write failing UI wiring test**

Assert the panel contains `citation-graph-quality-filter`, `质量筛选`, `全部质量`, and all quality tag buttons. Assert runtime reads `qualityTag`, has a `citation-graph-quality-filter` switch case, and matches relation `qualityTags`.

- [ ] **Step 2: Verify RED**

Run: `node tests\ui-localization.test.js`
Expected: FAIL because the filter is not wired.

- [ ] **Step 3: Implement UI wiring**

Add the hidden input/segmented buttons, read the filter in `readCitationGraphInspectorFilters()`, update runtime matching, and refresh the inspector when the filter changes.

- [ ] **Step 4: Verify GREEN**

Run: `node tests\ui-localization.test.js`
Expected: PASS.

### Task 3: Manual Fixture And Integration

**Files:**
- Modify: `README.md`
- Modify: active profile `prefs.js` only after backup and only when Zotero is closed.
- Append: `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径\2026-05-18_2005_zotero-research-workbench_checkpoint.md`

- [ ] **Step 1: Update README**

Document the quality filter and its read-only boundary.

- [ ] **Step 2: Run verification**

Run:

```powershell
npm test
npm run check
npm run package
```

- [ ] **Step 3: Install XPI**

If Zotero is closed, cover active profile XPI and verify source/target hashes match.

- [ ] **Step 4: Inject manual fixture if absent**

If `prefs.js` lacks `zrw-citation-quality-test-`, back it up and append Workbench Local Store snapshot records with one complete relation and several incomplete relations tagged by missing target/evidence/source seed and low confidence.

- [ ] **Step 5: Append checkpoint**

Record implementation, fixture marker, verification, active XPI hash, and manual check steps.
