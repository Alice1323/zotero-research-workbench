# v0.4 Literature Discovery Import Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v0.4 topic-centered literature discovery pipeline: launch from Zotero, collect approved-source and HTTP-connector Document Candidates, review them with anomaly blocking, and explicitly create Zotero items plus attachments through a serial write queue.

**Architecture:** Keep domain behavior in small CommonJS modules under `src/core`, then copy those modules into `chrome/content` during packaging. Keep Zotero DOM, toolbar/context-menu injection, network fetch adapters, file pickers, and item/attachment writes in runtime adapters. All launch surfaces create reviewable plans first; no source query, download, import, or Zotero write starts without confirmation.

**Tech Stack:** Zotero 8/9 bootstrap plugin, XHTML Research Panel, plain CommonJS core modules, Node `node:test`, PowerShell XPI build script, injected Zotero/fetch/file runtime adapters.

---

## Scope Check

The v0.4 spec spans discovery, candidate review, Zotero writes, UI entry points, and Ethereal Reference reservation. These are not independent products because they share `researchTopics`, `documentCandidates`, `importPlans`, and write queue records in the Workbench Local Store. Implement them as four sequential slices:

1. Topic and candidate foundations.
2. Source adapters and discovery jobs.
3. Candidate review and import planning.
4. Zotero write queue, runtime UI, launch surfaces, and Ethereal Reference reservation.

Do not implement local-command connectors or full Ethereal Reference graph visualization in v0.4.

## File Structure

Create these focused core modules:

- `src/core/researchTopic.js`: normalize topic records, link records to a topic, and create topic read models.
- `src/core/documentCandidateProtocol.js`: normalize Document Candidate records, attachment references, source provenance, anomaly tags, and duplicate keys.
- `src/core/literatureDiscovery.js`: create Discovery Job Plans, merge source results, dedupe candidates, and build discovery read models.
- `src/core/literatureSourceAdapters.js`: OpenAlex, Crossref, Unpaywall, and HTTP connector adapter contracts and normalization helpers.
- `src/core/documentCandidateReview.js`: candidate review state, batch selection, anomaly blocking, and import plan creation.
- `src/core/zoteroWriteQueue.js`: pure serial write queue state machine for item and attachment write entries.
- `src/core/zoteroItemWriter.js`: Zotero runtime writer adapter for item and attachment creation.
- `src/core/etherealReferenceGraph.js`: layout-free v0.5 reservation read model.

Modify these existing core/runtime files:

- `src/core/workbenchSnapshot.js`: preserve new arrays through import/export redaction.
- `src/core/workbenchLocalStoreTransaction.js`: add transactions for topics, discovery plans, candidates, review decisions, import plans, and write queue results.
- `src/core/researchPanelOrchestrator.js`: expose v0.4 workflows and include topic/discovery/import read models.
- `src/core/index.js`: export new modules for tests and consumers.
- `chrome/content/researchPanel.xhtml`: add the three-lane pipeline UI, source settings, candidate review table, write queue, and Ethereal Reference placeholder.
- `chrome/content/paperSummary.js`: wire panel actions to orchestrator workflows and runtime adapters.
- `chrome/content/workbenchPlugin.mjs`: add top toolbar and Zotero item context-menu launch surfaces with cleanup.
- `scripts/build-xpi.ps1`: package new runtime modules.
- `package.json`: add new files to `npm run check`.
- `tests/package.test.js`: assert new runtime modules are packaged and loaded in the right order.
- `tests/ui-localization.test.js`: assert Chinese UI labels and runtime wiring.
- `README.md`, `docs/README.md`, and manual QA docs: document v0.4 behavior and verification.

Create these tests:

- `tests/research-topic.test.js`
- `tests/document-candidate-protocol.test.js`
- `tests/literature-source-adapters.test.js`
- `tests/literature-discovery.test.js`
- `tests/document-candidate-review.test.js`
- `tests/zotero-write-queue.test.js`
- `tests/zotero-item-writer.test.js`
- `tests/ethereal-reference-graph.test.js`

---

### Task 1: Research Topic Snapshot Foundation

**Files:**
- Create: `src/core/researchTopic.js`
- Create: `tests/research-topic.test.js`
- Modify: `src/core/workbenchSnapshot.js`
- Modify: `src/core/index.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing research topic tests**

Create `tests/research-topic.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createResearchTopicInput,
  linkRecordsToResearchTopic,
  listResearchTopicsForPanel
} = require("../src/core/researchTopic");
const { normalizeSnapshotForImport, createWorkbenchExportPackage } = require("../src/core/workbenchSnapshot");

test("createResearchTopicInput creates an active topic with stable links", () => {
  const topic = createResearchTopicInput({
    title: "急性肠胃炎护理研究",
    description: "寻找护理干预和营养支持相关文献",
    sourceScopes: [{ kind: "panel-query", query: "acute gastroenteritis nursing" }],
    zoteroItemKeys: ["AAA111", "BBB222"],
    createdAt: "2026-05-23T12:00:00.000Z"
  });

  assert.equal(topic.id, "research-topic-2026-05-23T12-00-00-000Z");
  assert.equal(topic.status, "active");
  assert.deepEqual(topic.linkedZoteroItemKeys, ["AAA111", "BBB222"]);
  assert.deepEqual(topic.linkedCandidateIds, []);
  assert.deepEqual(topic.sourceScopes, [{ kind: "panel-query", query: "acute gastroenteritis nursing" }]);
});

test("linkRecordsToResearchTopic appends unique linked record ids", () => {
  const snapshot = {
    schemaVersion: 1,
    researchTopics: [
      {
        id: "topic-a",
        title: "Topic",
        linkedCandidateIds: ["candidate-a"],
        linkedAiJobIds: [],
        linkedImportPlanIds: [],
        linkedWriteQueueIds: [],
        linkedDraftIds: [],
        linkedGraphSeedIds: [],
        linkedCitationRelationIds: [],
        linkedZoteroItemKeys: []
      }
    ]
  };

  const result = linkRecordsToResearchTopic({
    snapshot,
    topicId: "topic-a",
    candidateIds: ["candidate-a", "candidate-b"],
    aiJobIds: ["ai-job-a"],
    updatedAt: "2026-05-23T12:05:00.000Z"
  });

  const topic = result.snapshot.researchTopics[0];
  assert.deepEqual(topic.linkedCandidateIds, ["candidate-a", "candidate-b"]);
  assert.deepEqual(topic.linkedAiJobIds, ["ai-job-a"]);
  assert.equal(topic.updatedAt, "2026-05-23T12:05:00.000Z");
});

test("workbench snapshot preserves research topics and redacts nested secrets", () => {
  const restored = normalizeSnapshotForImport({
    schemaVersion: 1,
    researchTopics: [{ id: "topic-a", connectorHeaders: { authorization: "Bearer secret" } }]
  });

  assert.equal(restored.researchTopics[0].id, "topic-a");

  const exported = createWorkbenchExportPackage({ snapshot: restored, exportedAt: "2026-05-23T12:10:00.000Z" });
  assert.equal(exported.snapshot.researchTopics[0].connectorHeaders.authorization, "<redacted>");
});

