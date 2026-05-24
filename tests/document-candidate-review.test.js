const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createCandidateReviewReadModel,
  markCandidateReviewed,
  createZoteroImportPlanFromCandidates
} = require("../src/core/documentCandidateReview");
const { createWorkbenchExportPackage, normalizeSnapshotForImport } = require("../src/core/workbenchSnapshot");
const core = require("../src/core");

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

test("candidate review read model filters by topic and exposes attachment choices", () => {
  const model = createCandidateReviewReadModel(
    {
      documentCandidates: [
        {
          id: "candidate-a",
          topicId: "topic-a",
          title: "A",
          anomalyTags: [],
          attachments: [{ id: "att-a", kind: "open-access-pdf-url", importable: true }]
        },
        { id: "candidate-b", topicId: "topic-b", title: "B", anomalyTags: [], attachments: [] }
      ]
    },
    { topicId: "topic-a" }
  );

  assert.deepEqual(model.candidates.map((candidate) => candidate.id), ["candidate-a"]);
  assert.deepEqual(model.candidates[0].importableAttachmentIds, ["att-a"]);
});

test("candidate review read model exposes pdf status and provenance", () => {
  const model = createCandidateReviewReadModel({
    documentCandidates: [
      {
        id: "candidate-a",
        topicId: "topic-a",
        title: "Candidate A",
        anomalyTags: [],
        attachments: [
          {
            id: "att-a",
            kind: "open-access-pdf-url",
            url: "https://example.org/a.pdf",
            importable: true,
            license: "cc-by",
            provenance: { source: "unpaywall", requestUrl: "https://api.unpaywall.org/v2/10.1000/a" }
          }
        ]
      }
    ]
  }, { topicId: "topic-a" });

  assert.equal(model.candidates[0].pdfStatus, "available");
  assert.equal(model.candidates[0].pdfStatusLabel, "可导入 PDF");
  assert.deepEqual(model.candidates[0].pdfSources, ["unpaywall"]);
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

test("createZoteroImportPlanFromCandidates maps candidates to Zotero item fields", () => {
  const plan = createZoteroImportPlanFromCandidates({
    topicId: "topic-a",
    targetCollectionKey: "COLL1",
    candidates: [
      {
        id: "candidate-a",
        title: "Title A",
        authors: [{ name: "Chen A" }],
        year: "2024",
        doi: "10.1000/a",
        publicationTitle: "Journal A",
        anomalyTags: []
      }
    ],
    selections: [{ candidateId: "candidate-a", importMode: "zotero-item" }],
    createdAt: "2026-05-23T12:00:00.000Z"
  });

  assert.deepEqual(plan.writeIntents[0], {
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
      publicationTitle: "Journal A"
    },
    targetCollectionKey: "COLL1",
    dependsOn: [],
    provenance: { sourceCandidateId: "candidate-a" }
  });
});

test("createZoteroImportPlanFromCandidates rejects unreviewed anomalous candidates", () => {
  assert.throws(
    () =>
      createZoteroImportPlanFromCandidates({
        candidates: [{ id: "bad", title: "Bad", anomalyTags: ["缺少身份线索"], reviewState: "needs-review" }],
        selections: [{ candidateId: "bad", importMode: "zotero-item" }]
      }),
    /候选文献需要单独复核/
  );
});

test("createZoteroImportPlanFromCandidates rejects candidates from another topic", () => {
  assert.throws(
    () =>
      createZoteroImportPlanFromCandidates({
        topicId: "topic-a",
        candidates: [{ id: "candidate-b", topicId: "topic-b", title: "B", anomalyTags: [] }],
        selections: [{ candidateId: "candidate-b", importMode: "zotero-item" }]
      }),
    /候选文献不属于当前研究主题/
  );
});

test("rejected candidates are not quick importable or import plannable", () => {
  const model = createCandidateReviewReadModel({
    documentCandidates: [{ id: "candidate-a", title: "A", anomalyTags: [], reviewState: "rejected" }]
  });

  assert.equal(model.candidates[0].quickImportAllowed, false);
  assert.throws(
    () =>
      createZoteroImportPlanFromCandidates({
        candidates: [{ id: "candidate-a", title: "A", anomalyTags: [], reviewState: "rejected" }],
        selections: [{ candidateId: "candidate-a", importMode: "zotero-item" }]
      }),
    /候选文献已被拒绝/
  );
});

test("explicit needs-review candidates are not import plannable even without anomalies", () => {
  assert.throws(
    () =>
      createZoteroImportPlanFromCandidates({
        candidates: [{ id: "candidate-a", title: "A", anomalyTags: [], reviewState: "needs-review" }],
        selections: [{ candidateId: "candidate-a", importMode: "zotero-item" }]
      }),
    /候选文献尚未确认/
  );
});

test("snapshot preserves import plans and redacts nested provenance secrets", () => {
  const restored = normalizeSnapshotForImport({
    schemaVersion: 1,
    zoteroImportPlans: [{ id: "plan-a", provenance: { token: "secret-token" } }]
  });
  const exported = createWorkbenchExportPackage({ snapshot: restored, exportedAt: "2026-05-23T12:00:00.000Z" });

  assert.equal(restored.zoteroImportPlans[0].id, "plan-a");
  assert.equal(exported.snapshot.zoteroImportPlans[0].provenance.token, "<redacted>");
});

test("core index exports document candidate review module", () => {
  assert.equal(typeof core.WorkbenchDocumentCandidateReview.createCandidateReviewReadModel, "function");
});
