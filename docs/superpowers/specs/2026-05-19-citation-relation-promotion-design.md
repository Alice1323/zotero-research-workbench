# Citation Relation Promotion Design

## Goal

Allow a user-confirmed Graph Seed to become a local Citation Relation record in the Workbench Local Store without modifying Zotero item metadata.

## Scope

- Add `citationRelations` to Workbench Local Store snapshots.
- Promote only Graph Seeds whose review state is `confirmed`.
- Create one local Citation Relation per promoted seed.
- Mark the source Graph Seed with `promotedCitationRelationId` and `promotedAt`.
- Record a `promote-graph-seed-to-citation-relation` Task Ledger entry.
- Add a `生成关系` action for confirmed, unpromoted Graph Seeds in the review queue.

## Non-Goals

- Do not write Zotero item fields, tags, notes, or relations.
- Do not create new Zotero items.
- Do not merge Work identities.
- Do not build a graph visualization.
- Do not add batch promotion.

## Citation Relation Shape

Each relation is stored under `snapshot.citationRelations`:

```json
{
  "id": "citation-relation-seed-a",
  "sourceWorkId": "work:doi:10.source",
  "source": { "title": "Source", "doi": "10.source" },
  "relationType": "supports",
  "target": { "kind": "work-hint", "text": "Target" },
  "evidence": { "source": "workbench-generated-result", "text": "Evidence" },
  "confidence": "high",
  "graphSeedId": "seed-a",
  "createdAt": "2026-05-19T00:00:00.000Z",
  "provenance": {
    "source": "confirmed-graph-seed",
    "writeTarget": "local-snapshot-only"
  }
}
```

The id is stable per seed. Re-promoting a seed is idempotent: if the relation already exists, the helper returns a snapshot with no duplicate relation and no extra promotion task.

## UI

Confirmed seeds show their review timestamp and, if not yet promoted, a `生成关系` button. After promotion, the row shows `已生成关系` with the relation id.

Errors use existing layered details. Trying to promote a missing seed reports `未找到图谱种子`; trying to promote a pending or rejected seed reports `图谱种子尚未确认`.

## Export/Import

JSON, ZIP, and WebDAV export/import already operate on the Workbench snapshot. The snapshot normalizers must preserve `citationRelations`. Secret redaction continues to apply.

## Tests

- Core Graph Seed tests cover confirmed promotion, idempotency, pending rejection, and missing seed rejection.
- Core export/import tests preserve `citationRelations`.
- UI localization tests cover `生成关系`, `已生成关系`, and runtime wiring.
