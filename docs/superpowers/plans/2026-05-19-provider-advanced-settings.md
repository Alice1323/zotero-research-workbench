# Provider Advanced Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-release provider timeout, rate-limit, and usage-limit settings to the Zotero Research Workbench.

**Architecture:** Extend the existing provider settings preference model without adding provider profiles. Numeric settings are normalized at controller/runtime boundaries, and only `timeoutMs` affects connection-test behavior in this slice.

**Tech Stack:** Zotero plugin XHTML/JavaScript, CommonJS core modules, Node `node:test`, PowerShell packaging.

---

## File Structure

- Modify `tests/provider-settings.test.js` for controller save/load and timeout-passing coverage.
- Modify `tests/provider-connection.test.js` for `settings.timeoutMs` behavior.
- Modify `tests/core.test.js` for provider contract custom advanced values.
- Modify `tests/ui-localization.test.js` for Chinese labels and field IDs.
- Modify `src/core/providerSettingsController.js` to normalize, save, reload, and pass advanced settings.
- Modify `src/core/providerConnection.js` to prefer `settings.timeoutMs` before default timeout.
- Modify `src/core/index.js` to normalize provider contract advanced fields.
- Modify `chrome/content/providerSettings.js` with the same runtime behavior as the core controller.
- Modify `chrome/content/providerConnection.js` with the same timeout preference as the core connection module.
- Modify `chrome/content/researchPanel.xhtml` to add the three numeric fields.
- Modify `README.md` to document advanced provider settings and WebDAV directory creation.

### Task 1: Tests First

- [ ] Add controller tests proving advanced provider settings save, reload, and pass timeout to `testConnection`.
- [ ] Add provider connection test proving `settings.timeoutMs` is used when options do not override it.
- [ ] Add core provider contract test for custom `timeoutMs`, `requestsPerMinute`, and `maxInputTokensPerTask`.
- [ ] Add UI localization assertions for Chinese labels and field IDs.
- [ ] Run targeted tests and confirm the new tests fail before implementation.

### Task 2: Core And Runtime Implementation

- [ ] Extend `PROVIDER_PREFS` in controller and runtime provider settings scripts.
- [ ] Add bounded number normalization helpers.
- [ ] Load default numeric values when preferences are absent.
- [ ] Save normalized numeric values with existing provider settings.
- [ ] Pass timeout to `testOpenAICompatibleConnection`.
- [ ] Update core/runtime provider connection timeout selection.
- [ ] Update core provider factory advanced config mapping.

### Task 3: UI And Docs

- [ ] Add numeric fields to `researchPanel.xhtml`.
- [ ] Update README provider settings preference list and behavior notes.
- [ ] Replace stale WebDAV text saying directories are not created.

### Task 4: Verification And Packaging

- [ ] Run `node tests\provider-settings.test.js`.
- [ ] Run `node tests\provider-connection.test.js`.
- [ ] Run `node tests\core.test.js`.
- [ ] Run `node tests\ui-localization.test.js`.
- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Run `npm run package`.
- [ ] Append a checkpoint under `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径`.
