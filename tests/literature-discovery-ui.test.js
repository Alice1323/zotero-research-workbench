const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const WorkbenchDocumentCandidateReview = require("../src/core/documentCandidateReview");
const WorkbenchLocalStoreTransaction = require("../src/core/workbenchLocalStoreTransaction");
const WorkbenchZoteroWriteQueue = require("../src/core/zoteroWriteQueue");

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

test("Sci-Hub resolver source is created from the configured URL template", async () => {
  const harness = createRuntimeHarness();
  harness.document.getElementById("literature-source-openalex").checked = false;
  harness.document.getElementById("literature-source-crossref").checked = false;
  harness.document.getElementById("literature-source-unpaywall").checked = false;
  harness.document.getElementById("literature-source-http-connector").checked = false;
  harness.document.getElementById("literature-source-sci-hub-resolver").checked = true;
  harness.document.getElementById("literature-source-sci-hub-resolver-template").value = "https://resolver.example/{doi}";

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  harness.document.getElementById("literature-discovery-create-plan").click();
  await harness.document.getElementById("literature-discovery-confirm-search").click();

  assert.deepEqual(JSON.parse(JSON.stringify(harness.window.__createdSourceAdapters)), [
    {
      sourceAdapterId: "sci-hub",
      resolverUrlTemplate: "https://resolver.example/{doi}"
    }
  ]);
  assert.deepEqual(harness.window.__queriedSourceAdapters, ["sci-hub"]);
});

test("Sci-Hub resolver source without a template reports a visible source failure", async () => {
  const harness = createRuntimeHarness();
  harness.document.getElementById("literature-source-openalex").checked = false;
  harness.document.getElementById("literature-source-crossref").checked = false;
  harness.document.getElementById("literature-source-unpaywall").checked = false;
  harness.document.getElementById("literature-source-http-connector").checked = false;
  harness.document.getElementById("literature-source-sci-hub-resolver").checked = true;
  harness.document.getElementById("literature-source-sci-hub-resolver-template").value = "";

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  harness.document.getElementById("literature-discovery-create-plan").click();
  await harness.document.getElementById("literature-discovery-confirm-search").click();

  assert.deepEqual(JSON.parse(JSON.stringify(harness.window.__createdSourceAdapters)), [
    {
      sourceAdapterId: "sci-hub",
      resolverUrlTemplate: ""
    }
  ]);
  assert.equal(
    harness.document.getElementById("document-candidate-review-status").textContent,
    "候选 0｜来源失败 1"
  );
});

test("PDF acquisition tab creates Sci-PDF adapter and renders provenance rows", async () => {
  const harness = createRuntimeHarness();
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = true;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = false;
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = "https://sci-hub.se/";
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.1000/pdf-tab"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  await harness.document.getElementById("pdf-acquisition-find-candidates").click();

  assert.deepEqual(JSON.parse(JSON.stringify(harness.window.__createdSourceAdapters)), [
    {
      sourceAdapterId: "sci-pdf",
      baseUrls: ["https://sci-hub.se/"]
    }
  ]);
  const listText = harness.document.getElementById("pdf-acquisition-candidate-list").textContent;
  assert.match(listText, /Sci-PDF/);
  assert.match(listText, /sci-hub-resolved-url/);
  assert.match(listText, /source https:\/\/sci-hub\.se\/10\.1000%2Fpdf-tab/);
  assert.match(listText, /request https:\/\/sci-hub\.se\/10\.1000%2Fpdf-tab/);
  assert.equal(harness.document.getElementById("pdf-acquisition-status").textContent, "PDF 候选 1｜来源失败 0");
});

test("PDF acquisition open access source creates publisher PDF adapter", async () => {
  const harness = createRuntimeHarness();
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = false;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = true;
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.17816/pavlovj70596-52746"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  await harness.document.getElementById("pdf-acquisition-find-candidates").click();

  assert.deepEqual(JSON.parse(JSON.stringify(harness.window.__createdSourceAdapters)), [
    { sourceAdapterId: "publisher-pdf" }
  ]);
  const listText = harness.document.getElementById("pdf-acquisition-candidate-list").textContent;
  assert.match(listText, /Publisher PDF Candidate/);
  assert.match(listText, /open-access-pdf-url/);
  assert.match(listText, /source https:\/\/journals\.eco-vector\.com\/pavlovj\/article\/view\/70596/);
  assert.equal(harness.document.getElementById("pdf-acquisition-status").textContent, "PDF 候选 1｜来源失败 0");
});

test("PDF acquisition queries Sci-PDF before publisher fallback when both are enabled", async () => {
  const harness = createRuntimeHarness();
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = true;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = true;
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = "https://sci-hub.red/";
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.1371/journal.pone.0000308"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  await harness.document.getElementById("pdf-acquisition-find-candidates").click();

  assert.deepEqual(harness.window.__createdSourceAdapters.map((adapter) => adapter.sourceAdapterId), [
    "sci-pdf",
    "publisher-pdf"
  ]);
  assert.deepEqual(harness.window.__queriedSourceAdapters, ["sci-pdf", "publisher-pdf"]);
});

test("PDF acquisition gives Sci-PDF enough source budget for ten DOI batches", async () => {
  const harness = createRuntimeHarness({ controlledSciPdfQuery: true });
  harness.context.setTimeout = setTimeout;
  harness.context.clearTimeout = clearTimeout;
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = true;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = false;
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = "https://sci-hub.red/";
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.1371/journal.pone.0000308"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  const clickResult = harness.document.getElementById("pdf-acquisition-find-candidates").click();

  await new Promise((resolve) => setTimeout(resolve, 9000));
  assert.equal(
    harness.document.getElementById("pdf-acquisition-status").textContent,
    "正在查找当前选中文献 PDF..."
  );
  assert.equal(harness.document.getElementById("pdf-acquisition-find-candidates").hasAttribute("disabled"), true);

  harness.window.__resolveControlledSciPdfQuery();
  await clickResult;

  assert.equal(harness.document.getElementById("pdf-acquisition-status").textContent, "PDF 候选 1｜来源失败 0");
});

