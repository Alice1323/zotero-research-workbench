# Sci-PDF Embedded PDF Acquisition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed Sci-PDF resolver behavior into Zotero Research Workbench and expose it through a prominent, polished `PDF 获取` tab that keeps all Zotero writes behind existing review and write-queue gates.

**Architecture:** Vendor Sci-PDF as an attributed source snapshot, then add a Workbench-owned resolver boundary that reuses Sci-PDF concepts without running its Zotero plugin lifecycle. The dedicated PDF tab calls that boundary through a `sci-pdf` literature source adapter, displays provenance-rich PDF candidates, and only writes through explicit Workbench queue actions or an advanced explicit Zotero resolver sync.

**Tech Stack:** Zotero 8/9 bootstrap plugin, XHTML Research Panel, CommonJS/browser-global core modules under `src/core`, Node `node:test`, PowerShell XPI packaging, vendored Sci-PDF source snapshot from `syt2/zotero-scipdf` commit `af4a838`.

---

## Execution Notes

- Work from `C:\Users\44199\水银灯的书库\水银灯的代码库\归档项目\zotero-research-workbench`.
- Use native PowerShell commands. Do not rely on WSL or bare `bash`.
- The repository currently contains uncommitted PDF acquisition work. Do not revert it. Stage only files touched by the current task before each commit.
- Keep automated tests below the Zotero write boundary. Do not run real Zotero attachment writes during automated verification.
- Preserve Sci-PDF attribution and license materials when copying source into `vendor/zotero-scipdf`.
- The existing JSON resolver adapter `createSciHubResolverAdapter` stays available. The embedded Sci-PDF adapter is a new source id: `sci-pdf`.

## File Structure

- Create `vendor/zotero-scipdf/README.md`: explains why the source snapshot exists and records upstream repository, inspected commit, and packaging boundary.
- Create `vendor/zotero-scipdf/NOTICE.md`: Workbench redistribution notice for Sci-PDF.
- Copy `vendor/zotero-scipdf/LICENSE`: upstream `AGPL-3.0-or-later` license file from the inspected Sci-PDF checkout.
- Copy `vendor/zotero-scipdf/src/modules/CustomResolver.ts`: upstream resolver schema and preset URL implementation.
- Copy `vendor/zotero-scipdf/src/modules/CustomResolverManager.ts`: upstream Zotero preference writer reference, retained for attribution and comparison but not executed by Workbench startup.
- Copy `vendor/zotero-scipdf/src/modules/SciHubFetcher.ts`: upstream DOI page fetch and `#pdf[src]` extraction behavior.
- Copy `vendor/zotero-scipdf/src/utils/utils.ts`: upstream DOI extraction and remote PDF import reference.
- Copy `vendor/zotero-scipdf/src/utils/identifierPatterns.ts`: upstream DOI regexes.
- Create `src/core/scipdfEmbeddedResolver.js`: Workbench-owned runtime boundary for Sci-PDF preset URLs, DOI extraction, HTML PDF extraction, not-found detection, and explicit Zotero resolver pref merging.
- Modify `src/core/literatureSourceAdapters.js`: add `createSciPdfEmbeddedAdapter` that normalizes embedded resolver results into Workbench document candidates.
- Modify `src/core/index.js`: export `WorkbenchSciPdfEmbeddedResolver` for Node tests and package consumers.
- Modify `src/core/documentCandidateProtocol.js`: keep `sci-hub-resolved-url` importability compatible with existing `sci-hub` provenance and new `sci-pdf` provenance.
- Modify `chrome/content/researchPanel.xhtml`: load `scipdfEmbeddedResolver.js`, add the dedicated `PDF 获取` tab/panel, source cards, status strip, candidate list, and separated write actions.
- Modify `chrome/content/paperSummary.js`: bind PDF tab controls, collect DOI values, create Sci-PDF adapters, render PDF candidate rows, and perform explicit Zotero Find Full Text sync only on user action.
- Modify `scripts/build-xpi.ps1`: package the new runtime module and vendored Sci-PDF metadata/source files.
- Modify `tests/scipdf-embedded-resolver.test.js`: focused unit tests for resolver boundary behavior.
- Modify `tests/literature-source-adapters.test.js`: adapter integration tests.
- Modify `tests/literature-discovery-ui.test.js`: PDF tab runtime tests.
- Modify `tests/ui-localization.test.js`: XHTML label, id, and visible-entry tests.
- Modify `tests/package.test.js`: package boundary and XPI inclusion tests.
- Modify `README.md`: document embedded Sci-PDF behavior, license attribution, no silent download, and explicit Zotero resolver sync.

## Task 1: Vendor Sci-PDF Snapshot And Notices

**Files:**
- Create: `vendor/zotero-scipdf/README.md`
- Create: `vendor/zotero-scipdf/NOTICE.md`
- Create: `vendor/zotero-scipdf/LICENSE`
- Create: `vendor/zotero-scipdf/src/modules/CustomResolver.ts`
- Create: `vendor/zotero-scipdf/src/modules/CustomResolverManager.ts`
- Create: `vendor/zotero-scipdf/src/modules/SciHubFetcher.ts`
- Create: `vendor/zotero-scipdf/src/utils/utils.ts`
- Create: `vendor/zotero-scipdf/src/utils/identifierPatterns.ts`
- Create: `tests/scipdf-vendor-notice.test.js`

- [ ] **Step 1: Write the failing vendor notice test**

Create `tests/scipdf-vendor-notice.test.js`:

```js
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
node --test tests\scipdf-vendor-notice.test.js
```

Expected: FAIL because `vendor/zotero-scipdf` does not exist.

- [ ] **Step 3: Copy the inspected Sci-PDF source snapshot**

Run these PowerShell commands from the repository root:

```powershell
$sourceRoot = 'C:\Users\44199\.codex\tmp\zotero-scipdf-inspect'
$vendorRoot = 'vendor\zotero-scipdf'
New-Item -ItemType Directory -Force -Path "$vendorRoot\src\modules" | Out-Null
New-Item -ItemType Directory -Force -Path "$vendorRoot\src\utils" | Out-Null
Copy-Item -LiteralPath "$sourceRoot\LICENSE" -Destination "$vendorRoot\LICENSE"
Copy-Item -LiteralPath "$sourceRoot\src\modules\CustomResolver.ts" -Destination "$vendorRoot\src\modules\CustomResolver.ts"
Copy-Item -LiteralPath "$sourceRoot\src\modules\CustomResolverManager.ts" -Destination "$vendorRoot\src\modules\CustomResolverManager.ts"
Copy-Item -LiteralPath "$sourceRoot\src\modules\SciHubFetcher.ts" -Destination "$vendorRoot\src\modules\SciHubFetcher.ts"
Copy-Item -LiteralPath "$sourceRoot\src\utils\utils.ts" -Destination "$vendorRoot\src\utils\utils.ts"
Copy-Item -LiteralPath "$sourceRoot\src\utils\identifierPatterns.ts" -Destination "$vendorRoot\src\utils\identifierPatterns.ts"
```

- [ ] **Step 4: Add the vendor README**

Create `vendor/zotero-scipdf/README.md`:

```markdown
# Vendored Sci-PDF Snapshot

This directory contains a source snapshot from `syt2/zotero-scipdf`, inspected at commit `af4a838`.

Sci-PDF is licensed `AGPL-3.0-or-later`. The upstream license is preserved in `LICENSE`, and the Workbench redistribution notice is preserved in `NOTICE.md`.

The Workbench does not execute Sci-PDF's Zotero plugin startup lifecycle from this directory. The files are retained as an embedded dependency source snapshot and as the behavior reference for the Workbench-owned runtime boundary in `src/core/scipdfEmbeddedResolver.js`.

Runtime behavior imported into the Workbench:

- Sci-Hub resolver schema with `method`, `url`, `mode`, `selector`, `attribute`, and `automatic`.
- Preset Sci-Hub base URLs.
- DOI extraction patterns.
- HTML resolver behavior that reads `#pdf[src]`.
- Explicit resolver preference shape for Zotero Find Full Text sync.

Runtime behavior not imported automatically:

- Sci-PDF right-click menu registration.
- Startup writes to `extensions.zotero.findPDFs.resolvers`.
- Direct attachment import outside the Workbench review and write queue.
```

- [ ] **Step 5: Add the vendor notice**

Create `vendor/zotero-scipdf/NOTICE.md`:

```markdown
# Sci-PDF Notice

Zotero Research Workbench embeds a source snapshot from Sci-PDF.

- Upstream repository: https://github.com/syt2/zotero-scipdf
- Inspected commit: `af4a838`
- License: `AGPL-3.0-or-later`
- Vendored files: resolver schema, resolver manager reference, Sci-Hub fetcher reference, utility DOI extraction, and DOI identifier patterns.

