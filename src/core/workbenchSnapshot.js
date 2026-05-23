const SECRET_PLACEHOLDER = "<redacted>";

function redactSecretMaterial(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecretMaterial(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const redacted = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSecretKey(key) && entry) {
      redacted[key] = SECRET_PLACEHOLDER;
    } else {
      redacted[key] = redactSecretMaterial(entry);
    }
  }
  return redacted;
}

function isSecretKey(key) {
  const value = String(key || "");
  return (
    /^(apiKey|api_key|api-key|password|passwd|pwd|authorization|secret|token)$/i.test(value) ||
    /(^|[_-])(api[_-]?key|password|passwd|pwd|authorization|secret|token)([_-]|$)/i.test(value) ||
    /Token$/.test(value)
  );
}

function createWorkbenchExportPackage({ snapshot, exportedAt } = {}) {
  const timestamp = exportedAt || new Date().toISOString();
  return {
    packageKind: "zotero-research-workbench-export",
    packageVersion: 1,
    exportedAt: timestamp,
    snapshot: normalizeSnapshotForExport(snapshot, timestamp)
  };
}

function importWorkbenchExportPackage(input) {
  let parsed;
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input;
  } catch (_error) {
    throw new Error("导入文件不是有效 JSON");
  }

  if (parsed?.packageKind !== "zotero-research-workbench-export" || parsed?.packageVersion !== 1) {
    throw new Error("不支持的工作台导出文件");
  }

  return normalizeSnapshotForImport(parsed.snapshot);
}

function createWorkbenchZipExportPayload({ snapshot, exportedAt } = {}) {
  const timestamp = exportedAt || new Date().toISOString();
  const manifest = {
    packageKind: "zotero-research-workbench-zip-export",
    packageVersion: 1,
    exportedAt: timestamp,
    snapshotPath: "snapshot.json"
  };
  return {
    packageKind: manifest.packageKind,
    packageVersion: manifest.packageVersion,
    exportedAt: timestamp,
    files: {
      "manifest.json": manifest,
      "snapshot.json": createWorkbenchExportPackage({ snapshot, exportedAt: timestamp })
    }
  };
}

function importWorkbenchZipExportPayload(payload) {
  if (payload?.packageKind !== "zotero-research-workbench-zip-export" || payload?.packageVersion !== 1) {
    throw new Error("不支持的 ZIP 工作台导出包");
  }
  const manifest = payload.files?.["manifest.json"];
  if (manifest?.packageKind !== "zotero-research-workbench-zip-export" || manifest?.packageVersion !== 1) {
    throw new Error("不支持的 ZIP 工作台导出包");
  }
  const snapshotPath = manifest.snapshotPath || "snapshot.json";
  const snapshotPackage = payload.files?.[snapshotPath];
  if (!snapshotPackage) {
    throw new Error("ZIP 导出包缺少 snapshot.json");
  }
  return importWorkbenchExportPackage(snapshotPackage);
}

function normalizeSnapshotForExport(snapshot, exportedAt) {
  const normalized = normalizeSnapshotForImport(snapshot);
  normalized.exportedAt = exportedAt || normalized.exportedAt || new Date().toISOString();
  return redactSecretMaterial(normalized);
}

function normalizeSnapshotForImport(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1) {
    throw new Error("不支持的工作台快照版本");
  }

  return {
    schemaVersion: 1,
    exportedAt: snapshot.exportedAt || new Date().toISOString(),
    providers: Array.isArray(snapshot.providers) ? snapshot.providers : [],
    promptTemplates: Array.isArray(snapshot.promptTemplates) ? snapshot.promptTemplates : [],
    promptOverrides: Array.isArray(snapshot.promptOverrides) ? snapshot.promptOverrides : [],
    providerProvenance: Array.isArray(snapshot.providerProvenance) ? snapshot.providerProvenance : [],
    researchNoteDrafts: Array.isArray(snapshot.researchNoteDrafts) ? snapshot.researchNoteDrafts : [],
    graphSeeds: Array.isArray(snapshot.graphSeeds) ? snapshot.graphSeeds : [],
    citationRelations: Array.isArray(snapshot.citationRelations) ? snapshot.citationRelations : [],
    taskLedger: Array.isArray(snapshot.taskLedger) ? snapshot.taskLedger : [],
    researchTopics: Array.isArray(snapshot.researchTopics) ? snapshot.researchTopics : [],
    documentCandidates: Array.isArray(snapshot.documentCandidates) ? snapshot.documentCandidates : [],
    literatureDiscoveryJobs: Array.isArray(snapshot.literatureDiscoveryJobs) ? snapshot.literatureDiscoveryJobs : [],
    literatureDiscoveryFailures: Array.isArray(snapshot.literatureDiscoveryFailures) ? snapshot.literatureDiscoveryFailures : [],
    aiJobs: Array.isArray(snapshot.aiJobs) ? snapshot.aiJobs : [],
    aiTasks: Array.isArray(snapshot.aiTasks) ? snapshot.aiTasks : [],
    aiTaskResults: Array.isArray(snapshot.aiTaskResults) ? snapshot.aiTaskResults : [],
    aiTaskFailures: Array.isArray(snapshot.aiTaskFailures) ? snapshot.aiTaskFailures : [],
    aiTaskSkips: Array.isArray(snapshot.aiTaskSkips) ? snapshot.aiTaskSkips : [],
    aiJobDiagnoses: Array.isArray(snapshot.aiJobDiagnoses) ? snapshot.aiJobDiagnoses : []
  };
}

const WorkbenchSnapshot = {
  SECRET_PLACEHOLDER,
  createWorkbenchExportPackage,
  createWorkbenchZipExportPayload,
  importWorkbenchExportPackage,
  importWorkbenchZipExportPayload,
  normalizeSnapshotForExport,
  normalizeSnapshotForImport,
  redactSecretMaterial
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchSnapshot;
}

if (typeof window !== "undefined") {
  window.WorkbenchSnapshot = WorkbenchSnapshot;
}
