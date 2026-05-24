(function () {
const WRITE_QUEUE_STATES = {
  queued: "queued",
  running: "running",
  paused: "paused",
  completed: "completed",
  completedWithFailures: "completed-with-failures",
  failed: "failed",
  cancelled: "cancelled"
};

const WRITE_ENTRY_STATES = {
  queued: "queued",
  blocked: "blocked",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  skipped: "skipped",
  cancelled: "cancelled"
};

function createZoteroWriteQueue({ importPlan, createdAt } = {}) {
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  const plan = clonePlain(importPlan);
  const importPlanId = cleanText(plan.id);
  if (!importPlanId) {
    throw new Error("导入计划 id 不能为空");
  }
  const queueId = `zotero-write-queue-${importPlanId}`;
  const entries = (Array.isArray(plan.writeIntents) ? plan.writeIntents : []).map((intent, index) =>
    createWriteQueueEntry({ intent, queueId, importPlanId, topicId: plan.topicId, timestamp, index })
  );
  const queue = {
    id: queueId,
    importPlanId,
    topicId: cleanText(plan.topicId),
    state: entries.length ? WRITE_QUEUE_STATES.queued : WRITE_QUEUE_STATES.completed,
    entries,
    expectedWrites: clonePlain(plan.expectedWrites),
    createdAt: timestamp,
    startedAt: null,
    completedAt: entries.length ? null : timestamp,
    provenance: { source: "zotero-import-plan", importPlanId }
  };
  refreshEntryDependencies(queue, timestamp);
  updateQueueState(queue, timestamp);
  return queue;
}

function runNextZoteroWriteQueueEntry({ queue, startedAt } = {}) {
  const timestamp = cleanText(startedAt) || new Date().toISOString();
  const next = normalizeQueue(queue);
  if (isTerminalQueueState(next.state) || next.state === WRITE_QUEUE_STATES.paused) {
    return { queue: next, entry: null };
  }

  refreshEntryDependencies(next, timestamp);
  const runningEntry = next.entries.find((entry) => entry.state === WRITE_ENTRY_STATES.running);
  if (runningEntry) {
    next.state = WRITE_QUEUE_STATES.running;
    return { queue: next, entry: clonePlain(runningEntry) };
  }

  const entry = next.entries.find((candidate) => candidate.state === WRITE_ENTRY_STATES.queued);
  if (!entry) {
    updateQueueState(next, timestamp);
    return { queue: next, entry: null };
  }

  entry.state = WRITE_ENTRY_STATES.running;
  entry.startedAt = entry.startedAt || timestamp;
  entry.errorReason = null;
  next.state = WRITE_QUEUE_STATES.running;
  next.startedAt = next.startedAt || timestamp;
  return { queue: next, entry: clonePlain(entry) };
}

function recordZoteroWriteQueueEntryResult({ queue, entryId, result, completedAt } = {}) {
  const timestamp = cleanText(completedAt) || new Date().toISOString();
  const next = normalizeQueue(queue);
  const normalizedEntryId = cleanText(entryId);
  const entry = next.entries.find((candidate) => cleanText(candidate?.id) === normalizedEntryId);
  if (!entry) {
    throw new Error("未找到 Zotero 写入队列条目");
  }

  const normalizedResult = clonePlain(result);
  const resultState = normalizeResultState(normalizedResult.state || normalizedResult.status);
  entry.state = resultState;
  entry.completedAt = timestamp;
  entry.result = {
    ...normalizedResult,
    state: resultState,
    completedAt: timestamp
  };
  entry.errorReason = resultState === WRITE_ENTRY_STATES.failed ? cleanText(normalizedResult.errorReason || normalizedResult.userMessage) : null;
  copyResultKeysToEntry(entry, normalizedResult);

  refreshEntryDependencies(next, timestamp);
  updateQueueState(next, timestamp);
  return next;
}

function retryFailedZoteroWriteQueueEntries({ queue, retriedAt } = {}) {
  const timestamp = cleanText(retriedAt) || new Date().toISOString();
  const next = normalizeQueue(queue);
  const retriedIds = [];
  for (const entry of next.entries) {
    if (entry.state === WRITE_ENTRY_STATES.failed) {
      entry.state = WRITE_ENTRY_STATES.queued;
      entry.retryCount = (Number(entry.retryCount) || 0) + 1;
      entry.queuedAt = timestamp;
      entry.startedAt = null;
      entry.completedAt = null;
      entry.errorReason = null;
      entry.result = null;
      retriedIds.push(entry.id);
    }
  }
  for (const entry of next.entries) {
    if (entry.state === WRITE_ENTRY_STATES.skipped && intersects(entry.dependsOn, retriedIds)) {
      entry.state = WRITE_ENTRY_STATES.blocked;
      entry.completedAt = null;
      entry.errorReason = null;
      entry.result = null;
    }
  }
  next.state = retriedIds.length ? WRITE_QUEUE_STATES.queued : next.state;
  refreshEntryDependencies(next, timestamp);
  updateQueueState(next, timestamp);
  return next;
}

function pauseZoteroWriteQueue({ queue, pausedAt } = {}) {
  const timestamp = cleanText(pausedAt) || new Date().toISOString();
  const next = normalizeQueue(queue);
  if (!isTerminalQueueState(next.state)) {
    next.state = WRITE_QUEUE_STATES.paused;
    next.pausedAt = timestamp;
  }
  return next;
}

function resumeZoteroWriteQueue({ queue, resumedAt } = {}) {
  const timestamp = cleanText(resumedAt) || new Date().toISOString();
  const next = normalizeQueue(queue);
  if (next.state === WRITE_QUEUE_STATES.paused) {
    next.state = WRITE_QUEUE_STATES.queued;
    next.resumedAt = timestamp;
  }
  return next;
}

function cancelZoteroWriteQueue({ queue, cancelledAt } = {}) {
  const timestamp = cleanText(cancelledAt) || new Date().toISOString();
  const next = normalizeQueue(queue);
  for (const entry of next.entries) {
    if (!isTerminalEntryState(entry.state)) {
      entry.state = WRITE_ENTRY_STATES.cancelled;
      entry.completedAt = timestamp;
    }
  }
  next.state = WRITE_QUEUE_STATES.cancelled;
  next.completedAt = timestamp;
  next.cancelledAt = timestamp;
  return next;
}

function createZoteroWriteQueueReadModel(snapshot = {}, { topicId } = {}) {
  const normalizedTopicId = cleanText(topicId);
  const queues = (Array.isArray(snapshot.zoteroWriteQueues) ? snapshot.zoteroWriteQueues : [])
    .filter((queue) => !normalizedTopicId || cleanText(queue?.topicId) === normalizedTopicId)
    .map((queue) => {
      const normalized = normalizeQueue(queue);
      return {
        ...normalized,
        progress: summarizeEntries(normalized.entries)
      };
    });
  const activeQueue = selectActiveQueue(queues);
  return {
    queues,
    activeQueue,
    entries: activeQueue ? activeQueue.entries : [],
    progress: activeQueue ? activeQueue.progress : summarizeEntries([])
  };
}

function createWriteQueueEntry({ intent, queueId, importPlanId, topicId, timestamp, index }) {
  const writeIntent = clonePlain(intent);
  const id = cleanText(writeIntent.id) || `write-intent-${index + 1}`;
  const dependsOn = uniqueClean(writeIntent.dependsOn);
  return {
    id,
    queueId,
    importPlanId,
    intentId: id,
    kind: cleanText(writeIntent.kind) || "unknown-write",
    candidateId: cleanText(writeIntent.candidateId),
    topicId: cleanText(writeIntent.topicId) || cleanText(topicId),
    state: dependsOn.length ? WRITE_ENTRY_STATES.blocked : WRITE_ENTRY_STATES.queued,
    dependsOn,
    retryCount: 0,
    maxRetries: 2,
    queuedAt: timestamp,
    startedAt: null,
    completedAt: null,
    errorReason: null,
    resolvedZoteroItemKey: "",
    resolvedZoteroItemId: null,
    result: null,
    writeIntent
  };
}

function refreshEntryDependencies(queue, timestamp) {
  const entriesById = new Map(queue.entries.map((entry) => [cleanText(entry.id), entry]));
  for (let pass = 0; pass < queue.entries.length; pass += 1) {
    for (const entry of queue.entries) {
      if (isTerminalEntryState(entry.state) || entry.state === WRITE_ENTRY_STATES.running) {
        continue;
      }
      const dependencies = uniqueClean(entry.dependsOn).map((id) => entriesById.get(id)).filter(Boolean);
      if (!dependencies.length) {
        if (entry.state === WRITE_ENTRY_STATES.blocked) {
          entry.state = WRITE_ENTRY_STATES.queued;
        }
        continue;
      }
      if (dependencies.some((dependency) => isFailedDependencyState(dependency.state))) {
        entry.state = WRITE_ENTRY_STATES.skipped;
        entry.completedAt = timestamp;
        entry.errorReason = "依赖写入失败";
        continue;
      }
      if (dependencies.every((dependency) => dependency.state === WRITE_ENTRY_STATES.succeeded)) {
        entry.state = WRITE_ENTRY_STATES.queued;
        entry.resolvedZoteroItemKey = dependencies.map((dependency) => cleanText(dependency.zoteroItemKey)).find(Boolean) || "";
        entry.resolvedZoteroItemId = dependencies.map((dependency) => dependency.zoteroItemId).find((value) => value !== undefined && value !== null) || null;
        continue;
      }
      entry.state = WRITE_ENTRY_STATES.blocked;
    }
  }
}

function updateQueueState(queue, timestamp) {
  if (queue.state === WRITE_QUEUE_STATES.cancelled || queue.state === WRITE_QUEUE_STATES.paused) {
    return queue;
  }
  if (queue.entries.some((entry) => entry.state === WRITE_ENTRY_STATES.running)) {
    queue.state = WRITE_QUEUE_STATES.running;
    return queue;
  }
  if (queue.entries.some((entry) => entry.state === WRITE_ENTRY_STATES.queued || entry.state === WRITE_ENTRY_STATES.blocked)) {
    queue.state = WRITE_QUEUE_STATES.queued;
    return queue;
  }
  if (!queue.entries.length || queue.entries.every((entry) => entry.state === WRITE_ENTRY_STATES.succeeded)) {
    queue.state = WRITE_QUEUE_STATES.completed;
    queue.completedAt = queue.completedAt || timestamp;
    return queue;
  }
  if (queue.entries.some((entry) => entry.state === WRITE_ENTRY_STATES.failed || entry.state === WRITE_ENTRY_STATES.skipped)) {
    queue.state = WRITE_QUEUE_STATES.completedWithFailures;
    queue.completedAt = queue.completedAt || timestamp;
    return queue;
  }
  return queue;
}

function summarizeEntries(entries) {
  const normalized = Array.isArray(entries) ? entries : [];
  return {
    total: normalized.length,
    queued: normalized.filter((entry) => entry.state === WRITE_ENTRY_STATES.queued).length,
    blocked: normalized.filter((entry) => entry.state === WRITE_ENTRY_STATES.blocked).length,
    running: normalized.filter((entry) => entry.state === WRITE_ENTRY_STATES.running).length,
    succeeded: normalized.filter((entry) => entry.state === WRITE_ENTRY_STATES.succeeded).length,
    failed: normalized.filter((entry) => entry.state === WRITE_ENTRY_STATES.failed).length,
    skipped: normalized.filter((entry) => entry.state === WRITE_ENTRY_STATES.skipped).length,
    cancelled: normalized.filter((entry) => entry.state === WRITE_ENTRY_STATES.cancelled).length
  };
}

function selectActiveQueue(queues) {
  if (!queues.length) {
    return null;
  }
  return queues.reduce((latest, queue, index) => {
    if (!latest) {
      return { queue, score: queueActivityScore(queue), index };
    }
    const score = queueActivityScore(queue);
    if (score > latest.score || (score === latest.score && index > latest.index)) {
      return { queue, score, index };
    }
    return latest;
  }, null).queue;
}

function queueActivityScore(queue) {
  return Math.max(
    ...[queue.completedAt, queue.cancelledAt, queue.pausedAt, queue.startedAt, queue.createdAt]
      .map((value) => Date.parse(cleanText(value)))
      .filter((value) => Number.isFinite(value)),
    0
  );
}

function normalizeQueue(queue) {
  const next = clonePlain(queue);
  next.entries = Array.isArray(next.entries) ? next.entries.map((entry) => ({ ...entry, dependsOn: uniqueClean(entry.dependsOn) })) : [];
  next.state = cleanText(next.state) || WRITE_QUEUE_STATES.queued;
  return next;
}

function normalizeResultState(value) {
  const text = cleanText(value);
  return text === WRITE_ENTRY_STATES.succeeded ? WRITE_ENTRY_STATES.succeeded : WRITE_ENTRY_STATES.failed;
}

function copyResultKeysToEntry(entry, result) {
  for (const key of ["zoteroItemKey", "zoteroItemId", "zoteroAttachmentKey", "zoteroAttachmentId", "parentItemKey"]) {
    if (result?.[key] !== undefined && result?.[key] !== null && result?.[key] !== "") {
      entry[key] = result[key];
    }
  }
}

function isTerminalQueueState(state) {
  return [WRITE_QUEUE_STATES.completed, WRITE_QUEUE_STATES.completedWithFailures, WRITE_QUEUE_STATES.failed, WRITE_QUEUE_STATES.cancelled].includes(state);
}

function isTerminalEntryState(state) {
  return [WRITE_ENTRY_STATES.succeeded, WRITE_ENTRY_STATES.failed, WRITE_ENTRY_STATES.skipped, WRITE_ENTRY_STATES.cancelled].includes(state);
}

function isFailedDependencyState(state) {
  return [WRITE_ENTRY_STATES.failed, WRITE_ENTRY_STATES.skipped, WRITE_ENTRY_STATES.cancelled].includes(state);
}

function intersects(left, right) {
  const rightSet = new Set(uniqueClean(right));
  return uniqueClean(left).some((value) => rightSet.has(value));
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

const WorkbenchZoteroWriteQueue = {
  WRITE_ENTRY_STATES,
  WRITE_QUEUE_STATES,
  cancelZoteroWriteQueue,
  createZoteroWriteQueue,
  createZoteroWriteQueueReadModel,
  pauseZoteroWriteQueue,
  recordZoteroWriteQueueEntryResult,
  resumeZoteroWriteQueue,
  retryFailedZoteroWriteQueueEntries,
  runNextZoteroWriteQueueEntry
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchZoteroWriteQueue;
}

if (typeof window !== "undefined") {
  window.WorkbenchZoteroWriteQueue = WorkbenchZoteroWriteQueue;
}
})();
