const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const packagedXpiPath = path.join(root, "dist", `zotero-research-workbench-${manifest.version}.xpi`);

test("manifest and package version track v0.4 beta release while preserving v0.3 artifact", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

  assert.equal(manifest.version, "0.4.0beta1");
  assert.equal(packageJson.version, "0.4.0-beta.1");
  assert.equal(fs.existsSync(path.join(root, "dist", "zotero-research-workbench-0.3.0.xpi")), true);
});

test("build script exists and documents the runtime package boundary", () => {
  const scriptPath = path.join(root, "scripts", "build-xpi.ps1");
  assert.equal(fs.existsSync(scriptPath), true);

  const script = fs.readFileSync(scriptPath, "utf8");
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  assert.match(script, /manifest\.json/);
  assert.match(script, /ReadAllText/);
  assert.match(script, /Encoding\]::UTF8/);
  assert.match(script, /ConvertFrom-Json/);
  assert.match(script, /\$Version = \$manifest\.version/);
  assert.match(script, /bootstrap\.js/);
  assert.match(script, /chrome\/content/);
  assert.match(script, /src\/core\/llmRuntimeGuard\.js/);
  assert.match(script, /llmRuntimeGuard\.js/);
  assert.match(script, /src\/core\/providerChatCompletion\.js/);
  assert.match(script, /providerChatCompletion\.js/);
  assert.match(script, /src\/core\/workbenchSnapshot\.js/);
  assert.match(script, /workbenchSnapshot\.js/);
  assert.match(script, /src\/core\/workbenchRuntimeStore\.js/);
  assert.match(script, /workbenchRuntimeStore\.js/);
  assert.match(script, /src\/core\/researchTopic\.js/);
  assert.match(script, /researchTopic\.js/);
  assert.match(script, /src\/core\/documentCandidateProtocol\.js/);
  assert.match(script, /documentCandidateProtocol\.js/);
  assert.match(script, /src\/core\/scipdfEmbeddedResolver\.js/);
  assert.match(script, /scipdfEmbeddedResolver\.js/);
  assert.match(script, /vendor\/zotero-scipdf/);
  assert.match(script, /NOTICE\.md/);
  assert.match(script, /LICENSE/);
  assert.match(script, /src\/core\/literatureDiscovery\.js/);
  assert.match(script, /literatureDiscovery\.js/);
  assert.match(script, /src\/core\/literatureSourceAdapters\.js/);
  assert.match(script, /literatureSourceAdapters\.js/);
  assert.match(script, /src\/core\/documentCandidateReview\.js/);
  assert.match(script, /documentCandidateReview\.js/);
  assert.match(script, /src\/core\/zoteroWriteQueue\.js/);
  assert.match(script, /zoteroWriteQueue\.js/);
  assert.match(script, /src\/core\/zoteroItemWriter\.js/);
  assert.match(script, /zoteroItemWriter\.js/);
  assert.match(script, /src\/core\/etherealReferenceGraph\.js/);
  assert.match(script, /etherealReferenceGraph\.js/);
  assert.match(script, /src\/core\/workbenchLocalStoreTransaction\.js/);
  assert.match(script, /workbenchLocalStoreTransaction\.js/);
  assert.match(script, /src\/core\/graphReviewWorkflow\.js/);
  assert.match(script, /graphReviewWorkflow\.js/);
  assert.match(script, /src\/core\/researchPanelOrchestrator\.js/);
  assert.match(script, /researchPanelOrchestrator\.js/);
  assert.match(script, /src\/core\/zoteroNoteWriter\.js/);
  assert.match(script, /zoteroNoteWriter\.js/);
  assert.match(script, /src\/core\/webDavClient\.js/);
  assert.match(script, /webDavClient\.js/);
  assert.match(script, /src\/core\/clipboardWriter\.js/);
  assert.match(script, /clipboardWriter\.js/);
  assert.match(script, /src\/core\/workbenchFileRuntime\.js/);
  assert.match(script, /workbenchFileRuntime\.js/);
  assert.match(script, /src\/core\/workbenchFileIo\.js/);
  assert.match(script, /workbenchFileIo\.js/);
  assert.match(script, /src\/core\/workbenchSelectedPaper\.js/);
  assert.match(script, /workbenchSelectedPaper\.js/);
  assert.match(script, /src\/core\/workbenchFetchRuntime\.js/);
  assert.match(script, /workbenchFetchRuntime\.js/);
  assert.match(script, /src\/core\/providerRequestPolicy\.js/);
  assert.match(script, /providerRequestPolicy\.js/);
  assert.match(script, /src\/core\/aiTaskWorkspace\.js/);
  assert.match(script, /aiTaskWorkspaceCore\.js/);
  assert.match(script, /chrome\/content\/aiTaskWorkspace\.js/);
  assert.match(script, /paperSummary\.js/);
  assert.match(script, /readingContext\.js/);
  assert.match(script, /dist/);
  assert.match(script, /zotero-research-workbench-\$Version\.xpi/);
  assert.doesNotMatch(script, /docs\/superpowers/);
  assert.doesNotMatch(script, /tests/);
  assert.match(readme, /导出工作台状态/);
  assert.match(readme, /导入工作台状态/);
  assert.match(readme, /API 密钥/);
  assert.match(readme, /WebDAV 密码/);
  assert.match(readme, /Sci-PDF Embedded/);
  assert.match(readme, /PDF 获取/);
  assert.match(readme, /AGPL-3\.0-or-later/);
  assert.match(readme, /不会静默下载或附加 PDF/);
  assert.match(readme, /同步到 Zotero Find Full Text/);
  assert.match(readme, /默认关闭/);
});

