# Provider Settings Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Chinese LLM Provider settings form save, show a success message, and reload saved non-secret values.

**Architecture:** Keep a testable CommonJS controller for provider settings behavior and a Zotero-facing panel script that uses `Zotero.Prefs`. The panel persists `baseUrl`, `apiKey`, and `model`, but does not display the API key after saving.

**Tech Stack:** Zotero preferences, XHTML panel script, CommonJS controller tests with `node:test`.

---

### Task 1: Regression Test

**Files:**
- Create: `tests/provider-settings.test.js`

- [x] **Step 1: Write failing test**

Create a fake DOM and storage adapter. Assert that clicking `保存设置` stores `baseUrl`, `apiKey`, and `model`, shows `设置已保存`, and reloads non-secret fields while keeping the API key field blank.

- [x] **Step 2: Verify RED**

Run:

```powershell
npm test
```

Expected before implementation: fail with missing `../src/core/providerSettingsController`.

### Task 2: Implement Saving

**Files:**
- Create: `src/core/providerSettingsController.js`
- Create: `chrome/content/providerSettings.js`
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `scripts/build-xpi.ps1`
- Modify: `package.json`
- Modify: `README.md`

- [x] **Step 1: Add testable controller**

Implement `createProviderSettingsController({ document, storage })` with `init()`, `load()`, and `save()`.

- [x] **Step 2: Add Zotero panel script**

Implement `chrome/content/providerSettings.js` using `window.Zotero.Prefs.get()` and `.set()`.

- [x] **Step 3: Wire panel elements**

Add `id` attributes for `provider-base-url`, `provider-api-key`, `provider-model`, `provider-save`, `provider-test`, and `provider-status`. Load `providerSettings.js` from the XHTML head.

- [x] **Step 4: Package the script**

Update `scripts/build-xpi.ps1` so `providerSettings.js` is included in the XPI.

- [x] **Step 5: Verify GREEN**

Run:

```powershell
npm test
npm run check
npm run package
```

Expected: all pass.

- [x] **Step 6: Replace installed XPI and verify contents**

Copy the rebuilt XPI to the active profile extension package and extract `providerSettings.js` and `researchPanel.xhtml` to confirm the save script and status elements are present.
