# Graph Seed Review Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact Graph Seed Review Queue that lets users filter captured seeds, inspect evidence, and confirm or reject seeds without creating formal Citation Relations.

**Architecture:** Keep state in the existing Workbench Local Store snapshot. Add pure immutable helpers to `src/core/graphSeed.js`, mirror the minimal runtime helpers in `chrome/content/paperSummary.js`, and extend `researchPanel.xhtml` with static queue controls. Review actions append `review-graph-seed` Task Ledger records and preserve export/import compatibility.

**Tech Stack:** Zotero 8/9 chrome XHTML panel, plain JavaScript runtime, CommonJS core helpers, Node `node:test`, existing PowerShell XPI packaging.

---

### Task 1: Core Review Queue Helpers

**Files:**
- Modify: `src/core/graphSeed.js`
- Test: `tests/graph-seed.test.js`

- [ ] **Step 1: Write failing tests**

Add tests for:

```js
const {
  listGraphSeedsForReview,
  markGraphSeedReviewed
} = require("../src/core/graphSeed");

test("listGraphSeedsForReview treats legacy seeds as pending and applies filters", () => {
  const snapshot = {
    graphSeeds: [
      {
        id: "seed-old",
        workId: "work:doi:10.old",
        source: { title: "Old Source" },
        relationType: "supports",
        target: { text: "Old Target" },
        evidence: { text: "Old evidence" },
        providerId: "model-a",
        confidence: "low",
        seedKind: "ai-inferred",
        createdAt: "2026-05-18T08:00:00.000Z"
      },
      {
        id: "seed-new",
        workId: "work:doi:10.new",
        source: { title: "New Source" },
        relationType: "contrasts",
        target: { text: "New Target" },
        evidence: { text: "New evidence" },
        providerId: "model-b",
        confidence: "high",
        seedKind: "user-confirmed",
        reviewState: "confirmed",
        reviewedAt: "2026-05-18T12:30:00.000Z",
        createdAt: "2026-05-18T12:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(
    listGraphSeedsForReview(snapshot, {
      reviewState: "pending",
      providerId: "model-a",
      confidence: "low",
      relationType: "supports",
      seedKind: "ai-inferred",
      workId: "work:doi:10.old"
    }).map((seed) => seed.id),
    ["seed-old"]
  );
});
```

Add tests that `markGraphSeedReviewed` confirms/rejects one seed, appends a `review-graph-seed` task, updates `exportedAt`, does not mutate the source snapshot, and throws `未找到图谱种子` for an unknown id.

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/graph-seed.test.js
```

Expected: failure because `listGraphSeedsForReview` and `markGraphSeedReviewed` are not exported.

- [ ] **Step 3: Implement helpers**

Add:

```js
function listGraphSeedsForReview(snapshot, filters = {}) { ... }
function markGraphSeedReviewed({ snapshot, seedId, reviewState, reviewedAt, reviewNote }) { ... }
```

Rules:

- missing `reviewState` displays as `pending`;
- valid review states are `pending`, `confirmed`, `rejected`;
- list sorting is newest `createdAt` first;
- filters with empty string or `all` are ignored;
- `currentWorkOnly` filters by `workId` when supplied;
- output records contain display-safe strings;
- review updates clone the snapshot and update only the matching seed;
- task ids use `task-${seedId}-review-graph-seed-${stableTimestamp}`;
- task `outputLocation` includes `{ graphSeedId: seedId, reviewState }`.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
node --test tests/graph-seed.test.js
```

Expected: all graph seed tests pass.

### Task 2: Panel Markup And Runtime Wiring

**Files:**
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `chrome/content/paperSummary.js`
- Test: `tests/ui-localization.test.js`

- [ ] **Step 1: Write failing UI/runtime tests**

Assert panel text and ids:

```text
图谱种子复核队列
复核状态
服务商筛选
仅当前 Work
graph-seed-review-state-filter
graph-seed-provider-filter
graph-seed-confidence-filter
graph-seed-relation-filter
graph-seed-kind-filter
graph-seed-current-work-only
graph-seed-review-list
refresh-graph-seed-review
```

Assert runtime contains:

```text
function renderGraphSeedReviewQueue
function reviewGraphSeed
listGraphSeedsForReview
markGraphSeedReviewed
refresh-graph-seed-review").addEventListener("click", renderGraphSeedReviewQueue)
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/ui-localization.test.js
```

Expected: failure because the queue markup/runtime is absent.

- [ ] **Step 3: Add markup**

Add a compact section under the existing recent Graph Seeds/Task Ledger area. Keep controls as native select/input/button elements and use Chinese labels. Empty state: `暂无待复核图谱种子`.

- [ ] **Step 4: Add runtime**

Mirror the two core helpers in `paperSummary.js`. Render rows with evidence and pending-only confirm/reject buttons. After capture/import/startup/review, refresh both `renderWorkbenchRecords()` and `renderGraphSeedReviewQueue()`.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node --test tests/ui-localization.test.js
```

Expected: UI localization tests pass.

### Task 3: Documentation, Verification, Package, Checkpoint

**Files:**
- Modify: `README.md`
- Modify: `tests/package.test.js` only if packaging assertions need the new runtime boundary.
- Append: `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径\2026-05-18_2005_zotero-research-workbench_checkpoint.md`

- [ ] **Step 1: Update README**

Document Graph Seed Review Queue behavior and that confirmation does not create formal Citation Relations.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run check
npm run package
```

Expected: tests pass, syntax check exits 0, and `dist/zotero-research-workbench-0.1.0.xpi` is generated.

- [ ] **Step 3: Verify installed XPI hash**

Run:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath dist\zotero-research-workbench-0.1.0.xpi
Get-FileHash -Algorithm SHA256 -LiteralPath C:\Users\44199\AppData\Roaming\Zotero\Zotero\Profiles\8gsk6fny.default\extensions\zotero-research-workbench@local.xpi
```

Expected: hashes match if the active profile XPI has already been replaced; otherwise copy only after confirming Zotero is not locking the file.

- [ ] **Step 4: Append checkpoint**

Record changed files, verification commands, XPI hash, and remaining manual UI checks. Do not write secrets.
