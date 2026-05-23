const SAFE_PROMPT_TEMPLATE_VARIABLES = new Set([
  "selectedText",
  "itemTitle",
  "itemAuthors",
  "abstract",
  "year",
  "publicationTitle",
  "doi",
  "source",
  "pageLabel",
  "noteContent",
  "pdfPageText",
  "graphSeedsSummary",
  "paperCandidatesSummary",
  "userQuery"
]);

function createResearchNoteDraftTransaction({ snapshot, draftInput, createdAt } = {}) {
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  const draft = normalizeDraftInput(draftInput);
  const next = normalizeTransactionSnapshot(snapshot);
  next.researchNoteDrafts.push({
    ...draft,
    confirmationState: cleanText(draft.confirmationState) || "draft"
  });
  next.taskLedger.push({
    id: `task-${draft.id}`,
    workflowStep: "create-research-note-draft",
    state: "completed",
    providerId: cleanText(draft.llmProviderId) || null,
    promptTaskTemplateId: cleanText(draft.promptTaskTemplateId) || null,
    outputLocation: { draftId: draft.id },
    errorNotice: null,
    startedAt: timestamp,
    completedAt: timestamp,
    provenance: {
      source: cleanText(draft.provenance?.source) || "workbench-transaction",
      writeTarget: "local-draft-only"
    }
  });
  next.exportedAt = timestamp;
  return {
    status: "draft-created",
    draftId: draft.id,
    snapshot: next
  };
}

function confirmResearchNoteDraftSavedToZoteroTransaction({
  snapshot,
  draftId,
  zoteroNoteKey,
  savedAt
} = {}) {
  const timestamp = cleanText(savedAt) || new Date().toISOString();
  const normalizedDraftId = cleanText(draftId);
  const next = normalizeTransactionSnapshot(snapshot);
  const draft = next.researchNoteDrafts.find((entry) => cleanText(entry?.id) === normalizedDraftId);
  if (!draft) {
    throw new Error(`草稿不存在：${normalizedDraftId}`);
  }

  draft.confirmationState = "confirmed";
  draft.confirmedZoteroNoteKey = cleanText(zoteroNoteKey);
  draft.confirmedAt = timestamp;
  draft.provenance = {
    ...(draft.provenance || {}),
    writeTarget: "zotero-note"
  };
  next.taskLedger.push({
    id: `task-${draft.id}-save-to-zotero-note`,
    workflowStep: "save-to-zotero-note",
    state: "completed",
    providerId: cleanText(draft.llmProviderId) || null,
    promptTaskTemplateId: cleanText(draft.promptTaskTemplateId) || null,
    outputLocation: { draftId: draft.id, zoteroNoteKey: cleanText(zoteroNoteKey) },
    errorNotice: null,
    startedAt: timestamp,
    completedAt: timestamp,
    provenance: {
      source: "explicit-user-action",
      writeTarget: "zotero-note"
    }
  });
  next.exportedAt = timestamp;
  return {
    status: "draft-confirmed",
    draftId: normalizedDraftId,
    zoteroNoteKey: cleanText(zoteroNoteKey),
    snapshot: next
  };
}

function captureGraphSeedTransaction({ snapshot, seedInput, createdAt } = {}) {
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  const seed = clonePlain(seedInput);
  if (!cleanText(seed.id)) {
    throw new Error("图谱种子 id 不能为空");
  }
  const next = normalizeTransactionSnapshot(snapshot);
  next.graphSeeds.push(seed);
  next.taskLedger.push({
    id: `task-${seed.id}-capture-graph-seed`,
    workflowStep: "capture-graph-seed",
    state: "completed",
    providerId: cleanText(seed.providerId) || null,
    promptTaskTemplateId: null,
    outputLocation: { graphSeedId: seed.id },
    errorNotice: null,
    startedAt: timestamp,
    completedAt: timestamp,
    provenance: {
      source: "explicit-user-action",
      writeTarget: "local-snapshot-only"
    }
  });
  next.exportedAt = timestamp;
  return {
    status: "graph-seed-captured",
    graphSeedId: cleanText(seedInput?.id),
    snapshot: next
  };
}

