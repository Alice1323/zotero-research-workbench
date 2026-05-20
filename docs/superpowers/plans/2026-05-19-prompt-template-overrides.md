# Prompt Template Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add prompt override editing and runtime use for the first two built-in Research Workbench tasks.

**Architecture:** Built-in prompt templates live in core prompt helpers and mirrored runtime helpers. Overrides remain plain local-store snapshot records, validated through the existing prompt-template whitelist before being saved or used.

**Tech Stack:** Zotero plugin XHTML/JavaScript, CommonJS core modules, Node `node:test`, PowerShell XPI packaging.

---

## File Structure

- Modify `src/core/index.js` to add prompt override helpers.
- Modify `src/core/paperSummary.js` to resolve summary/translation prompts through templates and overrides.
- Modify `chrome/content/paperSummary.js` to mirror the runtime prompt override helpers and wire UI events.
- Modify `chrome/content/researchPanel.xhtml` to add the prompt template editor controls.
- Modify `tests/core.test.js` for prompt override validation and resolution.
- Modify `tests/paper-summary.test.js` for request-time override use.
- Modify `tests/ui-localization.test.js` for Chinese labels, element IDs, and runtime wiring.
- Modify `README.md` to document prompt override behavior.

### Task 1: Tests First

- [ ] Add a core test that a saved override replaces the built-in prompt and rejects unsafe variables.
- [ ] Add paper-summary tests that summary and reading translation requests use matching overrides.
- [ ] Add UI localization checks for `提示词模板`, select/textarea/buttons/status/error details, and runtime event listeners.
- [ ] Run targeted tests and confirm the new tests fail before implementation.

### Task 2: Core Prompt Helpers

- [ ] Add built-in template definitions for summary and reading translation.
- [ ] Add `resolvePromptTemplateOverride`, `upsertPromptOverride`, and `removePromptOverride` helpers.
- [ ] Export the helpers from `src/core/index.js`.
- [ ] Update `requestPaperSummary` and `requestReadingContextTranslation` to accept `promptOverrides` and render through the resolved template.

### Task 3: Runtime UI And Request Integration

- [ ] Add prompt editor controls to `researchPanel.xhtml`.
- [ ] Mirror built-in template and override helpers in `chrome/content/paperSummary.js`.
- [ ] Load selected template from the local snapshot and show override/default body.
- [ ] Save/reset overrides into the snapshot.
- [ ] Pass current snapshot prompt overrides into summary and translation request builders.

### Task 4: Docs, Verification, Package, Install

- [ ] Update README prompt template behavior.
- [ ] Run `node tests\core.test.js`.
- [ ] Run `node tests\paper-summary.test.js`.
- [ ] Run `node tests\ui-localization.test.js`.
- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Run `npm run package`.
- [ ] If Zotero is closed, install the new XPI into the active profile and verify hashes.
- [ ] Append a checkpoint under `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径`.
