# Reading Context Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the current Zotero Reader selected text in the Research Panel as a read-only reading context.

**Architecture:** Keep reading-context normalization in `src/core/readingContext.js`, mirror the same pure helpers in `chrome/content/readingContext.js`, and keep Zotero Reader access isolated to the panel runtime. The feature only reads selected text and shows Chinese status messages; it does not write notes, tags, attachments, or item fields.

**Tech Stack:** Zotero 8/9 reader/window selection APIs, XHTML panel UI, CommonJS helper tests, Node `node:test`, PowerShell XPI packaging.

---

### Task 1: Core Reading Context Helpers

**Files:**
- Create: `src/core/readingContext.js`
- Create: `tests/reading-context.test.js`
- Modify: `package.json`

- [x] **Step 1: Write failing tests**

Add tests for normalizing selected text, rejecting empty selected text, and selecting the first usable candidate.

- [x] **Step 2: Verify RED**

Run `node tests/reading-context.test.js`.

Expected: fail because `src/core/readingContext.js` does not exist.

- [x] **Step 3: Implement minimal helpers**

Implement `normalizeReadingContext()` and `selectBestReadingContext()`.

- [x] **Step 4: Verify GREEN**

Run `node tests/reading-context.test.js`.

Expected: all reading-context tests pass.

### Task 2: Research Panel UI And Runtime

**Files:**
- Modify: `tests/ui-localization.test.js`
- Modify: `tests/package.test.js`
- Modify: `chrome/content/researchPanel.xhtml`
- Create: `chrome/content/readingContext.js`
- Modify: `scripts/build-xpi.ps1`
- Modify: `package.json`

- [x] **Step 1: Write failing UI/package tests**

Assert the panel contains `阅读上下文`, `刷新阅读上下文`, `暂无阅读器选中文本`, `readingContext.js`, and the package script copies `readingContext.js`.

- [x] **Step 2: Verify RED**

Run `node tests/ui-localization.test.js` and `node tests/package.test.js`.

Expected: fail because the panel and build script do not include reading context yet.

- [x] **Step 3: Add panel UI and runtime script**

Add the reading context section and implement `refreshReadingContext()` using best-effort read-only selection extraction from the active Zotero Reader iframe/window selection.

- [x] **Step 4: Verify targeted tests**

Run `node tests/ui-localization.test.js`, `node tests/package.test.js`, and `node --check chrome/content/readingContext.js`.

Expected: all pass.

### Task 3: Documentation, Package, Install

**Files:**
- Modify: `README.md`
- Runtime output: `dist/zotero-research-workbench-0.1.0.xpi`
- Active profile XPI: `%APPDATA%\Zotero\Zotero\Profiles\8gsk6fny.default\extensions\zotero-research-workbench@local.xpi`

- [x] **Step 1: Document reading context behavior**

Update README to state that `刷新阅读上下文` reads Zotero Reader selected text and does not write Zotero data.

- [x] **Step 2: Run full verification**

Run `npm test`, `npm run check`, and `npm run package`.

Expected: all exit with code `0`.

- [x] **Step 3: Replace active profile XPI and verify contents**

Copy the generated XPI into the active profile extension path and use `tar -xOf` to verify the installed package contains the reading context UI and runtime script.