The vendored Sci-PDF plugin lifecycle is not executed automatically. Zotero Research Workbench uses a separate Workbench-owned resolver boundary and keeps PDF attachment writes behind explicit candidate review and the Zotero Write Queue.

The optional `同步到 Zotero Find Full Text` action writes Sci-PDF-style resolver entries only after explicit user action from the `PDF 获取` tab.
```

- [ ] **Step 6: Run the vendor notice test and verify it passes**

Run:

```powershell
node --test tests\scipdf-vendor-notice.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit the vendor snapshot**

Run:

```powershell
git add vendor\zotero-scipdf tests\scipdf-vendor-notice.test.js
git commit -m "chore: vendor scipdf source snapshot"
```

## Task 2: Add The Embedded Sci-PDF Resolver Boundary

**Files:**
- Create: `src/core/scipdfEmbeddedResolver.js`
- Create: `tests/scipdf-embedded-resolver.test.js`
- Modify: `src/core/index.js`

- [ ] **Step 1: Write the failing resolver boundary tests**

Create `tests/scipdf-embedded-resolver.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SCI_PDF_PRESET_BASE_URLS,
  buildSciPdfRequestUrl,
  createSciPdfCustomResolver,
  createSciPdfCustomResolvers,
  extractSciPdfDoiValues,
  extractSciPdfPdfUrlFromHtml,
  isSciPdfNotFoundHtml,
  mergeSciPdfResolvers,
  normalizeSciPdfBaseUrls,
  parseSciPdfResolverPref,
  resolveSciPdfDoi,
  serializeSciPdfResolverPref
} = require("../src/core/scipdfEmbeddedResolver");
const core = require("../src/core");

test("Sci-PDF preset URLs are normalized into Zotero custom resolver shape", () => {
  assert.deepEqual(SCI_PDF_PRESET_BASE_URLS.slice(0, 3), [
    "https://sci-hub.se/",
    "https://sci-hub.st/",
    "https://sci-hub.ru/"
  ]);

  const resolver = createSciPdfCustomResolver("https://sci-hub.se", false);
  assert.deepEqual(resolver, {
    name: "Sci-Hub",
    method: "GET",
    url: "https://sci-hub.se/{doi}",
    mode: "html",
    selector: "#pdf",
    attribute: "src",
    automatic: false
  });

  assert.deepEqual(
    createSciPdfCustomResolvers([" https://sci-hub.se/ ", "https://sci-hub.se/{doi}", "not a url"]),
    [resolver]
  );
});

test("Sci-PDF DOI extraction reads item fields and attachment fields", () => {
  const dois = extractSciPdfDoiValues({
    DOI: "10.1000/PRIMARY",
    url: "https://doi.org/10.2000/url",
    title: "A title with doi: 10.3000/title",
    extra: "PMID: 1\nDOI:10.4000/extra",
    attachments: [
      { title: "attachment 10.5000/attachment", extra: "DOI: 10.6000/extra-attachment" }
    ]
  });

  assert.deepEqual(dois, [
    "10.1000/primary",
    "10.2000/url",
    "10.3000/title",
    "10.4000/extra",
    "10.5000/attachment",
    "10.6000/extra-attachment"
  ]);
});

test("Sci-PDF HTML extraction resolves absolute, protocol-relative, root-relative, and relative PDF URLs", () => {
  const requestUrl = "https://sci-hub.se/10.1000/example";
  assert.equal(
    extractSciPdfPdfUrlFromHtml({
      html: '<html><body><iframe id="pdf" src="https://cdn.example/a.pdf"></iframe></body></html>',
      requestUrl
    }),
    "https://cdn.example/a.pdf"
  );
  assert.equal(
    extractSciPdfPdfUrlFromHtml({
      html: '<embed src="//cdn.example/b.pdf" id="pdf" />',
      requestUrl
    }),
    "https://cdn.example/b.pdf"
  );
  assert.equal(
    extractSciPdfPdfUrlFromHtml({
      html: '<iframe id="pdf" src="/downloads/c.pdf"></iframe>',
      requestUrl
    }),
    "https://sci-hub.se/downloads/c.pdf"
  );
  assert.equal(
    extractSciPdfPdfUrlFromHtml({
      html: '<iframe id="pdf" src="files/d.pdf"></iframe>',
      requestUrl
    }),
    "https://sci-hub.se/files/d.pdf"
  );
});

test("Sci-PDF not-found detection matches empty body and known messages", () => {
  assert.equal(isSciPdfNotFoundHtml("<html><body>   </body></html>"), true);
  assert.equal(isSciPdfNotFoundHtml("<body>Please try to search again using DOI</body>"), true);
  assert.equal(isSciPdfNotFoundHtml("<body>статья не найдена в базе</body>"), true);
  assert.equal(isSciPdfNotFoundHtml('<body><iframe id="pdf" src="/a.pdf"></iframe></body>'), false);
});

test("Sci-PDF resolver fetches HTML and returns a resolved PDF record without attaching", async () => {
  const calls = [];
  const result = await resolveSciPdfDoi({
    doi: "10.1000/Fetch",
    baseUrls: ["https://sci-hub.se/"],
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        text: async () => '<html><body><iframe id="pdf" src="/downloads/fetch.pdf"></iframe></body></html>'
      };
    }
  });

  assert.equal(calls[0].url, "https://sci-hub.se/10.1000%2Ffetch");
  assert.equal(calls[0].options.method, "GET");
  assert.match(calls[0].options.headers["User-Agent"], /Mozilla/);
  assert.equal(result.pdfUrl, "https://sci-hub.se/downloads/fetch.pdf");
  assert.equal(result.requestUrl, "https://sci-hub.se/10.1000%2Ffetch");
  assert.equal(result.resolver.selector, "#pdf");
  assert.deepEqual(result.failures, []);
});

test("Sci-PDF resolver reports not-found and selector-missing failures", async () => {
  const result = await resolveSciPdfDoi({
    doi: "10.1000/missing",
    baseUrls: ["https://sci-hub.se/", "https://sci-hub.st/"],
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      text: async () =>
        url.includes("sci-hub.se")
          ? "<html><body>Please try to search again using DOI</body></html>"
          : "<html><body>No iframe here</body></html>"
    })
  });

  assert.equal(result.pdfUrl, "");
  assert.deepEqual(result.failures.map((failure) => failure.reason), [
    "pdf-not-found",
    "pdf-selector-missing"
  ]);
});

test("Sci-PDF resolver preference merge is explicit and preserves non-Sci-PDF resolvers", () => {
  const existing = parseSciPdfResolverPref(JSON.stringify([
    { name: "Library Proxy", method: "GET", url: "https://library.example/{doi}", mode: "json", selector: "$.url" }
  ]));
  const incoming = createSciPdfCustomResolvers(["https://sci-hub.se/"]);
  const merged = mergeSciPdfResolvers(existing, incoming);

  assert.equal(merged.length, 2);
  assert.equal(merged[0].name, "Library Proxy");
  assert.equal(merged[1].url, "https://sci-hub.se/{doi}");
  assert.equal(
    serializeSciPdfResolverPref(merged),
    JSON.stringify(merged)
  );
});

test("core index exports the Sci-PDF embedded resolver module", () => {
  assert.equal(typeof core.WorkbenchSciPdfEmbeddedResolver.resolveSciPdfDoi, "function");
  assert.deepEqual(normalizeSciPdfBaseUrls(["https://sci-hub.se", "", "bad"]), ["https://sci-hub.se/"]);
  assert.equal(
    buildSciPdfRequestUrl(createSciPdfCustomResolver("https://sci-hub.se/"), "10.1000/abc"),
    "https://sci-hub.se/10.1000%2Fabc"
  );
});
```

- [ ] **Step 2: Run the resolver boundary tests and verify they fail**

Run:

```powershell
node --test tests\scipdf-embedded-resolver.test.js
```

Expected: FAIL because `src/core/scipdfEmbeddedResolver.js` does not exist.

- [ ] **Step 3: Create the resolver boundary module**

Create `src/core/scipdfEmbeddedResolver.js` with this complete module:

