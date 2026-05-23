const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createEtherealReferenceReadModel
} = require("../src/core/etherealReferenceGraph");
const core = require("../src/core");

test("createEtherealReferenceReadModel creates layout-free nodes and edges", () => {
  const model = createEtherealReferenceReadModel(
    {
      researchTopics: [{ id: "topic-a", title: "Topic", linkedCandidateIds: ["candidate-a"], linkedCitationRelationIds: ["relation-a"] }],
      documentCandidates: [{ id: "candidate-a", title: "Candidate A", doi: "10.1/a", topicId: "topic-a" }],
      citationRelations: [
        {
          id: "relation-a",
          sourceWorkId: "work:doi:10.1/a",
          source: { title: "Candidate A", doi: "10.1/a" },
          target: { kind: "work-hint", text: "Target B" },
          relationType: "supports",
          confidence: "high",
          evidence: { text: "Evidence" },
          graphSeedId: "seed-a"
        }
      ]
    },
    { topicId: "topic-a" }
  );

  assert.equal(model.nodes.length, 2);
  assert.equal(model.edges.length, 1);
  assert.equal(model.layoutKind, "none");
  assert.equal(model.featureState, "reserved-for-v0.5");
});

test("read model does not include x y or force layout fields", () => {
  const model = createEtherealReferenceReadModel({ documentCandidates: [{ id: "candidate-a", title: "A" }] });
  assert.equal(Object.prototype.hasOwnProperty.call(model.nodes[0], "x"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(model.nodes[0], "y"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(model, "forceSimulation"), false);
});

test("read model filters candidates and linked citation relations by topic", () => {
  const model = createEtherealReferenceReadModel(
    {
      researchTopics: [{ id: "topic-a", linkedCandidateIds: ["candidate-a"], linkedCitationRelationIds: ["relation-a"] }],
      documentCandidates: [
        { id: "candidate-a", title: "A", topicId: "topic-a" },
        { id: "candidate-b", title: "B", topicId: "topic-b" }
      ],
      citationRelations: [
        { id: "relation-a", source: { title: "A" }, target: { text: "Target A" } },
        { id: "relation-b", source: { title: "B" }, target: { text: "Target B" } }
      ]
    },
    { topicId: "topic-a" }
  );

  assert.deepEqual(model.edges.map((edge) => edge.citationRelationId), ["relation-a"]);
  assert.equal(model.nodes.some((node) => node.candidateId === "candidate-b"), false);
});

test("read model excludes explicit foreign-topic relations even when work identity matches", () => {
  const model = createEtherealReferenceReadModel(
    {
      documentCandidates: [{ id: "candidate-a", title: "A", doi: "10.1/a", topicId: "topic-a" }],
      citationRelations: [
        {
          id: "relation-b",
          topicId: "topic-b",
          source: { title: "A", doi: "10.1/a" },
          target: { text: "Target B" }
        }
      ]
    },
    { topicId: "topic-a" }
  );

  assert.deepEqual(model.edges, []);
});

test("core index exports ethereal reference graph module", () => {
  assert.equal(typeof core.WorkbenchEtherealReferenceGraph.createEtherealReferenceReadModel, "function");
});
