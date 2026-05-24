const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const snapshotPrefKey = "extensions.zotero-research-workbench.store.snapshot";

test("literature discovery create-plan button creates a plan and reports success", () => {
  const harness = createRuntimeHarness();
  harness.document.getElementById("research-topic-title").value = "Graph retrieval";
  harness.document.getElementById("research-topic-description").value = "Find related work";
  harness.document.getElementById("literature-discovery-request").value = "graph neural retrieval";
  harness.document.getElementById("literature-source-openalex").checked = true;
  harness.document.getElementById("literature-source-crossref").checked = true;

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();

  harness.document.getElementById("literature-discovery-create-plan").click();

  assert.equal(harness.window.WorkbenchLiteratureDiscoveryPlan.job.requestText, "graph neural retrieval");
  assert.equal(
    harness.document.getElementById("document-candidate-review-status").textContent,
    "发现计划已生成，请确认后搜索"
  );
  assert.match(harness.document.getElementById("literature-discovery-plan-preview").textContent, /计划预览：来源/);
  assert.equal(harness.document.getElementById("literature-discovery-confirm-search").hasAttribute("disabled"), false);
  assert.equal(JSON.parse(harness.prefs.get(snapshotPrefKey)).literatureDiscoveryJobs[0].id, "job-a");
});

test("literature discovery create-plan button reports workflow failures visibly", () => {
  const harness = createRuntimeHarness({
    planFailure: new Error("模拟发现计划失败")
  });

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();

  harness.document.getElementById("literature-discovery-create-plan").click();

  assert.equal(
    harness.document.getElementById("document-candidate-review-status").textContent,
    "模拟发现计划失败"
  );
});

test("literature discovery create-plan button binds when global navigator is unavailable", () => {
  const harness = createRuntimeHarness({
    exposeNavigatorGlobal: false
  });
  harness.document.getElementById("literature-discovery-request").value = "sci一区";

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();

  harness.document.getElementById("literature-discovery-create-plan").click();

  assert.equal(
    harness.document.getElementById("document-candidate-review-status").textContent,
    "发现计划已生成，请确认后搜索"
  );
});

test("literature discovery create-plan button gives visible feedback on a real click event", () => {
  const harness = createRuntimeHarness();
  const status = harness.document.getElementById("document-candidate-review-status");
  const preview = harness.document.getElementById("literature-discovery-plan-preview");

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  status.textContent = "异常候选需单独复核";
  preview.textContent = "暂无发现计划";

  harness.document.getElementById("literature-discovery-create-plan").click();

  assert.notEqual(status.textContent, "异常候选需单独复核");
  assert.equal(status.textContent, "发现计划已生成，请确认后搜索");
  assert.match(preview.textContent, /计划预览：来源/);
});

test("candidate review rendering exposes PDF status and import modes", () => {
  const harness = createRuntimeHarness();

  loadPaperSummaryRuntime(harness);
  harness.window.WorkbenchPaperSummary.renderDocumentCandidateReview({
    candidates: [
      {
        id: "candidate-a",
        title: "Candidate A",
        sourceAdapterId: "unpaywall",
        anomalyTags: [],
        quickImportAllowed: true,
        pdfStatusLabel: "可导入 PDF",
        pdfSources: ["unpaywall"],
        importableAttachmentIds: ["att-a"]
      }
    ],
    summary: { blockedCount: 0 }
  });

  const list = harness.document.getElementById("document-candidate-list");
  assert.match(list.textContent, /PDF 状态：可导入 PDF/);
  assert.match(list.textContent, /PDF 来源：unpaywall/);
  assert.match(list.textContent, /仅创建 Zotero 条目/);
  assert.match(list.textContent, /创建条目并附加 PDF/);
  assert.match(list.textContent, /仅为已有条目补 PDF/);
});

