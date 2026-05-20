# Read-Only Workbench Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Research Panel view for recent Graph Seeds and Task Ledger records stored in the local snapshot.

**Architecture:** Reuse the current in-pref Workbench snapshot. Add small pure list helpers in `src/core/paperSummary.js`, mirror them in `chrome/content/paperSummary.js`, and render two compact read-only lists in `researchPanel.xhtml`. Do not add editing, filtering, promotion to Citation Relations, or new storage schema.

**Tech Stack:** Zotero 8/9 chrome XHTML panel, plain CommonJS core helpers, Node `node:test`, existing package script.

---

### Task 1: Core List Helpers

**Files:**
- Modify: `src/core/paperSummary.js`
- Test: `tests/paper-summary.test.js`

- [ ] **Step 1: Write failing tests**

Add tests that call `listRecentGraphSeeds(snapshot, limit)` and `listRecentTaskLedger(snapshot, limit)`. Expected behavior:

```js
assert.deepEqual(
  listRecentGraphSeeds({ graphSeeds: [oldSeed, newSeed] }).map((seed) => seed.id),
  ["new-seed", "old-seed"]
);
assert.deepEqual(
  listRecentTaskLedger({ taskLedger: [oldTask, newTask] }).map((task) => task.id),
  ["new-task", "old-task"]
);
```

The mapped records must contain display-safe strings only and include no `undefined` or `null` values.

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/paper-summary.test.js
```

Expected: failure because the two helper functions are not exported.

- [ ] **Step 3: Implement helpers**

Add helpers that:
- sort by `createdAt` for graph seeds, newest first;
- sort by `completedAt || startedAt` for tasks, newest first;
- return at most 5 records by default;
- normalize relation, target, state, workflow step, provider, evidence, and output location to strings.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
node --test tests/paper-summary.test.js
```

Expected: all paper summary tests pass.

### Task 2: Panel Markup And Runtime Rendering

**Files:**
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `chrome/content/paperSummary.js`
- Test: `tests/ui-localization.test.js`

- [ ] **Step 1: Write failing UI wiring tests**

Add Chinese text and id assertions for:

```text
最近图谱种子
最近任务记录
graph-seeds-list
task-ledger-list
refresh-workbench-records
```

Add runtime assertions for:

```text
function renderWorkbenchRecords
listRecentGraphSeeds
listRecentTaskLedger
refresh-workbench-records").addEventListener("click", renderWorkbenchRecords)
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/ui-localization.test.js
```

Expected: failure because markup/runtime wiring is absent.

- [ ] **Step 3: Implement UI**

Add a read-only subsection under Global Entry Point with a refresh button and two list containers. Render empty states as `暂无图谱种子` and `暂无任务记录`. Refresh records after startup, graph seed capture, and state import.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
node --test tests/ui-localization.test.js
```

Expected: UI localization tests pass.

### Task 3: Documentation And Package Verification

**Files:**
- Modify: `README.md`
- Test: `tests/package.test.js`

- [ ] **Step 1: Update README**

Document that the panel can refresh read-only recent Graph Seed and Task Ledger lists from the local snapshot.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run check
npm run package
```

Expected: tests pass, syntax check exits 0, and `dist/zotero-research-workbench-0.1.0.xpi` is generated.

- [ ] **Step 3: Append checkpoint**

Append a concise entry to:

```text
C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径\2026-05-18_2005_zotero-research-workbench_checkpoint.md
```

Include changed files, verification commands, and remaining risks.
