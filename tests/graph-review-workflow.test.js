const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  captureGraphSeedWorkflow,
  createGraphReviewReadModel,
  listGraphReviewDuplicateWorkCandidateEvidence,
  promoteGraphSeedWorkflow,
  reviewGraphSeedWorkflow
} = require("../src/core/graphReviewWorkflow");

const core = require("../src/core");
const root = path.resolve(__dirname, "..");

test("core index exports graph review workflow module", () => {
  assert.equal(core.WorkbenchGraphReviewWorkflow.createGraphReviewReadModel, createGraphReviewReadModel);
});

test("createGraphReviewReadModel composes graph review surfaces from one snapshot", () => {
  const snapshot = createSnapshot();
  const model = createGraphReviewReadModel({
    snapshot,
    selectedWorkId: "work:doi:10.shared",
    filters: {
      graphSeedReview: { reviewState: "pending", currentWorkOnly: true },
      citationGraph: { scope: "current-work", qualityTag: "低置信度" },
      workIdentity: { scope: "current-work", statusTag: "多来源" },
      duplicateWork: { reason: "shared-doi" }
    }
  });

  assert.deepEqual(model.graphSeedReviewQueue.map((seed) => seed.id), ["seed-current"]);
  assert.deepEqual(model.citationRelations.map((relation) => relation.id), ["relation-current"]);
  assert.deepEqual(model.workIdentities.map((work) => work.workId), ["work:doi:10.shared"]);
  assert.deepEqual(model.duplicateWorkCandidates.map((candidate) => candidate.reason), ["shared-doi"]);
  assert.deepEqual(model.counts, {
    graphSeedReviewQueue: 1,
    citationRelations: 1,
    workIdentities: 1,
    duplicateWorkCandidates: 1
  });
});

test("listGraphReviewDuplicateWorkCandidateEvidence returns evidence through workflow interface", () => {
  const snapshot = createSnapshot();
  const model = createGraphReviewReadModel({
    snapshot,
    filters: { duplicateWork: { reason: "shared-doi" } }
  });
  const evidence = listGraphReviewDuplicateWorkCandidateEvidence({
    snapshot,
    candidate: model.duplicateWorkCandidates[0]
  });

  assert.ok(evidence.some((record) => record.sourceType === "draft"));
  assert.ok(evidence.some((record) => record.sourceType === "graphSeed"));
  assert.equal(evidence[0].matchedField, "doi");
  assert.equal(evidence[0].matchedValue, "10.shared");
});

test("captureGraphSeedWorkflow writes through the local store transaction module", () => {
  const result = captureGraphSeedWorkflow({
    snapshot: { schemaVersion: 1, exportedAt: "old", graphSeeds: [], taskLedger: [] },
    seedInput: {
      id: "seed-new",
      providerId: "model-a",
      workId: "work:doi:10.new",
      source: { title: "New Source" },
      target: { text: "New Target" },
      createdAt: "2026-05-21T01:00:00.000Z"
    },
    createdAt: "2026-05-21T01:00:00.000Z"
  });

  assert.equal(result.status, "captured");
  assert.equal(result.graphSeedId, "seed-new");
  assert.equal(result.snapshot.graphSeeds.length, 1);
  assert.equal(result.snapshot.taskLedger[0].workflowStep, "capture-graph-seed");
});

test("reviewGraphSeedWorkflow returns named review result and updated snapshot", () => {
  const result = reviewGraphSeedWorkflow({
    snapshot: createSnapshot(),
    seedId: "seed-current",
    reviewState: "confirmed",
    reviewedAt: "2026-05-21T01:05:00.000Z"
  });

  assert.equal(result.status, "reviewed");
  assert.equal(result.reviewState, "confirmed");
  assert.equal(result.snapshot.graphSeeds.find((seed) => seed.id === "seed-current").reviewState, "confirmed");
});

test("promoteGraphSeedWorkflow returns promoted, alreadyPromoted, or notConfirmed results", () => {
  const promoted = promoteGraphSeedWorkflow({
    snapshot: createSnapshot(),
    seedId: "seed-confirmed",
    promotedAt: "2026-05-21T01:10:00.000Z"
  });
  assert.equal(promoted.status, "promoted");
  assert.equal(promoted.citationRelationId, "citation-relation-seed-confirmed");

  const alreadyPromoted = promoteGraphSeedWorkflow({
    snapshot: promoted.snapshot,
    seedId: "seed-confirmed",
    promotedAt: "2026-05-21T01:11:00.000Z"
  });
  assert.equal(alreadyPromoted.status, "alreadyPromoted");
  assert.equal(alreadyPromoted.snapshot.citationRelations.length, promoted.snapshot.citationRelations.length);

  const notConfirmed = promoteGraphSeedWorkflow({
    snapshot: createSnapshot(),
    seedId: "seed-current",
    promotedAt: "2026-05-21T01:12:00.000Z"
  });
  assert.equal(notConfirmed.status, "notConfirmed");
  assert.equal(notConfirmed.snapshot, undefined);

  const missingSeed = promoteGraphSeedWorkflow({
    snapshot: createSnapshot(),
    seedId: "seed-missing",
    promotedAt: "2026-05-21T01:13:00.000Z"
  });
  assert.equal(missingSeed.status, "missingSeed");
  assert.equal(missingSeed.snapshot, undefined);
});

