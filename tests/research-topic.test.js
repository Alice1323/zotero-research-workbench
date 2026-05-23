const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createResearchTopicInput,
  linkRecordsToResearchTopic,
  listResearchTopicsForPanel
} = require("../src/core/researchTopic");
const { normalizeSnapshotForImport, createWorkbenchExportPackage } = require("../src/core/workbenchSnapshot");

test("createResearchTopicInput creates an active topic with stable links", () => {
  const topic = createResearchTopicInput({
    title: "急性肠胃炎护理研究",
    description: "寻找护理干预和营养支持相关文献",
    sourceScopes: [{ kind: "panel-query", query: "acute gastroenteritis nursing" }],
    zoteroItemKeys: ["AAA111", "BBB222"],
    createdAt: "2026-05-23T12:00:00.000Z"
  });

  assert.equal(topic.id, "research-topic-2026-05-23T12-00-00-000Z");
  assert.equal(topic.status, "active");
  assert.deepEqual(topic.linkedZoteroItemKeys, ["AAA111", "BBB222"]);
  assert.deepEqual(topic.linkedCandidateIds, []);
  assert.deepEqual(topic.sourceScopes, [{ kind: "panel-query", query: "acute gastroenteritis nursing" }]);
});

test("createResearchTopicInput avoids stable timestamp id collisions when existing ids are provided", () => {
  const topic = createResearchTopicInput({
    title: "急性肠胃炎护理研究",
    createdAt: "2026-05-23T12:00:00.000Z",
    existingTopicIds: ["research-topic-2026-05-23T12-00-00-000Z"]
  });

  assert.equal(topic.id, "research-topic-2026-05-23T12-00-00-000Z-2");
});

test("linkRecordsToResearchTopic appends unique linked record ids", () => {
  const snapshot = {
    schemaVersion: 1,
    researchTopics: [
      {
        id: "topic-a",
        title: "Topic",
        linkedCandidateIds: ["candidate-a"],
        linkedAiJobIds: [],
        linkedImportPlanIds: [],
        linkedWriteQueueIds: [],
        linkedDraftIds: [],
        linkedGraphSeedIds: [],
        linkedCitationRelationIds: [],
        linkedZoteroItemKeys: [],
        connectorHeaders: { authorization: "Bearer secret" },
        provenance: { source: "manual-entry" }
      }
    ]
  };

  const result = linkRecordsToResearchTopic({
    snapshot,
    topicId: "topic-a",
    candidateIds: ["candidate-a", "candidate-b"],
    aiJobIds: ["ai-job-a"],
    updatedAt: "2026-05-23T12:05:00.000Z"
  });

  const topic = result.snapshot.researchTopics[0];
  assert.deepEqual(topic.linkedCandidateIds, ["candidate-a", "candidate-b"]);
  assert.deepEqual(topic.linkedAiJobIds, ["ai-job-a"]);
  assert.equal(topic.updatedAt, "2026-05-23T12:05:00.000Z");
  assert.deepEqual(topic.connectorHeaders, { authorization: "Bearer secret" });
  assert.deepEqual(topic.provenance, { source: "manual-entry" });
  assert.equal(snapshot.researchTopics[0].updatedAt, undefined);
});

test("workbench snapshot preserves research topics and redacts nested secrets", () => {
  const restored = normalizeSnapshotForImport({
    schemaVersion: 1,
    researchTopics: [{ id: "topic-a", connectorHeaders: { authorization: "Bearer secret" } }]
  });

  assert.equal(restored.researchTopics[0].id, "topic-a");

  const exported = createWorkbenchExportPackage({ snapshot: restored, exportedAt: "2026-05-23T12:10:00.000Z" });
  assert.equal(exported.snapshot.researchTopics[0].connectorHeaders.authorization, "<redacted>");
});

test("listResearchTopicsForPanel returns active topics newest first", () => {
  const topics = listResearchTopicsForPanel({
    researchTopics: [
      { id: "old", title: "Old", status: "archived", updatedAt: "2026-05-22T00:00:00.000Z" },
      { id: "new", title: "New", status: "active", updatedAt: "2026-05-23T00:00:00.000Z" }
    ]
  });

  assert.deepEqual(topics.map((topic) => topic.id), ["new", "old"]);
  assert.equal(topics[0].statusLabel, "进行中");
  assert.equal(topics[1].statusLabel, "已归档");
});
