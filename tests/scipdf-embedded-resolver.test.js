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