function reviewGraphSeedTransaction({ snapshot, seedId, reviewState, reviewedAt, reviewNote } = {}) {
  const timestamp = cleanText(reviewedAt) || new Date().toISOString();
  const normalizedSeedId = cleanText(seedId);
  const normalizedReviewState = normalizeReviewState(reviewState);
  const next = normalizeTransactionSnapshot(snapshot);
  const seedIndex = next.graphSeeds.findIndex((seed) => cleanText(seed?.id) === normalizedSeedId);
  if (seedIndex < 0) {
    throw new Error("未找到图谱种子");
  }

  next.graphSeeds[seedIndex] = {
    ...next.graphSeeds[seedIndex],
    reviewState: normalizedReviewState,
    reviewedAt: timestamp,
    reviewedBy: "user",
    reviewNote: cleanText(reviewNote)
  };
  next.taskLedger.push({
    id: `task-${normalizedSeedId}-review-graph-seed-${createStableTimestamp(timestamp)}`,
    workflowStep: "review-graph-seed",
    state: "completed",
    providerId: cleanText(next.graphSeeds[seedIndex].providerId) || null,
    promptTaskTemplateId: null,
    outputLocation: { graphSeedId: normalizedSeedId, reviewState: normalizedReviewState },
    errorNotice: null,
    startedAt: timestamp,
    completedAt: timestamp,
    provenance: {
      source: "explicit-user-action",
      writeTarget: "local-snapshot-only"
    }
  });
  next.exportedAt = timestamp;
  return {
    status: "graph-seed-reviewed",
    graphSeedId: normalizedSeedId,
    reviewState: normalizedReviewState,
    snapshot: next
  };
}

function promoteGraphSeedTransaction({ snapshot, seedId, promotedAt } = {}) {
  const timestamp = cleanText(promotedAt) || new Date().toISOString();
  const before = normalizeTransactionSnapshot(snapshot);
  const beforeCount = before.citationRelations.length;
  const normalizedSeedId = cleanText(seedId);
  const seedIndex = before.graphSeeds.findIndex((seed) => cleanText(seed?.id) === normalizedSeedId);
  if (seedIndex < 0) {
    throw new Error("未找到图谱种子");
  }

  const seed = before.graphSeeds[seedIndex];
  if (normalizeReviewState(seed?.reviewState) !== "confirmed") {
    throw new Error("图谱种子尚未确认");
  }

  const relationId = cleanText(seed.promotedCitationRelationId) || `citation-relation-${normalizedSeedId}`;
  const existing = before.citationRelations.find((relation) => cleanText(relation?.id) === relationId);
  if (!existing) {
    before.citationRelations.push({
      id: relationId,
      sourceWorkId: cleanText(seed.workId),
      source: clonePlain(seed.source),
      relationType: cleanText(seed.relationType) || "related",
      target: clonePlain(seed.target),
      evidence: clonePlain(seed.evidence),
      confidence: cleanText(seed.confidence) || "low",
      graphSeedId: normalizedSeedId,
      createdAt: timestamp,
      provenance: {
        source: "confirmed-graph-seed",
        writeTarget: "local-snapshot-only"
      }
    });
    before.graphSeeds[seedIndex] = {
      ...seed,
      promotedCitationRelationId: relationId,
      promotedAt: timestamp
    };
    before.taskLedger.push({
      id: `task-${normalizedSeedId}-promote-graph-seed-to-citation-relation-${createStableTimestamp(timestamp)}`,
      workflowStep: "promote-graph-seed-to-citation-relation",
      state: "completed",
      providerId: cleanText(seed.providerId) || null,
      promptTaskTemplateId: null,
      outputLocation: { graphSeedId: normalizedSeedId, citationRelationId: relationId },
      errorNotice: null,
      startedAt: timestamp,
      completedAt: timestamp,
      provenance: {
        source: "explicit-user-action",
        writeTarget: "local-snapshot-only"
      }
    });
    before.exportedAt = timestamp;
  }

  const status = before.citationRelations.length === beforeCount ? "citation-relation-already-promoted" : "citation-relation-promoted";
  const relation = before.citationRelations.find((entry) => cleanText(entry?.id) === relationId);
  return {
    status,
    graphSeedId: normalizedSeedId,
    citationRelationId: cleanText(relation?.id),
    snapshot: before
  };
}

