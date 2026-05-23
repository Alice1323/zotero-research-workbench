const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createZoteroWriteQueue,
  runNextZoteroWriteQueueEntry,
  recordZoteroWriteQueueEntryResult,
  retryFailedZoteroWriteQueueEntries,
  createZoteroWriteQueueReadModel
} = require("../src/core/zoteroWriteQueue");
const { createWorkbenchExportPackage, normalizeSnapshotForImport } = require("../src/core/workbenchSnapshot");
const core = require("../src/core");

test("createZoteroWriteQueue creates queued serial entries from import plan", () => {
  const queue = createZoteroWriteQueue({
    importPlan: {
      id: "plan-a",
      topicId: "topic-a",
      writeIntents: [
        { id: "item-a", kind: "create-item", candidateId: "candidate-a" },
        { id: "attachment-a", kind: "create-attachment", candidateId: "candidate-a", dependsOn: ["item-a"] }
      ]
    },
    createdAt: "2026-05-23T12:00:00.000Z"
  });

  assert.equal(queue.state, "queued");
  assert.equal(queue.entries.length, 2);
  assert.equal(queue.entries[0].state, "queued");
  assert.equal(queue.entries[1].state, "blocked");
});

test("runNextZoteroWriteQueueEntry starts only one unblocked entry", () => {
  const queue = createZoteroWriteQueue({
    importPlan: { id: "plan-a", writeIntents: [{ id: "item-a", kind: "create-item" }] }
  });
  const running = runNextZoteroWriteQueueEntry({ queue, startedAt: "2026-05-23T12:01:00.000Z" });

  assert.equal(running.entry.id, "item-a");
  assert.equal(running.queue.entries[0].state, "running");
});

test("runNextZoteroWriteQueueEntry never starts a second running entry", () => {
  const queue = createZoteroWriteQueue({
    importPlan: {
      id: "plan-a",
      writeIntents: [
        { id: "item-a", kind: "create-item" },
        { id: "item-b", kind: "create-item" }
      ]
    }
  });
  const first = runNextZoteroWriteQueueEntry({ queue, startedAt: "2026-05-23T12:01:00.000Z" });
  const second = runNextZoteroWriteQueueEntry({ queue: first.queue, startedAt: "2026-05-23T12:01:30.000Z" });

  assert.equal(second.entry.id, "item-a");
  assert.equal(second.queue.entries.filter((entry) => entry.state === "running").length, 1);
  assert.equal(second.queue.entries[1].state, "queued");
});

test("record result unblocks dependent attachment after item success", () => {
  const queue = createZoteroWriteQueue({
    importPlan: {
      id: "plan-a",
      writeIntents: [
        { id: "item-a", kind: "create-item" },
        { id: "attachment-a", kind: "create-attachment", dependsOn: ["item-a"] }
      ]
    }
  });
  const running = runNextZoteroWriteQueueEntry({ queue });
  const recorded = recordZoteroWriteQueueEntryResult({
    queue: running.queue,
    entryId: "item-a",
    result: { state: "succeeded", zoteroItemKey: "ZOTERO1", zoteroItemId: 123 },
    completedAt: "2026-05-23T12:02:00.000Z"
  });

  assert.equal(recorded.entries[0].state, "succeeded");
  assert.equal(recorded.entries[1].state, "queued");
  assert.equal(recorded.entries[1].resolvedZoteroItemKey, "ZOTERO1");
  assert.equal(recorded.entries[1].resolvedZoteroItemId, 123);
});

test("record failure skips dependent attachment instead of leaving it blocked forever", () => {
  const queue = createZoteroWriteQueue({
    importPlan: {
      id: "plan-a",
      writeIntents: [
        { id: "item-a", kind: "create-item" },
        { id: "attachment-a", kind: "create-attachment", dependsOn: ["item-a"] }
      ]
    }
  });
  const running = runNextZoteroWriteQueueEntry({ queue });
  const recorded = recordZoteroWriteQueueEntryResult({
    queue: running.queue,
    entryId: "item-a",
    result: { state: "failed", errorReason: "保存失败" },
    completedAt: "2026-05-23T12:02:00.000Z"
  });

  assert.equal(recorded.entries[0].state, "failed");
  assert.equal(recorded.entries[1].state, "skipped");
  assert.equal(recorded.state, "completed-with-failures");
});

test("retryFailedZoteroWriteQueueEntries only requeues failed entries", () => {
  const queue = {
    id: "queue-a",
    entries: [
      { id: "failed", state: "failed", retryCount: 0 },
      { id: "ok", state: "succeeded", retryCount: 0 }
    ]
  };
  const retried = retryFailedZoteroWriteQueueEntries({ queue, retriedAt: "2026-05-23T12:03:00.000Z" });
  assert.equal(retried.entries[0].state, "queued");
  assert.equal(retried.entries[0].retryCount, 1);
  assert.equal(retried.entries[1].state, "succeeded");
});

test("createZoteroWriteQueueReadModel filters by topic and reports progress", () => {
  const model = createZoteroWriteQueueReadModel(
    {
      zoteroWriteQueues: [
        { id: "queue-a", topicId: "topic-a", entries: [{ id: "item-a", state: "succeeded" }] },
        { id: "queue-b", topicId: "topic-b", entries: [{ id: "item-b", state: "queued" }] }
      ]
    },
    { topicId: "topic-a" }
  );

  assert.deepEqual(model.queues.map((queue) => queue.id), ["queue-a"]);
  assert.equal(model.progress.total, 1);
  assert.equal(model.progress.succeeded, 1);
});

test("snapshot preserves write queues and results while redacting nested secrets", () => {
  const restored = normalizeSnapshotForImport({
    schemaVersion: 1,
    zoteroWriteQueues: [{ id: "queue-a", secretToken: "token-a" }],
    zoteroWriteResults: [{ id: "result-a", authorization: "Bearer secret" }]
  });
  const exported = createWorkbenchExportPackage({ snapshot: restored, exportedAt: "2026-05-23T12:00:00.000Z" });

  assert.equal(restored.zoteroWriteQueues[0].id, "queue-a");
  assert.equal(exported.snapshot.zoteroWriteQueues[0].secretToken, "<redacted>");
  assert.equal(exported.snapshot.zoteroWriteResults[0].authorization, "<redacted>");
});

test("core index exports zotero write queue module", () => {
  assert.equal(typeof core.WorkbenchZoteroWriteQueue.createZoteroWriteQueue, "function");
});
