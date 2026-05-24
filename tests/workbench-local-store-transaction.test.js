const test = require("node:test");
const assert = require("node:assert/strict");

const {
  captureGraphSeedTransaction,
  confirmAiJobPlanTransaction,
  confirmResearchNoteDraftSavedToZoteroTransaction,
  createAiJobPlanTransaction,
  createLiteratureDiscoveryPlanTransaction,
  createZoteroImportPlanTransaction,
  createZoteroWriteQueueTransaction,
  createResearchNoteDraftTransaction,
  markDocumentCandidateReviewedTransaction,
  markRunningAiJobsForManualResumeTransaction,
  removePromptOverrideTransaction,
  promoteGraphSeedTransaction,
  recordAiTaskQueueResultTransaction,
  recordAiTaskQueueResultWithDraftsTransaction,
  recordLiteratureDiscoveryCandidatesTransaction,
  recordZoteroWriteQueueResultTransaction,
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

test("createAiJobPlanTransaction stores draft job plan and task records", () => {
  const result = createAiJobPlanTransaction({
    snapshot: { schemaVersion: 1, exportedAt: "old", aiJobs: [], aiTasks: [], taskLedger: [] },
    plan: {
      job: { id: "job-1", state: "draft", requestText: "summarize" },
      tasks: [{ id: "task-1", jobId: "job-1", state: "queued" }]
    },
    createdAt: "2026-05-22T03:00:00.000Z"
  });

  assert.equal(result.status, "ai-job-plan-created");
  assert.equal(result.snapshot.aiJobs.length, 1);
  assert.equal(result.snapshot.aiTasks.length, 1);
  assert.equal(result.snapshot.taskLedger.at(-1).workflowStep, "create-ai-job-plan");
});

test("confirmAiJobPlanTransaction marks draft job confirmed", () => {
  const result = confirmAiJobPlanTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      aiJobs: [{ id: "job-1", state: "draft" }],
      aiTasks: [{ id: "task-1", jobId: "job-1", state: "queued" }],
      taskLedger: []
    },
    jobId: "job-1",
    confirmedAt: "2026-05-22T03:01:00.000Z"
  });

  assert.equal(result.status, "ai-job-confirmed");
  assert.equal(result.snapshot.aiJobs[0].state, "confirmed");
  assert.equal(result.snapshot.aiJobs[0].confirmedAt, "2026-05-22T03:01:00.000Z");
  assert.equal(result.snapshot.taskLedger.at(-1).workflowStep, "confirm-ai-job-plan");
});

test("recordAiTaskQueueResultTransaction stores results failures skips and diagnosis", () => {
  const result = recordAiTaskQueueResultTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      aiJobs: [{ id: "job-1", state: "confirmed" }],
      aiTasks: [{ id: "task-1", jobId: "job-1", state: "queued" }],
      aiTaskResults: [],
      aiTaskFailures: [],
      aiTaskSkips: [],
      aiJobDiagnoses: [],
      taskLedger: []
    },
    queueResult: {
      job: { id: "job-1", state: "completed-with-skips" },
      tasks: [{ id: "task-1", jobId: "job-1", state: "skipped" }],
      results: [],
      failures: [{ taskId: "task-1", jobId: "job-1", errorReason: "missing text" }],
      skips: [{ taskId: "task-1", jobId: "job-1", reason: "missing text" }],
      diagnoses: [{ id: "diagnosis-1", jobId: "job-1", reason: "task-failure-threshold" }]
    },
    recordedAt: "2026-05-22T03:02:00.000Z"
  });

  assert.equal(result.status, "ai-task-queue-recorded");
  assert.equal(result.snapshot.aiJobs[0].state, "completed-with-skips");
  assert.equal(result.snapshot.aiTasks[0].state, "skipped");
  assert.equal(result.snapshot.aiTaskFailures.length, 1);
  assert.equal(result.snapshot.aiTaskSkips.length, 1);
  assert.equal(result.snapshot.aiJobDiagnoses.length, 1);
  assert.equal(result.snapshot.taskLedger.at(-1).workflowStep, "run-ai-task-queue");
});

