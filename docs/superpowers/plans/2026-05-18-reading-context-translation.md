# Reading Context Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit action that translates Zotero Reader selected text into Chinese using the configured OpenAI-compatible provider.

**Architecture:** Reuse the existing research panel provider settings, output area, local snapshot, and explicit Zotero-note confirmation flow. Add translation-specific core helpers beside the paper summary helpers so the prompt, request, and draft metadata are testable outside Zotero.

**Tech Stack:** Zotero pane XHTML, plain JavaScript, OpenAI-compatible `/chat/completions`, Node `node:test`, PowerShell XPI packaging.

---

### Task 1: Core Translation Helpers

**Files:**
- Modify: `src/core/paperSummary.js`
- Test: `tests/paper-summary.test.js`

- [ ] **Step 1: Write the failing prompt/request test**

Add tests that import `buildChineseReadingContextTranslationPrompt`, `requestReadingContextTranslation`, and verify the prompt includes the selected text, asks for Chinese translation, preserves technical terms, and posts to `/chat/completions`.

- [ ] **Step 2: Run the targeted test**

Run: `node tests\paper-summary.test.js`

Expected: FAIL because the new functions are not exported yet.

- [ ] **Step 3: Implement minimal helpers**

Add:
- `buildChineseReadingContextTranslationPrompt(context)`
- `requestReadingContextTranslation({ context, settings, fetchImpl })`

Reuse `parseChatCompletionText`, `readResponseText`, and `parseJsonResponseText`.

- [ ] **Step 4: Re-run the targeted test**

Run: `node tests\paper-summary.test.js`

Expected: PASS.

### Task 2: Translation Draft Metadata

**Files:**
- Modify: `src/core/paperSummary.js`
- Test: `tests/paper-summary.test.js`

- [ ] **Step 1: Write the failing draft test**

Add a test for `createReadingTranslationDraftInput` that asserts:
- `promptTaskTemplateId` is `reading-context-chinese-translation`
- `zoteroItemKey` comes from `context.itemKey`
- `content` is the translation
- `inputContext.selectedText` stores the original selected text
- provenance source is `zotero-reader-selection`

- [ ] **Step 2: Run the targeted test**

Run: `node tests\paper-summary.test.js`

Expected: FAIL because `createReadingTranslationDraftInput` is missing.

- [ ] **Step 3: Implement minimal draft helper**

Add `createReadingTranslationDraftInput({ context, translation, model, createdAt, paper })`.

- [ ] **Step 4: Re-run the targeted test**

Run: `node tests\paper-summary.test.js`

Expected: PASS.

### Task 3: Research Panel UI and Runtime

**Files:**
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `chrome/content/paperSummary.js`
- Test: `tests/ui-localization.test.js`

- [ ] **Step 1: Write the failing UI test**

Assert the panel includes:
- Button text `翻译阅读上下文`
- Button id `translate-reading-context`

- [ ] **Step 2: Run the UI test**

Run: `node tests\ui-localization.test.js`

Expected: FAIL because the button does not exist.

- [ ] **Step 3: Add button and runtime handler**

Add the button near `刷新阅读上下文`. The handler reads `window.WorkbenchReadingContext`, refreshes if needed, calls `requestReadingContextTranslation`, writes the translation into `paper-summary-output`, saves a local draft, updates recent drafts, and does not write Zotero notes.

- [ ] **Step 4: Run targeted tests**

Run:
- `node tests\ui-localization.test.js`
- `node tests\paper-summary.test.js`

Expected: PASS.

### Task 4: Full Verification and Packaging

**Files:**
- Modify only if verification exposes a real issue.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run syntax checks**

Run: `npm run check`

Expected: exit 0.

- [ ] **Step 3: Build XPI**

Run: `npm run package`

Expected: `dist/zotero-research-workbench-0.1.0.xpi` exists.

- [ ] **Step 4: Replace active profile XPI**

Copy the built XPI to:
`C:\Users\44199\AppData\Roaming\Zotero\Zotero\Profiles\8gsk6fny.default\extensions\zotero-research-workbench@local.xpi`

Restart Zotero and verify the installed XPI contains `translate-reading-context`.
