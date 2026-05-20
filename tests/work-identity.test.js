const test = require("node:test");
const assert = require("node:assert/strict");

const {
  listDuplicateWorkCandidates,
  listDuplicateWorkCandidateEvidence,
  listWorkIdentitiesForInspector
} = require("../src/core/workIdentity");

test("listWorkIdentitiesForInspector aggregates local work identity clues", () => {
  const snapshot = {
    researchNoteDrafts: [
      {
        id: "draft-a",
        workId: "work:doi:10.1000/a",
        zoteroItemKey: "ITEMA",
        title: "Source A - 中文总结",
        inputContext: {
          title: "Source A",
          doi: "10.1000/a"
        },
        createdAt: "2026-05-18T10:00:00.000Z"
      }
    ],
    graphSeeds: [
      {
        id: "seed-a",
        workId: "work:doi:10.1000/a",
        zoteroItemKey: "ITEMA",
        source: {
          title: "Source A",
          doi: "10.1000/a"
        },
        createdAt: "2026-05-18T11:00:00.000Z"
      },
      {
        id: "seed-b",
        workId: "work:zotero:ITEMB",
        zoteroItemKey: "ITEMB",
        source: {
          title: "Source B"
        },
        createdAt: "2026-05-18T12:00:00.000Z"
      }
    ],
    citationRelations: [
      {
        id: "relation-a",
        sourceWorkId: "work:doi:10.1000/a",
        source: {
          title: "Source A",
          doi: "10.1000/a"
        },
        createdAt: "2026-05-18T13:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(listWorkIdentitiesForInspector(snapshot), [
    {
      workId: "work:doi:10.1000/a",
      title: "Source A",
      doi: "10.1000/a",
      zoteroItemKey: "ITEMA",
      draftCount: 1,
      graphSeedCount: 1,
      citationRelationCount: 1,
      recordCount: 3,
      statusTags: ["多来源", "有引用关系"],
      lastSeenAt: "2026-05-18T13:00:00.000Z"
    },
    {
      workId: "work:zotero:ITEMB",
      title: "Source B",
      doi: "未记录",
      zoteroItemKey: "ITEMB",
      draftCount: 0,
      graphSeedCount: 1,
      citationRelationCount: 0,
      recordCount: 1,
      statusTags: ["无 DOI", "孤立线索"],
      lastSeenAt: "2026-05-18T12:00:00.000Z"
    }
  ]);
});

test("listWorkIdentitiesForInspector filters current work", () => {
  const snapshot = {
    graphSeeds: [
      {
        id: "seed-a",
        workId: "work:doi:10.1000/a",
        source: { title: "Source A", doi: "10.1000/a" },
        createdAt: "2026-05-18T11:00:00.000Z"
      },
      {
        id: "seed-b",
        workId: "work:doi:10.1000/b",
        source: { title: "Source B", doi: "10.1000/b" },
        createdAt: "2026-05-18T12:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(
    listWorkIdentitiesForInspector(snapshot, {
      scope: "current-work",
      workId: "work:doi:10.1000/a"
    }).map((work) => work.workId),
    ["work:doi:10.1000/a"]
  );
});

test("listWorkIdentitiesForInspector adds read-only identity status tags", () => {
  const snapshot = {
    researchNoteDrafts: [
      {
        id: "draft-a",
        workId: "work:doi:10.1000/a",
        zoteroItemKey: "ITEMA",
        inputContext: { title: "Source A", doi: "10.1000/a" },
        createdAt: "2026-05-18T10:00:00.000Z"
      },
      {
        id: "draft-b",
        workId: "work:zotero:ITEMB",
        zoteroItemKey: "ITEMB",
        inputContext: { title: "Source B" },
        createdAt: "2026-05-18T11:00:00.000Z"
      },
      {
        id: "draft-c",
        workId: "work:doi:10.1000/c",
        zoteroItemKey: "ITEMC",
        inputContext: { title: "Source C", doi: "10.1000/c" },
        createdAt: "2026-05-18T12:00:00.000Z"
      }
    ],
    graphSeeds: [
      {
        id: "seed-a",
        workId: "work:doi:10.1000/a",
        zoteroItemKey: "ITEMA",
        source: { title: "Source A", doi: "10.1000/a" },
        createdAt: "2026-05-18T13:00:00.000Z"
      }
    ],
    citationRelations: [
      {
        id: "relation-a",
        sourceWorkId: "work:doi:10.1000/a",
        source: { title: "Source A", doi: "10.1000/a" },
        createdAt: "2026-05-18T14:00:00.000Z"
      }
    ]
  };

  const byWorkId = new Map(listWorkIdentitiesForInspector(snapshot).map((work) => [work.workId, work.statusTags]));

  assert.deepEqual(byWorkId.get("work:doi:10.1000/a"), ["多来源", "有引用关系"]);
  assert.deepEqual(byWorkId.get("work:zotero:ITEMB"), ["无 DOI", "孤立线索"]);
  assert.deepEqual(byWorkId.get("work:doi:10.1000/c"), ["孤立线索"]);
});

test("listWorkIdentitiesForInspector filters by status tag without changing scope", () => {
  const snapshot = {
    researchNoteDrafts: [
      {
        id: "draft-a",
        workId: "work:doi:10.1000/a",
        zoteroItemKey: "ITEMA",
        inputContext: { title: "Source A", doi: "10.1000/a" },
        createdAt: "2026-05-18T10:00:00.000Z"
      },
      {
        id: "draft-b",
        workId: "work:zotero:ITEMB",
        zoteroItemKey: "ITEMB",
        inputContext: { title: "Source B" },
        createdAt: "2026-05-18T11:00:00.000Z"
      },
      {
        id: "draft-c",
        workId: "work:doi:10.1000/c",
        zoteroItemKey: "ITEMC",
        inputContext: { title: "Source C", doi: "10.1000/c" },
        createdAt: "2026-05-18T12:00:00.000Z"
      }
    ],
    graphSeeds: [
      {
        id: "seed-a",
        workId: "work:doi:10.1000/a",
        zoteroItemKey: "ITEMA",
        source: { title: "Source A", doi: "10.1000/a" },
        createdAt: "2026-05-18T13:00:00.000Z"
      }
    ],
    citationRelations: [
      {
        id: "relation-a",
        sourceWorkId: "work:doi:10.1000/a",
        source: { title: "Source A", doi: "10.1000/a" },
        createdAt: "2026-05-18T14:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(
    listWorkIdentitiesForInspector(snapshot, { statusTag: "无 DOI" }).map((work) => work.workId),
    ["work:zotero:ITEMB"]
  );
  assert.deepEqual(
    listWorkIdentitiesForInspector(snapshot, { statusTag: "all" }).map((work) => work.workId),
    ["work:doi:10.1000/a", "work:doi:10.1000/c", "work:zotero:ITEMB"]
  );
  assert.deepEqual(
    listWorkIdentitiesForInspector(snapshot, {
      scope: "current-work",
      workId: "work:doi:10.1000/a",
      statusTag: "有引用关系"
    }).map((work) => work.workId),
    ["work:doi:10.1000/a"]
  );
  assert.deepEqual(
    listWorkIdentitiesForInspector(snapshot, {
      scope: "current-work",
      workId: "work:doi:10.1000/c",
      statusTag: "有引用关系"
    }).map((work) => work.workId),
    []
  );
});

test("listDuplicateWorkCandidates flags shared DOI and Zotero key groups", () => {
  const snapshot = {
    researchNoteDrafts: [
      {
        id: "draft-a",
        workId: "work:doi:10.1000/shared",
        zoteroItemKey: "ITEMA",
        inputContext: { title: "Shared DOI A", doi: "10.1000/shared" },
        createdAt: "2026-05-18T10:00:00.000Z"
      },
      {
        id: "draft-b",
        workId: "work:zotero:ITEMB",
        zoteroItemKey: "ITEMB",
        inputContext: { title: "Shared DOI B", doi: "10.1000/shared" },
        createdAt: "2026-05-18T11:00:00.000Z"
      },
      {
        id: "draft-c",
        workId: "work:doi:10.1000/c",
        zoteroItemKey: "DUPKEY",
        inputContext: { title: "Shared Zotero Key C", doi: "10.1000/c" },
        createdAt: "2026-05-18T12:00:00.000Z"
      },
      {
        id: "draft-d",
        workId: "work:doi:10.1000/d",
        zoteroItemKey: "DUPKEY",
        inputContext: { title: "Shared Zotero Key D", doi: "10.1000/d" },
        createdAt: "2026-05-18T13:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(listDuplicateWorkCandidates(snapshot), [
    {
      id: "duplicate-zotero-key-DUPKEY",
      reason: "shared-zotero-key",
      label: "Zotero key DUPKEY",
      matchValue: "DUPKEY",
      confidence: "high",
      workIds: ["work:doi:10.1000/d", "work:doi:10.1000/c"],
      titles: ["Shared Zotero Key D", "Shared Zotero Key C"],
      lastSeenAt: "2026-05-18T13:00:00.000Z"
    },
    {
      id: "duplicate-doi-10.1000/shared",
      reason: "shared-doi",
      label: "DOI 10.1000/shared",
      matchValue: "10.1000/shared",
      confidence: "high",
      workIds: ["work:zotero:ITEMB", "work:doi:10.1000/shared"],
      titles: ["Shared DOI B", "Shared DOI A"],
      lastSeenAt: "2026-05-18T11:00:00.000Z"
    }
  ]);
});

test("listDuplicateWorkCandidates flags normalized title hint groups", () => {
  const snapshot = {
    graphSeeds: [
      {
        id: "seed-a",
        workId: "work:zotero:ITEMA",
        zoteroItemKey: "ITEMA",
        source: { title: "Breast Cancer Study: A Meta Analysis" },
        createdAt: "2026-05-18T10:00:00.000Z"
      },
      {
        id: "seed-b",
        workId: "work:zotero:ITEMB",
        zoteroItemKey: "ITEMB",
        source: { title: "breast cancer study a meta-analysis" },
        createdAt: "2026-05-18T11:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(listDuplicateWorkCandidates(snapshot), [
    {
      id: "duplicate-title-breast-cancer-study-a-meta-analysis",
      reason: "similar-title",
      label: "标题 breast cancer study a meta analysis",
      matchValue: "breast cancer study a meta analysis",
      confidence: "medium",
      workIds: ["work:zotero:ITEMB", "work:zotero:ITEMA"],
      titles: ["breast cancer study a meta-analysis", "Breast Cancer Study: A Meta Analysis"],
      lastSeenAt: "2026-05-18T11:00:00.000Z"
    }
  ]);
});

test("listDuplicateWorkCandidates filters by confidence and reason", () => {
  const snapshot = {
    researchNoteDrafts: [
      {
        id: "draft-a",
        workId: "work:doi:10.1000/shared",
        zoteroItemKey: "ITEMA",
        inputContext: { title: "Shared DOI A", doi: "10.1000/shared" },
        createdAt: "2026-05-18T10:00:00.000Z"
      },
      {
        id: "draft-b",
        workId: "work:zotero:ITEMB",
        zoteroItemKey: "ITEMB",
        inputContext: { title: "Shared DOI B", doi: "10.1000/shared" },
        createdAt: "2026-05-18T11:00:00.000Z"
      },
      {
        id: "draft-c",
        workId: "work:zotero:ITEMC",
        zoteroItemKey: "ITEMC",
        inputContext: { title: "Shared Title Study" },
        createdAt: "2026-05-18T12:00:00.000Z"
      },
      {
        id: "draft-d",
        workId: "work:zotero:ITEMD",
        zoteroItemKey: "ITEMD",
        inputContext: { title: "shared title-study" },
        createdAt: "2026-05-18T13:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(
    listDuplicateWorkCandidates(snapshot, { confidence: "high" }).map((candidate) => candidate.reason),
    ["shared-doi"]
  );
  assert.deepEqual(
    listDuplicateWorkCandidates(snapshot, { confidence: "medium" }).map((candidate) => candidate.reason),
    ["similar-title"]
  );
  assert.deepEqual(
    listDuplicateWorkCandidates(snapshot, { reason: "similar-title" }).map((candidate) => candidate.confidence),
    ["medium"]
  );
  assert.deepEqual(
    listDuplicateWorkCandidates(snapshot, { reason: "similar-title", confidence: "high" }).map(
      (candidate) => `${candidate.reason}:${candidate.confidence}`
    ),
    ["similar-title:medium"]
  );
  assert.deepEqual(
    listDuplicateWorkCandidates(snapshot, { reason: "shared-doi", confidence: "medium" }).map(
      (candidate) => `${candidate.reason}:${candidate.confidence}`
    ),
    ["shared-doi:high"]
  );
  const zoteroKeySnapshot = {
    researchNoteDrafts: [
      {
        id: "draft-e",
        workId: "work:doi:10.1000/e",
        zoteroItemKey: "DUPKEY",
        inputContext: { title: "Shared Zotero Key E", doi: "10.1000/e" },
        createdAt: "2026-05-18T14:00:00.000Z"
      },
      {
        id: "draft-f",
        workId: "work:doi:10.1000/f",
        zoteroItemKey: "DUPKEY",
        inputContext: { title: "Shared Zotero Key F", doi: "10.1000/f" },
        createdAt: "2026-05-18T15:00:00.000Z"
      }
    ]
  };

  assert.deepEqual(
    listDuplicateWorkCandidates(zoteroKeySnapshot, { reason: "shared-zotero-key", confidence: "medium" }).map(
      (candidate) => `${candidate.reason}:${candidate.confidence}`
    ),
    ["shared-zotero-key:high"]
  );
});

test("listDuplicateWorkCandidateEvidence links a duplicate candidate back to source records", () => {
  const snapshot = {
    researchNoteDrafts: [
      {
        id: "draft-a",
        workId: "work:doi:10.1000/shared",
        zoteroItemKey: "ITEMA",
        inputContext: { title: "Shared DOI A", doi: "10.1000/shared" },
        createdAt: "2026-05-18T10:00:00.000Z"
      }
    ],
    graphSeeds: [
      {
        id: "seed-b",
        workId: "work:zotero:ITEMB",
        zoteroItemKey: "ITEMB",
        source: { title: "Shared DOI B", doi: "10.1000/shared" },
        evidence: { text: "Seed evidence" },
        createdAt: "2026-05-18T11:00:00.000Z"
      }
    ],
    citationRelations: [
      {
        id: "relation-a",
        sourceWorkId: "work:doi:10.1000/shared",
        source: { title: "Shared DOI A", doi: "10.1000/shared" },
        target: { text: "Target" },
        evidence: { text: "Relation evidence" },
        graphSeedId: "seed-b",
        createdAt: "2026-05-18T12:00:00.000Z"
      },
      {
        id: "relation-target-only",
        sourceWorkId: "work:doi:10.1000/other",
        source: { title: "Other", doi: "10.1000/other" },
        target: { text: "Shared DOI A", doi: "10.1000/shared" },
        createdAt: "2026-05-18T13:00:00.000Z"
      }
    ]
  };

  const candidate = listDuplicateWorkCandidates(snapshot).find((entry) => entry.reason === "shared-doi");

  assert.equal(candidate.matchValue, "10.1000/shared");
  assert.deepEqual(listDuplicateWorkCandidateEvidence(snapshot, candidate), [
    {
      sourceType: "citationRelation",
      sourceLabel: "引用关系",
      recordId: "relation-a",
      workId: "work:doi:10.1000/shared",
      title: "Shared DOI A",
      doi: "10.1000/shared",
      zoteroItemKey: "未记录",
      matchedField: "doi",
      matchedValue: "10.1000/shared",
      createdAt: "2026-05-18T12:00:00.000Z"
    },
    {
      sourceType: "graphSeed",
      sourceLabel: "图谱种子",
      recordId: "seed-b",
      workId: "work:zotero:ITEMB",
      title: "Shared DOI B",
      doi: "10.1000/shared",
      zoteroItemKey: "ITEMB",
      matchedField: "doi",
      matchedValue: "10.1000/shared",
      createdAt: "2026-05-18T11:00:00.000Z"
    },
    {
      sourceType: "draft",
      sourceLabel: "草稿",
      recordId: "draft-a",
      workId: "work:doi:10.1000/shared",
      title: "Shared DOI A",
      doi: "10.1000/shared",
      zoteroItemKey: "ITEMA",
      matchedField: "doi",
      matchedValue: "10.1000/shared",
      createdAt: "2026-05-18T10:00:00.000Z"
    }
  ]);
});
