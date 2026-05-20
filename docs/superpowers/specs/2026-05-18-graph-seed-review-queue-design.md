# Graph Seed Review Queue Design

## Scope

This slice turns captured Graph Seeds from passive records into a small review queue inside the existing Research Panel.

The queue lets users:

- filter Graph Seeds by review state, provider, confidence, relation type, AI/user seed kind, and current Work;
- inspect source, target, evidence, provider, confidence, seed kind, and timestamp;
- explicitly confirm or reject a seed;
- record each review action in the Task Ledger.

This slice does not create formal Citation Relations, merge Work identities, build a graph visualization, or import new Zotero items.

## Architecture

The Workbench Local Store remains the authoritative state. Existing `graphSeeds` records gain optional review fields:

- `reviewState`: `pending`, `confirmed`, or `rejected`;
- `reviewedAt`;
- `reviewedBy`: `user`;
- `reviewNote`.

Legacy Graph Seeds without `reviewState` are treated as `pending`.

Pure helpers in `src/core/graphSeed.js` provide filtering and immutable review updates. The Zotero runtime mirrors these helpers in `chrome/content/paperSummary.js` because the panel currently runs without bundling CommonJS modules.

The Research Panel adds a compact queue under the existing read-only Workbench records area. It remains list-based and conservative: each row exposes evidence and two explicit actions, "确认" and "拒绝". Confirming a seed means "user-confirmed graph seed", not "formal citation relation".

## Data Flow

1. Graph Seed capture appends a seed to `snapshot.graphSeeds` with no review state.
2. The queue loads the snapshot and normalizes all missing review states to `pending` for display.
3. Filters run in memory against the current snapshot.
4. Confirm/reject creates a cloned snapshot, updates only the selected seed, appends a `review-graph-seed` Task Ledger record, and writes the snapshot back to Zotero preferences.
5. Export/import continues to use the existing snapshot package; review fields travel with graph seed records and are not secret material.

## UI

The first UI is intentionally dense and text-first:

- a "图谱种子复核队列" section;
- filter controls for state, provider, confidence, relation type, seed kind, and current Work;
- a refresh button;
- each row shows source title, relation, target, evidence, provider, confidence, seed kind, created time, and review state;
- pending rows show "确认" and "拒绝" buttons;
- confirmed/rejected rows are read-only and show reviewed time.

Empty states are explicit: `暂无待复核图谱种子`.

## Error Handling

If a seed id is missing or no longer exists, the runtime reports `未找到图谱种子`. Failed preference writes report `更新图谱种子复核状态失败` and do not mutate the visible list until a successful save.

No API keys, WebDAV passwords, bearer tokens, or authorization headers are shown in the queue, exports, task records, or errors.

## Testing

Core tests cover:

- legacy seeds default to pending;
- filtering by review state, provider, confidence, relation type, seed kind, and current Work;
- confirming and rejecting clone the snapshot, update the right seed, append a task ledger record, and do not mutate the source snapshot;
- unknown seed ids throw `未找到图谱种子`.

UI tests cover:

- Chinese labels and DOM ids for the queue and filters;
- runtime wiring for rendering, filtering, confirm, reject, and task ledger updates.

## Deferred

- formal Citation Relation promotion;
- duplicate Work identity resolution;
- graph neighborhood visualization;
- batch review actions;
- provider-backed graph seed discovery.