test("recordAiTaskQueueResultWithDraftsTransaction creates a standalone commonality note draft", () => {
  const result = recordAiTaskQueueResultWithDraftsTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      researchNoteDrafts: [],
      aiJobs: [{ id: "job-common", state: "confirmed" }],
      aiTasks: [{ id: "task-common", jobId: "job-common", state: "queued" }],
      aiTaskResults: [],
      aiTaskFailures: [],
      aiTaskSkips: [],
      aiJobDiagnoses: [],
      taskLedger: []
    },
    queueResult: {
      job: { id: "job-common", state: "completed", provider: { id: "provider", model: "model-a" } },
      tasks: [
        {
          id: "task-common",
          jobId: "job-common",
          taskType: "multi-paper-commonality-note",
          state: "succeeded",
          promptTemplateId: "multi-paper-commonality-note",
          model: "model-a",
          inputScope: {
            requestText: "找共同点",
            selectedPapers: [
              { zoteroItemKey: "ITEM1", title: "Paper A", doi: "10.1000/a" },
              { zoteroItemKey: "ITEM2", title: "Paper B", doi: "10.1000/b" }
            ]
          }
        }
      ],
      results: [
        {
          jobId: "job-common",
          taskId: "task-common",
          taskType: "multi-paper-commonality-note",
          promptTemplateId: "multi-paper-commonality-note",
          model: "model-a",
          title: "共同点笔记：代谢与炎症",
          content: "这些文献共同讨论代谢异常与炎症机制。"
        }
      ],
      failures: [],
      skips: [],
      diagnoses: []
    },
    recordedAt: "2026-05-22T03:02:30.000Z"
  });

  assert.equal(result.status, "ai-task-queue-recorded");
  assert.equal(result.createdDraftIds.length, 1);
  assert.equal(result.snapshot.researchNoteDrafts.length, 1);
  assert.equal(result.snapshot.researchNoteDrafts[0].id, "draft-job-common-task-common-commonality-note");
  assert.equal(result.snapshot.researchNoteDrafts[0].title, "共同点笔记：代谢与炎症");
  assert.equal(result.snapshot.researchNoteDrafts[0].promptTaskTemplateId, "multi-paper-commonality-note");
  assert.equal(result.snapshot.researchNoteDrafts[0].confirmationState, "draft");
  assert.equal(result.snapshot.researchNoteDrafts[0].inputContext.selectedPapers.length, 2);
  assert.equal(result.snapshot.researchNoteDrafts[0].provenance.writeTarget, "local-draft-only");
  assert.equal(result.snapshot.taskLedger.at(-2).workflowStep, "run-ai-task-queue");
  assert.equal(result.snapshot.taskLedger.at(-1).workflowStep, "create-research-note-draft");
});

test("markRunningAiJobsForManualResumeTransaction pauses interrupted jobs without auto resume", () => {
  const result = markRunningAiJobsForManualResumeTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      aiJobs: [
        { id: "job-1", state: "running", resumeRequired: false },
        { id: "job-2", state: "completed", resumeRequired: false }
      ],
      aiTasks: [
        { id: "task-1", jobId: "job-1", state: "running" },
        { id: "task-2", jobId: "job-2", state: "succeeded" }
      ],
      taskLedger: []
    },
    interruptedAt: "2026-05-22T03:03:00.000Z"
  });

  assert.equal(result.status, "ai-jobs-marked-for-manual-resume");
  assert.equal(result.snapshot.aiJobs[0].state, "paused");
  assert.equal(result.snapshot.aiJobs[0].resumeRequired, true);
  assert.equal(result.snapshot.aiTasks[0].state, "queued");
  assert.equal(result.snapshot.aiJobs[1].state, "completed");
});

test("markDocumentCandidateReviewedTransaction updates candidate review state and task ledger", () => {
  const result = markDocumentCandidateReviewedTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      documentCandidates: [{ id: "candidate-a", reviewState: "needs-review" }],
      taskLedger: []
    },
    candidateId: "candidate-a",
    reviewDecision: "confirmed",
    reviewNote: "人工确认可导入",
    reviewedAt: "2026-05-23T12:00:00.000Z"
  });

  assert.equal(result.status, "document-candidate-reviewed");
  assert.equal(result.snapshot.documentCandidates[0].reviewState, "confirmed");
  assert.equal(result.snapshot.documentCandidates[0].reviewedBy, "user");
  assert.equal(result.snapshot.taskLedger.at(-1).workflowStep, "review-document-candidate");
});

test("recordLiteratureDiscoveryCandidatesTransaction compacts raw source payloads before snapshot persistence", () => {
  const hugeAbstractIndex = Array.from({ length: 120 }, (_entry, index) => ({
    section: `section-${index}`,
    text: "large third-party payload ".repeat(80)
  }));
  const result = recordLiteratureDiscoveryCandidatesTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      researchTopics: [{ id: "topic-a", title: "Topic", linkedCandidateIds: [] }],
      documentCandidates: [],
      taskLedger: []
    },
    jobId: "literature-discovery-job-a",
    topicId: "topic-a",
    candidates: [
      {
        id: "candidate-a",
        title: "Candidate A",
        doi: "10.1000/a",
        rawSourcePayload: {
          openalex: {
            id: "https://openalex.org/W123",
            doi: "https://doi.org/10.1000/a",
            abstract_inverted_index: hugeAbstractIndex,
            nested: { repeated: "payload".repeat(20_000) }
          }
        }
      }
    ],
    recordedAt: "2026-05-25T00:50:00.000Z"
  });

  const candidate = result.snapshot.documentCandidates[0];
  const payloadText = JSON.stringify(candidate.rawSourcePayload);
  assert.ok(payloadText.length < 2000);
  assert.equal(candidate.rawSourcePayload.openalex.sourceRecordId, "https://openalex.org/W123");
  assert.equal(candidate.rawSourcePayload.openalex.doi, "https://doi.org/10.1000/a");
  assert.equal(candidate.rawSourcePayload.openalex.payloadCompacted, true);
  assert.equal(candidate.rawSourcePayload.openalex.originalPayloadBytes > 20000, true);
  assert.equal(candidate.rawSourcePayload.openalex.nested, undefined);
  assert.equal(candidate.rawSourcePayload.openalex.abstract_inverted_index, undefined);
});

