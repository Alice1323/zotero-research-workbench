const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  createResearchPanelOrchestrator
} = require("../src/core/researchPanelOrchestrator");
const core = require("../src/core");

const root = path.resolve(__dirname, "..");

function createSnapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    exportedAt: "old",
    providers: [],
    promptTemplates: [],
    promptOverrides: [],
    providerProvenance: [],
    researchNoteDrafts: [],
    graphSeeds: [],
    citationRelations: [],
    taskLedger: [],
    ...overrides
  };
}

test("core index exports research panel orchestrator module", () => {
  assert.equal(typeof core.WorkbenchResearchPanelOrchestrator.createResearchPanelOrchestrator, "function");
});

test("createSummaryDraftWorkflow creates a local draft and read model in one panel result", () => {
  const orchestrator = createResearchPanelOrchestrator();
  const source = createSnapshot();

  const result = orchestrator.createSummaryDraftWorkflow({
    snapshot: source,
    paper: {
      key: "ITEM1",
      title: "Metformin and gut microbiota in PCOS",
      authors: "Li Wang",
      year: "2026",
      publicationTitle: "Journal of Endocrine Research",
      abstractNote: "abstract",
      doi: "10.1000/pcos.2026"
    },
    summary: "结构化中文总结",
    model: "model-a",
    createdAt: "2026-05-21T01:00:00.000Z",
    selectedWorkId: "work:doi:10.1000/pcos.2026"
  });

  assert.equal(result.status, "summaryDraftCreated");
  assert.equal(result.draft.confirmationState, "draft");
  assert.equal(result.draft.promptTaskTemplateId, "single-paper-chinese-summary");
  assert.equal(result.snapshot.researchNoteDrafts.length, 1);
  assert.equal(result.snapshot.taskLedger[0].workflowStep, "create-research-note-draft");
  assert.equal(result.records.recentDrafts.length, 1);
  assert.equal(result.records.graphReview.counts.workIdentities, 1);
  assert.equal(source.researchNoteDrafts.length, 0);
});

test("createReadingTranslationDraftWorkflow preserves reader context and provenance", () => {
  const orchestrator = createResearchPanelOrchestrator();

  const result = orchestrator.createReadingTranslationDraftWorkflow({
    snapshot: createSnapshot(),
    paper: { key: "ITEM2", title: "Reader Paper", creators: [] },
    context: {
      itemKey: "ITEM2",
      text: "Selected source text",
      source: "reader-selection",
      pageLabel: "p. 8"
    },
    translation: "中文翻译",
    model: "model-b",
    createdAt: "2026-05-21T01:05:00.000Z"
  });

  assert.equal(result.status, "readingTranslationDraftCreated");
  assert.equal(result.draft.promptTaskTemplateId, "reading-context-chinese-translation");
  assert.equal(result.draft.inputContext.selectedText, "Selected source text");
  assert.equal(result.draft.inputContext.pageLabel, "p. 8");
  assert.equal(result.snapshot.taskLedger[0].providerId, "model-b");
});

test("confirmDraftSavedToZoteroWorkflow confirms a draft after the Zotero note write", () => {
  const orchestrator = createResearchPanelOrchestrator();
  const draftResult = orchestrator.createSummaryDraftWorkflow({
    snapshot: createSnapshot(),
    paper: { key: "ITEM3", title: "Draft Paper", creators: [] },
    summary: "summary",
    model: "model-c",
    createdAt: "2026-05-21T01:10:00.000Z"
  });

  const noteWrite = orchestrator.prepareZoteroNoteWrite({
    draft: draftResult.draft,
    savedAt: "2026-05-21T01:15:00.000Z"
  });
  const confirmed = orchestrator.confirmDraftSavedToZoteroWorkflow({
    snapshot: draftResult.snapshot,
    draftId: draftResult.draft.id,
    zoteroNoteKey: "NOTE123",
    savedAt: noteWrite.savedAt
  });

  assert.match(noteWrite.html, /Draft Paper/);
  assert.equal(confirmed.status, "draftConfirmed");
  assert.equal(confirmed.draft.confirmationState, "confirmed");
  assert.equal(confirmed.draft.confirmedZoteroNoteKey, "NOTE123");
  assert.equal(confirmed.snapshot.taskLedger.at(-1).workflowStep, "save-to-zotero-note");
});

