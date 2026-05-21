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
    taskLedger: Array.isArray(input.taskLedger) ? input.taskLedger : []
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

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

const WorkbenchLocalStoreTransaction = {
  captureGraphSeedTransaction,
  confirmResearchNoteDraftSavedToZoteroTransaction,
  createResearchNoteDraftTransaction,
  removePromptOverrideTransaction,
  promoteGraphSeedTransaction,
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
