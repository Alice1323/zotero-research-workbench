(function () {
const SNAPSHOT_PREF_KEY = "extensions.zotero-research-workbench.store.snapshot";

function createEmptyWorkbenchSnapshot({ now } = {}) {
  const clock = typeof now === "function" ? now : () => new Date().toISOString();
  return {
    schemaVersion: 1,
    exportedAt: clock(),
    providers: [],
    promptTemplates: [],
    researchNoteDrafts: [],
    graphSeeds: [],
    citationRelations: [],
    taskLedger: []
  };
}

function createWorkbenchRuntimeStore({ getPref, setPref, snapshotPrefKey = SNAPSHOT_PREF_KEY, now } = {}) {
  const prefReader = typeof getPref === "function" ? getPref : () => "";
  const prefWriter = typeof setPref === "function" ? setPref : null;

  return {
    loadSnapshot() {
      const raw = prefReader(snapshotPrefKey);
      if (!raw) {
        return createEmptyWorkbenchSnapshot({ now });
      }

      try {
        const snapshot = JSON.parse(raw);
        return snapshot?.schemaVersion === 1 ? snapshot : createEmptyWorkbenchSnapshot({ now });
      } catch (_error) {
        return createEmptyWorkbenchSnapshot({ now });
      }
    },

    saveSnapshot(snapshot) {
      if (!prefWriter) {
        throw new Error("Workbench runtime store cannot save snapshots without a preferences adapter");
      }
      prefWriter(snapshotPrefKey, JSON.stringify(snapshot));
      return snapshot;
    },

    updateSnapshot(mutator) {
      const snapshot = this.loadSnapshot();
      const updated = typeof mutator === "function" ? mutator(snapshot) : snapshot;
      return this.saveSnapshot(updated === undefined ? snapshot : updated);
    }
  };
}

const WorkbenchRuntimeStore = {
  SNAPSHOT_PREF_KEY,
  createEmptyWorkbenchSnapshot,
  createWorkbenchRuntimeStore
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchRuntimeStore;
}

if (typeof window !== "undefined") {
  window.WorkbenchRuntimeStore = WorkbenchRuntimeStore;
}
})();