test("PDF acquisition find button gives immediate progress before slow sources finish", async () => {
  const harness = createRuntimeHarness({ slowSciPdfQuery: true });
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = true;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = false;
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = "https://sci-hub.se/";
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.1000/pdf-tab"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  const clickResult = harness.document.getElementById("pdf-acquisition-find-candidates").click();

  assert.equal(
    harness.document.getElementById("pdf-acquisition-status").textContent,
    "正在查找当前选中文献 PDF..."
  );
  assert.equal(harness.document.getElementById("pdf-acquisition-find-candidates").hasAttribute("disabled"), true);

  await Promise.resolve();
  harness.window.__resolveSlowSciPdfQuery();
  await clickResult;

  assert.equal(harness.document.getElementById("pdf-acquisition-status").textContent, "PDF 候选 1｜来源失败 0");
  assert.equal(harness.document.getElementById("pdf-acquisition-find-candidates").hasAttribute("disabled"), false);
});

test("PDF acquisition find button reports source exceptions visibly", async () => {
  const harness = createRuntimeHarness({ pdfSourceFailure: new Error("模拟 PDF 来源失败") });
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = false;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = true;
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.17816/pavlovj70596-52746"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  await harness.document.getElementById("pdf-acquisition-find-candidates").click();

  assert.equal(harness.document.getElementById("pdf-acquisition-status").textContent, "模拟 PDF 来源失败");
  assert.match(harness.document.getElementById("pdf-acquisition-candidate-list").textContent, /暂无 PDF 候选/);
  assert.equal(harness.document.getElementById("pdf-acquisition-find-candidates").hasAttribute("disabled"), false);
});

test("PDF acquisition diagnostics show actual DOI sources and source settings when no DOI is collected", async () => {
  const harness = createRuntimeHarness();
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = true;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = true;
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = [
    "https://sci-hub.red/",
    "https://bad.invalid/",
    "not a url"
  ].join("\n");
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper Without DOI"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  await harness.document.getElementById("pdf-acquisition-find-batch-candidates").click();

  const diagnosticsText = harness.document.getElementById("pdf-acquisition-diagnostics").textContent;
  assert.match(diagnosticsText, /PDF 获取诊断/);
  assert.match(diagnosticsText, /DOI：未收集到 DOI/);
  assert.match(diagnosticsText, /来源顺序：sci-pdf -> publisher-pdf/);
  assert.match(diagnosticsText, /Sci-PDF 站点：2 个/);
  assert.match(diagnosticsText, /https:\/\/sci-hub\.red\//);
  assert.match(diagnosticsText, /https:\/\/bad\.invalid\//);
  assert.match(diagnosticsText, /已忽略无效站点：not a url/);
  assert.match(diagnosticsText, /选中文献：Selected Paper Without DOI/);
});

test("PDF acquisition diagnostics show per-source failure details when all PDF sources miss", async () => {
  const harness = createRuntimeHarness({
    pdfSourceFailures: {
      "sci-pdf": [{
        sourceAdapterId: "sci-pdf",
        userMessage: "Sci-PDF did not find a PDF for DOI",
        error: {
          doi: "10.1145/337563.337564",
          failures: [{
            reason: "pdf-selector-missing",
            status: 200,
            requestUrl: "https://sci-hub.red/10.1145%2F337563.337564",
            message: "pdf-selector-missing"
          }]
        }
      }],
      "publisher-pdf": [{
        sourceAdapterId: "publisher-pdf",
        userMessage: "publisher-pdf returned HTTP 404",
        status: 404,
        error: {
          doi: "10.1145/337563.337564",
          requestUrl: "https://api.crossref.org/works/10.1145%2F337563.337564",
          status: 404
        }
      }]
    }
  });
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = true;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = true;
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = "https://sci-hub.red/";
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.1145/337563.337564"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  await harness.document.getElementById("pdf-acquisition-find-candidates").click();

  assert.equal(
    harness.document.getElementById("pdf-acquisition-status").textContent,
    "未找到 PDF 候选｜来源失败 2｜详情见 PDF 获取诊断"
  );
  const diagnosticsText = harness.document.getElementById("pdf-acquisition-diagnostics").textContent;
  assert.match(diagnosticsText, /DOI：10.1145\/337563.337564/);
  assert.match(diagnosticsText, /来源顺序：sci-pdf -> publisher-pdf/);
  assert.match(diagnosticsText, /sci-pdf：候选 0｜失败 1｜耗时/);
  assert.match(diagnosticsText, /publisher-pdf：候选 0｜失败 1｜耗时/);
  assert.match(diagnosticsText, /Sci-PDF did not find a PDF for DOI/);
  assert.match(diagnosticsText, /pdf-selector-missing/);
  assert.match(diagnosticsText, /status 200/);
  assert.match(diagnosticsText, /request https:\/\/sci-hub\.red\/10\.1145%2F337563\.337564/);
  assert.match(diagnosticsText, /publisher-pdf returned HTTP 404/);
  assert.match(diagnosticsText, /request https:\/\/api\.crossref\.org\/works\/10\.1145%2F337563\.337564/);
});

test("PDF acquisition limits large DOI batches and prioritizes Sci-PDF-likely DOI values", async () => {
  const harness = createRuntimeHarness();
  const lowPriorityDois = Array.from({ length: 35 }, (_entry, index) => `10.12677/acm.2025.${index + 1000}`);
  const snapshot = {
    ...createEmptySnapshot(),
    documentCandidates: [
      ...lowPriorityDois.map((doi, index) => ({
        id: `candidate-low-${index}`,
        title: `Low priority ${index}`,
        doi
      })),
      {
        id: "candidate-high-cell",
        title: "High priority Cell paper",
        doi: "10.1016/j.cell.2016.02.054"
      },
      {
        id: "candidate-high-nature",
        title: "High priority Nature paper",
        doi: "10.1038/nature12373"
      }
    ]
  };
  harness.prefs.set(snapshotPrefKey, JSON.stringify(snapshot));
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = true;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = false;
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = "https://sci-hub.red/";
  harness.window.WorkbenchSelectedPaper = null;

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  await harness.document.getElementById("pdf-acquisition-find-batch-candidates").click();

  assert.equal(harness.window.__pdfSourceDoiQueries.length, 1);
  assert.equal(harness.window.__pdfSourceDoiQueries[0].sourceAdapterId, "sci-pdf");
  assert.equal(harness.window.__pdfSourceDoiQueries[0].documentCandidateCount, 0);
  assert.ok(harness.window.__pdfSourceDoiQueries[0].dois.length <= 20);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.window.__pdfSourceDoiQueries[0].dois.slice(0, 2))), [
    "10.1016/j.cell.2016.02.054",
    "10.1038/nature12373"
  ]);
  const diagnosticsText = harness.document.getElementById("pdf-acquisition-diagnostics").textContent;
  assert.match(diagnosticsText, /DOI：37 个/);
  assert.match(diagnosticsText, /sci-pdf：候选 1｜失败 0｜耗时 .*｜DOI 20\/37｜跳过 17/);
  assert.match(diagnosticsText, /DOI 示例：10.1016\/j.cell.2016.02.054；10.1038\/nature12373/);
});