```js
(function () {
const SCI_PDF_PRESET_BASE_URLS = [
  "https://sci-hub.se/",
  "https://sci-hub.st/",
  "https://sci-hub.ru/",
  "https://sci-hub.box/",
  "https://sci-hub.red/",
  "https://sci-hub.ren/",
  "https://sci-hub.ee/"
];

const SCI_PDF_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 11_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1";

const DOI_REGEXPS = [
  /doi[\s.:]{0,2}(10\.\d{4}[\d:.\-_/a-z]+)(?:[\s\n"<]|$)/gi,
  /(10\.\d{4}[\d:./a-z]+)(?:[\s\n"<]|$)/gi,
  /(10\.\d{4}[:.\-/a-z]+[:.\-\d]+)(?:[\s\na-z"<]|$)/gi,
  /(?:http[s]?:\/\/)+?[/\w.-]*doi[/\w.-]\/(10\.\d{4,15}\/[-._;()/:a-z0-9]+)(?:[\s\n"<]|$)/gi,
  /^(10\.\d{4,15}\/[-._;()/:A-Z0-9]+)$/gi
];

const NOT_FOUND_REGEXPS = [
  /Please try to search again using DOI/im,
  /статья не найдена в базе/im
];

function createSciPdfCustomResolver(baseUrl, automatic = false) {
  const normalizedBaseUrl = normalizeSciPdfBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    return null;
  }
  return {
    name: "Sci-Hub",
    method: "GET",
    url: normalizedBaseUrl.includes("{doi}")
      ? normalizedBaseUrl
      : `${trimTrailingSlash(normalizedBaseUrl)}/{doi}`,
    mode: "html",
    selector: "#pdf",
    attribute: "src",
    automatic: Boolean(automatic)
  };
}

function createSciPdfCustomResolvers(baseUrls = SCI_PDF_PRESET_BASE_URLS, { automatic = false } = {}) {
  const resolvers = [];
  for (const baseUrl of normalizeSciPdfBaseUrls(baseUrls)) {
    const resolver = createSciPdfCustomResolver(baseUrl, automatic);
    if (resolver && !resolvers.some((entry) => isSciPdfResolverEqual(entry, resolver))) {
      resolvers.push(resolver);
    }
  }
  return resolvers;
}

function normalizeSciPdfBaseUrls(baseUrls = SCI_PDF_PRESET_BASE_URLS) {
  const result = [];
  for (const value of Array.isArray(baseUrls) ? baseUrls : [baseUrls]) {
    const normalized = normalizeSciPdfBaseUrl(value);
    if (normalized && !result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return result;
}

function normalizeSciPdfBaseUrl(value) {
  const text = cleanText(value);
  if (!text) {
    return "";
  }
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    if (text.includes("{doi}")) {
      return text;
    }
    return `${trimTrailingSlash(url.href)}/`;
  } catch (_error) {
    return "";
  }
}

function buildSciPdfRequestUrl(resolver, doi) {
  const normalizedDoi = normalizeDoi(doi);
  const template = cleanText(resolver?.url);
  if (!template || !normalizedDoi) {
    return "";
  }
  if (template.includes("{doi}")) {
    return template.replace(/\{doi\}/g, encodeURIComponent(normalizedDoi));
  }
  return `${trimTrailingSlash(template)}/${encodeURIComponent(normalizedDoi)}`;
}

function extractSciPdfDoiValues(...sources) {
  const result = [];
  for (const source of sources) {
    collectDoiValues(source, result);
  }
  return result;
}

function collectDoiValues(source, result) {
  if (!source) {
    return;
  }
  if (typeof source === "string") {
    pushDoiMatches(source, result);
    return;
  }
  if (Array.isArray(source)) {
    for (const entry of source) {
      collectDoiValues(entry, result);
    }
    return;
  }
  if (typeof source !== "object") {
    return;
  }

  for (const field of ["DOI", "doi", "url", "URL", "title", "extra", "abstract", "stableUrl"]) {
    if (typeof source[field] === "string") {
      pushDoiMatches(source[field], result);
    }
  }
  collectDoiValues(source.attachments, result);
  collectDoiValues(source.attachmentReferences, result);
}

function pushDoiMatches(text, result) {
  for (const regexp of DOI_REGEXPS) {
    regexp.lastIndex = 0;
    let match;
    while ((match = regexp.exec(text)) !== null) {
      const doi = normalizeDoi(match[1]);
      if (doi && !result.includes(doi)) {
        result.push(doi);
      }
    }
  }
}

function extractSciPdfPdfUrlFromHtml({ html, requestUrl, selector = "#pdf", attribute = "src" } = {}) {
  if (selector !== "#pdf" || attribute !== "src") {
    return "";
  }
  const element = findElementWithId(cleanText(html), "pdf");
  if (!element) {
    return "";
  }
  const rawSrc = getHtmlAttribute(element, "src");
  if (!rawSrc) {
    return "";
  }
  try {
    const resolved = new URL(rawSrc, cleanText(requestUrl));
    resolved.protocol = "https:";
    return resolved.href;
  } catch (_error) {
    return "";
  }
}

function isSciPdfNotFoundHtml(html) {
  const text = String(html || "");
  const body = extractHtmlBody(text);
  if (!stripHtml(body).trim()) {
    return true;
  }
  return NOT_FOUND_REGEXPS.some((regexp) => regexp.test(body));
}

async function resolveSciPdfDoi({
  doi,
  baseUrls = SCI_PDF_PRESET_BASE_URLS,
  fetchImpl,
  userAgent = SCI_PDF_USER_AGENT
} = {}) {
  assertFetchRuntime(fetchImpl);
  const normalizedDoi = normalizeDoi(doi);
  if (!normalizedDoi) {
    return {
      doi: "",
      pdfUrl: "",
      requestUrl: "",
      sourceUrl: "",
      resolver: null,
      failures: [{ reason: "missing-doi", message: "Sci-PDF requires at least one DOI" }]
    };
  }

  const resolvers = createSciPdfCustomResolvers(baseUrls);
  if (!resolvers.length) {
    return {
      doi: normalizedDoi,
      pdfUrl: "",
      requestUrl: "",
      sourceUrl: "",
      resolver: null,
      failures: [{ reason: "missing-base-url", message: "Sci-PDF requires at least one valid base URL" }]
    };
  }

  const failures = [];
  for (const resolver of resolvers) {
    const requestUrl = buildSciPdfRequestUrl(resolver, normalizedDoi);
    try {
      const response = await fetchImpl(requestUrl, {
        method: resolver.method,
        headers: { "User-Agent": userAgent }
      });
      const html = typeof response?.text === "function" ? await response.text() : "";
      const status = Number(response?.status) || 0;
      if (response?.ok === false || status >= 400) {
        failures.push({ reason: "http-error", status, requestUrl });
        continue;
      }

      const pdfUrl = extractSciPdfPdfUrlFromHtml({
        html,
        requestUrl,
        selector: resolver.selector,
        attribute: resolver.attribute
      });
      if (pdfUrl) {
        return {
          doi: normalizedDoi,
          pdfUrl,
          requestUrl,
          sourceUrl: requestUrl,
          resolver,
          failures
        };
      }

      failures.push({
        reason: isSciPdfNotFoundHtml(html) ? "pdf-not-found" : "pdf-selector-missing",
        requestUrl
      });
    } catch (error) {
      failures.push({
        reason: "network-error",
        requestUrl,
        message: error?.message || String(error)
      });
    }
  }

  return {
    doi: normalizedDoi,
    pdfUrl: "",
    requestUrl: failures[0]?.requestUrl || "",
    sourceUrl: failures[0]?.requestUrl || "",
    resolver: resolvers[0],
    failures
  };
}

function parseSciPdfResolverPref(value) {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry && typeof entry === "object");
  }
  const text = cleanText(value);
  if (!text) {
    return [];
  }
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === "object") : [];
  } catch (_error) {
    return [];
  }
}

function mergeSciPdfResolvers(existingResolvers, incomingResolvers) {
  const result = [];
  for (const resolver of [].concat(existingResolvers || [], incomingResolvers || [])) {
    if (!resolver || typeof resolver !== "object") {
      continue;
    }
    if (!result.some((entry) => isSciPdfResolverEqual(entry, resolver))) {
      result.push({ ...resolver });
    }
  }
  return result;
}

function serializeSciPdfResolverPref(resolvers) {
  return JSON.stringify(Array.isArray(resolvers) ? resolvers : []);
}

function isSciPdfResolverEqual(left, right) {
  return cleanText(left?.name) === cleanText(right?.name) &&
    cleanText(left?.method) === cleanText(right?.method) &&
    cleanText(left?.url) === cleanText(right?.url) &&
    cleanText(left?.mode) === cleanText(right?.mode) &&
    cleanText(left?.selector) === cleanText(right?.selector) &&
    Boolean(left?.automatic) === Boolean(right?.automatic) &&
    cleanText(left?.attribute) === cleanText(right?.attribute) &&
    Number(left?.index || 0) === Number(right?.index || 0) &&
    cleanText(left?.mappings?.url) === cleanText(right?.mappings?.url) &&
    cleanText(left?.mappings?.pageURL) === cleanText(right?.mappings?.pageURL);
}

function findElementWithId(html, id) {
  const regexp = /<[^>]*\bid\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)[^>]*>/gi;
  let match;
  while ((match = regexp.exec(html)) !== null) {
    const value = unquoteHtmlAttribute(match[1]);
    if (value === id) {
      return match[0];
    }
  }
  return "";
}

function getHtmlAttribute(element, attributeName) {
  const regexp = new RegExp(`\\b${attributeName}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, "i");
  const match = regexp.exec(element);
  return match ? unquoteHtmlAttribute(match[1]) : "";
}

