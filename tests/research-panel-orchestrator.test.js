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

test("ai task workspace workflows create confirm and record a current-selection job", () => {
  const orchestrator = createResearchPanelOrchestrator();
  const snapshot = createSnapshot();

  const draft = orchestrator.createAiTaskWorkspacePlanWorkflow({
    snapshot,
    requestText: "请总结当前选中的文献",
    selectedPapers: [
      {
        key: "ITEM1",
        title: "Task Paper",
        authors: "Li Wang",
        year: "2026",
        publicationTitle: "Journal",
        abstractNote: "abstract",
        doi: "10.1000/task"
      }
    ],
    provider: { id: "provider", model: "model" },
    concurrencyLimit: 1,
    createdAt: "2026-05-22T04:00:00.000Z"
  });

  assert.equal(draft.status, "aiJobPlanCreated");
  assert.equal(draft.plan.job.state, "draft");
  assert.equal(draft.snapshot.aiJobs.length, 1);
  assert.equal(draft.records.aiTaskWorkspace.activeJob.id, draft.plan.job.id);

  const confirmed = orchestrator.confirmAiTaskWorkspacePlanWorkflow({
    snapshot: draft.snapshot,
    jobId: draft.plan.job.id,
    confirmedAt: "2026-05-22T04:01:00.000Z"
  });

  assert.equal(confirmed.status, "aiJobConfirmed");
  assert.equal(confirmed.snapshot.aiJobs[0].state, "confirmed");

  const recorded = orchestrator.recordAiTaskWorkspaceQueueResultWorkflow({
    snapshot: confirmed.snapshot,
    queueResult: {
      job: { ...confirmed.snapshot.aiJobs[0], state: "completed" },
      tasks: [{ ...confirmed.snapshot.aiTasks[0], state: "succeeded" }],
      results: [{ jobId: draft.plan.job.id, taskId: confirmed.snapshot.aiTasks[0].id, content: "summary" }],
      failures: [],
      skips: [],
      diagnoses: []
    },
    recordedAt: "2026-05-22T04:02:00.000Z"
  });

  assert.equal(recorded.status, "aiTaskQueueRecorded");
  assert.equal(recorded.records.aiTaskWorkspace.activeJob.state, "completed");
  assert.equal(recorded.records.aiTaskWorkspace.progress.succeeded, 1);
});

test("ai task workspace recording creates a commonality note draft for multi-paper synthesis", () => {
  const orchestrator = createResearchPanelOrchestrator();
  const draft = orchestrator.createAiTaskWorkspacePlanWorkflow({
    snapshot: createSnapshot(),
    requestText: "请找出这些文献的共同点",
    selectedPapers: [
      {
        key: "ITEM1",
        title: "Task Paper A",
        authors: "Li Wang",
        year: "2026",
        publicationTitle: "Journal",
        abstractNote: "abstract a",
        doi: "10.1000/a"
      },
      {
        key: "ITEM2",
        title: "Task Paper B",
        authors: "Mei Chen",
        year: "2025",
        publicationTitle: "Journal",
        abstractNote: "abstract b",
        doi: "10.1000/b"
      }
    ],
    provider: { id: "provider", model: "model" },
    concurrencyLimit: 2,
    createdAt: "2026-05-22T04:10:00.000Z"
  });
  const confirmed = orchestrator.confirmAiTaskWorkspacePlanWorkflow({
    snapshot: draft.snapshot,
    jobId: draft.plan.job.id,
    confirmedAt: "2026-05-22T04:11:00.000Z"
  });
  const task = confirmed.snapshot.aiTasks[0];

  const recorded = orchestrator.recordAiTaskWorkspaceQueueResultWorkflow({
    snapshot: confirmed.snapshot,
    queueResult: {
      job: { ...confirmed.snapshot.aiJobs[0], state: "completed" },
      tasks: [{ ...task, state: "succeeded" }],
      results: [
        {
          jobId: draft.plan.job.id,
          taskId: task.id,
          taskType: "multi-paper-commonality-note",
          promptTemplateId: "multi-paper-commonality-note",
          model: "model",
          title: "共同点笔记：两篇任务论文",
          content: "共同点正文"
        }
      ],
      failures: [],
      skips: [],
      diagnoses: []
    },
    recordedAt: "2026-05-22T04:12:00.000Z"
  });

  assert.equal(recorded.status, "aiTaskQueueRecorded");
  assert.equal(recorded.createdDraftIds.length, 1);
  assert.equal(recorded.snapshot.researchNoteDrafts[0].promptTaskTemplateId, "multi-paper-commonality-note");
  assert.equal(recorded.snapshot.researchNoteDrafts[0].content, "共同点正文");
  assert.equal(recorded.snapshot.researchNoteDrafts[0].inputContext.selectedPapers.length, 2);
  assert.equal(recorded.records.recentDrafts[0].id, recorded.snapshot.researchNoteDrafts[0].id);
});

test("ai task workspace plan workflow accepts an explicit task classification", () => {
  const orchestrator = createResearchPanelOrchestrator();
  const draft = orchestrator.createAiTaskWorkspacePlanWorkflow({
    snapshot: createSnapshot(),
    requestText: "请总结这些文献",
    selectedPapers: [
      { key: "ITEM1", title: "Task Paper A", abstractNote: "abstract a" },
      { key: "ITEM2", title: "Task Paper B", abstractNote: "abstract b" }
    ],
    taskClassification: {
      taskMode: "per-paper-summary",
      source: "llm-classifier",
      confidence: 0.81,
      reason: "用户想要总结，未要求共同点"
    },
    provider: { id: "provider", model: "model" },
    concurrencyLimit: 2,
    createdAt: "2026-05-22T04:20:00.000Z"
  });

  assert.equal(draft.status, "aiJobPlanCreated");
  assert.equal(draft.plan.job.taskMode, "per-paper-summary");
  assert.equal(draft.plan.job.taskClassification.source, "llm-classifier");
  assert.equal(draft.plan.tasks.length, 2);
  assert.match(draft.plan.confirmation.summary, /AI 识别/);
});

test("research panel orchestrator browser script registers a factory without global collisions", () => {
  const context = {
    console,
    window: {}
  };
  context.globalThis = context;
  vm.createContext(context);

  for (const fileName of [
    "providerRequestPolicy.js",
    "aiTaskWorkspace.js",
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