test("createLiteratureDiscoveryPlanTransaction compacts existing candidate payloads while normalizing snapshots", () => {
  const result = createLiteratureDiscoveryPlanTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      researchTopics: [{ id: "topic-a", title: "Topic" }],
      documentCandidates: [
        {
          id: "candidate-existing",
          title: "Existing Candidate",
          rawSourcePayload: {
            crossref: {
              DOI: "10.1000/existing",
              URL: "https://doi.org/10.1000/existing",
              reference: Array.from({ length: 300 }, (_entry, index) => ({
                DOI: `10.1000/ref-${index}`,
                articleTitle: "reference payload ".repeat(80)
              }))
            }
          }
        }
      ],
      taskLedger: []
    },
    plan: {
      job: { id: "literature-discovery-job-a", topicId: "topic-a", state: "draft", sources: ["openalex"] }
    },
    createdAt: "2026-05-25T00:51:00.000Z"
  });

  const candidate = result.snapshot.documentCandidates[0];
  assert.ok(JSON.stringify(candidate.rawSourcePayload).length < 2000);
  assert.equal(candidate.rawSourcePayload.crossref.sourceRecordId, "10.1000/existing");
  assert.equal(candidate.rawSourcePayload.crossref.sourceUrl, "https://doi.org/10.1000/existing");
  assert.equal(candidate.rawSourcePayload.crossref.payloadCompacted, true);
  assert.equal(candidate.rawSourcePayload.crossref.reference, undefined);
});

test("createZoteroImportPlanTransaction stores plan and links it to the topic", () => {
  const result = createZoteroImportPlanTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      researchTopics: [{ id: "topic-a", title: "Topic", linkedImportPlanIds: [] }],
      zoteroImportPlans: [],
      taskLedger: []
    },
    importPlan: {
      id: "zotero-import-plan-a",
      topicId: "topic-a",
      candidateIds: ["candidate-a"],
      writeIntents: [{ id: "write-intent-candidate-a-item" }]
    },
    createdAt: "2026-05-23T12:05:00.000Z"
  });

  assert.equal(result.status, "zotero-import-plan-created");
  assert.equal(result.snapshot.zoteroImportPlans[0].id, "zotero-import-plan-a");
  assert.deepEqual(result.snapshot.researchTopics[0].linkedImportPlanIds, ["zotero-import-plan-a"]);
  assert.equal(result.snapshot.taskLedger.at(-1).workflowStep, "create-zotero-import-plan");
});

test("createZoteroWriteQueueTransaction stores queue and links it to the topic", () => {
  const result = createZoteroWriteQueueTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      researchTopics: [{ id: "topic-a", title: "Topic", linkedWriteQueueIds: [] }],
      zoteroWriteQueues: [],
      taskLedger: []
    },
    queue: {
      id: "zotero-write-queue-plan-a",
      importPlanId: "plan-a",
      topicId: "topic-a",
      entries: [{ id: "item-a", state: "queued" }]
    },
    createdAt: "2026-05-23T12:06:00.000Z"
  });

  assert.equal(result.status, "zotero-write-queue-created");
  assert.equal(result.snapshot.zoteroWriteQueues[0].id, "zotero-write-queue-plan-a");
  assert.deepEqual(result.snapshot.researchTopics[0].linkedWriteQueueIds, ["zotero-write-queue-plan-a"]);
  assert.equal(result.snapshot.taskLedger.at(-1).workflowStep, "create-zotero-write-queue");
});

test("recordZoteroWriteQueueResultTransaction stores queue progress and write results", () => {
  const result = recordZoteroWriteQueueResultTransaction({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "old",
      researchTopics: [{ id: "topic-a", title: "Topic", linkedWriteQueueIds: ["queue-a"] }],
      zoteroWriteQueues: [{ id: "queue-a", state: "running", entries: [] }],
      zoteroWriteResults: [],
      taskLedger: []
    },
    queue: {
      id: "queue-a",
      importPlanId: "plan-a",
      topicId: "topic-a",
      state: "completed",
      entries: [{ id: "item-a", state: "succeeded" }]
    },
    result: {
      id: "write-result-item-a",
      queueId: "queue-a",
      entryId: "item-a",
      state: "succeeded",
      zoteroItemKey: "ITEMKEY"
    },
    recordedAt: "2026-05-23T12:07:00.000Z"
  });

  assert.equal(result.status, "zotero-write-queue-result-recorded");
  assert.equal(result.snapshot.zoteroWriteQueues[0].state, "completed");
  assert.equal(result.snapshot.zoteroWriteResults[0].zoteroItemKey, "ITEMKEY");
  assert.equal(result.snapshot.taskLedger.at(-1).workflowStep, "record-zotero-write-queue-result");
});
