function createGraphSeedInput({
  paper,
  target,
  relationType,
  confidence,
  evidenceText,
  providerId,
  seedKind,
  createdAt
}) {
  const normalized = normalizePaperContext(paper || {});
  const targetText = cleanText(target);
  if (!targetText) {
    throw new Error("图谱种子目标不能为空");
  }
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  return {
    id: `seed-${normalized.key || "unknown"}-${createStableTimestamp(timestamp)}`,
    workId: createWorkId(normalized),
    zoteroItemKey: normalized.key,
    source: {
      title: normalized.title,
      doi: normalized.doi
    },
    relationType: cleanText(relationType) || "related",
    target: {
      kind: "work-hint",
      text: targetText
    },
    evidence: {
      source: "workbench-generated-result",
      text: cleanText(evidenceText) || "未记录"
    },
    providerId: cleanText(providerId) || null,
    confidence: cleanText(confidence) || "low",
    seedKind: cleanText(seedKind) || "user-confirmed",
    createdAt: timestamp,
    provenance: {
      source: "explicit-user-action",
      writeTarget: "local-snapshot-only"
    }
  };
}

function appendGraphSeedToSnapshot({ snapshot, seedInput, createdAt }) {
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  const next = cloneSnapshot(snapshot);
  next.graphSeeds = Array.isArray(next.graphSeeds) ? next.graphSeeds : [];
  next.taskLedger = Array.isArray(next.taskLedger) ? next.taskLedger : [];
  next.graphSeeds.push(seedInput);
  next.taskLedger.push({
    id: `task-${seedInput.id}-capture-graph-seed`,
    workflowStep: "capture-graph-seed",
    state: "completed",
    providerId: seedInput.providerId || null,
    promptTaskTemplateId: null,
    outputLocation: { graphSeedId: seedInput.id },
    errorNotice: null,
    startedAt: timestamp,
    completedAt: timestamp,
    provenance: {
      source: "explicit-user-action",
      writeTarget: "local-snapshot-only"
    }
  });
  next.exportedAt = timestamp;
  return next;
}

function listGraphSeedsForReview(snapshot, filters = {}) {
  return (Array.isArray(snapshot?.graphSeeds) ? snapshot.graphSeeds : [])
    .map(toReviewRecord)
    .filter((seed) => matchesReviewFilters(seed, filters))
    .sort((left, right) => parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt));
}

function markGraphSeedReviewed({ snapshot, seedId, reviewState, reviewedAt, reviewNote }) {
  const timestamp = cleanText(reviewedAt) || new Date().toISOString();
  const normalizedSeedId = cleanText(seedId);
  const normalizedReviewState = normalizeReviewState(reviewState);
  const next = cloneSnapshot(snapshot);
  next.graphSeeds = Array.isArray(next.graphSeeds) ? next.graphSeeds : [];
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
  next.taskLedger = Array.isArray(next.taskLedger) ? next.taskLedger : [];
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
  return next;
}