function unquoteHtmlAttribute(value) {
  return cleanText(value).replace(/^["']|["']$/g, "");
}

function extractHtmlBody(html) {
  const match = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return match ? match[1] : html;
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, " ");
}

function normalizeDoi(value) {
  return cleanText(value)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .toLowerCase();
}

function trimTrailingSlash(value) {
  return cleanText(value).replace(/\/+$/, "");
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assertFetchRuntime(fetchImpl) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Sci-PDF fetch runtime unavailable");
  }
}

const WorkbenchSciPdfEmbeddedResolver = {
  SCI_PDF_PRESET_BASE_URLS,
  SCI_PDF_USER_AGENT,
  buildSciPdfRequestUrl,
  createSciPdfCustomResolver,
  createSciPdfCustomResolvers,
  extractSciPdfDoiValues,
  extractSciPdfPdfUrlFromHtml,
  isSciPdfNotFoundHtml,
  mergeSciPdfResolvers,
  normalizeDoi,
  normalizeSciPdfBaseUrl,
  normalizeSciPdfBaseUrls,
  parseSciPdfResolverPref,
  resolveSciPdfDoi,
  serializeSciPdfResolverPref
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchSciPdfEmbeddedResolver;
}

if (typeof window !== "undefined") {
  window.WorkbenchSciPdfEmbeddedResolver = WorkbenchSciPdfEmbeddedResolver;
}
})();
```

- [ ] **Step 4: Export the resolver boundary from the core index**

Modify `src/core/index.js` near the other `require` calls:

```js
const WorkbenchSciPdfEmbeddedResolver = require("./scipdfEmbeddedResolver");
```

Add it to the exported object:

```js
  WorkbenchSciPdfEmbeddedResolver,
```

- [ ] **Step 5: Run resolver boundary tests and verify they pass**

Run:

```powershell
node --test tests\scipdf-embedded-resolver.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit the resolver boundary**

Run:

```powershell
git add src\core\scipdfEmbeddedResolver.js src\core\index.js tests\scipdf-embedded-resolver.test.js
git commit -m "feat: add embedded scipdf resolver boundary"
```

## Task 3: Integrate Sci-PDF With Candidate Protocol And Source Adapters

**Files:**
- Modify: `src/core/documentCandidateProtocol.js`
- Modify: `src/core/literatureSourceAdapters.js`
- Modify: `tests/document-candidate-protocol.test.js`
- Modify: `tests/literature-source-adapters.test.js`

- [ ] **Step 1: Add failing protocol and adapter tests**

Append this test to `tests/document-candidate-protocol.test.js`:

```js
test("normalizeAttachmentReference accepts embedded Sci-PDF provenance", () => {
  const attachment = normalizeAttachmentReference({
    kind: "sci-hub-resolved-url",
    url: "https://sci-hub.se/downloads/example.pdf",
    provenance: {
      source: "sci-pdf",
      sourceAdapterId: "sci-pdf",
      requestUrl: "https://sci-hub.se/10.1000/example",
      resolverMode: "html",
      selector: "#pdf"
    }
  });

  assert.equal(attachment.importable, true);
  assert.equal(attachment.provenance.source, "sci-pdf");
  assert.equal(attachment.kind, "sci-hub-resolved-url");
});
```

Update the import list in `tests/literature-source-adapters.test.js`:

```js
  createSciHubResolverAdapter,
  createSciPdfEmbeddedAdapter,
```

Append this adapter test to `tests/literature-source-adapters.test.js`:

