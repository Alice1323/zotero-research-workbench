(function () {
const DocumentCandidateProtocol =
  typeof require === "function"
    ? require("./documentCandidateProtocol")
    : typeof window !== "undefined"
      ? window.WorkbenchDocumentCandidateProtocol
      : null;

const DISCOVERY_JOB_STATES = {
  draft: "draft",
  confirmed: "confirmed",
  running: "running",
  completed: "completed",
  completedWithSkips: "completed-with-skips",
  failed: "failed",
  cancelled: "cancelled"
};

function createLiteratureDiscoveryJobPlan({
  topicId,
  requestText,
  launchSurface,
  sourceScopes,
  sources,
  maxCandidates,
  createdAt
} = {}) {
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  const normalizedSources = uniqueClean(sources).length ? uniqueClean(sources) : ["openalex", "crossref", "unpaywall"];
  const normalizedMaxCandidates = normalizeMaxCandidates(maxCandidates);
  return {
    job: {
      id: `literature-discovery-job-${createStableTimestamp(timestamp)}`,
      topicId: cleanText(topicId),
      state: DISCOVERY_JOB_STATES.draft,
      requestText: cleanText(requestText),
      launchSurface: cleanText(launchSurface) || "research-panel",
      sourceScopes: Array.isArray(sourceScopes) ? clonePlain(sourceScopes) : [],
      sources: normalizedSources,
      maxCandidates: normalizedMaxCandidates,
      expectedSideEffects: {
        sourceQueries: normalizedSources.length,
        providerCalls: 0,
        workbenchLocalStoreWrites: true,
        zoteroNativeWrites: 0,
        documentImports: 0,
        externalDiscovery: true
      },
      createdAt: timestamp,
      confirmedAt: null,
      startedAt: null,
      completedAt: null
    },
    confirmation: {
      required: true,
      confirmedAt: null,
      summary: `将查询 ${normalizedSources.join("、")}，最多返回 ${normalizedMaxCandidates} 条候选；不会自动写入 Zotero。`
    }
  };
}

function confirmLiteratureDiscoveryJobPlan({ plan, confirmedAt } = {}) {
  const timestamp = cleanText(confirmedAt) || new Date().toISOString();
  const currentPlan = clonePlain(plan);
  return {
    ...currentPlan,
    job: {
      ...(currentPlan.job || {}),
      state: DISCOVERY_JOB_STATES.confirmed,
      confirmedAt: timestamp
    },
    confirmation: {
      ...(currentPlan.confirmation || {}),
      required: true,
      confirmedAt: timestamp
    }
  };
}

function mergeDiscoverySourceResults(sourceResults) {
  const candidates = [];
  const failures = [];
  for (const result of Array.isArray(sourceResults) ? sourceResults : []) {
    candidates.push(...normalizeResultCandidates(result));
    failures.push(...normalizeResultFailures(result));
  }
  return {
    candidates: DocumentCandidateProtocol.mergeDocumentCandidates(candidates),
    failures
  };
}

function createLiteratureDiscoveryReadModel(snapshot = {}, { topicId } = {}) {
  const normalizedTopicId = cleanText(topicId);
  const jobs = (Array.isArray(snapshot.literatureDiscoveryJobs) ? snapshot.literatureDiscoveryJobs : [])
    .filter((job) => !normalizedTopicId || cleanText(job?.topicId) === normalizedTopicId)
    .map((job) => ({
      ...clonePlain(job),
      stateLabel: formatDiscoveryJobStateLabel(job?.state)
    }))
    .sort((left, right) => cleanText(right.createdAt).localeCompare(cleanText(left.createdAt)));
  const candidates = (Array.isArray(snapshot.documentCandidates) ? snapshot.documentCandidates : []).filter(
    (candidate) => !normalizedTopicId || cleanText(candidate?.topicId) === normalizedTopicId
  );
  const failures = (Array.isArray(snapshot.literatureDiscoveryFailures) ? snapshot.literatureDiscoveryFailures : []).filter(
    (failure) => !normalizedTopicId || cleanText(failure?.topicId) === normalizedTopicId
  );

  return {
    jobs,
    latestJob: jobs[0] || null,
    candidateCount: candidates.length,
    failureCount: failures.length,
    candidates: candidates.map(clonePlain),
    failures: failures.map(clonePlain)
  };
}

function formatDiscoveryJobStateLabel(state) {
  const normalized = normalizeDiscoveryJobState(state);
  if (normalized === DISCOVERY_JOB_STATES.draft) return "待确认";
  if (normalized === DISCOVERY_JOB_STATES.confirmed) return "已确认";
  if (normalized === DISCOVERY_JOB_STATES.running) return "搜索中";
  if (normalized === DISCOVERY_JOB_STATES.completed) return "已完成";
  if (normalized === DISCOVERY_JOB_STATES.completedWithSkips) return "已完成，有跳过";
  if (normalized === DISCOVERY_JOB_STATES.failed) return "失败";
  if (normalized === DISCOVERY_JOB_STATES.cancelled) return "已取消";
  return "待确认";
}

function normalizeDiscoveryJobState(state) {
  const text = cleanText(state);
  return Object.values(DISCOVERY_JOB_STATES).includes(text) ? text : DISCOVERY_JOB_STATES.draft;
}

function normalizeMaxCandidates(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 50;
  }
  return Math.max(1, Math.min(200, Math.round(numeric)));
}

function normalizeResultCandidates(result) {
  const sourceAdapterId = cleanText(result?.sourceAdapterId);
  return (Array.isArray(result?.candidates) ? result.candidates : []).map((candidate) =>
    DocumentCandidateProtocol.normalizeDocumentCandidate({
      sourceAdapterId: cleanText(candidate?.sourceAdapterId) || sourceAdapterId,
      ...clonePlain(candidate)
    })
  );
}

function normalizeResultFailures(result) {
  const sourceAdapterId = cleanText(result?.sourceAdapterId) || "unknown-source";
  return (Array.isArray(result?.failures) ? result.failures : []).map((failure) => ({
    sourceAdapterId,
    message: cleanText(failure?.message || failure?.userMessage || failure),
    technicalDetail: cleanText(failure?.technicalDetail),
    createdAt: cleanText(failure?.createdAt) || new Date().toISOString()
  }));
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

const WorkbenchLiteratureDiscovery = {
  DISCOVERY_JOB_STATES,
  cleanText,
  clonePlain,
  confirmLiteratureDiscoveryJobPlan,
  createLiteratureDiscoveryJobPlan,
  createLiteratureDiscoveryReadModel,
  createStableTimestamp,
  formatDiscoveryJobStateLabel,
  mergeDiscoverySourceResults,
  normalizeDiscoveryJobState,
  normalizeMaxCandidates,
  uniqueClean
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchLiteratureDiscovery;
}

if (typeof window !== "undefined") {
  window.WorkbenchLiteratureDiscovery = WorkbenchLiteratureDiscovery;
}
})();
