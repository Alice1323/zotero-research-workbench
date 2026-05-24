(function () {
const IMPORT_MODES = {
  workbenchOnly: "workbench-only",
  zoteroItem: "zotero-item",
  zoteroItemPlusAttachment: "zotero-item-plus-attachment",
  attachmentOnly: "attachment-only"
};

const REVIEW_STATES = {
  needsReview: "needs-review",
  confirmed: "confirmed",
  rejected: "rejected"
};

function createCandidateReviewReadModel(snapshot = {}, { topicId } = {}) {
  const normalizedTopicId = cleanText(topicId);
  const candidates = (Array.isArray(snapshot.documentCandidates) ? snapshot.documentCandidates : [])
    .filter((candidate) => !normalizedTopicId || cleanText(candidate?.topicId) === normalizedTopicId)
    .map((candidate) => createCandidateReviewRecord(candidate));
  const blockedCount = candidates.filter((candidate) => !candidate.quickImportAllowed).length;
  return {
    candidates,
    summary: {
      totalCount: candidates.length,
      blockedCount,
      quickImportCount: candidates.length - blockedCount,
      confirmedCount: candidates.filter((candidate) => candidate.reviewState === REVIEW_STATES.confirmed).length,
      rejectedCount: candidates.filter((candidate) => candidate.reviewState === REVIEW_STATES.rejected).length
    }
  };
}

function createCandidateReviewRecord(candidate) {
  const normalized = clonePlain(candidate || {});
  const requiresDetailReview = candidateRequiresDetailReview(normalized);
  const reviewState = normalizeCandidateReviewState(normalized.reviewState, requiresDetailReview);
  const pdfStatus = derivePdfStatus(normalized);
  const importableAttachmentIds = normalizeAttachments(normalized.attachments)
    .filter((attachment) => attachment.importable)
    .map((attachment) => cleanText(attachment.id || attachment.referenceId))
    .filter(Boolean);

  return {
    ...normalized,
    ...pdfStatus,
    reviewState,
    requiresDetailReview,
    quickImportAllowed: reviewState === REVIEW_STATES.confirmed,
    importableAttachmentIds,
    anomalyTags: uniqueClean(normalized.anomalyTags)
  };
}

function derivePdfStatus(candidate = {}) {
  const pdfAttachments = normalizeAttachments(candidate.attachments).filter((attachment) =>
    ["open-access-pdf-url", "local-file", "connector-file-reference", "sci-hub-resolved-url"].includes(cleanText(attachment.kind))
  );
  const importable = pdfAttachments.filter((attachment) => attachment.importable);
  if (importable.length) {
    return {
      pdfStatus: "available",
      pdfStatusLabel: "可导入 PDF",
      pdfSources: uniqueClean(importable.map((attachment) => attachment.provenance?.source || attachment.kind))
    };
  }
  if (pdfAttachments.length) {
    return {
      pdfStatus: "blocked",
      pdfStatusLabel: "PDF 需复核",
      pdfSources: uniqueClean(pdfAttachments.map((attachment) => attachment.provenance?.source || attachment.kind))
    };
  }
  return { pdfStatus: "missing", pdfStatusLabel: "未发现 PDF", pdfSources: [] };
}

function markCandidateReviewed({ snapshot, candidateId, reviewDecision, reviewNote, reviewedAt } = {}) {
  const timestamp = cleanText(reviewedAt) || new Date().toISOString();
  const normalizedCandidateId = cleanText(candidateId);
  if (!normalizedCandidateId) {
    throw new Error("候选文献 id 不能为空");
  }
  const next = clonePlain(snapshot || {});
  next.schemaVersion = 1;
  next.documentCandidates = Array.isArray(next.documentCandidates) ? next.documentCandidates : [];
  const candidate = next.documentCandidates.find((entry) => cleanText(entry?.id) === normalizedCandidateId);
  if (!candidate) {
    throw new Error("未找到候选文献");
  }

  candidate.reviewState = normalizeReviewDecision(reviewDecision);
  candidate.reviewedAt = timestamp;
  candidate.reviewedBy = "user";
  candidate.reviewNote = cleanText(reviewNote);
  next.exportedAt = timestamp;
  return {
    status: "document-candidate-reviewed",
    candidateId: normalizedCandidateId,
    reviewState: candidate.reviewState,
    snapshot: next
  };
}

function createZoteroImportPlanFromCandidates({
  topicId,
  snapshot,
  candidates,
  selections,
  targetCollectionKey,
  createdAt
} = {}) {
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  const normalizedTopicId = cleanText(topicId);
  const sourceCandidates = Array.isArray(candidates) ? candidates : snapshot?.documentCandidates;
  const candidatesById = new Map(
    (Array.isArray(sourceCandidates) ? sourceCandidates : []).map((candidate) => [cleanText(candidate?.id), clonePlain(candidate)])
  );
  const writeIntents = [];
  const candidateIds = [];

  for (const selection of Array.isArray(selections) ? selections : []) {
    const candidateId = cleanText(selection?.candidateId);
    const candidate = candidatesById.get(candidateId);
    if (!candidate) {
      throw new Error("未找到候选文献");
    }
    assertCandidateCanBeImported(candidate, { topicId: normalizedTopicId });
    candidateIds.push(candidateId);

    const importMode = normalizeImportMode(selection?.importMode);
    if (importMode === IMPORT_MODES.workbenchOnly) {
      continue;
    }
    if (importMode === IMPORT_MODES.attachmentOnly) {
      const attachment = resolveSelectedAttachment(candidate, selection?.attachmentId);
      const parentItemKey = cleanText(selection?.targetZoteroItemKey);
      const parentItemId = Number(selection?.targetZoteroItemId) || null;
      if (!parentItemKey && !parentItemId) {
        throw new Error("仅补 PDF 需要目标 Zotero 条目");
      }
      if (attachment) {
        writeIntents.push(createAttachmentWriteIntent({
          candidate,
          topicId: normalizedTopicId,
          attachment,
          dependsOn: [],
          parentItemKey,
          parentItemId
        }));
      }
      continue;
    }

    const itemIntentId = `write-intent-${candidateId}-item`;
    writeIntents.push(createItemWriteIntent({ candidate, topicId: normalizedTopicId, targetCollectionKey, itemIntentId }));

    if (importMode === IMPORT_MODES.zoteroItemPlusAttachment) {
      const attachment = resolveSelectedAttachment(candidate, selection?.attachmentId);
      if (attachment) {
        writeIntents.push(createAttachmentWriteIntent({ candidate, topicId: normalizedTopicId, attachment, itemIntentId }));
      }
    }
  }

  return {
    id: `zotero-import-plan-${createStableTimestamp(timestamp)}`,
    topicId: normalizedTopicId,
    candidateIds: uniqueClean(candidateIds),
    selections: Array.isArray(selections) ? clonePlain(selections) : [],
    expectedWrites: {
      items: writeIntents.filter((intent) => intent.kind === "create-item").length,
      attachments: writeIntents.filter((intent) => intent.kind === "create-attachment").length
    },
    writeIntents,
    state: "draft",
    targetCollectionKey: cleanText(targetCollectionKey),
    confirmation: {
      required: true,
      confirmedAt: null,
      summary: `将创建 ${writeIntents.filter((intent) => intent.kind === "create-item").length} 个 Zotero 条目和 ${writeIntents.filter((intent) => intent.kind === "create-attachment").length} 个附件；不会自动执行写入。`
    },
    createdAt: timestamp,
    provenance: { source: "candidate-review", writeTarget: "local-snapshot-only" }
  };
}

function candidateRequiresDetailReview(candidate) {
  return uniqueClean(candidate?.anomalyTags).length > 0;
}

function createItemWriteIntent({ candidate, topicId, targetCollectionKey, itemIntentId }) {
  const candidateId = cleanText(candidate?.id);
  return {
    id: itemIntentId || `write-intent-${candidateId}-item`,
    kind: "create-item",
    candidateId,
    topicId: cleanText(topicId),
    itemFields: {
      itemType: "journalArticle",
      title: cleanText(candidate?.title),
      creators: normalizeCreators(candidate?.authors),
      date: cleanText(candidate?.year),
      DOI: cleanText(candidate?.doi),
      publicationTitle: cleanText(candidate?.publicationTitle)
    },
    targetCollectionKey: cleanText(targetCollectionKey),
    dependsOn: [],
    provenance: { sourceCandidateId: candidateId }
  };
}

function createAttachmentWriteIntent({ candidate, topicId, attachment, itemIntentId, dependsOn, parentItemKey, parentItemId }) {
  const candidateId = cleanText(candidate?.id);
  return {
    id: `write-intent-${candidateId}-attachment`,
    kind: "create-attachment",
    candidateId,
    topicId: cleanText(topicId),
    parentItemKey: cleanText(parentItemKey),
    parentItemId: Number(parentItemId) || null,
    attachment: clonePlain(attachment),
    dependsOn: Array.isArray(dependsOn) ? uniqueClean(dependsOn) : [itemIntentId || `write-intent-${candidateId}-item`],
    provenance: { sourceCandidateId: candidateId, attachmentSource: cleanText(attachment?.kind) }
  };
}

function assertCandidateCanBeImported(candidate, { topicId } = {}) {
  const normalizedTopicId = cleanText(topicId);
  const candidateTopicId = cleanText(candidate?.topicId);
  if (normalizedTopicId && candidateTopicId && candidateTopicId !== normalizedTopicId) {
    throw new Error("候选文献不属于当前研究主题");
  }

  const requiresDetailReview = candidateRequiresDetailReview(candidate);
  const reviewState = normalizeCandidateReviewState(candidate?.reviewState, requiresDetailReview);
  if (reviewState === REVIEW_STATES.rejected) {
    throw new Error("候选文献已被拒绝");
  }
  if (requiresDetailReview && reviewState !== REVIEW_STATES.confirmed) {
    throw new Error("候选文献需要单独复核");
  }
  if (reviewState === REVIEW_STATES.needsReview) {
    throw new Error("候选文献尚未确认");
  }
}

function resolveSelectedAttachment(candidate, attachmentId) {
  const attachments = normalizeAttachments(candidate?.attachments).filter((attachment) => attachment.importable);
  const normalizedAttachmentId = cleanText(attachmentId);
  if (!attachments.length) {
    return null;
  }
  if (!normalizedAttachmentId) {
    return attachments[0];
  }
  return attachments.find((attachment) => cleanText(attachment.id || attachment.referenceId) === normalizedAttachmentId) || null;
}

function normalizeCreators(authors) {
  return (Array.isArray(authors) ? authors : [])
    .map((author) => ({ creatorType: "author", name: cleanText(author?.name || author) }))
    .filter((author) => author.name);
}

function normalizeAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : []).map((attachment) => clonePlain(attachment));
}

