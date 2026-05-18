const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("build script exists and documents the runtime package boundary", () => {
  const scriptPath = path.join(root, "scripts", "build-xpi.ps1");
  assert.equal(fs.existsSync(scriptPath), true);

  const script = fs.readFileSync(scriptPath, "utf8");
  assert.match(script, /manifest\.json/);
  assert.match(script, /bootstrap\.js/);
  assert.match(script, /chrome\/content/);
  assert.match(script, /paperSummary\.js/);
  assert.match(script, /dist/);
  assert.match(script, /zotero-research-workbench-\$Version\.xpi/);
  assert.doesNotMatch(script, /docs\/superpowers/);
  assert.doesNotMatch(script, /tests/);
});