test("attachment-only import selections target the selected Zotero item", () => {
  const harness = createRuntimeHarness();
  harness.window.WorkbenchSelectedPaper = {
    id: 123,
    key: "ABCD1234",
    title: "Target Paper"
  };
  const checkbox = createFakeElement("input");
  checkbox.checked = true;
  checkbox.dataset.candidateId = "candidate-a";
  checkbox.dataset.attachmentId = "att-a";
  const mode = createFakeElement("select");
  mode.value = "attachment-only";
  mode.dataset.candidateId = "candidate-a";
  mode.dataset.attachmentId = "att-a";
  harness.document.querySelectorAll = (selector) =>
    selector === ".zotero-import-candidate" ? [checkbox] : [];
  harness.document.querySelector = (selector) =>
    selector === '.zotero-import-mode[data-candidate-id="candidate-a"]' ? mode : null;

  loadPaperSummaryRuntime(harness);

  const selections = JSON.parse(JSON.stringify(harness.window.WorkbenchPaperSummary.readZoteroImportSelections()));
  assert.deepEqual(selections, [
    {
      candidateId: "candidate-a",
      importMode: "attachment-only",
      attachmentId: "att-a",
      targetZoteroItemKey: "ABCD1234",
      targetZoteroItemId: 123
    }
  ]);
});

function loadPaperSummaryRuntime(harness) {
  const source = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
  vm.runInNewContext(source, harness.context, { filename: "paperSummary.js" });
}

function createRuntimeHarness({ exposeNavigatorGlobal = true, planFailure = null } = {}) {
  const document = createFakeDocument();
  const prefs = new Map([
    [snapshotPrefKey, JSON.stringify(createEmptySnapshot())]
  ]);
  const window = {
    console,
    document,
    __planFailure: planFailure,
    arguments: [{
      Zotero: {
        Prefs: {
          get: (key) => prefs.get(key) || "",
          set: (key, value) => prefs.set(key, value)
        }
      }
    }]
  };

  Object.assign(window, createWorkbenchRuntimeModules(window));

  const harness = {
    context: {
      Array,
      Boolean,
      Date,
      Error,
      JSON,
      Map,
      Number,
      Object,
      Promise,
      RegExp,
      Set,
      String,
      URL,
      console,
      document,
      encodeURIComponent,
      window
    },
    document,
    prefs,
    window
  };
  if (exposeNavigatorGlobal) {
    harness.context.navigator = {};
  }
  return harness;
}