test("PDF acquisition selected-paper button only queries the current Zotero item DOI", async () => {
  const harness = createRuntimeHarness();
  const snapshot = {
    ...createEmptySnapshot(),
    documentCandidates: [
      { id: "candidate-a", title: "Batch A", doi: "10.1016/j.cell.2016.02.054" },
      { id: "candidate-b", title: "Batch B", doi: "10.1038/nature12373" }
    ]
  };
  harness.prefs.set(snapshotPrefKey, JSON.stringify(snapshot));
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = true;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = false;
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = "https://sci-hub.red/";
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.1371/journal.pone.0000308"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  await harness.document.getElementById("pdf-acquisition-find-candidates").click();

  assert.equal(harness.window.__pdfSourceDoiQueries.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.window.__pdfSourceDoiQueries[0].dois)), [
    "10.1371/journal.pone.0000308"
  ]);
  assert.equal(harness.window.__pdfSourceDoiQueries[0].selectedItemCount, 1);
  assert.equal(harness.window.__pdfSourceDoiQueries[0].documentCandidateCount, 0);
  assert.match(harness.document.getElementById("pdf-acquisition-diagnostics").textContent, /查询范围：当前选中文献/);
  assert.equal(harness.document.getElementById("pdf-acquisition-doi-status").textContent, "1");
});

test("PDF acquisition selected-paper button refreshes the current Zotero selection before collecting DOI", async () => {
  const harness = createRuntimeHarness();
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = true;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = false;
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = "https://sci-hub.red/";
  harness.window.__selectedPaperRuntimeContexts = [];

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  harness.window.__selectedPaperRuntimeContexts = [{
    id: 42,
    key: "LIVE1234",
    title: "Live Selected Paper",
    doi: "10.1371/journal.pone.0000308"
  }];

  await harness.document.getElementById("pdf-acquisition-find-candidates").click();

  assert.deepEqual(JSON.parse(JSON.stringify(harness.window.__pdfSourceDoiQueries[0].dois)), [
    "10.1371/journal.pone.0000308"
  ]);
  assert.equal(harness.document.getElementById("pdf-acquisition-selected-status").textContent, "Live Selected Paper");
  assert.match(harness.document.getElementById("pdf-acquisition-diagnostics").textContent, /选中文献：Live Selected Paper/);
});

test("PDF acquisition batch button queries discovery candidate DOI without selected item context", async () => {
  const harness = createRuntimeHarness();
  const snapshot = {
    ...createEmptySnapshot(),
    documentCandidates: [
      { id: "candidate-a", title: "Batch A", doi: "10.1016/j.cell.2016.02.054" },
      { id: "candidate-b", title: "Batch B", doi: "10.1038/nature12373" }
    ]
  };
  harness.prefs.set(snapshotPrefKey, JSON.stringify(snapshot));
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = true;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = false;
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = "https://sci-hub.red/";
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.1371/journal.pone.0000308"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  await harness.document.getElementById("pdf-acquisition-find-batch-candidates").click();

  assert.equal(harness.window.__pdfSourceDoiQueries.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.window.__pdfSourceDoiQueries[0].dois)), [
    "10.1016/j.cell.2016.02.054",
    "10.1038/nature12373"
  ]);
  assert.equal(harness.window.__pdfSourceDoiQueries[0].selectedItemCount, 0);
  assert.equal(harness.window.__pdfSourceDoiQueries[0].documentCandidateCount, 0);
  assert.match(harness.document.getElementById("pdf-acquisition-diagnostics").textContent, /查询范围：发现候选 DOI 批量/);
  assert.equal(harness.document.getElementById("pdf-acquisition-doi-status").textContent, "2");
});

test("PDF acquisition find button times out stuck sources and restores the button", async () => {
  const harness = createRuntimeHarness({ stuckPublisherQuery: true });
  harness.context.setTimeout = (_callback, _delay) => setTimeout(_callback, 1);
  harness.context.clearTimeout = clearTimeout;
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = false;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = true;
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.17816/pavlovj70596-52746"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  await harness.document.getElementById("pdf-acquisition-find-candidates").click();

  assert.match(harness.document.getElementById("pdf-acquisition-status").textContent, /PDF 来源查询超时/);
  assert.equal(harness.document.getElementById("pdf-acquisition-find-candidates").hasAttribute("disabled"), false);
});

test("PDF acquisition gives publisher PDF enough source budget for Crossref and publisher pages", async () => {
  const harness = createRuntimeHarness({ controlledPublisherQuery: true });
  harness.context.setTimeout = setTimeout;
  harness.context.clearTimeout = clearTimeout;
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = false;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = true;
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.17816/pavlovj70596-52746"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  const clickResult = harness.document.getElementById("pdf-acquisition-find-candidates").click();

  await new Promise((resolve) => setTimeout(resolve, 9000));
  assert.equal(
    harness.document.getElementById("pdf-acquisition-status").textContent,
    "正在查找当前选中文献 PDF..."
  );
  assert.equal(harness.document.getElementById("pdf-acquisition-find-candidates").hasAttribute("disabled"), true);

  harness.window.__resolveControlledPublisherQuery();
  await clickResult;

  assert.equal(harness.document.getElementById("pdf-acquisition-status").textContent, "PDF 候选 1｜来源失败 0");
  assert.equal(harness.document.getElementById("pdf-acquisition-find-candidates").hasAttribute("disabled"), false);
});

