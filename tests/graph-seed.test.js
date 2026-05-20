const test = require("node:test");
const assert = require("node:assert/strict");

const {
  appendGraphSeedToSnapshot,
  createGraphSeedInput,
  listCitationRelationsForInspector,
  listGraphSeedsForReview,
  markGraphSeedReviewed,
  promoteGraphSeedToCitationRelation
} = require("../src/core/graphSeed");

test("createGraphSeedInput normalizes selected paper and target into a graph seed", () => {
  const seed = createGraphSeedInput({
    paper: {
      key: "ITEM123",
      title: "Metformin and gut microbiota in PCOS",
      doi: "10.1000/pcos.2026"
    },
    target: "Smith 2024 insulin resistance microbiome review",
    relationType: "related",
    confidence: "medium",
    evidenceText: "生成结果提示这篇综述与当前文献共享 PCOS 肠道菌群机制。",
    providerId: "moonshot-v1",
    seedKind: "user-confirmed",
    createdAt: "2026-05-18T12:00:00.000Z"
  });

  assert.deepEqual(seed, {
    id: "seed-ITEM123-2026-05-18T12-00-00-000Z",
    workId: "work:doi:10.1000/pcos.2026",
    zoteroItemKey: "ITEM123",
    source: {
      title: "Metformin and gut microbiota in PCOS",
      doi: "10.1000/pcos.2026"
    },
    relationType: "related",
    target: {
      kind: "work-hint",
      text: "Smith 2024 insulin resistance microbiome review"
    },
    evidence: {
      source: "workbench-generated-result",
      text: "生成结果提示这篇综述与当前文献共享 PCOS 肠道菌群机制。"
    },
    providerId: "moonshot-v1",
    confidence: "medium",
    seedKind: "user-confirmed",
    createdAt: "2026-05-18T12:00:00.000Z",
    provenance: {
      source: "explicit-user-action",
      writeTarget: "local-snapshot-only"
    }
  });
});

test("createGraphSeedInput requires target text", () => {
  assert.throws(
    () =>
      createGraphSeedInput({
        paper: { key: "ITEM123", title: "Example" },
        target: "  ",
        evidenceText: "Evidence"
      }),
    /图谱种子目标不能为空/
  );
});

test("appendGraphSeedToSnapshot stores seed and capture task without mutating source snapshot", () => {
  const snapshot = {
    schemaVersion: 1,
    exportedAt: "2026-05-18T11:00:00.000Z",
    graphSeeds: [],
    taskLedger: []
  };
  const seedInput = createGraphSeedInput({
    paper: {
      key: "ITEM123",
      title: "Metformin and gut microbiota in PCOS",
      doi: "10.1000/pcos.2026"
    },
    target: "Smith 2024 insulin resistance microbiome review",
    relationType: "supports",
    confidence: "high",
    evidenceText: "当前生成结果与目标综述都支持肠道菌群影响胰岛素抵抗。",
    providerId: "moonshot-v1",
    seedKind: "user-confirmed",
    createdAt: "2026-05-18T12:00:00.000Z"
  });

  const updated = appendGraphSeedToSnapshot({
    snapshot,
    seedInput,
    createdAt: "2026-05-18T12:00:00.000Z"
  });

  assert.notEqual(updated, snapshot);
  assert.equal(snapshot.graphSeeds.length, 0);
  assert.equal(updated.graphSeeds.length, 1);
  assert.equal(updated.graphSeeds[0].id, "seed-ITEM123-2026-05-18T12-00-00-000Z");
  assert.deepEqual(updated.taskLedger[0], {
    id: "task-seed-ITEM123-2026-05-18T12-00-00-000Z-capture-graph-seed",
    workflowStep: "capture-graph-seed",
    state: "completed",
    providerId: "moonshot-v1",
    promptTaskTemplateId: null,
    outputLocation: { graphSeedId: "seed-ITEM123-2026-05-18T12-00-00-000Z" },
    errorNotice: null,
    startedAt: "2026-05-18T12:00:00.000Z",
    completedAt: "2026-05-18T12:00:00.000Z",
    provenance: {
      source: "explicit-user-action",
      writeTarget: "local-snapshot-only"
    }
  });
  assert.equal(updated.exportedAt, "2026-05-18T12:00:00.000Z");
});

