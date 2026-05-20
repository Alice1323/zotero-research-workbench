# WebDAV Auto-Create Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically create configured WebDAV remote directories before JSON upload.

**Architecture:** Add a pure core request builder for directory `MKCOL` operations, mirror it in Zotero runtime, and run it only from the upload path before `PUT`.

**Tech Stack:** JavaScript, Node built-in test runner, Zotero XHTML runtime.

---

### Task 1: Core MKCOL Request Builder

**Files:**
- Modify: `tests/core.test.js`
- Modify: `src/core/index.js`

- [ ] **Step 1: Write failing test**

Assert `buildWebDavDirectoryRequests` creates two `MKCOL` requests for `zotero/workbench`.

- [ ] **Step 2: Run red test**

Run: `node tests\core.test.js`

Expected: FAIL because the helper is not exported.

- [ ] **Step 3: Implement helper**

Normalize target, split remote directory, and build parent-to-child URLs with Basic auth.

- [ ] **Step 4: Run green test**

Run: `node tests\core.test.js`

Expected: PASS.

### Task 2: Runtime Upload Wiring

**Files:**
- Modify: `tests/ui-localization.test.js`
- Modify: `chrome/content/paperSummary.js`

- [ ] **Step 1: Write failing runtime assertions**

Assert runtime contains `ensureWebDavRemoteDirectory`, `method: "MKCOL"`, and accepts `201` / `405`.

- [ ] **Step 2: Run red test**

Run: `node tests\ui-localization.test.js`

Expected: FAIL because upload does not create directories yet.

- [ ] **Step 3: Implement runtime wiring**

Call `ensureWebDavRemoteDirectory(target)` before `buildWebDavExportRequest`/`PUT`.

- [ ] **Step 4: Run focused tests**

Run: `node tests\ui-localization.test.js`

Expected: PASS.

### Task 3: Verify and Install

- [ ] Run `npm test`
- [ ] Run `npm run check`
- [ ] Run `npm run package`
- [ ] Confirm Zotero is stopped, copy XPI to active profile, verify SHA256
- [ ] Append checkpoint
