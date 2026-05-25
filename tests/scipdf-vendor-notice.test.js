const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const vendorRoot = path.join(root, "vendor", "zotero-scipdf");

test("vendored Sci-PDF snapshot preserves attribution and license materials", () => {
  const expectedFiles = [
    "README.md",
    "NOTICE.md",
    "LICENSE",
    "src/modules/CustomResolver.ts",
    "src/modules/CustomResolverManager.ts",
    "src/modules/SciHubFetcher.ts",
    "src/utils/utils.ts",
    "src/utils/identifierPatterns.ts"
  ];

  for (const relativePath of expectedFiles) {
    assert.equal(
      fs.existsSync(path.join(vendorRoot, relativePath)),
      true,
      `${relativePath} should exist in vendor/zotero-scipdf`
    );
  }

  const readme = fs.readFileSync(path.join(vendorRoot, "README.md"), "utf8");
  const notice = fs.readFileSync(path.join(vendorRoot, "NOTICE.md"), "utf8");
  const license = fs.readFileSync(path.join(vendorRoot, "LICENSE"), "utf8");
  const customResolver = fs.readFileSync(path.join(vendorRoot, "src", "modules", "CustomResolver.ts"), "utf8");
  const fetcher = fs.readFileSync(path.join(vendorRoot, "src", "modules", "SciHubFetcher.ts"), "utf8");

  assert.match(readme, /syt2\/zotero-scipdf/);
  assert.match(readme, /af4a838/);
  assert.match(readme, /AGPL-3\.0-or-later/);
  assert.match(notice, /Sci-PDF/);
  assert.match(notice, /AGPL-3\.0-or-later/);
  assert.match(notice, /not executed automatically/i);
  assert.match(license, /GNU AFFERO GENERAL PUBLIC LICENSE/);
  assert.match(customResolver, /sciHubCustomResolver/);
  assert.match(customResolver, /presetSciHubCustomResolvers/);
  assert.match(fetcher, /querySelector\("#pdf"\)/);
});
