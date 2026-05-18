# Provider Connection Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `测试连接` button perform a real OpenAI-compatible provider smoke request and report Chinese results without exposing API keys.

**Architecture:** Add a small provider connection core with injected `fetch` for tests, mirror it into the Zotero panel runtime, and have the provider settings controller read saved settings before testing. The UI remains responsible only for status messages and never displays the API key.

**Tech Stack:** OpenAI-compatible `/chat/completions`, browser `fetch`, `AbortController`, Zotero panel XHTML, Node `node:test`.

---

### Task 1: Core Connection Tests

**Files:**
- Create: `tests/provider-connection.test.js`
- Modify: `tests/provider-settings.test.js`

- [x] **Step 1: Write failing tests**

Cover successful `/chat/completions` request, missing API key, auth failure, model/path failure, network failure, timeout, and settings controller button behavior.

- [x] **Step 2: Verify RED**

Run:

```powershell
npm test
```

Expected before implementation: fail because `src/core/providerConnection.js` does not exist and the test button still reports the placeholder message.

### Task 2: Implement Connection Test

**Files:**
- Create: `src/core/providerConnection.js`
- Create: `chrome/content/providerConnection.js`
- Modify: `src/core/providerSettingsController.js`
- Modify: `chrome/content/providerSettings.js`
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `scripts/build-xpi.ps1`
- Modify: `package.json`
- Modify: `README.md`

- [x] **Step 1: Implement testable core**

Create `testOpenAICompatibleConnection(settings, { fetch, timeoutMs })`.

- [x] **Step 2: Implement Zotero panel runtime script**

Create `chrome/content/providerConnection.js` and expose `window.WorkbenchProviderConnection.testOpenAICompatibleConnection`.

- [x] **Step 3: Wire the test button**

`测试连接` reads saved provider settings and displays the returned Chinese message.

- [x] **Step 4: Package runtime file**

Include `chrome/content/providerConnection.js` in `scripts/build-xpi.ps1` and in `npm run check`.

- [x] **Step 5: Verify**

Run:

```powershell
npm test
npm run check
npm run package
```

Expected: all pass.