function upsertPromptOverrideTransaction({ snapshot, overrideInput, updatedAt } = {}) {
  const timestamp = cleanText(updatedAt) || new Date().toISOString();
  const override = normalizePromptOverrideInput(overrideInput);
  const next = normalizeTransactionSnapshot(snapshot);
  next.promptOverrides = next.promptOverrides.filter((entry) => cleanText(entry?.templateId) !== override.templateId);
  next.promptOverrides.push(override);
  next.exportedAt = timestamp;
  return {
    status: "prompt-override-upserted",
    templateId: override.templateId,
    snapshot: next
  };
}

function removePromptOverrideTransaction({ snapshot, templateId, updatedAt } = {}) {
  const timestamp = cleanText(updatedAt) || new Date().toISOString();
  const normalizedTemplateId = cleanText(templateId);
  if (!normalizedTemplateId) {
    throw new Error("提示词模板 id 不能为空");
  }
  const next = normalizeTransactionSnapshot(snapshot);
  next.promptOverrides = next.promptOverrides.filter((entry) => cleanText(entry?.templateId) !== normalizedTemplateId);
  next.exportedAt = timestamp;
  return {
    status: "prompt-override-removed",
    templateId: normalizedTemplateId,
    snapshot: next
  };
}

function replaceWorkbenchSnapshotFromImportTransaction({ snapshot, importedAt, sourceKind } = {}) {
  const timestamp = cleanText(importedAt) || new Date().toISOString();
  const next = normalizeTransactionSnapshot(snapshot);
  next.exportedAt = next.exportedAt || timestamp;
  return {
    status: "snapshot-replaced",
    sourceKind: cleanText(sourceKind) || "unknown",
    replacedAt: timestamp,
    snapshot: next
  };
}

function createAiJobPlanTransaction({ snapshot, plan, createdAt } = {}) {
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  const next = normalizeTransactionSnapshot(snapshot);
  const job = clonePlain(plan?.job);
  const tasks = Array.isArray(plan?.tasks) ? plan.tasks.map((task) => clonePlain(task)) : [];
  if (!cleanText(job.id)) {
    throw new Error("AI Job id 不能为空");
  }

  next.aiJobs = next.aiJobs.filter((entry) => cleanText(entry?.id) !== job.id);
  next.aiJobs.push(job);
  next.aiTasks = next.aiTasks.filter((entry) => cleanText(entry?.jobId) !== job.id);
  next.aiTasks.push(...tasks);
  next.taskLedger.push({
    id: `task-${job.id}-create-ai-job-plan`,
    workflowStep: "create-ai-job-plan",
    state: "completed",
    providerId: cleanText(job.provider?.id) || null,
    promptTaskTemplateId: null,
    outputLocation: { aiJobId: job.id },
    errorNotice: null,
    startedAt: timestamp,
    completedAt: timestamp,
    provenance: { source: "explicit-user-action", writeTarget: "local-snapshot-only" }
  });
  next.exportedAt = timestamp;
  return { status: "ai-job-plan-created", jobId: job.id, snapshot: next };
}