test("graph review workflow browser scripts register globals and compose workflow behavior", () => {
  const context = { window: {} };
  for (const fileName of [
    "workbenchLocalStoreTransaction.js",
    "graphSeed.js",
    "workIdentity.js",
    "graphReviewWorkflow.js"
  ]) {
    const source = fs.readFileSync(
      path.join(root, fileName === "graphReviewWorkflow.js" ? "src/core/graphReviewWorkflow.js" : `src/core/${fileName}`),
      "utf8"
    );
    vm.runInNewContext(source, context, { filename: fileName });
  }

  assert.equal(typeof context.window.WorkbenchGraphSeed.listGraphSeedsForReview, "function");
  assert.equal(typeof context.window.WorkbenchWorkIdentity.listDuplicateWorkCandidates, "function");
  assert.equal(typeof context.window.WorkbenchGraphReviewWorkflow.createGraphReviewReadModel, "function");
  assert.equal(typeof context.window.WorkbenchGraphReviewWorkflow.captureGraphSeedWorkflow, "function");

  const model = context.window.WorkbenchGraphReviewWorkflow.createGraphReviewReadModel({
    snapshot: createSnapshot(),
    selectedWorkId: "work:doi:10.shared",
    filters: { graphSeedReview: { reviewState: "pending", currentWorkOnly: true } }
  });
  assert.deepEqual(model.graphSeedReviewQueue.map((seed) => seed.id), ["seed-current"]);

  const result = context.window.WorkbenchGraphReviewWorkflow.captureGraphSeedWorkflow({
    snapshot: { schemaVersion: 1, exportedAt: "old", graphSeeds: [], taskLedger: [] },
    seedInput: {
      id: "seed-browser",
      providerId: "model-a",
      workId: "work:zotero:browser",
      source: { title: "Browser Source" },
      target: { text: "Browser Target" }
    },
    createdAt: "2026-05-21T01:20:00.000Z"
  });
  assert.equal(result.status, "captured");
  assert.equal(result.snapshot.graphSeeds[0].id, "seed-browser");
});

function createSnapshot() {
  return {
    schemaVersion: 1,
    exportedAt: "2026-05-21T00:00:00.000Z",
    researchNoteDrafts: [
      {
        id: "draft-current",
        workId: "work:doi:10.shared",
        zoteroItemKey: "AAA111",
        title: "Shared Paper - 中文总结",
        inputContext: { title: "Shared Paper", doi: "10.shared" },
        createdAt: "2026-05-21T00:05:00.000Z"
      }
    ],
    graphSeeds: [
      {
        id: "seed-duplicate",
        workId: "work:zotero:BBB222",
        zoteroItemKey: "BBB222",
        source: { title: "Shared Paper Copy", doi: "10.shared" },
        relationType: "related",
        target: { text: "Target Duplicate" },
        evidence: { text: "Evidence Duplicate" },
        providerId: "model-a",
        confidence: "medium",
        seedKind: "user-confirmed",
        reviewState: "confirmed",
        createdAt: "2026-05-21T00:04:00.000Z"
      },
      {
        id: "seed-current",
        workId: "work:doi:10.shared",
        zoteroItemKey: "BBB222",
        source: { title: "Shared Paper Copy", doi: "10.shared" },
        relationType: "supports",
        target: { text: "Target A" },
        evidence: { text: "Evidence A" },
        providerId: "model-a",
        confidence: "medium",
        seedKind: "user-confirmed",
        reviewState: "pending",
        createdAt: "2026-05-21T00:10:00.000Z"
      },
      {
        id: "seed-confirmed",
        workId: "work:doi:10.confirmed",
        source: { title: "Confirmed Paper", doi: "10.confirmed" },
        relationType: "related",
        target: { text: "Target B" },
        evidence: { text: "Evidence B" },
        providerId: "model-b",
        confidence: "high",
        seedKind: "user-confirmed",
        reviewState: "confirmed",
        createdAt: "2026-05-21T00:15:00.000Z"
      }
    ],
    citationRelations: [
      {
        id: "relation-current",
        sourceWorkId: "work:doi:10.shared",
        source: { title: "Shared Paper", doi: "10.shared" },
        relationType: "related",
        target: { text: "" },
        evidence: { text: "" },
        confidence: "low",
        graphSeedId: "seed-current",
        createdAt: "2026-05-21T00:20:00.000Z"
      }
    ],
    taskLedger: []
  };
}