test("research panel loads v0.4 core modules before dependent runtime modules", () => {
  const panel = fs.readFileSync(path.join(root, "chrome", "content", "researchPanel.xhtml"), "utf8");
  const indexOfScript = (scriptName) => panel.indexOf(`src="${scriptName}"`);

  assert.ok(indexOfScript("researchTopic.js") >= 0);
  assert.ok(indexOfScript("documentCandidateProtocol.js") >= 0);
  assert.ok(indexOfScript("scipdfEmbeddedResolver.js") >= 0);
  assert.ok(indexOfScript("literatureDiscovery.js") >= 0);
  assert.ok(indexOfScript("literatureSourceAdapters.js") >= 0);
  assert.ok(indexOfScript("documentCandidateReview.js") >= 0);
  assert.ok(indexOfScript("zoteroWriteQueue.js") >= 0);
  assert.ok(indexOfScript("zoteroItemWriter.js") >= 0);
  assert.ok(indexOfScript("etherealReferenceGraph.js") >= 0);
  assert.ok(indexOfScript("researchTopic.js") < indexOfScript("workbenchLocalStoreTransaction.js"));
  assert.ok(indexOfScript("documentCandidateProtocol.js") < indexOfScript("literatureDiscovery.js"));
  assert.ok(indexOfScript("documentCandidateProtocol.js") < indexOfScript("scipdfEmbeddedResolver.js"));
  assert.ok(indexOfScript("scipdfEmbeddedResolver.js") < indexOfScript("literatureSourceAdapters.js"));
  assert.ok(indexOfScript("documentCandidateProtocol.js") < indexOfScript("literatureSourceAdapters.js"));
  assert.ok(indexOfScript("literatureDiscovery.js") < indexOfScript("researchPanelOrchestrator.js"));
  assert.ok(indexOfScript("literatureSourceAdapters.js") < indexOfScript("paperSummary.js"));
  assert.ok(indexOfScript("documentCandidateReview.js") < indexOfScript("researchPanelOrchestrator.js"));
  assert.ok(indexOfScript("zoteroWriteQueue.js") < indexOfScript("researchPanelOrchestrator.js"));
  assert.ok(indexOfScript("zoteroItemWriter.js") < indexOfScript("paperSummary.js"));
  assert.ok(indexOfScript("etherealReferenceGraph.js") < indexOfScript("researchPanelOrchestrator.js"));
});