function promoteGraphSeedToCitationRelation({ snapshot, seedId, promotedAt }) {
  const timestamp = cleanText(promotedAt) || new Date().toISOString();
  const normalizedSeedId = cleanText(seedId);
  const next = cloneSnapshot(snapshot);
  next.graphSeeds = Array.isArray(next.graphSeeds) ? next.graphSeeds : [];
  next.citationRelations = Array.isArray(next.citationRelations) ? next.citationRelations : [];
  next.taskLedger = Array.isArray(next.taskLedger) ? next.taskLedger : [];

  const seedIndex = next.graphSeeds.findIndex((seed) => cleanText(seed?.id) === normalizedSeedId);
  if (seedIndex < 0) {
    throw new Error("未找到图谱种子");
  }

  const seed = next.graphSeeds[seedIndex];
  if (normalizeReviewState(seed?.reviewState) !== "confirmed") {
    throw new Error("图谱种子尚未确认");
  }

  const relationId = cleanText(seed.promotedCitationRelationId) || `citation-relation-${normalizedSeedId}`;
  const existing = next.citationRelations.find((relation) => cleanText(relation?.id) === relationId);
  if (existing) {
    return next;
  }

  next.citationRelations.push({
    id: relationId,
    sourceWorkId: cleanText(seed.workId),
    source: clonePlain(seed.source || {}),
    relationType: cleanText(seed.relationType) || "related",
    target: clonePlain(seed.target || {}),
    evidence: clonePlain(seed.evidence || {}),
    confidence: cleanText(seed.confidence) || "low",
    graphSeedId: normalizedSeedId,
    createdAt: timestamp,
    provenance: {
      source: "confirmed-graph-seed",
      writeTarget: "local-snapshot-only"
    }
  });
  next.graphSeeds[seedIndex] = {
    ...seed,
    promotedCitationRelationId: relationId,
    promotedAt: timestamp
  };
  next.taskLedger.push({
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
  next.exportedAt = timestamp;
  return next;
}

function listCitationRelationsForInspector(snapshot, filters = {}) {
  return (Array.isArray(snapshot?.citationRelations) ? snapshot.citationRelations : [])
    .map(toCitationRelationInspectorRecord)
    .filter((relation) => matchesCitationRelationInspectorFilters(relation, filters))
    .sort((left, right) => parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt));
}

function toCitationRelationInspectorRecord(relation) {
  const record = {
    id: cleanText(relation?.id),
    sourceWorkId: cleanText(relation?.sourceWorkId),
    sourceTitle: cleanText(relation?.source?.title || relation?.sourceWorkId) || "未记录",
    relationType: cleanText(relation?.relationType) || "related",
    target: cleanText(relation?.target?.text || relation?.target) || "未记录",
    evidence: cleanText(relation?.evidence?.text || relation?.evidence) || "未记录",
    confidence: cleanText(relation?.confidence) || "low",
    graphSeedId: cleanText(relation?.graphSeedId) || "未记录",
    createdAt: cleanText(relation?.createdAt)
  };
  return {
    ...record,
    qualityTags: createCitationRelationQualityTags(record)
  };
}

function createCitationRelationQualityTags(relation) {
  const tags = [];
  if (relation.target === "未记录") tags.push("缺少目标");
  if (relation.evidence === "未记录") tags.push("缺少证据");
  if (relation.confidence === "low") tags.push("低置信度");
  if (relation.graphSeedId === "未记录") tags.push("缺少来源种子");
  return tags;
}

function matchesCitationRelationInspectorFilters(relation, filters) {
  if (filters.scope === "current-work" && cleanText(filters.workId)) {
    if (relation.sourceWorkId !== cleanText(filters.workId)) return false;
  }
  if (isActiveFilter(filters.qualityTag) && !relation.qualityTags.includes(cleanText(filters.qualityTag))) return false;
  return true;
}

function toReviewRecord(seed) {
  return {
    id: cleanText(seed?.id),
    workId: cleanText(seed?.workId),
    sourceTitle: cleanText(seed?.source?.title || seed?.workId) || "未记录",
    relationType: cleanText(seed?.relationType) || "related",
    target: cleanText(seed?.target?.text || seed?.target) || "未记录",
    evidence: cleanText(seed?.evidence?.text || seed?.evidence) || "未记录",
    provider: cleanText(seed?.providerId) || "未记录",
    confidence: cleanText(seed?.confidence) || "low",
    seedKind: cleanText(seed?.seedKind) || "user-confirmed",
    reviewState: normalizeReviewState(seed?.reviewState),
    reviewedAt: cleanText(seed?.reviewedAt) || "未复核",
    reviewNote: cleanText(seed?.reviewNote),
    createdAt: cleanText(seed?.createdAt)
  };
}

function matchesReviewFilters(seed, filters) {
  if (isActiveFilter(filters.reviewState) && seed.reviewState !== filters.reviewState) return false;
  if (isActiveFilter(filters.providerId) && seed.provider !== filters.providerId) return false;
  if (isActiveFilter(filters.confidence) && seed.confidence !== filters.confidence) return false;
  if (isActiveFilter(filters.relationType) && seed.relationType !== filters.relationType) return false;
  if (isActiveFilter(filters.seedKind) && seed.seedKind !== filters.seedKind) return false;
  if (filters.currentWorkOnly && cleanText(filters.workId) && seed.workId !== cleanText(filters.workId)) {
    return false;
  }
  return true;
}

function isActiveFilter(value) {
  const text = cleanText(value);
  return Boolean(text && text !== "all");
}

function normalizeReviewState(value) {
  const text = cleanText(value);
  return ["pending", "confirmed", "rejected"].includes(text) ? text : "pending";
}

function normalizePaperContext(input) {
  return {
    key: cleanText(input.key),
    title: cleanText(input.title) || "未命名条目",
    doi: cleanText(input.doi) || "未记录"
  };
}

function createWorkId(paper) {
  if (paper.doi && paper.doi !== "未记录") {
    return `work:doi:${paper.doi}`;
  }
  return `work:zotero:${paper.key || "unknown"}`;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createStableTimestamp(value) {
  return value.replace(/[^0-9A-Za-z]+/g, "-").replace(/-$/, "");
}

function parseTimestamp(value) {
  const timestamp = Date.parse(cleanText(value));
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot || {}));
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

module.exports = {
  appendGraphSeedToSnapshot,
  createGraphSeedInput,
  listCitationRelationsForInspector,
  listGraphSeedsForReview,
  markGraphSeedReviewed,
  promoteGraphSeedToCitationRelation
};