test("listResearchTopicsForPanel returns active topics newest first", () => {
  const topics = listResearchTopicsForPanel({
    researchTopics: [
      { id: "old", title: "Old", status: "archived", updatedAt: "2026-05-22T00:00:00.000Z" },
      { id: "new", title: "New", status: "active", updatedAt: "2026-05-23T00:00:00.000Z" }
    ]
  });

  assert.deepEqual(topics.map((topic) => topic.id), ["new", "old"]);
  assert.equal(topics[0].statusLabel, "进行中");
  assert.equal(topics[1].statusLabel, "已归档");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests\research-topic.test.js
```

Expected: FAIL because `src/core/researchTopic.js` does not exist.

- [ ] **Step 3: Implement `src/core/researchTopic.js`**

Create the module with these exports and behavior:

```js
function createResearchTopicInput({ title, description, sourceScopes, zoteroItemKeys, createdAt } = {}) {
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  return normalizeResearchTopic({
    id: `research-topic-${createStableTimestamp(timestamp)}`,
    title: cleanText(title) || "未命名研究主题",
    description: cleanText(description),
    sourceScopes: Array.isArray(sourceScopes) ? clonePlain(sourceScopes) : [],
    linkedZoteroItemKeys: uniqueClean(zoteroItemKeys),
    linkedCandidateIds: [],
    linkedAiJobIds: [],
    linkedImportPlanIds: [],
    linkedWriteQueueIds: [],
    linkedDraftIds: [],
    linkedGraphSeedIds: [],
    linkedCitationRelationIds: [],
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

function normalizeResearchTopic(topic = {}) {
  const createdAt = cleanText(topic.createdAt) || new Date().toISOString();
  const updatedAt = cleanText(topic.updatedAt) || createdAt;
  return {
    id: cleanText(topic.id) || `research-topic-${createStableTimestamp(createdAt)}`,
    title: cleanText(topic.title) || "未命名研究主题",
    description: cleanText(topic.description),
    sourceScopes: Array.isArray(topic.sourceScopes) ? clonePlain(topic.sourceScopes) : [],
    linkedZoteroItemKeys: uniqueClean(topic.linkedZoteroItemKeys || topic.zoteroItemKeys),
    linkedCandidateIds: uniqueClean(topic.linkedCandidateIds),
    linkedAiJobIds: uniqueClean(topic.linkedAiJobIds),
    linkedImportPlanIds: uniqueClean(topic.linkedImportPlanIds),
    linkedWriteQueueIds: uniqueClean(topic.linkedWriteQueueIds),
    linkedDraftIds: uniqueClean(topic.linkedDraftIds),
    linkedGraphSeedIds: uniqueClean(topic.linkedGraphSeedIds),
    linkedCitationRelationIds: uniqueClean(topic.linkedCitationRelationIds),
    status: normalizeTopicStatus(topic.status),
    createdAt,
    updatedAt
  };
}

function linkRecordsToResearchTopic({
  snapshot,
  topicId,
  candidateIds,
  aiJobIds,
  importPlanIds,
  writeQueueIds,
  draftIds,
  graphSeedIds,
  citationRelationIds,
  zoteroItemKeys,
  updatedAt
} = {}) {
  const normalizedTopicId = cleanText(topicId);
  if (!normalizedTopicId) throw new Error("研究主题 id 不能为空");
  const next = clonePlain(snapshot || {});
  next.schemaVersion = 1;
  next.researchTopics = normalizeResearchTopics(next.researchTopics);
  const topic = next.researchTopics.find((entry) => cleanText(entry.id) === normalizedTopicId);
  if (!topic) throw new Error("未找到研究主题");
  appendUnique(topic.linkedCandidateIds, candidateIds);
  appendUnique(topic.linkedAiJobIds, aiJobIds);
  appendUnique(topic.linkedImportPlanIds, importPlanIds);
  appendUnique(topic.linkedWriteQueueIds, writeQueueIds);
  appendUnique(topic.linkedDraftIds, draftIds);
  appendUnique(topic.linkedGraphSeedIds, graphSeedIds);
  appendUnique(topic.linkedCitationRelationIds, citationRelationIds);
  appendUnique(topic.linkedZoteroItemKeys, zoteroItemKeys);
  topic.updatedAt = cleanText(updatedAt) || new Date().toISOString();
  next.exportedAt = topic.updatedAt;
  return { status: "research-topic-linked", topicId: normalizedTopicId, snapshot: next };
}

function listResearchTopicsForPanel(snapshot = {}) {
  return normalizeResearchTopics(snapshot.researchTopics)
    .sort((left, right) => cleanText(right.updatedAt).localeCompare(cleanText(left.updatedAt)))
    .map((topic) => ({
      id: topic.id,
      title: topic.title,
      description: topic.description,
      status: topic.status,
      statusLabel: formatTopicStatusLabel(topic.status),
      updatedAt: topic.updatedAt,
      linkedCounts: {
        candidates: topic.linkedCandidateIds.length,
        aiJobs: topic.linkedAiJobIds.length,
        imports: topic.linkedImportPlanIds.length,
        writes: topic.linkedWriteQueueIds.length,
        drafts: topic.linkedDraftIds.length,
        graphSeeds: topic.linkedGraphSeedIds.length,
        citationRelations: topic.linkedCitationRelationIds.length
      }
    }));
}
```

Also include helpers `normalizeResearchTopics`, `normalizeTopicStatus`, `formatTopicStatusLabel`, `uniqueClean`, `appendUnique`, `createStableTimestamp`, `clonePlain`, and `cleanText`. Export all public helpers through `module.exports` and `window.WorkbenchResearchTopic`.

- [ ] **Step 4: Preserve `researchTopics` in snapshots**

Modify `src/core/workbenchSnapshot.js` inside `normalizeSnapshotForImport()`:

```js
researchTopics: Array.isArray(snapshot.researchTopics) ? snapshot.researchTopics : [],
```

Add it before the AI job arrays so topic data is grouped near local records.

- [ ] **Step 5: Export module and update syntax checks**

Modify `src/core/index.js`:

```js
const WorkbenchResearchTopic = require("./researchTopic");
```

Add `WorkbenchResearchTopic` to the exported object.

Modify `package.json` `check` script to include:

```text
node --check src/core/researchTopic.js
```

- [ ] **Step 6: Run tests**

Run:

```powershell
node --test tests\research-topic.test.js tests\workbench-snapshot.test.js
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add package.json src/core/index.js src/core/researchTopic.js src/core/workbenchSnapshot.js tests/research-topic.test.js tests/workbench-snapshot.test.js
git commit -m "feat: add v0.4 research topics"
```

---

### Task 2: Document Candidate Protocol

**Files:**
- Create: `src/core/documentCandidateProtocol.js`
- Create: `tests/document-candidate-protocol.test.js`
- Modify: `src/core/workbenchSnapshot.js`
- Modify: `src/core/index.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing candidate protocol tests**

Create `tests/document-candidate-protocol.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeDocumentCandidate,
  normalizeAttachmentReference,
  deriveCandidateIdentityKeys,
  mergeDocumentCandidates
} = require("../src/core/documentCandidateProtocol");
const { createWorkbenchExportPackage, normalizeSnapshotForImport } = require("../src/core/workbenchSnapshot");

test("normalizeDocumentCandidate creates stable provenance and anomaly tags", () => {
  const candidate = normalizeDocumentCandidate({
    sourceAdapterId: "openalex",
    sourceRecordId: "https://openalex.org/W1",
    title: " Acute gastroenteritis nursing ",
    authors: [{ name: "Chen" }],
    year: "2023",
    doi: "10.123/example",
    attachments: [{ kind: "open-access-pdf-url", url: "https://example.org/paper.pdf", license: "cc-by" }],
    provenance: { source: "openalex", requestId: "req-a" },
    observedAt: "2026-05-23T12:00:00.000Z"
  });

  assert.equal(candidate.id, "candidate-openalex-https-openalex-org-w1");
  assert.equal(candidate.title, "Acute gastroenteritis nursing");
  assert.deepEqual(candidate.identityKeys, ["doi:10.123/example"]);
  assert.equal(candidate.attachments[0].importable, true);
  assert.deepEqual(candidate.anomalyTags, []);
});

test("normalizeDocumentCandidate marks missing identity and unclear attachments", () => {
  const candidate = normalizeDocumentCandidate({
    sourceAdapterId: "connector-a",
    sourceRecordId: "record-a",
    title: "Untitled source",
    authors: [],
    year: "3025",
    attachments: [{ kind: "landing-page-url", url: "https://example.org/article" }],
    provenance: {},
    observedAt: "2026-05-23T12:00:00.000Z"
  });

  assert.ok(candidate.anomalyTags.includes("缺少身份线索"));
  assert.ok(candidate.anomalyTags.includes("作者为空"));
  assert.ok(candidate.anomalyTags.includes("年份异常"));
  assert.ok(candidate.anomalyTags.includes("来源证明不足"));
  assert.equal(candidate.attachments[0].importable, false);
});

test("mergeDocumentCandidates dedupes by DOI and preserves source provenance", () => {
  const merged = mergeDocumentCandidates([
    normalizeDocumentCandidate({ sourceAdapterId: "crossref", sourceRecordId: "doi-a", title: "A", doi: "10.1/a" }),
    normalizeDocumentCandidate({ sourceAdapterId: "openalex", sourceRecordId: "work-a", title: "A expanded", doi: "10.1/A" })
  ]);

  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].sourceAdapterIds.sort(), ["crossref", "openalex"]);
  assert.equal(merged[0].title, "A expanded");
});

test("snapshot preserves candidates and redacts raw payload secrets", () => {
  const restored = normalizeSnapshotForImport({
    schemaVersion: 1,
    documentCandidates: [
      { id: "candidate-a", rawSourcePayload: { token: "secret-token" } }
    ]
  });
  const exported = createWorkbenchExportPackage({ snapshot: restored, exportedAt: "2026-05-23T12:00:00.000Z" });
  assert.equal(exported.snapshot.documentCandidates[0].rawSourcePayload.token, "<redacted>");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests\document-candidate-protocol.test.js
```

Expected: FAIL because `src/core/documentCandidateProtocol.js` does not exist.

- [ ] **Step 3: Implement `documentCandidateProtocol.js`**

Create `src/core/documentCandidateProtocol.js` with these exports:

```js
const CANDIDATE_ANOMALY_TAGS = {
  missingTitle: "缺少标题",
  missingIdentity: "缺少身份线索",
  emptyAuthors: "作者为空",
  suspiciousYear: "年份异常",
  weakProvenance: "来源证明不足",
  unclearAttachment: "附件来源不清",
  unsupportedAttachment: "附件类型不支持"
};

function normalizeDocumentCandidate(input = {}) {
  const sourceAdapterId = cleanText(input.sourceAdapterId) || "unknown-source";
  const sourceRecordId = cleanText(input.sourceRecordId || input.url || input.doi || input.title) || "unknown-record";
  const title = cleanText(input.title);
  const attachments = normalizeAttachmentReferences(input.attachments || input.attachmentReferences);
  const identityKeys = deriveCandidateIdentityKeys(input);
  const provenance = normalizeProvenance(input.provenance, sourceAdapterId);
  const anomalyTags = deriveAnomalyTags({ ...input, title, attachments, identityKeys, provenance });
  return {
    id: cleanText(input.id) || `candidate-${slug(sourceAdapterId)}-${slug(sourceRecordId)}`,
    sourceAdapterId,
    sourceAdapterIds: uniqueClean([sourceAdapterId].concat(input.sourceAdapterIds || [])),
    sourceRecordId,
    title: title || "未命名候选文献",
    authors: normalizeAuthors(input.authors),
    year: cleanYear(input.year),
    publicationTitle: cleanText(input.publicationTitle || input.containerTitle),
    doi: normalizeDoi(input.doi),
    isbn: cleanText(input.isbn),
    pmid: cleanText(input.pmid),
    arxivId: cleanText(input.arxivId),
    stableUrl: cleanText(input.stableUrl || input.url),
    abstract: cleanText(input.abstract || input.description),
    openAccessStatus: cleanText(input.openAccessStatus || input.oaStatus),
    attachments,
    identityKeys,
    sourceConfidence: normalizeScore(input.sourceConfidence || input.score),
    anomalyTags: uniqueClean([...(input.anomalyTags || []), ...anomalyTags]),
    provenance,
    rawSourcePayload: clonePlain(input.rawSourcePayload || {}),
    observedAt: cleanText(input.observedAt) || new Date().toISOString()
  };
}
```

Implement `normalizeAttachmentReference()` so:

- `kind: "local-file"` with a non-empty `.pdf` path is importable.
- `kind: "open-access-pdf-url"` with `http(s)` URL ending in `.pdf` or content type `application/pdf` is importable.
- `kind: "connector-file-reference"` is importable only when `provenance.source` or `provenance.connectorId` exists.
- `kind: "landing-page-url"` is never importable.

Implement `deriveCandidateIdentityKeys()` in this order: DOI, ISBN, PMID, arXiv id, stable URL, normalized title. Implement `mergeDocumentCandidates()` to group candidates by the first non-title identity key; when no non-title identity exists, keep records separate unless normalized title and year match exactly.

- [ ] **Step 4: Preserve candidates in snapshots and exports**

Modify `src/core/workbenchSnapshot.js`:

```js
documentCandidates: Array.isArray(snapshot.documentCandidates) ? snapshot.documentCandidates : [],
```

Place it near `researchTopics`.

- [ ] **Step 5: Export module and update syntax checks**

Modify `src/core/index.js` to require and export `WorkbenchDocumentCandidateProtocol`.

Modify `package.json` `check` script to include:

```text
node --check src/core/documentCandidateProtocol.js
```

- [ ] **Step 6: Run tests**

Run:

```powershell
node --test tests\document-candidate-protocol.test.js tests\workbench-snapshot.test.js
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add package.json src/core/documentCandidateProtocol.js src/core/index.js src/core/workbenchSnapshot.js tests/document-candidate-protocol.test.js tests/workbench-snapshot.test.js
git commit -m "feat: add document candidate protocol"
```

---

### Task 3: Discovery Job Plans And Topic Transactions

**Files:**
- Create: `src/core/literatureDiscovery.js`
- Create: `tests/literature-discovery.test.js`
- Modify: `src/core/workbenchSnapshot.js`
- Modify: `src/core/workbenchLocalStoreTransaction.js`
- Modify: `src/core/researchPanelOrchestrator.js`
- Modify: `src/core/index.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing literature discovery tests**

Create `tests/literature-discovery.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createLiteratureDiscoveryJobPlan,
  confirmLiteratureDiscoveryJobPlan,
  createLiteratureDiscoveryReadModel
} = require("../src/core/literatureDiscovery");
const {
  createLiteratureDiscoveryPlanTransaction,
  recordLiteratureDiscoveryCandidatesTransaction
} = require("../src/core/workbenchLocalStoreTransaction");

test("createLiteratureDiscoveryJobPlan requires confirmation before source calls", () => {
  const plan = createLiteratureDiscoveryJobPlan({
    topicId: "topic-a",
    requestText: "寻找急性肠胃炎护理相关后续阅读",
    launchSurface: "zotero-context-menu",
    sourceScopes: [{ kind: "selected-items", itemKeys: ["AAA111"] }],
    sources: ["openalex", "crossref", "unpaywall", "http-connector"],
    maxCandidates: 25,
    createdAt: "2026-05-23T12:00:00.000Z"
  });

  assert.equal(plan.job.id, "literature-discovery-job-2026-05-23T12-00-00-000Z");
  assert.equal(plan.job.state, "draft");
  assert.equal(plan.confirmation.required, true);
  assert.deepEqual(plan.job.expectedSideEffects, {
    sourceQueries: 4,
    providerCalls: 0,
    workbenchLocalStoreWrites: true,
    zoteroNativeWrites: 0,
    documentImports: 0,
    externalDiscovery: true
  });
});

test("confirmLiteratureDiscoveryJobPlan confirms without executing source calls", () => {
  const plan = createLiteratureDiscoveryJobPlan({
    topicId: "topic-a",
    requestText: "query",
    sources: ["openalex"],
    createdAt: "2026-05-23T12:00:00.000Z"
  });
  const confirmed = confirmLiteratureDiscoveryJobPlan({ plan, confirmedAt: "2026-05-23T12:01:00.000Z" });
  assert.equal(confirmed.job.state, "confirmed");
  assert.equal(confirmed.confirmation.confirmedAt, "2026-05-23T12:01:00.000Z");
});

test("transactions persist discovery plans and candidates under a topic", () => {
  const snapshot = {
    schemaVersion: 1,
    researchTopics: [{ id: "topic-a", title: "Topic", linkedCandidateIds: [], linkedAiJobIds: [] }]
  };
  const plan = createLiteratureDiscoveryJobPlan({
    topicId: "topic-a",
    requestText: "query",
    sources: ["openalex"],
    createdAt: "2026-05-23T12:00:00.000Z"
  });
  const created = createLiteratureDiscoveryPlanTransaction({ snapshot, plan, createdAt: "2026-05-23T12:00:00.000Z" });
  const recorded = recordLiteratureDiscoveryCandidatesTransaction({
    snapshot: created.snapshot,
    jobId: plan.job.id,
    topicId: "topic-a",
    candidates: [{ id: "candidate-a", title: "Candidate A" }],
    recordedAt: "2026-05-23T12:02:00.000Z"
  });

  assert.equal(recorded.snapshot.literatureDiscoveryJobs.length, 1);
  assert.equal(recorded.snapshot.documentCandidates.length, 1);
  assert.deepEqual(recorded.snapshot.researchTopics[0].linkedCandidateIds, ["candidate-a"]);
});

test("createLiteratureDiscoveryReadModel shows latest plan and candidate counts", () => {
  const model = createLiteratureDiscoveryReadModel({
    literatureDiscoveryJobs: [{ id: "job-a", topicId: "topic-a", state: "completed", createdAt: "2026-05-23T12:00:00.000Z" }],
    documentCandidates: [{ id: "candidate-a", topicId: "topic-a" }, { id: "candidate-b", topicId: "topic-b" }]
  }, { topicId: "topic-a" });

  assert.equal(model.jobs[0].stateLabel, "已完成");
  assert.equal(model.candidateCount, 1);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests\literature-discovery.test.js
```

Expected: FAIL because `src/core/literatureDiscovery.js` does not exist and transactions are missing.

- [ ] **Step 3: Implement discovery planning module**

Create `src/core/literatureDiscovery.js` with:

```js
const DISCOVERY_JOB_STATES = {
  draft: "draft",
  confirmed: "confirmed",
  running: "running",
  completed: "completed",
  completedWithSkips: "completed-with-skips",
  failed: "failed",
  cancelled: "cancelled"
};

function createLiteratureDiscoveryJobPlan({
  topicId,
  requestText,
  launchSurface,
  sourceScopes,
  sources,
  maxCandidates,
  createdAt
} = {}) {
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  const normalizedSources = uniqueClean(sources).length ? uniqueClean(sources) : ["openalex", "crossref", "unpaywall"];
  return {
    job: {
      id: `literature-discovery-job-${createStableTimestamp(timestamp)}`,
      topicId: cleanText(topicId),
      state: DISCOVERY_JOB_STATES.draft,
      requestText: cleanText(requestText),
      launchSurface: cleanText(launchSurface) || "research-panel",
      sourceScopes: Array.isArray(sourceScopes) ? clonePlain(sourceScopes) : [],
      sources: normalizedSources,
      maxCandidates: normalizeMaxCandidates(maxCandidates),
      expectedSideEffects: {
        sourceQueries: normalizedSources.length,
        providerCalls: 0,
        workbenchLocalStoreWrites: true,
        zoteroNativeWrites: 0,
        documentImports: 0,
        externalDiscovery: true
      },
      createdAt: timestamp,
      confirmedAt: null,
      startedAt: null,
      completedAt: null
    },
    confirmation: {
      required: true,
      confirmedAt: null,
      summary: `将查询 ${normalizedSources.join("、")}，最多返回 ${normalizeMaxCandidates(maxCandidates)} 条候选；不会自动写入 Zotero。`
    }
  };
}
```

Also implement `confirmLiteratureDiscoveryJobPlan()`, `mergeDiscoverySourceResults()`, `createLiteratureDiscoveryReadModel()`, `formatDiscoveryJobStateLabel()`, and helper functions.

- [ ] **Step 4: Add snapshot arrays**

Modify `src/core/workbenchSnapshot.js`:

```js
literatureDiscoveryJobs: Array.isArray(snapshot.literatureDiscoveryJobs) ? snapshot.literatureDiscoveryJobs : [],
literatureDiscoveryFailures: Array.isArray(snapshot.literatureDiscoveryFailures) ? snapshot.literatureDiscoveryFailures : [],
```

- [ ] **Step 5: Add local store transactions**

Modify `src/core/workbenchLocalStoreTransaction.js` with two functions:

```js
function createLiteratureDiscoveryPlanTransaction({ snapshot, plan, createdAt } = {}) {
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  const next = normalizeTransactionSnapshot(snapshot);
  next.literatureDiscoveryJobs.push(clonePlain(plan.job));
  next.taskLedger.push({
    id: `task-${plan.job.id}-create-literature-discovery-plan`,
    workflowStep: "create-literature-discovery-plan",
    state: "completed",
    providerId: null,
    promptTaskTemplateId: null,
    outputLocation: { jobId: plan.job.id, topicId: plan.job.topicId },
    errorNotice: null,
    startedAt: timestamp,
    completedAt: timestamp,
    provenance: { source: "explicit-user-action", writeTarget: "local-snapshot-only" }
  });
  next.exportedAt = timestamp;
  return { status: "literature-discovery-plan-created", jobId: plan.job.id, snapshot: next };
}

function recordLiteratureDiscoveryCandidatesTransaction({ snapshot, jobId, topicId, candidates, recordedAt } = {}) {
  const timestamp = cleanText(recordedAt) || new Date().toISOString();
  const next = normalizeTransactionSnapshot(snapshot);
  const candidateIds = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const normalized = { ...clonePlain(candidate), topicId: cleanText(candidate.topicId) || cleanText(topicId) };
    const existingIndex = next.documentCandidates.findIndex((entry) => cleanText(entry.id) === cleanText(normalized.id));
    if (existingIndex >= 0) next.documentCandidates[existingIndex] = normalized;
    else next.documentCandidates.push(normalized);
    candidateIds.push(normalized.id);
  }
  linkTopicInPlace(next, { topicId, candidateIds, aiJobIds: [jobId], updatedAt: timestamp });
  next.taskLedger.push({
    id: `task-${jobId}-record-literature-candidates-${createStableTimestamp(timestamp)}`,
    workflowStep: "record-literature-discovery-candidates",
    state: "completed",
    outputLocation: { jobId, topicId, candidateIds },
    errorNotice: null,
    startedAt: timestamp,
    completedAt: timestamp,
    provenance: { source: "source-adapters", writeTarget: "local-snapshot-only" }
  });
  next.exportedAt = timestamp;
  return { status: "literature-discovery-candidates-recorded", jobId, candidateIds, snapshot: next };
}
```

Use existing helper style in the file and add missing arrays to `normalizeTransactionSnapshot()`.

- [ ] **Step 6: Add orchestrator workflow**

Modify `src/core/researchPanelOrchestrator.js` to resolve `literatureDiscoveryModule`, assert `createLiteratureDiscoveryJobPlan`, and expose:

```js
function createLiteratureDiscoveryPlanWorkflow({ snapshot, topicId, requestText, launchSurface, sourceScopes, sources, maxCandidates, createdAt } = {}) {
  const plan = literatureDiscoveryModule.createLiteratureDiscoveryJobPlan({
    topicId,
    requestText,
    launchSurface,
    sourceScopes,
    sources,
    maxCandidates,
    createdAt
  });
  const result = transactionModule.createLiteratureDiscoveryPlanTransaction({ snapshot, plan, createdAt });
  return {
    status: "literatureDiscoveryPlanCreated",
    plan,
    snapshot: result.snapshot,
    records: createPanelRecords(result.snapshot, { topicId })
  };
}
```

Add `literatureDiscovery` to `createPanelRecords()`.

- [ ] **Step 7: Export module and update syntax checks**

Modify `src/core/index.js` and `package.json` to include `literatureDiscovery.js`.

- [ ] **Step 8: Run tests**

Run:

```powershell
node --test tests\literature-discovery.test.js tests\research-panel-orchestrator.test.js tests\workbench-local-store-transaction.test.js
npm run check
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add package.json src/core/index.js src/core/literatureDiscovery.js src/core/researchPanelOrchestrator.js src/core/workbenchLocalStoreTransaction.js src/core/workbenchSnapshot.js tests/literature-discovery.test.js tests/research-panel-orchestrator.test.js tests/workbench-local-store-transaction.test.js
git commit -m "feat: add literature discovery job plans"
```

---

### Task 4: Source Adapter Contracts And Fixtures

**Files:**
- Create: `src/core/literatureSourceAdapters.js`
- Create: `tests/literature-source-adapters.test.js`
- Modify: `src/core/index.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing source adapter tests**

Create `tests/literature-source-adapters.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createOpenAlexAdapter,
  createCrossrefAdapter,
  createUnpaywallAdapter,
  createHttpConnectorAdapter,
  createConnectorRequestPayload
} = require("../src/core/literatureSourceAdapters");

test("OpenAlex adapter normalizes works into document candidates", async () => {
  const adapter = createOpenAlexAdapter({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: [{
          id: "https://openalex.org/W123",
          title: "Nursing care in acute gastroenteritis",
          publication_year: 2024,
          doi: "https://doi.org/10.1000/openalex",
          authorships: [{ author: { display_name: "Chen A" } }],
          host_venue: { display_name: "Journal A" },
          open_access: { is_oa: true, oa_url: "https://example.org/openalex.pdf" }
        }]
      })
    })
  });

  const result = await adapter.query({ requestText: "gastroenteritis nursing", maxCandidates: 5, observedAt: "2026-05-23T12:00:00.000Z" });
  assert.equal(result.candidates[0].sourceAdapterId, "openalex");
  assert.equal(result.candidates[0].doi, "10.1000/openalex");
  assert.equal(result.candidates[0].attachments[0].kind, "open-access-pdf-url");
});

test("Crossref adapter normalizes message items into document candidates", async () => {
  const adapter = createCrossrefAdapter({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        message: {
          items: [{
            DOI: "10.1000/crossref",
            title: ["Crossref Title"],
            author: [{ given: "A", family: "Chen" }],
            issued: { "date-parts": [[2023]] },
            "container-title": ["Journal B"],
            URL: "https://doi.org/10.1000/crossref"
          }]
        }
      })
    })
  });

  const result = await adapter.query({ requestText: "title", maxCandidates: 5 });
  assert.equal(result.candidates[0].sourceAdapterId, "crossref");
  assert.equal(result.candidates[0].title, "Crossref Title");
});

test("Unpaywall adapter requires DOI and returns OA attachment candidates", async () => {
  const adapter = createUnpaywallAdapter({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        doi: "10.1000/oa",
        title: "OA Title",
        year: 2022,
        is_oa: true,
        best_oa_location: { url_for_pdf: "https://example.org/oa.pdf", license: "cc-by" }
      })
    }),
    email: "user@example.com"
  });

  const result = await adapter.query({ dois: ["10.1000/oa"] });
  assert.equal(result.candidates[0].attachments[0].importable, true);
});

test("HTTP connector validates JSON candidates and redacts secret headers in errors", async () => {
  const adapter = createHttpConnectorAdapter({
    endpointUrl: "https://connector.example.invalid/search",
    headers: { authorization: "Bearer secret-token" },
    fetchImpl: async (_url, options) => {
      assert.equal(options.method, "POST");
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: async () => JSON.stringify({
          candidates: [{ id: "external-a", title: "Connector Candidate", sourceRecordId: "external-a" }]
        })
      };
    }
  });

  const result = await adapter.query({ requestText: "query", topicId: "topic-a" });
  assert.equal(result.candidates[0].sourceAdapterId, "http-connector");
  assert.equal(result.candidates[0].provenance.connectorEndpoint, "https://connector.example.invalid/search");
});

test("createConnectorRequestPayload uses standard protocol shape", () => {
  const payload = createConnectorRequestPayload({
    topicId: "topic-a",
    requestText: "query",
    sourceScopes: [{ kind: "selected-items", itemKeys: ["AAA"] }],
    maxCandidates: 10
  });

  assert.equal(payload.protocol, "zotero-research-workbench.document-candidates.v1");
  assert.equal(payload.topicId, "topic-a");
  assert.equal(payload.maxCandidates, 10);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests\literature-source-adapters.test.js
```

Expected: FAIL because `src/core/literatureSourceAdapters.js` does not exist.

- [ ] **Step 3: Implement `literatureSourceAdapters.js`**

Create adapters that all return:

```js
{
  sourceAdapterId: "openalex",
  candidates: [normalizeDocumentCandidate(...)],
  failures: []
}
```

Required exports:

```js
function createOpenAlexAdapter({ fetchImpl, baseUrl = "https://api.openalex.org" } = {}) {}
function createCrossrefAdapter({ fetchImpl, baseUrl = "https://api.crossref.org" } = {}) {}
function createUnpaywallAdapter({ fetchImpl, baseUrl = "https://api.unpaywall.org/v2", email } = {}) {}
function createHttpConnectorAdapter({ fetchImpl, endpointUrl, headers, timeoutMs = 15000, maxResponseBytes = 1_000_000 } = {}) {}
function createConnectorRequestPayload({ topicId, requestText, sourceScopes, maxCandidates, selectedItems, dois } = {}) {}
function createSourceAdapterFailure({ sourceAdapterId, error, status, userMessage } = {}) {}
```

Implementation requirements:

- Use injected `fetchImpl`; throw `Source adapter fetch runtime unavailable` if it is missing.
- OpenAlex query URL: `/works?search=<requestText>&per-page=<maxCandidates>`.
- Crossref query URL: `/works?query=<requestText>&rows=<maxCandidates>`.
- Unpaywall query URL for each DOI: `/<doi>?email=<email>`.
- HTTP connector uses `POST` with JSON payload and accepts only `application/json` or empty content-type.
- HTTP connector response schema requires `candidates` array.
- Redact headers named `authorization`, `apiKey`, `token`, `secret`, `password` in failure technical details.

- [ ] **Step 4: Export module and update syntax checks**

Modify `src/core/index.js` to export `WorkbenchLiteratureSourceAdapters`.

Modify `package.json` `check` script:

```text
node --check src/core/literatureSourceAdapters.js
```

- [ ] **Step 5: Run tests**

Run:

```powershell
node --test tests\literature-source-adapters.test.js tests\document-candidate-protocol.test.js
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/core/index.js src/core/literatureSourceAdapters.js tests/literature-source-adapters.test.js
git commit -m "feat: add literature source adapters"
```

---

### Task 5: Candidate Review, Anomaly Blocking, And Import Plans

**Files:**
- Create: `src/core/documentCandidateReview.js`
- Create: `tests/document-candidate-review.test.js`
- Modify: `src/core/workbenchSnapshot.js`
- Modify: `src/core/workbenchLocalStoreTransaction.js`
- Modify: `src/core/researchPanelOrchestrator.js`
- Modify: `src/core/index.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing candidate review tests**

Create `tests/document-candidate-review.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createCandidateReviewReadModel,
  markCandidateReviewed,
  createZoteroImportPlanFromCandidates
} = require("../src/core/documentCandidateReview");

test("candidate review read model blocks anomalous candidates from quick import", () => {
  const model = createCandidateReviewReadModel({
    documentCandidates: [
      { id: "normal", title: "Normal", anomalyTags: [], attachments: [] },
      { id: "bad", title: "Bad", anomalyTags: ["缺少身份线索"], attachments: [] }
    ]
  });

  assert.equal(model.candidates[0].quickImportAllowed, true);
  assert.equal(model.candidates[1].quickImportAllowed, false);
  assert.equal(model.summary.blockedCount, 1);
});

test("markCandidateReviewed confirms an anomalous candidate for import", () => {
  const snapshot = {
    schemaVersion: 1,
    documentCandidates: [{ id: "bad", anomalyTags: ["缺少身份线索"], reviewState: "needs-review" }]
  };
  const result = markCandidateReviewed({
    snapshot,
    candidateId: "bad",
    reviewDecision: "confirmed",
    reviewNote: "人工确认可导入",
    reviewedAt: "2026-05-23T12:00:00.000Z"
  });

  assert.equal(result.snapshot.documentCandidates[0].reviewState, "confirmed");
  assert.equal(result.snapshot.documentCandidates[0].reviewedBy, "user");
});

test("createZoteroImportPlanFromCandidates creates item and attachment write intents", () => {
  const plan = createZoteroImportPlanFromCandidates({
    topicId: "topic-a",
    candidates: [
      {
        id: "candidate-a",
        title: "Title A",
        authors: [{ name: "Chen A" }],
        year: "2024",
        doi: "10.1000/a",
        anomalyTags: [],
        attachments: [{ id: "att-a", kind: "open-access-pdf-url", url: "https://example.org/a.pdf", importable: true }]
      }
    ],
    selections: [{ candidateId: "candidate-a", importMode: "zotero-item-plus-attachment", attachmentId: "att-a" }],
    createdAt: "2026-05-23T12:00:00.000Z"
  });

  assert.equal(plan.id, "zotero-import-plan-2026-05-23T12-00-00-000Z");
  assert.equal(plan.expectedWrites.items, 1);
  assert.equal(plan.expectedWrites.attachments, 1);
  assert.equal(plan.writeIntents[0].kind, "create-item");
  assert.equal(plan.writeIntents[1].kind, "create-attachment");
});

test("createZoteroImportPlanFromCandidates rejects unreviewed anomalous candidates", () => {
  assert.throws(
    () => createZoteroImportPlanFromCandidates({
      candidates: [{ id: "bad", title: "Bad", anomalyTags: ["缺少身份线索"], reviewState: "needs-review" }],
      selections: [{ candidateId: "bad", importMode: "zotero-item" }]
    }),
    /候选文献需要单独复核/
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests\document-candidate-review.test.js
```

Expected: FAIL because `src/core/documentCandidateReview.js` does not exist.

- [ ] **Step 3: Implement `documentCandidateReview.js`**

Create these exports:

```js
const IMPORT_MODES = {
  workbenchOnly: "workbench-only",
  zoteroItem: "zotero-item",
  zoteroItemPlusAttachment: "zotero-item-plus-attachment"
};

function createCandidateReviewReadModel(snapshot = {}, { topicId } = {}) {}
function markCandidateReviewed({ snapshot, candidateId, reviewDecision, reviewNote, reviewedAt } = {}) {}
function createZoteroImportPlanFromCandidates({ topicId, candidates, selections, targetCollectionKey, createdAt } = {}) {}
function candidateRequiresDetailReview(candidate) {}
```

The import plan must create write intents shaped as:

```js
{
  id: "write-intent-candidate-a-item",
  kind: "create-item",
  candidateId: "candidate-a",
  topicId: "topic-a",
  itemFields: {
    itemType: "journalArticle",
    title: "Title A",
    creators: [{ creatorType: "author", name: "Chen A" }],
    date: "2024",
    DOI: "10.1000/a",
    publicationTitle: ""
  },
  targetCollectionKey: "",
  dependsOn: [],
  provenance: { sourceCandidateId: "candidate-a" }
}
```

Attachment intents use:

```js
{
  id: "write-intent-candidate-a-attachment",
  kind: "create-attachment",
  candidateId: "candidate-a",
  topicId: "topic-a",
  attachment,
  dependsOn: ["write-intent-candidate-a-item"],
  provenance: { sourceCandidateId: "candidate-a", attachmentSource: attachment.kind }
}
```

- [ ] **Step 4: Preserve import plans and review state**

Modify `src/core/workbenchSnapshot.js`:

```js
zoteroImportPlans: Array.isArray(snapshot.zoteroImportPlans) ? snapshot.zoteroImportPlans : [],
```

Modify `src/core/workbenchLocalStoreTransaction.js` with:

- `markDocumentCandidateReviewedTransaction()`
- `createZoteroImportPlanTransaction()`

Both functions must append task ledger entries and link the plan id to the topic.

- [ ] **Step 5: Add orchestrator workflows**

Modify `src/core/researchPanelOrchestrator.js` to expose:

- `markDocumentCandidateReviewedWorkflow()`
- `createZoteroImportPlanWorkflow()`

Add `candidateReview` read model to `createPanelRecords()`.

- [ ] **Step 6: Export module and update syntax checks**

Modify `src/core/index.js` and `package.json` to include `documentCandidateReview.js`.

- [ ] **Step 7: Run tests**

Run:

```powershell
node --test tests\document-candidate-review.test.js tests\research-panel-orchestrator.test.js tests\workbench-local-store-transaction.test.js
npm run check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add package.json src/core/documentCandidateReview.js src/core/index.js src/core/researchPanelOrchestrator.js src/core/workbenchLocalStoreTransaction.js src/core/workbenchSnapshot.js tests/document-candidate-review.test.js tests/research-panel-orchestrator.test.js tests/workbench-local-store-transaction.test.js
git commit -m "feat: add candidate review import planning"
```

---

### Task 6: Zotero Write Queue Core And Runtime Writer

**Files:**
- Create: `src/core/zoteroWriteQueue.js`
- Create: `src/core/zoteroItemWriter.js`
- Create: `tests/zotero-write-queue.test.js`
- Create: `tests/zotero-item-writer.test.js`
- Modify: `src/core/workbenchSnapshot.js`
- Modify: `src/core/workbenchLocalStoreTransaction.js`
- Modify: `src/core/index.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing write queue tests**

Create `tests/zotero-write-queue.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createZoteroWriteQueue,
  runNextZoteroWriteQueueEntry,
  recordZoteroWriteQueueEntryResult,
  retryFailedZoteroWriteQueueEntries
} = require("../src/core/zoteroWriteQueue");

test("createZoteroWriteQueue creates queued serial entries from import plan", () => {
  const queue = createZoteroWriteQueue({
    importPlan: {
      id: "plan-a",
      topicId: "topic-a",
      writeIntents: [
        { id: "item-a", kind: "create-item", candidateId: "candidate-a" },
        { id: "attachment-a", kind: "create-attachment", candidateId: "candidate-a", dependsOn: ["item-a"] }
      ]
    },
    createdAt: "2026-05-23T12:00:00.000Z"
  });

  assert.equal(queue.state, "queued");
  assert.equal(queue.entries.length, 2);
  assert.equal(queue.entries[0].state, "queued");
  assert.equal(queue.entries[1].state, "blocked");
});

test("runNextZoteroWriteQueueEntry starts only one unblocked entry", () => {
  const queue = createZoteroWriteQueue({
    importPlan: { id: "plan-a", writeIntents: [{ id: "item-a", kind: "create-item" }] }
  });
  const running = runNextZoteroWriteQueueEntry({ queue, startedAt: "2026-05-23T12:01:00.000Z" });

  assert.equal(running.entry.id, "item-a");
  assert.equal(running.queue.entries[0].state, "running");
});

test("record result unblocks dependent attachment after item success", () => {
  const queue = createZoteroWriteQueue({
    importPlan: {
      id: "plan-a",
      writeIntents: [
        { id: "item-a", kind: "create-item" },
        { id: "attachment-a", kind: "create-attachment", dependsOn: ["item-a"] }
      ]
    }
  });
  const running = runNextZoteroWriteQueueEntry({ queue });
  const recorded = recordZoteroWriteQueueEntryResult({
    queue: running.queue,
    entryId: "item-a",
    result: { state: "succeeded", zoteroItemKey: "ZOTERO1" },
    completedAt: "2026-05-23T12:02:00.000Z"
  });

  assert.equal(recorded.entries[0].state, "succeeded");
  assert.equal(recorded.entries[1].state, "queued");
  assert.equal(recorded.entries[1].resolvedZoteroItemKey, "ZOTERO1");
});

test("retryFailedZoteroWriteQueueEntries only requeues failed entries", () => {
  const queue = {
    id: "queue-a",
    entries: [
      { id: "failed", state: "failed", retryCount: 0 },
      { id: "ok", state: "succeeded", retryCount: 0 }
    ]
  };
  const retried = retryFailedZoteroWriteQueueEntries({ queue, retriedAt: "2026-05-23T12:03:00.000Z" });
  assert.equal(retried.entries[0].state, "queued");
  assert.equal(retried.entries[0].retryCount, 1);
  assert.equal(retried.entries[1].state, "succeeded");
});
```

Create `tests/zotero-item-writer.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  writeZoteroItemFromIntent,
  writeZoteroAttachmentFromIntent
} = require("../src/core/zoteroItemWriter");

test("writeZoteroItemFromIntent creates a Zotero item with mapped fields", async () => {
  const saved = [];
  function Item(type) {
    this.itemType = type;
    this.fields = {};
    this.creators = [];
    this.setField = (key, value) => { this.fields[key] = value; };
    this.setCreators = (creators) => { this.creators = creators; };
    this.saveTx = async () => { this.key = "ITEMKEY"; saved.push(this); };
  }
  const result = await writeZoteroItemFromIntent({
    Zotero: { Item, Libraries: { userLibraryID: 1 } },
    intent: {
      itemFields: {
        itemType: "journalArticle",
        title: "Title",
        DOI: "10.1/a",
        creators: [{ creatorType: "author", name: "Chen A" }]
      }
    }
  });

  assert.equal(result.zoteroItemKey, "ITEMKEY");
  assert.equal(saved[0].fields.title, "Title");
});

test("writeZoteroAttachmentFromIntent imports a local file attachment", async () => {
  const calls = [];
  const Zotero = {
    Attachments: {
      importFromFile: async (input) => {
        calls.push(input);
        return { key: "ATTACHKEY" };
      }
    }
  };
  const result = await writeZoteroAttachmentFromIntent({
    Zotero,
    parentItemId: 123,
    intent: { attachment: { kind: "local-file", path: "C:\\tmp\\paper.pdf", title: "paper.pdf" } }
  });

  assert.equal(result.zoteroAttachmentKey, "ATTACHKEY");
  assert.equal(calls[0].parentItemID, 123);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests\zotero-write-queue.test.js tests\zotero-item-writer.test.js
```

Expected: FAIL because new modules do not exist.

- [ ] **Step 3: Implement `zoteroWriteQueue.js`**

Create queue exports:

```js
const WRITE_QUEUE_STATES = {
  queued: "queued",
  running: "running",
  paused: "paused",
  completed: "completed",
  completedWithFailures: "completed-with-failures",
  failed: "failed",
  cancelled: "cancelled"
};

const WRITE_ENTRY_STATES = {
  queued: "queued",
  blocked: "blocked",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  skipped: "skipped",
  cancelled: "cancelled"
};
```

Implement `createZoteroWriteQueue()`, `runNextZoteroWriteQueueEntry()`, `recordZoteroWriteQueueEntryResult()`, `pauseZoteroWriteQueue()`, `resumeZoteroWriteQueue()`, `cancelZoteroWriteQueue()`, `retryFailedZoteroWriteQueueEntries()`, and `createZoteroWriteQueueReadModel()`.

The queue must never mark more than one entry as `running`.

- [ ] **Step 4: Implement `zoteroItemWriter.js`**

Create writer functions:

```js
async function writeZoteroItemFromIntent({ Zotero, intent, libraryId } = {}) {
  if (!Zotero?.Item) throw new Error("无法创建 Zotero 条目");
  const fields = intent?.itemFields || {};
  const itemType = cleanText(fields.itemType) || "journalArticle";
  const item = new Zotero.Item(itemType);
  item.libraryID = Number(libraryId || Zotero?.Libraries?.userLibraryID || fields.libraryId || 0) || undefined;
  for (const [key, value] of Object.entries(fields)) {
    if (key === "itemType" || key === "creators" || value === undefined || value === null || value === "") continue;
    item.setField?.(key, value);
  }
  if (Array.isArray(fields.creators)) {
    item.setCreators?.(fields.creators);
  }
  await item.saveTx();
  return { zoteroItemKey: item.key || "", zoteroItemId: item.id || null };
}

async function writeZoteroAttachmentFromIntent({ Zotero, intent, parentItemId, parentItemKey } = {}) {
  if (!Zotero?.Attachments) throw new Error("无法创建 Zotero 附件");
  const attachment = intent?.attachment || {};
  if (attachment.kind === "local-file") {
    const saved = await Zotero.Attachments.importFromFile({
      file: attachment.path,
      parentItemID: parentItemId,
      title: attachment.title || ""
    });
    return { zoteroAttachmentKey: saved?.key || "", zoteroAttachmentId: saved?.id || null, parentItemKey: parentItemKey || "" };
  }
  if (attachment.kind === "open-access-pdf-url" || attachment.kind === "connector-file-reference") {
    const saved = await Zotero.Attachments.importFromURL({
      url: attachment.url || attachment.fileUrl,
      parentItemID: parentItemId,
      title: attachment.title || "",
      contentType: attachment.contentType || "application/pdf"
    });
    return { zoteroAttachmentKey: saved?.key || "", zoteroAttachmentId: saved?.id || null, parentItemKey: parentItemKey || "" };
  }
  throw new Error("附件类型不支持");
}
```

Keep this module adapter-only; do not include queue logic here.

- [ ] **Step 5: Preserve write queues and add transactions**

Modify `src/core/workbenchSnapshot.js`:

```js
zoteroWriteQueues: Array.isArray(snapshot.zoteroWriteQueues) ? snapshot.zoteroWriteQueues : [],
zoteroWriteResults: Array.isArray(snapshot.zoteroWriteResults) ? snapshot.zoteroWriteResults : [],
```

Modify `src/core/workbenchLocalStoreTransaction.js`:

- `createZoteroWriteQueueTransaction()`
- `recordZoteroWriteQueueResultTransaction()`

Both append task ledger entries and link queue ids to the topic.

- [ ] **Step 6: Export modules and update syntax checks**

Modify `src/core/index.js` and `package.json` to include `zoteroWriteQueue.js` and `zoteroItemWriter.js`.

- [ ] **Step 7: Run tests**

Run:

```powershell
node --test tests\zotero-write-queue.test.js tests\zotero-item-writer.test.js tests\workbench-local-store-transaction.test.js
npm run check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add package.json src/core/index.js src/core/zoteroItemWriter.js src/core/zoteroWriteQueue.js src/core/workbenchLocalStoreTransaction.js src/core/workbenchSnapshot.js tests/zotero-item-writer.test.js tests/zotero-write-queue.test.js tests/workbench-local-store-transaction.test.js
git commit -m "feat: add zotero import write queue"
```

---

### Task 7: Ethereal Reference Reservation

**Files:**
- Create: `src/core/etherealReferenceGraph.js`
- Create: `tests/ethereal-reference-graph.test.js`
- Modify: `src/core/index.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing Ethereal Reference reservation tests**

Create `tests/ethereal-reference-graph.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createEtherealReferenceReadModel
} = require("../src/core/etherealReferenceGraph");

test("createEtherealReferenceReadModel creates layout-free nodes and edges", () => {
  const model = createEtherealReferenceReadModel({
    researchTopics: [{ id: "topic-a", title: "Topic", linkedCandidateIds: ["candidate-a"], linkedCitationRelationIds: ["relation-a"] }],
    documentCandidates: [{ id: "candidate-a", title: "Candidate A", doi: "10.1/a", topicId: "topic-a" }],
    citationRelations: [{
      id: "relation-a",
      sourceWorkId: "work:doi:10.1/a",
      source: { title: "Candidate A", doi: "10.1/a" },
      target: { kind: "work-hint", text: "Target B" },
      relationType: "supports",
      confidence: "high",
      evidence: { text: "Evidence" },
      graphSeedId: "seed-a"
    }]
  }, { topicId: "topic-a" });

  assert.equal(model.nodes.length, 2);
  assert.equal(model.edges.length, 1);
  assert.equal(model.layoutKind, "none");
  assert.equal(model.featureState, "reserved-for-v0.5");
});

test("read model does not include x y or force layout fields", () => {
  const model = createEtherealReferenceReadModel({ documentCandidates: [{ id: "candidate-a", title: "A" }] });
  assert.equal(Object.prototype.hasOwnProperty.call(model.nodes[0], "x"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(model.nodes[0], "y"), false);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests\ethereal-reference-graph.test.js
```

Expected: FAIL because `src/core/etherealReferenceGraph.js` does not exist.

- [ ] **Step 3: Implement reservation read model**

Create `src/core/etherealReferenceGraph.js`:

```js
function createEtherealReferenceReadModel(snapshot = {}, { topicId } = {}) {
  const topicIds = topicId ? new Set([topicId]) : null;
  const candidates = (Array.isArray(snapshot.documentCandidates) ? snapshot.documentCandidates : [])
    .filter((candidate) => !topicIds || topicIds.has(candidate.topicId) || topicIds.has(candidate.topicIds?.[0]));
  const relations = Array.isArray(snapshot.citationRelations) ? snapshot.citationRelations : [];
  const nodes = [];
  const nodeIds = new Set();

  for (const candidate of candidates) {
    pushNode(nodes, nodeIds, {
      id: `candidate:${cleanText(candidate.id)}`,
      kind: "document-candidate",
      label: cleanText(candidate.title) || "未命名候选",
      candidateId: cleanText(candidate.id),
      doi: cleanText(candidate.doi),
      topicIds: uniqueClean([candidate.topicId].concat(candidate.topicIds || [])),
      statusTags: uniqueClean(candidate.anomalyTags),
      provenance: candidate.provenance || {}
    });
  }

  const edges = relations.map((relation) => {
    const sourceId = `work:${cleanText(relation.sourceWorkId || relation.source?.doi || relation.source?.title || relation.id)}`;
    const targetId = `target:${cleanText(relation.target?.text || relation.target?.id || relation.id)}`;
    pushNode(nodes, nodeIds, { id: sourceId, kind: "work", label: cleanText(relation.source?.title || relation.sourceWorkId) || "未命名作品" });
    pushNode(nodes, nodeIds, { id: targetId, kind: "work-hint", label: cleanText(relation.target?.text) || "未命名目标" });
    return {
      id: `edge:${cleanText(relation.id)}`,
      kind: "citation-relation",
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      relationType: cleanText(relation.relationType) || "related",
      evidence: relation.evidence || {},
      confidence: cleanText(relation.confidence) || "low",
      graphSeedId: cleanText(relation.graphSeedId),
      citationRelationId: cleanText(relation.id),
      provenance: relation.provenance || {}
    };
  });

  return {
    featureState: "reserved-for-v0.5",
    layoutKind: "none",
    nodes,
    edges,
    warnings: ["v0.4 仅预留关系网络数据，不渲染网状图。"]
  };
}
```

Add helper functions and export through `module.exports` and `window.WorkbenchEtherealReferenceGraph`.

- [ ] **Step 4: Export module and update syntax checks**

Modify `src/core/index.js` and `package.json` to include `etherealReferenceGraph.js`.

- [ ] **Step 5: Run tests**

Run:

```powershell
node --test tests\ethereal-reference-graph.test.js
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/core/etherealReferenceGraph.js src/core/index.js tests/ethereal-reference-graph.test.js
git commit -m "feat: reserve ethereal reference graph model"
```

---

### Task 8: Runtime Packaging And Panel Script Loading

**Files:**
- Modify: `scripts/build-xpi.ps1`
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `tests/package.test.js`
- Modify: `tests/ui-localization.test.js`

- [ ] **Step 1: Write failing packaging and loading tests**

Modify `tests/package.test.js` in `build script exists and documents the runtime package boundary`:

```js
for (const moduleName of [
  "researchTopic",
  "documentCandidateProtocol",
  "literatureDiscovery",
  "literatureSourceAdapters",
  "documentCandidateReview",
  "zoteroWriteQueue",
  "zoteroItemWriter",
  "etherealReferenceGraph"
]) {
  assert.match(script, new RegExp(`src/core/${moduleName}\\\\.js`));
  assert.match(script, new RegExp(`${moduleName}\\\\.js`));
}
```

Modify the XPI listing test:

```js
for (const moduleName of [
  "researchTopic",
  "documentCandidateProtocol",
  "literatureDiscovery",
  "literatureSourceAdapters",
  "documentCandidateReview",
  "zoteroWriteQueue",
  "zoteroItemWriter",
  "etherealReferenceGraph"
]) {
  assert.match(listing, new RegExp(`chrome/content/${moduleName}\\\\.js`));
}
```

Modify `tests/ui-localization.test.js` panel script assertions:

```js
for (const scriptName of [
  "researchTopic.js",
  "documentCandidateProtocol.js",
  "literatureDiscovery.js",
  "literatureSourceAdapters.js",
  "documentCandidateReview.js",
  "zoteroWriteQueue.js",
  "zoteroItemWriter.js",
  "etherealReferenceGraph.js"
]) {
  assert.match(panel, new RegExp(`<script src="${scriptName}"></script>`));
}
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests\package.test.js tests\ui-localization.test.js
```

Expected: FAIL because build script and panel do not include v0.4 modules.

- [ ] **Step 3: Update build script**

Add these copy lines to `scripts/build-xpi.ps1` before `researchPanelOrchestrator.js` and before `paperSummary.js`:

```powershell
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/researchTopic.js") -Destination (Join-Path $packageDir "chrome/content/researchTopic.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/documentCandidateProtocol.js") -Destination (Join-Path $packageDir "chrome/content/documentCandidateProtocol.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/literatureDiscovery.js") -Destination (Join-Path $packageDir "chrome/content/literatureDiscovery.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/literatureSourceAdapters.js") -Destination (Join-Path $packageDir "chrome/content/literatureSourceAdapters.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/documentCandidateReview.js") -Destination (Join-Path $packageDir "chrome/content/documentCandidateReview.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/zoteroWriteQueue.js") -Destination (Join-Path $packageDir "chrome/content/zoteroWriteQueue.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/zoteroItemWriter.js") -Destination (Join-Path $packageDir "chrome/content/zoteroItemWriter.js")
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/etherealReferenceGraph.js") -Destination (Join-Path $packageDir "chrome/content/etherealReferenceGraph.js")
```

- [ ] **Step 4: Add script tags to Research Panel**

In `chrome/content/researchPanel.xhtml`, add script tags after `workbenchSelectedPaper.js` and before `researchPanelOrchestrator.js`:

```xml
<script src="researchTopic.js"></script>
<script src="documentCandidateProtocol.js"></script>
<script src="literatureDiscovery.js"></script>
<script src="literatureSourceAdapters.js"></script>
<script src="documentCandidateReview.js"></script>
<script src="zoteroWriteQueue.js"></script>
<script src="zoteroItemWriter.js"></script>
<script src="etherealReferenceGraph.js"></script>
```

- [ ] **Step 5: Run tests and package**

Run:

```powershell
npm run check
npm run package
node --test tests\package.test.js tests\ui-localization.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add chrome/content/researchPanel.xhtml scripts/build-xpi.ps1 tests/package.test.js tests/ui-localization.test.js
git commit -m "build: package v0.4 runtime modules"
```

---

### Task 9: Three-Lane Research Panel UI Skeleton

**Files:**
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `chrome/content/paperSummary.js`
- Modify: `tests/ui-localization.test.js`
- Modify: `tests/research-panel-orchestrator.test.js`

- [ ] **Step 1: Write failing UI localization tests**

Modify `tests/ui-localization.test.js` to require these Chinese labels and ids:

```js
for (const text of [
  "研究主题",
  "三段式流水线",
  "启动",
  "复核",
  "写入",
  "文献发现",
  "候选文献",
  "来源选择",
  "OpenAlex",
  "Crossref",
  "Unpaywall",
  "HTTP Connector",
  "生成发现计划",
  "确认并搜索",
  "批量加入写入计划",
  "异常候选需单独复核",
  "Zotero 写入队列",
  "Ethereal Reference",
  "关系网络将在 v0.5 启用"
]) {
  assert.match(panel, new RegExp(text));
}

for (const id of [
  "research-topic-title",
  "research-topic-description",
  "pipeline-lane-launch",
  "pipeline-lane-review",
  "pipeline-lane-write",
  "literature-discovery-request",
  "literature-discovery-create-plan",
  "literature-discovery-confirm-search",
  "document-candidate-list",
  "document-candidate-review-status",
  "zotero-import-plan-create",
  "zotero-write-queue-list",
  "ethereal-reference-placeholder"
]) {
  assert.match(panel, new RegExp(`id="${id}"`));
}
```

Also assert runtime wiring:

```js
assert.match(runtime, /createLiteratureDiscoveryPlan/);
assert.match(runtime, /renderDocumentCandidateReview/);
assert.match(runtime, /renderZoteroWriteQueue/);
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests\ui-localization.test.js
```

Expected: FAIL because the new UI does not exist.

- [ ] **Step 3: Add XHTML sections**

In `chrome/content/researchPanel.xhtml`, add a new section near the top after the current selected-paper context:

```xml
<section id="v04-literature-pipeline">
  <div class="section-header">
    <strong>研究主题</strong>
    <span class="status">研究主题是文献发现、候选导入、笔记和关系线索的总线。</span>
  </div>
  <div class="field-grid">
    <label><span>主题标题</span><input id="research-topic-title" type="text" value="" /></label>
    <label><span>主题描述</span><textarea id="research-topic-description" rows="3"></textarea></label>
  </div>
  <div class="section-header"><strong>三段式流水线</strong></div>
  <div class="pipeline-grid">
    <div id="pipeline-lane-launch" class="record-item"><strong>启动</strong><span>创建发现计划并确认来源。</span></div>
    <div id="pipeline-lane-review" class="record-item"><strong>复核</strong><span>候选文献、来源证明和异常拦截。</span></div>
    <div id="pipeline-lane-write" class="record-item"><strong>写入</strong><span>Zotero 条目和附件串行写入。</span></div>
  </div>
  <div class="section-header"><strong>文献发现</strong></div>
  <label><span>发现请求</span><textarea id="literature-discovery-request" rows="3"></textarea></label>
  <div class="field-grid compact-fields">
    <label class="checkbox-label"><input id="literature-source-openalex" type="checkbox" checked="checked" /><span>OpenAlex</span></label>
    <label class="checkbox-label"><input id="literature-source-crossref" type="checkbox" checked="checked" /><span>Crossref</span></label>
    <label class="checkbox-label"><input id="literature-source-unpaywall" type="checkbox" checked="checked" /><span>Unpaywall</span></label>
    <label class="checkbox-label"><input id="literature-source-http-connector" type="checkbox" /><span>HTTP Connector</span></label>
  </div>
  <div class="actions">
    <button id="literature-discovery-create-plan" type="button">生成发现计划</button>
    <button id="literature-discovery-confirm-search" type="button" class="primary-action" disabled="disabled">确认并搜索</button>
  </div>
  <div id="literature-discovery-plan-preview" class="record-list"><div class="record-item">暂无发现计划</div></div>
  <div class="section-header"><strong>候选文献</strong><span id="document-candidate-review-status" class="status">异常候选需单独复核</span></div>
  <div id="document-candidate-list" class="record-list"><span class="status">暂无候选文献</span></div>
  <div class="actions"><button id="zotero-import-plan-create" type="button">批量加入写入计划</button></div>
  <div class="section-header"><strong>Zotero 写入队列</strong></div>
  <div id="zotero-write-queue-list" class="record-list"><span class="status">暂无写入任务</span></div>
  <div id="ethereal-reference-placeholder" class="record-item">
    <strong>Ethereal Reference</strong>
    <span>关系网络将在 v0.5 启用；v0.4 记录关系网络所需数据。</span>
  </div>
</section>
```

Add CSS:

```css
.pipeline-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
}
```

- [ ] **Step 4: Add runtime render stubs**

In `chrome/content/paperSummary.js`, add functions:

```js
function createLiteratureDiscoveryPlan() {
  getField("literature-discovery-plan-preview").textContent = "发现计划将在确认后查询来源；不会自动写入 Zotero。";
}

function renderDocumentCandidateReview(readModel) {
  const list = getField("document-candidate-list");
  clearElement(list);
  const candidates = Array.isArray(readModel?.candidates) ? readModel.candidates : [];
  if (!candidates.length) {
    appendEmptyRecord(list, "暂无候选文献");
    return;
  }
  for (const candidate of candidates) {
    appendRecordItem(list, {
      title: candidate.title || "未命名候选文献",
      detail: `来源：${candidate.sourceAdapterId || "未记录"}｜异常：${(candidate.anomalyTags || []).join("、") || "无"}`
    });
  }
}

function renderZoteroWriteQueue(readModel) {
  const list = getField("zotero-write-queue-list");
  clearElement(list);
  const entries = Array.isArray(readModel?.entries) ? readModel.entries : [];
  if (!entries.length) {
    appendEmptyRecord(list, "暂无写入任务");
    return;
  }
  for (const entry of entries) {
    appendRecordItem(list, { title: entry.title || entry.id, detail: entry.stateLabel || entry.state });
  }
}
```

Bind `literature-discovery-create-plan` to `createLiteratureDiscoveryPlan()` in `init()`.

- [ ] **Step 5: Run tests**

Run:

```powershell
node --test tests\ui-localization.test.js
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add chrome/content/paperSummary.js chrome/content/researchPanel.xhtml tests/ui-localization.test.js
git commit -m "feat: add v0.4 pipeline panel skeleton"
```

---

### Task 10: Panel Runtime Discovery And Review Wiring

**Files:**
- Modify: `chrome/content/paperSummary.js`
- Modify: `src/core/researchPanelOrchestrator.js`
- Modify: `tests/research-panel-orchestrator.test.js`
- Modify: `tests/ui-localization.test.js`

- [ ] **Step 1: Write failing orchestrator runtime tests**

Modify `tests/research-panel-orchestrator.test.js` with:

```js
test("research panel orchestrator creates discovery plan and candidate review records", () => {
  const orchestrator = createResearchPanelOrchestrator({
    literatureDiscoveryModule: {
      createLiteratureDiscoveryJobPlan: () => ({ job: { id: "job-a", topicId: "topic-a" }, confirmation: { required: true } }),
      createLiteratureDiscoveryReadModel: () => ({ jobs: [{ id: "job-a" }], candidateCount: 0 })
    },
    documentCandidateReviewModule: {
      createCandidateReviewReadModel: () => ({ candidates: [], summary: { blockedCount: 0 } })
    },
    zoteroWriteQueueModule: {
      createZoteroWriteQueueReadModel: () => ({ entries: [] })
    },
    transactionModule: {
      createLiteratureDiscoveryPlanTransaction: ({ snapshot }) => ({ snapshot: { ...snapshot, literatureDiscoveryJobs: [{ id: "job-a" }] } }),
      confirmAiJobPlanTransaction() {},
      confirmResearchNoteDraftSavedToZoteroTransaction() {},
      createAiJobPlanTransaction() {},
      createResearchNoteDraftTransaction() {},
      recordAiTaskQueueResultTransaction() {},
      recordAiTaskQueueResultWithDraftsTransaction() {}
    },
    paperSummaryModule: fakePaperSummaryModule(),
    graphReviewWorkflowModule: fakeGraphReviewWorkflowModule(),
    aiTaskWorkspaceModule: fakeAiTaskWorkspaceModule()
  });

  const result = orchestrator.createLiteratureDiscoveryPlanWorkflow({
    snapshot: { schemaVersion: 1 },
    topicId: "topic-a",
    requestText: "query"
  });

  assert.equal(result.status, "literatureDiscoveryPlanCreated");
  assert.equal(result.records.literatureDiscovery.jobs[0].id, "job-a");
});
```

Use the existing fake module helper style in that file.

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests\research-panel-orchestrator.test.js
```

Expected: FAIL because orchestrator does not resolve v0.4 modules yet.

- [ ] **Step 3: Add orchestrator dependencies**

In `src/core/researchPanelOrchestrator.js`, add resolvers and asserts for:

- `literatureDiscoveryModule`
- `documentCandidateReviewModule`
- `zoteroWriteQueueModule`
- `etherealReferenceGraphModule`

Add v0.4 read models to `createPanelRecords()`:

```js
literatureDiscovery: literatureDiscoveryModule.createLiteratureDiscoveryReadModel(snapshot, { topicId: selectedTopicId }),
candidateReview: documentCandidateReviewModule.createCandidateReviewReadModel(snapshot, { topicId: selectedTopicId }),
zoteroWriteQueue: zoteroWriteQueueModule.createZoteroWriteQueueReadModel(snapshot, { topicId: selectedTopicId }),
etherealReference: etherealReferenceGraphModule.createEtherealReferenceReadModel(snapshot, { topicId: selectedTopicId })
```

- [ ] **Step 4: Wire panel runtime to orchestrator**

In `chrome/content/paperSummary.js`:

- Read topic title and description.
- Read selected sources from checkboxes.
- Call `orchestrator.createLiteratureDiscoveryPlanWorkflow()`.
- Store the latest plan on `window.WorkbenchLiteratureDiscoveryPlan`.
- Render plan preview in `literature-discovery-plan-preview`.
- Keep `literature-discovery-confirm-search` disabled until a plan exists.

Use this preview text pattern:

```js
`计划预览：来源 ${plan.job.sources.join("、")}｜最多候选 ${plan.job.maxCandidates}｜不会自动写入 Zotero`
```

- [ ] **Step 5: Run tests**

Run:

```powershell
node --test tests\research-panel-orchestrator.test.js tests\ui-localization.test.js
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add chrome/content/paperSummary.js src/core/researchPanelOrchestrator.js tests/research-panel-orchestrator.test.js tests/ui-localization.test.js
git commit -m "feat: wire v0.4 pipeline workflows"
```

---

### Task 11: Toolbar And Context Menu Launch Surfaces

**Files:**
- Modify: `chrome/content/workbenchPlugin.mjs`
- Modify: `tests/ui-localization.test.js`
- Create: `tests/workbench-plugin-launch-surfaces.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing launch surface tests**

Create `tests/workbench-plugin-launch-surfaces.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("workbench plugin defines toolbar and context menu launch surface ids", () => {
  const plugin = fs.readFileSync(path.join(root, "chrome/content/workbenchPlugin.mjs"), "utf8");
  assert.match(plugin, /zrw-toolbar-open-research-panel/);
  assert.match(plugin, /zrw-context-create-discovery-plan/);
  assert.match(plugin, /addToolbarButton/);
  assert.match(plugin, /addItemContextMenu/);
  assert.match(plugin, /removeFromWindow/);
});

test("toolbar and context labels are Chinese", () => {
  const plugin = fs.readFileSync(path.join(root, "chrome/content/workbenchPlugin.mjs"), "utf8");
  assert.match(plugin, /研究工作台/);
  assert.match(plugin, /从选中文献发现相关文献/);
});
```

Modify `tests/ui-localization.test.js` to include:

```js
assert.match(plugin, /研究工作台/);
assert.match(plugin, /从选中文献发现相关文献/);
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests\workbench-plugin-launch-surfaces.test.js tests\ui-localization.test.js
```

Expected: FAIL because toolbar and context menu ids are missing.

- [ ] **Step 3: Add toolbar and context menu methods**

Modify `chrome/content/workbenchPlugin.mjs`:

```js
addToWindow(win) {
  const doc = win?.document;
  if (!doc) return;
  this.addToolsMenuItem(win);
  this.addToolbarButton(win);
  this.addItemContextMenu(win);
}

addToolbarButton(win) {
  const doc = win?.document;
  if (!doc || doc.getElementById("zrw-toolbar-open-research-panel")) return;
  const toolbar = doc.getElementById("zotero-items-toolbar") ||
    doc.getElementById("zotero-toolbar") ||
    doc.querySelector?.("toolbar");
  if (!toolbar) {
    this.log("Toolbar insertion point unavailable; Tools menu remains available");
    return;
  }
  const button = doc.createXULElement ? doc.createXULElement("toolbarbutton") : doc.createElement("button");
  button.id = "zrw-toolbar-open-research-panel";
  button.setAttribute("label", "研究工作台");
  button.setAttribute("tooltiptext", "打开 Zotero 研究工作台");
  button.addEventListener("command", () => this.openResearchPanel({ launchSurface: "toolbar" }));
  toolbar.appendChild(button);
}

addItemContextMenu(win) {
  const doc = win?.document;
  if (!doc || doc.getElementById("zrw-context-create-discovery-plan")) return;
  const popup = doc.getElementById("zotero-itemmenu") ||
    doc.getElementById("zotero-item-context-menu") ||
    doc.querySelector?.("menupopup");
  if (!popup) {
    this.log("Item context menu insertion point unavailable");
    return;
  }
  const item = doc.createXULElement("menuitem");
  item.id = "zrw-context-create-discovery-plan";
  item.setAttribute("label", "从选中文献发现相关文献");
  item.addEventListener("command", () => this.openResearchPanel({ launchSurface: "item-context-menu", intent: "related-literature" }));
  popup.appendChild(item);
}
```

Update `openResearchPanel(options = {})` to pass options:

```js
{ Zotero: this.Zotero, launchOptions: options }
```

Update `removeFromWindow(win)`:

```js
for (const id of ["zrw-open-research-panel", "zrw-toolbar-open-research-panel", "zrw-context-create-discovery-plan"]) {
  win?.document?.getElementById(id)?.remove();
}
```

- [ ] **Step 4: Add syntax check test command coverage**

No package check change is needed because `workbenchPlugin.mjs` is already in `npm run check`. Add the new test file to normal `npm test` automatically.

- [ ] **Step 5: Run tests**

Run:

```powershell
node --test tests\workbench-plugin-launch-surfaces.test.js tests\ui-localization.test.js
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add chrome/content/workbenchPlugin.mjs tests/ui-localization.test.js tests/workbench-plugin-launch-surfaces.test.js
git commit -m "feat: add zotero launch surfaces"
```

---

### Task 12: Runtime Source Execution And Write Queue Integration

**Files:**
- Modify: `chrome/content/paperSummary.js`
- Modify: `tests/ui-localization.test.js`
- Modify: `tests/research-panel-orchestrator.test.js`

- [ ] **Step 1: Write failing runtime wiring assertions**

Modify `tests/ui-localization.test.js`:

```js
for (const runtimeFunction of [
  "runLiteratureDiscoverySources",
  "createSourceAdapters",
  "createZoteroImportPlan",
  "runZoteroWriteQueue",
  "writeZoteroItemFromIntent",
  "writeZoteroAttachmentFromIntent"
]) {
  assert.match(runtime, new RegExp(runtimeFunction));
}
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node --test tests\ui-localization.test.js
```

Expected: FAIL because runtime functions are missing.

- [ ] **Step 3: Add source adapter factory in panel runtime**

In `chrome/content/paperSummary.js`, add:

```js
function createSourceAdapters(settings = {}) {
  const adapters = [];
  if (getField("literature-source-openalex")?.checked) {
    adapters.push(WorkbenchLiteratureSourceAdapters.createOpenAlexAdapter({ fetchImpl: workbenchFetch }));
  }
  if (getField("literature-source-crossref")?.checked) {
    adapters.push(WorkbenchLiteratureSourceAdapters.createCrossrefAdapter({ fetchImpl: workbenchFetch }));
  }
  if (getField("literature-source-unpaywall")?.checked) {
    adapters.push(WorkbenchLiteratureSourceAdapters.createUnpaywallAdapter({
      fetchImpl: workbenchFetch,
      email: cleanText(settings.unpaywallEmail)
    }));
  }
  if (getField("literature-source-http-connector")?.checked && cleanText(settings.connectorUrl)) {
    adapters.push(WorkbenchLiteratureSourceAdapters.createHttpConnectorAdapter({
      fetchImpl: workbenchFetch,
      endpointUrl: settings.connectorUrl,
      headers: settings.connectorHeaders || {}
    }));
  }
  return adapters;
}
```

- [ ] **Step 4: Add discovery execution**

Add:

```js
async function runLiteratureDiscoverySources() {
  const plan = window.WorkbenchLiteratureDiscoveryPlan;
  if (!plan?.job) throw new Error("请先生成发现计划");
  const adapters = createSourceAdapters(readV04SourceSettings());
  const results = [];
  for (const adapter of adapters) {
    try {
      results.push(await adapter.query({
        topicId: plan.job.topicId,
        requestText: plan.job.requestText,
        sourceScopes: plan.job.sourceScopes,
        maxCandidates: plan.job.maxCandidates,
        observedAt: new Date().toISOString()
      }));
    } catch (error) {
      results.push({ sourceAdapterId: adapter.sourceAdapterId || "unknown", candidates: [], failures: [error] });
    }
  }
  const merged = WorkbenchLiteratureDiscovery.mergeDiscoverySourceResults(results);
  const snapshot = await loadWorkbenchSnapshot();
  const result = WorkbenchLocalStoreTransaction.recordLiteratureDiscoveryCandidatesTransaction({
    snapshot,
    jobId: plan.job.id,
    topicId: plan.job.topicId,
    candidates: merged.candidates,
    recordedAt: new Date().toISOString()
  });
  await saveWorkbenchSnapshot(result.snapshot);
  renderDocumentCandidateReview(orchestrator.createPanelRecords(result.snapshot, { topicId: plan.job.topicId }).candidateReview);
}
```

Use the repo's existing load/save snapshot helpers in `paperSummary.js`; if their names differ, route through the existing runtime store instance used by current actions.

- [ ] **Step 5: Add import plan and write queue execution**

Add `createZoteroImportPlan()` to collect checked candidates from the review table, call `createZoteroImportPlanWorkflow()`, then create a write queue transaction.

Add `runZoteroWriteQueue()` to process one entry at a time:

```js
async function runZoteroWriteQueue(queue) {
  let current = queue;
  while (true) {
    const next = WorkbenchZoteroWriteQueue.runNextZoteroWriteQueueEntry({ queue: current, startedAt: new Date().toISOString() });
    if (!next.entry) break;
    let result;
    try {
      if (next.entry.intent.kind === "create-item") {
        result = await WorkbenchZoteroItemWriter.writeZoteroItemFromIntent({ Zotero, intent: next.entry.intent });
      } else {
        result = await WorkbenchZoteroItemWriter.writeZoteroAttachmentFromIntent({
          Zotero,
          intent: next.entry.intent,
          parentItemId: next.entry.resolvedZoteroItemId,
          parentItemKey: next.entry.resolvedZoteroItemKey
        });
      }
      current = WorkbenchZoteroWriteQueue.recordZoteroWriteQueueEntryResult({
        queue: next.queue,
        entryId: next.entry.id,
        result: { state: "succeeded", ...result },
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      current = WorkbenchZoteroWriteQueue.recordZoteroWriteQueueEntryResult({
        queue: next.queue,
        entryId: next.entry.id,
        result: { state: "failed", errorNotice: createLayeredErrorNotice(error, "Zotero 写入失败") },
        completedAt: new Date().toISOString()
      });
    }
    renderZoteroWriteQueue(WorkbenchZoteroWriteQueue.createZoteroWriteQueueReadModel({ zoteroWriteQueues: [current] }));
  }
  return current;
}
```

- [ ] **Step 6: Run tests**

Run:

```powershell
node --test tests\ui-localization.test.js tests\research-panel-orchestrator.test.js
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add chrome/content/paperSummary.js tests/research-panel-orchestrator.test.js tests/ui-localization.test.js
git commit -m "feat: wire v0.4 discovery import runtime"
```

---

### Task 13: Documentation, Manual QA, And Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/first-run-manual-qa.md`
- Modify: `docs/superpowers/specs/2026-05-23-v04-literature-discovery-import-pipeline-design.md` only if implementation reveals a documented constraint that must be corrected.

- [ ] **Step 1: Update README current slice**

Add v0.4 bullets under `Current Slice`:

```markdown
- a topic-centered v0.4 literature discovery and import pipeline;
- OpenAlex, Crossref, Unpaywall, and HTTP connector source adapters normalized through one Document Candidate protocol;
- candidate review with batch selection and anomaly blocking;
- explicit Zotero item plus attachment import through a serial Zotero Write Queue;
- top toolbar and item context-menu launch surfaces that open the same Research Panel pipeline;
- Ethereal Reference data and UI reservation for a later relation-network analysis release.
```

- [ ] **Step 2: Update manual QA**

Add a v0.4 section to `docs/first-run-manual-qa.md`:

```markdown
## v0.4 Literature Discovery And Import Pipeline

1. Click the Zotero toolbar `研究工作台` button.
2. Confirm the Research Panel opens and shows `研究主题` and `三段式流水线`.
3. Enter a topic title and discovery request.
4. Select OpenAlex, Crossref, and Unpaywall.
5. Click `生成发现计划`.
6. Confirm the plan says it will not automatically write Zotero.
7. Click `确认并搜索`.
8. Confirm candidates appear with source and anomaly labels.
9. Select one normal candidate and create an import plan.
10. Confirm the write plan shows item and attachment counts.
11. Confirm item/attachment writes require explicit user action.
12. Run the write queue and verify Zotero creates the expected item.
13. If an attachment fails, verify the item remains and the attachment entry is retryable.
14. Right-click a Zotero item and choose `从选中文献发现相关文献`; confirm it creates a draft plan rather than executing immediately.
```

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm run check
npm test
npm run package
node --test tests\package.test.js
git diff --check
```

Expected:

- `npm run check`: exit 0.
- `npm test`: all tests pass.
- `npm run package`: builds `dist/zotero-research-workbench-0.3.0.xpi` until version is intentionally bumped.
- `node --test tests\package.test.js`: all tests pass.
- `git diff --check`: exit 0, allowing only CRLF warnings.

- [ ] **Step 4: Commit docs and final integration**

```powershell
git add README.md docs/README.md docs/first-run-manual-qa.md
git commit -m "docs: document v0.4 discovery import workflow"
```

- [ ] **Step 5: Version and release decision**

Only after implementation is verified, decide whether to bump to `0.4.0-beta.1` or `0.4.0`. Do not change version during early slice work unless the user asks for a packaged release.

---

## Full Verification Checklist

Run this after all tasks:

```powershell
npm run check
npm test
npm run package
node --test tests\package.test.js
git status --short --branch
```

Manual Zotero QA must verify:

- Tools menu still opens the Research Panel.
- Toolbar `研究工作台` button opens the Research Panel.
- Item context menu `从选中文献发现相关文献` opens a draft discovery plan.
- Discovery plan confirmation blocks source calls until confirmation.
- Candidate review shows source provenance and anomaly tags.
- Normal candidates can be batch-selected.
- Anomalous candidates require detail confirmation.
- Zotero Write Queue writes one item or attachment at a time.
- Attachment failure preserves the created item.
- No blocked-source connector or scraping-only source appears in UI or docs.
- Ethereal Reference placeholder is visible but does not render a network graph.

## Plan Self-Review

Spec coverage:

- Topic-centered linkage is covered by Tasks 1, 3, 5, 9, and 10.
- Document Candidate protocol is covered by Task 2.
- OpenAlex, Crossref, Unpaywall, and HTTP connector adapters are covered by Task 4.
- Candidate review, anomaly blocking, dedupe hints, and import plans are covered by Task 5.
- Zotero item and attachment writes through a serial queue are covered by Task 6 and Task 12.
- Toolbar and context-menu launch surfaces are covered by Task 11.
- Ethereal Reference reservation is covered by Task 7 and the UI placeholder in Task 9.
- Packaging, tests, and docs are covered by Tasks 8 and 13.

Placeholder scan:

- The plan intentionally contains no unresolved placeholder markers or deferred implementation requirements.

Type consistency:

- Topic ids use `topicId`.
- Candidate ids use `candidateId` and `candidateIds`.
- Discovery jobs use `literatureDiscoveryJobs`.
- Import plans use `zoteroImportPlans`.
- Write queues use `zoteroWriteQueues`.
- Ethereal Reference exposes layout-free `nodes` and `edges` with `layoutKind: "none"`.