test(
  "built XPI includes extracted runtime modules before paper summary",
  { skip: fs.existsSync(packagedXpiPath) ? false : "Run npm run package to create the XPI artifact" },
  () => {
    const listing = childProcess.execFileSync("tar", ["-tf", packagedXpiPath], { encoding: "utf8" });
    assert.match(listing, /chrome\/content\/zoteroNoteWriter\.js/);
    assert.match(listing, /chrome\/content\/webDavClient\.js/);
    assert.match(listing, /chrome\/content\/clipboardWriter\.js/);
    assert.match(listing, /chrome\/content\/workbenchFileRuntime\.js/);
    assert.match(listing, /chrome\/content\/workbenchFileIo\.js/);
    assert.match(listing, /chrome\/content\/workbenchSelectedPaper\.js/);
    assert.match(listing, /chrome\/content\/workbenchFetchRuntime\.js/);
    assert.match(listing, /chrome\/content\/workbenchLocalStoreTransaction\.js/);
    assert.match(listing, /chrome\/content\/researchTopic\.js/);
    assert.match(listing, /chrome\/content\/documentCandidateProtocol\.js/);
    assert.match(listing, /chrome\/content\/scipdfEmbeddedResolver\.js/);
    assert.match(listing, /chrome\/content\/literatureDiscovery\.js/);
    assert.match(listing, /chrome\/content\/literatureSourceAdapters\.js/);
    assert.match(listing, /chrome\/content\/documentCandidateReview\.js/);
    assert.match(listing, /chrome\/content\/zoteroWriteQueue\.js/);
    assert.match(listing, /chrome\/content\/zoteroItemWriter\.js/);
    assert.match(listing, /chrome\/content\/etherealReferenceGraph\.js/);
    assert.match(listing, /chrome\/content\/graphReviewWorkflow\.js/);
    assert.match(listing, /chrome\/content\/researchPanelOrchestrator\.js/);
    assert.match(listing, /chrome\/content\/providerRequestPolicy\.js/);
    assert.match(listing, /chrome\/content\/aiTaskWorkspaceCore\.js/);
    assert.match(listing, /chrome\/content\/aiTaskWorkspace\.js/);
    assert.match(listing, /vendor\/zotero-scipdf\/README\.md/);
    assert.match(listing, /vendor\/zotero-scipdf\/NOTICE\.md/);
    assert.match(listing, /vendor\/zotero-scipdf\/LICENSE/);
    assert.match(listing, /vendor\/zotero-scipdf\/src\/modules\/CustomResolver\.ts/);
    assert.match(listing, /vendor\/zotero-scipdf\/src\/modules\/SciHubFetcher\.ts/);

    const panel = childProcess.execFileSync(
      "tar",
      ["-xOf", packagedXpiPath, "chrome/content/researchPanel.xhtml"],
      { encoding: "utf8" }
    );
    assert.ok(panel.indexOf("zoteroNoteWriter.js") < panel.indexOf("paperSummary.js"));
    assert.ok(panel.indexOf("webDavClient.js") < panel.indexOf("paperSummary.js"));
    assert.ok(panel.indexOf("clipboardWriter.js") < panel.indexOf("paperSummary.js"));
    assert.ok(panel.indexOf("workbenchFileRuntime.js") < panel.indexOf("paperSummary.js"));
    assert.ok(panel.indexOf("workbenchFileIo.js") < panel.indexOf("paperSummary.js"));
    assert.ok(panel.indexOf("workbenchSelectedPaper.js") < panel.indexOf("paperSummary.js"));
    assert.ok(panel.indexOf("workbenchFetchRuntime.js") < panel.indexOf("paperSummary.js"));
    assert.ok(panel.indexOf("researchTopic.js") < panel.indexOf("workbenchLocalStoreTransaction.js"));
    assert.ok(panel.indexOf("documentCandidateProtocol.js") < panel.indexOf("literatureDiscovery.js"));
    assert.ok(panel.indexOf("documentCandidateProtocol.js") < panel.indexOf("scipdfEmbeddedResolver.js"));
    assert.ok(panel.indexOf("scipdfEmbeddedResolver.js") < panel.indexOf("literatureSourceAdapters.js"));
    assert.ok(panel.indexOf("documentCandidateProtocol.js") < panel.indexOf("literatureSourceAdapters.js"));
    assert.ok(panel.indexOf("literatureDiscovery.js") < panel.indexOf("researchPanelOrchestrator.js"));
    assert.ok(panel.indexOf("literatureSourceAdapters.js") < panel.indexOf("paperSummary.js"));
    assert.ok(panel.indexOf("documentCandidateReview.js") < panel.indexOf("researchPanelOrchestrator.js"));
    assert.ok(panel.indexOf("zoteroWriteQueue.js") < panel.indexOf("researchPanelOrchestrator.js"));
    assert.ok(panel.indexOf("zoteroItemWriter.js") < panel.indexOf("paperSummary.js"));
    assert.ok(panel.indexOf("etherealReferenceGraph.js") < panel.indexOf("researchPanelOrchestrator.js"));
    assert.ok(panel.indexOf("workbenchLocalStoreTransaction.js") < panel.indexOf("paperSummary.js"));
    assert.ok(panel.indexOf("workbenchLocalStoreTransaction.js") < panel.indexOf("graphReviewWorkflow.js"));
    assert.ok(panel.indexOf("graphReviewWorkflow.js") < panel.indexOf("paperSummary.js"));
    assert.ok(panel.indexOf("graphReviewWorkflow.js") < panel.indexOf("researchPanelOrchestrator.js"));
    assert.ok(panel.indexOf("researchPanelOrchestrator.js") < panel.indexOf("paperSummary.js"));
    assert.ok(panel.indexOf("providerRequestPolicy.js") < panel.indexOf("aiTaskWorkspaceCore.js"));
    assert.ok(panel.indexOf("aiTaskWorkspaceCore.js") < panel.indexOf("aiTaskWorkspace.js"));
    assert.ok(panel.indexOf("aiTaskWorkspace.js") < panel.indexOf("paperSummary.js"));

    const packagedRuntime = childProcess.execFileSync(
      "tar",
      ["-xOf", packagedXpiPath, "chrome/content/paperSummary.js"],
      { encoding: "utf8" }
    );
    const sourceRuntime = fs.readFileSync(path.join(root, "chrome/content/paperSummary.js"), "utf8");
    assert.match(packagedRuntime, /WorkbenchResearchPanelOrchestrator/);
    assert.match(packagedRuntime, /confirmDraftSavedToZoteroWorkflow/);
    assert.doesNotMatch(packagedRuntime, /captureGraphSeedTransaction/);
    assert.match(packagedRuntime, /upsertPromptOverrideTransaction/);
    assert.match(packagedRuntime, /createGraphReviewReadModel/);
    assert.match(packagedRuntime, /reviewGraphSeedWorkflow/);
    assert.equal(packagedRuntime.replace(/\r\n/g, "\n"), sourceRuntime.replace(/\r\n/g, "\n"));
  }
);
