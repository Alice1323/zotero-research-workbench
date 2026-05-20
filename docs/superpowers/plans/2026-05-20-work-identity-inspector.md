# Work Identity Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact, read-only Work Identity Inspector that shows local Work identity clues already present in the Workbench snapshot.

**Architecture:** Add a small core helper in `src/core/workIdentity.js` that aggregates Work clues from research note drafts, graph seeds, and citation relations. Mirror the helper in `chrome/content/paperSummary.js` for Zotero runtime and render it in the existing global records area using the same segmented button and record-list patterns.

**Tech Stack:** Zotero XHTML/JavaScript, CommonJS core helpers, Node `node:test`, PowerShell packaging.

---

### Task 1: Tests First

- [ ] Add `tests/work-identity.test.js` covering aggregation, counts, DOI/Zotero key extraction, current-work filtering, and newest-first sorting.
- [ ] Add UI localization assertions for `Work Identity Inspector`, scope controls, empty state, list id, refresh button, and runtime wiring.
- [ ] Run `node tests\work-identity.test.js` and `node tests\ui-localization.test.js`; expected: new tests fail before implementation.

### Task 2: Core Helper

- [ ] Create `src/core/workIdentity.js`.
- [ ] Implement `listWorkIdentitiesForInspector(snapshot, filters)` as a pure function.
- [ ] Aggregate sources from `researchNoteDrafts`, `graphSeeds`, and `citationRelations`.
- [ ] Track `draftCount`, `graphSeedCount`, `citationRelationCount`, `recordCount`, and `lastSeenAt`.
- [ ] Export the helper and add it to `npm run check`.

### Task 3: Zotero Runtime UI

- [ ] Add a `Work Identity Inspector` section to `chrome/content/researchPanel.xhtml`.
- [ ] Add hidden/button scope control, refresh button, and `work-identity-inspector-list`.
- [ ] Mirror the helper in `chrome/content/paperSummary.js`.
- [ ] Render Work identity rows from `loadWorkbenchSnapshot()` and `currentSelectedWorkId()`.
- [ ] Refresh inspector from `renderWorkbenchRecords()` and on scope/refresh clicks.

### Task 4: Docs, Package, Checkpoint

- [ ] Update `README.md` with read-only Work Identity Inspector behavior.
- [ ] Run `node tests\work-identity.test.js`.
- [ ] Run `node tests\ui-localization.test.js`.
- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Run `npm run package`.
- [ ] Copy XPI to the active Zotero profile if Zotero is not running, then verify SHA256.
- [ ] Append a checkpoint under `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径`.