test("PDF acquisition test-sites button gives immediate feedback and probes configured DOI sites", async () => {
  const harness = createRuntimeHarness();
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = [
    "https://sci-hub.se/",
    "https://bad.invalid/",
    "not a url"
  ].join("\n");
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.1000/pdf-tab"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  const clickResult = harness.document.getElementById("pdf-source-scipdf-test-sites").click();

  assert.equal(
    harness.document.getElementById("pdf-source-scipdf-test-status").textContent,
    "正在测试 2 个 Sci-PDF 站点..."
  );
  await clickResult;

  assert.deepEqual(JSON.parse(JSON.stringify(harness.window.__scipdfSiteTestCalls)), [
    { doi: "10.1000/pdf-tab", baseUrls: ["https://sci-hub.se/"] },
    { doi: "10.1000/pdf-tab", baseUrls: ["https://bad.invalid/"] }
  ]);
  assert.equal(
    harness.document.getElementById("pdf-source-scipdf-test-status").textContent,
    "Sci-PDF 站点测试：可用 1｜失败 1｜DOI 10.1000/pdf-tab｜https://sci-hub.se/ 可用｜https://bad.invalid/ 失败 fetch-error"
  );
  assert.equal(
    harness.document.getElementById("pdf-acquisition-status").textContent,
    "Sci-PDF 站点测试：可用 1｜失败 1｜DOI 10.1000/pdf-tab｜https://sci-hub.se/ 可用｜https://bad.invalid/ 失败 fetch-error"
  );
});

test("PDF acquisition add-to-write-plan stores candidates and queues attachment writes without running Zotero", async () => {
  const harness = createRuntimeHarness();
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = true;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = false;
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = "https://sci-hub.se/";
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.1000/pdf-tab"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  await harness.document.getElementById("pdf-acquisition-find-candidates").click();
  harness.document.getElementById("pdf-acquisition-add-to-write-plan").click();

  const snapshot = JSON.parse(harness.prefs.get(snapshotPrefKey));
  assert.equal(
    harness.document.getElementById("pdf-acquisition-status").textContent,
    "写入计划已创建：条目 0｜附件 1"
  );
  assert.equal(snapshot.documentCandidates.length, 1);
  assert.equal(snapshot.documentCandidates[0].id, "candidate-scipdf");
  assert.equal(snapshot.zoteroImportPlans.length, 1);
  assert.deepEqual(snapshot.zoteroImportPlans[0].expectedWrites, { items: 0, attachments: 1 });
  assert.deepEqual(snapshot.zoteroImportPlans[0].selections[0], {
    candidateId: "candidate-scipdf",
    importMode: "attachment-only",
    attachmentId: "att-scipdf",
    targetZoteroItemKey: "ABCD1234",
    targetZoteroItemId: 42
  });
  assert.equal(snapshot.zoteroWriteQueues.length, 1);
  assert.equal(snapshot.zoteroWriteQueues[0].entries.length, 1);
  assert.equal(snapshot.zoteroWriteQueues[0].entries[0].kind, "create-attachment");
  assert.equal(harness.window.__writeZoteroItemCalls || 0, 0);
  assert.equal(harness.window.__writeZoteroAttachmentCalls || 0, 0);
});

test("PDF acquisition candidate row can queue only that PDF candidate", async () => {
  const harness = createRuntimeHarness();
  harness.window.WorkbenchPdfAcquisitionScope = "selected";
  harness.window.WorkbenchSelectedPaper = {
    id: 123,
    key: "ABCD1234",
    title: "Target Paper"
  };
  harness.window.WorkbenchPdfAcquisitionCandidates = [
    createPdfCandidateFixture("candidate-a", "att-a", "Candidate A", "10.1000/a"),
    createPdfCandidateFixture("candidate-b", "att-b", "Candidate B", "10.1000/b")
  ];

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  harness.window.WorkbenchPaperSummary.renderPdfAcquisitionCandidates(harness.window.WorkbenchPdfAcquisitionCandidates);
  const list = harness.document.getElementById("pdf-acquisition-candidate-list");
  const buttons = findFakeElements(list, (element) => element.tagName === "button" && element.textContent === "加入此 PDF");
  assert.equal(buttons.length, 2);

  buttons[0].click();

  const snapshot = JSON.parse(harness.prefs.get(snapshotPrefKey));
  assert.equal(
    harness.document.getElementById("pdf-acquisition-status").textContent,
    "写入计划已创建：条目 0｜附件 1"
  );
  assert.deepEqual(snapshot.documentCandidates.map((candidate) => candidate.id), ["candidate-a"]);
  assert.deepEqual(snapshot.zoteroImportPlans[0].candidateIds, ["candidate-a"]);
  assert.deepEqual(snapshot.zoteroImportPlans[0].selections[0], {
    candidateId: "candidate-a",
    importMode: "attachment-only",
    attachmentId: "att-a",
    targetZoteroItemKey: "ABCD1234",
    targetZoteroItemId: 123
  });
  assert.equal(snapshot.zoteroWriteQueues[0].entries.length, 1);
  assert.equal(harness.document.getElementById("pdf-acquisition-run-write-queue").hasAttribute("disabled"), false);
  assert.match(harness.document.getElementById("pdf-acquisition-inline-write-queue").textContent, /运行写入队列/);
  assert.match(harness.document.getElementById("zotero-write-queue-list").textContent, /运行写入队列/);
});

test("PDF acquisition inline write queue button runs queued PDF writes with visible progress", async () => {
  const harness = createRuntimeHarness();
  harness.window.WorkbenchPdfAcquisitionScope = "selected";
  harness.window.WorkbenchSelectedPaper = {
    id: 123,
    key: "ABCD1234",
    title: "Target Paper"
  };
  harness.window.WorkbenchPdfAcquisitionCandidates = [
    createPdfCandidateFixture("candidate-a", "att-a", "Candidate A", "10.1000/a")
  ];

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  harness.window.WorkbenchPaperSummary.renderPdfAcquisitionCandidates(harness.window.WorkbenchPdfAcquisitionCandidates);
  const list = harness.document.getElementById("pdf-acquisition-candidate-list");
  const [addButton] = findFakeElements(list, (element) => element.tagName === "button" && element.textContent === "加入此 PDF");
  addButton.click();

  const runButton = harness.document.getElementById("pdf-acquisition-run-write-queue");
  const runPromise = runButton.click();

  assert.equal(runButton.hasAttribute("disabled"), true);
  assert.match(harness.document.getElementById("pdf-acquisition-inline-write-queue").textContent, /正在运行写入队列/);

  await runPromise;

  assert.equal(harness.window.__writeZoteroItemCalls || 0, 0);
  assert.equal(harness.window.__writeZoteroAttachmentCalls, 1);
  assert.equal(runButton.hasAttribute("disabled"), false);
  assert.match(harness.document.getElementById("pdf-acquisition-inline-write-queue").textContent, /写入队列已完成/);
  assert.match(harness.document.getElementById("pdf-acquisition-status").textContent, /PDF 成功 1｜失败 0/);
});

