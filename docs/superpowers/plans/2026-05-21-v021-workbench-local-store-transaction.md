# V0.21 Workbench Local Store Transaction Implementation Plan

Status: Historical implementation plan for the already uploaded V0.21 beta snapshot. Retain it as architecture history; do not treat the unchecked boxes below as the current working checklist.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first V0.21 architecture seam: a deep `Workbench Local Store Transaction` Module that owns snapshot write transactions before graph-review and orchestrator extraction.

**Architecture:** Create `src/core/workbenchLocalStoreTransaction.js` as a pure core Module. It will compose existing domain helpers from `paperSummary.js`, `graphSeed.js`, and `workbenchSnapshot.js`, normalize schema-v1 snapshots, and return named transaction results. Runtime code will use this Module for selected write paths while DOM rendering and Zotero adapters stay in `chrome/content/paperSummary.js`.

**Tech Stack:** CommonJS core modules, Node `node:test`, Zotero runtime script loading through `researchPanel.xhtml`, existing package script and localization tests.

---

## File Structure

- Create `src/core/workbenchLocalStoreTransaction.js`.
  - Own pure Workbench Local Store transaction functions.
  - Export Node and browser globals using the same pattern as other `src/core/*` runtime modules.
- Create `tests/workbench-local-store-transaction.test.js`.
  - Test each public transaction through the Module Interface.
- Modify `src/core/index.js`.
  - Export the new Module for Node consumers.
- Modify `package.json`.
  - Add the test file to `npm test` automatically via existing wildcard; no script change needed unless `check` needs explicit syntax checking.
- Modify `scripts/build-xpi.ps1`.
  - Include `workbenchLocalStoreTransaction.js` in the XPI runtime scripts.
- Modify `chrome/content/researchPanel.xhtml`.
  - Load `workbenchLocalStoreTransaction.js` before `paperSummary.js`.
- Modify `chrome/content/paperSummary.js`.
  - Import transaction functions from `window.WorkbenchLocalStoreTransaction`.
  - Route Research Note Draft save, Zotero note confirmation, Graph Seed capture/review/promotion, and import replacement through transaction functions.
- Modify `tests/package.test.js`.
  - Assert the XPI contains the new runtime module and loads it before `paperSummary.js`.
- Modify `tests/ui-localization.test.js`.
  - Assert the new runtime module is loaded.
  - Keep existing UI behavior tests intact.

## Task 1: Add Transaction Module Tests

**Files:**
- Create: `tests/workbench-local-store-transaction.test.js`

- [ ] **Step 1: Write failing tests for draft and graph transactions**

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createResearchNoteDraftTransaction,
  confirmResearchNoteDraftSavedToZoteroTransaction,
  captureGraphSeedTransaction,
  reviewGraphSeedTransaction,
  promoteGraphSeedTransaction,
  replaceWorkbenchSnapshotFromImportTransaction
} = require("../src/core/workbenchLocalStoreTransaction");

test("createResearchNoteDraftTransaction appends a draft and task ledger record", () => {
  const result = createResearchNoteDraftTransaction({
    snapshot: { schemaVersion: 1, exportedAt: "old", researchNoteDrafts: [], taskLedger: [] },
    draftInput: {
      id: "draft-1",
      title: "Title - 中文总结",
      content: "summary",
      llmProviderId: "gpt-test",
      promptTaskTemplateId: "single-paper-chinese-summary"
    },
    createdAt: "2026-05-21T00:00:00.000Z"
  });

  assert.equal(result.status, "draft-created");
  assert.equal(result.snapshot.exportedAt, "2026-05-21T00:00:00.000Z");
  assert.equal(result.snapshot.researchNoteDrafts.length, 1);
  assert.equal(result.snapshot.researchNoteDrafts[0].confirmationState, "draft");
  assert.equal(result.snapshot.taskLedger.length, 1);
  assert.equal(result.snapshot.taskLedger[0].workflowStep, "create-summary-draft");
});

test("confirmResearchNoteDraftSavedToZoteroTransaction confirms a draft after Zotero note write", () => {
  const result = confirmResearchNoteDraftSavedToZoteroTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      researchNoteDrafts: [{ id: "draft-1", confirmationState: "draft", llmProviderId: "model-a" }],
      taskLedger: []
    },
    draftId: "draft-1",
    zoteroNoteKey: "NOTE123",
    savedAt: "2026-05-21T00:01:00.000Z"
  });

  assert.equal(result.status, "draft-confirmed");
  assert.equal(result.snapshot.researchNoteDrafts[0].confirmationState, "confirmed");
  assert.equal(result.snapshot.researchNoteDrafts[0].confirmedZoteroNoteKey, "NOTE123");
  assert.equal(result.snapshot.taskLedger[0].workflowStep, "save-to-zotero-note");
});

test("captureGraphSeedTransaction appends a graph seed and capture task", () => {
  const result = captureGraphSeedTransaction({
    snapshot: { schemaVersion: 1, exportedAt: "old", graphSeeds: [], taskLedger: [] },
    seedInput: { id: "seed-1", providerId: "model-a", workId: "work:zotero:A", source: {}, target: {} },
    createdAt: "2026-05-21T00:02:00.000Z"
  });

  assert.equal(result.status, "graph-seed-captured");
  assert.equal(result.snapshot.graphSeeds.length, 1);
  assert.equal(result.snapshot.taskLedger[0].workflowStep, "capture-graph-seed");
});

test("reviewGraphSeedTransaction returns named result for confirmed review", () => {
  const result = reviewGraphSeedTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      graphSeeds: [{ id: "seed-1", providerId: "model-a" }],
      taskLedger: []
    },
    seedId: "seed-1",
    reviewState: "confirmed",
    reviewedAt: "2026-05-21T00:03:00.000Z"
  });

  assert.equal(result.status, "graph-seed-reviewed");
  assert.equal(result.snapshot.graphSeeds[0].reviewState, "confirmed");
});

