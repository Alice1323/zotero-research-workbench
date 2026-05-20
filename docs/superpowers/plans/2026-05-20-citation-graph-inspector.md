# Citation Graph Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact, read-only Citation Graph Inspector for local `citationRelations`.

**Architecture:** Keep relation filtering and display shaping in `src/core/graphSeed.js`, mirror the same small helper in `chrome/content/paperSummary.js`, and render the result in the existing Research Panel global records area. The inspector reads only the Workbench Local Store snapshot and never writes Zotero item metadata.

**Tech Stack:** Zotero XHTML/JavaScript, CommonJS core helpers, Node `node:test`, PowerShell packaging.

---

### Task 1: Tests First

- [ ] Add a graph seed core test for `listCitationRelationsForInspector(snapshot, filters)`.
- [ ] Add UI localization assertions for `Citation Graph Inspector`, scope controls, empty state, list id, refresh button, and runtime wiring.
- [ ] Run `node tests\graph-seed.test.js` and `node tests\ui-localization.test.js`; expected: new tests fail before implementation.

### Task 2: Core Helper

- [ ] Implement `listCitationRelationsForInspector(snapshot, filters)` in `src/core/graphSeed.js`.
- [ ] Sort newest first by `createdAt`.
- [ ] Filter to current Work when `filters.scope === "current-work"` and `filters.workId` is present.
- [ ] Export the helper.

### Task 3: Zotero Runtime UI

- [ ] Add a `Citation Graph Inspector` section to `chrome/content/researchPanel.xhtml`.
- [ ] Add hidden/button scope control, refresh button, and `citation-graph-inspector-list`.
- [ ] Mirror the helper in `chrome/content/paperSummary.js`.
- [ ] Render relation rows from `loadWorkbenchSnapshot()` and `currentSelectedWorkId()`.
- [ ] Refresh inspector from `renderWorkbenchRecords()` and on scope/refresh clicks.

### Task 4: Docs, Package, Checkpoint

- [ ] Update `README.md` with read-only inspector behavior.
- [ ] Run `node tests\graph-seed.test.js`.
- [ ] Run `node tests\ui-localization.test.js`.
- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Run `npm run package`.
- [ ] Copy XPI to the active Zotero profile only if Zotero is not running, then verify SHA256.
- [ ] Append a checkpoint under `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径`.