function confirmAiJobPlanTransaction({ snapshot, jobId, confirmedAt } = {}) {
  const timestamp = cleanText(confirmedAt) || new Date().toISOString();
  const normalizedJobId = cleanText(jobId);
  const next = normalizeTransactionSnapshot(snapshot);
  const job = next.aiJobs.find((entry) => cleanText(entry?.id) === normalizedJobId);
  if (!job) {
    throw new Error(`AI Job 不存在：${normalizedJobId}`);
  }

  job.state = "confirmed";
  job.confirmedAt = timestamp;
  job.resumeRequired = false;
  next.taskLedger.push({
    id: `task-${normalizedJobId}-confirm-ai-job-plan-${createStableTimestamp(timestamp)}`,
    workflowStep: "confirm-ai-job-plan",
    state: "completed",
    providerId: cleanText(job.provider?.id) || null,
    promptTaskTemplateId: null,
    outputLocation: { aiJobId: normalizedJobId },
    errorNotice: null,
    startedAt: timestamp,
    completedAt: timestamp,
    provenance: { source: "explicit-user-action", writeTarget: "local-snapshot-only" }
  });
  next.exportedAt = timestamp;
  return { status: "ai-job-confirmed", jobId: normalizedJobId, snapshot: next };
}

function recordAiTaskQueueResultTransaction({ snapshot, queueResult, recordedAt } = {}) {
  const timestamp = cleanText(recordedAt) || new Date().toISOString();
  const next = normalizeTransactionSnapshot(snapshot);
  const job = clonePlain(queueResult?.job);
  if (!cleanText(job.id)) {
    throw new Error("AI Job id 不能为空");
  }

  upsertRecordById(next.aiJobs, job);
  for (const task of Array.isArray(queueResult?.tasks) ? queueResult.tasks : []) {
    upsertRecordById(next.aiTasks, clonePlain(task));
  }
  next.aiTaskResults.push(...cloneArray(queueResult?.results));
  next.aiTaskFailures.push(...cloneArray(queueResult?.failures));
  next.aiTaskSkips.push(...cloneArray(queueResult?.skips));
  next.aiJobDiagnoses.push(...cloneArray(queueResult?.diagnoses));
  next.taskLedger.push({
    id: `task-${job.id}-run-ai-task-queue-${createStableTimestamp(timestamp)}`,
    workflowStep: "run-ai-task-queue",
    state: "completed",
    providerId: cleanText(job.provider?.id) || null,
    promptTaskTemplateId: null,
    outputLocation: {
      aiJobId: job.id,
      resultCount: cloneArray(queueResult?.results).length,
      failureCount: cloneArray(queueResult?.failures).length,
      skipCount: cloneArray(queueResult?.skips).length,
      diagnosisCount: cloneArray(queueResult?.diagnoses).length
    },
    errorNotice: null,
    startedAt: timestamp,
    completedAt: timestamp,
    provenance: { source: "ai-task-queue", writeTarget: "local-snapshot-only" }
  });
  next.exportedAt = timestamp;
  return { status: "ai-task-queue-recorded", jobId: job.id, snapshot: next };
}

function recordAiTaskQueueResultWithDraftsTransaction({ snapshot, queueResult, recordedAt } = {}) {
  const timestamp = cleanText(recordedAt) || new Date().toISOString();
  const recorded = recordAiTaskQueueResultTransaction({ snapshot, queueResult, recordedAt: timestamp });
  let next = recorded.snapshot;
  const createdDraftIds = [];
  for (const draftInput of createCommonalityDraftInputsFromQueueResult(queueResult, timestamp)) {
    if (next.researchNoteDrafts.some((draft) => cleanText(draft?.id) === draftInput.id)) {
      continue;
    }
    const draftResult = createResearchNoteDraftTransaction({
      snapshot: next,
      draftInput,
      createdAt: timestamp
    });
    next = draftResult.snapshot;
    createdDraftIds.push(draftResult.draftId);
  }

  return {
    ...recorded,
    createdDraftIds,
    snapshot: next
  };
}

