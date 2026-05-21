const test = require("node:test");
const assert = require("node:assert/strict");

const {
  captureGraphSeedTransaction,
  confirmResearchNoteDraftSavedToZoteroTransaction,
  createResearchNoteDraftTransaction,
  removePromptOverrideTransaction,
  promoteGraphSeedTransaction,
  replaceWorkbenchSnapshotFromImportTransaction,
  reviewGraphSeedTransaction,
  upsertPromptOverrideTransaction
} = require("../src/core/workbenchLocalStoreTransaction");

const core = require("../src/core");

test("core index exports workbench local store transaction module", () => {
  assert.equal(core.WorkbenchLocalStoreTransaction.createResearchNoteDraftTransaction, createResearchNoteDraftTransaction);
});

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
  assert.equal(result.snapshot.taskLedger[0].workflowStep, "create-research-note-draft");
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

test("upsertPromptOverrideTransaction replaces one prompt override without mutating source snapshot", () => {
  const snapshot = {
    schemaVersion: 1,
    exportedAt: "old",
    promptOverrides: [{ templateId: "single-paper-chinese-summary", template: "old" }],
    taskLedger: []
  };

  const result = upsertPromptOverrideTransaction({
    snapshot,
    overrideInput: { templateId: "single-paper-chinese-summary", template: "new {{itemTitle}}" },
    updatedAt: "2026-05-21T00:04:30.000Z"
  });

  assert.equal(result.status, "prompt-override-upserted");
  assert.equal(result.templateId, "single-paper-chinese-summary");
  assert.equal(result.snapshot.exportedAt, "2026-05-21T00:04:30.000Z");
  assert.deepEqual(snapshot.promptOverrides, [{ templateId: "single-paper-chinese-summary", template: "old" }]);
  assert.deepEqual(result.snapshot.promptOverrides, [
    { templateId: "single-paper-chinese-summary", template: "new {{itemTitle}}" }
  ]);
});

test("upsertPromptOverrideTransaction rejects unsafe prompt variables at the transaction boundary", () => {
  assert.throws(
    () =>
      upsertPromptOverrideTransaction({
        snapshot: { schemaVersion: 1, exportedAt: "old", promptOverrides: [] },
        overrideInput: {
          templateId: "single-paper-chinese-summary",
          template: "泄露 {{apiKey}}"
        },
        updatedAt: "2026-05-21T00:04:35.000Z"
      }),
    /apiKey is not allowed/
  );
});

test("removePromptOverrideTransaction removes one prompt override without touching other overrides", () => {
  const result = removePromptOverrideTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      promptOverrides: [
        { templateId: "single-paper-chinese-summary", template: "summary" },
        { templateId: "reading-context-chinese-translation", template: "translation" }
      ]
    },
    templateId: "single-paper-chinese-summary",
    updatedAt: "2026-05-21T00:04:45.000Z"
  });

  assert.equal(result.status, "prompt-override-removed");
  assert.equal(result.snapshot.exportedAt, "2026-05-21T00:04:45.000Z");
  assert.deepEqual(result.snapshot.promptOverrides, [
    { templateId: "reading-context-chinese-translation", template: "translation" }
  ]);
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