test("listGraphSeedsForReview treats legacy seeds as pending and applies filters", () => {
  const snapshot = {
    graphSeeds: [
      {
        id: "seed-old",
        workId: "work:doi:10.old",
        source: { title: "Old Source" },
        relationType: "supports",
        target: { text: "Old Target" },
        evidence: { text: "Old evidence" },
        providerId: "model-a",
        confidence: "low",
        seedKind: "ai-inferred",
        createdAt: "2026-05-18T08:00:00.000Z"
      },
      {
        id: "seed-new",
        workId: "work:doi:10.new",
        source: { title: "New Source" },
        relationType: "contrasts",
        target: { text: "New Target" },
        evidence: { text: "New evidence" },
        providerId: "model-b",
        confidence: "high",
        seedKind: "user-confirmed",
        reviewState: "confirmed",
        reviewedAt: "2026-05-18T12:30:00.000Z",
        createdAt: "2026-05-18T12:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(
    listGraphSeedsForReview(snapshot).map((seed) => ({
      id: seed.id,
      reviewState: seed.reviewState
    })),
    [
      { id: "seed-new", reviewState: "confirmed" },
      { id: "seed-old", reviewState: "pending" }
    ]
  );

  assert.deepEqual(
    listGraphSeedsForReview(snapshot, {
      reviewState: "pending",
      providerId: "model-a",
      confidence: "low",
      relationType: "supports",
      seedKind: "ai-inferred",
      currentWorkOnly: true,
      workId: "work:doi:10.old"
    }),
    [
      {
        id: "seed-old",
        workId: "work:doi:10.old",
        sourceTitle: "Old Source",
        relationType: "supports",
        target: "Old Target",
        evidence: "Old evidence",
        provider: "model-a",
        confidence: "low",
        seedKind: "ai-inferred",
        reviewState: "pending",
        reviewedAt: "未复核",
        reviewNote: "",
        createdAt: "2026-05-18T08:00:00.000Z"
      }
    ]
  );
});

test("markGraphSeedReviewed confirms one seed and records a review task", () => {
  const snapshot = {
    schemaVersion: 1,
    exportedAt: "2026-05-18T11:00:00.000Z",
    graphSeeds: [
      {
        id: "seed-a",
        workId: "work:doi:10.a",
        source: { title: "Source A" },
        target: { text: "Target A" },
        createdAt: "2026-05-18T10:00:00.000Z"
      },
      {
        id: "seed-b",
        workId: "work:doi:10.b",
        source: { title: "Source B" },
        target: { text: "Target B" },
        reviewState: "pending",
        createdAt: "2026-05-18T10:30:00.000Z"
      }
    ],
    taskLedger: []
  };

  const updated = markGraphSeedReviewed({
    snapshot,
    seedId: "seed-a",
    reviewState: "confirmed",
    reviewedAt: "2026-05-18T13:00:00.000Z",
    reviewNote: "证据足够"
  });

  assert.notEqual(updated, snapshot);
  assert.equal(snapshot.graphSeeds[0].reviewState, undefined);
  assert.equal(updated.graphSeeds[0].reviewState, "confirmed");
  assert.equal(updated.graphSeeds[0].reviewedAt, "2026-05-18T13:00:00.000Z");
  assert.equal(updated.graphSeeds[0].reviewedBy, "user");
  assert.equal(updated.graphSeeds[0].reviewNote, "证据足够");
  assert.equal(updated.graphSeeds[1].reviewState, "pending");
  assert.deepEqual(updated.taskLedger[0], {
    id: "task-seed-a-review-graph-seed-2026-05-18T13-00-00-000Z",
    workflowStep: "review-graph-seed",
    state: "completed",
    providerId: null,
    promptTaskTemplateId: null,
    outputLocation: { graphSeedId: "seed-a", reviewState: "confirmed" },
    errorNotice: null,
    startedAt: "2026-05-18T13:00:00.000Z",
    completedAt: "2026-05-18T13:00:00.000Z",
    provenance: {
      source: "explicit-user-action",
      writeTarget: "local-snapshot-only"
    }
  });
  assert.equal(updated.exportedAt, "2026-05-18T13:00:00.000Z");
});

test("markGraphSeedReviewed rejects seeds and requires an existing seed id", () => {
  const snapshot = {
    graphSeeds: [
      {
        id: "seed-a",
        source: { title: "Source A" },
        target: { text: "Target A" },
        createdAt: "2026-05-18T10:00:00.000Z"
      }
    ],
    taskLedger: []
  };

  const updated = markGraphSeedReviewed({
    snapshot,
    seedId: "seed-a",
    reviewState: "rejected",
    reviewedAt: "2026-05-18T13:00:00.000Z"
  });

  assert.equal(updated.graphSeeds[0].reviewState, "rejected");

  assert.throws(
    () =>
      markGraphSeedReviewed({
        snapshot,
        seedId: "missing",
        reviewState: "confirmed"
      }),
    /未找到图谱种子/
  );
});

test("promoteGraphSeedToCitationRelation creates a local relation from a confirmed seed", () => {
  const snapshot = {
    schemaVersion: 1,
    exportedAt: "2026-05-18T13:00:00.000Z",
    graphSeeds: [
      {
        id: "seed-a",
        workId: "work:doi:10.source",
        source: { title: "Source A", doi: "10.source" },
        relationType: "supports",
        target: { kind: "work-hint", text: "Target A" },
        evidence: { source: "workbench-generated-result", text: "Evidence A" },
        providerId: "model-a",
        confidence: "high",
        reviewState: "confirmed",
        reviewedAt: "2026-05-18T13:00:00.000Z",
        createdAt: "2026-05-18T12:00:00.000Z"
      }
    ],
    citationRelations: [],
    taskLedger: []
  };

  const updated = promoteGraphSeedToCitationRelation({
    snapshot,
    seedId: "seed-a",
    promotedAt: "2026-05-18T14:00:00.000Z"
  });

  assert.notEqual(updated, snapshot);
  assert.equal(snapshot.citationRelations.length, 0);
  assert.deepEqual(updated.citationRelations[0], {
    id: "citation-relation-seed-a",
    sourceWorkId: "work:doi:10.source",
    source: { title: "Source A", doi: "10.source" },
    relationType: "supports",
    target: { kind: "work-hint", text: "Target A" },
    evidence: { source: "workbench-generated-result", text: "Evidence A" },
    confidence: "high",
    graphSeedId: "seed-a",
    createdAt: "2026-05-18T14:00:00.000Z",
    provenance: {
      source: "confirmed-graph-seed",
      writeTarget: "local-snapshot-only"
    }
  });
  assert.equal(updated.graphSeeds[0].promotedCitationRelationId, "citation-relation-seed-a");
  assert.equal(updated.graphSeeds[0].promotedAt, "2026-05-18T14:00:00.000Z");
  assert.deepEqual(updated.taskLedger[0], {
    id: "task-seed-a-promote-graph-seed-to-citation-relation-2026-05-18T14-00-00-000Z",
    workflowStep: "promote-graph-seed-to-citation-relation",
    state: "completed",
    providerId: "model-a",
    promptTaskTemplateId: null,
    outputLocation: { graphSeedId: "seed-a", citationRelationId: "citation-relation-seed-a" },
    errorNotice: null,
    startedAt: "2026-05-18T14:00:00.000Z",
    completedAt: "2026-05-18T14:00:00.000Z",
    provenance: {
      source: "explicit-user-action",
      writeTarget: "local-snapshot-only"
    }
  });
  assert.equal(updated.exportedAt, "2026-05-18T14:00:00.000Z");
});

test("promoteGraphSeedToCitationRelation is idempotent for already promoted seeds", () => {
  const snapshot = {
    graphSeeds: [
      {
        id: "seed-a",
        workId: "work:doi:10.source",
        source: { title: "Source A" },
        target: { text: "Target A" },
        reviewState: "confirmed",
        promotedCitationRelationId: "citation-relation-seed-a"
      }
    ],
    citationRelations: [
      {
        id: "citation-relation-seed-a",
        graphSeedId: "seed-a"
      }
    ],
    taskLedger: []
  };

  const updated = promoteGraphSeedToCitationRelation({
    snapshot,
    seedId: "seed-a",
    promotedAt: "2026-05-18T14:00:00.000Z"
  });

  assert.equal(updated.citationRelations.length, 1);
  assert.equal(updated.taskLedger.length, 0);
});

test("promoteGraphSeedToCitationRelation requires a confirmed existing seed", () => {
  const snapshot = {
    graphSeeds: [
      {
        id: "seed-a",
        source: { title: "Source A" },
        target: { text: "Target A" },
        reviewState: "pending"
      }
    ],
    taskLedger: []
  };

  assert.throws(
    () =>
      promoteGraphSeedToCitationRelation({
        snapshot,
        seedId: "seed-a"
      }),
    /图谱种子尚未确认/
  );

  assert.throws(
    () =>
      promoteGraphSeedToCitationRelation({
        snapshot,
        seedId: "missing"
      }),
    /未找到图谱种子/
  );
});

test("listCitationRelationsForInspector sorts relations and filters current work", () => {
  const snapshot = {
    citationRelations: [
      {
        id: "relation-old",
        sourceWorkId: "work:doi:10.source",
        source: { title: "Source Paper", doi: "10.source" },
        relationType: "supports",
        target: { text: "Target A" },
        evidence: { text: "Evidence A" },
        confidence: "high",
        graphSeedId: "seed-a",
        createdAt: "2026-05-18T10:00:00.000Z"
      },
      {
        id: "relation-new",
        sourceWorkId: "work:doi:10.other",
        source: { title: "Other Paper", doi: "10.other" },
        relationType: "contrasts",
        target: { text: "Target B" },
        evidence: { text: "Evidence B" },
        confidence: "medium",
        graphSeedId: "seed-b",
        createdAt: "2026-05-18T12:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(
    listCitationRelationsForInspector(snapshot).map((relation) => relation.id),
    ["relation-new", "relation-old"]
  );

  assert.deepEqual(listCitationRelationsForInspector(snapshot, { scope: "current-work", workId: "work:doi:10.source" }), [
    {
      id: "relation-old",
      sourceWorkId: "work:doi:10.source",
      sourceTitle: "Source Paper",
      relationType: "supports",
      target: "Target A",
      evidence: "Evidence A",
      confidence: "high",
      graphSeedId: "seed-a",
      qualityTags: [],
      createdAt: "2026-05-18T10:00:00.000Z"
    }
  ]);
});

test("listCitationRelationsForInspector adds no quality tags to complete relations", () => {
  const snapshot = {
    citationRelations: [
      {
        id: "relation-complete",
        sourceWorkId: "work:doi:10.source",
        source: { title: "Source Paper", doi: "10.source" },
        relationType: "supports",
        target: { text: "Target A" },
        evidence: { text: "Evidence A" },
        confidence: "high",
        graphSeedId: "seed-a",
        createdAt: "2026-05-18T10:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(listCitationRelationsForInspector(snapshot)[0].qualityTags, []);
});

test("listCitationRelationsForInspector tags missing fields and low confidence in fixed order", () => {
  const snapshot = {
    citationRelations: [
      {
        id: "relation-incomplete",
        sourceWorkId: "work:doi:10.source",
        source: { title: "Source Paper", doi: "10.source" },
        relationType: "supports",
        target: { text: "  " },
        evidence: { text: "未记录" },
        confidence: "low",
        graphSeedId: " ",
        createdAt: "2026-05-18T10:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(listCitationRelationsForInspector(snapshot)[0].qualityTags, [
    "缺少目标",
    "缺少证据",
    "低置信度",
    "缺少来源种子"
  ]);
});

test("listCitationRelationsForInspector filters by quality tag without changing all or current work scope", () => {
  const snapshot = {
    citationRelations: [
      {
        id: "relation-missing-evidence-current",
        sourceWorkId: "work:doi:10.source",
        source: { title: "Source Paper", doi: "10.source" },
        relationType: "supports",
        target: { text: "Target A" },
        evidence: { text: " " },
        confidence: "high",
        graphSeedId: "seed-a",
        createdAt: "2026-05-18T10:00:00.000Z"
      },
      {
        id: "relation-complete-current",
        sourceWorkId: "work:doi:10.source",
        source: { title: "Source Paper", doi: "10.source" },
        relationType: "supports",
        target: { text: "Target B" },
        evidence: { text: "Evidence B" },
        confidence: "high",
        graphSeedId: "seed-b",
        createdAt: "2026-05-18T11:00:00.000Z"
      },
      {
        id: "relation-missing-evidence-other",
        sourceWorkId: "work:doi:10.other",
        source: { title: "Other Paper", doi: "10.other" },
        relationType: "contrasts",
        target: { text: "Target C" },
        evidence: { text: "未记录" },
        confidence: "medium",
        graphSeedId: "seed-c",
        createdAt: "2026-05-18T12:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(
    listCitationRelationsForInspector(snapshot, { qualityTag: "缺少证据" }).map((relation) => relation.id),
    ["relation-missing-evidence-other", "relation-missing-evidence-current"]
  );

  assert.deepEqual(
    listCitationRelationsForInspector(snapshot, { qualityTag: "all" }).map((relation) => relation.id),
    ["relation-missing-evidence-other", "relation-complete-current", "relation-missing-evidence-current"]
  );

  assert.deepEqual(
    listCitationRelationsForInspector(snapshot, {
      scope: "current-work",
      workId: "work:doi:10.source",
      qualityTag: "缺少证据"
    }).map((relation) => relation.id),
    ["relation-missing-evidence-current"]
  );
});