function normalizeImportMode(value) {
  const text = cleanText(value);
  return Object.values(IMPORT_MODES).includes(text) ? text : IMPORT_MODES.zoteroItem;
}

function normalizeCandidateReviewState(value, requiresDetailReview) {
  const text = cleanText(value);
  if (Object.values(REVIEW_STATES).includes(text)) {
    return text;
  }
  return requiresDetailReview ? REVIEW_STATES.needsReview : REVIEW_STATES.confirmed;
}

function normalizeReviewDecision(value) {
  const text = cleanText(value);
  if ([REVIEW_STATES.confirmed, REVIEW_STATES.rejected, REVIEW_STATES.needsReview].includes(text)) {
    return text;
  }
  throw new Error("不支持的候选文献复核决定");
}

function createStableTimestamp(value) {
  return cleanText(value).replace(/[^0-9A-Za-z]+/g, "-").replace(/^-+|-+$/g, "") || "now";
}

function uniqueClean(values) {
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value);
    if (text && !result.includes(text)) {
      result.push(text);
    }
  }
  return result;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

const WorkbenchDocumentCandidateReview = {
  IMPORT_MODES,
  REVIEW_STATES,
  candidateRequiresDetailReview,
  cleanText,
  clonePlain,
  createCandidateReviewReadModel,
  createZoteroImportPlanFromCandidates,
  derivePdfStatus,
  markCandidateReviewed,
  normalizeCandidateReviewState,
  normalizeImportMode,
  uniqueClean
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchDocumentCandidateReview;
}

if (typeof window !== "undefined") {
  window.WorkbenchDocumentCandidateReview = WorkbenchDocumentCandidateReview;
}
})();
