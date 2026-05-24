(function () {
function createEtherealReferenceReadModel(snapshot = {}, { topicId } = {}) {
  const normalizedTopicId = cleanText(topicId);
  const topic = findTopic(snapshot.researchTopics, normalizedTopicId);
  const linkedCandidateIds = new Set(uniqueClean(topic?.linkedCandidateIds));
  const linkedRelationIds = new Set(uniqueClean(topic?.linkedCitationRelationIds));
  const candidates = (Array.isArray(snapshot.documentCandidates) ? snapshot.documentCandidates : []).filter((candidate) =>
    belongsToTopic(candidate, normalizedTopicId, linkedCandidateIds)
  );
  const relations = (Array.isArray(snapshot.citationRelations) ? snapshot.citationRelations : []).filter((relation) =>
    belongsToRelationScope(relation, { topicId: normalizedTopicId, linkedRelationIds, candidates })
  );

  const nodes = [];
  const nodeIds = new Set();
  const candidateNodeIdsByWorkKey = new Map();

  for (const candidate of candidates) {
    const candidateId = cleanText(candidate.id);
    const node = {
      id: `candidate:${candidateId}`,
      kind: "document-candidate",
      label: cleanText(candidate.title) || "未命名候选",
      candidateId,
      doi: cleanText(candidate.doi),
      topicIds: uniqueClean([candidate.topicId].concat(candidate.topicIds || [])),
      statusTags: uniqueClean(candidate.anomalyTags),
      provenance: clonePlain(candidate.provenance)
    };
    pushNode(nodes, nodeIds, node);
    for (const key of createCandidateWorkKeys(candidate)) {
      candidateNodeIdsByWorkKey.set(key, node.id);
    }
  }

  const edges = relations.map((relation) => {
    const sourceNodeId = resolveRelationSourceNodeId(relation, candidateNodeIdsByWorkKey, nodes, nodeIds);
    const targetNodeId = resolveRelationTargetNodeId(relation, candidateNodeIdsByWorkKey, nodes, nodeIds);
    return {
      id: `edge:${cleanText(relation.id)}`,
      kind: "citation-relation",
      sourceNodeId,
      targetNodeId,
      relationType: cleanText(relation.relationType) || "related",
      evidence: clonePlain(relation.evidence),
      confidence: cleanText(relation.confidence) || "low",
      graphSeedId: cleanText(relation.graphSeedId),
      citationRelationId: cleanText(relation.id),
      provenance: clonePlain(relation.provenance)
    };
  });

  return {
    featureState: "reserved-for-v0.5",
    layoutKind: "none",
    nodes,
    edges,
    warnings: ["v0.4 仅预留关系网络数据，不渲染网状图。"]
  };
}

function findTopic(topics, topicId) {
  if (!topicId) {
    return null;
  }
  return (Array.isArray(topics) ? topics : []).find((topic) => cleanText(topic?.id) === topicId) || null;
}

function belongsToTopic(candidate, topicId, linkedCandidateIds) {
  if (!topicId) {
    return true;
  }
  const candidateTopicIds = uniqueClean([candidate?.topicId].concat(candidate?.topicIds || []));
  return candidateTopicIds.includes(topicId) || linkedCandidateIds.has(cleanText(candidate?.id));
}

function belongsToRelationScope(relation, { topicId, linkedRelationIds, candidates }) {
  if (!topicId) {
    return true;
  }
  const relationId = cleanText(relation?.id);
  const relationTopicIds = uniqueClean([relation?.topicId].concat(relation?.topicIds || []));
  if (relationTopicIds.length) {
    return relationTopicIds.includes(topicId);
  }
  if (linkedRelationIds.size) {
    return linkedRelationIds.has(relationId);
  }
  const candidateKeys = new Set(candidates.flatMap(createCandidateWorkKeys));
  return createRelationWorkKeys(relation).some((key) => candidateKeys.has(key));
}

function resolveRelationSourceNodeId(relation, candidateNodeIdsByWorkKey, nodes, nodeIds) {
  const candidateNodeId = createRelationSourceKeys(relation)
    .map((key) => candidateNodeIdsByWorkKey.get(key))
    .find(Boolean);
  if (candidateNodeId) {
    return candidateNodeId;
  }
  const sourceId = normalizeNodeId("work", relation.sourceWorkId || relation.source?.doi || relation.source?.title || relation.id);
  pushNode(nodes, nodeIds, {
    id: sourceId,
    kind: "work",
    label: cleanText(relation.source?.title || relation.sourceWorkId) || "未命名作品"
  });
  return sourceId;
}

function resolveRelationTargetNodeId(relation, candidateNodeIdsByWorkKey, nodes, nodeIds) {
  const candidateNodeId = createRelationTargetKeys(relation)
    .map((key) => candidateNodeIdsByWorkKey.get(key))
    .find(Boolean);
  if (candidateNodeId) {
    return candidateNodeId;
  }
  const target = relation.target || {};
  const targetId = normalizeNodeId("target", target.text || target.id || relation.id);
  pushNode(nodes, nodeIds, {
    id: targetId,
    kind: cleanText(target.kind) || "work-hint",
    label: cleanText(target.text || target.title || target.id) || "未命名目标"
  });
  return targetId;
}

function createCandidateWorkKeys(candidate) {
  return uniqueClean([
    cleanText(candidate?.id) ? `candidate:${cleanText(candidate.id)}` : "",
    cleanText(candidate?.doi) ? `doi:${normalizeDoi(candidate.doi)}` : "",
    cleanText(candidate?.doi) ? `work:doi:${normalizeDoi(candidate.doi)}` : "",
    cleanText(candidate?.title) ? `title:${normalizeTitle(candidate.title)}` : ""
  ]);
}

function createRelationWorkKeys(relation) {
  return uniqueClean(createRelationSourceKeys(relation).concat(createRelationTargetKeys(relation)));
}

function createRelationSourceKeys(relation) {
  return uniqueClean([
    cleanText(relation?.sourceWorkId),
    cleanText(relation?.source?.doi) ? `doi:${normalizeDoi(relation.source.doi)}` : "",
    cleanText(relation?.source?.doi) ? `work:doi:${normalizeDoi(relation.source.doi)}` : "",
    cleanText(relation?.source?.title) ? `title:${normalizeTitle(relation.source.title)}` : ""
  ]);
}

function createRelationTargetKeys(relation) {
  return uniqueClean([
    cleanText(relation?.target?.candidateId) ? `candidate:${cleanText(relation.target.candidateId)}` : "",
    cleanText(relation?.target?.doi) ? `doi:${normalizeDoi(relation.target.doi)}` : "",
    cleanText(relation?.target?.doi) ? `work:doi:${normalizeDoi(relation.target.doi)}` : "",
    cleanText(relation?.target?.title) ? `title:${normalizeTitle(relation.target.title)}` : "",
    cleanText(relation?.target?.text) ? `title:${normalizeTitle(relation.target.text)}` : ""
  ]);
}

function pushNode(nodes, nodeIds, node) {
  const id = cleanText(node?.id);
  if (!id || nodeIds.has(id)) {
    return;
  }
  nodes.push({ ...clonePlain(node), id });
  nodeIds.add(id);
}

function normalizeNodeId(prefix, value) {
  const text = cleanText(value) || "unknown";
  return text.startsWith(`${prefix}:`) ? text : `${prefix}:${text}`;
}

function normalizeDoi(value) {
  return cleanText(value)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .toLowerCase();
}

function normalizeTitle(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ");
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

const WorkbenchEtherealReferenceGraph = {
  cleanText,
  createEtherealReferenceReadModel,
  normalizeDoi,
  normalizeTitle,
  uniqueClean
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchEtherealReferenceGraph;
}

if (typeof window !== "undefined") {
  window.WorkbenchEtherealReferenceGraph = WorkbenchEtherealReferenceGraph;
}
})();
