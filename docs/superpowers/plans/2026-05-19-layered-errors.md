# Layered Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe layered error messages with expandable technical details to the Zotero research workbench panel.

**Architecture:** Core code exposes a pure `createLayeredErrorNotice(error, fallbackMessage)` helper for testable sanitization. Runtime code mirrors the helper for the Zotero panel and routes high-risk catch blocks through `showLayeredError`, while normal statuses use `showStatus` to clear stale details.

**Tech Stack:** JavaScript, Node built-in test runner, Zotero XHTML panel.

---

### Task 1: Core Error Notice Helper

**Files:**
- Modify: `tests/core.test.js`
- Modify: `src/core/index.js`

- [ ] **Step 1: Write the failing test**

Add a test that imports `createLayeredErrorNotice`, passes an error with message, stack, Authorization, password, token, and nested secret fields, then asserts that the user message is preserved and secret values are absent from technical detail.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests\core.test.js`

Expected: FAIL because `createLayeredErrorNotice` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add `createLayeredErrorNotice`, `formatTechnicalErrorDetail`, and a string sanitizer using `SECRET_PLACEHOLDER`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests\core.test.js`

Expected: PASS.

### Task 2: Panel Error Drawers

**Files:**
- Modify: `tests/ui-localization.test.js`
- Modify: `chrome/content/researchPanel.xhtml`

- [ ] **Step 1: Write the failing test**

Assert that the panel contains `paper-error-details`, `workbench-error-details`, `webdav-error-details`, `graph-seed-error-details`, and the Chinese summary text `技术细节`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests\ui-localization.test.js`

Expected: FAIL because the details nodes do not exist.

- [ ] **Step 3: Add the drawers**

Insert one hidden `<details class="error-details">` below each relevant status paragraph, with a `<summary>技术细节</summary>` and `<pre id="...-error-detail-text"></pre>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests\ui-localization.test.js`

Expected: PASS.

### Task 3: Runtime Wiring

**Files:**
- Modify: `tests/ui-localization.test.js`
- Modify: `chrome/content/paperSummary.js`

- [ ] **Step 1: Write the failing test**

Assert that runtime defines `showLayeredError`, `createLayeredErrorNotice`, and calls `showLayeredError` in summary, translation, note save, workbench import/export, ZIP import/export, WebDAV, and graph seed catch blocks.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests\ui-localization.test.js`

Expected: FAIL because runtime does not define or call the helper.

- [ ] **Step 3: Implement wiring**

Add `showStatus(statusId, message)`, `showLayeredError(statusId, detailId, fallbackMessage, error)`, and replace high-risk `status.textContent = error?.message || ...` catch paths.

- [ ] **Step 4: Run focused tests**

Run: `node tests\core.test.js`

Run: `node tests\ui-localization.test.js`

Expected: PASS.

### Task 4: Full Verification and Package

**Files:**
- Runtime artifacts under `dist/`
- Active Zotero profile XPI
- Checkpoint file under `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径`

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run syntax checks**

Run: `npm run check`

Expected: exit code 0.

- [ ] **Step 3: Build package**

Run: `npm run package`

Expected: exit code 0 and a fresh XPI in `dist/`.

- [ ] **Step 4: Install active profile XPI**

Copy `dist/zotero-research-workbench.xpi` to the active Zotero profile extension path and record SHA256.

- [ ] **Step 5: Append checkpoint**

Append a concise entry with changed files, verification commands, XPI path, SHA256, and next-step candidates.
