# Save Draft To Zotero Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit user action that saves the current research note draft as a Zotero note.

**Architecture:** Keep reusable note formatting and snapshot mutation in `src/core/paperSummary.js`, mirror the same pure helpers into `chrome/content/paperSummary.js`, and keep the Zotero API write behind a single Chinese button in the Research Panel. The write path creates a child note for the currently selected Zotero item, records provenance in the local snapshot, and never writes automatically after generation.

**Tech Stack:** Zotero 8/9 item APIs, XHTML panel script, CommonJS pure helpers, Node `node:test`, PowerShell XPI packaging.

---

### Task 1: Core Save-To-Note Helpers

**Files:**
- Modify: `tests/paper-summary.test.js`
- Modify: `src/core/paperSummary.js`

- [x] **Step 1: Write failing tests**

Add tests for `buildZoteroNoteHtml()` and `markSummaryDraftSavedToZotero()`.

- [x] **Step 2: Verify RED**

Run `node tests/paper-summary.test.js`.

Expected: fail because the new exports are missing.

- [x] **Step 3: Implement pure helpers**

Implement escaped Zotero note HTML formatting and immutable snapshot mutation that marks one draft as `confirmed`, records `confirmedZoteroNoteKey`, and appends a `save-to-zotero-note` task.

- [x] **Step 4: Verify GREEN**

Run `node tests/paper-summary.test.js`.

Expected: all paper summary tests pass.

### Task 2: Research Panel Explicit Action

**Files:**
- Modify: `tests/ui-localization.test.js`
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `chrome/content/paperSummary.js`

- [x] **Step 1: Write failing UI test**

Assert the panel contains `确认并写入 Zotero 笔记`, the `save-paper-summary-note` button id, and a confirmation action style hook.

- [x] **Step 2: Verify RED**

Run `node tests/ui-localization.test.js`.

Expected: fail because the new button is absent.

- [x] **Step 3: Add the button and runtime handler**

Add the button next to `复制结果`, wire it to `saveGeneratedResultToZoteroNote()`, and implement a child-note write using `new Zotero.Item("note")`, `parentItemID`, `setNote()`, and `saveTx()`.

- [x] **Step 4: Verify targeted tests**

Run `node tests/ui-localization.test.js` and `node tests/paper-summary.test.js`.

Expected: both pass.

### Task 3: Package And Active Profile Install

**Files:**
- Modify: `README.md`
- Runtime output: `dist/zotero-research-workbench-0.1.0.xpi`
- Active profile XPI: `%APPDATA%\Zotero\Zotero\Profiles\8gsk6fny.default\extensions\zotero-research-workbench@local.xpi`

- [x] **Step 1: Document the explicit save action**

Update README to state that generated summaries remain drafts until the user clicks `确认并写入 Zotero 笔记`.

- [x] **Step 2: Run full verification**

Run `npm test`, `npm run check`, and `npm run package`.

Expected: all exit with code `0`.

- [x] **Step 3: Replace active profile XPI and verify contents**

Copy the generated XPI into the active profile extension path and use `tar -xOf` to verify the installed package contains the new Chinese button and runtime handler.
