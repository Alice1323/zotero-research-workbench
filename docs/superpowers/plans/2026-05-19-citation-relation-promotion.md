# Citation Relation Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote confirmed Graph Seeds into local Citation Relation records without writing Zotero metadata.

**Architecture:** Keep the canonical behavior in `src/core/graphSeed.js` and mirror the same helper in `chrome/content/paperSummary.js` for Zotero runtime. Preserve `citationRelations` through existing snapshot export/import normalizers and expose a single `生成关系` action in the existing review queue.

**Tech Stack:** Zotero plugin XHTML/JavaScript, CommonJS core modules, Node `node:test`, PowerShell packaging.

---

## File Structure

- Modify `tests/graph-seed.test.js` for promotion helper coverage.
- Modify `tests/core.test.js` for snapshot export/import preservation of `citationRelations`.
- Modify `tests/ui-localization.test.js` for Chinese labels and runtime wiring.
- Modify `src/core/graphSeed.js` to add `promoteGraphSeedToCitationRelation`.
- Modify `src/core/index.js` to add `citationRelations` to Workbench store export/import and snapshot normalization.
- Modify `chrome/content/paperSummary.js` to mirror promotion helper and wire the review queue action.
- Modify `README.md` to document local Citation Relation promotion.

### Task 1: Tests First

- [ ] Add a core test proving a confirmed seed produces one Citation Relation, updates the seed with `promotedCitationRelationId`, appends a promotion task, preserves immutability, and sets `exportedAt`.
- [ ] Add a core test proving re-promoting an already promoted seed is idempotent.
- [ ] Add a core test proving pending/rejected seeds throw `图谱种子尚未确认` and unknown ids throw `未找到图谱种子`.
- [ ] Add an export/import test proving `citationRelations` survive snapshot export/import.
- [ ] Add UI assertions for `生成关系`, `已生成关系`, `promoteGraphSeedToCitationRelation`, and `promoteGraphSeed`.
- [ ] Run targeted tests and confirm the new tests fail before implementation.

### Task 2: Core Promotion Helper

- [ ] Implement `promoteGraphSeedToCitationRelation({ snapshot, seedId, promotedAt })`.
- [ ] Require existing seed id.
- [ ] Require `reviewState === "confirmed"`.
- [ ] Use relation id `citation-relation-${seedId}`.
- [ ] Return unchanged cloned state when relation already exists.
- [ ] Append one `promote-graph-seed-to-citation-relation` task when creating a new relation.
- [ ] Export the helper from `src/core/graphSeed.js`.

### Task 3: Snapshot Preservation

- [ ] Add `citationRelations` to `WorkbenchLocalStore` constructor state.
- [ ] Preserve `citationRelations` in `exportSnapshot()`.
- [ ] Restore `citationRelations` in `importSnapshot()`.
- [ ] Preserve `citationRelations` in `normalizeSnapshotForImport()`.

### Task 4: Zotero Runtime Wiring

- [ ] Mirror `promoteGraphSeedToCitationRelation` in `chrome/content/paperSummary.js`.
- [ ] Add `promoteGraphSeed(seedId)` runtime action that updates snapshot prefs, shows status, refreshes records, and handles errors through layered details.
- [ ] In `renderGraphSeedReviewQueue()`, show `生成关系` for confirmed seeds without `promotedCitationRelationId`.
- [ ] Show `已生成关系：<id>` for promoted seeds.
- [ ] Export both helper/action through `window.WorkbenchPaperSummary`.

### Task 5: Docs, Verification, Package, Install

- [ ] Update README with local Citation Relation promotion behavior and boundaries.
- [ ] Run `node tests\graph-seed.test.js`.
- [ ] Run `node tests\core.test.js`.
- [ ] Run `node tests\ui-localization.test.js`.
- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Run `npm run package`.
- [ ] If Zotero is closed, install the XPI and verify source/target SHA256.
- [ ] Append a checkpoint under `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径`.