function markRunningAiJobsForManualResumeTransaction({ snapshot, interruptedAt } = {}) {
  const timestamp = cleanText(interruptedAt) || new Date().toISOString();
  const next = normalizeTransactionSnapshot(snapshot);
  const affectedJobIds = new Set();
  for (const job of next.aiJobs) {
    if (cleanText(job?.state) === "running") {
      job.state = "paused";
      job.resumeRequired = true;
      job.interruptedAt = timestamp;
      affectedJobIds.add(cleanText(job.id));
    }
  }

  for (const task of next.aiTasks) {
    if (affectedJobIds.has(cleanText(task?.jobId)) && cleanText(task?.state) === "running") {
      task.state = "queued";
      task.resumeRequired = true;
    }
  }

  if (affectedJobIds.size) {
    next.taskLedger.push({
      id: `task-ai-jobs-manual-resume-${createStableTimestamp(timestamp)}`,
      workflowStep: "mark-ai-jobs-for-manual-resume",
      state: "completed",
      providerId: null,
      promptTaskTemplateId: null,
      outputLocation: { aiJobIds: [...affectedJobIds] },
      errorNotice: null,
      startedAt: timestamp,
      completedAt: timestamp,
      provenance: { source: "research-panel-restart", writeTarget: "local-snapshot-only" }
    });
  }
  next.exportedAt = timestamp;
  return {
    status: "ai-jobs-marked-for-manual-resume",
    jobIds: [...affectedJobIds],
    snapshot: next
  };
}

function createCommonalityDraftInputsFromQueueResult(queueResult, createdAt) {
  const job = clonePlain(queueResult?.job);
  const tasksById = new Map(
    (Array.isArray(queueResult?.tasks) ? queueResult.tasks : []).map((task) => [cleanText(task?.id), clonePlain(task)])
  );
  return (Array.isArray(queueResult?.results) ? queueResult.results : [])
    .filter((result) => isCommonalityTaskResult(result, tasksById.get(cleanText(result?.taskId))))
    .map((result) => {
      const task = tasksById.get(cleanText(result?.taskId)) || {};
      const taskId = cleanText(result?.taskId) || cleanText(task?.id) || "unknown-task";
      const selectedPapers = normalizeCommonalitySelectedPapers(
        result?.inputScope?.selectedPapers || task?.inputScope?.selectedPapers
      );
      const model = cleanText(result?.model) || cleanText(task?.model) || cleanText(job?.provider?.model);
      return {
        id: `draft-${cleanText(job?.id) || "unknown-job"}-${taskId}-commonality-note`,
        title: cleanText(result?.title) || createCommonalityDraftTitle(selectedPapers),
        content: cleanText(result?.content),
        promptTaskTemplateId: "multi-paper-commonality-note",
        llmProviderId: model,
        inputContext: {
          requestText: cleanText(task?.inputScope?.requestText || result?.inputScope?.requestText || job?.requestText),
          selectedPapers
        },
        createdAt,
        provenance: {
          source: "ai-task-workspace",
          aiJobId: cleanText(job?.id),
          aiTaskId: taskId,
          model,
          writeTarget: "local-draft-only"
        }
      };
    })
    .filter((draft) => cleanText(draft.content));
}

function isCommonalityTaskResult(result, task) {
  return (
    cleanText(result?.taskType) === "multi-paper-commonality-note" ||
    cleanText(result?.promptTemplateId) === "multi-paper-commonality-note" ||
    cleanText(task?.taskType) === "multi-paper-commonality-note" ||
    cleanText(task?.promptTemplateId) === "multi-paper-commonality-note"
  );
}

function normalizeCommonalitySelectedPapers(papers) {
  return (Array.isArray(papers) ? papers : []).map((paper) => ({
    zoteroItemKey: cleanText(paper?.zoteroItemKey || paper?.key),
    title: cleanText(paper?.title) || "未命名条目",
    authors: cleanText(paper?.authors),
    year: cleanText(paper?.year),
    publicationTitle: cleanText(paper?.publicationTitle),
    doi: cleanText(paper?.doi)
  }));
}

function createCommonalityDraftTitle(selectedPapers) {
  const count = Array.isArray(selectedPapers) ? selectedPapers.length : 0;
  const firstTitle = cleanText(selectedPapers?.[0]?.title);
  return firstTitle ? `共同点笔记：${firstTitle} 等 ${count || 1} 篇` : "共同点笔记";
}

