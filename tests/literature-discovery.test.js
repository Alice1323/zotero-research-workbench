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
const { createWorkbenchExportPackage, normalizeSnapshotForImport } = require("../src/core/workbenchSnapshot");
const core = require("../src/core");

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
  assert.deepEqual(recorded.snapshot.researchTopics[0].linkedAiJobIds, [plan.job.id]);
});

test("transactions preserve existing v0.4 arrays while recording discovery work", () => {
  const plan = createLiteratureDiscoveryJobPlan({
    topicId: "topic-a",
    requestText: "query",
    sources: ["openalex"],
    createdAt: "2026-05-23T12:00:00.000Z"
  });
  const result = createLiteratureDiscoveryPlanTransaction({
    snapshot: {
      schemaVersion: 1,
      researchTopics: [{ id: "topic-a", title: "Topic" }],
      documentCandidates: [{ id: "candidate-existing", topicId: "topic-a" }]
    },
    plan,
    createdAt: "2026-05-23T12:00:00.000Z"
  });

  assert.equal(result.snapshot.researchTopics[0].id, "topic-a");
  assert.equal(result.snapshot.documentCandidates[0].id, "candidate-existing");
});

test("createLiteratureDiscoveryReadModel shows latest plan and candidate counts", () => {
  const model = createLiteratureDiscoveryReadModel(
    {
      literatureDiscoveryJobs: [{ id: "job-a", topicId: "topic-a", state: "completed", createdAt: "2026-05-23T12:00:00.000Z" }],
      documentCandidates: [{ id: "candidate-a", topicId: "topic-a" }, { id: "candidate-b", topicId: "topic-b" }]
    },
    { topicId: "topic-a" }
  );

  assert.equal(model.jobs[0].stateLabel, "已完成");
  assert.equal(model.candidateCount, 1);
});

test("snapshot preserves literature discovery records and redacts failures", () => {
  const restored = normalizeSnapshotForImport({
    schemaVersion: 1,
    literatureDiscoveryJobs: [{ id: "job-a" }],
    literatureDiscoveryFailures: [{ id: "failure-a", token: "secret-token" }]
  });
  const exported = createWorkbenchExportPackage({ snapshot: restored, exportedAt: "2026-05-23T12:00:00.000Z" });

  assert.equal(restored.literatureDiscoveryJobs[0].id, "job-a");
  assert.equal(exported.snapshot.literatureDiscoveryFailures[0].token, "<redacted>");
});

test("core index exports literature discovery module", () => {
  assert.equal(typeof core.WorkbenchLiteratureDiscovery.createLiteratureDiscoveryJobPlan, "function");
});