function createWorkbenchRuntimeModules(window) {
  return {
    WorkbenchSnapshot: {
      SECRET_PLACEHOLDER: "<redacted>",
      createWorkbenchExportPackage: ({ snapshot, exportedAt }) => ({ snapshot, exportedAt }),
      createWorkbenchZipExportPayload: () => ({ entries: [] }),
      importWorkbenchExportPackage: ({ snapshot }) => snapshot,
      importWorkbenchZipExportPayload: ({ snapshot }) => snapshot,
      redactSecretMaterial: (value) => value
    },
    WorkbenchProviderChatCompletion: {
      parseChatCompletionText: () => "",
      requestOpenAICompatibleChatCompletion: async () => ""
    },
    WorkbenchRuntimeStore: {
      createWorkbenchRuntimeStore({ getPref, setPref, snapshotPrefKey: prefKey }) {
        return {
          loadSnapshot() {
            const raw = getPref(prefKey);
            return raw ? JSON.parse(raw) : createEmptySnapshot();
          },
          saveSnapshot(snapshot) {
            setPref(prefKey, JSON.stringify(snapshot));
            return snapshot;
          }
        };
      }
    },
    WorkbenchLocalStoreTransaction: createTransactionModule(),
    WorkbenchResearchTopic: {
      createResearchTopicInput({ title, description, sourceScopes, createdAt } = {}) {
        return {
          id: "topic-a",
          title: cleanText(title) || "未命名研究主题",
          description: cleanText(description),
          sourceScopes: Array.isArray(sourceScopes) ? sourceScopes : [],
          createdAt,
          linkedCandidateIds: [],
          linkedAiJobIds: []
        };
      }
    },
    WorkbenchGraphReviewWorkflow: {
      createGraphReviewReadModel: () => createEmptyGraphReview(),
      listGraphReviewDuplicateWorkCandidateEvidence: () => []
    },
    WorkbenchResearchPanelOrchestrator: {
      createResearchPanelOrchestrator() {
        return createOrchestrator(window);
      }
    },
    WorkbenchLlmRuntimeGuard: {
      assertLlmRuntimeRequestAllowed: () => {},
      createLlmRuntimeGuard: () => ({}),
      estimatePromptTokens: () => 0
    },
    WorkbenchZoteroNoteWriter: {
      writeZoteroChildNote: async () => ({}),
      writeZoteroStandaloneNote: async () => ({})
    },
    WorkbenchWebDavClient: {
      createWebDavClient: () => ({ requestWebDav: async () => ({ ok: true, status: 200 }) })
    },
    WorkbenchFetchRuntime: {
      createBrowserFetchRuntime: () => ({ fetch: async () => ({ ok: true, status: 200 }) })
    },
    WorkbenchClipboardWriter: {
      createBrowserClipboardWriter: () => ({ writeClipboardText: async () => {} })
    },
    WorkbenchFileRuntime: {
      createWorkbenchFileRuntime: () => ({
        pickWorkbenchExportFile: async () => null,
        pickDefaultWorkbenchExportFile: async () => null
      })
    },
    WorkbenchFileIo: {
      createBrowserWorkbenchFileIo: () => ({
        readTextFile: async () => "",
        readZipExportFile: async () => ({}),
        writeTextFile: async () => ({}),
        writeZipExportFile: async () => ({})
      })
    },
    WorkbenchSelectedPaperRuntime: {
      createBrowserSelectedPaperRuntime: () => ({
        getSelectedRegularItem: () => null,
        readSelectedPaperContext: () => null,
        readSelectedPaperContexts: () => [],
        readSelectedPaperPdfAttachment: () => null
      }),
      normalizePaperContext: (paper = {}) => paper,
      selectBestPdfAttachment: () => null
    },
    WorkbenchLiteratureDiscovery: {
      mergeDiscoverySourceResults: () => ({ candidates: [], failures: [] })
    },
    WorkbenchLiteratureSourceAdapters: {
      createOpenAlexAdapter: () => createSourceAdapter("openalex"),
      createCrossrefAdapter: () => createSourceAdapter("crossref"),
      createUnpaywallAdapter: () => createSourceAdapter("unpaywall"),
      createHttpConnectorAdapter: () => createSourceAdapter("http-connector")
    },
    WorkbenchZoteroWriteQueue: {
      createZoteroWriteQueue: () => ({ id: "queue-a", entries: [] }),
      createZoteroWriteQueueReadModel: () => ({ entries: [] }),
      recordZoteroWriteQueueEntryResult: (input) => input.queue,
      runNextZoteroWriteQueueEntry: () => ({ queue: { entries: [] }, entry: null })
    },
    WorkbenchZoteroItemWriter: {
      writeZoteroAttachmentFromIntent: async () => ({}),
      writeZoteroItemFromIntent: async () => ({})
    }
  };
}

function createTransactionModule() {
  return {
    createZoteroWriteQueueTransaction: ({ snapshot }) => ({ snapshot, queueId: "queue-a" }),
    recordLiteratureDiscoveryCandidatesTransaction: ({ snapshot }) => ({ snapshot, candidateIds: [] }),
    recordZoteroWriteQueueResultTransaction: ({ snapshot }) => ({ snapshot }),
    removePromptOverrideTransaction: ({ snapshot }) => ({ snapshot }),
    replaceWorkbenchSnapshotFromImportTransaction: ({ importedSnapshot }) => ({ snapshot: importedSnapshot }),
    upsertPromptOverrideTransaction: ({ snapshot }) => ({ snapshot })
  };
}