test("PDF acquisition run button recovers the last added PDF queue from the saved snapshot", async () => {
  const harness = createRuntimeHarness();
  harness.window.WorkbenchPdfAcquisitionScope = "selected";
  harness.window.WorkbenchSelectedPaper = {
    id: 123,
    key: "ABCD1234",
    title: "Target Paper"
  };
  harness.window.WorkbenchPdfAcquisitionCandidates = [
    createPdfCandidateFixture("candidate-a", "att-a", "Candidate A", "10.1000/a")
  ];

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  harness.window.WorkbenchPaperSummary.renderPdfAcquisitionCandidates(harness.window.WorkbenchPdfAcquisitionCandidates);
  const list = harness.document.getElementById("pdf-acquisition-candidate-list");
  const [addButton] = findFakeElements(list, (element) => element.tagName === "button" && element.textContent === "加入此 PDF");
  addButton.click();

  harness.window.WorkbenchActivePdfAcquisitionWriteQueue = null;
  const runButton = harness.document.getElementById("pdf-acquisition-run-write-queue");
  const runPromise = runButton.click();

  assert.match(harness.document.getElementById("pdf-acquisition-inline-write-queue").textContent, /已点击运行写入队列/);

  await runPromise;

  assert.equal(harness.window.__writeZoteroAttachmentCalls, 1);
  assert.match(harness.document.getElementById("pdf-acquisition-status").textContent, /PDF 成功 1｜失败 0/);
});

test("PDF acquisition inline write queue reports attachment write failures in diagnostics", async () => {
  const harness = createRuntimeHarness({
    attachmentWriteFailure: new Error("Invalid URL ''")
  });
  harness.window.WorkbenchPdfAcquisitionScope = "selected";
  harness.window.WorkbenchSelectedPaper = {
    id: 123,
    key: "ABCD1234",
    title: "Target Paper"
  };
  harness.window.WorkbenchPdfAcquisitionCandidates = [
    createPdfCandidateFixture("candidate-a", "att-a", "Candidate A", "10.1000/a")
  ];

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  harness.window.WorkbenchPaperSummary.renderPdfAcquisitionCandidates(harness.window.WorkbenchPdfAcquisitionCandidates);
  const list = harness.document.getElementById("pdf-acquisition-candidate-list");
  const [addButton] = findFakeElements(list, (element) => element.tagName === "button" && element.textContent === "加入此 PDF");
  addButton.click();

  await harness.document.getElementById("pdf-acquisition-run-write-queue").click();

  assert.match(harness.document.getElementById("pdf-acquisition-status").textContent, /PDF 成功 0｜失败 1/);
  assert.match(harness.document.getElementById("pdf-acquisition-diagnostics").textContent, /Zotero 写入诊断/);
  assert.match(harness.document.getElementById("pdf-acquisition-diagnostics").textContent, /Invalid URL/);
});

test("PDF acquisition inline write queue button remains clickable before a queue exists", () => {
  const harness = createRuntimeHarness();

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();

  const runButton = harness.document.getElementById("pdf-acquisition-run-write-queue");
  assert.equal(runButton.hasAttribute("disabled"), false);

  runButton.click();

  assert.match(harness.document.getElementById("pdf-acquisition-status").textContent, /暂无写入队列/);
});

test("PDF acquisition inline write queue button does not report stale completed queues", () => {
  const harness = createRuntimeHarness();
  const oldQueue = createCompletedWriteQueueFixture({ entryCount: 10, createdAt: "2026-05-24T17:28:42.509Z" });
  harness.prefs.set(snapshotPrefKey, JSON.stringify({
    ...createEmptySnapshot(),
    zoteroWriteQueues: [oldQueue]
  }));

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();

  harness.document.getElementById("pdf-acquisition-run-write-queue").click();

  assert.match(harness.document.getElementById("pdf-acquisition-status").textContent, /暂无写入队列/);
  assert.doesNotMatch(harness.document.getElementById("pdf-acquisition-status").textContent, /成功 10/);
  assert.equal(harness.window.__writeZoteroItemCalls || 0, 0);
  assert.equal(harness.window.__writeZoteroAttachmentCalls || 0, 0);
});

test("PDF acquisition inline write queue button ignores a stale completed in-memory queue", () => {
  const harness = createRuntimeHarness();
  harness.window.WorkbenchActivePdfAcquisitionWriteQueue = createCompletedWriteQueueFixture({
    entryCount: 10,
    createdAt: "2026-05-24T17:28:42.509Z"
  });

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();

  harness.document.getElementById("pdf-acquisition-run-write-queue").click();

  assert.match(harness.document.getElementById("pdf-acquisition-status").textContent, /暂无写入队列/);
  assert.doesNotMatch(harness.document.getElementById("pdf-acquisition-status").textContent, /成功 10/);
  assert.equal(harness.window.__writeZoteroItemCalls || 0, 0);
  assert.equal(harness.window.__writeZoteroAttachmentCalls || 0, 0);
});

test("PDF acquisition search clears a stale inline write queue before a new PDF is added", async () => {
  const harness = createRuntimeHarness();
  harness.window.WorkbenchActivePdfAcquisitionWriteQueue = createCompletedWriteQueueFixture({
    entryCount: 10,
    createdAt: "2026-05-24T17:28:42.509Z"
  });
  harness.document.getElementById("pdf-source-scipdf-enabled").checked = true;
  harness.document.getElementById("pdf-source-open-access-enabled").checked = false;
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = "https://sci-hub.se/";
  harness.window.WorkbenchSelectedPaper = {
    id: 42,
    key: "ABCD1234",
    title: "Selected Paper",
    DOI: "10.1000/pdf-tab"
  };

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  await harness.document.getElementById("pdf-acquisition-find-candidates").click();
  harness.document.getElementById("pdf-acquisition-run-write-queue").click();

  assert.match(harness.document.getElementById("pdf-acquisition-status").textContent, /暂无写入队列/);
  assert.doesNotMatch(harness.document.getElementById("pdf-acquisition-status").textContent, /成功 10/);
});

