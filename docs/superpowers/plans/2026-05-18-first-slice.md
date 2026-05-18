# First Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first testable Zotero Research Workbench scaffold for a Zotero 8/9-only single-paper reading workflow.

**Architecture:** Keep Zotero integration thin and put behavior in a plain JavaScript core that can be tested with Node. The first slice proves provider contract shape, prompt template safety, draft-first output, graph seed storage, task ledger traceability, and export redaction.

**Tech Stack:** Zotero bootstrapped plugin manifest, JavaScript, CommonJS core tests with `node:test`, XHTML panel shell.

---

### Task 1: Project Scaffold

**Files:**
- Create: `README.md`
- Create: `package.json`
- Create: `manifest.json`
- Create: `bootstrap.js`
- Create: `chrome/content/workbenchPlugin.mjs`
- Create: `chrome/content/researchPanel.xhtml`

- [x] **Step 1: Create project files**

Write the plugin shell files listed above. `manifest.json` must set `strict_min_version` to `8.0` and `strict_max_version` to `9.*`.

- [x] **Step 2: Verify JavaScript syntax**

Run:

```powershell
npm run check
```

Expected: exit code `0`.

### Task 2: Testable Core

**Files:**
- Create: `src/core/index.js`
- Create: `tests/core.test.js`

- [x] **Step 1: Write tests for provider redaction, prompt template safety, local store export/import**

Use `node:test` and `node:assert/strict`.

- [x] **Step 2: Run tests and verify RED when core is missing**

Run:

```powershell
npm test
```

Expected before implementation: failure because `src/core` does not exist.

- [x] **Step 3: Implement minimal core**

Implement `createOpenAICompatibleProvider`, `createPromptTaskTemplate`, `renderPrompt`, `WorkbenchLocalStore`, and `redactSecretMaterial`.

- [x] **Step 4: Run tests and verify GREEN**

Run:

```powershell
npm test
```

Expected: all tests pass.

### Task 3: Documentation

**Files:**
- Create: `docs/superpowers/specs/2026-05-18-first-slice-design.md`
- Create: `docs/superpowers/plans/2026-05-18-first-slice.md`

- [x] **Step 1: Record slice design and plan**

Document the exact boundaries, deferred features, and verification commands.

- [x] **Step 2: Final verification**

Run:

```powershell
npm test
npm run check
```

Expected: exit code `0` for both commands.

### Task 4: Zotero Smoke Test

**Files:**
- Modify: `chrome/content/workbenchPlugin.mjs`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-18-first-slice-design.md`

- [x] **Step 1: Add startup probe**

Write `extensions.zotero-research-workbench.lastStartup` from `WorkbenchPlugin.startup()` so a profile can prove the bootstrap hook executed.

- [x] **Step 2: Build and install into an isolated profile**

Run:

```powershell
npm test
npm run check
npm run package
```

Copy the generated XPI into an isolated profile extensions directory and start Zotero 9.0.3 with `-profile <path> -no-remote`.

- [x] **Step 3: Verify extension-manager behavior**

Expected after dropped-in sideload: Zotero recognizes `zotero-research-workbench@local`, but marks it `foreignInstall: True` and `userDisabled: True`.

- [x] **Step 4: Verify enabled smoke profile**

Expected after explicitly enabling in the isolated profile: `active: True`, `userDisabled: False`, `appDisabled: False`, and `prefs.js` contains `extensions.zotero.extensions.zotero-research-workbench.lastStartup`.