function createOrchestrator(window) {
  return {
    createPanelRecords: () => createPanelRecords(),
    createLiteratureDiscoveryPlanWorkflow({ snapshot, topicId, requestText, sourceScopes, sources, createdAt } = {}) {
      if (window.__planFailure) {
        throw window.__planFailure;
      }
      const normalizedSources = Array.isArray(sources) && sources.length ? sources : ["openalex"];
      const plan = {
        job: {
          id: "job-a",
          topicId,
          requestText,
          sourceScopes,
          sources: normalizedSources,
          maxCandidates: 50,
          state: "draft",
          createdAt
        },
        confirmation: {
          required: true,
          summary: "不会自动写入 Zotero。"
        }
      };
      return {
        status: "literatureDiscoveryPlanCreated",
        plan,
        snapshot: {
          ...snapshot,
          literatureDiscoveryJobs: [plan.job],
          taskLedger: [{ id: "task-job-a-create-literature-discovery-plan" }]
        },
        records: createPanelRecords()
      };
    }
  };
}

function createPanelRecords() {
  return {
    recentDrafts: [],
    recentGraphSeeds: [],
    recentTaskLedger: [],
    graphReview: createEmptyGraphReview(),
    aiTaskWorkspace: {},
    literatureDiscovery: { jobs: [], latestJob: null, candidateCount: 0, failureCount: 0 },
    candidateReview: { candidates: [], summary: { blockedCount: 0 } },
    zoteroWriteQueue: { entries: [] },
    etherealReference: { featureState: "reserved-for-v0.5", nodes: [] }
  };
}

function createSourceAdapter(sourceAdapterId) {
  return {
    sourceAdapterId,
    query: async () => ({ sourceAdapterId, candidates: [], failures: [] })
  };
}

function createEmptySnapshot() {
  return {
    schemaVersion: 1,
    exportedAt: "2026-05-24T00:00:00.000Z",
    providers: [],
    promptTemplates: [],
    promptOverrides: [],
    providerProvenance: [],
    researchNoteDrafts: [],
    graphSeeds: [],
    citationRelations: [],
    taskLedger: [],
    researchTopics: [],
    documentCandidates: [],
    literatureDiscoveryJobs: [],
    literatureDiscoveryFailures: [],
    zoteroImportPlans: [],
    zoteroWriteQueues: [],
    zoteroWriteResults: [],
    aiJobs: [],
    aiTasks: [],
    aiTaskResults: [],
    aiTaskFailures: [],
    aiTaskSkips: [],
    aiJobDiagnoses: []
  };
}

function createEmptyGraphReview() {
  return {
    graphSeedReviewQueue: [],
    citationRelations: [],
    workIdentities: [],
    duplicateWorkCandidates: [],
    counts: {
      graphSeedReviewQueue: 0,
      citationRelations: 0,
      workIdentities: 0,
      duplicateWorkCandidates: 0
    }
  };
}

function createFakeDocument() {
  const elements = new Map();
  let domContentLoaded = null;
  return {
    readyState: "loading",
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, createFakeElement("div", id));
      }
      return elements.get(id);
    },
    createElementNS(_namespace, tagName) {
      return createFakeElement(tagName);
    },
    createTextNode(text) {
      const node = createFakeElement("#text");
      node.textContent = text;
      return node;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(eventName, listener) {
      if (eventName === "DOMContentLoaded") {
        domContentLoaded = listener;
      }
    },
    fireDOMContentLoaded() {
      this.readyState = "complete";
      if (domContentLoaded) {
        domContentLoaded();
      }
    }
  };
}

function createFakeElement(tagName, id = "") {
  const attributes = new Map();
  const listeners = new Map();
  return {
    tagName,
    id,
    children: [],
    className: "",
    dataset: {},
    hidden: false,
    open: false,
    placeholder: "",
    type: "",
    value: "",
    checked: false,
    _textContent: "",
    get textContent() {
      return `${this._textContent}${this.children.map((child) => child.textContent || "").join("")}`;
    },
    set textContent(value) {
      this._textContent = String(value || "");
      this.children = [];
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener(eventName, listener) {
      listeners.set(eventName, listener);
    },
    click() {
      listeners.get("click")?.({ type: "click", target: this, currentTarget: this });
    },
    setAttribute(name, value) {
      attributes.set(name, value);
      if (name === "hidden") {
        this.hidden = true;
      }
    },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === "hidden") {
        this.hidden = false;
      }
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}