test("PDF acquisition default rendering does not sync Zotero Find Full Text resolvers", () => {
  const harness = createRuntimeHarness();
  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();

  assert.equal(harness.prefs.has("extensions.zotero.findPDFs.resolvers"), false);
  assert.equal(harness.document.getElementById("pdf-source-scipdf-sync-enabled").checked, false);
});

test("workbench tabs scroll to PDF acquisition and Zotero write queue sections", () => {
  const harness = createRuntimeHarness();
  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();

  harness.document.getElementById("workbench-tab-zotero-write").click();

  assert.equal(harness.document.getElementById("workbench-tab-zotero-write").attributes.get("aria-selected"), "true");
  assert.equal(harness.document.getElementById("workbench-tab-pdf-acquisition").attributes.get("aria-selected"), "false");
  assert.equal(harness.document.getElementById("zotero-write-queue-list").scrollIntoViewCalls, 1);
  assert.equal(harness.document.getElementById("zotero-write-queue-list").focusCalls, 1);

  harness.document.getElementById("workbench-tab-pdf-acquisition").click();

  assert.equal(harness.document.getElementById("workbench-tab-pdf-acquisition").attributes.get("aria-selected"), "true");
  assert.equal(harness.document.getElementById("workbench-tab-zotero-write").attributes.get("aria-selected"), "false");
  assert.equal(harness.document.getElementById("pdf-acquisition-panel").scrollIntoViewCalls, 1);
});

test("PDF acquisition sync writes Zotero Find Full Text resolvers only after explicit action", () => {
  const harness = createRuntimeHarness();
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = "https://sci-hub.se/";
  harness.document.getElementById("pdf-source-scipdf-sync-enabled").checked = true;

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  assert.equal(harness.prefs.has("extensions.zotero.findPDFs.resolvers"), false);

  harness.document.getElementById("pdf-source-scipdf-sync-zotero").click();

  const raw = harness.prefs.get("extensions.zotero.findPDFs.resolvers");
  const resolvers = JSON.parse(raw);
  assert.equal(resolvers.length, 1);
  assert.equal(resolvers[0].name, "Sci-Hub");
  assert.equal(resolvers[0].url, "https://sci-hub.se/{doi}");
  assert.equal(resolvers[0].automatic, false);
  assert.equal(harness.document.getElementById("pdf-acquisition-status").textContent, "已同步 1 个 Sci-PDF resolver 到 Zotero Find Full Text");
});

test("PDF acquisition sync refuses to write when advanced checkbox is off", () => {
  const harness = createRuntimeHarness();
  harness.document.getElementById("pdf-source-scipdf-base-urls").value = "https://sci-hub.se/";
  harness.document.getElementById("pdf-source-scipdf-sync-enabled").checked = false;

  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();
  harness.document.getElementById("pdf-source-scipdf-sync-zotero").click();

  assert.equal(harness.prefs.has("extensions.zotero.findPDFs.resolvers"), false);
  assert.equal(harness.document.getElementById("pdf-acquisition-status").textContent, "请先开启同步到 Zotero Find Full Text");
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
        importableAttachmentIds: ["att-a"],
        attachments: [
          {
            id: "att-a",
            kind: "sci-hub-resolved-url",
            url: "https://resolver.example/a.pdf",
            importable: true,
            license: "unknown",
            provenance: {
              source: "sci-hub",
              sourceUrl: "https://sci-hub.example/10.1000/a",
              requestUrl: "https://resolver.example/10.1000%2Fa"
            }
          }
        ]
      }
    ],
    summary: { blockedCount: 0 }
  });

  const list = harness.document.getElementById("document-candidate-list");
  assert.match(list.textContent, /PDF 状态：可导入 PDF/);
  assert.match(list.textContent, /PDF 来源：unpaywall/);
  assert.match(list.textContent, /PDF 详情：sci-hub/);
  assert.match(list.textContent, /sci-hub-resolved-url/);
  assert.match(list.textContent, /可导入/);
  assert.match(list.textContent, /license unknown/);
  assert.match(list.textContent, /source https:\/\/sci-hub\.example\/10\.1000\/a/);
  assert.match(list.textContent, /request https:\/\/resolver\.example\/10\.1000%2Fa/);
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