```js
test("Sci-PDF embedded adapter returns provenance-bearing PDF candidates from HTML", async () => {
  const adapter = createSciPdfEmbeddedAdapter({
    baseUrls: ["https://sci-hub.se/"],
    fetchImpl: async (url) => {
      assert.equal(url, "https://sci-hub.se/10.1000%2Fembedded");
      return {
        ok: true,
        status: 200,
        text: async () => '<html><body><iframe id="pdf" src="/downloads/embedded.pdf"></iframe></body></html>'
      };
    }
  });

  const result = await adapter.query({
    dois: ["10.1000/embedded"],
    topicId: "topic-a",
    observedAt: "2026-05-25T06:30:00.000Z"
  });

  assert.equal(result.sourceAdapterId, "sci-pdf");
  assert.equal(result.failures.length, 0);
  assert.equal(result.candidates[0].sourceAdapterId, "sci-pdf");
  assert.equal(result.candidates[0].doi, "10.1000/embedded");
  assert.equal(result.candidates[0].attachments[0].kind, "sci-hub-resolved-url");
  assert.equal(result.candidates[0].attachments[0].importable, true);
  assert.deepEqual(result.candidates[0].attachments[0].provenance, {
    source: "sci-pdf",
    sourceAdapterId: "sci-pdf",
    sourceUrl: "https://sci-hub.se/10.1000%2Fembedded",
    requestUrl: "https://sci-hub.se/10.1000%2Fembedded",
    resolverMode: "html",
    selector: "#pdf",
    upstream: "syt2/zotero-scipdf@af4a838"
  });
});

test("Sci-PDF embedded adapter reports missing DOI and invalid site failures visibly", async () => {
  const missingDoi = await createSciPdfEmbeddedAdapter({
    baseUrls: ["https://sci-hub.se/"],
    fetchImpl: async () => {
      throw new Error("fetch should not run without DOI");
    }
  }).query({ dois: [] });

  assert.equal(missingDoi.candidates.length, 0);
  assert.equal(missingDoi.failures[0].sourceAdapterId, "sci-pdf");
  assert.match(missingDoi.failures[0].userMessage, /requires at least one DOI/);

  const invalidSite = await createSciPdfEmbeddedAdapter({
    baseUrls: ["not a url"],
    fetchImpl: async () => {
      throw new Error("fetch should not run without valid site");
    }
  }).query({ dois: ["10.1000/no-site"] });

  assert.equal(invalidSite.candidates.length, 0);
  assert.match(invalidSite.failures[0].userMessage, /valid Sci-PDF site/);
});

test("core index exports Sci-PDF embedded source adapter", () => {
  assert.equal(typeof core.WorkbenchLiteratureSourceAdapters.createSciPdfEmbeddedAdapter, "function");
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```powershell
node --test tests\document-candidate-protocol.test.js tests\literature-source-adapters.test.js
```

Expected: FAIL because `sci-pdf` provenance is blocked and `createSciPdfEmbeddedAdapter` is not exported.

- [ ] **Step 3: Update protocol importability for embedded Sci-PDF provenance**

In `src/core/documentCandidateProtocol.js`, replace the `sci-hub-resolved-url` branch with:

```js
  } else if (kind === "sci-hub-resolved-url") {
    importable = isHttpUrl(url) && ["sci-hub", "sci-pdf"].includes(cleanText(provenance.source));
    if (!importable) importBlockReason = CANDIDATE_ANOMALY_TAGS.unclearAttachment;
```

- [ ] **Step 4: Add the embedded adapter runtime dependency**

At the top of `src/core/literatureSourceAdapters.js`, after `DocumentCandidateProtocol`, add:

```js
const SciPdfEmbeddedResolver =
  typeof require === "function"
    ? require("./scipdfEmbeddedResolver")
    : typeof window !== "undefined"
      ? window.WorkbenchSciPdfEmbeddedResolver
      : null;
```

- [ ] **Step 5: Add `createSciPdfEmbeddedAdapter`**

Add this function in `src/core/literatureSourceAdapters.js` after `createSciHubResolverAdapter`:

```js
function createSciPdfEmbeddedAdapter({ fetchImpl, baseUrls } = {}) {
  return {
    sourceAdapterId: "sci-pdf",
    async query({ dois, selectedItems, documentCandidates, observedAt, topicId } = {}) {
      assertFetchRuntime(fetchImpl);
      assertSciPdfRuntime();
      const normalizedBaseUrls = SciPdfEmbeddedResolver.normalizeSciPdfBaseUrls(baseUrls);
      if (!normalizedBaseUrls.length) {
        return adapterResult("sci-pdf", [], [
          createSourceAdapterFailure({
            sourceAdapterId: "sci-pdf",
            userMessage: "Sci-PDF requires at least one valid Sci-PDF site",
            error: { reason: "missing-base-url" }
          })
        ]);
      }

      const normalizedDois = SciPdfEmbeddedResolver.extractSciPdfDoiValues(
        dois,
        selectedItems,
        documentCandidates
      );
      if (!normalizedDois.length) {
        return adapterResult("sci-pdf", [], [
          createSourceAdapterFailure({
            sourceAdapterId: "sci-pdf",
            userMessage: "Sci-PDF requires at least one DOI",
            error: { reason: "missing-doi" }
          })
        ]);
      }

      const candidates = [];
      const failures = [];
      for (const doi of normalizedDois) {
        const resolved = await SciPdfEmbeddedResolver.resolveSciPdfDoi({
          doi,
          baseUrls: normalizedBaseUrls,
          fetchImpl
        });
        if (resolved.pdfUrl) {
          candidates.push(normalizeSciPdfEmbeddedRecord({ resolved, observedAt, topicId }));
          continue;
        }
        failures.push(createSourceAdapterFailure({
          sourceAdapterId: "sci-pdf",
          userMessage: "Sci-PDF did not find a PDF for DOI",
          error: {
            doi,
            failures: resolved.failures
          }
        }));
      }

      return adapterResult("sci-pdf", candidates, failures);
    }
  };
}
```

- [ ] **Step 6: Add adapter helper functions**

Add these helper functions near the existing normalize helpers in `src/core/literatureSourceAdapters.js`:

```js
function assertSciPdfRuntime() {
  if (!SciPdfEmbeddedResolver) {
    throw new Error("Sci-PDF embedded resolver runtime unavailable");
  }
}

function normalizeSciPdfEmbeddedRecord({ resolved, observedAt, topicId } = {}) {
  const doi = SciPdfEmbeddedResolver.normalizeDoi(resolved?.doi);
  return normalizeDocumentCandidate({
    sourceAdapterId: "sci-pdf",
    sourceRecordId: doi,
    title: `Sci-PDF PDF ${doi}`,
    doi,
    stableUrl: doi ? `https://doi.org/${doi}` : "",
    openAccessStatus: "unknown",
    topicId: cleanText(topicId),
    provenance: {
      source: "sci-pdf",
      sourceAdapterId: "sci-pdf",
      sourceUrl: cleanText(resolved?.sourceUrl),
      requestUrl: cleanText(resolved?.requestUrl),
      upstream: "syt2/zotero-scipdf@af4a838"
    },
    attachments: [
      {
        kind: "sci-hub-resolved-url",
        url: cleanText(resolved?.pdfUrl),
        contentType: "application/pdf",
        license: "unknown",
        provenance: {
          source: "sci-pdf",
          sourceAdapterId: "sci-pdf",
          sourceUrl: cleanText(resolved?.sourceUrl),
          requestUrl: cleanText(resolved?.requestUrl),
          resolverMode: cleanText(resolved?.resolver?.mode) || "html",
          selector: cleanText(resolved?.resolver?.selector) || "#pdf",
          upstream: "syt2/zotero-scipdf@af4a838"
        }
      }
    ],
    observedAt
  });
}
```

- [ ] **Step 7: Export the embedded adapter**

Add `createSciPdfEmbeddedAdapter` to `WorkbenchLiteratureSourceAdapters` in `src/core/literatureSourceAdapters.js`:

```js
  createSciHubResolverAdapter,
  createSciPdfEmbeddedAdapter,
```

- [ ] **Step 8: Run focused tests and verify they pass**

Run:

```powershell
node --test tests\document-candidate-protocol.test.js tests\literature-source-adapters.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit protocol and adapter integration**

Run:

```powershell
git add src\core\documentCandidateProtocol.js src\core\literatureSourceAdapters.js tests\document-candidate-protocol.test.js tests\literature-source-adapters.test.js
git commit -m "feat: add scipdf embedded source adapter"
```

## Task 4: Add The Dedicated `PDF 获取` Tab Markup And Styling

**Files:**
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `tests/ui-localization.test.js`
- Modify: `tests/package.test.js`

- [ ] **Step 1: Add failing UI and package tests**

In `tests/ui-localization.test.js`, add these strings to the `research panel exposes Chinese LLM provider settings` expected text list:

```js
    "PDF 获取",
    "从选中文献、发现候选或 DOI 列表生成可复核 PDF 候选",
    "查找 PDF 候选",
    "Sci-PDF Embedded",
    "Open Access Sources",
    "Sci-Hub 站点列表",
    "测试站点",
    "同步到 Zotero Find Full Text",
    "高级选项，默认关闭；会影响 Zotero 原生 Find Full Text。",
    "选中文献",
    "DOI 数量",
    "写入策略",
    "PDF 候选",
    "加入写入计划前请先复核来源、请求地址和附件类型。"
```

Add these id/class assertions to the same test:

```js
  for (const id of [
    "workbench-tab-pdf-acquisition",
    "pdf-acquisition-panel",
    "pdf-acquisition-find-candidates",
    "pdf-source-scipdf-enabled",
    "pdf-source-scipdf-base-urls",
    "pdf-source-scipdf-test-sites",
    "pdf-source-open-access-enabled",
    "pdf-source-scipdf-sync-enabled",
    "pdf-source-scipdf-sync-zotero",
    "pdf-acquisition-selected-status",
    "pdf-acquisition-doi-status",
    "pdf-acquisition-write-strategy",
    "pdf-acquisition-candidate-list",
    "pdf-acquisition-status"
  ]) {
    assert.match(panel, new RegExp(`id="${id}"`));
  }
  assert.match(panel, /class="workbench-tabs"/);
  assert.match(panel, /class="pdf-source-card pdf-source-card-primary"/);
  assert.match(panel, /class="pdf-source-card pdf-source-card-secondary"/);
```

In `tests/package.test.js`, update `research panel loads v0.4 core modules before dependent runtime modules`:

```js
  assert.ok(indexOfScript("scipdfEmbeddedResolver.js") >= 0);
  assert.ok(indexOfScript("documentCandidateProtocol.js") < indexOfScript("scipdfEmbeddedResolver.js"));
  assert.ok(indexOfScript("scipdfEmbeddedResolver.js") < indexOfScript("literatureSourceAdapters.js"));
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```powershell
node --test tests\ui-localization.test.js tests\package.test.js
```

Expected: FAIL because the tab markup and script load do not exist.

- [ ] **Step 3: Load the new runtime module before source adapters**

In `chrome/content/researchPanel.xhtml`, insert this script after `documentCandidateProtocol.js` and before `literatureDiscovery.js`:

```html
    <script src="scipdfEmbeddedResolver.js"></script>
```

- [ ] **Step 4: Add tab styling**

Add this CSS in `chrome/content/researchPanel.xhtml` near the existing layout classes:

```css
      .workbench-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-block: 8px 10px;
      }

      .workbench-tab {
        min-height: 30px;
        padding-inline: 12px;
        border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
        border-radius: 6px;
        background: ButtonFace;
        color: ButtonText;
      }

      .workbench-tab[aria-selected="true"] {
        border-color: Highlight;
        background: color-mix(in srgb, Highlight 16%, Canvas);
        color: CanvasText;
        font-weight: 600;
      }

      .pdf-acquisition-panel {
        display: grid;
        gap: 10px;
        border-color: color-mix(in srgb, #1f9d55 50%, CanvasText 16%);
        background: color-mix(in srgb, #1f9d55 5%, Canvas);
      }

      .pdf-acquisition-hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
      }

      .pdf-acquisition-hero h2 {
        margin: 0;
        font-size: 18px;
      }

      .pdf-acquisition-hero p {
        margin: 3px 0 0;
        color: color-mix(in srgb, CanvasText 72%, transparent);
      }

      .pdf-source-grid {
        display: grid;
        grid-template-columns: minmax(220px, 1.4fr) minmax(180px, 0.9fr);
        gap: 10px;
      }

      .pdf-source-card {
        display: grid;
        gap: 8px;
        padding: 10px;
        border: 1px solid color-mix(in srgb, CanvasText 16%, transparent);
        border-radius: 8px;
        background: Canvas;
      }

      .pdf-source-card-primary {
        border-color: color-mix(in srgb, #1f9d55 64%, CanvasText 12%);
        box-shadow: inset 3px 0 0 #1f9d55;
      }

      .pdf-source-card-secondary {
        border-color: color-mix(in srgb, Highlight 28%, CanvasText 12%);
      }

      .pdf-status-strip {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .pdf-status-cell {
        display: grid;
        gap: 2px;
        min-height: 44px;
        padding: 8px;
        border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
        border-radius: 6px;
        background: color-mix(in srgb, CanvasText 4%, Canvas);
      }

      .pdf-candidate-list {
        display: grid;
        gap: 8px;
      }

      .pdf-candidate-row {
        display: grid;
        gap: 4px;
        padding: 8px;
        border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
        border-radius: 6px;
        background: Canvas;
      }

      .pdf-write-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding-top: 8px;
        border-top: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
      }

      @media (max-width: 720px) {
        .pdf-acquisition-hero,
        .pdf-source-grid,
        .pdf-status-strip {
          grid-template-columns: 1fr;
        }
      }
```

- [ ] **Step 5: Add the dedicated PDF tab and panel markup**

In `chrome/content/researchPanel.xhtml`, inside `section id="v04-literature-pipeline"` before the existing `研究主题` section header, add:

```html
          <nav class="workbench-tabs" role="tablist" aria-label="研究工作台视图">
            <button id="workbench-tab-literature-discovery" class="workbench-tab" type="button" role="tab" aria-selected="true" aria-controls="v04-literature-pipeline">文献发现</button>
            <button id="workbench-tab-pdf-acquisition" class="workbench-tab" type="button" role="tab" aria-selected="true" aria-controls="pdf-acquisition-panel">PDF 获取</button>
            <button id="workbench-tab-zotero-write" class="workbench-tab" type="button" role="tab" aria-selected="false" aria-controls="zotero-write-queue-list">写入队列</button>
          </nav>
          <section id="pdf-acquisition-panel" class="pdf-acquisition-panel" role="tabpanel" aria-labelledby="workbench-tab-pdf-acquisition">
            <div class="pdf-acquisition-hero">
              <div>
                <h2>PDF 获取</h2>
                <p>从选中文献、发现候选或 DOI 列表生成可复核 PDF 候选</p>
              </div>
              <button id="pdf-acquisition-find-candidates" type="button" class="primary-action">查找 PDF 候选</button>
            </div>
            <div class="pdf-source-grid">
              <div class="pdf-source-card pdf-source-card-primary">
                <label class="checkbox-label">
                  <input id="pdf-source-scipdf-enabled" type="checkbox" checked="checked" />
                  <span>Sci-PDF Embedded</span>
                </label>
                <label>
                  <span>Sci-Hub 站点列表</span>
                  <textarea id="pdf-source-scipdf-base-urls" rows="4">https://sci-hub.se/
https://sci-hub.st/
https://sci-hub.ru/</textarea>
                </label>
                <div class="actions">
                  <button id="pdf-source-scipdf-test-sites" type="button">测试站点</button>
                </div>
                <label class="checkbox-label">
                  <input id="pdf-source-scipdf-sync-enabled" type="checkbox" />
                  <span>同步到 Zotero Find Full Text</span>
                </label>
                <span class="status">高级选项，默认关闭；会影响 Zotero 原生 Find Full Text。</span>
                <button id="pdf-source-scipdf-sync-zotero" type="button">同步到 Zotero Find Full Text</button>
              </div>
              <div class="pdf-source-card pdf-source-card-secondary">
                <label class="checkbox-label">
                  <input id="pdf-source-open-access-enabled" type="checkbox" checked="checked" />
                  <span>Open Access Sources</span>
                </label>
                <span class="status">复用 OpenAlex、Unpaywall、Crossref 已发现的开放获取 PDF 链接。</span>
              </div>
            </div>
            <div class="pdf-status-strip" aria-live="polite">
              <div class="pdf-status-cell">
                <strong>选中文献</strong>
                <span id="pdf-acquisition-selected-status">未读取</span>
              </div>
              <div class="pdf-status-cell">
                <strong>DOI 数量</strong>
                <span id="pdf-acquisition-doi-status">0</span>
              </div>
              <div class="pdf-status-cell">
                <strong>写入策略</strong>
                <span id="pdf-acquisition-write-strategy">先复核候选，再加入 Zotero 写入队列</span>
              </div>
            </div>
            <div class="section-header">
              <strong>PDF 候选</strong>
              <span id="pdf-acquisition-status" class="status">加入写入计划前请先复核来源、请求地址和附件类型。</span>
            </div>
            <div id="pdf-acquisition-candidate-list" class="pdf-candidate-list" aria-live="polite">
              <div class="pdf-candidate-row">暂无 PDF 候选</div>
            </div>
            <div class="pdf-write-actions">
              <button id="pdf-acquisition-add-to-write-plan" type="button">批量加入写入计划</button>
              <span class="status">写入动作与搜索动作分离；执行队列前仍需确认。</span>
            </div>
          </section>
```

- [ ] **Step 6: Run focused UI and package tests and verify they pass**

Run:

```powershell
node --test tests\ui-localization.test.js tests\package.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit the PDF tab markup**

Run:

```powershell
git add chrome\content\researchPanel.xhtml tests\ui-localization.test.js tests\package.test.js
git commit -m "feat: add prominent pdf acquisition tab"
```

## Task 5: Wire PDF Tab Search And Candidate Rendering

**Files:**
- Modify: `chrome/content/paperSummary.js`
- Modify: `tests/literature-discovery-ui.test.js`

- [ ] **Step 1: Add failing PDF tab runtime tests**

In `tests/literature-discovery-ui.test.js`, add this test:

```js
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

  assert.deepEqual(harness.window.__createdSourceAdapters, [
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
```

Add this test:

```js
test("PDF acquisition default rendering does not sync Zotero Find Full Text resolvers", () => {
  const harness = createRuntimeHarness();
  loadPaperSummaryRuntime(harness);
  harness.document.fireDOMContentLoaded();

  assert.equal(harness.prefs.has("extensions.zotero.findPDFs.resolvers"), false);
  assert.equal(harness.document.getElementById("pdf-source-scipdf-sync-enabled").checked, false);
});
```

Update `createRuntimeHarness` so fake documents include the new PDF ids. In the element id list used by `createFakeDocument`, include:

```js
  "pdf-acquisition-find-candidates",
  "pdf-source-scipdf-enabled",
  "pdf-source-scipdf-base-urls",
  "pdf-source-scipdf-test-sites",
  "pdf-source-open-access-enabled",
  "pdf-source-scipdf-sync-enabled",
  "pdf-source-scipdf-sync-zotero",
  "pdf-acquisition-selected-status",
  "pdf-acquisition-doi-status",
  "pdf-acquisition-write-strategy",
  "pdf-acquisition-candidate-list",
  "pdf-acquisition-status",
  "pdf-acquisition-add-to-write-plan"
```

Update `createWorkbenchRuntimeModules(window)` so `WorkbenchLiteratureSourceAdapters` exposes a fake adapter factory:

```js
      createSciPdfEmbeddedAdapter({ baseUrls }) {
        window.__createdSourceAdapters.push({ sourceAdapterId: "sci-pdf", baseUrls });
        return {
          sourceAdapterId: "sci-pdf",
          async query({ dois }) {
            window.__queriedSourceAdapters.push("sci-pdf");
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
```

- [ ] **Step 2: Run PDF tab UI tests and verify they fail**

Run:

```powershell
node --test tests\literature-discovery-ui.test.js
```

Expected: FAIL because `paperSummary.js` does not bind the new PDF tab controls.

- [ ] **Step 3: Import the embedded adapter factory in `paperSummary.js`**

Near the existing `WorkbenchLiteratureSourceAdapters` check in `chrome/content/paperSummary.js`, add:

```js
  const { createSciPdfEmbeddedAdapter } = WorkbenchLiteratureSourceAdapters;
```

Keep the existing adapter destructuring intact.

- [ ] **Step 4: Add PDF acquisition settings helpers**

Add these helpers near the other DOM read helpers in `chrome/content/paperSummary.js`:

```js
  function readPdfAcquisitionSettings() {
    return {
      sciPdfEnabled: getField("pdf-source-scipdf-enabled")?.checked !== false,
      openAccessEnabled: getField("pdf-source-open-access-enabled")?.checked !== false,
      sciPdfBaseUrls: readMultilineValues("pdf-source-scipdf-base-urls"),
      syncToZoteroFindFullText: getField("pdf-source-scipdf-sync-enabled")?.checked === true
    };
  }

  function readMultilineValues(fieldId) {
    return String(getField(fieldId)?.value || "")
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function collectPdfAcquisitionDois(snapshot) {
    const resolver = window.WorkbenchSciPdfEmbeddedResolver;
    if (!resolver) {
      return [];
    }
    return resolver.extractSciPdfDoiValues(
      window.WorkbenchSelectedPaper,
      snapshot?.documentCandidates || []
    );
  }
```

- [ ] **Step 5: Add source adapter creation for the PDF tab**

Add this helper in `chrome/content/paperSummary.js`:

```js
  function createPdfAcquisitionSourceAdapters(settings) {
    const adapters = [];
    if (settings.sciPdfEnabled) {
      adapters.push(createSciPdfEmbeddedAdapter({
        fetchImpl: workbenchFetch,
        baseUrls: settings.sciPdfBaseUrls
      }));
    }
    return adapters;
  }
```

- [ ] **Step 6: Add PDF candidate rendering**

Add these functions in `chrome/content/paperSummary.js` near `renderDocumentCandidateReview`:

```js
  function renderPdfAcquisitionCandidates(candidates) {
    const list = getField("pdf-acquisition-candidate-list");
    if (!list) {
      return;
    }
    replaceChildren(list);
    const pdfRows = [];
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
      for (const attachment of Array.isArray(candidate.attachments) ? candidate.attachments : []) {
        if (!attachment.kind || !String(attachment.kind).includes("pdf") && attachment.kind !== "sci-hub-resolved-url") {
          continue;
        }
        pdfRows.push({ candidate, attachment });
      }
    }
    if (!pdfRows.length) {
      list.appendChild(createTextRecord("暂无 PDF 候选", "pdf-candidate-row"));
      return;
    }
    for (const row of pdfRows) {
      list.appendChild(createPdfCandidateRow(row.candidate, row.attachment));
    }
  }

  function createPdfCandidateRow(candidate, attachment) {
    const row = createHtmlElement("div");
    row.className = "pdf-candidate-row";
    const title = createHtmlElement("strong");
    title.textContent = candidate.title || "未命名候选文献";
    const meta = createHtmlElement("span");
    meta.className = "record-meta";
    meta.textContent = [
      `来源 ${candidate.sourceAdapterId || attachment.provenance?.source || "unknown"}`,
      attachment.kind,
      attachment.importable ? "可导入" : `不可导入 ${attachment.importBlockReason || ""}`.trim(),
      `license ${attachment.license || "unknown"}`
    ].join("｜");
    const detail = createHtmlElement("span");
    detail.className = "record-meta";
    detail.textContent = [
      attachment.provenance?.sourceUrl ? `source ${attachment.provenance.sourceUrl}` : "",
      attachment.provenance?.requestUrl ? `request ${attachment.provenance.requestUrl}` : "",
      attachment.provenance?.selector ? `selector ${attachment.provenance.selector}` : ""
    ].filter(Boolean).join("｜");
    row.appendChild(title);
    row.appendChild(meta);
    row.appendChild(detail);
    return row;
  }

  function createTextRecord(text, className = "record-item") {
    const item = createHtmlElement("div");
    item.className = className;
    item.textContent = text;
    return item;
  }
```

- [ ] **Step 7: Add the PDF search workflow**

Add this async function in `chrome/content/paperSummary.js`:

```js
  async function findPdfAcquisitionCandidates() {
    const snapshot = WorkbenchStore.loadSnapshot();
    const settings = readPdfAcquisitionSettings();
    const dois = collectPdfAcquisitionDois(snapshot);
    setText("pdf-acquisition-selected-status", window.WorkbenchSelectedPaper?.title || "未选择文献");
    setText("pdf-acquisition-doi-status", String(dois.length));
    if (!dois.length) {
      setText("pdf-acquisition-status", "未找到 DOI");
      renderPdfAcquisitionCandidates([]);
      return;
    }

    const adapters = createPdfAcquisitionSourceAdapters(settings);
    const candidates = [];
    const failures = [];
    for (const adapter of adapters) {
      const result = await adapter.query({
        dois,
        selectedItems: [window.WorkbenchSelectedPaper].filter(Boolean),
        documentCandidates: snapshot.documentCandidates || [],
        observedAt: new Date().toISOString(),
        topicId: snapshot.researchTopics?.[0]?.id || ""
      });
      candidates.push(...(result.candidates || []));
      failures.push(...(result.failures || []));
    }

    window.WorkbenchPdfAcquisitionCandidates = candidates;
    renderPdfAcquisitionCandidates(candidates);
    setText("pdf-acquisition-status", `PDF 候选 ${candidates.length}｜来源失败 ${failures.length}`);
  }
```

- [ ] **Step 8: Bind PDF acquisition controls**

Add this function near other binding helpers:

```js
  function bindPdfAcquisitionControls() {
    getField("pdf-acquisition-find-candidates")?.addEventListener("click", () => {
      runUiAction(findPdfAcquisitionCandidates, "pdf-acquisition-status");
    });
    getField("pdf-source-scipdf-test-sites")?.addEventListener("click", () => {
      const settings = readPdfAcquisitionSettings();
      const resolver = window.WorkbenchSciPdfEmbeddedResolver;
      const validUrls = resolver ? resolver.normalizeSciPdfBaseUrls(settings.sciPdfBaseUrls) : [];
      setText("pdf-acquisition-status", `Sci-PDF 站点 ${validUrls.length} 个可用配置`);
    });
  }
```

Call `bindPdfAcquisitionControls()` from the existing `DOMContentLoaded` setup path, next to the other `bind...` calls.

- [ ] **Step 9: Run PDF tab UI tests and verify they pass**

Run:

```powershell
node --test tests\literature-discovery-ui.test.js
```

Expected: PASS.

- [ ] **Step 10: Commit PDF tab wiring**

Run:

```powershell
git add chrome\content\paperSummary.js tests\literature-discovery-ui.test.js
git commit -m "feat: wire scipdf pdf acquisition tab"
```

## Task 6: Add Explicit Zotero Find Full Text Sync

**Files:**
- Modify: `chrome/content/paperSummary.js`
- Modify: `tests/literature-discovery-ui.test.js`

- [ ] **Step 1: Add failing explicit sync tests**

Append this test to `tests/literature-discovery-ui.test.js`:

```js
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
```

Ensure the fake `Zotero.Prefs.set` implementation in `createRuntimeHarness` stores every key in `harness.prefs`.

- [ ] **Step 2: Run the sync tests and verify they fail**

Run:

```powershell
node --test tests\literature-discovery-ui.test.js
```

Expected: FAIL because the sync button does not write the explicit resolver preference.

- [ ] **Step 3: Add the explicit sync function**

Add this function in `chrome/content/paperSummary.js`:

```js
  function syncSciPdfResolversToZoteroFindFullText() {
    const settings = readPdfAcquisitionSettings();
    if (!settings.syncToZoteroFindFullText) {
      setText("pdf-acquisition-status", "请先开启同步到 Zotero Find Full Text");
      return;
    }
    const resolverModule = window.WorkbenchSciPdfEmbeddedResolver;
    if (!resolverModule) {
      setText("pdf-acquisition-status", "Sci-PDF resolver runtime 不可用");
      return;
    }
    const zotero = getZotero();
    if (!zotero?.Prefs?.get || !zotero?.Prefs?.set) {
      setText("pdf-acquisition-status", "Zotero Prefs runtime 不可用");
      return;
    }

    const existing = resolverModule.parseSciPdfResolverPref(
      zotero.Prefs.get("extensions.zotero.findPDFs.resolvers") || ""
    );
    const incoming = resolverModule.createSciPdfCustomResolvers(settings.sciPdfBaseUrls, { automatic: false });
    const merged = resolverModule.mergeSciPdfResolvers(existing, incoming);
    zotero.Prefs.set(
      "extensions.zotero.findPDFs.resolvers",
      resolverModule.serializeSciPdfResolverPref(merged)
    );
    setText("pdf-acquisition-status", `已同步 ${incoming.length} 个 Sci-PDF resolver 到 Zotero Find Full Text`);
  }
```

- [ ] **Step 4: Bind the sync button**

In `bindPdfAcquisitionControls()`, add:

```js
    getField("pdf-source-scipdf-sync-zotero")?.addEventListener("click", () => {
      syncSciPdfResolversToZoteroFindFullText();
    });
```

- [ ] **Step 5: Run sync tests and verify they pass**

Run:

```powershell
node --test tests\literature-discovery-ui.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit explicit Zotero resolver sync**

Run:

```powershell
git add chrome\content\paperSummary.js tests\literature-discovery-ui.test.js
git commit -m "feat: add explicit scipdf find full text sync"
```

## Task 7: Package Runtime Module And Vendored License Materials

**Files:**
- Modify: `scripts/build-xpi.ps1`
- Modify: `tests/package.test.js`

- [ ] **Step 1: Add failing package boundary assertions**

In `tests/package.test.js`, update `build script exists and documents the runtime package boundary` with these assertions:

```js
  assert.match(script, /src\/core\/scipdfEmbeddedResolver\.js/);
  assert.match(script, /scipdfEmbeddedResolver\.js/);
  assert.match(script, /vendor\/zotero-scipdf/);
  assert.match(script, /NOTICE\.md/);
  assert.match(script, /LICENSE/);
```

Update `built XPI includes extracted runtime modules before paper summary` with these assertions:

```js
    assert.match(listing, /chrome\/content\/scipdfEmbeddedResolver\.js/);
    assert.match(listing, /vendor\/zotero-scipdf\/README\.md/);
    assert.match(listing, /vendor\/zotero-scipdf\/NOTICE\.md/);
    assert.match(listing, /vendor\/zotero-scipdf\/LICENSE/);
    assert.match(listing, /vendor\/zotero-scipdf\/src\/modules\/CustomResolver\.ts/);
    assert.match(listing, /vendor\/zotero-scipdf\/src\/modules\/SciHubFetcher\.ts/);
```

Also add this load-order assertion:

```js
    assert.ok(panel.indexOf("documentCandidateProtocol.js") < panel.indexOf("scipdfEmbeddedResolver.js"));
    assert.ok(panel.indexOf("scipdfEmbeddedResolver.js") < panel.indexOf("literatureSourceAdapters.js"));
```

- [ ] **Step 2: Run package tests and verify they fail**

Run:

```powershell
node --test tests\package.test.js
```

Expected: FAIL because the build script does not copy the new runtime module or vendor folder.

- [ ] **Step 3: Copy the resolver runtime into the XPI package**

In `scripts/build-xpi.ps1`, add this line after the `documentCandidateProtocol.js` copy:

```powershell
Copy-Item -LiteralPath (Join-Path $projectRoot "src/core/scipdfEmbeddedResolver.js") -Destination (Join-Path $packageDir "chrome/content/scipdfEmbeddedResolver.js")
```

- [ ] **Step 4: Copy the vendor Sci-PDF folder into the XPI package**

In `scripts/build-xpi.ps1`, after creating `chrome/content`, add:

```powershell
New-Item -ItemType Directory -Force -Path (Join-Path $packageDir "vendor") | Out-Null
```

Before `Compress-Archive`, add:

```powershell
Copy-Item -LiteralPath (Join-Path $projectRoot "vendor/zotero-scipdf") -Destination (Join-Path $packageDir "vendor") -Recurse
```

- [ ] **Step 5: Build package and run package tests**

Run:

```powershell
npm run package
node --test tests\package.test.js
```

Expected: PASS and the XPI listing includes `chrome/content/scipdfEmbeddedResolver.js` plus `vendor/zotero-scipdf` license and notice files.

- [ ] **Step 6: Commit packaging changes**

Run:

```powershell
git add scripts\build-xpi.ps1 tests\package.test.js
git commit -m "build: package scipdf runtime and notices"
```

## Task 8: Document Embedded Sci-PDF Behavior

**Files:**
- Modify: `README.md`
- Modify: `tests/package.test.js`

- [ ] **Step 1: Add failing README assertions**

In `tests/package.test.js`, inside `build script exists and documents the runtime package boundary`, add:

```js
  assert.match(readme, /Sci-PDF Embedded/);
  assert.match(readme, /PDF 获取/);
  assert.match(readme, /AGPL-3\.0-or-later/);
  assert.match(readme, /不会静默下载或附加 PDF/);
  assert.match(readme, /同步到 Zotero Find Full Text/);
  assert.match(readme, /默认关闭/);
```

- [ ] **Step 2: Run the README assertion and verify it fails**

Run:

```powershell
node --test tests\package.test.js
```

Expected: FAIL because README does not describe the embedded Sci-PDF tab behavior.

- [ ] **Step 3: Add README documentation**

Add this section to `README.md` near the existing PDF acquisition description:

```markdown
## PDF 获取与 Sci-PDF Embedded

`PDF 获取` 是研究工作台的专用 PDF acquisition 入口。它从当前选中文献、已有发现候选和 DOI 列表生成可复核 PDF 候选，并在候选行中显示来源、附件类型、可导入状态、license、source URL、request URL 和 resolver selector。

`Sci-PDF Embedded` 使用 `syt2/zotero-scipdf` commit `af4a838` 的解析思路作为嵌入依赖参考，并在 `vendor/zotero-scipdf` 中保留 `AGPL-3.0-or-later` license 和 notice。Workbench 运行的是 `src/core/scipdfEmbeddedResolver.js` 中的边界模块，不会执行 Sci-PDF 原插件的启动钩子。

默认边界：

- 不会静默下载或附加 PDF。
- 不会在插件启动时写入 Zotero 全局 `extensions.zotero.findPDFs.resolvers`。
- 不会自动注册 Sci-PDF 原插件的右键菜单。
- 所有 PDF 写入仍需先经过候选复核，再进入 Zotero 写入队列。

高级动作 `同步到 Zotero Find Full Text` 默认关闭。只有用户在 `PDF 获取` tab 中开启并点击同步按钮时，Workbench 才会把 Sci-PDF-style resolver entries 写入 Zotero 原生 Find Full Text resolver 偏好。
```

- [ ] **Step 4: Run README package tests and verify they pass**

Run:

```powershell
node --test tests\package.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit README documentation**

Run:

```powershell
git add README.md tests\package.test.js
git commit -m "docs: document scipdf pdf acquisition"
```

## Task 9: Full Verification And Manual QA

**Files:**
- No planned source edits.
- Verification artifact: terminal output from the commands below.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
node --test tests\scipdf-vendor-notice.test.js
node --test tests\scipdf-embedded-resolver.test.js
node --test tests\document-candidate-protocol.test.js tests\literature-source-adapters.test.js
node --test tests\literature-discovery-ui.test.js
node --test tests\ui-localization.test.js tests\package.test.js
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run repository checks**

Run:

```powershell
npm run check
npm test
git diff --check
```

Expected:

- `npm run check`: exit 0.
- `npm test`: exit 0.
- `git diff --check`: no whitespace errors. Existing Windows LF/CRLF warnings are acceptable if they match the current repository behavior.

- [ ] **Step 3: Build the XPI and verify package contents**

Run:

```powershell
npm run package
node --test tests\package.test.js
```

Expected:

- `dist\zotero-research-workbench-0.4.0beta1.xpi` is built.
- Package tests PASS.
- XPI contains `chrome/content/scipdfEmbeddedResolver.js`.
- XPI contains `vendor/zotero-scipdf/LICENSE` and `vendor/zotero-scipdf/NOTICE.md`.

- [ ] **Step 4: Manual QA without real Zotero writes**

Run Zotero manually and verify:

```text
1. Open Tools -> 打开研究工作台.
2. Confirm the `PDF 获取` tab is visible near the literature workflow entry.
3. Confirm `Sci-PDF Embedded` is the green-accented primary card.
4. Confirm `Open Access Sources` is visible as a secondary card.
5. Confirm `同步到 Zotero Find Full Text` is unchecked by default.
6. Select a Zotero item with a DOI.
7. Enter one test Sci-Hub base URL in `Sci-Hub 站点列表`.
8. Click `查找 PDF 候选`.
9. Confirm candidate rows show `Sci-PDF`, `sci-hub-resolved-url`, importability, license, source URL, request URL, and selector.
10. Stop before executing the Zotero Write Queue unless the user explicitly approves a real Zotero data write.
```

Expected: PDF candidates are displayed with provenance and no Zotero item or attachment is written during search.

- [ ] **Step 5: Commit verification-only adjustments if any test fixtures changed**

If Task 9 required small test-fixture corrections, run:

```powershell
git add tests\scipdf-vendor-notice.test.js tests\scipdf-embedded-resolver.test.js tests\document-candidate-protocol.test.js tests\literature-source-adapters.test.js tests\literature-discovery-ui.test.js tests\ui-localization.test.js tests\package.test.js
git commit -m "test: stabilize scipdf pdf acquisition verification"
```

Expected: Only files intentionally changed during Task 9 are staged.

## Self-Review Checklist

- [ ] Spec coverage: tasks cover vendoring, embedded resolver, adapter integration, `PDF 获取` tab, visual source cards, candidate provenance, explicit Zotero sync, package inclusion, README, and verification.
- [ ] No automatic writes: search uses adapters only; Zotero attachment writes remain outside this plan except existing write queue actions; Zotero Find Full Text sync is an explicit button and defaults off.
- [ ] Licensing: vendor license, notice, source snapshot, README, build script, and package tests all preserve Sci-PDF attribution.
- [ ] Type consistency: new source id is `sci-pdf`; attachment kind remains `sci-hub-resolved-url`; protocol accepts both `sci-hub` and `sci-pdf` provenance.
- [ ] Runtime consistency: `scipdfEmbeddedResolver.js` loads before `literatureSourceAdapters.js`; Node exports and browser globals use `WorkbenchSciPdfEmbeddedResolver`.
- [ ] UI consistency: search action and write actions are separated; candidate rows expose provenance before queue planning.
