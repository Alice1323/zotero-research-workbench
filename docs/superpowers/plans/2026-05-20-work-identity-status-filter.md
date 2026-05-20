# Work Identity Status Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only status-tag filter to `作品身份线索`.

**Architecture:** Reuse existing `statusTags` derived from local Workbench snapshot records. Add one segmented XHTML filter and pass `statusTag` through both core and Zotero runtime list functions; no Zotero-native item writes, no work merging, and no external identity lookup.

**Tech Stack:** CommonJS core, Zotero XHTML/runtime JavaScript, Node tests.

---

### Task 1: Core Status Filtering

**Files:**
- Modify: `tests/work-identity.test.js`
- Modify: `src/core/workIdentity.js`

- [ ] **Step 1: Write the failing test**

Add a test that verifies `listWorkIdentitiesForInspector(snapshot, { statusTag: "无 DOI" })` returns only records whose derived `statusTags` include `无 DOI`; `statusTag: "all"` remains inactive; and `scope: "current-work"` composes with `statusTag`.

- [ ] **Step 2: Run red test**

Run: `node tests\work-identity.test.js`

Expected: FAIL because `statusTag` is ignored.

- [ ] **Step 3: Implement core filter**

Update `matchesWorkIdentityFilters(work, filters)` to derive `recordCount`, call `createWorkIdentityStatusTags(work, recordCount)`, and require `statusTags.includes(cleanText(filters.statusTag))` when `statusTag` is active.

- [ ] **Step 4: Run green test**

Run: `node tests\work-identity.test.js`

Expected: PASS.

### Task 2: Zotero Runtime And XHTML Filter

**Files:**
- Modify: `tests/ui-localization.test.js`
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `chrome/content/paperSummary.js`

- [ ] **Step 1: Write failing UI wiring assertions**

Assert the panel contains `work-identity-status-filter`, `身份筛选`, `全部身份`, and the four Chinese status tags. Assert runtime reads `statusTag`, filters through `work.statusTags.includes(cleanText(filters.statusTag))`, and dispatches `work-identity-status-filter` to `renderWorkIdentityInspector()`.

- [ ] **Step 2: Run red UI test**

Run: `node tests\ui-localization.test.js`

Expected: FAIL because the filter control and runtime wiring do not exist.

- [ ] **Step 3: Implement XHTML/runtime**

Add a segmented filter beside `身份范围`, read `statusTag` in `readWorkIdentityInspectorFilters()`, mirror the core filter in runtime `matchesWorkIdentityFilters()`, and refresh the inspector from `renderSegmentedFilterTarget()`.

- [ ] **Step 4: Run green UI test**

Run: `node tests\ui-localization.test.js`

Expected: PASS.

### Task 3: Docs, Package, And Manual Fixture

**Files:**
- Modify: `README.md`
- Update active package: `dist/zotero-research-workbench-0.1.0.xpi`
- Optionally update active profile `prefs.js` after backup if manual fixture is needed.

- [ ] **Step 1: Update README**

State that `作品身份线索` can be filtered by read-only status tags and that the filter only changes local Workbench display.

- [ ] **Step 2: Verify**

Run: `node tests\work-identity.test.js`, `node tests\ui-localization.test.js`, `npm test`, `npm run check`, `npm run package`.

- [ ] **Step 3: Install active XPI**

Confirm Zotero is closed, copy the packaged XPI to the active profile extension path, and verify source/target SHA256 match.

- [ ] **Step 4: Record checkpoint**

Append command results, active XPI hash, any fixture marker, manual check steps, and remaining risk to the checkpoint file.