test("graph review actions return updated records for panel refresh", () => {
  const orchestrator = createResearchPanelOrchestrator();
  const snapshot = createSnapshot({
    graphSeeds: [
      {
        id: "seed-1",
        workId: "work:zotero:ITEM4",
        source: { title: "Source Paper" },
        target: { title: "Target Paper" },
        relationType: "extends",
        evidence: { text: "evidence" },
        providerId: "model-d",
        confidence: "high",
        seedKind: "user-confirmed",
        reviewState: "pending",
        createdAt: "2026-05-21T01:20:00.000Z"
      }
    ]
  });

  const reviewed = orchestrator.reviewGraphSeedWorkflow({
    snapshot,
    seedId: "seed-1",
    reviewState: "confirmed",
    reviewedAt: "2026-05-21T01:25:00.000Z",
    filters: { graphSeedReview: { reviewState: "confirmed" } }
  });
  const promoted = orchestrator.promoteGraphSeedWorkflow({
    snapshot: reviewed.snapshot,
    seedId: "seed-1",
    promotedAt: "2026-05-21T01:30:00.000Z"
  });

  assert.equal(reviewed.status, "reviewed");
  assert.equal(reviewed.records.graphReview.graphSeedReviewQueue[0].reviewState, "confirmed");
  assert.equal(promoted.status, "promoted");
  assert.equal(promoted.records.graphReview.counts.citationRelations, 1);
  assert.equal(promoted.records.recentGraphSeeds[0].id, "seed-1");
});

test("research panel orchestrator browser script registers a factory without global collisions", () => {
  const context = {
    console,
    window: {}
  };
  context.globalThis = context;
  vm.createContext(context);

  for (const fileName of [
    "workbenchLocalStoreTransaction.js",
    "graphSeed.js",
    "workIdentity.js",
    "graphReviewWorkflow.js",
    "researchPanelOrchestrator.js"
  ]) {
    const source = fs.readFileSync(path.join(root, "src/core", fileName), "utf8");
    vm.runInContext(source, context, { filename: fileName });
  }

  assert.equal(typeof context.window.WorkbenchResearchPanelOrchestrator.createResearchPanelOrchestrator, "function");
  const orchestrator = context.window.WorkbenchResearchPanelOrchestrator.createResearchPanelOrchestrator({
    paperSummaryModule: {
      buildZoteroNoteHtml: () => "<p>note</p>",
      createReadingTranslationDraftInput: ({ createdAt }) => ({
        id: "draft-reading",
        title: "Reading",
        content: "translation",
        promptTaskTemplateId: "reading-context-chinese-translation",
        createdAt
      }),
      createSummaryDraftInput: ({ createdAt }) => ({
        id: "draft-summary",
        title: "Summary",
        content: "summary",
        promptTaskTemplateId: "single-paper-chinese-summary",
        createdAt
      }),
      listRecentGraphSeeds: (snapshot) => snapshot.graphSeeds || [],
      listRecentSummaryDrafts: (snapshot) => snapshot.researchNoteDrafts || [],
      listRecentTaskLedger: (snapshot) => snapshot.taskLedger || []
    }
  });
  const result = orchestrator.createSummaryDraftWorkflow({
    snapshot: createSnapshot(),
    createdAt: "2026-05-21T01:35:00.000Z"
  });

  assert.equal(result.status, "summaryDraftCreated");
  assert.equal(result.records.recentDrafts.length, 1);
});
