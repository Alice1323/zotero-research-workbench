const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packagedXpiPath = path.join(root, "dist", "zotero-research-workbench-0.2.0.xpi");

test("build script exists and documents the runtime package boundary", () => {
  const scriptPath = path.join(root, "scripts", "build-xpi.ps1");
  assert.equal(fs.existsSync(scriptPath), true);

  const script = fs.readFileSync(scriptPath, "utf8");
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  assert.match(script, /manifest\.json/);
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
  }
);
