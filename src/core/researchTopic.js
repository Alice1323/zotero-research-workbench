function createResearchTopicInput({ title, description, sourceScopes, zoteroItemKeys, createdAt, existingTopicIds } = {}) {
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  const baseId = `research-topic-${createStableTimestamp(timestamp)}`;
  return normalizeResearchTopic({
    id: createUniqueResearchTopicId(baseId, existingTopicIds),
    title: cleanText(title) || "未命名研究主题",
    description: cleanText(description),
    sourceScopes: Array.isArray(sourceScopes) ? clonePlain(sourceScopes) : [],
    linkedZoteroItemKeys: uniqueClean(zoteroItemKeys),
    linkedCandidateIds: [],
    linkedAiJobIds: [],
    linkedImportPlanIds: [],
    linkedWriteQueueIds: [],
    linkedDraftIds: [],
    linkedGraphSeedIds: [],
    linkedCitationRelationIds: [],
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

function normalizeResearchTopic(topic = {}) {
  const createdAt = cleanText(topic.createdAt) || new Date().toISOString();
  const updatedAt = cleanText(topic.updatedAt) || createdAt;
  return {
    ...clonePlain(topic),
    id: cleanText(topic.id) || `research-topic-${createStableTimestamp(createdAt)}`,
    title: cleanText(topic.title) || "未命名研究主题",
    description: cleanText(topic.description),
    sourceScopes: Array.isArray(topic.sourceScopes) ? clonePlain(topic.sourceScopes) : [],
    linkedZoteroItemKeys: uniqueClean(topic.linkedZoteroItemKeys || topic.zoteroItemKeys),
    linkedCandidateIds: uniqueClean(topic.linkedCandidateIds),
    linkedAiJobIds: uniqueClean(topic.linkedAiJobIds),
    linkedImportPlanIds: uniqueClean(topic.linkedImportPlanIds),
    linkedWriteQueueIds: uniqueClean(topic.linkedWriteQueueIds),
    linkedDraftIds: uniqueClean(topic.linkedDraftIds),
    linkedGraphSeedIds: uniqueClean(topic.linkedGraphSeedIds),
    linkedCitationRelationIds: uniqueClean(topic.linkedCitationRelationIds),
    status: normalizeTopicStatus(topic.status),
    createdAt,
    updatedAt
  };
}

function normalizeResearchTopics(topics) {
  return (Array.isArray(topics) ? topics : []).map((topic) => normalizeResearchTopic(topic));
}

function linkRecordsToResearchTopic({
  snapshot,
  topicId,
  candidateIds,
  aiJobIds,
  importPlanIds,
  writeQueueIds,
  draftIds,
  graphSeedIds,
  citationRelationIds,
  zoteroItemKeys,
  updatedAt
} = {}) {
  const normalizedTopicId = cleanText(topicId);
  if (!normalizedTopicId) {
    throw new Error("研究主题 id 不能为空");
  }

  const next = clonePlain(snapshot || {});
  next.schemaVersion = 1;
  next.researchTopics = normalizeResearchTopics(next.researchTopics);
  const topic = next.researchTopics.find((entry) => cleanText(entry.id) === normalizedTopicId);
  if (!topic) {
    throw new Error("未找到研究主题");
  }

  appendUnique(topic.linkedCandidateIds, candidateIds);
  appendUnique(topic.linkedAiJobIds, aiJobIds);
  appendUnique(topic.linkedImportPlanIds, importPlanIds);
  appendUnique(topic.linkedWriteQueueIds, writeQueueIds);
  appendUnique(topic.linkedDraftIds, draftIds);
  appendUnique(topic.linkedGraphSeedIds, graphSeedIds);
  appendUnique(topic.linkedCitationRelationIds, citationRelationIds);
  appendUnique(topic.linkedZoteroItemKeys, zoteroItemKeys);
  topic.updatedAt = cleanText(updatedAt) || new Date().toISOString();
  next.exportedAt = topic.updatedAt;

  return {
    status: "research-topic-linked",
    topicId: normalizedTopicId,
    snapshot: next
  };
}

function listResearchTopicsForPanel(snapshot = {}) {
  return normalizeResearchTopics(snapshot.researchTopics)
    .sort((left, right) => cleanText(right.updatedAt).localeCompare(cleanText(left.updatedAt)))
    .map((topic) => ({
      id: topic.id,
      title: topic.title,
      description: topic.description,
      status: topic.status,
      statusLabel: formatTopicStatusLabel(topic.status),
      updatedAt: topic.updatedAt,
      linkedCounts: {
        candidates: topic.linkedCandidateIds.length,
        aiJobs: topic.linkedAiJobIds.length,
        imports: topic.linkedImportPlanIds.length,
        writes: topic.linkedWriteQueueIds.length,
        drafts: topic.linkedDraftIds.length,
        graphSeeds: topic.linkedGraphSeedIds.length,
        citationRelations: topic.linkedCitationRelationIds.length
      }
    }));
}

function normalizeTopicStatus(value) {
  const status = cleanText(value);
  return ["active", "paused", "archived"].includes(status) ? status : "active";
}

function createUniqueResearchTopicId(baseId, existingTopicIds) {
  const normalizedBaseId = cleanText(baseId) || "research-topic";
  const existing = new Set(uniqueClean(existingTopicIds));
  if (!existing.has(normalizedBaseId)) {
    return normalizedBaseId;
  }

  let suffix = 2;
  let candidate = `${normalizedBaseId}-${suffix}`;
  while (existing.has(candidate)) {
    suffix += 1;
    candidate = `${normalizedBaseId}-${suffix}`;
  }
  return candidate;
}

function formatTopicStatusLabel(status) {
  const normalized = normalizeTopicStatus(status);
  if (normalized === "paused") {
    return "已暂停";
  }
  if (normalized === "archived") {
    return "已归档";
  }
  return "进行中";
}

function appendUnique(target, values) {
  const list = Array.isArray(target) ? target : [];
  for (const value of uniqueClean(values)) {
    if (!list.includes(value)) {
      list.push(value);
    }
  }
  return list;
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

function createStableTimestamp(value) {
  return cleanText(value).replace(/[^0-9A-Za-z]+/g, "-").replace(/-$/, "");
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const WorkbenchResearchTopic = {
  appendUnique,
  cleanText,
  clonePlain,
  createResearchTopicInput,
  createStableTimestamp,
  createUniqueResearchTopicId,
  formatTopicStatusLabel,
  linkRecordsToResearchTopic,
  listResearchTopicsForPanel,
  normalizeResearchTopic,
  normalizeResearchTopics,
  normalizeTopicStatus,
  uniqueClean
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchResearchTopic;
}

if (typeof window !== "undefined") {
  window.WorkbenchResearchTopic = WorkbenchResearchTopic;
}
