# Provider Runtime Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce provider request-per-minute and per-task input token limits for summary and translation requests.

**Architecture:** Add a small pure runtime guard to the paper-summary request path. Core tests exercise the guard directly and through request functions; the Zotero runtime mirrors the same helper and keeps one in-memory limiter for the panel.

**Tech Stack:** Zotero plugin XHTML/JavaScript, CommonJS core modules, Node `node:test`, PowerShell packaging.

---

## File Structure

- Modify `tests/paper-summary.test.js` for token-budget and rate-limit request guard coverage.
- Modify `tests/ui-localization.test.js` for runtime helper/message wiring.
- Modify `src/core/paperSummary.js` to add guard helpers and call them before `fetch`.
- Modify `chrome/content/paperSummary.js` to mirror guard helpers, read saved limits, and use one runtime limiter.
- Modify `README.md` to document runtime guard behavior.

### Task 1: Tests First

- [ ] Add a `requestPaperSummary` test that sets `maxInputTokensPerTask` to 1000, supplies a long CJK abstract, expects `输入内容超过单任务 Token 上限`, and verifies `fetch` is not called.
- [ ] Add a shared-limiter test that creates `createLlmRuntimeGuard({ now })`, sends one summary request with `requestsPerMinute: 1`, then verifies a translation request is rejected with `请求过于频繁，请稍后再试` before `fetch`.
- [ ] Add UI runtime assertions for `createLlmRuntimeGuard`, `assertLlmRuntimeRequestAllowed`, `estimatePromptTokens`, and the two Chinese guard messages.
- [ ] Run `node tests\paper-summary.test.js` and confirm the new tests fail before implementation.

### Task 2: Core Guard Implementation

- [ ] Add `LLM_RUNTIME_LIMITS` for `requestsPerMinute` and `maxInputTokensPerTask`.
- [ ] Add `estimatePromptTokens(prompt)` using the conservative CJK/non-CJK estimate.
- [ ] Add `createLlmRuntimeGuard({ now } = {})` with a rolling 60-second timestamp window.
- [ ] Add `assertLlmRuntimeRequestAllowed({ prompt, settings, taskType, runtimeGuard })`.
- [ ] Call the guard in `requestPaperSummary` and `requestReadingContextTranslation` before `fetch`.
- [ ] Export the new helpers from `src/core/paperSummary.js`.

### Task 3: Zotero Runtime Wiring

- [ ] Add provider limit prefs to `chrome/content/paperSummary.js`.
- [ ] Read `requestsPerMinute` and `maxInputTokensPerTask` in `readProviderSettings()`.
- [ ] Mirror the guard helpers in `chrome/content/paperSummary.js`.
- [ ] Create one panel-level `WorkbenchLlmRuntimeGuard`.
- [ ] Pass the runtime guard into summary and translation request calls.
- [ ] Export the guard helpers in `window.WorkbenchPaperSummary`.

### Task 4: Docs, Verification, Package, Install

- [ ] Update README provider settings behavior to say runtime summary/translation guards now use the two advanced settings.
- [ ] Run `node tests\paper-summary.test.js`.
- [ ] Run `node tests\ui-localization.test.js`.
- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Run `npm run package`.
- [ ] If Zotero is closed, install the XPI and verify source/target SHA256.
- [ ] Append a checkpoint under `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径`.