test("promoteGraphSeedTransaction returns already-promoted without adding duplicate relation", () => {
  const snapshot = {
    schemaVersion: 1,
    exportedAt: "old",
    graphSeeds: [
      {
        id: "seed-1",
        reviewState: "confirmed",
        promotedCitationRelationId: "citation-relation-seed-1",
        workId: "work:zotero:A",
        source: {},
        target: {},
        evidence: {}
      }
    ],
    citationRelations: [{ id: "citation-relation-seed-1" }],
    taskLedger: []
  };

  const result = promoteGraphSeedTransaction({
    snapshot,
    seedId: "seed-1",
    promotedAt: "2026-05-21T00:04:00.000Z"
  });

  assert.equal(result.status, "citation-relation-already-promoted");
  assert.equal(result.snapshot.citationRelations.length, 1);
  assert.equal(result.snapshot.taskLedger.length, 0);
});

test("replaceWorkbenchSnapshotFromImportTransaction normalizes imported snapshot and returns persisted status", () => {
  const result = replaceWorkbenchSnapshotFromImportTransaction({
    snapshot: { schemaVersion: 1, exportedAt: "imported", researchNoteDrafts: [{ id: "draft-1" }] },
    importedAt: "2026-05-21T00:05:00.000Z",
    sourceKind: "json"
  });

  assert.equal(result.status, "snapshot-replaced");
  assert.equal(result.sourceKind, "json");
  assert.deepEqual(result.snapshot.promptOverrides, []);
  assert.deepEqual(result.snapshot.providerProvenance, []);
  assert.equal(result.snapshot.researchNoteDrafts.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests\workbench-local-store-transaction.test.js`

Expected: FAIL with `Cannot find module '../src/core/workbenchLocalStoreTransaction'`.

## Task 2: Implement Transaction Module

**Files:**
- Create: `src/core/workbenchLocalStoreTransaction.js`
- Modify: `src/core/index.js`

- [ ] **Step 1: Add minimal implementation**

Implement public functions that:

- normalize snapshots through `normalizeSnapshotForImport`
- delegate draft confirmation to `markSummaryDraftSavedToZotero`
- delegate graph transactions to `appendGraphSeedToSnapshot`, `markGraphSeedReviewed`, and `promoteGraphSeedToCitationRelation`
- return `{ status, snapshot, ...metadata }`

- [ ] **Step 2: Run focused test**

Run: `node --test tests\workbench-local-store-transaction.test.js`

Expected: PASS.

- [ ] **Step 3: Run related core tests**

Run: `node --test tests\workbench-local-store-transaction.test.js tests\paper-summary.test.js tests\graph-seed.test.js tests\workbench-snapshot.test.js`

Expected: PASS.

## Task 3: Wire Runtime Package Loading

**Files:**
- Modify: `scripts/build-xpi.ps1`
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `tests/package.test.js`
- Modify: `tests/ui-localization.test.js`

- [ ] **Step 1: Add failing package/UI tests**

Add assertions that:

- `dist` XPI contains `chrome/content/workbenchLocalStoreTransaction.js`
- `researchPanel.xhtml` loads `workbenchLocalStoreTransaction.js` before `paperSummary.js`
- runtime XHTML source includes `workbenchLocalStoreTransaction.js`

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests\package.test.js tests\ui-localization.test.js`

Expected: FAIL on missing runtime module/loading reference.

- [ ] **Step 3: Update package and XHTML**

Include `workbenchLocalStoreTransaction.js` in `scripts/build-xpi.ps1` and add the script tag before `paperSummary.js`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests\package.test.js tests\ui-localization.test.js`

Expected: PASS.

## Task 4: Route Runtime Write Paths Through Transaction Seam

**Files:**
- Modify: `chrome/content/paperSummary.js`
- Modify: `tests/ui-localization.test.js`

- [ ] **Step 1: Add characterization assertions**

Update UI/runtime tests to assert:

- `paperSummary.js` reads `window.WorkbenchLocalStoreTransaction`
- runtime handlers call transaction function names for draft creation, note confirmation, graph seed capture/review/promotion, and import replacement

- [ ] **Step 2: Run tests to verify they fail if references are missing**

Run: `node --test tests\ui-localization.test.js`

Expected: FAIL until runtime imports and uses the new transaction functions.

- [ ] **Step 3: Update runtime wiring**

In `chrome/content/paperSummary.js`:

- destructure the new transaction functions from `window.WorkbenchLocalStoreTransaction`
- replace inline draft append/task ledger code with `createResearchNoteDraftTransaction`
- replace note confirmation mutation with `confirmResearchNoteDraftSavedToZoteroTransaction`
- replace graph seed capture/review/promotion mutations with transaction functions
- replace JSON/ZIP imported snapshot direct save with `replaceWorkbenchSnapshotFromImportTransaction`

- [ ] **Step 4: Run focused tests**

Run: `node --test tests\ui-localization.test.js tests\workbench-local-store-transaction.test.js`

Expected: PASS.

## Task 5: Final Verification

**Files:**
- No new files unless tests expose a focused issue.

- [ ] **Step 1: Syntax check**

Run: `npm run check`

Expected: exit 0.

- [ ] **Step 2: Full tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Package**

Run: `npm run package`

Expected: exit 0 and XPI contains `workbenchLocalStoreTransaction.js`.

- [ ] **Step 4: Git diff check**

Run: `git diff --check`

Expected: no whitespace errors.
