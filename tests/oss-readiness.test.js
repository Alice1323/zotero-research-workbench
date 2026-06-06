const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("repository has public OSS governance files", () => {
  assert.match(readText("LICENSE"), /GNU AFFERO GENERAL PUBLIC LICENSE/);
  assert.match(readText("SECURITY.md"), /Vulnerability Reporting/i);
  assert.match(readText("CONTRIBUTING.md"), /Contributing/i);
  assert.match(readText(".github/workflows/ci.yml"), /npm test/);
  assert.match(readText(".github/workflows/ci.yml"), /npm run check/);
});

test("package and manifest use public beta metadata", () => {
  const packageJson = JSON.parse(readText("package.json"));
  const manifest = JSON.parse(readText("manifest.json"));

  assert.equal(packageJson.private, false);
  assert.equal(packageJson.license, "AGPL-3.0-or-later");
  assert.match(packageJson.description, /Zotero 8\/9/);
  assert.equal(packageJson.repository.url, "git+https://github.com/Alice1323/zotero-research-workbench.git");
  assert.equal(packageJson.homepage, "https://github.com/Alice1323/zotero-research-workbench#readme");
  assert.equal(packageJson.bugs.url, "https://github.com/Alice1323/zotero-research-workbench/issues");
  assert.ok(packageJson.keywords.includes("zotero-plugin"));
  assert.ok(packageJson.keywords.includes("openai-compatible"));
  assert.equal(manifest.applications.zotero.id, "zotero-research-workbench@alice1323.github.io");
  const updateUrl = manifest.applications.zotero.update_url || "";
  assert.doesNotMatch(updateUrl, /example\.invalid|@local/);
});

test("README presents neutral PDF acquisition boundaries for public review", () => {
  const readme = readText("README.md");
  const pdfPlan = readText("docs/superpowers/plans/2026-05-25-pdf-acquisition-baseline.md");

  assert.doesNotMatch(readme, /legitimate, user-configurable resolvers/i);
  assert.doesNotMatch(pdfPlan, /legitimate, user-configurable resolvers/i);
  assert.doesNotMatch(pdfPlan, /de-facto access infrastructure|not piracy|refuses to acknowledge|Banning the automation|abandons a large fraction/i);
  assert.match(readme, /Users are responsible for using PDF sources they are authorized to access/);
  assert.match(readme, /sideload beta/i);
});
