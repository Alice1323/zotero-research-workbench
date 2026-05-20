# Duplicate Work Candidates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Duplicate Work Candidates view that flags possible duplicate local Works without merging or writing Zotero metadata.

**Architecture:** Extend `src/core/workIdentity.js` with `listDuplicateWorkCandidates(snapshot, filters)`, reusing `listWorkIdentitiesForInspector()` output. Mirror the helper in `chrome/content/paperSummary.js` and render candidates in the Research Panel as inspection-only records.

**Tech Stack:** Zotero XHTML/JavaScript, CommonJS core helpers, Node `node:test`, PowerShell packaging.

---

### Task 1: Tests First

- [ ] Extend `tests/work-identity.test.js` with duplicate candidate tests for shared DOI, shared Zotero key, and normalized title hints.
- [ ] Extend `tests/ui-localization.test.js` with Duplicate Work Candidates labels, ids, and runtime wiring.
- [ ] Run `node tests\work-identity.test.js` and `node tests\ui-localization.test.js`; expected: new tests fail before implementation.

### Task 2: Core Helper

- [ ] Implement `listDuplicateWorkCandidates(snapshot, filters)` in `src/core/workIdentity.js`.
- [ ] Group Works by DOI, Zotero key, and normalized title.
- [ ] Return candidates with `reason`, `confidence`, `workIds`, `titles`, and `lastSeenAt`.
- [ ] Filter out groups with fewer than two different Work ids.
- [ ] Export the helper.

### Task 3: Zotero Runtime UI

- [ ] Add a `Duplicate Work Candidates` section to `chrome/content/researchPanel.xhtml`.
- [ ] Add scope filter, refresh button, and `duplicate-work-candidates-list`.
- [ ] Mirror the helper in `chrome/content/paperSummary.js`.
- [ ] Render candidate rows from `loadWorkbenchSnapshot()`.
- [ ] Refresh candidates from `renderWorkbenchRecords()` and on scope/refresh clicks.

### Task 4: Docs, Package, Checkpoint

- [ ] Update `README.md` with read-only duplicate candidate behavior and boundaries.
- [ ] Run target tests, `npm test`, `npm run check`, and `npm run package`.
- [ ] Copy XPI to active Zotero profile if Zotero is not running, verify SHA256, and append checkpoint.
