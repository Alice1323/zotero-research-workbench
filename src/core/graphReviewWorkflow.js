const graphSeedModule =
  typeof require === "function" ? require("./graphSeed") : window.WorkbenchGraphSeed;
const workIdentityModule =
  typeof require === "function" ? require("./workIdentity") : window.WorkbenchWorkIdentity;
const transactionModule =
  typeof require === "function" ? require("./workbenchLocalStoreTransaction") : window.WorkbenchLocalStoreTransaction;

if (!graphSeedModule) {
  throw new Error("WorkbenchGraphSeed Module is unavailable");
}
if (!workIdentityModule) {
  throw new Error("WorkbenchWorkIdentity Module is unavailable");
}
if (!transactionModule) {
  throw new Error("WorkbenchLocalStoreTransaction Module is unavailable");
}

function createGraphReviewReadModel({ snapshot, selectedWorkId, filters } = {}) {
  const normalizedFilters = normalizeGraphReviewFilters(filters, selectedWorkId);
  const graphSeedReviewQueue = graphSeedModule.listGraphSeedsForReview(
    snapshot,
    normalizedFilters.graphSeedReview
  );
  const citationRelations = graphSeedModule.listCitationRelationsForInspector(
    snapshot,
    normalizedFilters.citationGraph
  );
  const workIdentities = workIdentityModule.listWorkIdentitiesForInspector(
    snapshot,
    normalizedFilters.workIdentity
  );
  const duplicateWorkCandidates = workIdentityModule.listDuplicateWorkCandidates(
    snapshot,
    normalizedFilters.duplicateWork
  );

  return {
    graphSeedReviewQueue,
    citationRelations,
    workIdentities,
    duplicateWorkCandidates,
    counts: {
      graphSeedReviewQueue: graphSeedReviewQueue.length,
      citationRelations: citationRelations.length,
      workIdentities: workIdentities.length,
      duplicateWorkCandidates: duplicateWorkCandidates.length
    }
  };
}

function captureGraphSeedWorkflow({ snapshot, seedInput, createdAt } = {}) {
  const result = transactionModule.captureGraphSeedTransaction({ snapshot, seedInput, createdAt });
  return {
    status: "captured",
    graphSeedId: result.graphSeedId,
    snapshot: result.snapshot
  };
}

function reviewGraphSeedWorkflow({ snapshot, seedId, reviewState, reviewedAt, reviewNote } = {}) {
  const result = transactionModule.reviewGraphSeedTransaction({
    snapshot,
    seedId,
    reviewState,
    reviewedAt,
    reviewNote
  });
  return {
    status: "reviewed",
    graphSeedId: result.graphSeedId,
    reviewState: result.reviewState,
    snapshot: result.snapshot
  };
}

function promoteGraphSeedWorkflow({ snapshot, seedId, promotedAt } = {}) {
  try {
    const result = transactionModule.promoteGraphSeedTransaction({ snapshot, seedId, promotedAt });
    return {
      status: result.status === "citation-relation-already-promoted" ? "alreadyPromoted" : "promoted",
      graphSeedId: result.graphSeedId,
      citationRelationId: result.citationRelationId,
      snapshot: result.snapshot
    };
  } catch (error) {
    const message = cleanText(error?.message);
    if (message.includes("尚未确认")) {
      return { status: "notConfirmed", graphSeedId: cleanText(seedId), error };
    }
    if (message.includes("未找到图谱种子")) {
      return { status: "missingSeed", graphSeedId: cleanText(seedId), error };
    }
    throw error;
  }
}

function listGraphReviewDuplicateWorkCandidateEvidence({ snapshot, candidate } = {}) {
  return workIdentityModule.listDuplicateWorkCandidateEvidence(snapshot, candidate);
}

function normalizeGraphReviewFilters(filters = {}, selectedWorkId) {
  const workId = cleanText(selectedWorkId);
  return {
    graphSeedReview: withDefaultWorkId(filters.graphSeedReview, workId),
    citationGraph: withDefaultWorkId(filters.citationGraph, workId),
    workIdentity: withDefaultWorkId(filters.workIdentity, workId),
    duplicateWork: withDefaultWorkId(filters.duplicateWork, workId)
  };
}

function withDefaultWorkId(filters, workId) {
  return {
    ...(filters || {}),
    workId: cleanText(filters?.workId) || workId
  };
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const WorkbenchGraphReviewWorkflow = {
  captureGraphSeedWorkflow,
  createGraphReviewReadModel,
  listGraphReviewDuplicateWorkCandidateEvidence,
  promoteGraphSeedWorkflow,
  reviewGraphSeedWorkflow
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchGraphReviewWorkflow;
}

if (typeof window !== "undefined") {
  window.WorkbenchGraphReviewWorkflow = WorkbenchGraphReviewWorkflow;
}
