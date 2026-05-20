# Citation Relation Quality Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only quality tags to the Citation Graph Inspector so users can quickly spot incomplete local citation relations.

**Architecture:** Extend inspector records with derived `qualityTags` from existing local snapshot fields only. Mirror the derivation in the Zotero runtime and append tags to each `引用关系图谱` detail line; do not add actions, external lookups, Zotero-native writes, or graph layout behavior.

**Tech Stack:** CommonJS core, Zotero XHTML runtime JavaScript, Node `node:test`, PowerShell packaging.

---

### Task 1: Core Quality Tags

**Files:**
- Modify: `src/core/graphSeed.js`
- Test: `tests/graph-seed.test.js`

- [ ] **Step 1: Write failing core test**

Add a test that verifies `listCitationRelationsForInspector()` returns `qualityTags` with these rules:
- complete relation -> `[]`
- missing target -> `缺少目标`
- missing evidence -> `缺少证据`
- low confidence -> `低置信度`
- missing graph seed id -> `缺少来源种子`

- [ ] **Step 2: Verify RED**

Run: `node tests\graph-seed.test.js`
Expected: FAIL because `qualityTags` is not present.

- [ ] **Step 3: Implement core derivation**

Add a pure helper near `toCitationRelationInspectorRecord()` and include `qualityTags` in the returned record. Keep existing filters and sorting unchanged.

- [ ] **Step 4: Verify GREEN**

Run: `node tests\graph-seed.test.js`
Expected: PASS.

### Task 2: Runtime Display

**Files:**
- Modify: `chrome/content/paperSummary.js`
- Test: `tests/ui-localization.test.js`

- [ ] **Step 1: Write failing UI wiring test**

Assert runtime contains `qualityTags`, `createCitationRelationQualityTags`, `formatCitationRelationQualityTags`, and all Chinese quality tag labels.

- [ ] **Step 2: Verify RED**

Run: `node tests\ui-localization.test.js`
Expected: FAIL because runtime does not yet derive or render relation quality tags.

- [ ] **Step 3: Implement runtime derivation and rendering**

Mirror the core helper in the runtime copy and append formatted quality tags to the existing `引用关系图谱` detail line after source seed info.

- [ ] **Step 4: Verify GREEN**

Run: `node tests\ui-localization.test.js`
Expected: PASS.

### Task 3: Integration

**Files:**
- Modify: `README.md`
- Append: `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径\2026-05-18_2005_zotero-research-workbench_checkpoint.md`

- [ ] **Step 1: Update README**

Document relation quality tags as read-only review hints.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run check
npm run package
```

Expected: all commands exit 0.

- [ ] **Step 3: Install active XPI when safe**

If Zotero is closed, copy `dist\zotero-research-workbench-0.1.0.xpi` to the active profile XPI path and verify SHA256 equality.

- [ ] **Step 4: Append checkpoint**

Record changed behavior, verification, active XPI hash, risks, and next steps.
