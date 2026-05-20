# Graph Seed Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual Graph Seed capture action that stores relationship candidates with evidence in the local workbench snapshot.

**Architecture:** Keep graph capture local and explicit. The Research Panel gathers source Work context from the selected Zotero item, target text from a user field, relation/confidence from controlled inputs, and evidence from the generated result or selected Reader text; the runtime appends a `graphSeeds` record and a `capture-graph-seed` task ledger entry without creating formal citation relations.

**Tech Stack:** Zotero pane XHTML, plain JavaScript runtime, local JSON snapshot in Zotero preferences, Node `node:test`, PowerShell XPI packaging.

---

### Task 1: Core Graph Seed Helper

**Files:**
- Create: `src/core/graphSeed.js`
- Test: `tests/graph-seed.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing core tests**

Add tests for:
- `createGraphSeedInput` normalizes selected paper metadata into `workId`
- `appendGraphSeedToSnapshot` appends one `graphSeeds` entry and one `capture-graph-seed` task ledger entry
- missing target text throws `图谱种子目标不能为空`

- [ ] **Step 2: Run the targeted test**

Run: `node tests\graph-seed.test.js`

Expected: FAIL because `src/core/graphSeed.js` does not exist.

- [ ] **Step 3: Implement minimal helper**

Create:
- `createGraphSeedInput({ paper, target, relationType, confidence, evidenceText, providerId, seedKind, createdAt })`
- `appendGraphSeedToSnapshot({ snapshot, seedInput, createdAt })`

Use the same snapshot schema as the existing local store: `graphSeeds` and `taskLedger`.

- [ ] **Step 4: Re-run targeted test**

Run: `node tests\graph-seed.test.js`

Expected: PASS.

- [ ] **Step 5: Add syntax check**

Update `package.json` check script to include `src/core/graphSeed.js`.

### Task 2: Research Panel UI

**Files:**
- Modify: `chrome/content/researchPanel.xhtml`
- Test: `tests/ui-localization.test.js`

- [ ] **Step 1: Write the failing UI test**

Assert the panel contains:
- `图谱种子`
- `目标论文或 Work 线索`
- `关系类型`
- `置信度`
- button id `capture-graph-seed`
- status id `graph-seed-status`

- [ ] **Step 2: Run UI test**

Run: `node tests\ui-localization.test.js`

Expected: FAIL because the graph seed UI does not exist.

- [ ] **Step 3: Add minimal panel controls**

Add a compact section under generated result/recent drafts. Use a text input for target, selects for relation/confidence, and one button.

- [ ] **Step 4: Re-run UI test**

Run: `node tests\ui-localization.test.js`

Expected: PASS.

### Task 3: Runtime Capture

**Files:**
- Modify: `chrome/content/paperSummary.js`
- Test: `tests/ui-localization.test.js`

- [ ] **Step 1: Write failing runtime wiring test**

Assert `paperSummary.js` contains:
- `function captureGraphSeed`
- `appendGraphSeedToSnapshot`
- `createGraphSeedInput`
- event binding for `capture-graph-seed`

- [ ] **Step 2: Run UI test**

Run: `node tests\ui-localization.test.js`

Expected: FAIL because runtime is not wired.

- [ ] **Step 3: Implement runtime helper copy**

In `paperSummary.js`, add the graph seed helper functions and `captureGraphSeed()`. Use current selected paper, target field, relation/confidence controls, and evidence from generated result first, then Reader selected text.

- [ ] **Step 4: Re-run targeted tests**

Run:
- `node tests\ui-localization.test.js`
- `node tests\graph-seed.test.js`

Expected: PASS.

### Task 4: Full Verification and Install

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

Restart Zotero and verify the installed XPI contains `capture-graph-seed` and `appendGraphSeedToSnapshot`.