function createRuntimeHarness({
  exposeNavigatorGlobal = true,
  planFailure = null,
  pdfSourceFailure = null,
  pdfSourceFailures = null,
  attachmentWriteFailure = null,
  slowSciPdfQuery = false,
  controlledSciPdfQuery = false,
  stuckPublisherQuery = false,
  controlledPublisherQuery = false
} = {}) {
  const document = createFakeDocument();
  const prefs = new Map([
    [snapshotPrefKey, JSON.stringify(createEmptySnapshot())]
  ]);
  const window = {
    console,
    document,
    __planFailure: planFailure,
    __pdfSourceFailure: pdfSourceFailure,
    __pdfSourceFailures: pdfSourceFailures,
    __attachmentWriteFailure: attachmentWriteFailure,
    __slowSciPdfQuery: slowSciPdfQuery,
    __controlledSciPdfQuery: controlledSciPdfQuery,
    __stuckPublisherQuery: stuckPublisherQuery,
    __controlledPublisherQuery: controlledPublisherQuery,
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
    WorkbenchLocalStoreTransaction,
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
    WorkbenchDocumentCandidateReview,
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
        readSelectedPaperContext: () =>
          Array.isArray(window.__selectedPaperRuntimeContexts)
            ? window.__selectedPaperRuntimeContexts[0] || null
            : window.WorkbenchSelectedPaper || null,
        readSelectedPaperContexts: () =>
          Array.isArray(window.__selectedPaperRuntimeContexts)
            ? window.__selectedPaperRuntimeContexts
            : window.WorkbenchSelectedPaper ? [window.WorkbenchSelectedPaper] : [],
        readSelectedPaperPdfAttachment: () => null
      }),
      normalizePaperContext: (paper = {}) => paper,
      selectBestPdfAttachment: () => null
    },
    WorkbenchLiteratureDiscovery: {
      mergeDiscoverySourceResults: (sourceResults = []) => ({
        candidates: sourceResults.flatMap((result) => result.candidates || []),
        failures: sourceResults.flatMap((result) => result.failures || [])
      })
    },
    WorkbenchSciPdfEmbeddedResolver: {
      createSciPdfCustomResolvers: (baseUrls = [], { automatic = false } = {}) =>
        (Array.isArray(baseUrls) ? baseUrls : [baseUrls])
          .filter((url) => /^https?:\/\//.test(String(url || "")))
          .map((url) => ({
            name: "Sci-Hub",
            method: "GET",
            url: `${String(url).replace(/\/+$/, "")}/{doi}`,
            mode: "html",
            selector: "#pdf",
            attribute: "src",
            automatic
          })),
      resolveSciPdfDoi: async ({ doi, baseUrls }) => {
        const normalizedBaseUrls = Array.isArray(baseUrls) ? baseUrls : [baseUrls];
        window.__scipdfSiteTestCalls = [
          ...(window.__scipdfSiteTestCalls || []),
          { doi, baseUrls: normalizedBaseUrls }
        ];
        const firstUrl = normalizedBaseUrls[0] || "";
        return firstUrl.includes("bad.invalid")
          ? { doi, pdfUrl: "", requestUrl: firstUrl, failures: [{ reason: "fetch-error" }] }
          : { doi, pdfUrl: `${firstUrl.replace(/\/+$/, "")}/paper.pdf`, requestUrl: `${firstUrl}${encodeURIComponent(doi)}`, failures: [] };
      },
      extractSciPdfDoiValues: (...sources) => {
        const dois = [];
        for (const source of sources) {
          collectHarnessDois(source, dois);
        }
        return dois;
      },
      mergeSciPdfResolvers: (existing = [], incoming = []) => [...existing, ...incoming],
      normalizeSciPdfBaseUrls: (baseUrls = []) =>
        (Array.isArray(baseUrls) ? baseUrls : [baseUrls]).filter((url) => /^https?:\/\//.test(String(url || ""))),
      parseSciPdfResolverPref: (value) => {
        try {
          return JSON.parse(value || "[]");
        } catch (_error) {
          return [];
        }
      },
      serializeSciPdfResolverPref: (resolvers) => JSON.stringify(resolvers)
    },
    WorkbenchLiteratureSourceAdapters: {
      createOpenAlexAdapter: () => createSourceAdapter("openalex"),
      createCrossrefAdapter: () => createSourceAdapter("crossref"),
      createUnpaywallAdapter: () => createSourceAdapter("unpaywall"),
      createHttpConnectorAdapter: () => createSourceAdapter("http-connector"),
      createSciHubResolverAdapter: ({ resolverUrlTemplate } = {}) => {
        window.__createdSourceAdapters = [
          ...(window.__createdSourceAdapters || []),
          { sourceAdapterId: "sci-hub", resolverUrlTemplate }
        ];
        return createSourceAdapter("sci-hub", window, {
          failure: resolverUrlTemplate ? null : { userMessage: "Sci-Hub resolver URL template is required" }
        });
      },
      createSciPdfEmbeddedAdapter({ baseUrls }) {
        window.__createdSourceAdapters = [
          ...(window.__createdSourceAdapters || []),
          { sourceAdapterId: "sci-pdf", baseUrls }
        ];
        return {
          sourceAdapterId: "sci-pdf",
          async query({ dois, selectedItems }) {
            window.__queriedSourceAdapters = [...(window.__queriedSourceAdapters || []), "sci-pdf"];
            window.__pdfSourceDoiQueries = [
              ...(window.__pdfSourceDoiQueries || []),
              {
                sourceAdapterId: "sci-pdf",
                dois,
                selectedItemCount: Array.isArray(selectedItems) ? selectedItems.length : 0,
                documentCandidateCount: Array.isArray(arguments[0]?.documentCandidates)
                  ? arguments[0].documentCandidates.length
                  : 0
              }
            ];
            if (window.__pdfSourceFailure) {
              throw window.__pdfSourceFailure;
            }
            if (window.__pdfSourceFailures?.["sci-pdf"]) {
              return {
                sourceAdapterId: "sci-pdf",
                candidates: [],
                failures: window.__pdfSourceFailures["sci-pdf"]
              };
            }
            if (window.__slowSciPdfQuery) {
              await new Promise((resolve) => {
                window.__resolveSlowSciPdfQuery = resolve;
              });
            }
            if (window.__controlledSciPdfQuery) {
              await new Promise((resolve) => {
                window.__resolveControlledSciPdfQuery = resolve;
              });
            }
            return {
              sourceAdapterId: "sci-pdf",
              candidates: [{
                id: "candidate-scipdf",
                title: "Sci-PDF Candidate",
                sourceAdapterId: "sci-pdf",
                doi: dois[0],
                attachments: [{
                  id: "att-scipdf",
                  kind: "sci-hub-resolved-url",
                  url: "https://sci-hub.se/downloads/pdf-tab.pdf",
                  importable: true,
                  license: "unknown",
                  provenance: {
                    source: "sci-pdf",
                    sourceAdapterId: "sci-pdf",
                    sourceUrl: `https://sci-hub.se/${encodeURIComponent(dois[0])}`,
                    requestUrl: `https://sci-hub.se/${encodeURIComponent(dois[0])}`,
                    resolverMode: "html",
                    selector: "#pdf"
                  }
                }]
              }],
              failures: []
            };
          }
        };
      },
      createPublisherPdfAdapter() {
        window.__createdSourceAdapters = [
          ...(window.__createdSourceAdapters || []),
          { sourceAdapterId: "publisher-pdf" }
        ];
        return {
          sourceAdapterId: "publisher-pdf",
          async query({ dois, selectedItems }) {
            window.__queriedSourceAdapters = [...(window.__queriedSourceAdapters || []), "publisher-pdf"];
            window.__pdfSourceDoiQueries = [
              ...(window.__pdfSourceDoiQueries || []),
              {
                sourceAdapterId: "publisher-pdf",
                dois,
                selectedItemCount: Array.isArray(selectedItems) ? selectedItems.length : 0,
                documentCandidateCount: Array.isArray(arguments[0]?.documentCandidates)
                  ? arguments[0].documentCandidates.length
                  : 0
              }
            ];
            if (window.__pdfSourceFailure) {
              throw window.__pdfSourceFailure;
            }
            if (window.__pdfSourceFailures?.["publisher-pdf"]) {
              return {
                sourceAdapterId: "publisher-pdf",
                candidates: [],
                failures: window.__pdfSourceFailures["publisher-pdf"]
              };
            }
            if (window.__stuckPublisherQuery) {
              await new Promise(() => {});
            }
            if (window.__controlledPublisherQuery) {
              await new Promise((resolve) => {
                window.__resolveControlledPublisherQuery = resolve;
              });
            }
            return {
              sourceAdapterId: "publisher-pdf",
              candidates: [{
                id: "candidate-publisher-pdf",
                title: "Publisher PDF Candidate",
                sourceAdapterId: "publisher-pdf",
                doi: dois[0],
                attachments: [{
                  id: "att-publisher-pdf",
                  kind: "open-access-pdf-url",
                  url: "https://journals.eco-vector.com/pavlovj/article/download/70596/70737",
                  importable: true,
                  license: "unknown",
                  provenance: {
                    source: "publisher-pdf",
                    sourceUrl: "https://journals.eco-vector.com/pavlovj/article/view/70596",
                    requestUrl: `https://api.crossref.org/works/${encodeURIComponent(dois[0])}`
                  }
                }]
              }],
              failures: []
            };
          }
        };
      }
    },
    WorkbenchZoteroWriteQueue,
    WorkbenchZoteroItemWriter: {
      writeZoteroAttachmentFromIntent: async () => {
        if (window.__attachmentWriteFailure) {
          throw window.__attachmentWriteFailure;
        }
        window.__writeZoteroAttachmentCalls = (window.__writeZoteroAttachmentCalls || 0) + 1;
        return {};
      },
      writeZoteroItemFromIntent: async () => {
        window.__writeZoteroItemCalls = (window.__writeZoteroItemCalls || 0) + 1;
        return {};
      }
    }
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
    },
    createZoteroImportPlanWorkflow({ snapshot, topicId, selections, targetCollectionKey, createdAt } = {}) {
      const importPlan = WorkbenchDocumentCandidateReview.createZoteroImportPlanFromCandidates({
        topicId,
        candidates: Array.isArray(snapshot?.documentCandidates) ? snapshot.documentCandidates : [],
        selections,
        targetCollectionKey,
        createdAt
      });
      const result = WorkbenchLocalStoreTransaction.createZoteroImportPlanTransaction({
        snapshot,
        importPlan,
        createdAt
      });
      return {
        status: "zoteroImportPlanCreated",
        importPlan,
        snapshot: result.snapshot,
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

function createSourceAdapter(sourceAdapterId, window = null, options = {}) {
  return {
    sourceAdapterId,
    query: async () => {
      if (window) {
        window.__queriedSourceAdapters = [...(window.__queriedSourceAdapters || []), sourceAdapterId];
      }
      if (options.failure) {
        return { sourceAdapterId, candidates: [], failures: [options.failure] };
      }
      return { sourceAdapterId, candidates: [], failures: [] };
    }
  };
}

function createPdfCandidateFixture(id, attachmentId, title, doi) {
  return {
    id,
    title,
    sourceAdapterId: "sci-pdf",
    doi,
    attachments: [{
      id: attachmentId,
      kind: "sci-hub-resolved-url",
      url: `https://sci-hub.se/downloads/${attachmentId}.pdf`,
      importable: true,
      license: "unknown",
      provenance: {
        source: "sci-pdf",
        sourceAdapterId: "sci-pdf",
        sourceUrl: `https://sci-hub.se/${encodeURIComponent(doi)}`,
        requestUrl: `https://sci-hub.se/${encodeURIComponent(doi)}`,
        selector: "#pdf"
      }
    }]
  };
}

function createCompletedWriteQueueFixture({ entryCount, createdAt }) {
  const entries = Array.from({ length: entryCount }, (_value, index) => ({
    id: `write-intent-old-${index + 1}`,
    queueId: "zotero-write-queue-old",
    importPlanId: "zotero-import-plan-old",
    kind: "create-item",
    candidateId: `candidate-old-${index + 1}`,
    topicId: "research-topic-old",
    state: "succeeded",
    dependsOn: [],
    retryCount: 0,
    queuedAt: createdAt,
    startedAt: createdAt,
    completedAt: createdAt,
    writeIntent: {
      id: `write-intent-old-${index + 1}`,
      kind: "create-item",
      candidateId: `candidate-old-${index + 1}`
    }
  }));
  return {
    id: "zotero-write-queue-old",
    importPlanId: "zotero-import-plan-old",
    topicId: "research-topic-old",
    state: "completed",
    entries,
    expectedWrites: { items: entryCount, attachments: 0 },
    createdAt,
    startedAt: createdAt,
    completedAt: createdAt
  };
}

function findFakeElements(rootElement, predicate) {
  const result = [];
  const visit = (element) => {
    if (!element) {
      return;
    }
    if (predicate(element)) {
      result.push(element);
    }
    for (const child of Array.isArray(element.children) ? element.children : []) {
      visit(child);
    }
  };
  visit(rootElement);
  return result;
}

function collectHarnessDois(source, result) {
  if (!source) {
    return;
  }
  if (Array.isArray(source)) {
    for (const entry of source) {
      collectHarnessDois(entry, result);
    }
    return;
  }
  if (typeof source === "string") {
    pushHarnessDoi(source, result);
    return;
  }
  if (typeof source !== "object") {
    return;
  }
  for (const field of ["DOI", "doi", "url", "stableUrl", "title", "extra"]) {
    pushHarnessDoi(source[field], result);
  }
  collectHarnessDois(source.attachments, result);
  collectHarnessDois(source.documentCandidates, result);
}

function pushHarnessDoi(value, result) {
  const text = cleanText(value);
  const match = text.match(/10\.\d{4,15}\/[-._;()/:a-z0-9]+/i);
  if (!match) {
    return;
  }
  const doi = match[0].toLowerCase();
  if (!result.includes(doi)) {
    result.push(doi);
  }
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
    focusCalls: 0,
    scrollIntoViewCalls: 0,
    _textContent: "",
    attributes,
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
      return listeners.get("click")?.({ type: "click", target: this, currentTarget: this });
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
    focus() {
      this.focusCalls += 1;
    },
    scrollIntoView() {
      this.scrollIntoViewCalls += 1;
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