function normalizeTransactionSnapshot(snapshot) {
  const input = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    ...(clonePlain(snapshot) || {})
  };

  if (input.schemaVersion !== 1) {
    throw new Error("不支持的工作台快照版本");
  }

  return {
    schemaVersion: 1,
    exportedAt: cleanText(input.exportedAt) || new Date().toISOString(),
    providers: Array.isArray(input.providers) ? input.providers : [],
    promptTemplates: Array.isArray(input.promptTemplates) ? input.promptTemplates : [],
    promptOverrides: Array.isArray(input.promptOverrides) ? input.promptOverrides : [],
    providerProvenance: Array.isArray(input.providerProvenance) ? input.providerProvenance : [],
    researchNoteDrafts: Array.isArray(input.researchNoteDrafts) ? input.researchNoteDrafts : [],
    graphSeeds: Array.isArray(input.graphSeeds) ? input.graphSeeds : [],
    citationRelations: Array.isArray(input.citationRelations) ? input.citationRelations : [],
    taskLedger: Array.isArray(input.taskLedger) ? input.taskLedger : [],
    aiJobs: Array.isArray(input.aiJobs) ? input.aiJobs : [],
    aiTasks: Array.isArray(input.aiTasks) ? input.aiTasks : [],
    aiTaskResults: Array.isArray(input.aiTaskResults) ? input.aiTaskResults : [],
    aiTaskFailures: Array.isArray(input.aiTaskFailures) ? input.aiTaskFailures : [],
    aiTaskSkips: Array.isArray(input.aiTaskSkips) ? input.aiTaskSkips : [],
    aiJobDiagnoses: Array.isArray(input.aiJobDiagnoses) ? input.aiJobDiagnoses : []
  };
}

function normalizeDraftInput(draftInput) {
  const draft = clonePlain(draftInput);
  const id = cleanText(draft.id);
  if (!id) {
    throw new Error("草稿 id 不能为空");
  }
  return {
    ...draft,
    id
  };
}

function normalizePromptOverrideInput(overrideInput) {
  const templateId = cleanText(overrideInput?.templateId);
  const template = cleanText(overrideInput?.template);
  if (!templateId) {
    throw new Error("提示词模板 id 不能为空");
  }
  if (!template) {
    throw new Error("提示词模板内容不能为空");
  }
  assertPromptOverrideTemplateSafe(template);
  return { templateId, template };
}

function assertPromptOverrideTemplateSafe(template) {
  for (const variable of extractPromptTemplateVariables(template)) {
    if (!SAFE_PROMPT_TEMPLATE_VARIABLES.has(variable)) {
      throw new Error(`Template variable ${variable} is not allowed`);
    }
  }
}

function extractPromptTemplateVariables(template) {
  return [...String(template || "").matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]);
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeReviewState(value) {
  const text = cleanText(value);
  return ["pending", "confirmed", "rejected"].includes(text) ? text : "pending";
}

function createStableTimestamp(value) {
  return value.replace(/[^0-9A-Za-z]+/g, "-").replace(/-$/, "");
}

function upsertRecordById(records, record) {
  const id = cleanText(record?.id);
  if (!id) {
    return;
  }
  const index = records.findIndex((entry) => cleanText(entry?.id) === id);
  if (index >= 0) {
    records[index] = record;
  } else {
    records.push(record);
  }
}

function cloneArray(value) {
  return Array.isArray(value) ? value.map((entry) => clonePlain(entry)) : [];
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

const WorkbenchLocalStoreTransaction = {
  captureGraphSeedTransaction,
  confirmAiJobPlanTransaction,
  confirmResearchNoteDraftSavedToZoteroTransaction,
  createAiJobPlanTransaction,
  createResearchNoteDraftTransaction,
  markRunningAiJobsForManualResumeTransaction,
  removePromptOverrideTransaction,
  promoteGraphSeedTransaction,
  recordAiTaskQueueResultTransaction,
  recordAiTaskQueueResultWithDraftsTransaction,
  replaceWorkbenchSnapshotFromImportTransaction,
  reviewGraphSeedTransaction,
  upsertPromptOverrideTransaction
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchLocalStoreTransaction;
}

if (typeof window !== "undefined") {
  window.WorkbenchLocalStoreTransaction = WorkbenchLocalStoreTransaction;
}
