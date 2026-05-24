(function () {
function listWorkIdentitiesForInspector(snapshot, filters = {}) {
  const byWorkId = new Map();

  for (const draft of Array.isArray(snapshot?.researchNoteDrafts) ? snapshot.researchNoteDrafts : []) {
    addWorkIdentityRecord(byWorkId, {
      workId: draft?.workId,
      title: draft?.inputContext?.title || draft?.title,
      doi: draft?.inputContext?.doi,
      zoteroItemKey: draft?.zoteroItemKey,
      seenAt: draft?.createdAt,
      kind: "draft"
    });
  }

  for (const seed of Array.isArray(snapshot?.graphSeeds) ? snapshot.graphSeeds : []) {
    addWorkIdentityRecord(byWorkId, {
      workId: seed?.workId,
      title: seed?.source?.title,
      doi: seed?.source?.doi,
      zoteroItemKey: seed?.zoteroItemKey,
      seenAt: seed?.createdAt,
      kind: "graphSeed"
    });
  }

  for (const relation of Array.isArray(snapshot?.citationRelations) ? snapshot.citationRelations : []) {
    addWorkIdentityRecord(byWorkId, {
      workId: relation?.sourceWorkId,
      title: relation?.source?.title,
      doi: relation?.source?.doi,
      seenAt: relation?.createdAt,
      kind: "citationRelation"
    });
  }

  return Array.from(byWorkId.values())
    .map(finalizeWorkIdentity)
    .filter((work) => matchesWorkIdentityFilters(work, filters))
    .sort((left, right) => parseTimestamp(right.lastSeenAt) - parseTimestamp(left.lastSeenAt));
}

function listDuplicateWorkCandidates(snapshot, filters = {}) {
  const normalizedFilters = normalizeDuplicateCandidateFilters(filters);
  const works = listWorkIdentitiesForInspector(snapshot, normalizedFilters);
  const candidates = [];
  collectDuplicateCandidates(candidates, works, "doi", "shared-doi", "high", (value) => `DOI ${value}`);
  collectDuplicateCandidates(
    candidates,
    works,
    "zoteroItemKey",
    "shared-zotero-key",
    "high",
    (value) => `Zotero key ${value}`
  );
  collectDuplicateCandidates(
    candidates,
    works.map((work) => ({ ...work, normalizedTitle: normalizeTitleForDuplicateCheck(work.title) })),
    "normalizedTitle",
    "similar-title",
    "medium",
    (_value, group) => `标题 ${group[0].title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()}`
  );
  return candidates
    .filter((candidate) => candidate.workIds.length > 1)
    .filter((candidate) => matchesDuplicateCandidateFilters(candidate, normalizedFilters))
    .sort((left, right) => parseTimestamp(right.lastSeenAt) - parseTimestamp(left.lastSeenAt));
}

function collectDuplicateCandidates(candidates, works, field, reason, confidence, labelForValue) {
  const groups = new Map();
  for (const work of works) {
    const value = cleanDuplicateValue(work[field]);
    if (!value) {
      continue;
    }
    const group = groups.get(value) || [];
    group.push(work);
    groups.set(value, group);
  }

  for (const [value, group] of groups) {
    const uniqueWorkIds = new Set(group.map((work) => work.workId));
    if (uniqueWorkIds.size < 2) {
      continue;
    }
    const ordered = group.slice().sort((left, right) => parseTimestamp(right.lastSeenAt) - parseTimestamp(left.lastSeenAt));
    candidates.push({
      id: `duplicate-${duplicateReasonIdPrefix(reason)}-${createStableId(value)}`,
      reason,
      label: labelForValue(value, ordered),
      matchValue: value,
      confidence,
      workIds: ordered.map((work) => work.workId),
      titles: ordered.map((work) => work.title),
      lastSeenAt: ordered[0].lastSeenAt
    });
  }
}

function listDuplicateWorkCandidateEvidence(snapshot, candidate) {
  const workIds = new Set(Array.isArray(candidate?.workIds) ? candidate.workIds.map(cleanText).filter(Boolean) : []);
  const matchedField = duplicateCandidateMatchedField(candidate?.reason);
  const matchedValue = cleanText(candidate?.matchValue);
  if (!workIds.size || !matchedField || !matchedValue) {
    return [];
  }

  return [
    ...draftEvidenceRecords(snapshot, workIds, matchedField, matchedValue),
    ...graphSeedEvidenceRecords(snapshot, workIds, matchedField, matchedValue),
    ...citationRelationEvidenceRecords(snapshot, workIds, matchedField, matchedValue)
  ].sort((left, right) => parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt));
}

function draftEvidenceRecords(snapshot, workIds, matchedField, matchedValue) {
  return (Array.isArray(snapshot?.researchNoteDrafts) ? snapshot.researchNoteDrafts : [])
    .map((draft) => ({
      sourceType: "draft",
      sourceLabel: "草稿",
      recordId: cleanText(draft?.id) || "未记录",
      workId: cleanText(draft?.workId),
      title: cleanTitle(draft?.inputContext?.title || draft?.title) || "未命名作品",
      doi: cleanDoi(draft?.inputContext?.doi) || doiFromWorkId(cleanText(draft?.workId)) || "未记录",
      zoteroItemKey: cleanText(draft?.zoteroItemKey) || zoteroKeyFromWorkId(cleanText(draft?.workId)) || "未记录",
      createdAt: cleanText(draft?.createdAt)
    }))
    .filter((record) => matchesCandidateEvidenceRecord(record, workIds, matchedField, matchedValue))
    .map((record) => addMatchFields(record, matchedField, matchedValue));
}

function graphSeedEvidenceRecords(snapshot, workIds, matchedField, matchedValue) {
  return (Array.isArray(snapshot?.graphSeeds) ? snapshot.graphSeeds : [])
    .map((seed) => ({
      sourceType: "graphSeed",
      sourceLabel: "图谱种子",
      recordId: cleanText(seed?.id) || "未记录",
      workId: cleanText(seed?.workId),
      title: cleanTitle(seed?.source?.title) || "未命名作品",
      doi: cleanDoi(seed?.source?.doi) || doiFromWorkId(cleanText(seed?.workId)) || "未记录",
      zoteroItemKey: cleanText(seed?.zoteroItemKey) || zoteroKeyFromWorkId(cleanText(seed?.workId)) || "未记录",
      createdAt: cleanText(seed?.createdAt)
    }))
    .filter((record) => matchesCandidateEvidenceRecord(record, workIds, matchedField, matchedValue))
    .map((record) => addMatchFields(record, matchedField, matchedValue));
}

function citationRelationEvidenceRecords(snapshot, workIds, matchedField, matchedValue) {
  return (Array.isArray(snapshot?.citationRelations) ? snapshot.citationRelations : [])
    .map((relation) => ({
      sourceType: "citationRelation",
      sourceLabel: "引用关系",
      recordId: cleanText(relation?.id) || "未记录",
      workId: cleanText(relation?.sourceWorkId),
      title: cleanTitle(relation?.source?.title) || "未命名作品",
      doi: cleanDoi(relation?.source?.doi) || doiFromWorkId(cleanText(relation?.sourceWorkId)) || "未记录",
      zoteroItemKey: cleanText(relation?.source?.zoteroItemKey) || zoteroKeyFromWorkId(cleanText(relation?.sourceWorkId)) || "未记录",
      createdAt: cleanText(relation?.createdAt)
    }))
    .filter((record) => matchesCandidateEvidenceRecord(record, workIds, matchedField, matchedValue))
    .map((record) => addMatchFields(record, matchedField, matchedValue));
}

function matchesCandidateEvidenceRecord(record, workIds, matchedField, matchedValue) {
  if (!workIds.has(record.workId)) {
    return false;
  }
  if (matchedField === "title") {
    return normalizeTitleForDuplicateCheck(record.title) === matchedValue;
  }
  return cleanDuplicateValue(record[matchedField]) === matchedValue;
}

function addMatchFields(record, matchedField, matchedValue) {
  return {
    ...record,
    matchedField,
    matchedValue
  };
}

function duplicateCandidateMatchedField(reason) {
  if (reason === "shared-doi") return "doi";
  if (reason === "shared-zotero-key") return "zoteroItemKey";
  if (reason === "similar-title") return "title";
  return "";
}

function addWorkIdentityRecord(byWorkId, input) {
  const workId = cleanText(input.workId);
  if (!workId) {
    return;
  }

  const existing =
    byWorkId.get(workId) ||
    {
      workId,
      title: "",
      doi: "",
      zoteroItemKey: "",
      draftCount: 0,
      graphSeedCount: 0,
      citationRelationCount: 0,
      lastSeenAt: ""
    };

  existing.title = existing.title || cleanTitle(input.title);
  existing.doi = existing.doi || cleanDoi(input.doi) || doiFromWorkId(workId);
  existing.zoteroItemKey = existing.zoteroItemKey || cleanText(input.zoteroItemKey) || zoteroKeyFromWorkId(workId);
  if (input.kind === "draft") {
    existing.draftCount += 1;
  } else if (input.kind === "graphSeed") {
    existing.graphSeedCount += 1;
  } else if (input.kind === "citationRelation") {
    existing.citationRelationCount += 1;
  }
  existing.lastSeenAt = laterTimestamp(existing.lastSeenAt, input.seenAt);

  byWorkId.set(workId, existing);
}

function finalizeWorkIdentity(work) {
  const recordCount = work.draftCount + work.graphSeedCount + work.citationRelationCount;
  return {
    workId: work.workId,
    title: work.title || "未命名作品",
    doi: work.doi || "未记录",
    zoteroItemKey: work.zoteroItemKey || "未记录",
    draftCount: work.draftCount,
    graphSeedCount: work.graphSeedCount,
    citationRelationCount: work.citationRelationCount,
    recordCount,
    statusTags: createWorkIdentityStatusTags(work, recordCount),
    lastSeenAt: work.lastSeenAt
  };
}

function createWorkIdentityStatusTags(work, recordCount) {
  const sourceKinds = [work.draftCount, work.graphSeedCount, work.citationRelationCount].filter((count) => count > 0).length;
  const tags = [];
  if (!work.doi) {
    tags.push("无 DOI");
  }
  if (sourceKinds > 1) {
    tags.push("多来源");
  }
  if (work.citationRelationCount > 0) {
    tags.push("有引用关系");
  }
  if (recordCount === 1) {
    tags.push("孤立线索");
  }
  return tags;
}

function matchesWorkIdentityFilters(work, filters) {
  if (filters.scope === "current-work" && cleanText(filters.workId) && work.workId !== cleanText(filters.workId)) {
    return false;
  }
  if (isActiveFilter(filters.statusTag) && !work.statusTags.includes(cleanText(filters.statusTag))) {
    return false;
  }
  return true;
}

function matchesDuplicateCandidateFilters(candidate, filters) {
  if (isActiveFilter(filters.confidence) && candidate.confidence !== cleanText(filters.confidence)) {
    return false;
  }
  if (isActiveFilter(filters.reason) && candidate.reason !== cleanText(filters.reason)) {
    return false;
  }
  return true;
}

function normalizeDuplicateCandidateFilters(filters = {}) {
  const normalized = { ...filters };
  const impliedConfidence = duplicateConfidenceForReason(filters.reason);
  if (impliedConfidence) {
    normalized.confidence = impliedConfidence;
  }
  return normalized;
}

function duplicateConfidenceForReason(reason) {
  const value = cleanText(reason);
  if (value === "shared-doi" || value === "shared-zotero-key") return "high";
  if (value === "similar-title") return "medium";
  return "";
}

function isActiveFilter(value) {
  const text = cleanText(value);
  return Boolean(text && text !== "all");
}

function cleanTitle(value) {
  const text = cleanText(value);
  return text.replace(/\s+-\s+中文总结$/, "");
}

function cleanDoi(value) {
  const text = cleanText(value);
  return text && text !== "未记录" ? text : "";
}

function cleanDuplicateValue(value) {
  const text = cleanText(value);
  return text && text !== "未记录" ? text : "";
}

function normalizeTitleForDuplicateCheck(value) {
  return cleanTitle(value)
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function createStableId(value) {
  return cleanText(value)
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\p{L}\p{N}./]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function duplicateReasonIdPrefix(reason) {
  if (reason === "shared-doi") return "doi";
  if (reason === "shared-zotero-key") return "zotero-key";
  if (reason === "similar-title") return "title";
  return "candidate";
}

function doiFromWorkId(workId) {
  return workId.startsWith("work:doi:") ? workId.slice("work:doi:".length) : "";
}

function zoteroKeyFromWorkId(workId) {
  return workId.startsWith("work:zotero:") ? workId.slice("work:zotero:".length) : "";
}

function laterTimestamp(left, right) {
  return parseTimestamp(right) > parseTimestamp(left) ? cleanText(right) : cleanText(left);
}

function parseTimestamp(value) {
  const timestamp = Date.parse(cleanText(value));
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const WorkbenchWorkIdentity = {
  listDuplicateWorkCandidates,
  listDuplicateWorkCandidateEvidence,
  listWorkIdentitiesForInspector
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchWorkIdentity;
}

if (typeof window !== "undefined") {
  window.WorkbenchWorkIdentity = WorkbenchWorkIdentity;
}
})();
